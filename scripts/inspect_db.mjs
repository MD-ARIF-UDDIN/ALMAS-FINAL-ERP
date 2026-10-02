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

async function inspectAndSeed() {
  const { data: branches, error: bErr } = await supabase.from('branches').select('*');
  console.log('Branches:', branches);

  const { data: contacts, error: cErr } = await supabase.from('contacts').select('*');
  console.log('Contacts:', contacts);

  // Check sales columns
  const { data: salesTest, error: sErr } = await supabase.from('sales').select('*').limit(1);
  console.log('Sales sample/columns:', salesTest ? Object.keys(salesTest[0] || {}) : sErr);
}

inspectAndSeed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
