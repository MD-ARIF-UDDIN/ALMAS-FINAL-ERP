import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Users, Plus, Search, Trash2, Edit, Building, Mail, Phone, MapPin, Receipt, History, DollarSign } from 'lucide-react';
import { TableLoading } from '../components/TableLoading';

export default function Contacts({ userProfile, addToast }) {
  const [contacts, setContacts] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('customer'); // 'customer' or 'supplier'

  // Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // History Modal states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyContact, setHistoryContact] = useState(null);
  const [historySales, setHistorySales] = useState([]);
  const [historyPurchases, setHistoryPurchases] = useState([]);
  const [historyPayments, setHistoryPayments] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const role = userProfile?.role || 'staff';

  useEffect(() => {
    fetchContacts();
  }, []);

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .order('name', { ascending: true });
      if (contactsError) throw contactsError;

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('id, customer_id, net_amount, paid_amount');
      if (salesError) throw salesError;

      const { data: purchasesData, error: purchasesError } = await supabase
        .from('purchases')
        .select('id, supplier_id, net_amount, paid_amount');
      if (purchasesError) throw purchasesError;

      setContacts(contactsData || []);
      setSales(salesData || []);
      setPurchases(purchasesData || []);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load contacts and financial balances.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showMessage('Please enter a valid name.', 'error');
      return;
    }

    if (phone.trim() && !/^\+?[0-9\s\-()]{7,15}$/.test(phone.trim())) {
      showMessage('Please enter a valid phone number (7-15 digits).', 'error');
      return;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showMessage('Please enter a valid email address.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        const { error } = await supabase
          .from('contacts')
          .update({
            name: name.trim(),
            phone: phone.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null,
          })
          .eq('id', editingId);

        if (error) throw error;
        showMessage('Contact profile updated successfully!', 'success');
      } else {
        const { error } = await supabase
          .from('contacts')
          .insert([
            {
              name: name.trim(),
              type: activeTab,
              phone: phone.trim() || null,
              email: email.trim() || null,
              address: address.trim() || null,
            },
          ]);

        if (error) throw error;
        showMessage('New contact added successfully!', 'success');
      }

      resetForm();
      setShowCreateModal(false);
      fetchContacts();
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Error saving contact details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (contact) => {
    setIsEditing(true);
    setEditingId(contact.id);
    setName(contact.name || '');
    setPhone(contact.phone || '');
    setEmail(contact.email || '');
    setAddress(contact.address || '');
    setShowCreateModal(true);
  };

  const handleDelete = async (id, contactName) => {
    if (!window.confirm(`Are you sure you want to delete contact "${contactName}"?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showMessage('Contact profile deleted successfully.', 'success');
      fetchContacts();
      if (editingId === id) resetForm();
    } catch (err) {
      console.error(err);
      showMessage('Cannot delete contact. It might be referenced in active invoices.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
  };

  const getContactBalance = (contact) => {
    if (contact.type === 'customer') {
      const clientSales = sales.filter(s => s.customer_id === contact.id);
      return clientSales.reduce((sum, s) => sum + (s.net_amount - s.paid_amount), 0);
    } else {
      const vendorPurchases = purchases.filter(p => p.supplier_id === contact.id);
      return vendorPurchases.reduce((sum, p) => sum + (p.net_amount - p.paid_amount), 0);
    }
  };

  const handleOpenHistory = async (contact) => {
    setHistoryContact(contact);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      if (contact.type === 'customer') {
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select('*')
          .eq('customer_id', contact.id)
          .order('sale_date', { ascending: false });
        if (salesError) throw salesError;

        setHistorySales(salesData || []);
        setHistoryPurchases([]);

        if (salesData && salesData.length > 0) {
          const saleIds = salesData.map(s => s.id);
          const { data: paymentsData, error: paymentsError } = await supabase
            .from('payments')
            .select('*')
            .eq('type', 'customer_payment')
            .in('sale_id', saleIds)
            .order('payment_date', { ascending: false });
          if (paymentsError) throw paymentsError;
          setHistoryPayments(paymentsData || []);
        } else {
          setHistoryPayments([]);
        }
      } else {
        const { data: purchasesData, error: purchasesError } = await supabase
          .from('purchases')
          .select('*')
          .eq('supplier_id', contact.id)
          .order('purchase_date', { ascending: false });
        if (purchasesError) throw purchasesError;

        setHistoryPurchases(purchasesData || []);
        setHistorySales([]);

        if (purchasesData && purchasesData.length > 0) {
          const purchaseIds = purchasesData.map(p => p.id);
          const { data: paymentsData, error: paymentsError } = await supabase
            .from('payments')
            .select('*')
            .eq('type', 'supplier_payment')
            .in('purchase_id', purchaseIds)
            .order('payment_date', { ascending: false });
          if (paymentsError) throw paymentsError;
          setHistoryPayments(paymentsData || []);
        } else {
          setHistoryPayments([]);
        }
      }
    } catch (err) {
      console.error(err);
      showMessage('Failed to load transaction history.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const getInvoiceNumber = (payment) => {
    if (payment.sale_id) {
      const match = historySales.find(s => s.id === payment.sale_id);
      return match ? match.invoice_number : `INV#${payment.sale_id.substring(0, 8).toUpperCase()}`;
    } else if (payment.purchase_id) {
      const match = historyPurchases.find(p => p.id === payment.purchase_id);
      return match ? match.invoice_number : `PUR#${payment.purchase_id.substring(0, 8).toUpperCase()}`;
    }
    return 'N/A';
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.type === activeTab &&
      (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone && c.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="top-bar">
        <div className="page-title-group">
          <h1>eContacts Directory</h1>
        </div>
        <div className="top-bar-actions">
          <button 
            className="btn btn-primary"
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} />
            <span>Create {activeTab === 'customer' ? 'Buyer / Client' : 'Supplier'}</span>
          </button>
        </div>
      </div>



      {/* Tab Controls */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1rem' }}>
        <button
          className={`btn ${activeTab === 'customer' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setActiveTab('customer');
            resetForm();
          }}
        >
          <Users size={16} />
          <span>Buyers / Customers</span>
        </button>
        <button
          className={`btn ${activeTab === 'supplier' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setActiveTab('supplier');
            resetForm();
          }}
        >
          <Building size={16} />
          <span>Suppliers / Spinning Mills</span>
        </button>
      </div>

      {/* Directory List occupying full width */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Search bar */}
        <div className="card" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-control"
              style={{ paddingLeft: '2.25rem' }}
              placeholder={`Search ${activeTab === 'customer' ? 'buyers' : 'suppliers'} by name, phone, or email...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table list */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>SL</th>
                <th>Name / Company</th>
                <th>Contact Info</th>
                <th>Outstanding Balance</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoading colSpan={5} message="Fetching contacts records..." />
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                    No contacts found matching the filters.
                  </td>
                </tr>
              ) : (
                filteredContacts.map((c, index) => {
                  const balance = getContactBalance(c);
                  const isCustomer = c.type === 'customer';
                  return (
                    <tr key={c.id}>
                      <td>{index + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Added on {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        {c.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
                            <Phone size={12} className="text-muted" style={{ color: 'var(--text-muted)' }} />
                            <span>{c.phone}</span>
                          </div>
                        )}
                        {c.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                            <Mail size={12} className="text-muted" style={{ color: 'var(--text-muted)' }} />
                            <span>{c.email}</span>
                          </div>
                        )}
                        {!c.phone && !c.email && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>N/A</span>}
                      </td>
                      <td>
                        <span 
                          style={{ 
                            fontWeight: 700, 
                            fontFamily: 'Outfit, sans-serif',
                            color: balance > 0 ? (isCustomer ? 'var(--primary)' : 'var(--danger-text)') : 'var(--text-muted)'
                          }}
                        >
                          ৳{balance.toFixed(2)}
                        </span>
                        <span style={{ fontSize: '0.72rem', display: 'block', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {balance > 0 ? (isCustomer ? 'Receivable' : 'Payable') : 'Cleared'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => handleOpenHistory(c)}
                            title="Transaction History Ledger"
                            style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                          >
                            <History size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => handleEdit(c)}
                            title="Edit Profile"
                          >
                            <Edit size={14} />
                          </button>
                          {role === 'owner' && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm btn-icon"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => handleDelete(c.id, c.name)}
                              title="Delete Profile"
                            >
                              <Trash2 size={14} />
                            </button>
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
      </div>

      {/* CREATE / EDIT CONTACT MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '100%' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {isEditing ? 'Edit Profile Details' : `Create New ${activeTab === 'customer' ? 'Buyer' : 'Supplier'}`}
              </h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }} 
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveContact}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label>Full Name / Company Name *</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder={activeTab === 'customer' ? 'e.g. Apex Garments Ltd' : 'e.g. Almas Spinning Mills Ltd'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Contact Phone Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="input-control"
                      style={{ paddingLeft: '2.25rem' }}
                      placeholder="+8801xxxxxxxxx"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="email"
                      className="input-control"
                      style={{ paddingLeft: '2.25rem' }}
                      placeholder="contact@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Factory / Office Address</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={14} style={{ position: 'absolute', left: '0.75rem', top: '0.75rem', color: 'var(--text-muted)' }} />
                    <textarea
                      className="input-control"
                      style={{ paddingLeft: '2.25rem', minHeight: '80px', resize: 'vertical' }}
                      placeholder="Street address, City, Country"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {isEditing ? 'Update Profile' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSACTION & PAYMENT HISTORY MODAL */}
      {showHistoryModal && historyContact && (
        <div className="modal-overlay">
          <div className="modal-content modal-xl">
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={20} />
                <span>Ledger History: {historyContact.name}</span>
              </h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryContact(null);
                }} 
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Financial Quick Summary Bar */}
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '1rem', 
                  backgroundColor: '#f8fafc', 
                  padding: '1rem', 
                  borderRadius: 'var(--border-radius)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                    {historyContact.type === 'customer' ? 'Total Sales Invoiced' : 'Total Procurement Billed'}
                  </span>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ৳{(historyContact.type === 'customer' ? historySales : historyPurchases).reduce((sum, item) => sum + item.net_amount, 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                    Total Payments Logged
                  </span>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: 'var(--success-text)' }}>
                    ৳{historyPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                    Outstanding Net Due
                  </span>
                  <span 
                    style={{ 
                      fontFamily: 'Outfit, sans-serif', 
                      fontSize: '1.25rem', 
                      fontWeight: 800, 
                      color: getContactBalance(historyContact) > 0 ? (historyContact.type === 'customer' ? 'var(--primary)' : 'var(--danger-text)') : 'var(--text-muted)'
                    }}
                  >
                    ৳{getContactBalance(historyContact).toFixed(2)}
                  </span>
                </div>
              </div>

              {loadingHistory ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Loading transaction history ledger logs...
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                  
                  {/* Left: Invoice/Purchases Logs */}
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Receipt size={16} className="text-muted" />
                      <span>{historyContact.type === 'customer' ? 'Sales Invoices Log' : 'Procurement Bills Log'}</span>
                    </h4>
                    <div className="table-container" style={{ overflowY: 'auto' }}>
                      <table style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>SL</th>
                            <th>Invoice ID</th>
                            <th>Date</th>
                            <th>Net Total</th>
                            <th>Due</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(historyContact.type === 'customer' ? historySales : historyPurchases).length === 0 ? (
                            <tr>
                              <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem' }}>No bills logged.</td>
                            </tr>
                          ) : (
                            (historyContact.type === 'customer' ? historySales : historyPurchases).map((inv, index) => {
                              const due = inv.net_amount - inv.paid_amount;
                              return (
                                <tr key={inv.id}>
                                  <td>{index + 1}</td>
                                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                    {inv.invoice_number || `ID-${inv.id.substring(0, 5).toUpperCase()}`}
                                  </td>
                                  <td>{new Date(inv.sale_date || inv.purchase_date).toLocaleDateString()}</td>
                                  <td style={{ fontFamily: 'Outfit, sans-serif' }}>৳{inv.net_amount.toFixed(2)}</td>
                                  <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: due > 0 ? 'var(--danger-text)' : 'inherit' }}>
                                    ৳{due.toFixed(2)}
                                  </td>
                                  <td>
                                    <span className={`badge badge-${inv.payment_status}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                                      {inv.payment_status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right: Payment Logs */}
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <DollarSign size={16} className="text-muted" />
                      <span>Payment Transactions Ledger</span>
                    </h4>
                    <div className="table-container" style={{ overflowY: 'auto' }}>
                      <table style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>SL</th>
                            <th>Receipt ID</th>
                            <th>Date</th>
                            <th>Invoice Reference</th>
                            <th>Amount</th>
                            <th>Mode</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyPayments.length === 0 ? (
                            <tr>
                              <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem' }}>No transactions recorded.</td>
                            </tr>
                          ) : (
                            historyPayments.map((pay, index) => (
                              <tr key={pay.id}>
                                <td>{index + 1}</td>
                                <td style={{ fontFamily: 'monospace' }}>
                                  {pay.payment_number || `PM-${pay.id.substring(0, 5).toUpperCase()}`}
                                </td>
                                <td>{new Date(pay.payment_date).toLocaleDateString()}</td>
                                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                  {getInvoiceNumber(pay)}
                                </td>
                                <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: 'var(--success-text)' }}>
                                  ৳{pay.amount.toFixed(2)}
                                </td>
                                <td style={{ textTransform: 'capitalize' }}>
                                  {pay.payment_method.replace('_', ' ')}
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
            </div>
            <div className="modal-footer" style={{ padding: '0.75rem 1.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryContact(null);
                }}
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
