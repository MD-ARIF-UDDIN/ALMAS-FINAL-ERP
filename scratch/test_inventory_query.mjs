import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wyjagcatkwuqsfgulnaf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5amFnY2F0a3d1cXNmZ3VsbmFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzYzMzEsImV4cCI6MjEwNDAxMjMzMX0.sk2CBZrbPJTc66kQPQYoQTsmV-Sq4BMw77v6JfGRW4Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInventory() {
  const { data: branches, error: bErr } = await supabase.from('branches').select('*');
  console.log('Branches:', branches);

  if (branches && branches.length > 0) {
    const branchId = branches[0].id;
    console.log('Testing query for branch:', branchId);

    const { data, error } = await supabase
      .from('inventory')
      .select(`
        quantity,
        product_id,
        purchase_price,
        sale_price,
        products (
          id,
          sku,
          product_code,
          name,
          sale_price,
          purchase_price,
          category,
          description
        )
      `)
      .eq('branch_id', branchId);

    if (error) {
      console.error('Inventory query error:', error);
    } else {
      console.log('Inventory query success! Rows:', data?.length);
    }
  }
}

testInventory().catch(console.error);
