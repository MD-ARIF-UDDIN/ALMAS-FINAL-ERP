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

async function testHistoryQuery() {
  const { data: prod } = await supabase.from('products').select('*').ilike('product_code', '%W-0010%').single();
  console.log('Testing for Product:', prod.product_code, prod.id);

  const { data: purItems, error: purErr } = await supabase
    .from('purchase_items')
    .select(`
      id,
      quantity,
      unit_price,
      total_price,
      purchase_id,
      purchases (
        id,
        invoice_number,
        purchase_date,
        branch_id,
        branches (id, name),
        supplier:contacts!purchases_supplier_id_fkey (id, name, phone)
      )
    `)
    .eq('product_id', prod.id);

  console.log('Pur Items count:', purItems?.length, 'PurErr:', purErr?.message);
  if (purItems?.[0]) console.log('Sample Purchase:', JSON.stringify(purItems[0], null, 2));
}

testHistoryQuery().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
