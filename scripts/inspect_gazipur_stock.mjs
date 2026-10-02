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

const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectGazipur() {
  console.log('=== 1. BRANCHES ===');
  const { data: branches } = await supabase.from('branches').select('*');
  console.log(branches);
  const gazipur = branches.find(b => b.name?.toLowerCase().includes('gazipur'));
  if (!gazipur) {
    console.log('Gazipur branch not found!');
    return;
  }
  const gazipurId = gazipur.id;
  console.log('Gazipur Branch ID:', gazipurId);

  console.log('\n=== 2. INVENTORY TABLE FOR GAZIPUR ===');
  const { data: inventory } = await supabase
    .from('inventory')
    .select('*, products(*)')
    .eq('branch_id', gazipurId);
  console.log(JSON.stringify(inventory, null, 2));

  console.log('\n=== 3. ALL PURCHASES & ITEMS FOR GAZIPUR ===');
  const { data: purchases } = await supabase
    .from('purchases')
    .select('*, purchase_items(*, products(*)), contacts(*)')
    .eq('branch_id', gazipurId);
  console.log(JSON.stringify(purchases, null, 2));

  console.log('\n=== 4. ALL SALES & ITEMS FOR GAZIPUR ===');
  const { data: sales } = await supabase
    .from('sales')
    .select('*, sale_items(*, products(*)), contacts(*)')
    .eq('branch_id', gazipurId);
  console.log(JSON.stringify(sales, null, 2));

  console.log('\n=== 5. INVENTORY MOVEMENTS FOR GAZIPUR ===');
  const { data: movements } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('branch_id', gazipurId);
  console.log(JSON.stringify(movements, null, 2));

  console.log('\n=== 6. BRANCH CHALLANS TO/FROM GAZIPUR ===');
  const { data: challansTo } = await supabase
    .from('branch_challans')
    .select('*, branch_challan_items(*)')
    .eq('to_branch_id', gazipurId);
  console.log('Challans TO Gazipur:', JSON.stringify(challansTo, null, 2));

  const { data: challansFrom } = await supabase
    .from('branch_challans')
    .select('*, branch_challan_items(*)')
    .eq('from_branch_id', gazipurId);
  console.log('Challans FROM Gazipur:', JSON.stringify(challansFrom, null, 2));

  console.log('\n=== 7. PRODUCTS MASTER TABLE ===');
  const { data: products } = await supabase
    .from('products')
    .select('*');
  console.log(JSON.stringify(products, null, 2));
}

inspectGazipur().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
