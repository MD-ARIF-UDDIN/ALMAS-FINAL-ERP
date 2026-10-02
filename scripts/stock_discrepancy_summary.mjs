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

async function printSummary() {
  const { data: branches } = await supabase.from('branches').select('*');
  const gazipur = branches.find(b => b.name?.toLowerCase().includes('gazipur'));
  const gazipurId = gazipur.id;

  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, invoice_number, purchase_date, purchase_items(product_id, quantity, products(product_code, name))')
    .eq('branch_id', gazipurId);

  const { data: sales } = await supabase
    .from('sales')
    .select('id, invoice_number, sale_date, sale_items(product_id, quantity, products(product_code, name))')
    .eq('branch_id', gazipurId);

  const { data: inventory } = await supabase
    .from('inventory')
    .select('product_id, quantity, products(product_code, name)')
    .eq('branch_id', gazipurId);

  const purchaseMap = {};
  purchases?.forEach(p => {
    p.purchase_items?.forEach(it => {
      const pid = it.product_id;
      purchaseMap[pid] = (purchaseMap[pid] || 0) + Number(it.quantity || 0);
    });
  });

  const saleMap = {};
  sales?.forEach(s => {
    s.sale_items?.forEach(it => {
      const pid = it.product_id;
      saleMap[pid] = (saleMap[pid] || 0) + Number(it.quantity || 0);
    });
  });

  const invMap = {};
  const nameMap = {};
  inventory?.forEach(inv => {
    invMap[inv.product_id] = Number(inv.quantity || 0);
    nameMap[inv.product_id] = inv.products?.product_code || inv.products?.name;
  });

  purchases?.forEach(p => {
    p.purchase_items?.forEach(it => {
      if (!nameMap[it.product_id]) {
        nameMap[it.product_id] = it.products?.product_code || it.products?.name || it.product_id;
      }
    });
  });

  const list = Object.keys(nameMap).map(pid => {
    const purchased = purchaseMap[pid] || 0;
    const sold = saleMap[pid] || 0;
    const expected = purchased - sold;
    const current = invMap[pid] || 0;
    const ratio = expected > 0 ? (current / expected) : null;
    return {
      Code: nameMap[pid],
      'Purchased': purchased,
      'Sold': sold,
      'Expected Stock': expected,
      'Current Stock': current,
      'Discrepancy (Current - Expected)': current - expected,
      'Multiplier (Current/Expected)': ratio
    };
  });

  console.log(JSON.stringify(list, null, 2));
}

printSummary().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
