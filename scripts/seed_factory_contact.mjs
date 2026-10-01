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

async function seedFactoryContact() {
  console.log('--- Checking / Seeding "Chittagong Factory" Contact ---');

  // Check if contact already exists
  const { data: existing, error: findErr } = await supabase
    .from('contacts')
    .select('*')
    .ilike('name', '%Chittagong Factory%')
    .eq('type', 'supplier');

  if (findErr) {
    console.error('Error querying contacts:', findErr.message);
    return;
  }

  let factoryContactId;

  if (existing && existing.length > 0) {
    console.log(`✓ "Chittagong Factory" contact already exists (ID: ${existing[0].id}, Phone: ${existing[0].phone})`);
    factoryContactId = existing[0].id;
    // Update phone if needed
    if (existing[0].phone !== '01845-069803') {
      await supabase
        .from('contacts')
        .update({ phone: '01845-069803' })
        .eq('id', factoryContactId);
      console.log('✓ Updated phone number to 01845-069803');
    }
  } else {
    // Insert new supplier
    const { data: created, error: insertErr } = await supabase
      .from('contacts')
      .insert([
        {
          type: 'supplier',
          name: 'Chittagong Factory',
          phone: '01845-069803',
          address: 'Chittagong',
        }
      ])
      .select()
      .single();

    if (insertErr) {
      console.error('Error inserting factory contact:', insertErr.message);
      return;
    }
    console.log(`✓ Created "Chittagong Factory" supplier contact (ID: ${created.id})`);
    factoryContactId = created.id;
  }

  // Check if is_factory_challan column exists in purchases
  const { data: testPur, error: testPurErr } = await supabase
    .from('purchases')
    .select('id, is_factory_challan')
    .limit(1);

  if (testPurErr) {
    console.log('⚠️ Note: is_factory_challan column test:', testPurErr.message);
  } else {
    console.log('✓ purchases.is_factory_challan column is accessible');
  }
}

seedFactoryContact().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
