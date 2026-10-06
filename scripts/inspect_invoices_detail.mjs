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

async function detail() {
  console.log('=== SALE # S-CHI-20261003-0001 ===');
  const { data: s } = await supabase
    .from('sales')
    .select('*, branches(name), sale_items(*, products(*))')
    .eq('invoice_number', 'S-CHI-20261003-0001');
  console.log(JSON.stringify(s, null, 2));

  console.log('=== PURCHASE # P-GAZ-20261005-0001 ===');
  const { data: p } = await supabase
    .from('purchases')
    .select('*, branches(name), purchase_items(*, products(*))')
    .eq('invoice_number', 'P-GAZ-20261005-0001');
  console.log(JSON.stringify(p, null, 2));

  console.log('=== INVENTORY RECORDS FOR ALL PRODUCTS IN GAZIPUR ===');
  const { data: gazipurBranch } = await supabase.from('branches').select('*').ilike('name', '%gazipur%').single();
  const { data: invGaz } = await supabase.from('inventory').select('*, products(product_code, name)').eq('branch_id', gazipurBranch.id);
  console.table(invGaz.map(i => ({
    id: i.id,
    code: i.products?.product_code,
    name: i.products?.name,
    qty: i.quantity,
    created_at: i.created_at,
    updated_at: i.updated_at
  })));
}

detail().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
