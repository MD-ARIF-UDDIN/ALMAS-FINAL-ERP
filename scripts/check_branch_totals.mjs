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

async function checkBranchTotals() {
  const { data: branches } = await supabase.from('branches').select('*');

  for (const branch of branches) {
    console.log(`\n====================================================================`);
    console.log(`🏢 BRANCH: ${branch.name.toUpperCase()} (${branch.is_factory ? 'FACTORY' : 'SHOWROOM'})`);
    console.log(`====================================================================`);

    // 1. Purchases
    const { data: purchases } = await supabase
      .from('purchases')
      .select('id, invoice_number, purchase_date, net_amount, total_amount, discount, purchase_items(product_id, quantity, unit_price, total_price)')
      .eq('branch_id', branch.id);

    let totalPurchasedQty = 0;
    let totalPurchasedNetAmt = 0;
    purchases?.forEach(p => {
      totalPurchasedNetAmt += Number(p.net_amount || 0);
      p.purchase_items?.forEach(it => {
        totalPurchasedQty += Number(it.quantity || 0);
      });
    });

    // 2. Sales
    const { data: sales } = await supabase
      .from('sales')
      .select('id, invoice_number, sale_date, net_amount, total_amount, discount, sale_items(product_id, quantity, unit_price, total_price)')
      .eq('branch_id', branch.id);

    let totalSoldQty = 0;
    let totalSoldNetAmt = 0;
    sales?.forEach(s => {
      totalSoldNetAmt += Number(s.net_amount || 0);
      s.sale_items?.forEach(it => {
        totalSoldQty += Number(it.quantity || 0);
      });
    });

    // 3. Current Inventory
    const { data: inventory } = await supabase
      .from('inventory')
      .select('id, product_id, quantity, purchase_price, sale_price, products(product_code, name)')
      .eq('branch_id', branch.id);

    let totalInventoryStockQty = 0;
    let totalInventoryValue = 0;
    inventory?.forEach(inv => {
      const q = Number(inv.quantity || 0);
      const price = Number(inv.purchase_price || 0);
      totalInventoryStockQty += q;
      totalInventoryValue += (q * price);
    });

    console.log(`📦 PURCHASES:`);
    console.log(`   - Total Purchase Invoices : ${purchases?.length || 0}`);
    console.log(`   - Total Quantity Purchased: ${totalPurchasedQty.toLocaleString()} pcs`);
    console.log(`   - Total Purchase Value    : ৳${totalPurchasedNetAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

    console.log(`\n🛒 SALES:`);
    console.log(`   - Total Sale Invoices     : ${sales?.length || 0}`);
    console.log(`   - Total Quantity Sold     : ${totalSoldQty.toLocaleString()} pcs`);
    console.log(`   - Total Sales Value       : ৳${totalSoldNetAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

    console.log(`\n📊 STOCK IN HAND:`);
    console.log(`   - Theoretical (Purchased - Sold): ${(totalPurchasedQty - totalSoldQty).toLocaleString()} pcs`);
    console.log(`   - Current Database Inventory    : ${totalInventoryStockQty.toLocaleString()} pcs`);
    console.log(`   - Estimated Inventory Value     : ৳${totalInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`   - Total Tracked Products        : ${inventory?.length || 0}`);

    if (branch.name?.toLowerCase().includes('gazipur')) {
      console.log(`\n📋 GAZIPUR DETAILED SUMMARY (ALL ${inventory?.length} PRODUCTS):`);
      const details = inventory?.map(inv => {
        const pid = inv.product_id;
        const code = inv.products?.product_code || inv.products?.name || pid;
        let pur = 0;
        purchases?.forEach(p => p.purchase_items?.forEach(it => { if (it.product_id === pid) pur += Number(it.quantity || 0); }));
        let sold = 0;
        sales?.forEach(s => s.sale_items?.forEach(it => { if (it.product_id === pid) sold += Number(it.quantity || 0); }));

        return {
          'Product Code': code,
          'Purchased (pcs)': pur,
          'Sold (pcs)': sold,
          'Stock In Hand (pcs)': inv.quantity,
          'Unit Cost (৳)': inv.purchase_price || 0,
          'Stock Value (৳)': (inv.quantity * (inv.purchase_price || 0)).toFixed(2),
          'Balance Check': pur - sold === inv.quantity ? '✅ Exact' : (pur === 0 && sold > 0 ? '⚠️ Sold w/o pur' : '❌ Diff')
        };
      });

      // Sort by Product Code
      details.sort((a, b) => a['Product Code'].localeCompare(b['Product Code']));
      console.table(details);
    }
  }
}

checkBranchTotals().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
