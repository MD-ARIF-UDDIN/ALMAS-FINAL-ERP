import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Users, Plus, Search, Trash2, Edit, Building, Mail, Phone, MapPin, Receipt, History, DollarSign } from 'lucide-react';
import { TableLoading } from '../components/TableLoading';
import Pagination from '../components/Pagination';
import { formatAmount } from '../utils/format';

export default function Contacts({ userProfile, branches = [], addToast }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'supplier' ? 'supplier' : 'customer';
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });

  const [contacts, setContacts] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [branchId, setBranchId] = useState(() => {
    if (userProfile?.role === 'owner') {
      const factoryBranch = branches.find((b) => b.is_factory || b.name?.toLowerCase().includes('factory'));
      return factoryBranch ? factoryBranch.id : (branches.length > 0 ? branches[0].id : '');
    }
    return userProfile?.branch_id || (branches.length > 0 ? branches[0].id : '');
  });

  // Search and Branch filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranchId, setFilterBranchId] = useState(() => {
    if (userProfile?.role === 'owner') {
      return 'all';
    }
    return userProfile?.branch_id || (branches.length > 0 ? branches[0].id : '');
  });

  // History Modal states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyContact, setHistoryContact] = useState(null);
  const [historySales, setHistorySales] = useState([]);
  const [historyPurchases, setHistoryPurchases] = useState([]);
  const [historyPayments, setHistoryPayments] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const role = userProfile?.role || 'staff';

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('type', activeTab)
        .order('name', { ascending: true })
        .range(from, to);

      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery.trim()}%,phone.ilike.%${searchQuery.trim()}%,email.ilike.%${searchQuery.trim()}%`);
      }

      if (role === 'owner') {
        if (filterBranchId && filterBranchId !== 'all') {
          query = query.eq('branch_id', filterBranchId);
        }
      } else if (userProfile?.branch_id) {
        query = query.eq('branch_id', userProfile.branch_id);
      }

      const { data: contactsData, count, error: contactsError } = await query;
      if (contactsError) throw contactsError;

      setContacts(contactsData || []);
      setTotalCount(count || 0);

      // Fetch financial summaries for visible contacts
      if (contactsData && contactsData.length > 0) {
        const contactIds = contactsData.map((c) => c.id);
        if (activeTab === 'customer') {
          let salesQuery = supabase
            .from('sales')
            .select('id, customer_id, branch_id, net_amount, paid_amount')
            .in('customer_id', contactIds);

          if (role !== 'owner' && userProfile?.branch_id) {
            salesQuery = salesQuery.eq('branch_id', userProfile.branch_id);
          } else if (role === 'owner' && filterBranchId && filterBranchId !== 'all') {
            salesQuery = salesQuery.eq('branch_id', filterBranchId);
          }

          const { data: salesData } = await salesQuery;
          setSales(salesData || []);
        } else {
          let purchasesQuery = supabase
            .from('purchases')
            .select('id, supplier_id, branch_id, net_amount, paid_amount')
            .in('supplier_id', contactIds);

          if (role !== 'owner' && userProfile?.branch_id) {
            purchasesQuery = purchasesQuery.eq('branch_id', userProfile.branch_id);
          } else if (role === 'owner' && filterBranchId && filterBranchId !== 'all') {
            purchasesQuery = purchasesQuery.eq('branch_id', filterBranchId);
          }

          const { data: purchasesData } = await purchasesQuery;
          setPurchases(purchasesData || []);
        }
      } else {
        setSales([]);
        setPurchases([]);
      }
    } catch (err) {
      console.error(err);
      showMessage('Failed to load contacts and financial balances.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, activeTab, searchQuery, filterBranchId, role, userProfile?.branch_id]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    if (!filterBranchId && branches.length > 0) {
      if (userProfile?.role === 'owner') {
        setFilterBranchId('all');
      } else {
        setFilterBranchId(userProfile?.branch_id || branches[0].id);
      }
    }
  }, [branches, userProfile, filterBranchId]);

  const handleSaveContact = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName) {
      showMessage('Please enter a valid name.', 'error');
      return;
    }

    if (!trimmedPhone) {
      showMessage('Phone number is mandatory. Please enter a valid phone number.', 'error');
      return;
    }

    if (!/^\+?[0-9\s\-()]{7,15}$/.test(trimmedPhone)) {
      showMessage('Please enter a valid phone number (7-15 digits).', 'error');
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      showMessage('Please enter a valid email address.', 'error');
      return;
    }

    setLoading(true);
    try {
      // Duplicate phone check
      let dupQuery = supabase
        .from('contacts')
        .select('id, name, phone, type')
        .eq('phone', trimmedPhone)
        .eq('type', activeTab);

      if (isEditing && editingId) {
        dupQuery = dupQuery.neq('id', editingId);
      }

      const { data: dupData, error: dupError } = await dupQuery;
      if (dupError) throw dupError;

      if (dupData && dupData.length > 0) {
        const existing = dupData[0];
        const typeLabel = activeTab === 'customer' ? 'Buyer' : 'Supplier';
        showMessage(`A ${typeLabel} with phone "${trimmedPhone}" already exists (${existing.name}).`, 'error');
        setLoading(false);
        return;
      }

      const editingContact = isEditing ? contacts.find(c => c.id === editingId) : null;
      const isEditingFactory = isFactoryContact(editingContact);

      const payload = {
        name: isEditingFactory ? editingContact.name : trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail || null,
        address: trimmedAddress || null,
      };
      if (branchId) {
        payload.branch_id = branchId;
      }

      if (isEditing) {
        let updateRes = await supabase
          .from('contacts')
          .update(payload)
          .eq('id', editingId);

        if (updateRes.error && updateRes.error.message?.includes('branch_id')) {
          delete payload.branch_id;
          updateRes = await supabase
            .from('contacts')
            .update(payload)
            .eq('id', editingId);
        }

        if (updateRes.error) throw updateRes.error;
        showMessage('Contact profile updated successfully!', 'success');
      } else {
        payload.type = activeTab;
        let insertRes = await supabase
          .from('contacts')
          .insert([payload]);

        if (insertRes.error && insertRes.error.message?.includes('branch_id')) {
          delete payload.branch_id;
          insertRes = await supabase
            .from('contacts')
            .insert([payload]);
        }

        if (insertRes.error) throw insertRes.error;
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

  const isFactoryContact = (contact) => {
    if (!contact) return false;
    const cName = (contact.name || '').toLowerCase().trim();
    return cName === 'chittagong factory' || cName.includes('factory');
  };

  const handleEdit = (contact) => {
    setIsEditing(true);
    setEditingId(contact.id);
    setName(contact.name || '');
    setPhone(contact.phone || '');
    setEmail(contact.email || '');
    setAddress(contact.address || '');
    setBranchId(contact.branch_id || getContactBranch(contact)?.id || '');
    setShowCreateModal(true);
  };

  const handleDelete = async (contact) => {
    const contactId = typeof contact === 'object' ? contact.id : contact;
    const contactName = typeof contact === 'object' ? contact.name : 'this contact';
    const contactType = typeof contact === 'object' ? contact.type : activeTab;

    if (isFactoryContact(typeof contact === 'object' ? contact : contacts.find(c => c.id === contactId))) {
      showMessage('The Factory supplier contact is a permanent system record and cannot be deleted.', 'error');
      return;
    }

    // 1. Instant check against in-memory dues for the contact
    const inMemoryDue = typeof contact === 'object' ? getContactBalance(contact) : 0;
    if (inMemoryDue > 0.01) {
      showMessage(
        `Cannot delete "${contactName}": Outstanding balance of ৳${formatAmount(inMemoryDue)}. Settle all dues first.`,
        'error'
      );
      return;
    }

    try {
      // 2. Validate against transaction history
      if (contactType === 'customer') {
        const { data: salesData, error: sErr } = await supabase
          .from('sales')
          .select('id, net_amount, paid_amount')
          .eq('customer_id', contactId);

        if (sErr) throw sErr;

        if (salesData && salesData.length > 0) {
          const totalDue = salesData.reduce(
            (sum, s) => sum + (parseFloat(s.net_amount || 0) - parseFloat(s.paid_amount || 0)),
            0
          );
          if (totalDue > 0.01) {
            showMessage(
              `Cannot delete "${contactName}": Outstanding due of ৳${formatAmount(totalDue)}. Settle all dues first.`,
              'error'
            );
            return;
          }
          showMessage(
            `Cannot delete "${contactName}": Linked with ${salesData.length} invoice record${salesData.length > 1 ? 's' : ''}. Editing or archiving is recommended.`,
            'error'
          );
          return;
        }
      } else {
        const { data: purchasesData, error: pErr } = await supabase
          .from('purchases')
          .select('id, net_amount, paid_amount')
          .eq('supplier_id', contactId);

        if (pErr) throw pErr;

        if (purchasesData && purchasesData.length > 0) {
          const totalDue = purchasesData.reduce(
            (sum, p) => sum + (parseFloat(p.net_amount || 0) - parseFloat(p.paid_amount || 0)),
            0
          );
          if (totalDue > 0.01) {
            showMessage(
              `Cannot delete "${contactName}": Outstanding payable of ৳${formatAmount(totalDue)}. Settle all dues first.`,
              'error'
            );
            return;
          }
          showMessage(
            `Cannot delete "${contactName}": Linked with ${purchasesData.length} purchase bill${purchasesData.length > 1 ? 's' : ''}. Editing or archiving is recommended.`,
            'error'
          );
          return;
        }
      }

      if (!window.confirm(`Are you sure you want to delete ${contactType === 'customer' ? 'buyer' : 'supplier'} "${contactName}"?`)) {
        return;
      }

      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;
      showMessage(`${contactType === 'customer' ? 'Buyer' : 'Supplier'} profile deleted successfully.`, 'success');
      
      // Fetch only after successful deletion
      fetchContacts();
      if (editingId === contactId) resetForm();
    } catch (err) {
      console.error(err);
      showMessage('Cannot delete contact. It is referenced in active records.', 'error');
    }
  };

  const getContactBranch = (contact) => {
    if (contact.branch_id) {
      return branches.find((b) => b.id === contact.branch_id);
    }
    if (contact.type === 'customer') {
      const match = sales.find((s) => s.customer_id === contact.id && s.branch_id);
      if (match) return branches.find((b) => b.id === match.branch_id);
    } else {
      const match = purchases.find((p) => p.supplier_id === contact.id && p.branch_id);
      if (match) return branches.find((b) => b.id === match.branch_id);
    }
    return null;
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    if (userProfile?.role === 'owner') {
      const factoryBranch = branches.find((b) => b.is_factory || b.name?.toLowerCase().includes('factory'));
      setBranchId(factoryBranch ? factoryBranch.id : (branches.length > 0 ? branches[0].id : ''));
    } else {
      setBranchId(userProfile?.branch_id || (branches.length > 0 ? branches[0].id : ''));
    }
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

  const getContactBranchBreakdown = (contact) => {
    const records = contact.type === 'customer'
      ? sales.filter(s => s.customer_id === contact.id)
      : purchases.filter(p => p.supplier_id === contact.id);

    const branchMap = {};
    records.forEach(r => {
      const bId = r.branch_id || 'unknown';
      const due = (parseFloat(r.net_amount) || 0) - (parseFloat(r.paid_amount) || 0);
      if (!branchMap[bId]) {
        const branchObj = branches.find(b => b.id === bId);
        branchMap[bId] = {
          branchId: bId,
          branchName: branchObj ? branchObj.name : 'Unknown Branch',
          isFactory: branchObj?.is_factory || false,
          due: 0,
          total: 0,
          paid: 0
        };
      }
      branchMap[bId].due += due;
      branchMap[bId].total += (parseFloat(r.net_amount) || 0);
      branchMap[bId].paid += (parseFloat(r.paid_amount) || 0);
    });

    return Object.values(branchMap);
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

        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .eq('contact_id', contact.id)
          .order('payment_date', { ascending: false });
        if (paymentsError) throw paymentsError;
        setHistoryPayments(paymentsData || []);
      } else {
        const { data: purchasesData, error: purchasesError } = await supabase
          .from('purchases')
          .select('*')
          .eq('supplier_id', contact.id)
          .order('purchase_date', { ascending: false });
        if (purchasesError) throw purchasesError;

        setHistoryPurchases(purchasesData || []);
        setHistorySales([]);

        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .eq('contact_id', contact.id)
          .order('payment_date', { ascending: false });
        if (paymentsError) throw paymentsError;
        setHistoryPayments(paymentsData || []);
      }
    } catch (err) {
      console.error('Error loading transaction history:', err);
      showMessage('Failed to load transaction history.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const getInvoiceNumber = (payment) => {
    if (payment.reference_invoice_id) {
      const match = historySales.find((s) => s.id === payment.reference_invoice_id) || historyPurchases.find((p) => p.id === payment.reference_invoice_id);
      return match ? (match.invoice_number || `INV#${match.id.substring(0, 8).toUpperCase()}`) : `REF#${payment.reference_invoice_id.substring(0, 8).toUpperCase()}`;
    }
    return payment.notes || 'Collection / Payout';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="top-bar">
        <div className="page-title-group">
          <h1>Contacts</h1>
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
            <span>New {activeTab === 'customer' ? 'Customer' : 'Supplier'}</span>
          </button>
        </div>
      </div>

      {/* Tab Controls */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1rem' }}>
        <button
          className={`btn ${activeTab === 'customer' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setActiveTab('customer');
            setPage(1);
            resetForm();
          }}
        >
          <Users size={16} />
          <span>Customers</span>
        </button>
        <button
          className={`btn ${activeTab === 'supplier' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setActiveTab('supplier');
            setPage(1);
            resetForm();
          }}
        >
          <Building size={16} />
          <span>Suppliers</span>
        </button>
      </div>

      {/* Directory List occupying full width */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Search bar & Branch filter */}
        <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-control"
              style={{ paddingLeft: '2.25rem' }}
              placeholder={`Search ${activeTab === 'customer' ? 'customers' : 'suppliers'}...`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {role === 'owner' ? (
            branches.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Branch:</span>
                <select
                  className="input-control"
                  value={filterBranchId}
                  onChange={(e) => {
                    setFilterBranchId(e.target.value);
                    setPage(1);
                  }}
                  style={{ width: '180px', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
                >
                  <option value="all">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.is_factory ? `🏭 ${b.name}` : `🏪 ${b.name}`}
                    </option>
                  ))}
                </select>
              </div>
            )
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span 
                className="badge" 
                style={{ 
                  backgroundColor: '#e0f2fe', 
                  color: '#0369a1', 
                  border: '1px solid #bae6fd', 
                  fontSize: '0.78rem', 
                  fontWeight: 600,
                  padding: '0.35rem 0.65rem'
                }}
              >
                🏪 {branches.find(b => b.id === userProfile?.branch_id)?.name || 'My Branch'}
              </span>
            </div>
          )}
        </div>

        {/* Table list (Desktop View) */}
        <div className="table-container hide-on-mobile" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>SL</th>
                <th>Name</th>
                <th>Branch</th>
                <th>Contact Info</th>
                <th>Outstanding Balance</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoading colSpan={6} message="Fetching contacts records..." />
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                    No contacts found.
                  </td>
                </tr>
              ) : (
                contacts.map((c, index) => {
                  const balance = getContactBalance(c);
                  const isCustomer = c.type === 'customer';
                  const br = getContactBranch(c);
                  const rowNumber = (page - 1) * pageSize + index + 1;
                  return (
                    <tr key={c.id}>
                      <td>{rowNumber}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                          {isFactoryContact(c) && (
                            <span
                              style={{
                                backgroundColor: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                              }}
                            >
                              🏭 Factory Contact
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Added {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        {br ? (
                          <span 
                            className="badge"
                            style={{ 
                              backgroundColor: br.is_factory ? '#fef3c7' : '#e0f2fe',
                              color: br.is_factory ? '#92400e' : '#0369a1',
                              border: br.is_factory ? '1px solid #fde68a' : '1px solid #bae6fd',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            {br.is_factory ? '🏭' : '🏪'} {br.name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Global</span>
                        )}
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
                        {role === 'owner' && filterBranchId === 'all' ? (
                          (() => {
                            const branchList = getContactBranchBreakdown(c).filter(b => Math.abs(b.due) > 0.001);
                            if (branchList.length === 0) {
                              return (
                                <div>
                                  <span style={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: 'var(--text-muted)' }}>
                                    ৳0
                                  </span>
                                  <span style={{ fontSize: '0.72rem', display: 'block', color: 'var(--text-muted)' }}>
                                    Cleared
                                  </span>
                                </div>
                              );
                            }
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                {branchList.map(b => (
                                  <div 
                                    key={b.branchId} 
                                    style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '0.35rem',
                                      padding: '0.2rem 0.45rem',
                                      backgroundColor: b.isFactory ? '#fef3c7' : '#f0fdf4',
                                      borderRadius: '4px',
                                      border: `1px solid ${b.isFactory ? '#fde68a' : '#bbf7d0'}`,
                                      width: 'fit-content'
                                    }}
                                  >
                                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: b.isFactory ? '#92400e' : '#166534' }}>
                                      {b.isFactory ? '🏭' : '🏪'} {b.branchName}:
                                    </span>
                                    <span style={{ 
                                      fontSize: '0.78rem',
                                      fontWeight: 700, 
                                      fontFamily: 'Outfit, sans-serif',
                                      color: b.due > 0 ? (isCustomer ? 'var(--primary)' : 'var(--danger-text)') : 'var(--text-muted)'
                                    }}>
                                      ৳{formatAmount(b.due)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()
                        ) : (
                          <div>
                            <span 
                              style={{ 
                                fontWeight: 700, 
                                fontFamily: 'Outfit, sans-serif',
                                color: balance > 0 ? (isCustomer ? 'var(--primary)' : 'var(--danger-text)') : 'var(--text-muted)'
                              }}
                            >
                              ৳{formatAmount(balance)}
                            </span>
                            <span style={{ fontSize: '0.72rem', display: 'block', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                              {balance > 0 ? (isCustomer ? 'Receivable' : 'Payable') : 'Cleared'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => handleOpenHistory(c)}
                            title="Transaction History"
                            style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                          >
                            <History size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => handleEdit(c)}
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          {role === 'owner' && !isFactoryContact(c) && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm btn-icon"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => handleDelete(c)}
                              title="Delete"
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

        {/* Mobile Card List View */}
        <div className="hide-on-desktop" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              Fetching contacts records...
            </div>
          ) : contacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No contacts found.
            </div>
          ) : (
            contacts.map((c, index) => {
              const balance = getContactBalance(c);
              const isCustomer = c.type === 'customer';
              const br = getContactBranch(c);
              const rowNumber = (page - 1) * pageSize + index + 1;

              return (
                <div
                  key={c.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  {/* Top Bar: SL Badge, Name, Badges */}
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
                        {c.name}
                      </span>
                      {isFactoryContact(c) && (
                        <span
                          style={{
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                          }}
                        >
                          🏭 Factory Contact
                        </span>
                      )}
                    </div>
                    {br ? (
                      <span 
                        className="badge"
                        style={{ 
                          backgroundColor: br.is_factory ? '#fef3c7' : '#e0f2fe',
                          color: br.is_factory ? '#92400e' : '#0369a1',
                          border: br.is_factory ? '1px solid #fde68a' : '1px solid #bae6fd',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                        }}
                      >
                        {br.is_factory ? '🏭' : '🏪'} {br.name}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Global</span>
                    )}
                  </div>

                  {/* Contact Info (Phone, Email, Address) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.82rem' }}>
                    {c.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                        <a href={`tel:${c.phone}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                          {c.phone}
                        </a>
                      </div>
                    )}
                    {c.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Mail size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>{c.email}</span>
                      </div>
                    )}
                    {c.address && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        📍 {c.address}
                      </div>
                    )}
                  </div>

                  {/* Balance / Outstanding Strip */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                    backgroundColor: '#f8fafc',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #f1f5f9',
                    fontSize: '0.82rem',
                  }}>
                    {role === 'owner' && filterBranchId === 'all' ? (
                      (() => {
                        const branchList = getContactBranchBreakdown(c).filter((b) => Math.abs(b.due) > 0.001);
                        if (branchList.length === 0) {
                          return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                Outstanding Balance
                              </span>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: 'var(--text-muted)' }}>
                                  ৳0
                                </span>
                                <span style={{ fontSize: '0.68rem', display: 'block', color: 'var(--text-muted)' }}>
                                  Cleared
                                </span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', fontWeight: 600 }}>
                              {isCustomer ? 'Branch-wise Receivables:' : 'Branch-wise Payables:'}
                            </span>
                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.35rem',
                            }}>
                              {branchList.map((b) => (
                                <div
                                  key={b.branchId}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    padding: '0.2rem 0.45rem',
                                    backgroundColor: b.isFactory ? '#fef3c7' : '#f0fdf4',
                                    borderRadius: '4px',
                                    border: `1px solid ${b.isFactory ? '#fde68a' : '#bbf7d0'}`,
                                    fontSize: '0.74rem',
                                  }}
                                >
                                  <span style={{ fontWeight: 600, color: b.isFactory ? '#92400e' : '#166534' }}>
                                    {b.isFactory ? '🏭' : '🏪'} {b.branchName}:
                                  </span>
                                  <span style={{
                                    fontWeight: 700,
                                    fontFamily: 'Outfit, sans-serif',
                                    color: b.due > 0 ? (isCustomer ? 'var(--primary)' : 'var(--danger-text)') : 'var(--text-muted)',
                                  }}>
                                    ৳{formatAmount(b.due)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {isCustomer ? 'Receivable Balance' : 'Payable Balance'}
                        </span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ 
                            fontWeight: 800, 
                            fontFamily: 'Outfit, sans-serif',
                            fontSize: '0.92rem',
                            color: balance > 0 ? (isCustomer ? 'var(--primary)' : 'var(--danger-text)') : 'var(--text-muted)'
                          }}>
                            ৳{formatAmount(balance)}
                          </span>
                          <span style={{ fontSize: '0.68rem', display: 'block', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                            {balance > 0 ? (isCustomer ? 'Due from Customer' : 'Due to Supplier') : 'Cleared (৳0)'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.15rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenHistory(c)}
                      style={{
                        flex: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        height: '34px',
                        fontSize: '0.8rem',
                        color: 'var(--primary)',
                        backgroundColor: 'var(--primary-light)',
                        border: '1px solid #bae6fd',
                      }}
                    >
                      <History size={14} />
                      <span>History</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleEdit(c)}
                      style={{
                        flex: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        height: '34px',
                        fontSize: '0.8rem',
                        color: '#059669',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                      }}
                    >
                      <Edit size={14} />
                      <span>Edit</span>
                    </button>
                    {role === 'owner' && !isFactoryContact(c) && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-icon"
                        onClick={() => handleDelete(c)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '34px',
                          minWidth: '34px',
                          color: 'var(--danger)',
                          backgroundColor: '#fee2e2',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                        }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Server-Side Pagination */}
        <Pagination
          currentPage={page}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* CREATE / EDIT CONTACT MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '100%' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {isEditing ? 'Edit Contact' : `New ${activeTab === 'customer' ? 'Customer' : 'Supplier'}`}
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
                  <label>Name *</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder={activeTab === 'customer' ? 'Enter customer name' : 'Enter supplier name'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isEditing && isFactoryContact(contacts.find(c => c.id === editingId))}
                    readOnly={isEditing && isFactoryContact(contacts.find(c => c.id === editingId))}
                    style={{
                      backgroundColor: (isEditing && isFactoryContact(contacts.find(c => c.id === editingId))) ? '#f1f5f9' : '#ffffff',
                      cursor: (isEditing && isFactoryContact(contacts.find(c => c.id === editingId))) ? 'not-allowed' : 'text',
                    }}
                    required
                  />
                  {isEditing && isFactoryContact(contacts.find(c => c.id === editingId)) && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                      🔒 Permanent Factory Supplier name cannot be modified. Phone number and address can be updated.
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>Phone *</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="input-control"
                      style={{ paddingLeft: '2.25rem' }}
                      placeholder="01xxxxxxxxx"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="email"
                      className="input-control"
                      style={{ paddingLeft: '2.25rem' }}
                      placeholder="Enter email (optional)"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Address</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={14} style={{ position: 'absolute', left: '0.75rem', top: '0.75rem', color: 'var(--text-muted)' }} />
                    <textarea
                      className="input-control"
                      style={{ paddingLeft: '2.25rem', minHeight: '80px', resize: 'vertical' }}
                      placeholder="Enter address (optional)..."
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>

                {role === 'owner' ? (
                  branches.length > 0 && (
                    <div className="form-group">
                      <label>Branch</label>
                      <select
                        className="input-control"
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                      >
                        <option value="">-- All Branches --</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.is_factory ? `🏭 ${b.name}` : `🏪 ${b.name}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                ) : (
                  <div className="form-group">
                    <label>Branch</label>
                    <input
                      type="text"
                      className="input-control"
                      value={`🏪 ${branches.find(b => b.id === userProfile?.branch_id)?.name || 'Assigned Branch'}`}
                      disabled
                      style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                    />
                  </div>
                )}
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
                  {loading ? 'Saving...' : isEditing ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSACTION & PAYMENT HISTORY MODAL */}
      {showHistoryModal && historyContact && (() => {
        const historyRecords = historyContact.type === 'customer' ? historySales : historyPurchases;
        const totalAmount = historyRecords.reduce((sum, item) => sum + (parseFloat(item.net_amount) || 0), 0);
        const totalPaid = historyPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const totalDue = historyRecords.reduce((sum, item) => sum + ((parseFloat(item.net_amount) || 0) - (parseFloat(item.paid_amount) || 0)), 0);

        // Calculate branch breakdown for history modal
        const branchBreakdownMap = {};
        historyRecords.forEach(r => {
          const bId = r.branch_id || 'unknown';
          const due = (parseFloat(r.net_amount) || 0) - (parseFloat(r.paid_amount) || 0);
          if (!branchBreakdownMap[bId]) {
            const branchObj = branches.find(b => b.id === bId);
            branchBreakdownMap[bId] = {
              branchId: bId,
              branchName: branchObj ? branchObj.name : 'Unknown Branch',
              isFactory: branchObj?.is_factory || false,
              total: 0,
              paid: 0,
              due: 0
            };
          }
          branchBreakdownMap[bId].total += (parseFloat(r.net_amount) || 0);
          branchBreakdownMap[bId].paid += (parseFloat(r.paid_amount) || 0);
          branchBreakdownMap[bId].due += due;
        });
        const historyBranchBreakdown = Object.values(branchBreakdownMap);

        return (
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
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                      {historyContact.type === 'customer' ? 'Total Sales' : 'Total Purchases'}
                    </span>
                    <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      ৳{formatAmount(totalAmount)}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                      Total Paid
                    </span>
                    <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: 'var(--success-text)' }}>
                      ৳{formatAmount(totalPaid)}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                      Total Due
                    </span>
                    <span 
                      style={{ 
                        fontFamily: 'Outfit, sans-serif', 
                        fontSize: '1.25rem', 
                        fontWeight: 800, 
                        color: totalDue > 0 ? (historyContact.type === 'customer' ? 'var(--primary)' : 'var(--danger-text)') : 'var(--text-muted)'
                      }}
                    >
                      ৳{formatAmount(totalDue)}
                    </span>
                  </div>
                </div>

                {/* Branch-wise breakdown strip (if multiple branches or when viewed by owner) */}
                {historyBranchBreakdown.length > 1 && (
                  <div 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.5rem', 
                      backgroundColor: '#f8fafc', 
                      padding: '0.75rem 1rem', 
                      borderRadius: 'var(--border-radius)', 
                      border: '1px solid var(--border-color)' 
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Branch-wise Breakdown:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                      {historyBranchBreakdown.map((b) => (
                        <div 
                          key={b.branchId} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.45rem', 
                            backgroundColor: '#ffffff', 
                            padding: '0.35rem 0.65rem', 
                            borderRadius: '6px', 
                            border: '1px solid var(--border-color)', 
                            fontSize: '0.76rem' 
                          }}
                        >
                          <span style={{ fontWeight: 600, color: b.isFactory ? '#92400e' : '#0369a1' }}>
                            {b.isFactory ? '🏭' : '🏪'} {b.branchName}
                          </span>
                          <span style={{ color: 'var(--border-color)' }}>|</span>
                          <span style={{ color: 'var(--text-muted)' }}>Net: <strong style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>৳{formatAmount(b.total)}</strong></span>
                          <span style={{ color: 'var(--border-color)' }}>|</span>
                          <span style={{ color: 'var(--text-muted)' }}>Paid: <strong style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--success-text)' }}>৳{formatAmount(b.paid)}</strong></span>
                          <span style={{ color: 'var(--border-color)' }}>|</span>
                          <span style={{ color: 'var(--text-muted)' }}>Due: <strong style={{ fontFamily: 'Outfit, sans-serif', color: b.due > 0 ? 'var(--danger-text)' : 'inherit' }}>৳{formatAmount(b.due)}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {loadingHistory ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading history...
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                    
                    {/* Left: Invoice/Purchases Logs */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Receipt size={16} className="text-muted" />
                        <span>{historyContact.type === 'customer' ? 'Sales Invoices' : 'Purchase Bills'}</span>
                      </h4>
                      <div className="table-container" style={{ overflowY: 'auto', maxHeight: '420px' }}>
                        <table style={{ fontSize: '0.8rem' }}>
                          <thead>
                            <tr>
                              <th>SL</th>
                              <th>Invoice ID</th>
                              <th>Branch</th>
                              <th>Date</th>
                              <th>Net Total</th>
                              <th>Due</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyRecords.length === 0 ? (
                              <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem' }}>No records found.</td>
                              </tr>
                            ) : (
                              historyRecords.map((inv, index) => {
                                const due = (parseFloat(inv.net_amount) || 0) - (parseFloat(inv.paid_amount) || 0);
                                const invBranch = branches.find((b) => b.id === inv.branch_id);
                                return (
                                  <tr key={inv.id}>
                                    <td>{index + 1}</td>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                      {inv.invoice_number || `ID-${inv.id.substring(0, 5).toUpperCase()}`}
                                    </td>
                                    <td style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                      {invBranch ? (invBranch.is_factory ? `🏭 ${invBranch.name}` : `🏪 ${invBranch.name}`) : '—'}
                                    </td>
                                    <td>{new Date(inv.sale_date || inv.purchase_date).toLocaleDateString()}</td>
                                    <td style={{ fontFamily: 'Outfit, sans-serif' }}>৳{formatAmount(inv.net_amount)}</td>
                                    <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: due > 0 ? 'var(--danger-text)' : 'inherit' }}>
                                      ৳{formatAmount(due)}
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
                        <span>Payment History</span>
                      </h4>
                      <div className="table-container" style={{ overflowY: 'auto', maxHeight: '420px' }}>
                        <table style={{ fontSize: '0.8rem' }}>
                          <thead>
                            <tr>
                              <th>SL</th>
                              <th>Receipt ID</th>
                              <th>Branch</th>
                              <th>Date</th>
                              <th>Invoice Reference</th>
                              <th>Amount</th>
                              <th>Mode</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyPayments.length === 0 ? (
                              <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem' }}>No payments found.</td>
                              </tr>
                            ) : (
                              historyPayments.map((pay, index) => {
                                const payBranch = branches.find((b) => b.id === pay.branch_id);
                                return (
                                  <tr key={pay.id}>
                                    <td>{index + 1}</td>
                                    <td style={{ fontFamily: 'monospace' }}>
                                      {pay.payment_number || `PM-${pay.id.substring(0, 5).toUpperCase()}`}
                                    </td>
                                    <td style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                      {payBranch ? (payBranch.is_factory ? `🏭 ${payBranch.name}` : `🏪 ${payBranch.name}`) : '—'}
                                    </td>
                                    <td>{new Date(pay.payment_date).toLocaleDateString()}</td>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                      {getInvoiceNumber(pay)}
                                    </td>
                                    <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: 'var(--success-text)' }}>
                                      ৳{formatAmount(pay.amount)}
                                    </td>
                                    <td style={{ textTransform: 'capitalize' }}>
                                      {pay.payment_method ? pay.payment_method.replace('_', ' ') : '—'}
                                    </td>
                                  </tr>
                                );
                              })
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
