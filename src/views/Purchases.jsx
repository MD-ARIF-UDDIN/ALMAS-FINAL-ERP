import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Download, Plus, Search, Trash2, UserPlus, CreditCard } from 'lucide-react';
import { TableLoading } from '../components/TableLoading';
import Pagination from '../components/Pagination';

export default function Purchases({ userProfile, branches, addToast }) {
  const location = useLocation();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  
  // Pagination & Search states
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [purchasesPageSize, setPurchasesPageSize] = useState(25);
  const [purchasesTotalCount, setPurchasesTotalCount] = useState(0);
  const [purchaseSearchQuery, setPurchaseSearchQuery] = useState('');

  // View states
  // View Details states
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPurchaseItems, setSelectedPurchaseItems] = useState([]);
  const [selectedPurchasePayments, setSelectedPurchasePayments] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (location.state?.openNewPurchase) {
      setShowPurchaseModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Add Purchase Form states
  const [supplierType, setSupplierType] = useState('existing'); // 'existing' or 'new'
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseItems, setPurchaseItems] = useState([{ productId: '', quantity: 1, costPrice: 0.00 }]); // { product, quantity, costPrice }
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  // New Supplier States
  const [newSupName, setNewSupName] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupAddress, setNewSupAddress] = useState('');

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

  // Global lookups: Suppliers and Product catalog are fetched on mount
  useEffect(() => {
    fetchSuppliers();
    fetchCatalogProducts();
  }, []);

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const fetchPurchases = useCallback(async () => {
    if (!selectedBranchId) return;
    setLoading(true);
    try {
      const from = (purchasesPage - 1) * purchasesPageSize;
      const to = from + purchasesPageSize - 1;

      let query = supabase
        .from('purchases')
        .select(`
          *,
          contacts (
            name,
            phone,
            address,
            email
          )
        `, { count: 'exact' })
        .order('purchase_date', { ascending: false })
        .range(from, to);

      if (userProfile?.role === 'owner') {
        if (selectedBranchId && selectedBranchId !== 'all') {
          query = query.eq('branch_id', selectedBranchId);
        }
      } else if (selectedBranchId) {
        query = query.eq('branch_id', selectedBranchId);
      }

      if (purchaseSearchQuery.trim()) {
        query = query.ilike('invoice_number', `%${purchaseSearchQuery.trim()}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      setPurchases(data || []);
      setPurchasesTotalCount(count || 0);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load purchases history.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, purchasesPage, purchasesPageSize, purchaseSearchQuery, userProfile?.role]);

  // Branch purchases fetched whenever selected branch changes
  useEffect(() => {
    if (selectedBranchId) {
      fetchPurchases();
    }
  }, [selectedBranchId, fetchPurchases]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('type', 'supplier')
        .order('name', { ascending: true });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCatalogProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCatalogProducts(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewPurchaseDetails = async (purchase) => {
    setSelectedPurchase(purchase);
    setShowDetailModal(true);
    setLoadingDetails(true);
    try {
      // 1. Fetch purchase items
      const { data: items, error: itemsError } = await supabase
        .from('purchase_items')
        .select(`
          *,
          products (
            name,
            sku,
            unit
          )
        `)
        .eq('purchase_id', purchase.id);
      if (itemsError) throw itemsError;
      setSelectedPurchaseItems(items || []);

      // 2. Fetch payments
      const { data: payHistory, error: payError } = await supabase
        .from('payments')
        .select('*')
        .eq('purchase_id', purchase.id)
        .order('payment_date', { ascending: true });
      if (payError) throw payError;
      setSelectedPurchasePayments(payHistory || []);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load purchase details and payment history.', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };



  const addItemToPurchase = () => {
    setPurchaseItems([...purchaseItems, { productId: '', quantity: 1, costPrice: 0.00 }]);
  };

  const updateItemField = (index, field, value) => {
    const updated = purchaseItems.map((item, idx) => {
      if (idx === index) {
        const updatedItem = { ...item, [field]: value };
        // Auto-populate default cost price if product is selected
        if (field === 'productId') {
          const matchedProd = catalogProducts.find((p) => p.id === value);
          if (matchedProd) {
            updatedItem.costPrice = matchedProd.purchase_price;
          }
        }
        return updatedItem;
      }
      return item;
    });
    setPurchaseItems(updated);
  };

  const removeItemFromPurchase = (index) => {
    if (purchaseItems.length <= 1) {
      showMessage('At least one product row must remain in the purchase bill.', 'error');
      return;
    }
    setPurchaseItems(purchaseItems.filter((_, idx) => idx !== index));
  };

  // Math Calculations
  const getSubtotal = () => {
    return purchaseItems.reduce((sum, item) => sum + (parseFloat(item.costPrice) || 0) * (parseInt(item.quantity) || 0), 0);
  };

  const getGrandTotal = () => {
    const sub = getSubtotal();
    return Math.max(0, sub - parseFloat(discount || 0));
  };

  const handleSavePurchase = async (e) => {
    e.preventDefault();
    
    let supplierId = selectedSupplierId;
    
    if (supplierType === 'new') {
      if (!newSupName.trim()) {
        showMessage('Please enter a Supplier Name.', 'error');
        return;
      }
      if (newSupPhone.trim() && !/^\+?[0-9\s\-()]{7,15}$/.test(newSupPhone.trim())) {
        showMessage('Please enter a valid supplier phone number (7-15 digits).', 'error');
        return;
      }
    } else {
      if (!selectedSupplierId) {
        showMessage('Supplier selection is required.', 'error');
        return;
      }
    }

    if (purchaseItems.length === 0 || purchaseItems.some((item) => !item.productId)) {
      showMessage('Please add valid products to purchase.', 'error');
      return;
    }

    const subtotal = getSubtotal();
    const discVal = parseFloat(discount) || 0;
    const initialPaid = parseFloat(paidAmount) || 0;
    const grandTotal = getGrandTotal();

    for (const item of purchaseItems) {
      const q = parseInt(item.quantity);
      const cp = parseFloat(item.costPrice);
      if (isNaN(q) || q <= 0) {
        showMessage('Item quantities must be positive integers.', 'error');
        return;
      }
      if (isNaN(cp) || cp < 0) {
        showMessage('Cost price cannot be negative.', 'error');
        return;
      }
    }

    if (discVal < 0) {
      showMessage('Discount cannot be negative.', 'error');
      return;
    }
    if (discVal > subtotal) {
      showMessage('Discount cannot exceed the total purchase bill.', 'error');
      return;
    }
    if (initialPaid < 0) {
      showMessage('Initial payment cannot be negative.', 'error');
      return;
    }
    if (initialPaid > grandTotal + 0.01) {
      showMessage(`Initial payment cannot exceed the grand total of ৳${grandTotal.toFixed(2)}.`, 'error');
      return;
    }

    setLoading(true);
    try {
      // Create contact if it's a new supplier
      if (supplierType === 'new') {
        const trimmedSupName = newSupName.trim();
        const trimmedSupPhone = newSupPhone.trim();
        const trimmedSupAddress = newSupAddress.trim();

        if (!trimmedSupName) {
          showMessage('Please enter the supplier name.', 'error');
          setLoading(false);
          return;
        }

        if (!trimmedSupPhone) {
          showMessage('Supplier phone number is mandatory.', 'error');
          setLoading(false);
          return;
        }

        if (!/^\+?[0-9\s\-()]{7,15}$/.test(trimmedSupPhone)) {
          showMessage('Please enter a valid supplier phone number (7-15 digits).', 'error');
          setLoading(false);
          return;
        }

        // Duplicate phone check for supplier
        const { data: dupSup, error: dupErr } = await supabase
          .from('contacts')
          .select('id, name, phone')
          .eq('phone', trimmedSupPhone)
          .eq('type', 'supplier');

        if (dupErr) throw dupErr;

        if (dupSup && dupSup.length > 0) {
          showMessage(`A supplier with phone "${trimmedSupPhone}" already exists (${dupSup[0].name}). Please select them from the supplier list.`, 'error');
          setLoading(false);
          return;
        }

        const { data: contactData, error: contactError } = await supabase
          .from('contacts')
          .insert([
            {
              type: 'supplier',
              name: trimmedSupName,
              phone: trimmedSupPhone,
              address: trimmedSupAddress || null,
              branch_id: selectedBranchId,
            }
          ])
          .select()
          .single();

        if (contactError) throw contactError;
        supplierId = contactData.id;
      }

      const subtotal = getSubtotal();
      const grandTotal = getGrandTotal();
      const initialPaid = parseFloat(paidAmount) || 0.00;

      // 1. Insert Purchase Invoice
      const { data: purData, error: purError } = await supabase
        .from('purchases')
        .insert([
          {
            branch_id: selectedBranchId,
            supplier_id: supplierId,
            purchase_date: purchaseDate,
            total_amount: subtotal,
            discount: parseFloat(discount),
            net_amount: grandTotal,
            paid_amount: 0.00, // Trigger computes this
            payment_status: 'unpaid', // Trigger computes this
            created_by: userProfile.id,
            notes: notes || null,
          },
        ])
        .select();

      if (purError) throw purError;
      const purchaseId = purData[0].id;

      // 2. Insert Purchase Items (Triggers stock increases automatically)
      const purchaseItemsData = purchaseItems.map((item) => ({
        purchase_id: purchaseId,
        product_id: item.productId,
        quantity: parseInt(item.quantity),
        unit_price: parseFloat(item.costPrice),
        total_price: parseFloat(item.costPrice) * parseInt(item.quantity),
      }));

      const { error: itemsError } = await supabase.from('purchase_items').insert(purchaseItemsData);
      if (itemsError) throw itemsError;

      // 3. Register payment if initial amount paid
      if (initialPaid > 0) {
        const { error: paymentError } = await supabase.from('payments').insert([
          {
            branch_id: selectedBranchId,
            contact_id: supplierId,
            amount: initialPaid,
            payment_method: paymentMethod,
            transaction_type: 'supplier_payment',
            reference_invoice_id: purchaseId,
            notes: referenceNumber ? `Trx Ref: ${referenceNumber}` : null,
            created_by: userProfile.id,
          },
        ]);
        if (paymentError) throw paymentError;

        // Log transaction to cash ledger
        const { error: ledgerError } = await supabase.from('cash_ledger').insert([
          {
            branch_id: selectedBranchId,
            amount_in: 0,
            amount_out: initialPaid,
            reference_id: purchaseId,
            description: `Supplier Purchase Payout: Bill #${purData[0].invoice_number || purchaseId.substring(0, 8)} (${paymentMethod})`,
            transaction_date: new Date().toISOString(),
            created_by: userProfile.id,
          },
        ]);
        if (ledgerError) throw ledgerError;
      }

      showMessage('Purchase record and inventory updated successfully!', 'success');
      // Reset forms
      setSupplierType('existing');
      setSelectedSupplierId('');
      setPurchaseItems([{ productId: '', quantity: 1, costPrice: 0.00 }]);
      setDiscount(0);
      setPaidAmount('');
      setReferenceNumber('');
      setNotes('');
      setNewSupName('');
      setNewSupPhone('');
      setNewSupAddress('');
      setProductSearchQuery('');
      setShowSearchSuggestions(false);
      setShowPurchaseModal(false);
      
      // Refresh history list
      fetchPurchases();
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Error occurred saving purchase.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="top-bar">
        <div className="page-title-group">
          <h1>Purchases</h1>
        </div>
        <div className="top-bar-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {userProfile?.role === 'owner' && (
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
          )}
          <button className="btn btn-primary" onClick={() => {
            setPurchaseItems([{ productId: '', quantity: 1, costPrice: 0.00 }]);
            setSupplierType('existing');
            setSelectedSupplierId('');
            setDiscount(0);
            setPaidAmount('');
            setReferenceNumber('');
            setNotes('');
            setNewSupName('');
            setNewSupPhone('');
            setNewSupAddress('');
            setProductSearchQuery('');
            setShowSearchSuggestions(false);
            setShowPurchaseModal(true);
          }}>
            <Plus size={16} />
            <span>New Purchase</span>
          </button>
        </div>
      </div>

      {/* VIEW: PURCHASE LIST */}
      <div className="no-print card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '1rem 1.25rem' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Purchase History</h3>
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-control"
                style={{ paddingLeft: '2.25rem', padding: '0.35rem 0.6rem 0.35rem 2.25rem', fontSize: '0.82rem' }}
                placeholder="Search purchase ID..."
                value={purchaseSearchQuery}
                onChange={(e) => {
                  setPurchaseSearchQuery(e.target.value);
                  setPurchasesPage(1);
                }}
              />
            </div>
          </div>
          <div className="table-container" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>SL</th>
                  <th>Purchase ID</th>
                  {userProfile?.role === 'owner' && <th>Branch</th>}
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Total Bill</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoading colSpan={userProfile?.role === 'owner' ? 9 : 8} message="Fetching purchase records..." />
                ) : purchases.length === 0 ? (
                  <tr>
                    <td colSpan={userProfile?.role === 'owner' ? 9 : 8} style={{ textAlign: 'center', padding: '2rem' }}>
                      No purchases logged. Click "New Purchase" to add items to stock.
                    </td>
                  </tr>
                ) : (
                  purchases.map((p, index) => {
                    const rowNumber = (purchasesPage - 1) * purchasesPageSize + index + 1;
                    return (
                      <tr key={p.id}>
                        <td>{rowNumber}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700 }}>
                          {p.invoice_number || `PUR#${p.id.substring(0, 8).toUpperCase()}`}
                        </td>
                        {userProfile?.role === 'owner' && (
                          <td style={{ fontWeight: 600 }}>{branches.find(b => b.id === p.branch_id)?.name || 'Unknown'}</td>
                        )}
                        <td>{new Date(p.purchase_date).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {p.contacts?.name || 'Unknown Supplier'}
                        </td>
                        <td style={{ fontFamily: 'Outfit, sans-serif' }}>৳{p.net_amount.toFixed(2)}</td>
                        <td style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--success-text)' }}>
                          ৳{p.paid_amount.toFixed(2)}
                        </td>
                        <td>
                          <span className={`badge badge-${p.payment_status}`}>{p.payment_status}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleViewPurchaseDetails(p)}
                            title="View Details"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={purchasesPage}
            totalCount={purchasesTotalCount}
            pageSize={purchasesPageSize}
            onPageChange={setPurchasesPage}
            onPageSizeChange={setPurchasesPageSize}
          />
        </div>

      {/* RECORD NEW PURCHASE MODAL */}
      {showPurchaseModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-xl">
            <div className="modal-header">
              <h3 className="modal-title">New Purchase</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowPurchaseModal(false)} style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}>✕</button>
            </div>
            <form onSubmit={handleSavePurchase} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body purchase-form-grid">
          {/* Purchase Items Editor */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <div className="form-row">
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>Supplier Type</label>
                <select
                  className="input-control"
                  value={supplierType}
                  onChange={(e) => setSupplierType(e.target.value)}
                >
                  <option value="existing">Existing</option>
                  <option value="new">New</option>
                </select>
              </div>

              <div className="form-group">
                <label>Purchase Date *</label>
                <input
                  type="date"
                  className="input-control"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {supplierType === 'existing' ? (
              <div className="form-row" style={{ marginTop: '0.5rem' }}>
                <div className="form-group">
                  <label>Supplier *</label>
                  <select
                    className="input-control"
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    required={supplierType === 'existing'}
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.phone ? `(${s.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0.75rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem', marginTop: '0.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary)' }}>New Supplier Details</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Supplier Name *</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Enter supplier name"
                      value={newSupName}
                      onChange={(e) => setNewSupName(e.target.value)}
                      required={supplierType === 'new'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone *</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Enter phone number"
                      value={newSupPhone}
                      onChange={(e) => setNewSupPhone(e.target.value)}
                      required={supplierType === 'new'}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Address</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Enter address (optional)"
                      value={newSupAddress}
                      onChange={(e) => setNewSupAddress(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
                    {/* Dynamic Items Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              
              {/* Quick Search & Add Product Bar */}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.82rem' }}>Search & Add Product</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Search product by name or SKU..."
                    value={productSearchQuery}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value);
                      setShowSearchSuggestions(true);
                    }}
                    onFocus={() => setShowSearchSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 250)}
                    style={{ fontSize: '0.85rem' }}
                  />
                  {productSearchQuery && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setProductSearchQuery('');
                        setShowSearchSuggestions(false);
                      }}
                      style={{ padding: '0.35rem 0.65rem' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {showSearchSuggestions && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius-sm)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 999,
                    marginTop: '0.25rem'
                  }}>
                    {catalogProducts
                      .filter(p => {
                        if (!productSearchQuery.trim()) return true;
                        return (
                          p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                          p.sku.toLowerCase().includes(productSearchQuery.toLowerCase())
                        );
                      })
                      .map((prod) => (
                        <div
                          key={prod.id}
                          style={{
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f1f5f9',
                            fontSize: '0.82rem',
                            textAlign: 'left'
                          }}
                          onClick={() => {
                            if (purchaseItems.length === 1 && !purchaseItems[0].productId) {
                              updateItemField(0, 'productId', prod.id);
                            } else {
                              setPurchaseItems([...purchaseItems, { productId: prod.id, quantity: 1, costPrice: prod.purchase_price }]);
                            }
                            setProductSearchQuery('');
                            setShowSearchSuggestions(false);
                            showMessage(`${prod.name} added to list.`, 'success');
                          }}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{prod.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            SKU: {prod.sku} | Cost: ৳{prod.purchase_price.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    {catalogProducts.filter(p => {
                      if (!productSearchQuery.trim()) return true;
                      return (
                        p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                        p.sku.toLowerCase().includes(productSearchQuery.toLowerCase())
                      );
                    }).length === 0 && (
                      <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        No matching products found.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                <label style={{ fontWeight: 600 }}>Products *</label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={addItemToPurchase}
                >
                  + Add Row
                </button>
              </div>

              <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', overflow: 'visible' }}>
                <table style={{ minWidth: '600px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>SL</th>
                      <th>Product *</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>Qty *</th>
                      <th style={{ width: '130px', textAlign: 'right' }}>Cost Price *</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>Total</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ verticalAlign: 'middle', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <select
                            className="input-control"
                            value={item.productId}
                            onChange={(e) => updateItemField(idx, 'productId', e.target.value)}
                            required
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                          >
                            <option value="">-- Select Product --</option>
                            {catalogProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ verticalAlign: 'middle', textAlign: 'right' }}>
                          <input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            className="input-control"
                            value={item.quantity}
                            onChange={(e) => updateItemField(idx, 'quantity', parseInt(e.target.value) || 1)}
                            required
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', textAlign: 'right', width: '90px', marginLeft: 'auto' }}
                          />
                        </td>
                        <td style={{ verticalAlign: 'middle', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Cost"
                            className="input-control"
                            value={item.costPrice}
                            onChange={(e) => updateItemField(idx, 'costPrice', parseFloat(e.target.value) || 0.00)}
                            required
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', textAlign: 'right', width: '120px', marginLeft: 'auto' }}
                          />
                        </td>
                        <td style={{ verticalAlign: 'middle', textAlign: 'right', fontWeight: 600 }}>
                          ৳{((parseFloat(item.costPrice) || 0) * (parseInt(item.quantity) || 0)).toFixed(2)}
                        </td>
                        <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm btn-icon"
                            style={{ border: 'none', background: 'none', color: 'var(--danger)', display: 'inline-flex', padding: '0.25rem' }}
                            onClick={() => removeItemFromPurchase(idx)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Checkout & Bill Summary */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <div className="cart-totals-summary" style={{ background: 'none', padding: 0, border: 'none' }}>
              <div className="totals-row">
                <span>Subtotal</span>
                <span>৳{getSubtotal().toFixed(2)}</span>
              </div>
              <div className="totals-row">
                <span>Discount</span>
                <input
                  type="number"
                  min="0"
                  className="input-control"
                  style={{ width: '120px', padding: '0.25rem 0.5rem', textAlign: 'right' }}
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
              <div className="totals-row grand-total" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                <span>Net Total</span>
                <span>৳{getGrandTotal().toFixed(2)}</span>
              </div>

              <div className="form-group">
                <label>Paid Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={getGrandTotal()}
                  className="input-control"
                  placeholder="0.00"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                />
              </div>

              {parseFloat(paidAmount) > 0 && (
                <div className="form-group">
                  <label>Payment Method</label>
                  <select
                    className="input-control"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                    <option value="mobile_banking">Mobile Banking (bKash/Nagad)</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Reference No</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Check # or Trx ID"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Notes / Challan No</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Enter notes or challan info (optional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

            </div>
          </div>
        </div>
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#f8fafc' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowPurchaseModal(false)}>Cancel</button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Purchase'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}


      {/* PURCHASE DETAILS & PAYMENT HISTORY MODAL */}
      {showDetailModal && selectedPurchase && (() => {
        const purchaseBranch = branches.find(b => b.id === selectedPurchase.branch_id) || { name: 'Main Factory Outlet', address: 'Factory Office / Warehouse' };
        return (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '850px', width: '90%', display: 'flex', flexDirection: 'column', maxHeight: '95vh', overflow: 'hidden' }}>
              <div className="modal-header">
                <h3 className="modal-title">
                  Purchase Invoice: {selectedPurchase.invoice_number || `PUR#${selectedPurchase.id.substring(0, 8).toUpperCase()}`}
                </h3>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedPurchase(null);
                    setSelectedPurchaseItems([]);
                    setSelectedPurchasePayments([]);
                  }}
                  style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {loadingDetails ? (
                  <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <strong>Loading details...</strong>
                  </div>
                ) : (
                  <>
                    {/* Section 1: Overview & Status */}
                    <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
                      <h4 style={{ margin: '0 0 0.85rem 0', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--primary)', letterSpacing: '0.05em' }}>
                        Overview
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Supplier</span>
                          <strong style={{ fontSize: '0.95rem' }}>{selectedPurchase.contacts?.name || 'Unknown supplier'}</strong>
                          {selectedPurchase.contacts?.phone && <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Phone: {selectedPurchase.contacts.phone}</span>}
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Date & Branch</span>
                          <strong style={{ fontSize: '0.95rem', display: 'block' }}>{new Date(selectedPurchase.purchase_date).toLocaleDateString()}</strong>
                          <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Branch: {purchaseBranch.name}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Payment Status</span>
                          <span className={`badge badge-${selectedPurchase.payment_status}`}>{selectedPurchase.payment_status}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Due Amount</span>
                          <strong style={{ fontSize: '1rem', color: selectedPurchase.net_amount - selectedPurchase.paid_amount > 0 ? 'var(--danger-text)' : 'inherit' }}>
                            ৳{(selectedPurchase.net_amount - selectedPurchase.paid_amount).toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Purchased Items */}
                    <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
                      <h4 style={{ margin: '0 0 0.85rem 0', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--primary)', letterSpacing: '0.05em' }}>
                        Items
                      </h4>
                      <div className="table-container">
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: '50px' }}>SL</th>
                              <th>Product</th>
                              <th>SKU</th>
                              <th style={{ width: '120px', textAlign: 'right' }}>Quantity</th>
                              <th style={{ width: '120px', textAlign: 'right' }}>Unit Cost</th>
                              <th style={{ width: '140px', textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedPurchaseItems.map((item, idx) => (
                              <tr key={item.id || idx}>
                                <td>{idx + 1}</td>
                                <td>
                                  <span style={{ fontWeight: 600 }}>{item.products?.name}</span>
                                </td>
                                <td>
                                  <span style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{item.products?.sku}</span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {item.quantity} {item.products?.unit || 'pcs'}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  ৳{item.unit_price.toFixed(2)}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  ৳{item.total_price.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Section 3: Summary & Notes */}
                    <div style={{ borderBottom: selectedPurchasePayments.length > 0 ? '1px solid var(--border-color)' : 'none', paddingBottom: selectedPurchasePayments.length > 0 ? '1.25rem' : '0' }}>
                      <h4 style={{ margin: '0 0 0.85rem 0', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--primary)', letterSpacing: '0.05em' }}>
                        Summary & Notes
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem', flexWrap: 'wrap', alignItems: 'start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Notes / Dispatch Details:</span>
                          <p style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap', minHeight: '60px' }}>
                            {selectedPurchase.notes || 'No notes provided.'}
                          </p>
                        </div>

                        <div className="card" style={{ padding: '1rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                            <span>Subtotal:</span>
                            <span>৳{selectedPurchase.total_amount.toFixed(2)}</span>
                          </div>
                          {selectedPurchase.discount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger-text)', fontSize: '0.9rem' }}>
                              <span>Discount:</span>
                              <span>-৳{selectedPurchase.discount.toFixed(2)}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                            <span>Net Total:</span>
                            <span>৳{selectedPurchase.net_amount.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-text)', fontSize: '0.9rem' }}>
                            <span>Paid Amount:</span>
                            <span>৳{selectedPurchase.paid_amount.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: selectedPurchase.net_amount - selectedPurchase.paid_amount > 0 ? 'var(--danger-text)' : 'inherit', fontSize: '0.9rem' }}>
                            <span>Due Amount:</span>
                            <span>৳{(selectedPurchase.net_amount - selectedPurchase.paid_amount).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Payment History (Only render if payments exist) */}
                    {selectedPurchasePayments.length > 0 && (
                      <div>
                        <h4 style={{ margin: '0 0 0.85rem 0', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--primary)', letterSpacing: '0.05em' }}>
                          Payment History
                        </h4>
                        <div className="table-container">
                          <table>
                            <thead>
                              <tr>
                                <th style={{ width: '50px' }}>SL</th>
                                <th>Payment ID</th>
                                <th>Transaction Date</th>
                                <th>Payment Method</th>
                                <th>Reference #</th>
                                <th style={{ textAlign: 'right', width: '130px' }}>Amount Paid</th>
                                <th>Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedPurchasePayments.map((pay, idx) => (
                                <tr key={pay.id || idx}>
                                  <td>{idx + 1}</td>
                                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                    {pay.payment_number || `PM#${pay.id.substring(0, 8).toUpperCase()}`}
                                  </td>
                                  <td>{new Date(pay.payment_date).toLocaleString()}</td>
                                  <td style={{ textTransform: 'capitalize' }}>{pay.payment_method.replace('_', ' ')}</td>
                                  <td style={{ fontFamily: 'monospace' }}>{pay.reference_number || '-'}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success-text)' }}>
                                    ৳{pay.amount.toFixed(2)}
                                  </td>
                                  <td style={{ fontSize: '0.82rem' }}>{pay.notes || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedPurchase(null);
                    setSelectedPurchaseItems([]);
                    setSelectedPurchasePayments([]);
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
