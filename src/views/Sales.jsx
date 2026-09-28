import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Search, ShoppingCart, Trash2, Printer, Plus, UserPlus, CreditCard, RotateCcw, FileText, CheckCircle2, AlertCircle, X, DollarSign, RefreshCw } from 'lucide-react';
import { TableLoading, LoadingBlock } from '../components/TableLoading';
import Pagination from '../components/Pagination';

export default function Sales({ userProfile, branches, addToast }) {
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(false);
  
  // Sales History List & Modal state
  const [salesHistory, setSalesHistory] = useState([]);
  const [showPosModal, setShowPosModal] = useState(false);

  // Pagination & Search for Sales History
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(25);
  const [salesTotalCount, setSalesTotalCount] = useState(0);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Sales Return / Credit Note States
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState(null);
  const [returnLineItems, setReturnLineItems] = useState([]);
  const [loadingReturnItems, setLoadingReturnItems] = useState(false);
  const [returnType, setReturnType] = useState('cash'); // 'cash' | 'exchange'
  const [exchangeCart, setExchangeCart] = useState([]);
  const [exchangeSearch, setExchangeSearch] = useState('');
  const [exchangePaymentMethod, setExchangePaymentMethod] = useState('cash');
  const [returnReasonCategory, setReturnReasonCategory] = useState('Exchange / Return');
  const [returnReasonNotes, setReturnReasonNotes] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Credit Note Print Preview State
  const [showCreditNotePrint, setShowCreditNotePrint] = useState(false);
  const [activeCreditNote, setActiveCreditNote] = useState(null);

  useEffect(() => {
    if (location.state?.openPos) {
      setCart([]);
      setSelectedCustomerId('');
      setDiscount(0);
      setTaxRate(0);
      setPaidAmount('');
      setReferenceNumber('');
      setNotes('');
      setShowPosModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // POS Search/Select
  const [customerType, setCustomerType] = useState('existing'); // 'existing' or 'new'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Checkout overlay/popup states
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0); // in %
  const [paidAmount, setPaidAmount] = useState('');
  const [customerGivenCash, setCustomerGivenCash] = useState('');
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

  const activeBranch = branches.find((b) => b.id === selectedBranchId);
  const isFactory = Boolean(activeBranch?.is_factory || activeBranch?.name?.toLowerCase().includes('factory'));

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const fetchBranchInventory = async () => {
    if (!selectedBranchId) return;
    setLoadingInventory(true);
    try {
      if (isFactory) {
        // Factory sells direct make-to-order without inventory restrictions
        const { data: prods, error } = await supabase
          .from('products')
          .select('id, sku, product_code, name, sale_price, purchase_price, category, description')
          .order('name', { ascending: true });

        if (error) throw error;
        const mapped = (prods || []).map((p) => ({
          product_id: p.id,
          quantity: 999999,
          is_factory: true,
          products: p,
        }));
        setProducts(mapped);
      } else {
        const { data, error } = await supabase
          .from('inventory')
          .select(`
            quantity,
            product_id,
            products (
              id,
              sku,
              product_code,
              name,
              sale_price,
              purchase_price,
              category,
              description
            )
          `)
          .eq('branch_id', selectedBranchId);

        if (error) throw error;
        setProducts(data || []);
      }
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

  const fetchSalesHistory = useCallback(async () => {
    if (!selectedBranchId) return;
    setLoading(true);
    try {
      const from = (salesPage - 1) * salesPageSize;
      const to = from + salesPageSize - 1;

      let query = supabase
        .from('sales')
        .select(`
          *,
          contacts (
            name,
            phone
          )
        `, { count: 'exact' })
        .order('sale_date', { ascending: false })
        .range(from, to);

      if (userProfile?.role === 'owner') {
        if (selectedBranchId && selectedBranchId !== 'all') {
          query = query.eq('branch_id', selectedBranchId);
        }
      } else if (selectedBranchId) {
        query = query.eq('branch_id', selectedBranchId);
      }

      if (historySearchQuery.trim()) {
        query = query.ilike('invoice_number', `%${historySearchQuery.trim()}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      setSalesHistory(data || []);
      setSalesTotalCount(count || 0);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load sales history.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, salesPage, salesPageSize, historySearchQuery, userProfile?.role]);

  // Fetch branch-specific inventory and sales history
  useEffect(() => {
    if (selectedBranchId) {
      fetchBranchInventory();
      fetchSalesHistory();
    }
  }, [selectedBranchId, isFactory, fetchSalesHistory]);

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
      const currentQty = parseFloat(existingCartItem.quantity) || 0;
      if (!isFactory && currentQty >= invItem.quantity) {
        showMessage(`Cannot add more. Only ${invItem.quantity} units available in stock.`, 'error');
        return;
      }
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: currentQty + 1 }
            : item
        )
      );
    } else {
      if (!isFactory && invItem.quantity <= 0) {
        showMessage('Item is out of stock.', 'error');
        return;
      }
      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          unitPrice: product.sale_price !== undefined ? product.sale_price : 0,
          stockLimit: isFactory ? 999999 : invItem.quantity,
        },
      ]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const updateQty = (productId, amount) => {
    setCart(
      cart.map((item) => {
        if (item.product.id === productId) {
          const currentQty = parseFloat(item.quantity) || 0;
          const newQty = Math.max(1, currentQty + amount);
          if (!isFactory && newQty > item.stockLimit) {
            showMessage(`Only ${item.stockLimit} units available.`, 'error');
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const handleCustomQtyChange = (productId, value) => {
    setCart(
      cart.map((item) => {
        if (item.product.id === productId) {
          if (value === '') {
            return { ...item, quantity: '' };
          }
          const parsed = parseFloat(value);
          if (isNaN(parsed)) return item;
          if (parsed < 0) return { ...item, quantity: 0 };
          if (!isFactory && parsed > item.stockLimit) {
            showMessage(`Only ${item.stockLimit} units available in stock.`, 'error');
            return { ...item, quantity: item.stockLimit };
          }
          return { ...item, quantity: parsed };
        }
        return item;
      })
    );
  };

  const handleQtyBlur = (productId) => {
    setCart(
      cart.map((item) => {
        if (item.product.id === productId) {
          const q = parseFloat(item.quantity);
          if (isNaN(q) || q <= 0) {
            return { ...item, quantity: 1 };
          }
          if (!isFactory && q > item.stockLimit) {
            return { ...item, quantity: item.stockLimit };
          }
          return { ...item, quantity: q };
        }
        return item;
      })
    );
  };

  const handleCustomPriceChange = (productId, value) => {
    setCart(
      cart.map((item) => {
        if (item.product.id === productId) {
          if (value === '') {
            return { ...item, unitPrice: '' };
          }
          const parsed = parseFloat(value);
          if (isNaN(parsed)) return item;
          if (parsed < 0) return { ...item, unitPrice: 0 };
          return { ...item, unitPrice: parsed };
        }
        return item;
      })
    );
  };

  const handlePriceBlur = (productId) => {
    setCart(
      cart.map((item) => {
        if (item.product.id === productId) {
          const p = parseFloat(item.unitPrice);
          if (isNaN(p) || p < 0) {
            return { ...item, unitPrice: item.product.sale_price !== undefined ? item.product.sale_price : 0 };
          }
          return { ...item, unitPrice: p };
        }
        return item;
      })
    );
  };

  const getItemPrice = (item) => {
    if (item.unitPrice !== undefined && item.unitPrice !== '') {
      const p = parseFloat(item.unitPrice);
      return isNaN(p) ? 0 : p;
    }
    return parseFloat(item.product?.sale_price) || 0;
  };

  // Math Calculations
  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + getItemPrice(item) * (parseFloat(item.quantity) || 0), 0);
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

    for (const item of cart) {
      const q = parseFloat(item.quantity);
      const p = getItemPrice(item);
      if (isNaN(q) || q <= 0) {
        showMessage(`Please specify a valid quantity greater than 0 for ${item.product?.name || 'item'}.`, 'error');
        return;
      }
      if (isNaN(p) || p < 0) {
        showMessage(`Please specify a valid unit price for ${item.product?.name || 'item'}.`, 'error');
        return;
      }
      if (!isFactory && q > item.stockLimit) {
        showMessage(`Quantity for ${item.product?.name || 'item'} exceeds available stock of ${item.stockLimit}.`, 'error');
        return;
      }
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

    setLoading(true);
    try {
      // Create contact if it's a new customer
      if (customerType === 'new') {
        const trimmedCustName = newCustName.trim();
        const trimmedCustPhone = newCustPhone.trim();
        const trimmedCustAddress = newCustAddress.trim();

        if (!trimmedCustName) {
          showMessage('Please enter the client name.', 'error');
          setLoading(false);
          return;
        }

        if (!trimmedCustPhone) {
          showMessage('Client phone number is mandatory.', 'error');
          setLoading(false);
          return;
        }

        if (!/^\+?[0-9\s\-()]{7,15}$/.test(trimmedCustPhone)) {
          showMessage('Please enter a valid client phone number (7-15 digits).', 'error');
          setLoading(false);
          return;
        }

        // Duplicate phone check for customer
        const { data: dupClient, error: dupErr } = await supabase
          .from('contacts')
          .select('id, name, phone')
          .eq('phone', trimmedCustPhone)
          .eq('type', 'customer');

        if (dupErr) throw dupErr;

        if (dupClient && dupClient.length > 0) {
          showMessage(`A buyer with phone "${trimmedCustPhone}" already exists (${dupClient[0].name}). Please select them from the buyer list.`, 'error');
          setLoading(false);
          return;
        }

        const { data: contactData, error: contactError } = await supabase
          .from('contacts')
          .insert([
            {
              type: 'customer',
              name: trimmedCustName,
              phone: trimmedCustPhone,
              address: trimmedCustAddress || null,
              branch_id: selectedBranchId,
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
      const rawPaid = parseFloat(paidAmount) || 0.00;
      const initialPaid = Math.min(rawPaid, grandTotal);

      // 1. Insert Sales Invoice
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([
          {
            branch_id: selectedBranchId,
            customer_id: customerId,
            total_amount: subtotal,
            discount: discount,
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
      const saleItemsData = cart.map((item) => {
        const qty = parseFloat(item.quantity) || 1;
        const price = getItemPrice(item);
        return {
          sale_id: saleId,
          product_id: item.product.id,
          quantity: qty,
          unit_price: price,
          total_price: price * qty,
        };
      });

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsData);
      if (itemsError) throw itemsError;

      // 2.1 FIFO deduction on branch_challan_items for this branch (tracks sold vs left on Challans)
      if (!isFactory) {
        for (const item of cart) {
          try {
            const { data: openChallanItems } = await supabase
              .from('branch_challan_items')
              .select('id, dispatched_qty, sold_qty, remaining_qty, challan_id, branch_challans!inner(to_branch_id)')
              .eq('product_id', item.product.id)
              .eq('branch_challans.to_branch_id', selectedBranchId)
              .gt('remaining_qty', 0)
              .order('created_at', { ascending: true });

            if (openChallanItems && openChallanItems.length > 0) {
              let qtyToDeduct = parseFloat(item.quantity) || 1;
              for (const chItem of openChallanItems) {
                if (qtyToDeduct <= 0) break;
                const availableInChallan = chItem.remaining_qty;
                const deductFromThis = Math.min(qtyToDeduct, availableInChallan);
                const newSold = (chItem.sold_qty || 0) + deductFromThis;
                const newRemaining = chItem.remaining_qty - deductFromThis;

                await supabase
                  .from('branch_challan_items')
                  .update({
                    sold_qty: newSold,
                    remaining_qty: newRemaining,
                  })
                  .eq('id', chItem.id);

                qtyToDeduct -= deductFromThis;
              }
            }
          } catch (challanErr) {
            console.error('Error updating challan item remaining qty:', challanErr);
          }
        }
      }

      // 3. Register payment if initial payment is made
      if (initialPaid > 0) {
        const { error: paymentError } = await supabase.from('payments').insert([
          {
            branch_id: selectedBranchId,
            contact_id: customerId,
            amount: initialPaid,
            payment_method: paymentMethod,
            transaction_type: 'customer_collection',
            reference_invoice_id: saleId,
            notes: referenceNumber ? `Trx Ref: ${referenceNumber}` : (notes || null),
            created_by: userProfile.id,
          },
        ]);
        if (paymentError) throw paymentError;

        // Log transaction to cash ledger
        const { error: ledgerError } = await supabase.from('cash_ledger').insert([
          {
            branch_id: selectedBranchId,
            amount_in: initialPaid,
            amount_out: 0,
            reference_id: saleId,
            description: `POS Sale Receipt: Invoice #${saleData[0].invoice_number || saleId.substring(0, 8)} (${paymentMethod})`,
            transaction_date: new Date().toISOString(),
            created_by: userProfile.id,
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

  // Open Sales Return Modal for a specific invoice
  const handleOpenReturnModal = async (sale) => {
    setSelectedSaleForReturn(sale);
    setReturnType('cash');
    setExchangeCart([]);
    setExchangeSearch('');
    setExchangePaymentMethod('cash');
    setReturnReasonCategory('Exchange / Return');
    setReturnReasonNotes('');
    const due = parseFloat(sale.net_amount || 0) - parseFloat(sale.paid_amount || 0);
    setRefundMethod(due > 0.01 ? 'deduct_due' : 'cash');
    setShowReturnModal(true);
    setLoadingReturnItems(true);

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
            product_code,
            sale_price
          )
        `)
        .eq('sale_id', sale.id);

      if (error) throw error;

      const itemsWithReturnQty = (data || []).map((it) => ({
        ...it,
        returnQty: 0,
      }));
      setReturnLineItems(itemsWithReturnQty);
    } catch (err) {
      console.error('Error fetching sale items for return:', err);
      showMessage('Failed to load invoice items for return.', 'error');
    } finally {
      setLoadingReturnItems(false);
    }
  };

  const addToExchangeCart = (invItem) => {
    const product = invItem.products;
    const existing = exchangeCart.find((c) => c.product_id === product.id);
    const maxStock = isFactory ? 999999 : (invItem.quantity || 0);
    if (existing) {
      if (!isFactory && existing.quantity >= maxStock) {
        showMessage(`Cannot exceed available stock of ${maxStock}.`, 'error');
        return;
      }
      setExchangeCart(
        exchangeCart.map((c) =>
          c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      );
    } else {
      if (!isFactory && maxStock <= 0) {
        showMessage('Item is out of stock.', 'error');
        return;
      }
      setExchangeCart([
        ...exchangeCart,
        {
          product_id: product.id,
          product: product,
          quantity: 1,
          unit_price: product.sale_price !== undefined ? product.sale_price : 0,
          maxStock: maxStock,
        },
      ]);
    }
  };

  // Process Sales Return & Restock / Product Exchange
  const handleProcessReturn = async (e) => {
    e.preventDefault();
    if (!selectedSaleForReturn) return;

    const itemsToReturn = returnLineItems.filter((it) => parseInt(it.returnQty || 0) > 0);
    if (itemsToReturn.length === 0) {
      showMessage('Please specify a return quantity of at least 1 for one or more items.', 'error');
      return;
    }

    // Check quantity limits
    for (const it of itemsToReturn) {
      const retQty = parseInt(it.returnQty || 0);
      const soldQty = parseInt(it.quantity || 0);
      if (retQty > soldQty) {
        showMessage(`Return quantity for ${it.products?.name || 'product'} cannot exceed original sold quantity (${soldQty}).`, 'error');
        return;
      }
    }

    if (returnType === 'exchange' && exchangeCart.length === 0) {
      showMessage('Please select at least one replacement product for exchange.', 'error');
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const sale = selectedSaleForReturn;
      const originalNet = parseFloat(sale.net_amount || 0);
      const originalPaid = parseFloat(sale.paid_amount || 0);
      const currentDue = Math.max(0, originalNet - originalPaid);
      const isExchange = returnType === 'exchange';

      // Calculate return goods credit
      const totalReturnCredit = itemsToReturn.reduce((sum, it) => {
        const unitP = parseFloat(it.unit_price) || 0;
        const q = parseInt(it.returnQty);
        return sum + (unitP * q);
      }, 0);

      // Calculate replacement goods value
      const totalExchangeValue = isExchange
        ? exchangeCart.reduce((sum, it) => sum + (parseFloat(it.unit_price || 0) * parseFloat(it.quantity || 0)), 0)
        : 0;

      const exchangeDifference = totalExchangeValue - totalReturnCredit;
      const targetBranchId = sale.branch_id || selectedBranchId;
      const creditNoteNumber = `${isExchange ? 'EXC' : 'CRN'}-${Date.now().toString().slice(-6)}`;

      // 1. Restock returned items back to physical inventory & log movements
      for (const it of itemsToReturn) {
        const retQty = parseInt(it.returnQty);
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
              quantity: (currentInv.quantity || 0) + retQty,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentInv.id);
        } else {
          await supabase
            .from('inventory')
            .insert([{
              branch_id: targetBranchId,
              product_id: prodId,
              quantity: retQty,
              updated_at: new Date().toISOString(),
            }]);
        }

        // Log movement audit
        await supabase.from('inventory_movements').insert([{
          branch_id: targetBranchId,
          product_id: prodId,
          type: 'adjustment_in',
          quantity: retQty,
          description: `${isExchange ? 'Exchange Return' : 'Customer Return'} (Restocked): Inv #${sale.invoice_number || sale.id.substring(0, 8)} [${creditNoteNumber}] - ${returnReasonCategory}`,
          created_by: userProfile.id,
        }]);
      }

      // 2. If Exchange: Deduct replacement items from inventory
      if (isExchange) {
        for (const it of exchangeCart) {
          const eQty = parseFloat(it.quantity) || 1;
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
                updated_at: new Date().toISOString(),
              })
              .eq('id', currentInv.id);
          }

          // Log movement audit for outgoing replacement product
          await supabase.from('inventory_movements').insert([{
            branch_id: targetBranchId,
            product_id: prodId,
            type: 'sale',
            quantity: eQty,
            description: `Exchange Out [${creditNoteNumber}]: Inv #${sale.invoice_number || sale.id.substring(0, 8)} to ${sale.contacts?.name || 'Customer'}`,
            created_by: userProfile.id,
          }]);
        }
      }

      // 3. Financial settlement
      let newNet = originalNet;
      let newPaid = originalPaid;
      let newStatus = sale.payment_status;

      if (!isExchange) {
        // Pure Refund
        newNet = Math.max(0, originalNet - totalReturnCredit);
        if (refundMethod === 'deduct_due') {
          const newDue = Math.max(0, currentDue - totalReturnCredit);
          newStatus = newDue <= 0.01 ? 'paid' : 'partial';
        } else {
          // Cash payout to customer
          await supabase.from('cash_ledger').insert([{
            branch_id: targetBranchId,
            amount_in: 0,
            amount_out: totalReturnCredit,
            reference_id: sale.id,
            description: `Sales Return Refund [${creditNoteNumber}]: Inv #${sale.invoice_number || sale.id.substring(0, 8)} to ${sale.contacts?.name || 'Customer'} (${refundMethod})`,
            transaction_date: new Date().toISOString(),
            created_by: userProfile.id,
          }]);

          newPaid = Math.max(0, originalPaid - totalReturnCredit);
          const newDue = Math.max(0, newNet - newPaid);
          newStatus = newDue <= 0.01 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
        }
      } else {
        // Product Exchange Settlement
        if (exchangeDifference > 0) {
          // Customer pays extra difference
          await supabase.from('payments').insert([{
            branch_id: targetBranchId,
            contact_id: sale.customer_id,
            amount: exchangeDifference,
            payment_method: exchangePaymentMethod,
            transaction_type: 'customer_collection',
            reference_invoice_id: sale.id,
            notes: `Exchange Extra Difference [${creditNoteNumber}]`,
            created_by: userProfile.id,
          }]);

          await supabase.from('cash_ledger').insert([{
            branch_id: targetBranchId,
            amount_in: exchangeDifference,
            amount_out: 0,
            reference_id: sale.id,
            description: `Exchange Difference Payment [${creditNoteNumber}]: Inv #${sale.invoice_number || sale.id.substring(0, 8)} (${exchangePaymentMethod})`,
            transaction_date: new Date().toISOString(),
            created_by: userProfile.id,
          }]);
        } else if (exchangeDifference < 0) {
          // Store refunds difference to customer
          const refundDiff = Math.abs(exchangeDifference);
          if (refundMethod === 'deduct_due') {
            const newDue = Math.max(0, currentDue - refundDiff);
            newStatus = newDue <= 0.01 ? 'paid' : 'partial';
          } else {
            await supabase.from('cash_ledger').insert([{
              branch_id: targetBranchId,
              amount_in: 0,
              amount_out: refundDiff,
              reference_id: sale.id,
              description: `Exchange Refund Difference [${creditNoteNumber}]: Inv #${sale.invoice_number || sale.id.substring(0, 8)} (${refundMethod})`,
              transaction_date: new Date().toISOString(),
              created_by: userProfile.id,
            }]);
          }
        }
      }

      // 4. Update Sale record with notes
      const returnNote = isExchange
        ? `[Exchange ${creditNoteNumber}: Returned ৳${totalReturnCredit.toFixed(2)}, Replacement ৳${totalExchangeValue.toFixed(2)}, Net diff: ৳${exchangeDifference.toFixed(2)}]`
        : `[Return ${creditNoteNumber}: ৳${totalReturnCredit.toFixed(2)} (${refundMethod}) - ${returnReasonCategory} ${returnReasonNotes ? `(${returnReasonNotes})` : ''}]`;
      const combinedNotes = sale.notes ? `${sale.notes}\n${returnNote}` : returnNote;

      const { error: saleUpdateErr } = await supabase
        .from('sales')
        .update({
          net_amount: newNet,
          paid_amount: newPaid,
          payment_status: newStatus,
          notes: combinedNotes,
        })
        .eq('id', sale.id);

      if (saleUpdateErr) throw saleUpdateErr;

      showMessage(
        isExchange
          ? `Product exchange processed successfully!`
          : `Sales return of ৳${totalReturnCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} processed & restocked!`,
        'success'
      );

      // Setup Credit Note Print
      setActiveCreditNote({
        creditNoteNumber,
        type: isExchange ? 'exchange' : 'return',
        date: new Date().toISOString(),
        sale: { ...sale, net_amount: newNet, paid_amount: newPaid },
        returnedItems: itemsToReturn,
        exchangeItems: isExchange ? exchangeCart : [],
        totalRefundValue: totalReturnCredit,
        totalExchangeValue,
        exchangeDifference,
        refundMethod: isExchange ? (exchangeDifference > 0 ? exchangePaymentMethod : refundMethod) : refundMethod,
        reasonCategory: returnReasonCategory,
        reasonNotes: returnReasonNotes,
      });

      setShowReturnModal(false);
      setShowCreditNotePrint(true);
      fetchSalesHistory();
      fetchBranchInventory();
    } catch (err) {
      console.error('Error processing sales return:', err);
      showMessage(err.message || 'Failed to process return/exchange.', 'error');
    } finally {
      setIsSubmittingReturn(false);
    }
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
                    {b.is_factory ? `🏭 ${b.name}` : `🏪 ${b.name}`}
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
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '1rem 1.25rem' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Invoices History</h3>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-control"
              style={{ paddingLeft: '2.25rem', padding: '0.35rem 0.6rem 0.35rem 2.25rem', fontSize: '0.82rem' }}
              placeholder="Search invoice number..."
              value={historySearchQuery}
              onChange={(e) => {
                setHistorySearchQuery(e.target.value);
                setSalesPage(1);
              }}
            />
          </div>
        </div>
        <div className="table-container" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
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
                  <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
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
                    const rowNumber = (salesPage - 1) * salesPageSize + index + 1;
                    return (
                      <tr key={sale.id}>
                        <td>{rowNumber}</td>
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
                          <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleRePrint(sale)}
                              title="Re-Print Invoice / Challan"
                            >
                              <Printer size={13} />
                              <span style={{ marginLeft: '0.2rem' }}>Print</span>
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenReturnModal(sale)}
                              title="Process Sales Return / Credit Note"
                              style={{ color: 'var(--warning-text, #d97706)' }}
                            >
                              <RotateCcw size={13} />
                              <span style={{ marginLeft: '0.2rem' }}>Return</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={salesPage}
            totalCount={salesTotalCount}
            pageSize={salesPageSize}
            onPageChange={setSalesPage}
            onPageSizeChange={setSalesPageSize}
          />
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
                        <label>Client Phone *</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="e.g. 018xxxxxxxx"
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                          required={customerType === 'new'}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>৳</span>
                              <input
                                type="number"
                                className="input-control cart-item-price-input"
                                min="0"
                                step="any"
                                value={item.unitPrice !== undefined ? item.unitPrice : (item.product.sale_price || 0)}
                                onChange={(e) => handleCustomPriceChange(item.product.id, e.target.value)}
                                onBlur={() => handlePriceBlur(item.product.id)}
                                title="Custom Unit Sale Price"
                                placeholder="Price"
                              />
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>/ {item.product.unit || 'pcs'}</span>
                            </div>
                          </div>
                          <div className="cart-item-qty-controls">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm qty-btn"
                              onClick={() => updateQty(item.product.id, -1)}
                              title="Decrease quantity"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              className="input-control cart-item-qty-input"
                              min="1"
                              step="any"
                              max={!isFactory ? item.stockLimit : undefined}
                              value={item.quantity}
                              onChange={(e) => handleCustomQtyChange(item.product.id, e.target.value)}
                              onBlur={() => handleQtyBlur(item.product.id)}
                              title={`Enter quantity (Available stock: ${item.stockLimit})`}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm qty-btn"
                              onClick={() => updateQty(item.product.id, 1)}
                              title="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: '70px', textAlign: 'right' }}>
                            ৳{(getItemPrice(item) * (parseFloat(item.quantity) || 0)).toFixed(2)}
                          </div>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm btn-icon"
                            style={{ background: 'none', border: 'none', color: 'var(--danger)' }}
                            onClick={() => removeFromCart(item.product.id)}
                            title="Remove item"
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
                        style={{ marginTop: '0.5rem', padding: '0.8rem', fontWeight: 700 }}
                        onClick={() => {
                          if (!selectedCustomerId) {
                            showMessage('Please select a Buyer / Client before checkout.', 'error');
                            return;
                          }
                          setPaidAmount(getGrandTotal().toFixed(2));
                          setPaymentMethod('cash');
                          setCustomerGivenCash('');
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
          <div className="modal-content" style={{ maxWidth: '480px', width: '95%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CreditCard size={18} style={{ color: 'var(--primary-color)' }} />
                Payment & Checkout
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCheckoutModal(false)} style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}>✕</button>
            </div>
            
            <form onSubmit={handleCheckoutSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', padding: '1.25rem' }}>
                
                {/* TOTAL AMOUNT BANNER */}
                <div style={{
                  background: 'var(--primary-light, rgba(37,99,235,0.08))',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md, 8px)',
                  textAlign: 'center',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Amount</div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', fontWeight: 800, color: 'var(--primary-color, #2563eb)' }}>
                    ৳{getGrandTotal().toFixed(2)}
                  </div>
                </div>

                {/* QUICK PRESETS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPaidAmount(getGrandTotal().toFixed(2));
                      setPaymentMethod('cash');
                    }}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '6px',
                      border: parseFloat(paidAmount || 0) === getGrandTotal() && getGrandTotal() > 0 ? '2px solid #10b981' : '1px solid var(--border-color)',
                      background: parseFloat(paidAmount || 0) === getGrandTotal() && getGrandTotal() > 0 ? 'rgba(16,185,129,0.12)' : 'var(--bg-secondary)',
                      color: parseFloat(paidAmount || 0) === getGrandTotal() && getGrandTotal() > 0 ? '#059669' : 'inherit',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.82rem'
                    }}
                  >
                    Full Paid
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaidAmount('0');
                    }}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '6px',
                      border: parseFloat(paidAmount || 0) === 0 ? '2px solid #ef4444' : '1px solid var(--border-color)',
                      background: parseFloat(paidAmount || 0) === 0 ? 'rgba(239,68,68,0.1)' : 'var(--bg-secondary)',
                      color: parseFloat(paidAmount || 0) === 0 ? '#dc2626' : 'inherit',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.82rem'
                    }}
                  >
                    Full Due
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaidAmount((getGrandTotal() / 2).toFixed(2));
                    }}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '6px',
                      border: parseFloat(paidAmount || 0) > 0 && parseFloat(paidAmount || 0) < getGrandTotal() ? '2px solid #d97706' : '1px solid var(--border-color)',
                      background: parseFloat(paidAmount || 0) > 0 && parseFloat(paidAmount || 0) < getGrandTotal() ? 'rgba(217,119,6,0.1)' : 'var(--bg-secondary)',
                      color: parseFloat(paidAmount || 0) > 0 && parseFloat(paidAmount || 0) < getGrandTotal() ? '#b45309' : 'inherit',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.82rem'
                    }}
                  >
                    50% Paid
                  </button>
                </div>

                {/* PAID AMOUNT & PAYMENT METHOD */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                      Paid Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input-control"
                      style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', padding: '0.5rem' }}
                      placeholder="0.00"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                      Payment Method
                    </label>
                    <select
                      className="input-control"
                      style={{ padding: '0.55rem', fontSize: '0.88rem' }}
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="cash">Cash</option>
                      <option value="mobile_banking">bKash / Nagad</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                {/* DUE, OVERPAID, OR FULL PAID STATUS */}
                {(() => {
                  const grandTotal = getGrandTotal();
                  const paid = parseFloat(paidAmount) || 0;
                  const due = Math.max(0, grandTotal - paid);
                  const overpaid = Math.max(0, paid - grandTotal);

                  if (due > 0.001) {
                    return (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid #fca5a5',
                        borderRadius: '6px',
                        padding: '0.6rem 0.85rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.85rem' }}>
                          Due Balance:
                        </span>
                        <span style={{ color: '#dc2626', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem' }}>
                          ৳{due.toFixed(2)}
                        </span>
                      </div>
                    );
                  } else if (overpaid > 0.001) {
                    return (
                      <div style={{
                        background: 'rgba(37, 99, 235, 0.08)',
                        border: '1px solid #93c5fd',
                        borderRadius: '6px',
                        padding: '0.6rem 0.85rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.85rem' }}>
                          Overpaid (Change):
                        </span>
                        <span style={{ color: '#2563eb', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem' }}>
                          ৳{overpaid.toFixed(2)}
                        </span>
                      </div>
                    );
                  } else {
                    return (
                      <div style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid #6ee7b7',
                        borderRadius: '6px',
                        padding: '0.6rem 0.85rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.85rem' }}>
                          Status:
                        </span>
                        <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.88rem' }}>
                          Paid in Full
                        </span>
                      </div>
                    );
                  }
                })()}

                {/* OPTIONAL NOTES & TRX */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                      Reference / Trx ID
                    </label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Optional"
                      style={{ fontSize: '0.82rem', padding: '0.35rem 0.5rem' }}
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                      Notes
                    </label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Optional"
                      style={{ fontSize: '0.82rem', padding: '0.35rem 0.5rem' }}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

              </div>

              <div className="modal-footer" style={{ padding: '0.75rem 1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCheckoutModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={loading}
                  style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Printer size={15} />
                  <span>{loading ? 'Processing...' : 'Confirm & Print'}</span>
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
      {/* SALES RETURN & CREDIT NOTE MODAL */}
      {showReturnModal && selectedSaleForReturn && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg" style={{ maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RotateCcw size={18} style={{ color: 'var(--warning-text, #d97706)' }} />
                  Sales Return
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Invoice: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedSaleForReturn.invoice_number || `INV#${selectedSaleForReturn.id.substring(0, 8).toUpperCase()}`}</span>
                  {' • '}Customer: <span style={{ fontWeight: 600 }}>{selectedSaleForReturn.contacts?.name || 'Walk-in Customer'}</span>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowReturnModal(false)}
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessReturn} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', margin: 0 }}>
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Invoice Summary Metric Bar */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.85rem'
                }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Date</div>
                    <div style={{ fontWeight: 600 }}>{new Date(selectedSaleForReturn.sale_date).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Bill</div>
                    <div style={{ fontWeight: 700 }}>৳{(selectedSaleForReturn.net_amount || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Paid</div>
                    <div style={{ fontWeight: 700, color: 'var(--success-text)' }}>৳{(selectedSaleForReturn.paid_amount || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Due</div>
                    <div style={{ fontWeight: 700, color: (selectedSaleForReturn.net_amount - selectedSaleForReturn.paid_amount) > 0 ? 'var(--danger-text)' : 'inherit' }}>
                      ৳{Math.max(0, (selectedSaleForReturn.net_amount || 0) - (selectedSaleForReturn.paid_amount || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Return Items Selection Table */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    Items to Return:
                  </label>
                  {loadingReturnItems ? (
                    <LoadingBlock message="Loading items..." />
                  ) : returnLineItems.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                      No items found on this invoice.
                    </div>
                  ) : (
                    <div className="table-container" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th style={{ textAlign: 'center', width: '90px' }}>Sold</th>
                            <th style={{ textAlign: 'right', width: '100px' }}>Price</th>
                            <th style={{ textAlign: 'center', width: '120px' }}>Return Qty</th>
                            <th style={{ textAlign: 'right', width: '110px' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {returnLineItems.map((item, idx) => {
                            const retQty = parseInt(item.returnQty || 0);
                            const unitP = parseFloat(item.unit_price || 0);
                            const lineTotal = retQty * unitP;
                            return (
                              <tr key={item.id || idx}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{item.products?.name || 'Product'}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    SKU: {item.products?.sku || item.products?.product_code || 'N/A'}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center', fontWeight: 600 }}>
                                  {item.quantity}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  ৳{unitP.toFixed(2)}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                                    <input
                                      type="number"
                                      min="0"
                                      max={item.quantity}
                                      value={item.returnQty === '' ? '' : item.returnQty}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setReturnLineItems((prev) =>
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
                                        setReturnLineItems((prev) =>
                                          prev.map((it, i) => (i === idx ? { ...it, returnQty: it.quantity } : it))
                                        );
                                      }}
                                      title="Return all"
                                    >
                                      All
                                    </button>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: lineTotal > 0 ? 'var(--warning-text, #d97706)' : 'inherit' }}>
                                  ৳{lineTotal.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Return Refund Summary Card */}
                {(() => {
                  const totalRefund = returnLineItems.reduce((sum, it) => sum + (parseFloat(it.unit_price || 0) * (parseInt(it.returnQty || 0) || 0)), 0);
                  const due = Math.max(0, (selectedSaleForReturn.net_amount || 0) - (selectedSaleForReturn.paid_amount || 0));

                  return (
                    <div style={{
                      padding: '0.85rem 1rem',
                      background: totalRefund > 0 ? 'rgba(217, 119, 6, 0.08)' : 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${totalRefund > 0 ? 'var(--warning-text, #d97706)' : 'var(--border-color)'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem'
                    }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                        Total Refund: <span style={{ color: 'var(--warning-text, #d97706)' }}>৳{totalRefund.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      {due > 0 && totalRefund > 0 && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Remaining Due: <strong>৳{Math.max(0, due - totalRefund).toFixed(2)}</strong>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Return Type Selector */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                    Return Type
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setReturnType('cash');
                        setRefundMethod('cash');
                        setReturnReasonCategory('Damaged / Defect');
                      }}
                      style={{
                        padding: '0.6rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        border: returnType === 'cash' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                        background: returnType === 'cash' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-secondary)',
                        color: returnType === 'cash' ? 'var(--primary-color)' : 'inherit',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                      }}
                    >
                      <DollarSign size={16} />
                      <span>Cash Refund</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setReturnType('exchange');
                        setRefundMethod('exchange');
                        setReturnReasonCategory('Exchange / Return');
                      }}
                      style={{
                        padding: '0.6rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        border: returnType === 'exchange' ? '2px solid #10b981' : '1px solid var(--border-color)',
                        background: returnType === 'exchange' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)',
                        color: returnType === 'exchange' ? '#059669' : 'inherit',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                      }}
                    >
                      <RefreshCw size={16} />
                      <span>Exchange</span>
                    </button>
                  </div>
                </div>

                {/* REPLACEMENT PRODUCT SELECTOR (IF EXCHANGE) */}
                {returnType === 'exchange' && (
                  <div style={{
                    padding: '1rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem'
                  }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <ShoppingCart size={15} />
                      Choose Replacement Products from Stock:
                    </div>

                    {/* Search catalog */}
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="input-control"
                        style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
                        placeholder="Search product name or SKU..."
                        value={exchangeSearch}
                        onChange={(e) => setExchangeSearch(e.target.value)}
                      />
                    </div>

                    {/* Available product quick pick */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto' }}>
                      {products
                        .filter((p) =>
                          p.products?.name?.toLowerCase().includes(exchangeSearch.toLowerCase()) ||
                          p.products?.sku?.toLowerCase().includes(exchangeSearch.toLowerCase())
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
                            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.products?.name}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              <span>৳{(item.products?.sale_price || 0).toFixed(2)}</span>
                              <span>Stock: {isFactory ? '∞' : item.quantity}</span>
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Exchange Cart Table */}
                    {exchangeCart.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                          Selected Replacement Items:
                        </div>
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

                {/* Summary Card */}
                {(() => {
                  const totalReturn = returnLineItems.reduce((sum, it) => sum + (parseFloat(it.unit_price || 0) * (parseInt(it.returnQty || 0) || 0)), 0);
                  const totalExchange = returnType === 'exchange'
                    ? exchangeCart.reduce((sum, it) => sum + (parseFloat(it.unit_price || 0) * (parseFloat(it.quantity || 0) || 0)), 0)
                    : 0;
                  const diff = totalExchange - totalReturn;
                  const due = Math.max(0, (selectedSaleForReturn.net_amount || 0) - (selectedSaleForReturn.paid_amount || 0));

                  return (
                    <div style={{
                      padding: '0.85rem 1rem',
                      background: returnType === 'exchange' ? 'rgba(37, 99, 235, 0.05)' : (totalReturn > 0 ? 'rgba(217, 119, 6, 0.08)' : 'var(--bg-secondary)'),
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${returnType === 'exchange' ? 'var(--primary-color)' : (totalReturn > 0 ? 'var(--warning-text, #d97706)' : 'var(--border-color)')}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Returned Goods Total:</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--warning-text, #d97706)' }}>
                          ৳{totalReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>

                      {returnType === 'exchange' && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Replacement Goods Total:</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary-color)' }}>
                              ৳{totalExchange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Settlement:</div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: diff > 0 ? 'var(--danger-text)' : (diff < 0 ? 'var(--success-text)' : 'inherit') }}>
                              {diff > 0 ? `Customer to Pay: +৳${diff.toFixed(2)}` : (diff < 0 ? `Store to Refund: -৳${Math.abs(diff).toFixed(2)}` : 'Even Exchange (৳0.00)')}
                            </div>
                          </div>
                        </>
                      )}

                      {returnType === 'cash' && due > 0 && totalReturn > 0 && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Remaining Due: <strong>৳{Math.max(0, due - totalReturn).toFixed(2)}</strong>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Settlement Method & Reason */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {returnType === 'cash' ? (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.85rem' }}>Refund Method</label>
                      <select
                        className="input-control"
                        value={refundMethod}
                        onChange={(e) => setRefundMethod(e.target.value)}
                      >
                        <option value="cash">Cash</option>
                        {(selectedSaleForReturn.net_amount - selectedSaleForReturn.paid_amount) > 0.01 && (
                          <option value="deduct_due">Deduct from Due</option>
                        )}
                        <option value="mobile_banking">bKash / Nagad</option>
                        <option value="bank">Bank Transfer</option>
                      </select>
                    </div>
                  ) : (
                    (() => {
                      const totalRet = returnLineItems.reduce((sum, it) => sum + (parseFloat(it.unit_price || 0) * (parseInt(it.returnQty || 0) || 0)), 0);
                      const totalExc = exchangeCart.reduce((sum, it) => sum + (parseFloat(it.unit_price || 0) * (parseFloat(it.quantity || 0) || 0)), 0);
                      const diff = totalExc - totalRet;

                      if (diff > 0) {
                        return (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.85rem' }}>Payment Method (+৳{diff.toFixed(2)})</label>
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
                        );
                      } else if (diff < 0) {
                        return (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.85rem' }}>Refund Difference (-৳{Math.abs(diff).toFixed(2)})</label>
                            <select
                              className="input-control"
                              value={refundMethod}
                              onChange={(e) => setRefundMethod(e.target.value)}
                            >
                              <option value="cash">Cash</option>
                              <option value="mobile_banking">bKash / Nagad</option>
                              <option value="bank">Bank Transfer</option>
                              {(selectedSaleForReturn.net_amount - selectedSaleForReturn.paid_amount) > 0.01 && (
                                <option value="deduct_due">Deduct from Due</option>
                              )}
                            </select>
                          </div>
                        );
                      } else {
                        return (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.85rem' }}>Settlement</label>
                            <div className="input-control" style={{ background: 'var(--bg-secondary)', fontWeight: 600, color: 'var(--success-text)' }}>
                              ✓ Even Exchange (৳0.00)
                            </div>
                          </div>
                        );
                      }
                    })()
                  )}

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.85rem' }}>Reason</label>
                    <select
                      className="input-control"
                      value={returnReasonCategory}
                      onChange={(e) => setReturnReasonCategory(e.target.value)}
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
                    value={returnReasonNotes}
                    onChange={(e) => setReturnReasonNotes(e.target.value)}
                  />
                </div>

              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReturnModal(false)} disabled={isSubmittingReturn}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={returnType === 'exchange' ? 'btn btn-primary' : 'btn btn-warning'}
                  disabled={isSubmittingReturn || returnLineItems.every((it) => !parseInt(it.returnQty || 0))}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
                >
                  {returnType === 'exchange' ? <RefreshCw size={15} /> : <RotateCcw size={15} />}
                  <span>{isSubmittingReturn ? 'Processing...' : returnType === 'exchange' ? 'Confirm Exchange' : 'Confirm Return'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREDIT NOTE PRINT PREVIEW MODAL */}
      {showCreditNotePrint && activeCreditNote && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header no-print">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} style={{ color: 'var(--primary-color)' }} />
                {activeCreditNote.type === 'exchange' ? 'Product Exchange Voucher' : 'Credit Note / Sales Return Receipt'}
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCreditNotePrint(false)}
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
                    <div className="invoice-title" style={{ color: activeCreditNote.type === 'exchange' ? '#2563eb' : '#b45309' }}>
                      {activeCreditNote.type === 'exchange' ? 'EXCHANGE VOUCHER' : 'CREDIT NOTE'}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {activeCreditNote.creditNoteNumber}
                    </div>
                    <div>Date: {new Date(activeCreditNote.date).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Ref Inv: <strong>{activeCreditNote.sale.invoice_number || `INV#${activeCreditNote.sale.id.substring(0, 8).toUpperCase()}`}</strong>
                    </div>
                  </div>
                </div>

                <div className="invoice-details-grid">
                  <div className="invoice-bill-to">
                    <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {activeCreditNote.type === 'exchange' ? 'Exchange Customer:' : 'Credit Issued To:'}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{activeCreditNote.sale.contacts?.name || 'Walk-in Customer'}</div>
                    {activeCreditNote.sale.contacts?.phone && <div>Phone: {activeCreditNote.sale.contacts.phone}</div>}
                    {activeCreditNote.sale.contacts?.address && <div>Address: {activeCreditNote.sale.contacts.address}</div>}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.88rem' }}>
                    <div style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Settlement Details</div>
                    <div>Type: <strong>{activeCreditNote.type === 'exchange' ? 'Product Exchange' : 'Return / Refund'}</strong></div>
                    <div>Reason: <strong>{activeCreditNote.reasonCategory}</strong></div>
                    {activeCreditNote.reasonNotes && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Note: {activeCreditNote.reasonNotes}</div>}
                  </div>
                </div>

                {/* 1. Returned Items Table */}
                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginTop: '1.25rem', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                  1. Returned Items (Restocked):
                </div>
                <table className="invoice-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>SL</th>
                      <th>Returned Product / Item</th>
                      <th style={{ textAlign: 'center', width: '90px' }}>Return Qty</th>
                      <th style={{ textAlign: 'right', width: '110px' }}>Unit Price</th>
                      <th style={{ textAlign: 'right', width: '130px' }}>Credit Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCreditNote.returnedItems.map((item, index) => {
                      const retQty = parseInt(item.returnQty || 0);
                      const unitP = parseFloat(item.unit_price || 0);
                      const lineTotal = retQty * unitP;
                      return (
                        <tr key={item.id || index}>
                          <td>{index + 1}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.products?.name || 'Product'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              SKU: {item.products?.sku || item.products?.product_code || 'N/A'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{retQty}</td>
                          <td style={{ textAlign: 'right' }}>৳{unitP.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{lineTotal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* 2. Replacement Items Table (if Exchange) */}
                {activeCreditNote.type === 'exchange' && activeCreditNote.exchangeItems?.length > 0 && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', marginTop: '1.25rem', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                      2. New Replacement Items Dispatched:
                    </div>
                    <table className="invoice-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>SL</th>
                          <th>Replacement Item</th>
                          <th style={{ textAlign: 'center', width: '90px' }}>Qty</th>
                          <th style={{ textAlign: 'right', width: '110px' }}>Price</th>
                          <th style={{ textAlign: 'right', width: '130px' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeCreditNote.exchangeItems.map((item, index) => {
                          const qty = parseFloat(item.quantity || 0);
                          const unitP = parseFloat(item.unit_price || 0);
                          const lineTotal = qty * unitP;
                          return (
                            <tr key={item.product_id || index}>
                              <td>{index + 1}</td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{item.product?.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKU: {item.product?.sku || 'N/A'}</div>
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 700 }}>{qty}</td>
                              <td style={{ textAlign: 'right' }}>৳{unitP.toFixed(2)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{lineTotal.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '320px', alignSelf: 'flex-end', marginTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <span>Returned Items Value:</span>
                    <span>৳{(activeCreditNote.totalRefundValue || 0).toFixed(2)}</span>
                  </div>

                  {activeCreditNote.type === 'exchange' ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        <span>Replacement Items Value:</span>
                        <span>৳{(activeCreditNote.totalExchangeValue || 0).toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '2px solid var(--text-primary)', paddingTop: '0.5rem', fontSize: '1.1rem' }}>
                        <span>Net Settlement:</span>
                        <span style={{ color: activeCreditNote.exchangeDifference > 0 ? '#dc2626' : (activeCreditNote.exchangeDifference < 0 ? '#10b981' : '#2563eb') }}>
                          {activeCreditNote.exchangeDifference > 0
                            ? `Customer Paid: +৳${activeCreditNote.exchangeDifference.toFixed(2)}`
                            : (activeCreditNote.exchangeDifference < 0
                              ? `Refunded: -৳${Math.abs(activeCreditNote.exchangeDifference).toFixed(2)}`
                              : 'Even Exchange (৳0.00)')}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '2px solid var(--text-primary)', paddingTop: '0.5rem', fontSize: '1.15rem' }}>
                      <span>Total Credit Amount:</span>
                      <span style={{ color: '#b45309' }}>৳{(activeCreditNote.totalRefundValue || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <div style={{ textAlign: 'center', width: '180px' }}>
                    <div style={{ borderTop: '1px dashed var(--text-muted)', paddingTop: '0.4rem', fontWeight: 600 }}>Customer Signature</div>
                  </div>
                  <div style={{ textAlign: 'center', width: '180px' }}>
                    <div style={{ borderTop: '1px dashed var(--text-muted)', paddingTop: '0.4rem', fontWeight: 600 }}>Store In-Charge</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed var(--border-color)', marginTop: '2rem', paddingTop: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  This is an official voucher issued by Almas Accessories for returned / exchanged merchandise.
                </div>
              </div>
            </div>

            <div className="modal-footer no-print">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreditNotePrint(false)}>Close</button>
              <button type="button" className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Printer size={16} />
                <span>{activeCreditNote.type === 'exchange' ? 'Print Exchange Voucher' : 'Print Credit Note'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
