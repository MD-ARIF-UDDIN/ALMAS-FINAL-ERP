import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanOperationalData() {
  console.log('--- Starting Operational Data Cleanup ---');

  const operations = [
    { table: 'sale_items', desc: 'Sale Line Items' },
    { table: 'sales', desc: 'Sales Invoices' },
    { table: 'purchase_items', desc: 'Purchase Line Items' },
    { table: 'purchases', desc: 'Purchase Orders & Bills' },
    { table: 'branch_challan_items', desc: 'Delivery Challan Items' },
    { table: 'branch_challans', desc: 'Delivery Challans' },
    { table: 'branch_payments', desc: 'Branch Challan Payment Requests' },
    { table: 'payments', desc: 'Payment Transactions' },
    { table: 'expenses', desc: 'Expense Records' },
    { table: 'inventory_movements', desc: 'Inventory Stock Movement Logs' },
    { table: 'cash_ledger', desc: 'Cash & Bank Ledger Entries' },
  ];

  for (const op of operations) {
    process.stdout.write(`Deleting ${op.desc} (${op.table})... `);
    const { error } = await supabase
      .from(op.table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.log(`❌ Error: ${error.message}`);
    } else {
      console.log(`✓ Cleared`);
    }
  }

  // Reset all stock quantities in inventory to 0
  process.stdout.write('Resetting inventory stock quantities to 0... ');
  const { error: invErr } = await supabase
    .from('inventory')
    .update({ quantity: 0, updated_at: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (invErr) {
    console.log(`❌ Error: ${invErr.message}`);
  } else {
    console.log(`✓ Stock reset to 0`);
  }

  console.log('\n--- Cleanup Finished Successfully ---');
  console.log('Preserved:');
  console.log('✓ branches');
  console.log('✓ profiles & users');
  console.log('✓ products catalog');
  console.log('✓ contacts (customers/suppliers)');
}

cleanOperationalData().then(() => {
  setTimeout(() => process.exit(0), 100);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
