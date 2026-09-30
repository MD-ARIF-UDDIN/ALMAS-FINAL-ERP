import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wyjagcatkwuqsfgulnaf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5amFnY2F0a3d1cXNmZ3VsbmFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzYzMzEsImV4cCI6MjEwNDAxMjMzMX0.sk2CBZrbPJTc66kQPQYoQTsmV-Sq4BMw77v6JfGRW4Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testColumnSupport() {
  console.log('Testing if size and number_of_carton columns exist on sale_items...');

  const { data, error } = await supabase
    .from('sale_items')
    .select('id, size, number_of_carton')
    .limit(1);

  if (error) {
    console.log('Columns do not exist yet in DB schema:', error.message);
  } else {
    console.log('✅ Columns exist in DB schema!');
  }
}

testColumnSupport().catch(console.error);
