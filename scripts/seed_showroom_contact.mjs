import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env manually
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedShowroomContact() {
  console.log('--- Checking / Seeding "Gazipur Showroom" Contact ---');

  // Check branches
  const { data: branches } = await supabase.from('branches').select('*');
  const gazipurBranch = branches?.find(b => b.name?.toLowerCase().includes('gazipur'));

  // Check if contact already exists
  const { data: existing, error: findErr } = await supabase
    .from('contacts')
    .select('*')
    .ilike('name', '%Gazipur Showroom%')
    .eq('type', 'customer');

  if (findErr) {
    console.error('Error querying contacts:', findErr.message);
    return;
  }

  let showroomContactId;

  if (existing && existing.length > 0) {
    console.log(`✓ "Gazipur Showroom" contact already exists (ID: ${existing[0].id}, Phone: ${existing[0].phone})`);
    showroomContactId = existing[0].id;
  } else {
    // Insert new showroom customer contact
    const { data: created, error: insertErr } = await supabase
      .from('contacts')
      .insert([
        {
          type: 'customer',
          name: 'Gazipur Showroom',
          phone: '01845-069803',
          address: 'Gazipur',
          branch_id: gazipurBranch ? gazipurBranch.id : null,
        }
      ])
      .select()
      .single();

    if (insertErr) {
      console.error('Error inserting showroom contact:', insertErr.message);
      return;
    }
    console.log(`✓ Created "Gazipur Showroom" customer contact (ID: ${created.id})`);
    showroomContactId = created.id;
  }

  console.log('Finished seeding.');
}

seedShowroomContact().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
