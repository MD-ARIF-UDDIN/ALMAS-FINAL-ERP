import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CreditCard, TrendingUp, TrendingDown, Plus, Search, HelpCircle, DollarSign } from 'lucide-react';
import { TableLoading } from '../components/TableLoading';

export default function Payments({ userProfile, branches, addToast }) {
  const [activeSubTab, setActiveSubTab] = useState('invoices'); // 'invoices' or 'ledger'
  const [invoiceType, setInvoiceType] = useState('sales'); // 'sales' (receivables) or 'purchases' (payables)
  const [loading, setLoading] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Data lists
  const [invoices, setInvoices] = useState([]);
  const [paymentsLog, setPaymentsLog] = useState([]);

  // Search/Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'unpaid', 'partial'

  // Payment Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    if (userProfile?.role === 'owner') {
      return branches.length > 0 ? branches[0].id : '';
    }
    return userProfile?.branch_id || (branches.length > 0 ? branches[0].id : '');
  });

  useEffect(() => {
    if (!selectedBranchId) {
      if (userProfile?.role === 'owner') {
        if (branches.length > 0) {
          setSelectedBranchId(branches[0].id);
        }
      } else {
        setSelectedBranchId(userProfile?.branch_id || (branches.length > 0 ? branches[0].id : ''));
      }
    }
  }, [branches, userProfile, selectedBranchId]);

  useEffect(() => {
    if (selectedBranchId) {
      fetchInvoices();
      fetchPaymentsLog();
    }
  }, [selectedBranchId, invoiceType, statusFilter]);

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const fetchInvoices = async () => {
    if (!selectedBranchId) return;
    setLoading(true);
    try {
      let query;
      if (invoiceType === 'sales') {
        query = supabase
          .from('sales')
          .select(`
            id,
            invoice_number,
            sale_date,
            net_amount,
            paid_amount,
            payment_status,
            branch_id,
            contacts (
              name
            )
          `)
          .eq('branch_id', selectedBranchId);
      } else {
        query = supabase
          .from('purchases')
          .select(`
            id,
            invoice_number,
            purchase_date,
            net_amount,
            paid_amount,
            payment_status,
            branch_id,
            contacts (
              name
            )
          `)
          .eq('branch_id', selectedBranchId);
      }

      // Status filters
      if (statusFilter === 'unpaid') {
        query = query.eq('payment_status', 'unpaid');
      } else if (statusFilter === 'partial') {
        query = query.eq('payment_status', 'partial');
      } else {
        // exclude 'paid' if we want only outstanding or show all
        // Let's show all but order by status (unpaid/partial first)
      }

      const { data, error } = await query;
      if (error) throw error;

      // Sort invoices: unpaid and partial first
      const sorted = (data || []).sort((a, b) => {
        if (a.payment_status === b.payment_status) return 0;
        if (a.payment_status === 'paid') return 1;
        if (b.payment_status === 'paid') return -1;
        return 0;
      });

      setInvoices(sorted);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load invoices.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentsLog = async () => {
    if (!selectedBranchId) return;
    setLoadingLedger(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          payment_number,
          type,
          payment_date,
          amount,
          payment_method,
          reference_number,
          sale_id,
          branch_id,
          sales (
            invoice_number
          ),
          purchase_id,
          purchases (
            invoice_number
          ),
          profiles (
            full_name
          )
        `)
        .eq('branch_id', selectedBranchId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPaymentsLog(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleOpenPaymentModal = (invoice) => {
    setSelectedInvoice(invoice);
    const due = invoice.net_amount - invoice.paid_amount;
    setPaymentAmount(due.toFixed(2));
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice || !paymentAmount) return;

    const amountNum = parseFloat(paymentAmount);
    const due = selectedInvoice.net_amount - selectedInvoice.paid_amount;

    if (amountNum <= 0) {
      showMessage('Payment amount must be greater than zero.', 'error');
      return;
    }
    if (amountNum > due + 0.01) { // allowance for decimal precision
      showMessage(`Payment amount cannot exceed the remaining due of ৳${due.toFixed(2)}.`, 'error');
      return;
    }

    setLoading(true);
    try {
      const isSale = invoiceType === 'sales';
      const paymentPayload = {
        branch_id: selectedBranchId,
        type: isSale ? 'customer_payment' : 'supplier_payment',
        sale_id: isSale ? selectedInvoice.id : null,
        purchase_id: !isSale ? selectedInvoice.id : null,
        payment_date: new Date(paymentDate).toISOString(),
        amount: amountNum,
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
        notes: paymentNotes || null,
        created_by: userProfile.id,
      };

      // 1. Insert payment record (Trigger will update sales/purchases total_paid & status automatically)
      const { error: payError } = await supabase.from('payments').insert([paymentPayload]);
      if (payError) throw payError;

      // 2. Insert record into cash_ledger
      const refLabel = isSale ? 'POS Sale Receipt' : 'Supplier Purchase Payout';
      const invoiceLabel = isSale ? 'Invoice' : 'Bill';
      const { error: ledgerError } = await supabase.from('cash_ledger').insert([
        {
          branch_id: selectedBranchId,
            account_type: paymentMethod,
            type: isSale ? 'in' : 'out',
            amount: amountNum,
            description: `${refLabel}: ${invoiceLabel} #${selectedInvoice.invoice_number || selectedInvoice.id.substring(0, 8).toUpperCase()}`,
            transaction_date: new Date(paymentDate).toISOString(),
        },
      ]);
      if (ledgerError) throw ledgerError;

      showMessage('Payment transaction recorded successfully!', 'success');
      setShowPaymentModal(false);
      setPaymentNotes('');
      setReferenceNumber('');
      setSelectedInvoice(null);
      
      // Refresh views
      fetchInvoices();
      fetchPaymentsLog();
    } catch (err) {
      console.error(err);
      showMessage('Failed to process payment transaction.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.contacts?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="top-bar">
        <div className="page-title-group">
          <h1>Payments & Receipts</h1>
        </div>
        {userProfile?.role === 'owner' && (
          <div className="top-bar-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="form-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ whiteSpace: 'nowrap' }}>Active Branch:</label>
              <select
                className="input-control"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                style={{ width: '220px' }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>



      {/* Main Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1rem' }}>
        <button
          className={`btn ${activeSubTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('invoices')}
        >
          <CreditCard size={16} />
          <span>Invoice Outstanding balances</span>
        </button>
        <button
          className={`btn ${activeSubTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('ledger')}
        >
          <span>Payment History Log</span>
        </button>
      </div>

      {/* VIEW: INVOICES OUTSTANDING */}
      {activeSubTab === 'invoices' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn btn-sm ${invoiceType === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setInvoiceType('sales')}
              >
                Customer Receivables (Sales)
              </button>
              <button
                className={`btn btn-sm ${invoiceType === 'purchases' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setInvoiceType('purchases')}
              >
                Supplier Payables (Purchases)
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <select
                className="input-control"
                style={{ width: '150px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Invoices</option>
                <option value="unpaid">Unpaid Only</option>
                <option value="partial">Partially Paid</option>
              </select>

              <div className="catalog-search-bar" style={{ width: '220px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input-control"
                    style={{ paddingLeft: '2.2rem', paddingHeight: '34px', fontSize: '0.85rem' }}
                    placeholder="Search by ID or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>SL</th>
                  <th>Invoice ID</th>
                  {userProfile?.role === 'owner' && <th>Branch</th>}
                  <th>Date</th>
                  <th>Contact Name</th>
                  <th>Net Bill</th>
                  <th>Paid Amount</th>
                  <th>Due Outstanding</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoading colSpan={userProfile?.role === 'owner' ? 10 : 9} message="Fetching invoices..." />
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={userProfile?.role === 'owner' ? 10 : 9} style={{ textAlign: 'center', padding: '2rem' }}>
                      No invoices found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv, index) => {
                    const due = inv.net_amount - inv.paid_amount;
                    return (
                      <tr key={inv.id}>
                        <td>{index + 1}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700 }}>
                          {inv.invoice_number || (invoiceType === 'sales' ? 'INV' : 'PUR') + '#' + inv.id.substring(0, 8).toUpperCase()}
                        </td>
                        {userProfile?.role === 'owner' && (
                          <td style={{ fontWeight: 600 }}>{branches.find(b => b.id === inv.branch_id)?.name || 'Unknown'}</td>
                        )}
                        <td>{new Date(inv.sale_date || inv.purchase_date).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {inv.contacts?.name || 'Unknown'}
                        </td>
                        <td style={{ fontFamily: 'Outfit, sans-serif' }}>৳{inv.net_amount.toFixed(2)}</td>
                        <td style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--success-text)' }}>
                          ৳{inv.paid_amount.toFixed(2)}
                        </td>
                        <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: due > 0 ? 'var(--danger-text)' : 'var(--text-primary)' }}>
                          ৳{due.toFixed(2)}
                        </td>
                        <td>
                          <span className={`badge badge-${inv.payment_status}`}>{inv.payment_status}</span>
                        </td>
                        <td>
                          {due > 0 ? (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleOpenPaymentModal(inv)}
                            >
                              {invoiceType === 'sales' ? 'Collect Payment' : 'Pay Supplier'}
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Cleared</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: PAYMENTS TRANSACTION LOG */}
      {activeSubTab === 'ledger' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Transaction Ledger</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>SL</th>
                  <th>Date</th>
                  {userProfile?.role === 'owner' && <th>Branch</th>}
                  <th>Receipt No</th>
                  <th>Transaction Type</th>
                  <th>Invoice Reference</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference TrxID</th>
                  <th>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {loadingLedger ? (
                  <TableLoading colSpan={userProfile?.role === 'owner' ? 10 : 9} message="Fetching payment transaction logs..." />
                ) : paymentsLog.length === 0 ? (
                  <tr>
                    <td colSpan={userProfile?.role === 'owner' ? 10 : 9} style={{ textAlign: 'center', padding: '2rem' }}>
                      No payments registered yet.
                    </td>
                  </tr>
                ) : (
                  paymentsLog.map((log, index) => {
                    const isRec = log.type === 'customer_payment';
                    return (
                      <tr key={log.id}>
                        <td>{index + 1}</td>
                        <td>{new Date(log.payment_date).toLocaleString()}</td>
                        {userProfile?.role === 'owner' && (
                          <td style={{ fontWeight: 600 }}>{branches.find(b => b.id === log.branch_id)?.name || 'Unknown'}</td>
                        )}
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem' }}>
                          {log.payment_number || 'N/A'}
                        </td>
                        <td>
                          <span className={`badge ${isRec ? 'badge-paid' : 'badge-unpaid'}`}>
                            {isRec ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            <span style={{ marginLeft: '0.25rem' }}>
                              {isRec ? 'Received (Customer)' : 'Paid (Supplier)'}
                            </span>
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {log.sale_id ? (
                            <span>{log.sales?.invoice_number || `INV#${log.sale_id.substring(0, 8).toUpperCase()}`}</span>
                          ) : (
                            <span>{log.purchases?.invoice_number || `PUR#${log.purchase_id.substring(0, 8).toUpperCase()}`}</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: isRec ? 'var(--success-text)' : 'var(--danger-text)' }}>
                          ৳{log.amount.toFixed(2)}
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{log.payment_method.replace('_', ' ')}</td>
                        <td>{log.reference_number || 'N/A'}</td>
                        <td style={{ fontSize: '0.85rem' }}>{log.profiles?.full_name || 'System'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {showPaymentModal && selectedInvoice && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                {invoiceType === 'sales' ? 'Receive Customer Payment' : 'Issue Supplier Payment'}
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPaymentModal(false)}
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Invoice Net total:</span>
                    <span style={{ fontWeight: 600 }}>৳{selectedInvoice.net_amount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', color: 'var(--success-text)' }}>
                    <span>Amount Already Paid:</span>
                    <span>৳{selectedInvoice.paid_amount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px dashed var(--border-color)', paddingTop: '0.35rem', color: 'var(--danger-text)' }}>
                    <span>Remaining Due Balance:</span>
                    <span>৳{(selectedInvoice.net_amount - selectedInvoice.paid_amount).toFixed(2)}</span>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Payment Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={(selectedInvoice.net_amount - selectedInvoice.paid_amount).toFixed(2)}
                      className="input-control"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Date of Payment *</label>
                    <input
                      type="date"
                      className="input-control"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Method *</label>
                    <select
                      className="input-control"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      required
                    >
                      <option value="cash">Cash</option>
                      <option value="bank">Bank Deposit / Card</option>
                      <option value="mobile_banking">Mobile Money (bKash/Nagad)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Reference # (Trx ID / Cheque #)</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Optional reference"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes / Comments</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. Part payment received via bKash"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Create Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
