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

async function inspectW385() {
  console.log('--- 1. PRODUCT DETAILS FOR W-385, W-386, W-383 ---');
  const { data: prods } = await supabase.from('products').select('*').ilike('product_code', '%385%');
  console.log('385 products:', prods);

  console.log('\n--- 2. SALE INVOICE CONTAINING W-385 ---');
  const { data: sale } = await supabase
    .from('sales')
    .select('*, customer:contacts(name, phone), sale_items(*, products(*))')
    .eq('invoice_number', 'S-GAZ-20261003-0001')
    .single();
  console.log(`Sale Invoice: ${sale.invoice_number} | Date: ${sale.sale_date} | Customer: ${sale.customer?.name} (${sale.customer?.phone})`);
  console.log('Items in this sale:');
  console.table(sale.sale_items.map(it => ({
    code: it.products?.product_code,
    name: it.products?.name,
    qty: it.quantity,
    unit_price: it.unit_price,
    total: it.total_price
  })));

  console.log('\n--- 3. ALL PURCHASES ON OR AROUND 2026-10-02 / 2026-10-03 FOR GAZIPUR ---');
  const { data: pur } = await supabase
    .from('purchases')
    .select('id, invoice_number, purchase_date, purchase_items(product_id, quantity, unit_price, products(product_code, name))')
    .eq('invoice_number', 'P-GAZ-20261002-0004')
    .single();
  console.log(`Purchase: ${pur.invoice_number} (${pur.purchase_date})`);
  console.table(pur.purchase_items.map(it => ({
    code: it.products?.product_code,
    name: it.products?.name,
    qty: it.quantity,
    unit_price: it.unit_price
  })));

  console.log('\n--- 4. DID CHITTAGONG FACTORY OR ANY OTHER BRANCH PURCHASE/SELL W-385? ---');
  const { data: allW385Purchases } = await supabase
    .from('purchase_items')
    .select('*, purchases(invoice_number, purchase_date, branches(name)), products(product_code)')
    .eq('product_id', prods[0]?.id);
  console.log('All purchases of W-385 across entire ERP:', allW385Purchases);

  const { data: allW385Sales } = await supabase
    .from('sale_items')
    .select('*, sales(invoice_number, sale_date, branches(name)), products(product_code)')
    .eq('product_id', prods[0]?.id);
  console.log('All sales of W-385 across entire ERP:', allW385Sales);
}

inspectW385().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
