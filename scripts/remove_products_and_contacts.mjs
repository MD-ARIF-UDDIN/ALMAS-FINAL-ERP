import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env
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
  console.error('Missing Supabase credentials in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanProductsAndContacts() {
  console.log('--- Cleaning Products & Contacts (Except Chittagong Factory) ---');

  // 1. Ensure Chittagong Factory contact exists
  const { data: factoryContacts, error: fErr } = await supabase
    .from('contacts')
    .select('*')
    .ilike('name', '%Chittagong Factory%');

  let factoryContactId;
  if (factoryContacts && factoryContacts.length > 0) {
    factoryContactId = factoryContacts[0].id;
    console.log(`✓ Found Chittagong Factory contact: ID = ${factoryContactId}`);
  } else {
    const { data: newFac, error: createErr } = await supabase
      .from('contacts')
      .insert([
        {
          name: 'Chittagong Factory',
          type: 'supplier',
          phone: '01845-069803',
          address: 'Chittagong',
        }
      ])
      .select()
      .single();
    if (createErr) {
      console.error('Failed to create Chittagong Factory supplier:', createErr.message);
    } else {
      factoryContactId = newFac.id;
      console.log(`✓ Created Chittagong Factory supplier: ID = ${factoryContactId}`);
    }
  }

  // 2. Delete inventory items (since they reference products)
  process.stdout.write('Deleting inventory stock records... ');
  const { error: invErr } = await supabase
    .from('inventory')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (invErr) console.log(`❌ Error: ${invErr.message}`);
  else console.log('✓ Cleared');

  // 3. Delete all products
  process.stdout.write('Deleting all products from catalog... ');
  const { error: prodErr } = await supabase
    .from('products')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (prodErr) console.log(`❌ Error: ${prodErr.message}`);
  else console.log('✓ All products cleared');

  // 4. Delete all contacts except Chittagong Factory
  process.stdout.write('Deleting contacts except Chittagong Factory... ');
  if (factoryContactId) {
    const { error: contactErr } = await supabase
      .from('contacts')
      .delete()
      .neq('id', factoryContactId);
    if (contactErr) console.log(`❌ Error: ${contactErr.message}`);
    else console.log('✓ Cleared (Only Chittagong Factory preserved)');
  } else {
    console.log('⚠️ Skipping contact deletion because Chittagong Factory ID was not resolved.');
  }

  // Verify remaining data
  const { data: remProds } = await supabase.from('products').select('id, name');
  const { data: remContacts } = await supabase.from('contacts').select('id, name, type, phone');

  console.log('\n--- Status After Cleanup ---');
  console.log(`Remaining Products: ${remProds?.length || 0}`);
  console.log(`Remaining Contacts: ${remContacts?.length || 0}`);
  if (remContacts) {
    remContacts.forEach(c => console.log(` - [${c.type}] ${c.name} (${c.phone || 'No phone'})`));
  }
}

cleanProductsAndContacts().then(() => {
  setTimeout(() => process.exit(0), 100);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
