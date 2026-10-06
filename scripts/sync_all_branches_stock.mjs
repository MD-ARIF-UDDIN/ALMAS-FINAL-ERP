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

async function syncStock() {
  console.log('=== SYNCHRONIZING BRANCH INVENTORIES (PURCHASES - SALES) WITHOUT TOUCHING INVOICES ===\n');
  const { data: branches, error: bErr } = await supabase.from('branches').select('*');
  if (bErr) throw bErr;

  const { data: allProducts } = await supabase.from('products').select('id, product_code, name, purchase_price, sale_price');
  const prodMap = {};
  allProducts?.forEach(p => { prodMap[p.id] = p; });

  for (const branch of branches) {
    const isFactory = Boolean(branch.is_factory || branch.name?.toLowerCase().includes('factory'));
    console.log(`\n--- Processing Branch: ${branch.name} (${isFactory ? 'Factory' : 'Showroom / Retail'}) ---`);

    // 1. Fetch purchases for this branch
    const { data: purchases } = await supabase
      .from('purchases')
      .select('id, purchase_items(product_id, quantity, unit_price)')
      .eq('branch_id', branch.id);

    // 2. Fetch sales for this branch
    const { data: sales } = await supabase
      .from('sales')
      .select('id, sale_items(product_id, quantity, unit_price)')
      .eq('branch_id', branch.id);

    const purMap = {};
    const purCostMap = {};
    purchases?.forEach(p => {
      p.purchase_items?.forEach(it => {
        if (it.product_id) {
          purMap[it.product_id] = (purMap[it.product_id] || 0) + Number(it.quantity || 0);
          if (it.unit_price > 0) purCostMap[it.product_id] = Number(it.unit_price);
        }
      });
    });

    const saleMap = {};
    sales?.forEach(s => {
      s.sale_items?.forEach(it => {
        if (it.product_id) {
          saleMap[it.product_id] = (saleMap[it.product_id] || 0) + Number(it.quantity || 0);
        }
      });
    });

    // 3. Fetch existing inventory rows for this branch
    const { data: inventory } = await supabase
      .from('inventory')
      .select('*')
      .eq('branch_id', branch.id);

    const invMap = {};
    inventory?.forEach(inv => {
      invMap[inv.product_id] = inv;
    });

    // All active product IDs
    const allPids = Array.from(new Set([...Object.keys(purMap), ...Object.keys(saleMap), ...Object.keys(invMap)]));
    console.log(`Total Products active in ${branch.name}: ${allPids.length}`);

    let updatedCount = 0;
    let createdCount = 0;
    let unchangedCount = 0;

    for (const pid of allPids) {
      const pPurchased = purMap[pid] || 0;
      const pSold = saleMap[pid] || 0;
      const trueStock = isFactory ? 0 : Math.max(0, pPurchased - pSold);
      const existingInv = invMap[pid];
      const pInfo = prodMap[pid];
      const code = pInfo?.product_code || pInfo?.name || pid;

      if (existingInv) {
        if (existingInv.quantity !== trueStock) {
          const { error: upErr } = await supabase
            .from('inventory')
            .update({
              quantity: trueStock,
              purchase_price: purCostMap[pid] || existingInv.purchase_price || pInfo?.purchase_price || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingInv.id);

          if (upErr) {
            console.error(`Error updating stock for ${code}:`, upErr.message);
          } else {
            console.log(`  ✓ ${code}: Qty changed ${existingInv.quantity} ➔ ${trueStock} (Pur: ${pPurchased}, Sold: ${pSold})`);
            updatedCount++;
          }
        } else {
          unchangedCount++;
        }
      } else {
        // Create missing inventory row
        const { error: insErr } = await supabase
          .from('inventory')
          .insert([
            {
              branch_id: branch.id,
              product_id: pid,
              quantity: trueStock,
              purchase_price: purCostMap[pid] || pInfo?.purchase_price || null,
              sale_price: pInfo?.sale_price || null,
              updated_at: new Date().toISOString(),
            }
          ]);

        if (insErr) {
          console.error(`Error inserting missing inventory for ${code}:`, insErr.message);
        } else {
          console.log(`  ✓ ${code}: Created inventory row with Qty ${trueStock} (Pur: ${pPurchased}, Sold: ${pSold})`);
          createdCount++;
        }
      }
    }

    console.log(`Branch ${branch.name} Summary: ${updatedCount} updated, ${createdCount} created, ${unchangedCount} already accurate.`);
  }

  console.log('\n✓ STOCK SYNCHRONIZATION COMPLETE FOR ALL BRANCHES.');
}

syncStock().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
