import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach((line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runFullStockAudit() {
  console.log('====================================================================');
  console.log('🔍 ALMAS ACCESSORIES ERP - COMPREHENSIVE STOCK AUDIT & VERIFICATION');
  console.log('====================================================================\n');

  // 1. Fetch Branches
  const { data: branches, error: bErr } = await supabase.from('branches').select('*').order('name');
  if (bErr) throw bErr;
  console.log(`🏢 Branches Loaded: ${branches.length}`);

  // 2. Fetch Products
  const { data: products, error: pErr } = await supabase.from('products').select('*').order('product_code');
  if (pErr) throw pErr;
  console.log(`📦 Products Loaded: ${products.length}`);

  // 3. Fetch Inventory Table (Current Stock Matrix)
  const { data: inventoryRows, error: invErr } = await supabase.from('inventory').select('*');
  if (invErr) throw invErr;
  console.log(`📊 Inventory Matrix Records: ${inventoryRows.length}`);

  // 4. Fetch Purchases & Purchase Items
  const { data: purchases, error: purErr } = await supabase
    .from('purchases')
    .select('id, branch_id, purchase_date, invoice_number, purchase_items(id, product_id, item_name, quantity, unit_price, total_price)');
  if (purErr) throw purErr;
  console.log(`📥 Purchase Invoices Loaded: ${purchases.length}`);

  // 5. Fetch Sales & Sale Items
  const { data: sales, error: saleErr } = await supabase
    .from('sales')
    .select('id, branch_id, sale_date, invoice_number, sale_items(id, product_id, quantity, unit_price, total_price)');
  if (saleErr) throw saleErr;
  console.log(`📤 Sales Invoices Loaded: ${sales.length}`);

  // 6. Fetch Inventory Movements (Adjustments & Transfers)
  const { data: movements, error: movErr } = await supabase
    .from('inventory_movements')
    .select('*')
    .order('created_at', { ascending: true });
  if (movErr) throw movErr;
  console.log(`📜 Inventory Movement Ledger Records: ${movements.length}\n`);

  // Product Map
  const productMap = new Map();
  products.forEach((p) => productMap.set(p.id, p));

  // Current Stock Map: key = `${branch_id}_${product_id}`
  const currentStockMap = new Map();
  inventoryRows.forEach((inv) => {
    currentStockMap.set(`${inv.branch_id}_${inv.product_id}`, inv.quantity);
  });

  // Calculate Ledger Stock for each Branch and Product
  const ledger = {};
  branches.forEach((b) => {
    ledger[b.id] = {};
    products.forEach((p) => {
      ledger[b.id][p.id] = {
        purchases: 0,
        sales: 0,
        adjIn: 0,
        adjOut: 0,
        transferIn: 0,
        transferOut: 0,
      };
    });
  });

  // A. Sum Purchases
  let totalPurchasedQty = 0;
  purchases.forEach((pur) => {
    (pur.purchase_items || []).forEach((pi) => {
      const qty = parseInt(pi.quantity) || 0;
      totalPurchasedQty += qty;
      if (pi.product_id && ledger[pur.branch_id]?.[pi.product_id]) {
        ledger[pur.branch_id][pi.product_id].purchases += qty;
      }
    });
  });

  // B. Sum Sales
  let totalSoldQty = 0;
  sales.forEach((sale) => {
    (sale.sale_items || []).forEach((si) => {
      const qty = parseInt(si.quantity) || 0;
      totalSoldQty += qty;
      if (si.product_id && ledger[sale.branch_id]?.[si.product_id]) {
        ledger[sale.branch_id][si.product_id].sales += qty;
      }
    });
  });

  // C. Sum Inventory Movements for manual adjustments
  let totalAdjIn = 0;
  let totalAdjOut = 0;
  movements.forEach((m) => {
    const qty = parseInt(m.quantity) || 0;
    if (m.type === 'adjustment_in') {
      totalAdjIn += qty;
      if (ledger[m.branch_id]?.[m.product_id]) {
        ledger[m.branch_id][m.product_id].adjIn += qty;
      }
    } else if (m.type === 'adjustment_out') {
      totalAdjOut += qty;
      if (ledger[m.branch_id]?.[m.product_id]) {
        ledger[m.branch_id][m.product_id].adjOut += qty;
      }
    } else if (m.type === 'transfer_in') {
      if (ledger[m.branch_id]?.[m.product_id]) {
        ledger[m.branch_id][m.product_id].transferIn += qty;
      }
    } else if (m.type === 'transfer_out') {
      if (ledger[m.branch_id]?.[m.product_id]) {
        ledger[m.branch_id][m.product_id].transferOut += qty;
      }
    }
  });

  console.log('--------------------------------------------------------------------');
  console.log('📊 OVERALL SYSTEM METRICS SUMMARY:');
  console.log(`• Total Purchases Logged : ${purchases.length} invoices | ${totalPurchasedQty} pcs total`);
  console.log(`• Total Sales Logged     : ${sales.length} invoices | ${totalSoldQty} pcs total`);
  console.log(`• Total Adjustments In   : ${totalAdjIn} pcs`);
  console.log(`• Total Adjustments Out  : ${totalAdjOut} pcs`);
  console.log('--------------------------------------------------------------------\n');

  // Branch-by-Branch Detailed Stock Reconciliation
  let totalMatches = 0;
  let totalDiscrepancies = 0;
  const discrepanciesList = [];

  branches.forEach((branch) => {
    console.log(`\n====================================================================`);
    console.log(`🏢 BRANCH: ${branch.name} (${branch.is_factory ? 'FACTORY' : 'RETAIL SHOWROOM'})`);
    console.log(`====================================================================`);

    let branchTotalPurchased = 0;
    let branchTotalSold = 0;
    let branchCurrentStock = 0;
    let branchCalculatedStock = 0;
    let branchMatches = 0;
    let branchDiscrepancies = 0;

    const branchProductsAudit = [];

    products.forEach((prod) => {
      const bLedger = ledger[branch.id]?.[prod.id] || { purchases: 0, sales: 0, adjIn: 0, adjOut: 0, transferIn: 0, transferOut: 0 };
      const currentDbStock = currentStockMap.get(`${branch.id}_${prod.id}`) ?? 0;

      // Expected stock from transactional audit:
      const expectedStock = bLedger.purchases + bLedger.adjIn + bLedger.transferIn - bLedger.sales - bLedger.adjOut - bLedger.transferOut;

      branchTotalPurchased += bLedger.purchases;
      branchTotalSold += bLedger.sales;
      branchCurrentStock += currentDbStock;
      branchCalculatedStock += expectedStock;

      const isMatch = (currentDbStock === expectedStock);
      if (isMatch) {
        branchMatches++;
        totalMatches++;
      } else {
        branchDiscrepancies++;
        totalDiscrepancies++;
        discrepanciesList.push({
          branchName: branch.name,
          productCode: prod.product_code || prod.sku,
          productName: prod.name,
          purchases: bLedger.purchases,
          sales: bLedger.sales,
          adjIn: bLedger.adjIn,
          adjOut: bLedger.adjOut,
          transferIn: bLedger.transferIn,
          transferOut: bLedger.transferOut,
          expectedStock,
          currentDbStock,
          diff: currentDbStock - expectedStock,
        });
      }

      if (bLedger.purchases > 0 || bLedger.sales > 0 || currentDbStock > 0 || expectedStock > 0) {
        branchProductsAudit.push({
          code: prod.product_code || prod.sku,
          name: prod.name,
          purchases: bLedger.purchases,
          sales: bLedger.sales,
          expected: expectedStock,
          current: currentDbStock,
          status: isMatch ? '✅ MATCH' : `❌ DIFF (${currentDbStock - expectedStock > 0 ? '+' : ''}${currentDbStock - expectedStock})`,
        });
      }
    });

    console.log(`📦 Active Products with Stock/Activity : ${branchProductsAudit.length}`);
    console.log(`📥 Total Branch Purchased Quantity    : ${branchTotalPurchased} pcs`);
    console.log(`📤 Total Branch Sold Quantity         : ${branchTotalSold} pcs`);
    console.log(`📊 Current DB Stock in Hand           : ${branchCurrentStock} pcs`);
    console.log(`🧮 Expected Ledger Stock in Hand      : ${branchCalculatedStock} pcs`);
    console.log(`🎯 Products Status                     : ${branchMatches} Matches | ${branchDiscrepancies} Discrepancies`);

    if (branchProductsAudit.length > 0) {
      console.log('\n--- Active Product Breakdown ---');
      console.table(branchProductsAudit);
    }
  });

  console.log('\n====================================================================');
  console.log('🏆 FINAL AUDIT RESULT:');
  console.log('====================================================================');
  console.log(`Total Product-Branch Combinations Checked : ${branches.length * products.length}`);
  console.log(`Total Perfect Matches                    : ${totalMatches}`);
  console.log(`Total Discrepancies                      : ${totalDiscrepancies}`);

  if (totalDiscrepancies > 0) {
    console.log('\n⚠️ Discrepancies Detail:');
    console.table(discrepanciesList);
  } else {
    console.log('\n🎉 ALL CURRENT STOCKS PERFECTLY MATCH ALL PURCHASES & SALES RECORDS 100%!');
  }
}

runFullStockAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
  });
