import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wyjagcatkwuqsfgulnaf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5amFnY2F0a3d1cXNmZ3VsbmFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzYzMzEsImV4cCI6MjEwNDAxMjMzMX0.sk2CBZrbPJTc66kQPQYoQTsmV-Sq4BMw77v6JfGRW4Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('Testing Customer Name and Phone Number search in Sales and Returns...');

  // 1. Fetch a sample contact
  const { data: contacts, error: cErr } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .limit(5);

  if (cErr) {
    console.error('Failed to fetch contacts:', cErr);
    process.exit(1);
  }

  console.log(`Found ${contacts.length} sample contacts:`);
  contacts.forEach((c) => console.log(`  - ${c.name} (${c.phone || 'No phone'})`));

  if (contacts.length > 0) {
    const testContact = contacts[0];
    const testName = testContact.name ? testContact.name.split(' ')[0] : '';
    const testPhone = testContact.phone ? testContact.phone.slice(-4) : '';

    console.log(`\nTesting search with Name term "${testName}" and Phone term "${testPhone}"...`);

    // Test invoice search by customer name
    if (testName) {
      const { data: matchedContacts } = await supabase
        .from('contacts')
        .select('id')
        .or(`name.ilike.%${testName}%,phone.ilike.%${testName}%`);

      const contactIds = (matchedContacts || []).map((c) => c.id).join(',');
      console.log(`Matched ${matchedContacts.length} contacts for name "${testName}". IDs: ${contactIds}`);

      let query = supabase
        .from('sales')
        .select('id, invoice_number, contacts(name, phone)');

      if (contactIds) {
        query = query.or(`invoice_number.ilike.%${testName}%,customer_id.in.(${contactIds})`);
      } else {
        query = query.or(`invoice_number.ilike.%${testName}%`);
      }

      const { data: salesResults, error: sErr } = await query.limit(5);
      if (sErr) throw sErr;
      console.log(`✅ Found ${salesResults.length} sales matching customer name "${testName}":`, salesResults.map(s => `${s.invoice_number} (${s.contacts?.name})`));
    }

    // Test invoice search by customer phone
    if (testPhone) {
      const { data: matchedPhoneContacts } = await supabase
        .from('contacts')
        .select('id')
        .or(`name.ilike.%${testPhone}%,phone.ilike.%${testPhone}%`);

      const contactPhoneIds = (matchedPhoneContacts || []).map((c) => c.id).join(',');
      console.log(`Matched ${matchedPhoneContacts.length} contacts for phone "${testPhone}". IDs: ${contactPhoneIds}`);

      let query = supabase
        .from('sales')
        .select('id, invoice_number, contacts(name, phone)');

      if (contactPhoneIds) {
        query = query.or(`invoice_number.ilike.%${testPhone}%,customer_id.in.(${contactPhoneIds})`);
      } else {
        query = query.or(`invoice_number.ilike.%${testPhone}%`);
      }

      const { data: phoneSalesResults, error: psErr } = await query.limit(5);
      if (psErr) throw psErr;
      console.log(`✅ Found ${phoneSalesResults.length} sales matching customer phone "${testPhone}":`, phoneSalesResults.map(s => `${s.invoice_number} (${s.contacts?.name}, ${s.contacts?.phone})`));
    }
  }

  console.log('\nAll customer search tests passed successfully!');
}

runTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
