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

async function investigate() {
  console.log('--- 1. BRANCHES ---');
  const { data: branches } = await supabase.from('branches').select('*');
  console.log(branches);

  const gazipur = branches.find(b => b.name?.toLowerCase().includes('gazipur'));
  const gazipurId = gazipur?.id;

  console.log('\n--- 2. CHECK PRODUCTS WITH DISCREPANCIES (ENU-2363, PRL-893, ENU-2367, PRL-860, W-0010, W-0011, W-385) ---');
  const codes = ['ENU-2363', 'PRL-893', 'ENU-2367', 'PRL-860', 'W-0010', 'W-0011', 'W-385', 'Enu-2363', 'Prl-893', 'Enu-2367', 'Prl-860', 'W-385'];
  
  const { data: allProducts } = await supabase.from('products').select('*');
  const matchedProducts = allProducts.filter(p => 
    codes.some(c => c.toLowerCase() === (p.product_code || '').toLowerCase() || c.toLowerCase() === (p.name || '').toLowerCase())
  );
  console.log('Matched Products in DB:');
  console.table(matchedProducts.map(p => ({ id: p.id, code: p.product_code, name: p.name, category_id: p.category_id })));

  console.log('\n--- 3. CHECK INVENTORY TABLE ACROSS ALL BRANCHES FOR THESE PRODUCTS ---');
  const matchedIds = matchedProducts.map(p => p.id);
  const { data: allInv } = await supabase.from('inventory').select('*, branches(name), products(product_code, name)').in('product_id', matchedIds);
  console.table(allInv.map(i => ({
    inv_id: i.id,
    branch: i.branches?.name,
    product_code: i.products?.product_code,
    product_name: i.products?.name,
    quantity: i.quantity,
    product_id: i.product_id
  })));

  console.log('\n--- 4. CHECK PURCHASES & ITEMS FOR THESE PRODUCTS (ALL BRANCHES) ---');
  const { data: pItems } = await supabase
    .from('purchase_items')
    .select('id, purchase_id, product_id, item_name, quantity, unit_price, purchases(id, invoice_number, purchase_date, branch_id, is_factory_challan, branches(name))')
    .in('product_id', matchedIds);
  
  console.table((pItems || []).map(pi => ({
    purchase_invoice: pi.purchases?.invoice_number,
    branch: pi.purchases?.branches?.name,
    date: pi.purchases?.purchase_date,
    is_challan: pi.purchases?.is_factory_challan,
    product_id: pi.product_id,
    item_name: pi.item_name,
    qty: pi.quantity,
    unit_price: pi.unit_price
  })));

  console.log('\n--- 5. CHECK SALES & ITEMS FOR THESE PRODUCTS (ALL BRANCHES) ---');
  const { data: sItems } = await supabase
    .from('sale_items')
    .select('id, sale_id, product_id, quantity, unit_price, sales(id, invoice_number, sale_date, branch_id, branches(name))')
    .in('product_id', matchedIds);
  
  console.table((sItems || []).map(si => ({
    sale_invoice: si.sales?.invoice_number,
    branch: si.sales?.branches?.name,
    date: si.sales?.sale_date,
    product_id: si.product_id,
    qty: si.quantity,
    unit_price: si.unit_price
  })));

  console.log('\n--- 6. CHECK INVENTORY MOVEMENTS FOR THESE PRODUCTS ---');
  const { data: movs } = await supabase
    .from('inventory_movements')
    .select('*, branches(name), products(product_code)')
    .in('product_id', matchedIds)
    .order('created_at', { ascending: true });
  
  console.table((movs || []).map(m => ({
    id: m.id,
    branch: m.branches?.name,
    code: m.products?.product_code,
    type: m.type,
    quantity: m.quantity,
    description: m.description,
    created_at: m.created_at
  })));

  console.log('\n--- 7. CHECK TRANSFERS (IF ANY) ---');
  try {
    const { data: transfers } = await supabase.from('stock_transfers').select('*, stock_transfer_items(*)');
    console.log('Stock Transfers:', transfers);
  } catch (e) {
    console.log('No stock_transfers table or error:', e.message);
  }

  console.log('\n--- 8. CHECK ALL PURCHASE INVOICES FOR GAZIPUR ---');
  const { data: gazPurchases } = await supabase
    .from('purchases')
    .select('id, invoice_number, purchase_date, supplier_id, total_amount, purchase_items(product_id, item_name, quantity, products(product_code))')
    .eq('branch_id', gazipurId);
  console.log('Total Gazipur purchases:', gazPurchases?.length);
  gazPurchases?.forEach(gp => {
    console.log(`Purchase: ${gp.invoice_number} | Date: ${gp.purchase_date} | Items: ${gp.purchase_items?.map(i => `${i.products?.product_code || i.item_name}:${i.quantity}`).join(', ')}`);
  });

  console.log('\n--- 9. CHECK ALL SALE INVOICES FOR GAZIPUR ---');
  const { data: gazSales } = await supabase
    .from('sales')
    .select('id, invoice_number, sale_date, customer_id, total_amount, sale_items(product_id, quantity, products(product_code))')
    .eq('branch_id', gazipurId);
  console.log('Total Gazipur sales:', gazSales?.length);
  gazSales?.forEach(gs => {
    console.log(`Sale: ${gs.invoice_number} | Date: ${gs.sale_date} | Items: ${gs.sale_items?.map(i => `${i.products?.product_code}:${i.quantity}`).join(', ')}`);
  });
}

investigate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
