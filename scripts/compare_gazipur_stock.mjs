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

async function compareStock() {
  const { data: branches } = await supabase.from('branches').select('*');
  const gazipur = branches.find(b => b.name?.toLowerCase().includes('gazipur'));
  const gazipurId = gazipur.id;

  const { data: purchases, error: purErr } = await supabase
    .from('purchases')
    .select('id, invoice_number, purchase_date, is_factory_challan, purchase_items(product_id, item_name, quantity, unit_price, products(id, product_code, name))')
    .eq('branch_id', gazipurId);
  if (purErr) console.error('PurErr:', purErr);

  const { data: sales, error: saleErr } = await supabase
    .from('sales')
    .select('id, invoice_number, sale_date, sale_items(product_id, quantity, products(id, product_code, name))')
    .eq('branch_id', gazipurId);
  if (saleErr) console.error('SaleErr:', saleErr);

  const { data: inventory, error: invErr } = await supabase
    .from('inventory')
    .select('id, product_id, quantity, products(id, product_code, name)')
    .eq('branch_id', gazipurId);
  if (invErr) console.error('InvErr:', invErr);

  const { data: movements, error: movErr } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('branch_id', gazipurId);
  if (movErr) console.error('MovErr:', movErr);

  const purchasesList = purchases || [];
  const salesList = sales || [];
  const inventoryList = inventory || [];
  const movementsList = movements || [];

  console.log('=== PURCHASES FOR GAZIPUR (' + purchasesList.length + ' purchases) ===');
  const purchaseSumByProd = {};
  const purchaseInvoicesByProd = {};

  purchasesList.forEach(p => {
    console.log(`\nPurchase #${p.invoice_number || p.id} (${p.purchase_date}) - FactoryChallan: ${p.is_factory_challan}`);
    (p.purchase_items || []).forEach(it => {
      const prodKey = it.products ? `${it.products.product_code || it.products.name} (${it.product_id})` : `${it.item_name || 'Unlinked'} (${it.product_id})`;
      const pid = it.product_id || it.item_name;
      console.log(`   - ${prodKey}: Qty ${it.quantity} @ ${it.unit_price}`);
      purchaseSumByProd[pid] = (purchaseSumByProd[pid] || 0) + parseFloat(it.quantity || 0);
      if (!purchaseInvoicesByProd[pid]) purchaseInvoicesByProd[pid] = [];
      purchaseInvoicesByProd[pid].push({ inv: p.invoice_number, qty: it.quantity, date: p.purchase_date });
    });
  });

  console.log('\n=== SALES FOR GAZIPUR (' + salesList.length + ' sales) ===');
  const saleSumByProd = {};
  salesList.forEach(s => {
    console.log(`\nSale #${s.invoice_number || s.id} (${s.sale_date})`);
    (s.sale_items || []).forEach(it => {
      const prodKey = it.products ? `${it.products.product_code || it.products.name} (${it.product_id})` : `Unknown (${it.product_id})`;
      const pid = it.product_id;
      console.log(`   - ${prodKey}: Qty ${it.quantity}`);
      saleSumByProd[pid] = (saleSumByProd[pid] || 0) + parseFloat(it.quantity || 0);
    });
  });

  console.log('\n=== INVENTORY TABLE VS CALCULATED (Purchases - Sales) ===');
  const invMap = {};
  inventoryList.forEach(inv => {
    invMap[inv.product_id] = inv;
  });

  const allProductIds = Array.from(new Set([
    ...Object.keys(purchaseSumByProd),
    ...Object.keys(saleSumByProd),
    ...Object.keys(invMap)
  ]));

  const rows = [];
  allProductIds.forEach(pid => {
    const inv = invMap[pid];
    const prodName = inv?.products?.product_code || inv?.products?.name || pid;
    const totalPurchased = purchaseSumByProd[pid] || 0;
    const totalSold = saleSumByProd[pid] || 0;
    const calculatedExpectedStock = totalPurchased - totalSold;
    const actualInventoryStock = inv ? inv.quantity : 0;
    const diff = actualInventoryStock - calculatedExpectedStock;

    rows.push({
      Product: prodName,
      ProductId: pid,
      Purchased: totalPurchased,
      Sold: totalSold,
      'Expected Stock': calculatedExpectedStock,
      'Current Inventory': actualInventoryStock,
      'Difference (Actual - Expected)': diff,
      Status: diff === 0 ? 'MATCH' : 'MISMATCH',
      Invoices: purchaseInvoicesByProd[pid]?.map(i => `${i.inv || 'PUR'}:${i.qty}`).join(', ')
    });
  });

  console.table(rows);

  console.log('\n=== INVENTORY MOVEMENTS (' + movementsList.length + ' records) ===');
  movementsList.forEach(m => {
    console.log(`Movement: ${m.type} | Qty: ${m.quantity} | Prod: ${m.product_id} | Desc: ${m.description} | Date: ${m.created_at}`);
  });
}

compareStock().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
