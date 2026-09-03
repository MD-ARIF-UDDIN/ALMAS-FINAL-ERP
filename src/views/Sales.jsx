import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Search, ShoppingCart, Trash2, Printer, Plus, UserPlus, CreditCard } from 'lucide-react';
import { TableLoading, LoadingBlock } from '../components/TableLoading';

export default function Sales({ userProfile, branches, addToast }) {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(false);
  
  // Sales History List & Modal state
  const [salesHistory, setSalesHistory] = useState([]);
  const [showPosModal, setShowPosModal] = useState(false);

  // POS Search/Select
  const [customerType, setCustomerType] = useState('existing'); // 'existing' or 'new'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Checkout overlay/popup states
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0); // in %
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // New Customer States
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Print states
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [showInvoicePrint, setShowInvoicePrint] = useState(false);

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

  const activeBranch = branches.find((b) => b.id === selectedBranchId);

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Fetch branch-specific inventory and sales history
  useEffect(() => {
    if (selectedBranchId) {
      fetchBranchInventory();
      fetchSalesHistory();
    }
  }, [selectedBranchId]);

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const fetchBranchInventory = async () => {
    if (!selectedBranchId) return;
    setLoadingInventory(true);
    try {
      // Fetch products which have stock at this branch
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          quantity,
          product_id,
          products (
            id,
            sku,
            name,
            sale_price,
            category,
            unit
          )
        `)
        .eq('branch_id', selectedBranchId);

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load branch product inventory.', 'error');
    } finally {
      setLoadingInventory(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('type', 'customer')
        .order('name', { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSalesHistory = async () => {
    if (!selectedBranchId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          contacts (
            name,
            phone
          )
        `)
        .eq('branch_id', selectedBranchId)
        .order('sale_date', { ascending: false });

      if (error) throw error;
      setSalesHistory(data || []);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load sales history.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRePrint = async (sale) => {
    setLoading(true);
    try {
      const { data: items, error } = await supabase
        .from('sale_items')
        .select(`
          *,
          products (
            id,
            name,
            sale_price,
            unit
          )
        `)
        .eq('sale_id', sale.id);

      if (error) throw error;

      const mappedItems = items.map((item) => ({
        product: {
          id: item.product_id,
          name: item.products?.name || 'Unknown',
          sale_price: item.unit_price,
          unit: item.products?.unit || 'pcs'
        },
        quantity: item.quantity
      }));

      setActiveInvoice(sale);
      setInvoiceItems(mappedItems);
      setShowInvoicePrint(true);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load invoice items for printing.', 'error');
    } finally {
      setLoading(false);
    }
  };



  const addToCart = (invItem) => {
    const product = invItem.products;
    const existingCartItem = cart.find((item) => item.product.id === product.id);

    if (existingCartItem) {
      // Check stock limit
      if (existingCartItem.quantity >= invItem.quantity) {
        showMessage(`Cannot add more. Only ${invItem.quantity} units available in stock.`, 'error');
        return;
      }
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      if (invItem.quantity <= 0) {
        showMessage('Item is out of stock.', 'error');
        return;
      }
      setCart([...cart, { product, quantity: 1, stockLimit: invItem.quantity }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const updateQty = (productId, amount) => {
    setCart(
      cart.map((item) => {
        if (item.product.id === productId) {
          const newQty = item.quantity + amount;
          if (newQty > item.stockLimit) {
            showMessage(`Only ${item.stockLimit} units available.`, 'error');
            return item;
          }
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      })
    );
  };

  // Math Calculations
  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.product.sale_price * item.quantity, 0);
  };

  const getTaxAmount = () => {
    const sub = getSubtotal();
    return (sub - discount) * (taxRate / 100);
  };

  const getGrandTotal = () => {
    const sub = getSubtotal();
    const subAfterDiscount = sub - discount;
    const tax = subAfterDiscount * (taxRate / 100);
    return Math.max(0, subAfterDiscount + tax);
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    
    let customerId = selectedCustomerId;
    
    if (customerType === 'new') {
      if (!newCustName.trim()) {
        showMessage('Please enter a Customer Name.', 'error');
        return;
      }
      if (newCustPhone.trim() && !/^\+?[0-9\s\-()]{7,15}$/.test(newCustPhone.trim())) {
        showMessage('Please enter a valid customer phone number (7-15 digits).', 'error');
        return;
      }
    } else {
      if (!selectedCustomerId) {
        showMessage('Please select a Buyer / Client before checking out.', 'error');
        return;
      }
    }

    if (cart.length === 0) {
      showMessage('Your shopping cart is empty.', 'error');
      return;
    }

    const sub = getSubtotal();
    const disc = parseFloat(discount) || 0;
    const initialPaid = parseFloat(paidAmount) || 0;
    const grandTotal = getGrandTotal();

    if (disc < 0) {
      showMessage('Discount cannot be negative.', 'error');
      return;
    }
    if (disc > sub) {
      showMessage('Discount cannot exceed the order subtotal.', 'error');
      return;
    }
    if (initialPaid < 0) {
      showMessage('Paid amount cannot be negative.', 'error');
      return;
    }
    if (initialPaid > grandTotal + 0.01) {
      showMessage(`Paid amount cannot exceed the grand total of ৳${grandTotal.toFixed(2)}.`, 'error');
      return;
    }

    setLoading(true);
    try {
      // Create contact if it's a new customer
      if (customerType === 'new') {
        const { data: contactData, error: contactError } = await supabase
          .from('contacts')
          .insert([
            {
              type: 'customer',
              name: newCustName.trim(),
              phone: newCustPhone.trim() || null,
              address: newCustAddress.trim() || null,
            }
          ])
          .select()
          .single();

        if (contactError) throw contactError;
        customerId = contactData.id;
      }

      const subtotal = getSubtotal();
      const taxAmount = getTaxAmount();
      const grandTotal = getGrandTotal();
      const initialPaid = parseFloat(paidAmount) || 0.00;

      // 1. Insert Sales Invoice
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([
          {
            branch_id: selectedBranchId,
            customer_id: customerId,
            total_amount: subtotal,
            discount: discount,
            tax: taxAmount,
            net_amount: grandTotal,
            paid_amount: 0.00, // Trigger will compute this from payments
            payment_status: 'unpaid', // Trigger will compute this
            created_by: userProfile.id,
            notes: notes || null,
          },
        ])
        .select();

      if (saleError) throw saleError;
      const saleId = saleData[0].id;

      // 2. Insert Sale Items
      const saleItemsData = cart.map((item) => ({
        sale_id: saleId,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.sale_price,
        total_price: item.product.sale_price * item.quantity,
      }));

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsData);
      if (itemsError) throw itemsError;

      // 3. Register payment if initial payment is made
      if (initialPaid > 0) {
        const { error: paymentError } = await supabase.from('payments').insert([
          {
            branch_id: selectedBranchId,
            type: 'customer_payment',
            sale_id: saleId,
            amount: initialPaid,
            payment_method: paymentMethod,
            reference_number: referenceNumber || null,
            created_by: userProfile.id,
          },
        ]);
        if (paymentError) throw paymentError;

        // Log transaction to cash ledger
        const { error: ledgerError } = await supabase.from('cash_ledger').insert([
          {
            branch_id: selectedBranchId,
            account_type: paymentMethod,
            type: 'in',
            amount: initialPaid,
            description: `POS Sale Receipt: Invoice #${saleData[0].invoice_number || saleId.substring(0, 8)}`,
          },
        ]);
        if (ledgerError) throw ledgerError;
      }

      // Fetch the newly created invoice detail for printing
      const { data: populatedSale } = await supabase
        .from('sales')
        .select(`
          *,
          contacts (
            name,
            phone,
            address
          )
        `)
        .eq('id', saleId)
        .single();

      setActiveInvoice(populatedSale);
      setInvoiceItems(cart);
      setShowInvoicePrint(true);

      // Reset state
      setCustomerType('existing');
      setCart([]);
      setSelectedCustomerId('');
      setDiscount(0);
      setTaxRate(0);
      setPaidAmount('');
      setReferenceNumber('');
      setNotes('');
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
      setShowCheckoutModal(false);
      setShowPosModal(false);
      
      // Refresh inventory stock display
      fetchBranchInventory();
      fetchSalesHistory();
      showMessage('Invoice checkout completed successfully!', 'success');
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Error occurred during checkout.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter products by search query
  const filteredProducts = products.filter((item) =>
    item.products?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.products?.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="no-print top-bar">
        <div className="page-title-group">
          <h1>Customer Sales Invoices</h1>
        </div>
        <div className="top-bar-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {userProfile?.role === 'owner' && (
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
          )}
          {!showInvoicePrint && (
            <button className="btn btn-primary" onClick={() => {
              setCart([]);
              setSelectedCustomerId('');
              setDiscount(0);
              setTaxRate(0);
              setPaidAmount('');
              setReferenceNumber('');
              setNotes('');
              setShowPosModal(true);
            }}>
              <Plus size={16} />
              <span>Create Invoice (POS)</span>
            </button>
          )}
        </div>
      </div>

      {/* SALES HISTORY LIST VIEW */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Invoices History</h3>
        </div>
        <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>SL</th>
                  <th>Invoice ID</th>
                  {userProfile?.role === 'owner' && <th>Branch</th>}
                  <th>Sale Date</th>
                  <th>Buyer Name</th>
                  <th>Net Value</th>
                  <th>Paid Amount</th>
                  <th>Dues</th>
                  <th>Payment Status</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoading colSpan={userProfile?.role === 'owner' ? 10 : 9} message="Fetching sales records..." />
                ) : salesHistory.length === 0 ? (
                  <tr>
                    <td colSpan={userProfile?.role === 'owner' ? 10 : 9} style={{ textAlign: 'center', padding: '2rem' }}>
                      No sales invoices recorded yet. Click "Create Invoice (POS)" to sell items.
                    </td>
                  </tr>
                ) : (
                  salesHistory.map((sale, index) => {
                    const due = sale.net_amount - sale.paid_amount;
                    return (
                      <tr key={sale.id}>
                        <td>{index + 1}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem' }}>
                          {sale.invoice_number || `INV#${sale.id.substring(0, 8).toUpperCase()}`}
                        </td>
                        {userProfile?.role === 'owner' && (
                          <td style={{ fontWeight: 600 }}>{branches.find(b => b.id === sale.branch_id)?.name || 'Unknown'}</td>
                        )}
                        <td>{new Date(sale.sale_date).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sale.contacts?.name || 'Walk-in Customer'}</td>
                        <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>৳{sale.net_amount.toFixed(2)}</td>
                        <td style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--success-text)' }}>৳{sale.paid_amount.toFixed(2)}</td>
                        <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: due > 0 ? 'var(--danger-text)' : 'inherit' }}>৳{due.toFixed(2)}</td>
                        <td>
                          <span className={`badge badge-${sale.payment_status}`}>{sale.payment_status}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleRePrint(sale)}
                            title="Re-Print Invoice / Challan"
                          >
                            <Printer size={14} />
                            <span style={{ marginLeft: '0.25rem' }}>Print</span>
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

      {/* POS WORKSPACE MODAL */}
      {showPosModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-xl" style={{ display: 'flex', flexDirection: 'column', maxHeight: '95vh', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Sales Invoice (POS)</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowPosModal(false)} style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}>✕</button>
            </div>
            <div className="modal-body pos-layout" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', margin: 0, background: 'var(--bg-app)' }}>
              {/* Product Picker */}
              <div className="pos-catalog">
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div className="catalog-search-bar">
                    <div style={{ position: 'relative', width: '100%' }}>
                      <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="input-control"
                        style={{ paddingLeft: '2.75rem' }}
                        placeholder="Search items by SKU, DTM color code, name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="product-grid">
                  {loadingInventory ? (
                    <div className="card" style={{ gridColumn: '1 / -1' }}>
                      <LoadingBlock message="Loading branch stock catalog..." />
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
                      No available items found in this branch's stock.
                    </div>
                  ) : (
                    filteredProducts.map((invItem) => (
                      <div
                        key={invItem.product_id}
                        className="pos-product-card card"
                        onClick={() => {
                          if (invItem.quantity <= 0) {
                            showMessage("This item is currently out of stock.", "error");
                            return;
                          }
                          addToCart(invItem);
                        }}
                        style={{ cursor: invItem.quantity > 0 ? 'pointer' : 'not-allowed', opacity: invItem.quantity > 0 ? 1 : 0.6 }}
                      >
                        <div className="pos-product-sku">{invItem.products?.sku}</div>
                        <div className="pos-product-name">{invItem.products?.name}</div>
                        <span className="pos-product-price">৳{invItem.products?.sale_price.toFixed(2)}</span>
                        <span className="pos-product-stock">Stock: {invItem.quantity} {invItem.products?.unit}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Cart & Customer Picker */}
              <div className="pos-cart">
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                  {/* Customer Selector Type Toggle */}
                  <div className="form-group" style={{ marginBottom: '0.45rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Buyer Type</label>
                    <select
                      className="input-control"
                      value={customerType}
                      onChange={(e) => setCustomerType(e.target.value)}
                    >
                      <option value="existing">Existing</option>
                      <option value="new">New</option>
                    </select>
                  </div>

                  {customerType === 'existing' ? (
                    <div className="form-group" style={{ marginBottom: '0.45rem' }}>
                      <label>Select Buyer / Client *</label>
                      <select
                        className="input-control"
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        required={customerType === 'existing'}
                      >
                        <option value="">-- Choose Buyer / Client --</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0.5rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.45rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.74rem', color: 'var(--primary)' }}>New Client Registration Info</div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Client Name *</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="e.g. Arif Uddin"
                          value={newCustName}
                          onChange={(e) => setNewCustName(e.target.value)}
                          required={customerType === 'new'}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Client Phone</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="e.g. 018xxxxxxxx"
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Client Address</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="e.g. Dhaka, Bangladesh"
                          value={newCustAddress}
                          onChange={(e) => setNewCustAddress(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Cart List */}
                  <div className="cart-items-list">
                    {cart.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        Cart is empty. Click products on the left to add items.
                      </div>
                    ) : (
                      cart.map((item) => (
                        <div key={item.product.id} className="cart-item">
                          <div className="cart-item-info">
                            <div className="cart-item-name">{item.product.name}</div>
                            <div className="cart-item-price-calc">
                              ৳{item.product.sale_price.toFixed(2)} × {item.quantity}
                            </div>
                          </div>
                          <div className="cart-item-qty-controls">
                            <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem' }} onClick={() => updateQty(item.product.id, -1)}>-</button>
                            <span className="cart-item-qty">{item.quantity}</span>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem' }} onClick={() => updateQty(item.product.id, 1)}>+</button>
                          </div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: '70px', textAlign: 'right' }}>
                            ৳{(item.product.sale_price * item.quantity).toFixed(2)}
                          </div>
                          <button
                            className="btn btn-danger btn-sm btn-icon"
                            style={{ background: 'none', border: 'none', color: 'var(--danger)' }}
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Totals Summary */}
                  {cart.length > 0 && (
                    <div className="cart-totals-summary">
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
                          style={{ width: '100px', padding: '0.25rem 0.5rem', textAlign: 'right' }}
                          value={discount}
                          onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        />
                      </div>
                      <div className="totals-row">
                        <span>Tax Rate (%)</span>
                        <input
                          type="number"
                          min="0"
                          className="input-control"
                          style={{ width: '100px', padding: '0.25rem 0.5rem', textAlign: 'right' }}
                          value={taxRate}
                          onChange={(e) => setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                        />
                      </div>
                      <div className="totals-row grand-total">
                        <span>Grand Total</span>
                        <span>৳{getGrandTotal().toFixed(2)}</span>
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: '0.5rem', padding: '0.8rem' }}
                        onClick={() => {
                          if (!selectedCustomerId) {
                            showMessage('Please select a Buyer / Client before checkout.', 'error');
                            return;
                          }
                          setShowCheckoutModal(true);
                        }}
                      >
                        Proceed to Payment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* CHECKOUT / INITIAL PAYMENT MODAL */}
      {showCheckoutModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Order Dispatch & Payment Receipt</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCheckoutModal(false)} style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}>✕</button>
            </div>
            <form onSubmit={handleCheckoutSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ backgroundColor: 'var(--primary-light)', padding: '1rem', borderRadius: 'var(--border-radius-sm)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block' }}>Net Receivable Total</span>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                    ৳{getGrandTotal().toFixed(2)}
                  </span>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Cash Received / Downpayment (Enter 0 for full credit, or partial for advance/installment)</label>
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
                  <div className="form-group">
                    <label>Payment Mode</label>
                    <select
                      className="input-control"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="cash">Cash Ledger</option>
                      <option value="bank">Bank / Check</option>
                      <option value="mobile_banking">Mobile Money (bKash/Nagad)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Transaction / Check Reference Number</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Enter reference code"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Delivery & Challan Dispatch Notes</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. Color match details, delivery time, bag packaging"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCheckoutModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? 'Processing...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* INVOICE PRINT MODAL */}
      {showInvoicePrint && activeInvoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header no-print">
              <h3 className="modal-title">Receipt / Invoice Print Preview</h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowInvoicePrint(false)}
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body" style={{ overflowY: 'auto', padding: '1.5rem' }}>
              <div className="invoice-print-view" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
                <div className="invoice-header">
                  <div className="invoice-company-details">
                    <div className="invoice-company-name">ALMAS ACCESSORIES</div>
                    <div>{activeBranch ? activeBranch.name : 'Main Factory Outlet'}</div>
                    {activeBranch?.phone && <div>Phone: {activeBranch.phone}</div>}
                    {activeBranch?.address && <div>Address: {activeBranch.address}</div>}
                  </div>
                  <div className="invoice-meta">
                    <div className="invoice-title">INVOICE</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {activeInvoice.invoice_number || `INV#${activeInvoice.id.substring(0, 8).toUpperCase()}`}
                    </div>
                    <div>Date: {new Date(activeInvoice.sale_date).toLocaleDateString()}</div>
                  </div>
                </div>

                <div className="invoice-details-grid">
                  <div className="invoice-bill-to">
                    <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bill To:</div>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{activeInvoice.contacts?.name}</div>
                    {activeInvoice.contacts?.phone && <div>Phone: {activeInvoice.contacts.phone}</div>}
                    {activeInvoice.contacts?.address && <div>Address: {activeInvoice.contacts.address}</div>}
                  </div>
                </div>

                <table className="invoice-table" style={{ marginTop: '1rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>SL</th>
                      <th>Thread / Accessory</th>
                      <th style={{ textAlign: 'center', width: '100px' }}>Quantity</th>
                      <th style={{ textAlign: 'right', width: '120px' }}>Price</th>
                      <th style={{ textAlign: 'right', width: '140px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.map((item, index) => (
                      <tr key={item.id || index}>
                        <td>{index + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.products?.name || item.product?.name || (item.product && item.product.name)}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            SKU: {item.products?.sku || item.product?.sku || (item.product && item.product.sku)}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right' }}>
                          ৳{(item.unit_price || (item.product && item.product.sale_price) || 0).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ৳{((item.unit_price || (item.product && item.product.sale_price) || 0) * item.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '280px', alignSelf: 'flex-end', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal:</span>
                    <span>৳{(activeInvoice.total_amount || 0).toFixed(2)}</span>
                  </div>
                  {activeInvoice.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger-text)' }}>
                      <span>Discount:</span>
                      <span>-৳{activeInvoice.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {activeInvoice.tax > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Tax:</span>
                      <span>৳{activeInvoice.tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '2px solid var(--text-primary)', paddingTop: '0.5rem', fontSize: '1.15rem' }}>
                    <span>Grand Total:</span>
                    <span>৳{(activeInvoice.net_amount || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-text)', fontSize: '0.95rem' }}>
                    <span>Paid Amount:</span>
                    <span>৳{(activeInvoice.paid_amount || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning-text)', fontWeight: 600, fontSize: '0.95rem' }}>
                    <span>Due Balance:</span>
                    <span>৳{Math.max(0, (activeInvoice.net_amount || 0) - (activeInvoice.paid_amount || 0)).toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Thank you for shopping with Almas Accessories!
                </div>
              </div>
            </div>

            <div className="modal-footer no-print">
              <button type="button" className="btn btn-secondary" onClick={() => setShowInvoicePrint(false)}>Close</button>
              <button type="button" className="btn btn-primary" onClick={handlePrint}>
                <Printer size={16} />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
