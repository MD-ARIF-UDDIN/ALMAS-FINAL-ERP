import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CreditCard, TrendingUp, TrendingDown, Plus, Search, HelpCircle, DollarSign, History, X, Receipt } from 'lucide-react';
import { TableLoading } from '../components/TableLoading';
import Pagination from '../components/Pagination';
import { formatAmount, formatPlainNumber } from '../utils/format';

export default function Payments({ userProfile, branches, addToast }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSubTab = searchParams.get('tab') === 'ledger' ? 'ledger' : 'invoices';
  const setActiveSubTab = (tab) => setSearchParams({ tab }, { replace: true });
  const [invoiceType, setInvoiceType] = useState('sales'); // 'sales' (receivables) or 'purchases' (payables)
  const [loading, setLoading] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Invoices tab pagination
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePageSize, setInvoicePageSize] = useState(25);
  const [invoiceTotalCount, setInvoiceTotalCount] = useState(0);

  // Ledger tab pagination
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(25);
  const [ledgerTotalCount, setLedgerTotalCount] = useState(0);

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

  // Payment History Modal States
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyInvoice, setHistoryInvoice] = useState(null);
  const [invoicePaymentHistory, setInvoicePaymentHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    if (userProfile?.role === 'owner') {
      const factoryBranch = branches.find((b) => b.is_factory || b.name?.toLowerCase().includes('factory'));
      return factoryBranch ? factoryBranch.id : (branches.length > 0 ? branches[0].id : '');
    }
    return userProfile?.branch_id || (branches.length > 0 ? branches[0].id : '');
  });

  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      if (userProfile?.role === 'owner') {
        const factoryBranch = branches.find((b) => b.is_factory || b.name?.toLowerCase().includes('factory'));
        setSelectedBranchId(factoryBranch ? factoryBranch.id : branches[0].id);
      } else {
        setSelectedBranchId(userProfile?.branch_id || branches[0].id);
      }
    }
  }, [branches, userProfile, selectedBranchId]);

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const fetchInvoices = useCallback(async () => {
    if (!selectedBranchId) return;
    setLoading(true);
    try {
      const from = (invoicePage - 1) * invoicePageSize;
      const to = from + invoicePageSize - 1;

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
              id,
              name,
              phone
            )
          `, { count: 'exact' });
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
              id,
              name,
              phone
            )
          `, { count: 'exact' });
      }

      if (userProfile?.role === 'owner') {
        if (selectedBranchId && selectedBranchId !== 'all') {
          query = query.eq('branch_id', selectedBranchId);
        }
      } else if (selectedBranchId) {
        query = query.eq('branch_id', selectedBranchId);
      }

      // Status filters
      if (statusFilter === 'unpaid') {
        query = query.eq('payment_status', 'unpaid');
      } else if (statusFilter === 'partial') {
        query = query.eq('payment_status', 'partial');
      }

      if (searchQuery.trim()) {
        query = query.ilike('invoice_number', `%${searchQuery.trim()}%`);
      }

      const dateField = invoiceType === 'sales' ? 'sale_date' : 'purchase_date';
      query = query.order(dateField, { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setInvoices(data || []);
      setInvoiceTotalCount(count || 0);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load invoices.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, invoiceType, statusFilter, invoicePage, invoicePageSize, searchQuery, userProfile?.role]);

  const fetchPaymentsLog = useCallback(async () => {
    if (!selectedBranchId) return;
    setLoadingLedger(true);
    try {
      const from = (ledgerPage - 1) * ledgerPageSize;
      const to = from + ledgerPageSize - 1;

      let query = supabase
        .from('payments')
        .select(`
          id,
          payment_number,
          transaction_type,
          payment_date,
          amount,
          payment_method,
          reference_invoice_id,
          reference_number,
          notes,
          branch_id,
          contacts (
            id,
            name
          ),
          profiles (
            full_name
          )
        `, { count: 'exact' });

      if (userProfile?.role === 'owner') {
        if (selectedBranchId && selectedBranchId !== 'all') {
          query = query.eq('branch_id', selectedBranchId);
        }
      } else if (selectedBranchId) {
        query = query.eq('branch_id', selectedBranchId);
      }

      query = query.order('payment_date', { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      setPaymentsLog(data || []);
      setLedgerTotalCount(count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLedger(false);
    }
  }, [selectedBranchId, ledgerPage, ledgerPageSize, userProfile?.role]);

  useEffect(() => {
    if (selectedBranchId) {
      if (activeSubTab === 'invoices') {
        fetchInvoices();
      } else {
        fetchPaymentsLog();
      }
    }
  }, [selectedBranchId, activeSubTab, fetchInvoices, fetchPaymentsLog]);

  const handleOpenPaymentModal = (invoice) => {
    setSelectedInvoice(invoice);
    const due = invoice.net_amount - invoice.paid_amount;
    setPaymentAmount(formatPlainNumber(due));
    setShowPaymentModal(true);
  };

  const handleOpenHistoryModal = async (invoice) => {
    setHistoryInvoice(invoice);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          payment_number,
          transaction_type,
          payment_date,
          amount,
          payment_method,
          reference_number,
          notes,
          created_by,
          profiles (
            full_name
          )
        `)
        .eq('reference_invoice_id', invoice.id)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setInvoicePaymentHistory(data || []);
    } catch (err) {
      console.error('Error fetching invoice payment history:', err);
      showMessage('Failed to load payment history for this bill.', 'error');
    } finally {
      setLoadingHistory(false);
    }
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
      showMessage(`Payment amount cannot exceed the remaining due of ৳${formatAmount(due)}.`, 'error');
      return;
    }

    setLoading(true);
    try {
      const isSale = invoiceType === 'sales';
      const paymentPayload = {
        branch_id: selectedBranchId,
        contact_id: selectedInvoice.customer_id || selectedInvoice.supplier_id || selectedInvoice.contacts?.id,
        payment_date: new Date(paymentDate).toISOString(),
        amount: amountNum,
        payment_method: paymentMethod,
        transaction_type: isSale ? 'customer_collection' : 'supplier_payment',
        reference_invoice_id: selectedInvoice.id,
        reference_number: referenceNumber.trim() || null,
        notes: paymentNotes.trim() || null,
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
          amount_in: isSale ? amountNum : 0,
          amount_out: isSale ? 0 : amountNum,
          reference_id: selectedInvoice.id,
          description: `${refLabel}: ${invoiceLabel} #${selectedInvoice.invoice_number || selectedInvoice.id.substring(0, 8).toUpperCase()} (${paymentMethod})`,
          transaction_date: new Date(paymentDate).toISOString(),
          created_by: userProfile.id,
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
      
      // If history modal was open for this invoice, refresh its history too
      if (historyInvoice && historyInvoice.id === selectedInvoice.id) {
        handleOpenHistoryModal({
          ...selectedInvoice,
          paid_amount: selectedInvoice.paid_amount + amountNum,
        });
      }
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
          <h1>Payments</h1>
        </div>
        {userProfile?.role === 'owner' && (
          <div className="top-bar-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="form-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ whiteSpace: 'nowrap' }}>Branch:</label>
              <select
                className="input-control"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                style={{ width: '220px' }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.is_factory ? `🏭 ${b.name}` : `🏪 ${b.name}`}
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
          <span>Outstanding Invoices</span>
        </button>
        <button
          className={`btn ${activeSubTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('ledger')}
        >
          <span>Payment History</span>
        </button>
      </div>

      {/* VIEW: INVOICES OUTSTANDING */}
      {activeSubTab === 'invoices' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn btn-sm ${invoiceType === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setInvoiceType('sales');
                  setInvoicePage(1);
                }}
              >
                Customer Dues (Sales)
              </button>
              <button
                className={`btn btn-sm ${invoiceType === 'purchases' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setInvoiceType('purchases');
                  setInvoicePage(1);
                }}
              >
                Supplier Dues (Purchases)
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <select
                className="input-control"
                style={{ width: '150px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setInvoicePage(1);
                }}
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
                    style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                    placeholder="Search invoices..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setInvoicePage(1);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="table-container hide-on-mobile" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>SL</th>
                  <th>Invoice ID</th>
                  {userProfile?.role === 'owner' && <th>Branch</th>}
                  <th>Date</th>
                  <th>Contact</th>
                  <th>Net Total</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoading colSpan={userProfile?.role === 'owner' ? 10 : 9} message="Fetching invoices..." />
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={userProfile?.role === 'owner' ? 10 : 9} style={{ textAlign: 'center', padding: '2rem' }}>
                      No invoices found.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv, index) => {
                    const due = inv.net_amount - inv.paid_amount;
                    const rowNumber = (invoicePage - 1) * invoicePageSize + index + 1;
                    return (
                      <tr key={inv.id}>
                        <td>{rowNumber}</td>
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
                        <td style={{ fontFamily: 'Outfit, sans-serif' }}>৳{formatAmount(inv.net_amount)}</td>
                        <td style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--success-text)' }}>
                          ৳{formatAmount(inv.paid_amount)}
                        </td>
                        <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: due > 0 ? 'var(--danger-text)' : 'var(--text-primary)' }}>
                          ৳{formatAmount(due)}
                        </td>
                        <td>
                          <span className={`badge badge-${inv.payment_status}`}>{inv.payment_status}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              title="View Payment History"
                              onClick={() => handleOpenHistoryModal(inv)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.6rem' }}
                            >
                              <History size={14} />
                              <span>History</span>
                            </button>
                            {due > 0 ? (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleOpenPaymentModal(inv)}
                                style={{ padding: '0.35rem 0.65rem' }}
                              >
                                {invoiceType === 'sales' ? 'Collect' : 'Pay'}
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--success-text)', fontWeight: 600, padding: '0 0.35rem' }}>
                                ✓ Paid
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View for Invoices */}
          <div className="hide-on-desktop" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Fetching invoices...
              </div>
            ) : invoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                No invoices found.
              </div>
            ) : (
              invoices.map((inv, index) => {
                const due = inv.net_amount - inv.paid_amount;
                const rowNumber = (invoicePage - 1) * invoicePageSize + index + 1;
                const branchName = branches.find(b => b.id === inv.branch_id)?.name;

                return (
                  <div
                    key={inv.id}
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
                    {/* Header: SL Badge, Invoice ID, Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.45rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
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
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {inv.invoice_number || (invoiceType === 'sales' ? 'INV' : 'PUR') + '#' + inv.id.substring(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <span className={`badge badge-${inv.payment_status}`} style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                        {inv.payment_status}
                      </span>
                    </div>

                    {/* Contact & Date */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.82rem' }}>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem', display: 'block' }}>
                          {inv.contacts?.name || 'Unknown Contact'}
                        </span>
                        {userProfile?.role === 'owner' && branchName && (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            🏪 {branchName}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(inv.sale_date || inv.purchase_date).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Financials Strip */}
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
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Net Total</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                          ৳{formatAmount(inv.net_amount)}
                        </span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Paid</span>
                        <span style={{ fontWeight: 700, color: 'var(--success-text)', fontSize: '0.88rem' }}>
                          ৳{formatAmount(inv.paid_amount)}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Due</span>
                        <span style={{ fontWeight: 800, color: due > 0 ? 'var(--danger-text)' : 'var(--text-primary)', fontSize: '0.92rem' }}>
                          ৳{formatAmount(due)}
                        </span>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.15rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenHistoryModal(inv)}
                        style={{
                          flex: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          height: '34px',
                          fontSize: '0.8rem',
                          color: '#0284c7',
                          borderColor: '#bae6fd',
                          backgroundColor: '#f0f9ff',
                        }}
                      >
                        <History size={14} />
                        <span>History</span>
                      </button>
                      {due > 0 ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenPaymentModal(inv)}
                          style={{
                            flex: 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '34px',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                          }}
                        >
                          {invoiceType === 'sales' ? 'Collect Payment' : 'Make Payment'}
                        </button>
                      ) : (
                        <div style={{
                          flex: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '34px',
                          fontSize: '0.8rem',
                          color: 'var(--success-text)',
                          fontWeight: 700,
                          backgroundColor: '#ecfdf5',
                          borderRadius: '6px',
                        }}>
                          ✓ Fully Paid
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <Pagination
            currentPage={invoicePage}
            totalCount={invoiceTotalCount}
            pageSize={invoicePageSize}
            onPageChange={setInvoicePage}
            onPageSizeChange={setInvoicePageSize}
          />
        </div>
      )}

      {/* VIEW: PAYMENTS TRANSACTION LOG */}
      {activeSubTab === 'ledger' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '1rem 1.25rem' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Payment History</h3>
          </div>
          {/* Desktop Table View */}
          <div className="table-container hide-on-mobile" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>SL</th>
                  <th>Date</th>
                  {userProfile?.role === 'owner' && <th>Branch</th>}
                  <th>Receipt No</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Notes</th>
                  <th>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {loadingLedger ? (
                  <TableLoading colSpan={userProfile?.role === 'owner' ? 10 : 9} message="Fetching payment records..." />
                ) : paymentsLog.length === 0 ? (
                  <tr>
                    <td colSpan={userProfile?.role === 'owner' ? 10 : 9} style={{ textAlign: 'center', padding: '2rem' }}>
                      No payments registered yet.
                    </td>
                  </tr>
                ) : (
                  paymentsLog.map((log, index) => {
                    const isRec = log.transaction_type === 'customer_collection';
                    const rowNumber = (ledgerPage - 1) * ledgerPageSize + index + 1;
                    return (
                      <tr key={log.id}>
                        <td>{rowNumber}</td>
                        <td>{new Date(log.payment_date).toLocaleDateString()}</td>
                        {userProfile?.role === 'owner' && (
                          <td style={{ fontWeight: 600 }}>{branches.find(b => b.id === log.branch_id)?.name || 'Unknown'}</td>
                        )}
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem' }}>
                          {log.payment_number || 'N/A'}
                          {log.reference_number && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                              Ref: {log.reference_number}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${isRec ? 'badge-paid' : 'badge-unpaid'}`}>
                            {isRec ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            <span style={{ marginLeft: '0.25rem' }}>
                              {isRec ? 'Collection' : 'Payout'}
                            </span>
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {log.contacts?.name || (log.reference_invoice_id ? `REF#${log.reference_invoice_id.substring(0, 8).toUpperCase()}` : 'N/A')}
                        </td>
                        <td style={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: isRec ? 'var(--success-text)' : 'var(--danger-text)' }}>
                          ৳{formatAmount(log.amount)}
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{log.payment_method?.replace('_', ' ')}</td>
                        <td>{log.notes || 'N/A'}</td>
                        <td style={{ fontSize: '0.85rem' }}>{log.profiles?.full_name || 'System'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View for Ledger */}
          <div className="hide-on-desktop" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {loadingLedger ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Fetching payment records...
              </div>
            ) : paymentsLog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                No payments registered yet.
              </div>
            ) : (
              paymentsLog.map((log, index) => {
                const isRec = log.transaction_type === 'customer_collection';
                const rowNumber = (ledgerPage - 1) * ledgerPageSize + index + 1;
                const branchName = branches.find(b => b.id === log.branch_id)?.name;

                return (
                  <div
                    key={log.id}
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
                    {/* Header: SL Badge, Receipt #, Type Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.45rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
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
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.84rem' }}>
                          {log.payment_number || 'N/A'}
                        </span>
                      </div>
                      <span className={`badge ${isRec ? 'badge-paid' : 'badge-unpaid'}`} style={{ fontSize: '0.72rem' }}>
                        {isRec ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        <span style={{ marginLeft: '0.2rem' }}>
                          {isRec ? 'Collection' : 'Payout'}
                        </span>
                      </span>
                    </div>

                    {/* Contact, Date, Branch */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.82rem' }}>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem', display: 'block' }}>
                          {log.contacts?.name || (log.reference_invoice_id ? `REF#${log.reference_invoice_id.substring(0, 8).toUpperCase()}` : 'General Payment')}
                        </span>
                        {userProfile?.role === 'owner' && branchName && (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            🏪 {branchName}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(log.payment_date).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Amount & Method Strip */}
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
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Method</span>
                        <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '0.8rem' }}>
                          💳 {log.payment_method?.replace('_', ' ')}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Amount</span>
                        <span style={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: isRec ? 'var(--success-text)' : 'var(--danger-text)', fontSize: '0.95rem' }}>
                          {isRec ? '+' : '-'}৳{formatAmount(log.amount)}
                        </span>
                      </div>
                    </div>

                    {/* Footer: Notes & Logged By */}
                    {(log.notes || log.profiles?.full_name) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', paddingTop: '0.1rem' }}>
                        <span>{log.notes ? `📝 ${log.notes}` : ''}</span>
                        <span>👤 {log.profiles?.full_name || 'System'}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <Pagination
            currentPage={ledgerPage}
            totalCount={ledgerTotalCount}
            pageSize={ledgerPageSize}
            onPageChange={setLedgerPage}
            onPageSizeChange={setLedgerPageSize}
          />
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {showPaymentModal && selectedInvoice && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                {invoiceType === 'sales' ? 'Receive Payment' : 'Make Payment'}
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
                    <span style={{ color: 'var(--text-secondary)' }}>Net Total:</span>
                    <span style={{ fontWeight: 600 }}>৳{formatAmount(selectedInvoice.net_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', color: 'var(--success-text)' }}>
                    <span>Paid Amount:</span>
                    <span>৳{formatAmount(selectedInvoice.paid_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px dashed var(--border-color)', paddingTop: '0.35rem', color: 'var(--danger-text)' }}>
                    <span>Due Amount:</span>
                    <span>৳{formatAmount(selectedInvoice.net_amount - selectedInvoice.paid_amount)}</span>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={formatPlainNumber(selectedInvoice.net_amount - selectedInvoice.paid_amount)}
                      className="input-control"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Payment Date *</label>
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
                    <label>Payment Method *</label>
                    <select
                      className="input-control"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      required
                    >
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                      <option value="mobile_banking">Mobile Banking (bKash/Nagad)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Reference No</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. Trx ID or Cheque #"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Enter notes (optional)..."
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
                  {loading ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT HISTORY MODAL FOR INDIVIDUAL BILL */}
      {showHistoryModal && historyInvoice && (() => {
        const historyDue = historyInvoice.net_amount - historyInvoice.paid_amount;
        const invCode = historyInvoice.invoice_number || (invoiceType === 'sales' ? 'INV' : 'PUR') + '#' + historyInvoice.id.substring(0, 8).toUpperCase();
        return (
          <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
            <div 
              className="modal-content" 
              style={{ maxWidth: '820px', width: '92%' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ background: 'var(--primary-subtle, rgba(99, 102, 241, 0.1))', padding: '0.5rem', borderRadius: '8px', color: 'var(--primary-color)' }}>
                    <History size={20} />
                  </div>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                      Payment History
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {invCode} • {invoiceType === 'sales' ? 'Customer' : 'Supplier'}: <strong style={{ color: 'var(--text-primary)' }}>{historyInvoice.contacts?.name || 'Walk-in'}</strong>
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowHistoryModal(false)}
                  style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Financial Overview Banner */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                  gap: '0.75rem', 
                  background: 'var(--bg-card, #f8fafc)', 
                  padding: '0.9rem', 
                  borderRadius: 'var(--border-radius-sm, 8px)', 
                  border: '1px solid var(--border-color, #e2e8f0)' 
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>Date</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '2px' }}>
                      {new Date(historyInvoice.sale_date || historyInvoice.purchase_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>Total Bill</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '2px', fontFamily: 'Outfit, sans-serif' }}>
                      ৳{formatAmount(historyInvoice.net_amount)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>Total Paid</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '2px', fontFamily: 'Outfit, sans-serif', color: 'var(--success-text, #16a34a)' }}>
                      ৳{formatAmount(historyInvoice.paid_amount)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>Remaining Due</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '2px', fontFamily: 'Outfit, sans-serif', color: historyDue > 0 ? 'var(--danger-text, #dc2626)' : 'var(--text-primary)' }}>
                      ৳{formatAmount(historyDue)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>Status</div>
                    <div style={{ marginTop: '2px' }}>
                      <span className={`badge badge-${historyInvoice.payment_status}`}>{historyInvoice.payment_status}</span>
                    </div>
                  </div>
                </div>

                {/* Payments Table */}
                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.6rem', color: 'var(--text-primary)' }}>
                    Payment Installments ({invoicePaymentHistory.length})
                  </h4>
                  <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>#</th>
                          <th>Date</th>
                          <th>Receipt / Voucher</th>
                          <th>Amount</th>
                          <th>Method</th>
                          <th>Notes / Ref</th>
                          <th>Logged By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingHistory ? (
                          <TableLoading colSpan={7} message="Loading payment history..." />
                        ) : invoicePaymentHistory.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No payment installments found for this invoice.
                            </td>
                          </tr>
                        ) : (
                          invoicePaymentHistory.map((p, idx) => (
                            <tr key={p.id || idx}>
                              <td>{idx + 1}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                {new Date(p.payment_date).toLocaleDateString()}
                              </td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8rem' }}>
                                {p.payment_number || '—'}
                              </td>
                              <td style={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: 'var(--success-text, #16a34a)', whiteSpace: 'nowrap' }}>
                                ৳{formatAmount(p.amount)}
                              </td>
                              <td style={{ textTransform: 'capitalize' }}>
                                <span style={{ 
                                  background: '#f1f5f9', 
                                  padding: '2px 7px', 
                                  borderRadius: '4px', 
                                  fontSize: '0.78rem',
                                  fontWeight: 500
                                }}>
                                  {p.payment_method?.replace('_', ' ')}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.82rem', color: p.notes ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                {p.notes || '—'}
                              </td>
                              <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                {p.profiles?.full_name || 'System'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {historyDue > 0 && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setShowHistoryModal(false);
                        handleOpenPaymentModal(historyInvoice);
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Plus size={14} />
                      <span>{invoiceType === 'sales' ? 'Receive Payment' : 'Make Payment'}</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowHistoryModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
