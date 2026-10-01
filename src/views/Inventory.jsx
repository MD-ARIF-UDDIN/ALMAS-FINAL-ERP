import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import Pagination from '../components/Pagination';
import { hasPermission } from '../utils/permissions';
import { formatAmount } from '../utils/format';

export default function Inventory({ userProfile, branches, addToast }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'logs' ? 'logs' : 'stock';
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });

  const [stockItems, setStockItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [allProductsForAdjustment, setAllProductsForAdjustment] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);

  // Pagination states - Stock
  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(25);
  const [stockTotalCount, setStockTotalCount] = useState(0);

  // Pagination states - Movements
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(25);
  const [logsTotalCount, setLogsTotalCount] = useState(0);

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

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  // Fetch product list for dropdown in manual adjustment modal
  const fetchProductsForModal = async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name, sku, product_code')
        .order('name', { ascending: true });
      setAllProductsForAdjustment(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProductsForModal();
  }, []);

  // Fetch paginated stock items for the selected branch
  const fetchStockLevels = useCallback(async () => {
    if (!selectedBranchId) return;
    setLoadingStock(true);
    try {
      const from = (stockPage - 1) * stockPageSize;
      const to = from + stockPageSize - 1;

      let query = supabase
        .from('products')
        .select(`
          id,
          sku,
          product_code,
          name,
          category,
          purchase_price,
          sale_price
        `, { count: 'exact' });

      if (searchQuery.trim()) {
        const cleanQuery = searchQuery.trim().replace(/[%_]/g, '');
        query = query.or(`name.ilike.%${cleanQuery}%,product_code.ilike.%${cleanQuery}%,sku.ilike.%${cleanQuery}%,category.ilike.%${cleanQuery}%`);
      }

      const { data: prodData, count, error: prodError } = await query
        .order('name', { ascending: true })
        .range(from, to);

      if (prodError) throw prodError;
      setStockTotalCount(count || 0);

      const prods = prodData || [];
      if (prods.length === 0) {
        setStockItems([]);
        return;
      }

      // Fetch inventory quantities and branch prices for these products in selected branch
      const prodIds = prods.map((p) => p.id);
      let { data: invData, error: invError } = await supabase
        .from('inventory')
        .select('id, product_id, quantity, min_stock_level, purchase_price, sale_price')
        .eq('branch_id', selectedBranchId)
        .in('product_id', prodIds);

      if (invError) {
        const fallbackRes = await supabase
          .from('inventory')
          .select('id, product_id, quantity, min_stock_level')
          .eq('branch_id', selectedBranchId)
          .in('product_id', prodIds);

        if (fallbackRes.error) throw fallbackRes.error;
        invData = fallbackRes.data;
      }

      const invMap = {};
      (invData || []).forEach((inv) => {
        invMap[inv.product_id] = inv;
      });

      const merged = prods.map((p) => {
        const inv = invMap[p.id];
        const qty = inv ? inv.quantity : 0;
        const minStock = inv?.min_stock_level ?? 5;
        const isOutOfStock = qty <= 0;
        const isLowStock = !isOutOfStock && qty <= minStock;

        const effectiveBuyPrice = (inv?.purchase_price !== null && inv?.purchase_price !== undefined) 
          ? inv.purchase_price 
          : p.purchase_price;
        const hasCustomBuy = (inv?.purchase_price !== null && inv?.purchase_price !== undefined);

        const effectiveSalePrice = (inv?.sale_price !== null && inv?.sale_price !== undefined)
          ? inv.sale_price 
          : p.sale_price;
        const hasCustomSale = (inv?.sale_price !== null && inv?.sale_price !== undefined);

        return {
          ...p,
          inventoryId: inv?.id,
          quantity: qty,
          minStock,
          isOutOfStock,
          isLowStock,
          effectiveBuyPrice,
          hasCustomBuy,
          effectiveSalePrice,
          hasCustomSale,
        };
      });

      setStockItems(merged);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load stock levels.', 'error');
    } finally {
      setLoadingStock(false);
    }
  }, [selectedBranchId, stockPage, stockPageSize, searchQuery]);

  // Fetch paginated movement logs for the selected branch
  const fetchMovements = useCallback(async () => {
    if (!selectedBranchId) return;
    setLoadingMovements(true);
    try {
      const from = (logsPage - 1) * logsPageSize;
      const to = from + logsPageSize - 1;

      let query = supabase
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
        `, { count: 'exact' })
        .eq('branch_id', selectedBranchId);

      if (movementFilter !== 'all') {
        query = query.eq('type', movementFilter);
      }

      if (searchQuery.trim()) {
        const cleanQuery = searchQuery.trim().replace(/[%_]/g, '');
        query = query.or(`description.ilike.%${cleanQuery}%`);
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setMovements(data || []);
      setLogsTotalCount(count || 0);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load stock movement ledger.', 'error');
    } finally {
      setLoadingMovements(false);
    }
  }, [selectedBranchId, logsPage, logsPageSize, movementFilter, searchQuery]);

  // Reset page when search or filters change
  useEffect(() => {
    setStockPage(1);
    setLogsPage(1);
  }, [searchQuery, movementFilter, selectedBranchId]);

  useEffect(() => {
    if (activeTab === 'stock') {
      fetchStockLevels();
    } else {
      fetchMovements();
    }
  }, [activeTab, fetchStockLevels, fetchMovements]);

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

    setSubmittingAdjustment(true);
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
      setSubmittingAdjustment(false);
    }
  };

  const selectedBranchObj = branches.find((b) => b.id === selectedBranchId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div className="top-bar">
        <div className="page-title-group">
          <h1>Inventory</h1>
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
                Showing stock for <strong>{selectedBranchObj?.name || 'Branch'}</strong>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="table-container hide-on-mobile">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>SL</th>
                    <th style={{ width: '140px' }}>Product Code</th>
                    <th>Product Name</th>
                    <th style={{ width: '130px' }}>Category</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Buy Price</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Sell Price</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Stock In Hand</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingStock ? (
                    <TableLoading colSpan={8} message={`Fetching stock for ${selectedBranchObj?.name || 'branch'}...`} />
                  ) : stockItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        No product stock records found.
                      </td>
                    </tr>
                  ) : (
                    stockItems.map((item, index) => (
                      <tr key={item.id}>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          {(stockPage - 1) * stockPageSize + index + 1}
                        </td>
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
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          <div>৳{formatAmount(item.effectiveBuyPrice)}</div>
                          {item.hasCustomBuy && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                              Branch Custom
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success-text)' }}>
                          <div>৳{formatAmount(item.effectiveSalePrice)}</div>
                          {item.hasCustomSale && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                              Branch Custom
                            </span>
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

            {/* Mobile Card List View for Stock */}
            <div className="hide-on-desktop" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem' }}>
              {loadingStock ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Loading inventory...
                </div>
              ) : stockItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No product stock records found.
                </div>
              ) : (
                stockItems.map((item, index) => {
                  const rowNumber = (stockPage - 1) * stockPageSize + index + 1;

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.55rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      {/* Header: SL Badge, Name, Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.45rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <span style={{
                            backgroundColor: '#e0f2fe',
                            color: '#0369a1',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                          }}>
                            #{rowNumber}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {item.name || '—'}
                          </span>
                        </div>
                        {item.isOutOfStock ? (
                          <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', fontSize: '0.7rem' }}>
                            Out of Stock
                          </span>
                        ) : item.isLowStock ? (
                          <span className="badge badge-unpaid" style={{ fontSize: '0.7rem' }}>
                            <AlertTriangle size={11} />
                            <span style={{ marginLeft: '0.2rem' }}>Low Stock</span>
                          </span>
                        ) : (
                          <span className="badge badge-paid" style={{ fontSize: '0.7rem' }}>
                            In Stock
                          </span>
                        )}
                      </div>

                      {/* Code & Category */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)', backgroundColor: '#f0f9ff', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                          Code: {item.product_code || item.sku || '—'}
                        </span>
                        {item.category && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            📂 {item.category}
                          </span>
                        )}
                      </div>

                      {/* Financials & Stock Strip */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#f8fafc',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid #f1f5f9',
                        fontSize: '0.82rem',
                      }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Cost Price</span>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            ৳{formatAmount(item.effectiveBuyPrice)}
                          </span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Sell Price</span>
                          <span style={{ fontWeight: 700, color: 'var(--success-text)', fontSize: '0.88rem' }}>
                            ৳{formatAmount(item.effectiveSalePrice)}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Stock Qty</span>
                          <span style={{
                            fontWeight: 800,
                            fontSize: '1rem',
                            color: item.isOutOfStock ? 'var(--text-muted)' : item.isLowStock ? 'var(--danger-text)' : 'var(--text-primary)'
                          }}>
                            {item.quantity}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <Pagination 
              page={stockPage}
              totalCount={stockTotalCount}
              pageSize={stockPageSize}
              onPageChange={setStockPage}
              onPageSizeChange={(newSize) => {
                setStockPageSize(newSize);
                setStockPage(1);
              }}
            />
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
                placeholder="Search movements by description..."
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

          {/* Desktop Table View */}
          <div className="table-container hide-on-mobile">
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
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No stock movements recorded for this branch.
                    </td>
                  </tr>
                ) : (
                  movements.map((m, index) => {
                    const isIn = ['purchase', 'adjustment_in', 'transfer_in'].includes(m.type);
                    return (
                      <tr key={m.id}>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          {(logsPage - 1) * logsPageSize + index + 1}
                        </td>
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

          {/* Mobile Card List View for Movements */}
          <div className="hide-on-desktop" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem' }}>
            {loadingMovements ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Loading movement ledger...
              </div>
            ) : movements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                No stock movements recorded for this branch.
              </div>
            ) : (
              movements.map((m, index) => {
                const isIn = ['purchase', 'adjustment_in', 'transfer_in'].includes(m.type);
                const rowNumber = (logsPage - 1) * logsPageSize + index + 1;

                return (
                  <div
                    key={m.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.55rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* Header: SL Badge, Product Name, Type Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.45rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span style={{
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                        }}>
                          #{rowNumber}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                          {m.products?.name || 'Unknown Product'}
                        </span>
                      </div>
                      <span className={`badge ${isIn ? 'badge-paid' : 'badge-unpaid'}`} style={{ fontSize: '0.7rem' }}>
                        {isIn ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        <span style={{ marginLeft: '0.2rem' }}>{m.type.replace('_', ' ')}</span>
                      </span>
                    </div>

                    {/* Code & Timestamp */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                      <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        Code: {m.products?.sku || m.products?.product_code || '—'}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {new Date(m.created_at).toLocaleString()}
                      </span>
                    </div>

                    {/* Description */}
                    {m.description && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {m.description}
                      </div>
                    )}

                    {/* Quantity & Logged By Strip */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: '#f8fafc',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #f1f5f9',
                      fontSize: '0.82rem',
                    }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        👤 {m.profiles?.full_name || 'System'}
                      </span>
                      <span style={{
                        fontWeight: 800,
                        fontSize: '1rem',
                        color: isIn ? 'var(--success-text)' : 'var(--danger-text)'
                      }}>
                        {isIn ? `+${m.quantity}` : `-${m.quantity}`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Pagination 
            page={logsPage}
            totalCount={logsTotalCount}
            pageSize={logsPageSize}
            onPageChange={setLogsPage}
            onPageSizeChange={(newSize) => {
              setLogsPageSize(newSize);
              setLogsPage(1);
            }}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* MANUAL ADJUSTMENT MODAL */}
      {/* ==================================================================== */}
      {showAdjustmentModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', width: '95vw' }}>
            <div className="modal-header">
              <h3 className="modal-title">Stock Adjustment ({selectedBranchObj?.name})</h3>
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
                    <option value="">-- Select Product --</option>
                    {allProductsForAdjustment.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.product_code || p.sku} - {p.name || 'Unnamed'}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Type *</label>
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
                  <label>Reason *</label>
                  <textarea
                    className="input-control"
                    style={{ minHeight: '65px' }}
                    placeholder="Enter reason for adjustment..."
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
                <button type="submit" className="btn btn-primary" disabled={submittingAdjustment}>
                  {submittingAdjustment ? 'Saving...' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
