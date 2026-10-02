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

async function recalibrateGazipurStock() {
  console.log('--- RECALIBRATING GAZIPUR STOCK ---');
  const { data: branches } = await supabase.from('branches').select('*');
  const gazipur = branches.find(b => b.name?.toLowerCase().includes('gazipur'));
  const gazipurId = gazipur.id;

  // 1. Fetch all purchases for Gazipur
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, purchase_items(product_id, quantity, unit_price)')
    .eq('branch_id', gazipurId);

  // 2. Fetch all sales for Gazipur
  const { data: sales } = await supabase
    .from('sales')
    .select('id, sale_items(product_id, quantity)')
    .eq('branch_id', gazipurId);

  // 3. Calculate true purchased and sold per product_id
  const totalPurchasedMap = {};
  const lastCostMap = {};
  purchases?.forEach(p => {
    p.purchase_items?.forEach(it => {
      if (it.product_id) {
        totalPurchasedMap[it.product_id] = (totalPurchasedMap[it.product_id] || 0) + Number(it.quantity || 0);
        if (it.unit_price > 0) lastCostMap[it.product_id] = Number(it.unit_price);
      }
    });
  });

  const totalSoldMap = {};
  sales?.forEach(s => {
    s.sale_items?.forEach(it => {
      if (it.product_id) {
        totalSoldMap[it.product_id] = (totalSoldMap[it.product_id] || 0) + Number(it.quantity || 0);
      }
    });
  });

  // 4. Fetch current inventory for Gazipur
  const { data: inventory } = await supabase
    .from('inventory')
    .select('*, products(product_code, name)')
    .eq('branch_id', gazipurId);

  const updates = [];
  for (const inv of (inventory || [])) {
    const pId = inv.product_id;
    const purchased = totalPurchasedMap[pId] || 0;
    const sold = totalSoldMap[pId] || 0;
    const trueStock = Math.max(0, purchased - sold);
    const prodName = inv.products?.product_code || inv.products?.name || pId;

    console.log(`Product ${prodName}: Current=${inv.quantity} -> TrueStock=${trueStock} (Purchased=${purchased}, Sold=${sold})`);
    
    // Update inventory quantity to exact trueStock
    const { error: updateErr } = await supabase
      .from('inventory')
      .update({
        quantity: trueStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inv.id);

    if (updateErr) {
      console.error(`Failed to update ${prodName}:`, updateErr.message);
    } else {
      updates.push({ prodName, oldQty: inv.quantity, newQty: trueStock });
    }
  }

  // 5. Clean duplicate manual inventory movements (Branch Purchase: Bill #...) to keep audit log pure
  const { data: dupMovs, error: movFetchErr } = await supabase
    .from('inventory_movements')
    .select('id, description')
    .eq('branch_id', gazipurId)
    .ilike('description', 'Branch Purchase: Bill #%');

  console.log(`Found ${dupMovs?.length || 0} duplicate manual movement records to clean up.`);
  if (dupMovs && dupMovs.length > 0) {
    const idsToDelete = dupMovs.map(m => m.id);
    const { error: delErr } = await supabase
      .from('inventory_movements')
      .delete()
      .in('id', idsToDelete);
    if (delErr) console.error('Error deleting duplicate movements:', delErr.message);
    else console.log(`✓ Cleaned up ${dupMovs.length} duplicate movement records.`);
  }

  console.log(`\n✓ Successfully recalibrated ${updates.length} products in Gazipur branch.`);
}

recalibrateGazipurStock().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
