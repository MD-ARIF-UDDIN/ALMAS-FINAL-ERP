import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  RotateCcw,
  RefreshCw,
  Search,
  Plus,
  Printer,
  FileText,
  DollarSign,
  Package,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShoppingCart,
  Trash2,
  Filter,
} from 'lucide-react';
import { TableLoading, LoadingBlock } from '../components/TableLoading';
import Pagination from '../components/Pagination';

export default function Returns({ userProfile, branches, addToast }) {
  const [activeBranchId, setActiveBranchId] = useState(() => {
    if (userProfile?.role === 'owner') {
      const factoryBranch = branches.find((b) => b.is_factory || b.name?.toLowerCase().includes('factory'));
      return factoryBranch ? factoryBranch.id : (branches.length > 0 ? branches[0].id : '');
    }
    return userProfile?.branch_id || (branches.length > 0 ? branches[0].id : '');
  });

  const [loading, setLoading] = useState(true);
  const [returnMovements, setReturnMovements] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // New Return / Exchange Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1: Select Invoice, 2: Select Return Items & Resolution
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceSearchResults, setInvoiceSearchResults] = useState([]);
  const [searchingInvoices, setSearchingInvoices] = useState(false);

  // Return items state
  const [returnItems, setReturnItems] = useState([]);
  const [loadingInvoiceItems, setLoadingInvoiceItems] = useState(false);

  // Resolution mode: 'refund' vs 'exchange'
  const [resolutionMode, setResolutionMode] = useState('refund');
  const [refundMethod, setRefundMethod] = useState('deduct_due');
  const [returnReason, setReturnReason] = useState('Customer Exchange / Return');
  const [returnNotes, setReturnNotes] = useState('');

  // Exchange replacement items state
  const [branchCatalog, setBranchCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [exchangeCart, setExchangeCart] = useState([]);
  const [exchangePaymentMethod, setExchangePaymentMethod] = useState('cash');

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Print Preview state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [activeVoucher, setActiveVoucher] = useState(null);

  const showMessage = (text, type = 'info') => {
    if (addToast) addToast(text, type);
  };

  const activeBranch = branches.find((b) => b.id === activeBranchId);

  // Fetch Return / Exchange History from inventory_movements
  const fetchReturnHistory = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('inventory_movements')
        .select(`
          id,
          branch_id,
          product_id,
          type,
          quantity,
          description,
          created_at,
          products (
            id,
            name,
            sku,
            sale_price
          ),
          branches (
            id,
            name
          )
        `, { count: 'exact' })
        .or('description.ilike.%[CRN-%,description.ilike.%[EXC-%,description.ilike.%Customer Return%,description.ilike.%Customer Exchange%')
        .order('created_at', { ascending: false });

      if (activeBranchId && userProfile?.role !== 'owner') {
        query = query.eq('branch_id', activeBranchId);
      } else if (activeBranchId) {
        query = query.eq('branch_id', activeBranchId);
      }

      if (searchQuery.trim()) {
        query = query.ilike('description', `%${searchQuery.trim()}%`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setReturnMovements(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching return movements:', err);
      showMessage('Failed to load return records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, userProfile, searchQuery, currentPage, pageSize]);

  useEffect(() => {
    fetchReturnHistory();
  }, [fetchReturnHistory]);

  // Search Invoices for Return Modal
  const searchInvoices = async (queryText) => {
    setSearchingInvoices(true);
    try {
      let query = supabase
        .from('sales')
        .select(`
          id,
          invoice_number,
          sale_date,
          net_amount,
          paid_amount,
          payment_status,
          branch_id,
          notes,
          contacts (
            id,
            name,
            phone,
            address
          )
        `)
        .order('sale_date', { ascending: false })
        .limit(20);

      if (activeBranchId) {
        query = query.eq('branch_id', activeBranchId);
      }

      if (queryText.trim()) {
        query = query.or(`invoice_number.ilike.%${queryText.trim()}%,notes.ilike.%${queryText.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInvoiceSearchResults(data || []);
    } catch (err) {
      console.error('Error searching invoices:', err);
    } finally {
      setSearchingInvoices(false);
    }
  };

  // Select an invoice and fetch its items
  const handleSelectInvoice = async (invoice) => {
    setSelectedInvoice(invoice);
    setLoadingInvoiceItems(true);
    setModalStep(2);

    const due = Math.max(0, (invoice.net_amount || 0) - (invoice.paid_amount || 0));
    setRefundMethod(due > 0.01 ? 'deduct_due' : 'cash');

    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          id,
          product_id,
          quantity,
          unit_price,
          total_price,
          products (
            id,
            name,
            sku,
            sale_price
          )
        `)
        .eq('sale_id', invoice.id);

      if (error) throw error;

      setReturnItems(
        (data || []).map((it) => ({
          ...it,
          returnQty: 0,
        }))
      );
    } catch (err) {
      console.error('Error fetching invoice items:', err);
      showMessage('Failed to load invoice items.', 'error');
    } finally {
      setLoadingInvoiceItems(false);
    }

    // Also load branch inventory catalog for exchange
    fetchBranchCatalog(invoice.branch_id || activeBranchId);
  };

  // Fetch catalog for exchange replacement items
  const fetchBranchCatalog = async (branchId) => {
    setLoadingCatalog(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          id,
          product_id,
          quantity,
          products (
            id,
            name,
            sku,
            sale_price
          )
        `)
        .eq('branch_id', branchId || activeBranchId)
        .gt('quantity', 0);

      if (error) throw error;
      setBranchCatalog(data || []);
    } catch (err) {
      console.error('Error fetching catalog:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Add item to exchange cart
  const addToExchangeCart = (item) => {
    const existing = exchangeCart.find((c) => c.product_id === item.product_id);
    if (existing) {
      if (existing.quantity >= item.quantity) {
        showMessage(`Cannot exceed available stock of ${item.quantity}.`, 'error');
        return;
      }
      setExchangeCart(
        exchangeCart.map((c) =>
          c.product_id === item.product_id ? { ...c, quantity: c.quantity + 1 } : c
        )
      );
    } else {
      setExchangeCart([
        ...exchangeCart,
        {
          product_id: item.product_id,
          product: item.products,
          quantity: 1,
          unit_price: item.products?.sale_price || 0,
          maxStock: item.quantity,
        },
      ]);
    }
  };

  // Calculations
  const totalReturnCredit = returnItems.reduce((sum, it) => {
    const retQty = parseInt(it.returnQty || 0, 10);
    const price = parseFloat(it.unit_price || 0);
    return sum + (retQty * price);
  }, 0);

  const totalExchangeValue = exchangeCart.reduce((sum, it) => {
    const qty = parseFloat(it.quantity || 0);
    const price = parseFloat(it.unit_price || 0);
    return sum + (qty * price);
  }, 0);

  const exchangeDifference = totalExchangeValue - totalReturnCredit; // > 0 means customer pays, < 0 means store refunds

  // Process Return & Restock / Exchange
  const handleSubmitReturnOrExchange = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const itemsToReturn = returnItems.filter((it) => parseInt(it.returnQty || 0, 10) > 0);
    if (itemsToReturn.length === 0) {
      showMessage('Please enter a return quantity of at least 1 for one or more items.', 'error');
      return;
    }

    // Validate return quantities
    for (const it of itemsToReturn) {
      const rQty = parseInt(it.returnQty, 10);
      if (rQty > it.quantity) {
        showMessage(`Return quantity for ${it.products?.name} cannot exceed original sold quantity (${it.quantity}).`, 'error');
        return;
      }
    }

    if (resolutionMode === 'exchange' && exchangeCart.length === 0) {
      showMessage('Please select at least one replacement product to exchange.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetBranchId = selectedInvoice.branch_id || activeBranchId;
      const voucherPrefix = resolutionMode === 'exchange' ? 'EXC' : 'CRN';
      const voucherNumber = `${voucherPrefix}-${Date.now().toString().slice(-6)}`;
      const timestamp = new Date().toISOString();

      // 1. RESTOCK RETURNED GOODS INTO INVENTORY (+Qty)
      for (const it of itemsToReturn) {
        const rQty = parseInt(it.returnQty, 10);
        const prodId = it.product_id;

        const { data: currentInv } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('branch_id', targetBranchId)
          .eq('product_id', prodId)
          .maybeSingle();

        if (currentInv) {
          await supabase
            .from('inventory')
            .update({
              quantity: (currentInv.quantity || 0) + rQty,
              updated_at: timestamp,
            })
            .eq('id', currentInv.id);
        } else {
          await supabase.from('inventory').insert([{
            branch_id: targetBranchId,
            product_id: prodId,
            quantity: rQty,
            updated_at: timestamp,
          }]);
        }

        // Log movement audit
        await supabase.from('inventory_movements').insert([{
          branch_id: targetBranchId,
          product_id: prodId,
          type: 'adjustment_in',
          quantity: rQty,
          description: `${resolutionMode === 'exchange' ? 'Exchange Return' : 'Customer Return'} [${voucherNumber}]: Inv #${selectedInvoice.invoice_number || selectedInvoice.id.substring(0, 8)} (${returnReason})`,
          created_by: userProfile.id,
        }]);
      }

      // 2. IF EXCHANGE: DEDUCT REPLACEMENT ITEMS FROM INVENTORY (-Qty)
      if (resolutionMode === 'exchange') {
        for (const it of exchangeCart) {
          const eQty = parseFloat(it.quantity);
          const prodId = it.product_id;

          const { data: currentInv } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('branch_id', targetBranchId)
            .eq('product_id', prodId)
            .maybeSingle();

          if (currentInv) {
            await supabase
              .from('inventory')
              .update({
                quantity: Math.max(0, (currentInv.quantity || 0) - eQty),
                updated_at: timestamp,
              })
              .eq('id', currentInv.id);
          }

          // Log movement audit for outgoing replacement item
          await supabase.from('inventory_movements').insert([{
            branch_id: targetBranchId,
            product_id: prodId,
            type: 'adjustment_out',
            quantity: Math.max(1, Math.round(eQty)),
            description: `Exchange Replacement Out [${voucherNumber}]: Inv #${selectedInvoice.invoice_number || selectedInvoice.id.substring(0, 8)}`,
            created_by: userProfile.id,
          }]);
        }
      }

      // 3. FINANCIAL ADJUSTMENTS
      const originalNet = parseFloat(selectedInvoice.net_amount || 0);
      const originalPaid = parseFloat(selectedInvoice.paid_amount || 0);
      const currentDue = Math.max(0, originalNet - originalPaid);

      if (resolutionMode === 'refund') {
        // Direct Refund or Due Deduction
        let newNet = Math.max(0, originalNet - totalReturnCredit);
        let newPaid = originalPaid;
        let newStatus = selectedInvoice.payment_status;

        if (refundMethod === 'deduct_due') {
          const newDue = Math.max(0, currentDue - totalReturnCredit);
          newStatus = newDue <= 0.01 ? 'paid' : 'partial';
        } else {
          // Cash drawer payout
          await supabase.from('cash_ledger').insert([{
            branch_id: targetBranchId,
            amount_in: 0,
            amount_out: totalReturnCredit,
            reference_id: selectedInvoice.id,
            description: `Sales Return Refund [${voucherNumber}]: Inv #${selectedInvoice.invoice_number || selectedInvoice.id.substring(0, 8)} to ${selectedInvoice.contacts?.name || 'Customer'} (${refundMethod})`,
            transaction_date: timestamp,
            created_by: userProfile?.id,
          }]);

          newPaid = Math.max(0, originalPaid - totalReturnCredit);
          const newDue = Math.max(0, newNet - newPaid);
          newStatus = newDue <= 0.01 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
        }

        const noteEntry = `[${voucherNumber}: Return credit ৳${totalReturnCredit.toFixed(2)} (${refundMethod}) - ${returnReason}]`;
        const updatedNotes = selectedInvoice.notes ? `${selectedInvoice.notes}\n${noteEntry}` : noteEntry;

        await supabase.from('sales').update({
          net_amount: newNet,
          paid_amount: newPaid,
          payment_status: newStatus,
          notes: updatedNotes,
        }).eq('id', selectedInvoice.id);

      } else {
        // Exchange Financial Settlement
        if (exchangeDifference > 0) {
          // Customer pays extra difference
          await supabase.from('cash_ledger').insert([{
            branch_id: targetBranchId,
            amount_in: exchangeDifference,
            amount_out: 0,
            reference_id: selectedInvoice.id,
            description: `Product Exchange Extra Payment [${voucherNumber}]: Inv #${selectedInvoice.invoice_number || selectedInvoice.id.substring(0, 8)} from ${selectedInvoice.contacts?.name || 'Customer'} (${exchangePaymentMethod})`,
            transaction_date: timestamp,
            created_by: userProfile?.id,
          }]);
        } else if (exchangeDifference < 0) {
          // Store refunds difference
          const refundDiff = Math.abs(exchangeDifference);
          if (refundMethod !== 'deduct_due') {
            await supabase.from('cash_ledger').insert([{
              branch_id: targetBranchId,
              amount_in: 0,
              amount_out: refundDiff,
              reference_id: selectedInvoice.id,
              description: `Product Exchange Refund Difference [${voucherNumber}]: Inv #${selectedInvoice.invoice_number || selectedInvoice.id.substring(0, 8)} to ${selectedInvoice.contacts?.name || 'Customer'} (${refundMethod})`,
              transaction_date: timestamp,
              created_by: userProfile?.id,
            }]);
          }
        }

        const noteEntry = `[${voucherNumber}: Product Exchange - Returned ৳${totalReturnCredit.toFixed(2)}, Taken ৳${totalExchangeValue.toFixed(2)}, Net diff: ৳${exchangeDifference.toFixed(2)}]`;
        const updatedNotes = selectedInvoice.notes ? `${selectedInvoice.notes}\n${noteEntry}` : noteEntry;

        await supabase.from('sales').update({
          notes: updatedNotes,
        }).eq('id', selectedInvoice.id);
      }

      // Setup Voucher Preview
      setActiveVoucher({
        voucherNumber,
        type: resolutionMode,
        date: timestamp,
        invoice: selectedInvoice,
        branch: branches.find((b) => b.id === targetBranchId),
        returnedItems: itemsToReturn,
        exchangeItems: resolutionMode === 'exchange' ? exchangeCart : [],
        totalReturnCredit,
        totalExchangeValue,
        exchangeDifference,
        refundMethod,
        exchangePaymentMethod,
        returnReason,
        returnNotes,
      });

      setShowModal(false);
      setShowPrintModal(true);
      fetchReturnHistory();
      showMessage(`Return / Exchange [${voucherNumber}] processed successfully!`, 'success');
    } catch (err) {
      console.error('Error processing return/exchange:', err);
      showMessage(err.message || 'Failed to process transaction.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenNewModal = () => {
    setSelectedInvoice(null);
    setInvoiceSearch('');
    setInvoiceSearchResults([]);
    setReturnItems([]);
    setExchangeCart([]);
    setModalStep(1);
    setResolutionMode('refund');
    setReturnReason('Customer Exchange / Return');
    setReturnNotes('');
    setShowModal(true);
    searchInvoices('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* TOP ACTION BAR */}
      <div className="no-print top-bar">
        <div className="page-title-group">
          <h1>eReturn — Sales Returns & Exchanges</h1>
        </div>
        <div className="top-bar-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {userProfile?.role === 'owner' && (
            <div className="form-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ whiteSpace: 'nowrap' }}>Active Branch:</label>
              <select
                className="input-control"
                value={activeBranchId}
                onChange={(e) => setActiveBranchId(e.target.value)}
                style={{ width: '220px' }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.is_factory ? `🏭 ${b.name}` : `🏪 ${b.name}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button className="btn btn-primary" onClick={handleOpenNewModal}>
            <Plus size={16} />
            <span>New Return / Exchange</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
      }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(217, 119, 6, 0.1)', color: 'var(--warning-text, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RotateCcw size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Restocked Logs</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{totalCount}</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Active Resolution Modes</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Refund & Product Swap</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-text, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Stock Restocking</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Automatic Physical Sync</div>
          </div>
        </div>
      </div>

      {/* RETURNS & EXCHANGES HISTORY TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '1rem 1.25rem' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Returns & Restock Movements Ledger</h3>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-control"
              style={{ paddingLeft: '2.25rem', padding: '0.35rem 0.6rem 0.35rem 2.25rem', fontSize: '0.82rem' }}
              placeholder="Search by voucher # or invoice..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="table-container" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>SL</th>
                <th>Date & Time</th>
                <th>Product Description</th>
                {userProfile?.role === 'owner' && <th>Branch</th>}
                <th style={{ textAlign: 'center' }}>Restock Qty</th>
                <th>Movement Type</th>
                <th>Voucher / Description Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoading colSpan={userProfile?.role === 'owner' ? 7 : 6} message="Loading return movements..." />
              ) : returnMovements.length === 0 ? (
                <tr>
                  <td colSpan={userProfile?.role === 'owner' ? 7 : 6} style={{ textAlign: 'center', padding: '2.5rem' }}>
                    No return or exchange movements recorded yet. Click <strong>"New Return / Exchange"</strong> to begin.
                  </td>
                </tr>
              ) : (
                returnMovements.map((mov, index) => {
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;
                  const isExchange = mov.description?.includes('Exchange');

                  return (
                    <tr key={mov.id}>
                      <td>{rowNumber}</td>
                      <td>{new Date(mov.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{mov.products?.name || 'Unknown Product'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          SKU: {mov.products?.sku || 'N/A'}
                        </div>
                      </td>
                      {userProfile?.role === 'owner' && (
                        <td style={{ fontWeight: 600 }}>{mov.branches?.name || 'Factory'}</td>
                      )}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: mov.quantity > 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                        {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                      </td>
                      <td>
                        <span className={`badge badge-${isExchange ? 'info' : 'warning'}`}>
                          {isExchange ? '🔄 Exchange' : '📦 Return Restock'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {mov.description}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* NEW RETURN / EXCHANGE MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-xl" style={{ maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RotateCcw size={18} style={{ color: 'var(--warning-text, #d97706)' }} />
                  {modalStep === 1 ? 'Step 1: Select Sales Invoice' : 'Step 2: Configure Return & Exchange'}
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {modalStep === 1 ? 'Search and select the customer invoice to process return against' : `Invoice #${selectedInvoice?.invoice_number} • Customer: ${selectedInvoice?.contacts?.name || 'Walk-in'}`}
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowModal(false)}
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>

            {modalStep === 1 ? (
              /* STEP 1: SELECT INVOICE */
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input-control"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="Search by invoice number (e.g. INV-1234) or customer notes..."
                    value={invoiceSearch}
                    onChange={(e) => {
                      setInvoiceSearch(e.target.value);
                      searchInvoices(e.target.value);
                    }}
                  />
                </div>

                <div className="table-container" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Date</th>
                        <th>Buyer Name</th>
                        <th>Net Value</th>
                        <th>Paid</th>
                        <th>Due</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchingInvoices ? (
                        <TableLoading colSpan={7} message="Searching invoices..." />
                      ) : invoiceSearchResults.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                            No matching invoices found.
                          </td>
                        </tr>
                      ) : (
                        invoiceSearchResults.map((inv) => {
                          const due = Math.max(0, (inv.net_amount || 0) - (inv.paid_amount || 0));
                          return (
                            <tr key={inv.id}>
                              <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                {inv.invoice_number || `INV#${inv.id.substring(0, 8).toUpperCase()}`}
                              </td>
                              <td>{new Date(inv.sale_date).toLocaleDateString()}</td>
                              <td style={{ fontWeight: 600 }}>{inv.contacts?.name || 'Walk-in Customer'}</td>
                              <td style={{ fontWeight: 600 }}>৳{(inv.net_amount || 0).toFixed(2)}</td>
                              <td style={{ color: 'var(--success-text)' }}>৳{(inv.paid_amount || 0).toFixed(2)}</td>
                              <td style={{ fontWeight: 700, color: due > 0 ? 'var(--danger-text)' : 'inherit' }}>৳{due.toFixed(2)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleSelectInvoice(inv)}
                                >
                                  <span>Select</span>
                                  <ArrowRight size={13} style={{ marginLeft: '0.25rem' }} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* STEP 2: CONFIGURE RETURN & RESOLUTION */
              <form onSubmit={handleSubmitReturnOrExchange} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', margin: 0 }}>
                <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* INVOICE SUMMARY BANNER */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.85rem',
                  }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Date</div>
                      <div style={{ fontWeight: 600 }}>{new Date(selectedInvoice.sale_date).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Bill</div>
                      <div style={{ fontWeight: 700 }}>৳{(selectedInvoice.net_amount || 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Paid</div>
                      <div style={{ fontWeight: 700, color: 'var(--success-text)' }}>৳{(selectedInvoice.paid_amount || 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Due</div>
                      <div style={{ fontWeight: 700, color: (selectedInvoice.net_amount - selectedInvoice.paid_amount) > 0 ? 'var(--danger-text)' : 'inherit' }}>
                        ৳{Math.max(0, (selectedInvoice.net_amount || 0) - (selectedInvoice.paid_amount || 0)).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* 1. SELECT RETURN ITEMS */}
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                      Items to Return:
                    </label>
                    {loadingInvoiceItems ? (
                      <LoadingBlock message="Loading items..." />
                    ) : (
                      <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th style={{ textAlign: 'center', width: '90px' }}>Sold</th>
                              <th style={{ textAlign: 'right', width: '100px' }}>Price</th>
                              <th style={{ textAlign: 'center', width: '130px' }}>Return Qty</th>
                              <th style={{ textAlign: 'right', width: '110px' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {returnItems.map((item, idx) => {
                              const retQty = parseInt(item.returnQty || 0, 10);
                              const price = parseFloat(item.unit_price || 0);
                              const lineCredit = retQty * price;

                              return (
                                <tr key={item.id || idx}>
                                  <td>
                                    <div style={{ fontWeight: 600 }}>{item.products?.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKU: {item.products?.sku || 'N/A'}</div>
                                  </td>
                                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                                  <td style={{ textAlign: 'right' }}>৳{price.toFixed(2)}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                                      <input
                                        type="number"
                                        min="0"
                                        max={item.quantity}
                                        value={item.returnQty === '' ? '' : item.returnQty}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setReturnItems((prev) =>
                                            prev.map((it, i) => {
                                              if (i === idx) {
                                                if (val === '') return { ...it, returnQty: '' };
                                                const parsed = parseInt(val, 10);
                                                if (isNaN(parsed) || parsed < 0) return { ...it, returnQty: 0 };
                                                if (parsed > it.quantity) return { ...it, returnQty: it.quantity };
                                                return { ...it, returnQty: parsed };
                                              }
                                              return it;
                                            })
                                          );
                                        }}
                                        className="input-control"
                                        style={{ width: '65px', textAlign: 'center', padding: '0.25rem 0.4rem', fontSize: '0.85rem' }}
                                      />
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}
                                        onClick={() => {
                                          setReturnItems((prev) =>
                                            prev.map((it, i) => (i === idx ? { ...it, returnQty: it.quantity } : it))
                                          );
                                        }}
                                      >
                                        All
                                      </button>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: lineCredit > 0 ? 'var(--warning-text, #d97706)' : 'inherit' }}>
                                    ৳{lineCredit.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* 2. CHOOSE RESOLUTION MODE */}
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                      Option:
                    </label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <div
                        onClick={() => setResolutionMode('refund')}
                        style={{
                          flex: 1,
                          minWidth: '200px',
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: `2px solid ${resolutionMode === 'refund' ? 'var(--primary-color)' : 'var(--border-color)'}`,
                          background: resolutionMode === 'refund' ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                        }}
                      >
                        <DollarSign size={22} style={{ color: 'var(--primary-color)' }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Refund / Credit</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Money back or deduct from due</div>
                        </div>
                      </div>

                      <div
                        onClick={() => setResolutionMode('exchange')}
                        style={{
                          flex: 1,
                          minWidth: '200px',
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: `2px solid ${resolutionMode === 'exchange' ? 'var(--primary-color)' : 'var(--border-color)'}`,
                          background: resolutionMode === 'exchange' ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                        }}
                      >
                        <RefreshCw size={22} style={{ color: 'var(--primary-color)' }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Product Exchange</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Replace with new items</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. EXCHANGE PRODUCT PICKER (IF EXCHANGE MODE) */}
                  {resolutionMode === 'exchange' && (
                    <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ShoppingCart size={15} />
                        Choose Replacement Products:
                      </div>

                      {/* Search replacement items */}
                      <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          className="input-control"
                          style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
                          placeholder="Search product name or SKU..."
                          value={catalogSearch}
                          onChange={(e) => setCatalogSearch(e.target.value)}
                        />
                      </div>

                      {/* Replacement catalog grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto' }}>
                        {branchCatalog
                          .filter((c) =>
                            c.products?.name?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                            c.products?.sku?.toLowerCase().includes(catalogSearch.toLowerCase())
                          )
                          .map((item) => (
                            <div
                              key={item.product_id}
                              onClick={() => addToExchangeCart(item)}
                              style={{
                                padding: '0.5rem 0.75rem',
                                background: 'var(--bg-card)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                              }}
                            >
                              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.products?.name}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                <span>৳{item.products?.sale_price?.toFixed(2)}</span>
                                <span>Stock: {item.quantity}</span>
                              </div>
                            </div>
                          ))}
                      </div>

                      {/* Selected Exchange Replacement Items Cart */}
                      {exchangeCart.length > 0 && (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>Selected Replacement Items:</div>
                          <div className="table-container" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                            <table>
                              <thead>
                                <tr>
                                  <th>Item</th>
                                  <th style={{ width: '90px', textAlign: 'center' }}>Qty</th>
                                  <th style={{ width: '100px', textAlign: 'right' }}>Price</th>
                                  <th style={{ width: '110px', textAlign: 'right' }}>Total</th>
                                  <th style={{ width: '40px' }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {exchangeCart.map((it, idx) => (
                                  <tr key={it.product_id}>
                                    <td style={{ fontWeight: 600 }}>{it.product?.name}</td>
                                    <td style={{ textAlign: 'center' }}>
                                      <input
                                        type="number"
                                        min="1"
                                        max={it.maxStock}
                                        value={it.quantity}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) || 1;
                                          setExchangeCart(
                                            exchangeCart.map((c, i) => (i === idx ? { ...c, quantity: Math.min(val, it.maxStock) } : c))
                                          );
                                        }}
                                        className="input-control"
                                        style={{ width: '60px', textAlign: 'center', padding: '0.2rem' }}
                                      />
                                    </td>
                                    <td style={{ textAlign: 'right' }}>৳{it.unit_price.toFixed(2)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{(it.quantity * it.unit_price).toFixed(2)}</td>
                                    <td>
                                      <button
                                        type="button"
                                        onClick={() => setExchangeCart(exchangeCart.filter((_, i) => i !== idx))}
                                        style={{ background: 'none', border: 'none', color: 'var(--danger-text)', cursor: 'pointer' }}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. SETTLEMENT SUMMARY CALCULATION CARD */}
                  <div style={{
                    padding: '1rem',
                    background: resolutionMode === 'exchange' ? 'rgba(37, 99, 235, 0.05)' : 'rgba(217, 119, 6, 0.06)',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${resolutionMode === 'exchange' ? 'var(--primary-color)' : 'var(--warning-text, #d97706)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Total Return:</div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--warning-text, #d97706)' }}>
                        ৳{totalReturnCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    {resolutionMode === 'exchange' && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Total Replacement:</div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary-color)' }}>
                            ৳{totalExchangeValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Settlement:</div>
                          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: exchangeDifference > 0 ? 'var(--danger-text)' : (exchangeDifference < 0 ? 'var(--success-text)' : 'inherit') }}>
                            {exchangeDifference > 0 ? `Customer Pays: +৳${exchangeDifference.toFixed(2)}` : (exchangeDifference < 0 ? `Store Refunds: -৳${Math.abs(exchangeDifference).toFixed(2)}` : 'Even (৳0.00)')}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 5. SETTLEMENT DETAILS & REASONS */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {resolutionMode === 'refund' ? (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.85rem' }}>Refund Method</label>
                        <select
                          className="input-control"
                          value={refundMethod}
                          onChange={(e) => setRefundMethod(e.target.value)}
                        >
                          {(selectedInvoice.net_amount - selectedInvoice.paid_amount) > 0.01 && (
                            <option value="deduct_due">Deduct from Due</option>
                          )}
                          <option value="cash">Cash</option>
                          <option value="mobile_banking">bKash / Nagad</option>
                          <option value="bank">Bank Transfer</option>
                        </select>
                      </div>
                    ) : (
                      exchangeDifference > 0 ? (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.85rem' }}>Payment Method</label>
                          <select
                            className="input-control"
                            value={exchangePaymentMethod}
                            onChange={(e) => setExchangePaymentMethod(e.target.value)}
                          >
                            <option value="cash">Cash</option>
                            <option value="mobile_banking">bKash / Nagad</option>
                            <option value="bank">Bank Transfer</option>
                          </select>
                        </div>
                      ) : exchangeDifference < 0 ? (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.85rem' }}>Refund Method</label>
                          <select
                            className="input-control"
                            value={refundMethod}
                            onChange={(e) => setRefundMethod(e.target.value)}
                          >
                            <option value="cash">Cash</option>
                            <option value="mobile_banking">bKash / Nagad</option>
                            <option value="bank">Bank Transfer</option>
                            {(selectedInvoice.net_amount - selectedInvoice.paid_amount) > 0.01 && (
                              <option value="deduct_due">Deduct from Due</option>
                            )}
                          </select>
                        </div>
                      ) : null
                    )}

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.85rem' }}>Reason</label>
                      <select
                        className="input-control"
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                      >
                        <option value="Exchange / Return">Exchange / Return</option>
                        <option value="Damaged / Defect">Damaged / Defect</option>
                        <option value="Wrong Item / Color">Wrong Item / Color</option>
                        <option value="Excess Order">Excess Order</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.85rem' }}>Note (Optional)</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Add note..."
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                    />
                  </div>

                </div>

                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setModalStep(1)} disabled={isSubmitting}>
                    Back
                  </button>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={isSubmitting}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSubmitting || returnItems.every((it) => !parseInt(it.returnQty || 0, 10))}
                      style={{ fontWeight: 700 }}
                    >
                      {isSubmitting ? 'Processing...' : resolutionMode === 'exchange' ? 'Confirm Exchange' : 'Confirm Return'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* PRINT PREVIEW VOUCHER MODAL */}
      {showPrintModal && activeVoucher && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '820px', width: '90%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header no-print">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} style={{ color: 'var(--primary-color)' }} />
                {activeVoucher.type === 'exchange' ? 'Product Exchange Voucher' : 'Credit Note / Sales Return Receipt'}
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPrintModal(false)}
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: '1.5rem' }}>
              <div className="invoice-print-view" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
                
                {/* Header */}
                <div className="invoice-header">
                  <div className="invoice-company-details">
                    <div className="invoice-company-name">ALMAS ACCESSORIES</div>
                    <div>{activeVoucher.branch ? activeVoucher.branch.name : 'Main Factory Outlet'}</div>
                    {activeVoucher.branch?.phone && <div>Phone: {activeVoucher.branch.phone}</div>}
                    {activeVoucher.branch?.address && <div>Address: {activeVoucher.branch.address}</div>}
                  </div>
                  <div className="invoice-meta">
                    <div className="invoice-title" style={{ color: activeVoucher.type === 'exchange' ? '#2563eb' : '#b45309' }}>
                      {activeVoucher.type === 'exchange' ? 'EXCHANGE VOUCHER' : 'CREDIT NOTE'}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {activeVoucher.voucherNumber}
                    </div>
                    <div>Date: {new Date(activeVoucher.date).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Ref Inv: <strong>{activeVoucher.invoice.invoice_number || `INV#${activeVoucher.invoice.id.substring(0, 8).toUpperCase()}`}</strong>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="invoice-details-grid">
                  <div className="invoice-bill-to">
                    <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Customer Details:</div>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{activeVoucher.invoice.contacts?.name || 'Walk-in Customer'}</div>
                    {activeVoucher.invoice.contacts?.phone && <div>Phone: {activeVoucher.invoice.contacts.phone}</div>}
                    {activeVoucher.invoice.contacts?.address && <div>Address: {activeVoucher.invoice.contacts.address}</div>}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.88rem' }}>
                    <div style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Resolution Info</div>
                    <div>Type: <strong>{activeVoucher.type === 'exchange' ? 'Product Swap (Exchange)' : 'Direct Return (Credit Note)'}</strong></div>
                    <div>Reason: <strong>{activeVoucher.returnReason}</strong></div>
                    {activeVoucher.returnNotes && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Note: {activeVoucher.returnNotes}</div>}
                  </div>
                </div>

                {/* Returned Items Table */}
                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem', color: '#b45309' }}>
                    📦 Goods Returned (Restocked to Inventory):
                  </div>
                  <table className="invoice-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>SL</th>
                        <th>Product / Item Description</th>
                        <th style={{ textAlign: 'center', width: '90px' }}>Return Qty</th>
                        <th style={{ textAlign: 'right', width: '110px' }}>Unit Price</th>
                        <th style={{ textAlign: 'right', width: '130px' }}>Credit Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeVoucher.returnedItems.map((item, index) => {
                        const rQty = parseInt(item.returnQty || 0, 10);
                        const price = parseFloat(item.unit_price || 0);
                        return (
                          <tr key={item.id || index}>
                            <td>{index + 1}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{item.products?.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKU: {item.products?.sku || 'N/A'}</div>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{rQty}</td>
                            <td style={{ textAlign: 'right' }}>৳{price.toFixed(2)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{(rQty * price).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Replacement Items Table (if Exchange) */}
                {activeVoucher.type === 'exchange' && activeVoucher.exchangeItems.length > 0 && (
                  <div style={{ marginTop: '1.25rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem', color: '#2563eb' }}>
                      🔄 Replacement Goods Issued (Taken by Customer):
                    </div>
                    <table className="invoice-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>SL</th>
                          <th>Product / Item Description</th>
                          <th style={{ textAlign: 'center', width: '90px' }}>Issued Qty</th>
                          <th style={{ textAlign: 'right', width: '110px' }}>Unit Price</th>
                          <th style={{ textAlign: 'right', width: '130px' }}>Item Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeVoucher.exchangeItems.map((item, index) => (
                          <tr key={item.product_id || index}>
                            <td>{index + 1}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{item.product?.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKU: {item.product?.sku || 'N/A'}</div>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right' }}>৳{item.unit_price.toFixed(2)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{(item.quantity * item.unit_price).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Summary Box */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '320px', alignSelf: 'flex-end', marginTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>Total Return Credit:</span>
                    <span style={{ fontWeight: 700, color: '#b45309' }}>৳{(activeVoucher.totalReturnCredit || 0).toFixed(2)}</span>
                  </div>
                  {activeVoucher.type === 'exchange' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        <span>Total Replacement Value:</span>
                        <span style={{ fontWeight: 700, color: '#2563eb' }}>৳{(activeVoucher.totalExchangeValue || 0).toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '2px solid var(--text-primary)', paddingTop: '0.5rem', fontSize: '1.1rem' }}>
                        <span>Net Difference:</span>
                        <span>
                          {activeVoucher.exchangeDifference > 0 ? `+৳${activeVoucher.exchangeDifference.toFixed(2)} (Paid)` : (activeVoucher.exchangeDifference < 0 ? `-৳${Math.abs(activeVoucher.exchangeDifference).toFixed(2)} (Refunded)` : '৳0.00 (Even)')}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <div style={{ textAlign: 'center', width: '180px' }}>
                    <div style={{ borderTop: '1px dashed var(--text-muted)', paddingTop: '0.4rem', fontWeight: 600 }}>Customer Signature</div>
                  </div>
                  <div style={{ textAlign: 'center', width: '180px' }}>
                    <div style={{ borderTop: '1px dashed var(--text-muted)', paddingTop: '0.4rem', fontWeight: 600 }}>Store In-Charge</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed var(--border-color)', marginTop: '2rem', paddingTop: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  Official Return & Exchange Voucher generated by Almas Accessories ERP system.
                </div>
              </div>
            </div>

            <div className="modal-footer no-print">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPrintModal(false)}>Close</button>
              <button type="button" className="btn btn-primary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Printer size={16} />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
