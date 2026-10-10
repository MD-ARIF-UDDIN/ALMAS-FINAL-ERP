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

const PURCHASES_DATA = [
  { date: '2026-04-19', challan: '1201', qty: 320, price: 130.00, debit: 41600.00 },
  { date: '2026-04-23', challan: '1227', qty: 520, price: 132.00, debit: 68640.00 },
  { date: '2026-05-07', challan: '810', qty: 400, price: 132.00, debit: 52800.00 },
  { date: '2026-05-20', challan: '900', qty: 200, price: 130.00, debit: 26000.00 },
  { date: '2026-06-06', challan: '1029', qty: 400, price: 130.00, debit: 52000.00 },
  { date: '2026-06-08', challan: '1035', qty: 400, price: 130.00, debit: 52000.00 },
  { date: '2026-06-15', challan: '1053', qty: 400, price: 130.00, debit: 52000.00 },
  { date: '2026-06-28', challan: '1100', qty: 400, price: 130.00, debit: 52000.00 },
  { date: '2026-07-06', challan: '945', qty: 400, price: 130.00, debit: 52000.00 },
  { date: '2026-07-15', challan: '997', qty: 600, price: 130.00, debit: 78000.00 },
  { date: '2026-07-23', challan: '647', qty: 600, price: 130.00, debit: 78000.00 },
  { date: '2026-07-30', challan: '674', qty: 600, price: 132.00, debit: 79200.00 },
  { date: '2026-08-12', challan: '1163', qty: 600, price: 132.00, debit: 79200.00 },
  { date: '2026-08-18', challan: '1194', qty: 400, price: 132.00, debit: 52800.00 },
  { date: '2026-08-19', challan: '675', qty: 400, price: 132.00, debit: 52800.00 },
  { date: '2026-08-26', challan: '21', qty: 800, price: 132.00, debit: 105600.00 },
  { date: '2026-09-02', challan: '57', qty: 800, price: 135.00, debit: 108000.00 },
  { date: '2026-09-10', challan: '97', qty: 800, price: 135.00, debit: 108000.00 },
  { date: '2026-09-17', challan: 'Steadfast', qty: 400, price: 135.00, debit: 54000.00 },
  { date: '2026-09-20', challan: '155', qty: 400, price: 135.00, debit: 54000.00 },
  { date: '2026-09-23', challan: '190', qty: 400, price: 135.00, debit: 54000.00 },
  { date: '2026-09-27', challan: '419', qty: 800, price: 136.00, debit: 108800.00 },
  { date: '2026-10-03', challan: '448', qty: 400, price: 136.00, debit: 54400.00 },
];

const PAYMENTS_DATA = [
  { date: '2026-04-21', bank: 'Pubali Bank', credit: 41600.00 },
  { date: '2026-04-30', bank: 'Uttara Bank', credit: 50000.00 },
  { date: '2026-05-03', bank: 'Uttara Bank', credit: 18640.00 },
  { date: '2026-05-11', bank: 'Uttara Bank', credit: 52800.00 },
  { date: '2026-05-23', bank: 'Uttara Bank', credit: 26000.00 },
  { date: '2026-06-10', bank: 'Uttara Bank', credit: 52000.00 },
  { date: '2026-06-17', bank: 'Uttara Bank', credit: 50000.00 },
  { date: '2026-06-21', bank: 'Uttara Bank', credit: 54000.00 },
  { date: '2026-07-06', bank: 'Uttara Bank', credit: 52000.00 },
  { date: '2026-07-19', bank: 'Uttara Bank', credit: 70000.00 },
  { date: '2026-07-22', bank: 'Uttara Bank', credit: 50000.00 },
  { date: '2026-07-27', bank: 'Uttara Bank', credit: 49000.00 },
  { date: '2026-07-30', bank: 'Uttara Bank', credit: 37000.00 },
  { date: '2026-08-02', bank: 'Uttara Bank', credit: 35000.00 },
  { date: '2026-08-06', bank: 'Uttara Bank', credit: 20000.00 },
  { date: '2026-08-10', bank: 'Uttara Bank', credit: 26000.00 },
  { date: '2026-08-17', bank: 'Uttara Bank', credit: 50000.00 },
  { date: '2026-08-20', bank: 'Uttara Bank', credit: 36000.00 },
  { date: '2026-08-25', bank: 'Uttara Bank', credit: 55000.00 },
  { date: '2026-08-27', bank: 'Uttara Bank', credit: 25000.00 },
  { date: '2026-08-30', bank: 'Uttara Bank', credit: 30000.00 },
  { date: '2026-09-02', bank: 'Uttara Bank', credit: 50000.00 },
  { date: '2026-09-02', bank: 'Uttara Bank', credit: 20000.00 },
  { date: '2026-09-09', bank: 'Uttara Bank', credit: 50000.00 },
  { date: '2026-09-15', bank: 'Uttara Bank', credit: 35000.00 },
  { date: '2026-09-16', bank: 'Uttara Bank', credit: 100000.00 },
  { date: '2026-09-23', bank: 'Uttara Bank', credit: 50000.00 },
  { date: '2026-09-26', bank: 'Uttara Bank', credit: 23000.00 },
  { date: '2026-09-29', bank: 'Uttara Bank', credit: 50000.00 },
  { date: '2026-10-01', bank: 'Uttara Bank', credit: 50000.00 },
];

async function seedKhanTwisting() {
  console.log('--- SEEDING KHAN TWISTING RAW BILL DATA ---');

  // 1. Get Factory Branch ID
  const { data: branches, error: bErr } = await supabase.from('branches').select('id, name, is_factory');
  if (bErr) throw bErr;
  const factoryBranch = branches.find(b => b.is_factory || b.name?.toLowerCase().includes('factory'));
  if (!factoryBranch) throw new Error('Factory branch not found.');
  console.log(`Using Factory Branch: ${factoryBranch.name} (${factoryBranch.id})`);

  // 2. Get Profile ID for created_by
  const { data: profiles, error: prErr } = await supabase.from('profiles').select('id, role').limit(5);
  if (prErr) throw prErr;
  const adminProfile = profiles.find(p => p.role === 'owner' || p.role === 'admin') || profiles[0];
  console.log(`Using Creator Profile ID: ${adminProfile.id}`);

  // 3. Get or Create Supplier Contact
  let { data: suppliers, error: sErr } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .or('name.ilike.%KHAN TWISTING%,phone.eq.01718-935976');

  if (sErr) throw sErr;

  let supplier = suppliers && suppliers.length > 0 ? suppliers[0] : null;

  if (!supplier) {
    const { data: newSupp, error: createSuppErr } = await supabase
      .from('contacts')
      .insert([
        {
          name: 'KHAN TWISTING',
          phone: '01718-935976',
          type: 'supplier',
          branch_id: factoryBranch.id,
          address: 'Raw Yarn / Twisting Supplier',
        }
      ])
      .select()
      .single();
    if (createSuppErr) throw createSuppErr;
    supplier = newSupp;
    console.log(`Created supplier contact: KHAN TWISTING (${supplier.id})`);
  } else {
    console.log(`Found existing supplier contact: ${supplier.name} (${supplier.id})`);
  }

  // 4. Clean ANY previous bills, items, and payments for KHAN TWISTING
  console.log('--- PURGING ALL PREVIOUS KHAN TWISTING BILLS & PAYMENTS ---');
  const supplierIds = (suppliers && suppliers.length > 0) ? suppliers.map(s => s.id) : [supplier.id];

  // Find all purchases for these supplier IDs
  const { data: oldPurchases } = await supabase
    .from('purchases')
    .select('id, invoice_number')
    .in('supplier_id', supplierIds);

  if (oldPurchases && oldPurchases.length > 0) {
    const oldIds = oldPurchases.map(p => p.id);
    const { error: delItemsErr } = await supabase.from('purchase_items').delete().in('purchase_id', oldIds);
    if (delItemsErr) console.warn('Warning deleting purchase items:', delItemsErr.message);
    const { error: delPurchasesErr } = await supabase.from('purchases').delete().in('id', oldIds);
    if (delPurchasesErr) console.warn('Warning deleting purchases:', delPurchasesErr.message);
    console.log(`✓ Cleared ${oldPurchases.length} previous purchase bills.`);
  } else {
    console.log('No prior purchases found to delete.');
  }

  // Delete all existing payments for these supplier IDs
  const { data: oldPayments } = await supabase
    .from('payments')
    .select('id')
    .in('contact_id', supplierIds);

  if (oldPayments && oldPayments.length > 0) {
    const { error: delPayErr } = await supabase.from('payments').delete().in('contact_id', supplierIds);
    if (delPayErr) console.warn('Warning deleting payments:', delPayErr.message);
    console.log(`✓ Cleared ${oldPayments.length} previous payments.`);
  } else {
    console.log('No prior payments found to delete.');
  }

  // 5. Insert Purchases & Items with product_id: null (raw factory items)
  console.log(`Inserting ${PURCHASES_DATA.length} purchase challans...`);
  const insertedPurchases = [];

  for (const pur of PURCHASES_DATA) {
    const { data: purRecord, error: pErr } = await supabase
      .from('purchases')
      .insert([
        {
          branch_id: factoryBranch.id,
          supplier_id: supplier.id,
          invoice_number: pur.challan,
          purchase_date: pur.date,
          total_amount: pur.debit,
          discount: 0,
          net_amount: pur.debit,
          paid_amount: 0,
          payment_status: 'unpaid',
          notes: `Challan #${pur.challan} (${pur.qty} lbs @ ৳${pur.price})`,
          created_by: adminProfile.id,
        }
      ])
      .select()
      .single();

    if (pErr) throw pErr;

    // Insert purchase item with product_id: null (Gray Thread without creating in product catalog, unit: 'lbs')
    const { error: piErr } = await supabase.from('purchase_items').insert([
      {
        purchase_id: purRecord.id,
        product_id: null,
        item_name: 'Gray Thread',
        quantity: pur.qty,
        unit_price: pur.price,
        total_price: pur.debit,
        unit: 'lbs',
      }
    ]);
    if (piErr) throw piErr;

    insertedPurchases.push({ ...purRecord, originalChallan: pur.challan, date: pur.date, debit: pur.debit });
  }
  console.log(`✓ Inserted ${insertedPurchases.length} purchase bills.`);

  // 6. Insert Payments and Allocate to Purchases (FIFO)
  console.log(`Inserting ${PAYMENTS_DATA.length} payment records...`);
  let totalDebit = PURCHASES_DATA.reduce((sum, p) => sum + p.debit, 0);
  let totalCredit = PAYMENTS_DATA.reduce((sum, p) => sum + p.credit, 0);

  // Allocate payments across purchases chronologically
  let remainingPurchases = insertedPurchases.map(p => ({
    id: p.id,
    net_amount: p.debit,
    paid_amount: 0,
  }));

  for (const pay of PAYMENTS_DATA) {
    let unallocatedPay = pay.credit;
    let refInvoiceId = null;

    // Find purchase to link payment to
    for (const pur of remainingPurchases) {
      const due = pur.net_amount - pur.paid_amount;
      if (due > 0 && unallocatedPay > 0) {
        const payForThis = Math.min(due, unallocatedPay);
        pur.paid_amount += payForThis;
        unallocatedPay -= payForThis;
        if (!refInvoiceId) refInvoiceId = pur.id;
      }
    }

    const { error: payErr } = await supabase.from('payments').insert([
      {
        branch_id: factoryBranch.id,
        contact_id: supplier.id,
        payment_date: new Date(pay.date).toISOString(),
        amount: pay.credit,
        payment_method: 'bank',
        transaction_type: 'supplier_payment',
        reference_number: pay.bank,
        reference_invoice_id: refInvoiceId || remainingPurchases[0].id,
        notes: `Bank Payment via ${pay.bank}`,
        created_by: adminProfile.id,
      }
    ]);
    if (payErr) throw payErr;
  }

  // 7. Update paid_amount & payment_status on purchases
  for (const pur of remainingPurchases) {
    let status = 'unpaid';
    if (pur.paid_amount >= pur.net_amount - 0.01) {
      status = 'paid';
    } else if (pur.paid_amount > 0) {
      status = 'partial';
    }

    await supabase
      .from('purchases')
      .update({
        paid_amount: pur.paid_amount,
        payment_status: status,
      })
      .eq('id', pur.id);
  }

  console.log('==============================================');
  console.log('SUMMARY:');
  console.log(`Total Quantity:          ${PURCHASES_DATA.reduce((s, p) => s + p.qty, 0)} pcs`);
  console.log(`Total Purchases (Debit): ৳${totalDebit.toLocaleString()}`);
  console.log(`Total Payments (Credit): ৳${totalCredit.toLocaleString()}`);
  console.log(`Closing Balance Due:     ৳${(totalDebit - totalCredit).toLocaleString()}`);
  console.log('==============================================');
  console.log('✓ Successfully seeded all records for KHAN TWISTING.');
}

seedKhanTwisting()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error seeding data:', err);
    process.exit(1);
  });
