import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wyjagcatkwuqsfgulnaf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5amFnY2F0a3d1cXNmZ3VsbmFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzYzMzEsImV4cCI6MjEwNDAxMjMzMX0.sk2CBZrbPJTc66kQPQYoQTsmV-Sq4BMw77v6JfGRW4Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runPurchasesSearchLiveTest() {
  console.log('🧪 Testing Purchases Supplier Name & Phone Number Search...');

  const nonce = Date.now().toString().slice(-5);
  const testSupplierName = `TestSupplier_${nonce}`;
  const testSupplierPhone = `01777${nonce}`;
  const invoiceNumber = `PUR-SEARCH-${nonce}`;

  let supplierId = null;
  let purchaseId = null;
  let branchId = null;
  let userId = null;

  try {
    const { data: branches } = await supabase.from('branches').select('id').limit(1);
    branchId = branches[0].id;
    const { data: profiles } = await supabase.from('profiles').select('id').limit(1);
    userId = profiles[0].id;

    // Create supplier
    const { data: contact, error: cErr } = await supabase
      .from('contacts')
      .insert([{
        name: testSupplierName,
        phone: testSupplierPhone,
        type: 'supplier',
        address: 'Chittagong, Bangladesh',
      }])
      .select()
      .single();

    if (cErr) throw cErr;
    supplierId = contact.id;
    console.log(`✅ Created supplier: ${testSupplierName} (${testSupplierPhone})`);

    // Create purchase
    const { data: purchase, error: pErr } = await supabase
      .from('purchases')
      .insert([{
        branch_id: branchId,
        supplier_id: supplierId,
        invoice_number: invoiceNumber,
        purchase_date: new Date().toISOString().slice(0, 10),
        total_amount: 500.00,
        discount: 0,
        net_amount: 500.00,
        paid_amount: 500.00,
        payment_status: 'paid',
        notes: 'Test purchase search',
        created_by: userId,
      }])
      .select()
      .single();

    if (pErr) throw pErr;
    purchaseId = purchase.id;
    const realInvoiceNumber = purchase.invoice_number || invoiceNumber;
    console.log(`✅ Created purchase: ${realInvoiceNumber}`);

    // TEST 1: Search by Supplier Name
    console.log('\n--- TEST 1: Search Purchases by Supplier Name ---');
    {
      const clean = testSupplierName.toLowerCase();
      const { data: matchedContacts } = await supabase
        .from('contacts')
        .select('id')
        .or(`name.ilike.%${clean}%,phone.ilike.%${clean}%`);

      const contactIds = (matchedContacts || []).map((c) => c.id).join(',');
      const { data: results, error: rErr } = await supabase
        .from('purchases')
        .select('id, invoice_number, contacts(name, phone)')
        .or(`invoice_number.ilike.%${clean}%,notes.ilike.%${clean}%,supplier_id.in.(${contactIds})`);

      if (rErr) throw rErr;
      const found = (results || []).find(p => p.id === purchaseId);
      if (!found) throw new Error('Failed to find purchase by supplier name');
      console.log(`✅ SUCCESS: Found purchase ${found.invoice_number} for supplier "${testSupplierName}"`);
    }

    // TEST 2: Search by Supplier Phone
    console.log('\n--- TEST 2: Search Purchases by Supplier Phone ---');
    {
      const clean = testSupplierPhone;
      const { data: matchedContacts } = await supabase
        .from('contacts')
        .select('id')
        .or(`name.ilike.%${clean}%,phone.ilike.%${clean}%`);

      const contactIds = (matchedContacts || []).map((c) => c.id).join(',');
      const { data: results, error: rErr } = await supabase
        .from('purchases')
        .select('id, invoice_number, contacts(name, phone)')
        .or(`invoice_number.ilike.%${clean}%,notes.ilike.%${clean}%,supplier_id.in.(${contactIds})`);

      if (rErr) throw rErr;
      const found = (results || []).find(p => p.id === purchaseId);
      if (!found) throw new Error('Failed to find purchase by supplier phone');
      console.log(`✅ SUCCESS: Found purchase ${found.invoice_number} for supplier phone "${testSupplierPhone}"`);
    }

    console.log('\n🎉 ALL PURCHASES SEARCH TESTS PASSED 100% CLEANLY!');

  } catch (err) {
    console.error('❌ Test failed:', err);
    throw err;
  } finally {
    console.log('\n🧹 Cleaning up test artifacts...');
    if (purchaseId) {
      await supabase.from('purchases').delete().eq('id', purchaseId);
    }
    if (supplierId) {
      await supabase.from('contacts').delete().eq('id', supplierId);
    }
    console.log('✅ Cleanup complete.');
  }
}

runPurchasesSearchLiveTest().catch(() => process.exit(1));
