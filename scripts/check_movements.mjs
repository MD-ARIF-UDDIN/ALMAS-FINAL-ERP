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

async function checkTriggers() {
  const { data: movs } = await supabase
    .from('inventory_movements')
    .select('*')
    .ilike('description', '%P-GAZ-20261002-0006%')
    .order('created_at', { ascending: true });

  console.log('Movements for Bill P-GAZ-20261002-0006:');
  console.log(movs);
}

checkTriggers().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
