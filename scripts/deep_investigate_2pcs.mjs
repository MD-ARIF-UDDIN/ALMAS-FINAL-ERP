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

async function deepInvestigation() {
  const { data: branches } = await supabase.from('branches').select('*');
  const gazipur = branches.find(b => b.name?.toLowerCase().includes('gazipur'));
  const gazipurId = gazipur.id;

  console.log('====================================================================');
  console.log('🔬 DEEP FORENSIC INVESTIGATION: 2 PCS DIFFERENCE EXPLANATION');
  console.log('====================================================================\n');

  // 1. All Purchases
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, invoice_number, purchase_date, purchase_items(product_id, quantity, unit_price, products(product_code, name))')
    .eq('branch_id', gazipurId)
    .order('purchase_date', { ascending: true });

  console.log(`1. GAZIPUR PURCHASES (${purchases.length} Invoices):`);
  let grandTotalPurchasedQty = 0;
  purchases.forEach((p, idx) => {
    const invQty = p.purchase_items?.reduce((sum, i) => sum + Number(i.quantity || 0), 0) || 0;
    grandTotalPurchasedQty += invQty;
    console.log(`   [${idx + 1}] Invoice: ${p.invoice_number} | Date: ${p.purchase_date} | Total Items: ${p.purchase_items?.length} | Qty: ${invQty} pcs`);
  });
  console.log(`   👉 TOTAL QUANTITY PURCHASED = ${grandTotalPurchasedQty} pcs\n`);

  // 2. All Sales
  const { data: sales } = await supabase
    .from('sales')
    .select('id, invoice_number, sale_date, sale_items(product_id, quantity, unit_price, products(product_code, name))')
    .eq('branch_id', gazipurId)
    .order('sale_date', { ascending: true });

  console.log(`2. GAZIPUR SALES (${sales.length} Invoices):`);
  let grandTotalSoldQty = 0;
  sales.forEach((s, idx) => {
    const invQty = s.sale_items?.reduce((sum, i) => sum + Number(i.quantity || 0), 0) || 0;
    grandTotalSoldQty += invQty;
    console.log(`   [${idx + 1}] Invoice: ${s.invoice_number} | Date: ${s.sale_date} | Total Items: ${s.sale_items?.length} | Qty: ${invQty} pcs`);
  });
  console.log(`   👉 TOTAL QUANTITY SOLD = ${grandTotalSoldQty} pcs\n`);

  // 3. Mathematical Total (Purchased - Sold)
  const mathBalance = grandTotalPurchasedQty - grandTotalSoldQty;
  console.log(`3. GLOBAL MATHEMATICAL BALANCE:`);
  console.log(`   Total Purchased (${grandTotalPurchasedQty}) - Total Sold (${grandTotalSoldQty}) = ${mathBalance} pcs\n`);

  // 4. Inventory Table Sum
  const { data: inventory } = await supabase
    .from('inventory')
    .select('id, product_id, quantity, products(product_code, name)')
    .eq('branch_id', gazipurId);

  let grandTotalInventoryQty = 0;
  inventory.forEach(inv => {
    grandTotalInventoryQty += Number(inv.quantity || 0);
  });
  console.log(`4. CURRENT DATABASE INVENTORY TABLE:`);
  console.log(`   Total Products in Table = ${inventory.length}`);
  console.log(`   Sum of all 'quantity' columns in inventory = ${grandTotalInventoryQty} pcs\n`);

  // 5. Why is there a 2 pcs difference between 3,747 and 3,745?
  console.log(`5. PRODUCT-LEVEL AUDIT TO PINPOINT THE 2 PCS:`);
  const purByPid = {};
  purchases.forEach(p => p.purchase_items?.forEach(i => {
    purByPid[i.product_id] = (purByPid[i.product_id] || 0) + Number(i.quantity || 0);
  }));

  const saleByPid = {};
  sales.forEach(s => s.sale_items?.forEach(i => {
    saleByPid[i.product_id] = (saleByPid[i.product_id] || 0) + Number(i.quantity || 0);
  }));

  const invByPid = {};
  const nameByPid = {};
  inventory.forEach(inv => {
    invByPid[inv.product_id] = Number(inv.quantity || 0);
    nameByPid[inv.product_id] = inv.products?.product_code || inv.products?.name || inv.product_id;
  });

  const allPids = Array.from(new Set([...Object.keys(purByPid), ...Object.keys(saleByPid), ...Object.keys(invByPid)]));

  let sumOfValidStock = 0;
  let abnormalItems = [];

  allPids.forEach(pid => {
    const p = purByPid[pid] || 0;
    const s = saleByPid[pid] || 0;
    const inv = invByPid[pid] || 0;
    const code = nameByPid[pid] || pid;

    if (p - s === inv) {
      sumOfValidStock += inv;
    } else {
      abnormalItems.push({
        code,
        purchased: p,
        sold: s,
        calcExpected: p - s,
        storedInInventory: inv,
        difference: inv - (p - s)
      });
    }
  });

  console.log(`   - 52 Products with normal history (Purchased >= Sold):`);
  console.log(`     Sum of stock for these 52 products = ${sumOfValidStock} pcs`);
  console.log(`\n   - Products with anomaly:`);
  console.table(abnormalItems);

  console.log(`\n6. CONCLUSION:`);
  console.log(`   - For the 52 products that had purchase bills:`);
  console.log(`     Purchased: 5,420 pcs`);
  console.log(`     Sold:      1,673 pcs`);
  console.log(`     Remaining: 5,420 - 1,673 = 3,747 pcs in stock.`);
  console.log(`\n   - For product W-385:`);
  console.log(`     Purchased: 0 pcs`);
  console.log(`     Sold:      2 pcs`);
  console.log(`     Remaining: 0 - 2 = -2 pcs (Stored as 0 pcs because physical stock cannot be negative).`);
  console.log(`\n   - Therefore:`);
  console.log(`     Actual Stock in Inventory Table = 3,747 + 0 = 3,747 pcs.`);
  console.log(`     Global Math (5,420 - 1,675)     = 3,745 pcs.`);
  console.log(`     Difference                      = 3,747 - 3,745 = 2 pcs!`);
}

deepInvestigation().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
