import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wyjagcatkwuqsfgulnaf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5amFnY2F0a3d1cXNmZ3VsbmFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzYzMzEsImV4cCI6MjEwNDAxMjMzMX0.sk2CBZrbPJTc66kQPQYoQTsmV-Sq4BMw77v6JfGRW4Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runReturnsSearchLiveTest() {
  console.log('🧪 Starting live Sales Return Customer Name & Phone Number Search Test...');

  const nonce = Date.now().toString().slice(-5);
  const testCustomerName = `SearchTester_${nonce}`;
  const testCustomerPhone = `01999${nonce}`;
  const invoiceNumber = `INV-SEARCH-${nonce}`;
  const voucherNumber = `CRN-SRCH-${nonce}`;

  let contactId = null;
  let productId = null;
  let saleId = null;
  let branchId = null;

  try {
    // 1. Get branch and profile
    const { data: branches } = await supabase.from('branches').select('id').limit(1);
    branchId = branches[0].id;
    const { data: profiles } = await supabase.from('profiles').select('id').limit(1);
    const userId = profiles[0].id;

    // 2. Create customer
    const { data: contact, error: cErr } = await supabase
      .from('contacts')
      .insert([{
        name: testCustomerName,
        phone: testCustomerPhone,
        type: 'customer',
        address: 'Dhaka, Bangladesh',
      }])
      .select()
      .single();

    if (cErr) throw cErr;
    contactId = contact.id;
    console.log(`✅ Created test customer: ${testCustomerName} (${testCustomerPhone})`);

    // 3. Create product
    const { data: product, error: pErr } = await supabase
      .from('products')
      .insert([{
        product_code: `PRD-${nonce}`,
        sku: `SKU-${nonce}`,
        name: `Search Test Zipper ${nonce}`,
        sale_price: 150.00,
        purchase_price: 100.00,
      }])
      .select()
      .single();

    if (pErr) throw pErr;
    productId = product.id;

    // 4. Create Sale
    const { data: sale, error: sErr } = await supabase
      .from('sales')
      .insert([{
        branch_id: branchId,
        customer_id: contactId,
        invoice_number: invoiceNumber,
        sale_date: new Date().toISOString().slice(0, 10),
        total_amount: 150.00,
        net_amount: 150.00,
        paid_amount: 150.00,
        payment_status: 'paid',
        notes: 'Test for search',
        created_by: userId,
      }])
      .select()
      .single();

    if (sErr) throw sErr;
    saleId = sale.id;

    const realInvoiceNumber = sale.invoice_number || invoiceNumber;
    // 5. Create inventory movement (Return)
    const { error: mErr } = await supabase
      .from('inventory_movements')
      .insert([{
        branch_id: branchId,
        product_id: productId,
        type: 'adjustment_in',
        quantity: 1,
        description: `Customer Return [${voucherNumber}]: Inv #${realInvoiceNumber} (Size / Variant Swap)`,
        created_by: userId,
      }]);

    if (mErr) throw mErr;
    console.log(`✅ Created return movement: ${voucherNumber} for Inv #${invoiceNumber}`);

    // TEST 1: searchInvoices by Customer Name in Modal Step 1
    console.log('\n--- TEST 1: searchInvoices by Customer Name ---');
    {
      const clean = testCustomerName.toLowerCase();
      const { data: matchedContacts } = await supabase
        .from('contacts')
        .select('id')
        .or(`name.ilike.%${clean}%,phone.ilike.%${clean}%`);

      const contactIds = (matchedContacts || []).map((c) => c.id).join(',');
      const { data: foundInvoices, error: fErr } = await supabase
        .from('sales')
        .select('id, invoice_number, contacts(name, phone)')
        .or(`invoice_number.ilike.%${clean}%,customer_id.in.(${contactIds})`);

      if (fErr) throw fErr;
      const found = foundInvoices.find(inv => inv.id === saleId);
      if (!found) throw new Error('Failed to find invoice by customer name');
      console.log(`✅ SUCCESS: Found invoice ${found.invoice_number} when searching by name "${testCustomerName}"`);
    }

    // TEST 2: searchInvoices by Customer Phone in Modal Step 1
    console.log('\n--- TEST 2: searchInvoices by Customer Phone ---');
    {
      const clean = testCustomerPhone;
      const { data: matchedContacts } = await supabase
        .from('contacts')
        .select('id')
        .or(`name.ilike.%${clean}%,phone.ilike.%${clean}%`);

      const contactIds = (matchedContacts || []).map((c) => c.id).join(',');
      const { data: foundInvoices, error: fErr } = await supabase
        .from('sales')
        .select('id, invoice_number, contacts(name, phone)')
        .or(`invoice_number.ilike.%${clean}%,customer_id.in.(${contactIds})`);

      if (fErr) throw fErr;
      const found = foundInvoices.find(inv => inv.id === saleId);
      if (!found) throw new Error('Failed to find invoice by customer phone');
      console.log(`✅ SUCCESS: Found invoice ${found.invoice_number} when searching by phone "${testCustomerPhone}"`);
    }

    // TEST 3: fetchReturnHistory by Customer Name
    console.log('\n--- TEST 3: fetchReturnHistory by Customer Name ---');
    {
      const clean = testCustomerName;
      const { data: matchedContacts } = await supabase
        .from('contacts')
        .select('id')
        .or(`name.ilike.%${clean}%,phone.ilike.%${clean}%`);

      const contactIds = (matchedContacts || []).map((c) => c.id);
      const { data: matchedSales } = await supabase
        .from('sales')
        .select('invoice_number')
        .in('customer_id', contactIds);

      const matchingInvoices = (matchedSales || []).map((s) => s.invoice_number).filter(Boolean);
      const orConditions = [`description.ilike.%${clean}%`];
      matchingInvoices.forEach((inv) => orConditions.push(`description.ilike.%${inv}%`));

      const { data: matchedMovements, error: mvErr } = await supabase
        .from('inventory_movements')
        .select('id, description')
        .or(orConditions.join(','));

      if (mvErr) throw mvErr;
      const foundMov = (matchedMovements || []).find(m => m.description.includes(voucherNumber));
      if (!foundMov) throw new Error('Failed to find return history by customer name');
      console.log(`✅ SUCCESS: Found return movement for customer name "${testCustomerName}": ${foundMov.description}`);
    }

    // TEST 4: fetchReturnHistory by Customer Phone
    console.log('\n--- TEST 4: fetchReturnHistory by Customer Phone ---');
    {
      const clean = testCustomerPhone;
      const { data: matchedContacts } = await supabase
        .from('contacts')
        .select('id')
        .or(`name.ilike.%${clean}%,phone.ilike.%${clean}%`);

      const contactIds = (matchedContacts || []).map((c) => c.id);
      const { data: matchedSales } = await supabase
        .from('sales')
        .select('invoice_number')
        .in('customer_id', contactIds);

      const matchingInvoices = (matchedSales || []).map((s) => s.invoice_number).filter(Boolean);
      const orConditions = [`description.ilike.%${clean}%`];
      matchingInvoices.forEach((inv) => orConditions.push(`description.ilike.%${inv}%`));

      const { data: matchedMovements, error: mvErr } = await supabase
        .from('inventory_movements')
        .select('id, description')
        .or(orConditions.join(','));

      if (mvErr) throw mvErr;
      const foundMov = (matchedMovements || []).find(m => m.description.includes(voucherNumber));
      if (!foundMov) throw new Error('Failed to find return history by customer phone');
      console.log(`✅ SUCCESS: Found return movement for customer phone "${testCustomerPhone}": ${foundMov.description}`);
    }

    console.log('\n🎉 ALL LIVE SEARCH TESTS PASSED 100% CLEANLY!');

  } catch (err) {
    console.error('❌ Test failed:', err);
    throw err;
  } finally {
    // Purge test records
    console.log('\n🧹 Cleaning up test artifacts...');
    if (productId) {
      await supabase.from('inventory_movements').delete().eq('product_id', productId);
      await supabase.from('inventory').delete().eq('product_id', productId);
    }
    if (saleId) {
      await supabase.from('sales').delete().eq('id', saleId);
    }
    if (productId) {
      await supabase.from('products').delete().eq('id', productId);
    }
    if (contactId) {
      await supabase.from('contacts').delete().eq('id', contactId);
    }
    console.log('✅ Cleanup complete.');
  }
}

runReturnsSearchLiveTest().catch(() => process.exit(1));
