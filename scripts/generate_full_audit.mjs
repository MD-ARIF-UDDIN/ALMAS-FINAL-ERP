import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function fullAudit() {
  const { data: branches } = await supabase.from('branches').select('*');
  const gazipur = branches.find(b => b.name?.toLowerCase().includes('gazipur'));
  const gazipurId = gazipur.id;

  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, invoice_number, purchase_date, purchase_items(product_id, quantity, unit_price, products(product_code, name))')
    .eq('branch_id', gazipurId);

  const { data: sales } = await supabase
    .from('sales')
    .select('id, invoice_number, sale_date, sale_items(product_id, quantity, unit_price, products(product_code, name))')
    .eq('branch_id', gazipurId);

  const { data: inventory } = await supabase
    .from('inventory')
    .select('id, product_id, quantity, products(product_code, name)')
    .eq('branch_id', gazipurId);

  const purByProd = {};
  const purDetails = {};
  purchases?.forEach(p => {
    p.purchase_items?.forEach(it => {
      const pid = it.product_id;
      if (pid) {
        purByProd[pid] = (purByProd[pid] || 0) + Number(it.quantity || 0);
        if (!purDetails[pid]) purDetails[pid] = [];
        purDetails[pid].push(`${p.invoice_number} (${p.purchase_date}): +${it.quantity}`);
      }
    });
  });

  const saleByProd = {};
  const saleDetails = {};
  sales?.forEach(s => {
    s.sale_items?.forEach(it => {
      const pid = it.product_id;
      if (pid) {
        saleByProd[pid] = (saleByProd[pid] || 0) + Number(it.quantity || 0);
        if (!saleDetails[pid]) saleDetails[pid] = [];
        saleDetails[pid].push(`${s.invoice_number} (${s.sale_date}): -${it.quantity}`);
      }
    });
  });

  const invByProd = {};
  const nameByProd = {};
  inventory?.forEach(inv => {
    invByProd[inv.product_id] = Number(inv.quantity || 0);
    nameByProd[inv.product_id] = inv.products?.product_code || inv.products?.name;
  });

  purchases?.forEach(p => {
    p.purchase_items?.forEach(it => {
      if (it.product_id && !nameByProd[it.product_id]) {
        nameByProd[it.product_id] = it.products?.product_code || it.products?.name || it.product_id;
      }
    });
  });

  const allPids = Array.from(new Set([...Object.keys(purByProd), ...Object.keys(saleByProd), ...Object.keys(invByProd)]));

  const results = allPids.map(pid => {
    const pCode = nameByProd[pid] || pid;
    const purchased = purByProd[pid] || 0;
    const sold = saleByProd[pid] || 0;
    const calculatedExpected = purchased - sold;
    const currentInv = invByProd[pid] !== undefined ? invByProd[pid] : 0;
    const diff = currentInv - calculatedExpected;

    return {
      product_code: pCode,
      product_id: pid,
      total_purchased: purchased,
      total_sold: sold,
      expected_stock: calculatedExpected,
      current_inventory: currentInv,
      difference: diff,
      status: diff === 0 ? 'CORRECT' : 'DISCREPANCY',
      purBreakdown: purDetails[pid] || [],
      saleBreakdown: saleDetails[pid] || []
    };
  });

  // Sort: Discrepancies first, then alphabetically
  results.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'DISCREPANCY' ? -1 : 1;
    return a.product_code.localeCompare(b.product_code);
  });

  console.log(JSON.stringify(results, null, 2));
}

fullAudit().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
