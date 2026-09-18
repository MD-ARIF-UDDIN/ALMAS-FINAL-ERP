import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  AlertTriangle, 
  Search, 
  Store
} from 'lucide-react';
import { TableLoading } from '../components/TableLoading';
import { hasPermission } from '../utils/permissions';

export default function Inventory({ userProfile, branches, addToast }) {
  const [products, setProducts] = useState([]);
  const [stockLevels, setStockLevels] = useState([]);
  const [movements, setMovements] = useState([]);
  const [activeTab, setActiveTab] = useState('stock'); // 'stock', 'logs'
  const [loading, setLoading] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Filtering states
  const role = userProfile?.role || 'staff';
  const myBranchId = userProfile?.branch_id;

  // Permissions
  const canViewStock = hasPermission(userProfile, 'inventory.stock_view');
  const canViewLogs = hasPermission(userProfile, 'inventory.logs_view');
  const canAdjustStock = hasPermission(userProfile, 'inventory.adjust');

  // Retail branches (Factories create & dispatch make-to-order, so no static stock holding)
  const retailBranches = branches.filter((b) => !b.is_factory && !b.name?.toLowerCase().includes('factory'));
  const userAssignedBranch = branches.find((b) => b.id === myBranchId);
  const isUserFactory = userAssignedBranch?.is_factory || userAssignedBranch?.name?.toLowerCase().includes('factory');

  const defaultBranchId = (!isUserFactory && myBranchId) 
    ? myBranchId 
    : (retailBranches[0]?.id || branches[0]?.id || '');

  const [selectedBranchId, setSelectedBranchId] = useState(defaultBranchId);
  const [searchQuery, setSearchQuery] = useState('');
  const [movementFilter, setMovementFilter] = useState('all');

  // Manual stock adjustment states
  const [adjustmentProductId, setAdjustmentProductId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('adjustment_in');
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  // Sync initial branch selection if not set
  useEffect(() => {
    if (!selectedBranchId && retailBranches.length > 0) {
      setSelectedBranchId(retailBranches[0].id);
    }
  }, [branches, retailBranches, selectedBranchId]);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      fetchStockLevels();
      fetchMovements();
    }
  }, [selectedBranchId]);

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load products.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStockLevels = async () => {
    if (!selectedBranchId) return;
    setLoadingStock(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          id,
          branch_id,
          quantity,
          min_stock_level,
          product_id,
          products (
            id,
            sku,
            product_code,
            name,
            category,
            purchase_price,
            sale_price
          ),
          branches (
            name,
            is_factory
          )
        `)
        .eq('branch_id', selectedBranchId);

      if (error) throw error;
      setStockLevels(data || []);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load stock levels.', 'error');
    } finally {
      setLoadingStock(false);
    }
  };

  const fetchMovements = async () => {
    if (!selectedBranchId) return;
    setLoadingMovements(true);
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          id,
          created_at,
          type,
          quantity,
          description,
          branch_id,
          products (
            sku,
            product_code,
            name
          ),
          branches (
            name
          ),
          profiles (
            full_name
          )
        `)
        .eq('branch_id', selectedBranchId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMovements(data || []);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load stock movement ledger.', 'error');
    } finally {
      setLoadingMovements(false);
    }
  };

  // ====================================================================
  // MANUAL STOCK ADJUSTMENT
  // ====================================================================
  const handleManualAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustmentProductId || !adjustmentQty || !adjustmentReason.trim()) {
      showMessage('Please fill all required adjustment fields.', 'error');
      return;
    }

    const qtyNum = parseInt(adjustmentQty);
    if (qtyNum <= 0) {
      showMessage('Quantity must be greater than zero.', 'error');
      return;
    }

    if (!selectedBranchId) {
      showMessage('Please select a branch to adjust stock.', 'error');
      return;
    }

    setLoading(true);
    try {
      const isOut = adjustmentType === 'adjustment_out';
      const actualQtyChange = isOut ? -qtyNum : qtyNum;

      const { data: currentInv } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('branch_id', selectedBranchId)
        .eq('product_id', adjustmentProductId)
        .maybeSingle();

      const currentQty = currentInv ? currentInv.quantity : 0;
      const newQty = Math.max(0, currentQty + actualQtyChange);

      const { error: upsertError } = await supabase
        .from('inventory')
        .upsert({
          branch_id: selectedBranchId,
          product_id: adjustmentProductId,
          quantity: newQty,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'branch_id,product_id' });

      if (upsertError) throw upsertError;

      await supabase.from('inventory_movements').insert([
        {
          branch_id: selectedBranchId,
          product_id: adjustmentProductId,
          type: adjustmentType,
          quantity: qtyNum,
          description: `Manual adjustment: ${adjustmentReason.trim()}`,
          created_by: userProfile.id,
        },
      ]);

      showMessage('Stock level adjusted successfully!', 'success');
      setAdjustmentProductId('');
      setAdjustmentQty('');
      setAdjustmentReason('');
      setShowAdjustmentModal(false);
      fetchStockLevels();
      fetchMovements();
    } catch (err) {
      console.error(err);
      showMessage('Failed to complete stock adjustment.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedBranchObj = branches.find((b) => b.id === selectedBranchId);

  // Combined stock list for the selected independent branch
  const branchStockList = products.map((p) => {
    const inv = stockLevels.find((s) => s.product_id === p.id);
    const qty = inv ? inv.quantity : 0;
    const minStock = inv?.min_stock_level ?? 5;
    const isOutOfStock = qty <= 0;
    const isLowStock = !isOutOfStock && qty <= minStock;

    return {
      ...p,
      inventoryId: inv?.id,
      quantity: qty,
      minStock,
      isOutOfStock,
      isLowStock,
    };
  });

  const filteredBranchStock = branchStockList.filter(
    (item) =>
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.product_code && item.product_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredMovements = movements.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      m.products?.name?.toLowerCase().includes(q) ||
      m.products?.sku?.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q);

    const matchType = movementFilter === 'all' || m.type === movementFilter;
    return matchSearch && matchType;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div className="top-bar">
        <div className="page-title-group">
          <h1>Stock & Inventory</h1>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Branch physical inventory tracking & movement audits
          </div>
        </div>

        <div className="top-bar-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {role === 'owner' ? (
            <div className="form-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ whiteSpace: 'nowrap', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Store size={16} />
                <span>Branch:</span>
              </label>
              <select
                className="input-control"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                style={{ width: '220px', fontWeight: 600 }}
              >
                {retailBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    🏪 {b.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ fontWeight: 600, color: 'var(--primary)', backgroundColor: 'var(--bg-secondary)', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Store size={15} />
              <span>{selectedBranchObj?.name || 'Branch'}</span>
            </div>
          )}

          {canAdjustStock && (
            <button 
              className="btn btn-secondary"
              onClick={() => setShowAdjustmentModal(true)}
              title="Manual stock adjustment (breakage, winding, audit loss)"
            >
              <RefreshCw size={15} />
              <span>Manual Adjust</span>
            </button>
          )}
        </div>
      </div>



      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '0.5rem', flexWrap: 'wrap' }}>
        {canViewStock && (
          <button
            className={`btn ${activeTab === 'stock' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: '-1px' }}
            onClick={() => setActiveTab('stock')}
          >
            <Package size={16} />
            <span>Stock in Hand ({selectedBranchObj?.name || 'Branch'})</span>
          </button>
        )}

        {canViewLogs && (
          <button
            className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: '-1px' }}
            onClick={() => setActiveTab('logs')}
          >
            <RefreshCw size={16} />
            <span>Movement Logs</span>
          </button>
        )}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: INDEPENDENT BRANCH STOCK IN HAND */}
      {/* ==================================================================== */}
      {activeTab === 'stock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
                <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input-control"
                  style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                  placeholder="Search by Product Code or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Showing stock for <strong>{selectedBranchObj?.name || 'Branch'}</strong> ({filteredBranchStock.length} items)
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>SL</th>
                    <th style={{ width: '150px' }}>Product Code</th>
                    <th>Product Name</th>
                    <th style={{ width: '140px' }}>Category</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Stock In Hand</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading || loadingStock ? (
                    <TableLoading colSpan={6} message={`Fetching stock for ${selectedBranchObj?.name || 'branch'}...`} />
                  ) : filteredBranchStock.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        No product stock records found.
                      </td>
                    </tr>
                  ) : (
                    filteredBranchStock.map((item, index) => (
                      <tr key={item.id}>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{index + 1}</td>
                        <td>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--primary)' }}>
                            {item.product_code || item.sku}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.name || '—'}
                        </td>
                        <td>
                          {item.category ? (
                            <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                              {item.category}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '1rem', color: item.isOutOfStock ? 'var(--text-muted)' : item.isLowStock ? 'var(--danger-text)' : 'var(--text-primary)' }}>
                          {item.quantity}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {item.isOutOfStock ? (
                            <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', fontSize: '0.72rem' }}>
                              Out of Stock
                            </span>
                          ) : item.isLowStock ? (
                            <span className="badge badge-unpaid" style={{ fontSize: '0.72rem' }}>
                              <AlertTriangle size={12} />
                              <span>Low Stock</span>
                            </span>
                          ) : (
                            <span className="badge badge-paid" style={{ fontSize: '0.72rem' }}>
                              In Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: STOCK MOVEMENT LOGS */}
      {/* ==================================================================== */}
      {activeTab === 'logs' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-control"
                style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                placeholder="Search movements by product, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="input-control"
              style={{ width: '180px', fontSize: '0.85rem' }}
              value={movementFilter}
              onChange={(e) => setMovementFilter(e.target.value)}
            >
              <option value="all">All Movement Types</option>
              <option value="transfer_in">Transfer In</option>
              <option value="transfer_out">Transfer Out</option>
              <option value="purchase">Purchases (Stock In)</option>
              <option value="sale">Sales (Stock Out)</option>
              <option value="adjustment_in">Adjustment In</option>
              <option value="adjustment_out">Adjustment Out</option>
            </select>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>SL</th>
                  <th style={{ width: '140px' }}>Date & Time</th>
                  <th>Product</th>
                  <th style={{ width: '140px' }}>Movement Type</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Quantity</th>
                  <th>Description</th>
                  <th style={{ width: '120px' }}>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {loadingMovements ? (
                  <TableLoading colSpan={7} message={`Loading movement ledger for ${selectedBranchObj?.name || 'branch'}...`} />
                ) : filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No stock movements recorded for this branch.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m, index) => {
                    const isIn = ['purchase', 'adjustment_in', 'transfer_in'].includes(m.type);
                    return (
                      <tr key={m.id}>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{index + 1}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Date(m.created_at).toLocaleString()}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          <div>{m.products?.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {m.products?.sku || m.products?.product_code}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${isIn ? 'badge-paid' : 'badge-unpaid'}`} style={{ fontSize: '0.72rem' }}>
                            {isIn ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            <span style={{ marginLeft: '0.25rem' }}>{m.type.replace('_', ' ')}</span>
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: isIn ? 'var(--success-text)' : 'var(--danger-text)' }}>
                          {isIn ? `+${m.quantity}` : `-${m.quantity}`}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{m.description}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{m.profiles?.full_name || 'System'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MANUAL ADJUSTMENT MODAL */}
      {/* ==================================================================== */}
      {showAdjustmentModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', width: '95vw' }}>
            <div className="modal-header">
              <h3 className="modal-title">Manual Stock Adjustment ({selectedBranchObj?.name})</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAdjustmentModal(false)} style={{ borderRadius: '50%', padding: '0.35rem 0.5rem', border: 'none' }}>
                ✕
              </button>
            </div>
            <form onSubmit={handleManualAdjustment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
                <div className="form-group">
                  <label>Product *</label>
                  <select
                    className="input-control"
                    value={adjustmentProductId}
                    onChange={(e) => setAdjustmentProductId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.product_code || p.sku} - {p.name || 'Unnamed'}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Adjustment Type *</label>
                    <select
                      className="input-control"
                      value={adjustmentType}
                      onChange={(e) => setAdjustmentType(e.target.value)}
                      required
                    >
                      <option value="adjustment_in">Stock In (+)</option>
                      <option value="adjustment_out">Stock Out (-)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      className="input-control"
                      value={adjustmentQty}
                      onChange={(e) => setAdjustmentQty(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Reason / Notes *</label>
                  <textarea
                    className="input-control"
                    style={{ minHeight: '65px' }}
                    placeholder="e.g. Damage, winding loss, physical audit count..."
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustmentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
