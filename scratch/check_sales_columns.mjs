import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wyjagcatkwuqsfgulnaf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5amFnY2F0a3d1cXNmZ3VsbmFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzYzMzEsImV4cCI6MjEwNDAxMjMzMX0.sk2CBZrbPJTc66kQPQYoQTsmV-Sq4BMw77v6JfGRW4Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('Checking existing columns on sale_items and sales...');

  const { data: saleItems, error: siErr } = await supabase
    .from('sale_items')
    .select('*')
    .limit(1);

  console.log('sale_items sample row / columns:', saleItems && saleItems[0] ? Object.keys(saleItems[0]) : 'Empty table');

  const { data: sales, error: sErr } = await supabase
    .from('sales')
    .select('*')
    .limit(1);

  console.log('sales sample row / columns:', sales && sales[0] ? Object.keys(sales[0]) : 'Empty table');
}

checkColumns().catch(console.error);
