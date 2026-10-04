import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import almasLogo from '../assets/almas_logo.jpg';
import {
  Search,
  ShoppingCart,
  Trash2,
  Printer,
  Plus,
  UserPlus,
  CreditCard,
  RotateCcw,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  DollarSign,
  RefreshCw,
  Eye,
  Edit,
  Calendar,
  User,
  Package,
  Banknote,
} from 'lucide-react';
import { TableLoading, LoadingBlock } from '../components/TableLoading';
import Pagination from '../components/Pagination';
import { formatAmount, formatPlainNumber } from '../utils/format';

const getSaleReceiptNo = (sale) => {
  if (!sale) return '';
  if (sale.receipt_no) return String(sale.receipt_no).trim();
  if (sale.receipt_number) return String(sale.receipt_number).trim();
  if (sale.manual_receipt_no) return String(sale.manual_receipt_no).trim();
  if (!sale.notes) return '';
  const match = sale.notes.match(/\[RECEIPT:([^\]]*)\]/);
  return match ? match[1].trim() : '';
};

const getSaleCleanNotes = (sale) => {
  if (!sale || !sale.notes) return '';
  let str = sale.notes;
  str = str.replace(/\[RECEIPT:[^\]]*\]\s*/g, '');
  return str.trim();
};

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

  // Sales Details Modal State
  const [showSaleDetailsModal, setShowSaleDetailsModal] = useState(false);
  const [selectedSaleForDetails, setSelectedSaleForDetails] = useState(null);
  const [saleDetailItems, setSaleDetailItems] = useState([]);
  const [saleDetailReturns, setSaleDetailReturns] = useState([]);
  const [saleDetailReplacements, setSaleDetailReplacements] = useState([]);
  const [saleDetailPayments, setSaleDetailPayments] = useState([]);
  const [loadingSaleDetails, setLoadingSaleDetails] = useState(false);

  // Sales Edit Modal State
  const [showEditSaleModal, setShowEditSaleModal] = useState(false);
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editSaleDate, setEditSaleDate] = useState('');
  const [editStoredReceiptNo, setEditStoredReceiptNo] = useState('');
  const [editIsShowroomChallan, setEditIsShowroomChallan] = useState(false);
  const [editCart, setEditCart] = useState([]);
  const [originalSaleItems, setOriginalSaleItems] = useState([]);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editTaxRate, setEditTaxRate] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editProductSearch, setEditProductSearch] = useState('');
  const [showEditSearchDropdown, setShowEditSearchDropdown] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [loadingEditItems, setLoadingEditItems] = useState(false);
  const editSearchRef = useRef(null);

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

  // Payment Collection Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSaleForPayment, setSelectedSaleForPayment] = useState(null);
  const [collectPaymentAmount, setCollectPaymentAmount] = useState('');
  const [collectPaymentDate, setCollectPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [collectPaymentMethod, setCollectPaymentMethod] = useState('cash');
  const [collectPaymentRef, setCollectPaymentRef] = useState('');
  const [collectPaymentNotes, setCollectPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Factory Showroom Challan State
  const [isShowroomChallan, setIsShowroomChallan] = useState(false);

  const resetPosForm = useCallback(() => {
    setCart([]);
    setSelectedCustomerId('');
    setIsShowroomChallan(false);
    setDiscount(0);
    setTaxRate(0);
    setPaidAmount('');
    setCustomerGivenCash('');
    setPaymentMethod('cash');
    setReferenceNumber('');
    setStoredReceiptNo('');
    setNotes('');
    setCustomerType('existing');
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setCustomProdCode('');
    setCustomProdName('');
    setCustomProdPrice('');
    setCustomProdQty(1);
    setCustomProdSize('');
    setCustomProdCarton('');
    setCustomProdCategory('');
    setShowCustomProdForm(false);
    setCartSearchQuery('');
    setShowCartSearchSuggestions(false);
  }, []);

  useEffect(() => {
    if (location.state?.openPos || location.state?.openNewSale) {
      resetPosForm();
      setShowPosModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, resetPosForm]);

  // POS Search/Select
  const [customerType, setCustomerType] = useState('existing'); // 'existing' or 'new'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [cartSearchQuery, setCartSearchQuery] = useState('');
  const [showCartSearchSuggestions, setShowCartSearchSuggestions] = useState(false);
  const cartSearchRef = useRef(null);

  // Custom / Unlisted Product (Not from Book) States
  const [showCustomProdForm, setShowCustomProdForm] = useState(false);
  const [customProdCode, setCustomProdCode] = useState('');
  const [customProdName, setCustomProdName] = useState('');
  const [customProdPrice, setCustomProdPrice] = useState('');
  const [customProdQty, setCustomProdQty] = useState(1);
  const [customProdSize, setCustomProdSize] = useState('');
  const [customProdCarton, setCustomProdCarton] = useState('');
  const [customProdCategory, setCustomProdCategory] = useState('');
  const [isCheckingCustomCode, setIsCheckingCustomCode] = useState(false);

  // Close search suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (cartSearchRef.current && !cartSearchRef.current.contains(event.target)) {
        setShowCartSearchSuggestions(false);
      }
      if (editSearchRef.current && !editSearchRef.current.contains(event.target)) {
        setShowEditSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Checkout overlay/popup states
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0); // in %
  const [paidAmount, setPaidAmount] = useState('');
  const [customerGivenCash, setCustomerGivenCash] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [storedReceiptNo, setStoredReceiptNo] = useState('');
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

  useEffect(() => {
    if (!isFactory) {
      setIsShowroomChallan(false);
    }
  }, [selectedBranchId, isFactory]);

  const isShowroomContact = useCallback((contactOrId) => {
    if (!contactOrId) return false;
    let contact = null;
    if (typeof contactOrId === 'object') {
      contact = contactOrId;
    } else {
      contact = customers.find((c) => c.id === contactOrId);
    }
    if (!contact) return false;
    const cName = (contact.name || '').toLowerCase().trim();
    return (
      cName === 'gazipur showroom' ||
      cName.includes('showroom') ||
      branches.some((b) => !b.is_factory && b.name?.toLowerCase().trim() === cName)
    );
  }, [customers, branches]);

  const getShowroomCustomers = useCallback(() => {
    return customers.filter((c) => isShowroomContact(c));
  }, [customers, isShowroomContact]);

  const isSaleShowroomChallan = useCallback((sale) => {
    if (!sale) return false;
    const saleBranch = branches.find((b) => b.id === sale.branch_id);
    const isSaleFactory = Boolean(saleBranch?.is_factory || saleBranch?.name?.toLowerCase().includes('factory') || isFactory);
    if (sale.is_showroom_challan) return true;
    if (isSaleFactory) {
      if (isShowroomContact(sale.customer_id)) return true;
      const cName = (sale.contacts?.name || '').toLowerCase().trim();
      if (cName === 'gazipur showroom' || cName.includes('showroom')) return true;
    }
    return false;
  }, [branches, isFactory, isShowroomContact]);

  const handleToggleShowroomChallan = (checked) => {
    setIsShowroomChallan(checked);
    if (checked) {
      setCustomerType('existing');
      const showroomList = getShowroomCustomers();
      if (showroomList.length > 0) {
        if (!selectedCustomerId || !isShowroomContact(selectedCustomerId)) {
          setSelectedCustomerId(showroomList[0].id);
        }
      }
    }
  };

  const handleToggleEditShowroomChallan = (checked) => {
    setEditIsShowroomChallan(checked);
    if (checked) {
      const showroomList = getShowroomCustomers();
      if (showroomList.length > 0) {
        if (!editCustomerId || !isShowroomContact(editCustomerId)) {
          setEditCustomerId(showroomList[0].id);
        }
      }
    }
  };

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
        let { data, error } = await supabase
          .from('inventory')
          .select(`
            quantity,
            product_id,
            purchase_price,
            sale_price,
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

        if (error) {
          // Graceful fallback if inventory table doesn't have purchase_price/sale_price columns yet
          const fallbackRes = await supabase
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

          if (fallbackRes.error) throw fallbackRes.error;
          data = fallbackRes.data;
        }

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
          ),
          sale_items (
            id,
            quantity
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
        const rawClean = historySearchQuery.trim();
        const cleanNoHash = rawClean.replace(/^#+/, '').trim();
        const clean = cleanNoHash || rawClean;
        const { data: matchedContacts } = await supabase
          .from('contacts')
          .select('id')
          .or(`name.ilike.%${clean}%,phone.ilike.%${clean}%`)
          .limit(30);

        if (matchedContacts && matchedContacts.length > 0) {
          const contactIds = matchedContacts.map((c) => c.id).join(',');
          query = query.or(`invoice_number.ilike.%${clean}%,receipt_number.ilike.%${clean}%,receipt_number.ilike.%${rawClean}%,notes.ilike.%${clean}%,customer_id.in.(${contactIds})`);
        } else {
          query = query.or(`invoice_number.ilike.%${clean}%,receipt_number.ilike.%${clean}%,receipt_number.ilike.%${rawClean}%,notes.ilike.%${clean}%`);
        }
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
          id,
          sale_id,
          product_id,
          quantity,
          unit_price,
          total_price,
          products (
            id,
            sku,
            product_code,
            name,
            sale_price
          )
        `)
        .eq('sale_id', sale.id);

      if (error) throw error;

      let fullSale = sale;
      if (!sale.contacts && sale.customer_id) {
        const { data: cust } = await supabase
          .from('contacts')
          .select('name, phone, address')
          .eq('id', sale.customer_id)
          .maybeSingle();
        if (cust) {
          fullSale = { ...sale, contacts: cust };
        }
      }

      const mappedItems = (items || []).map((item) => ({
        id: item.id,
        product: {
          id: item.product_id,
          sku: item.products?.sku || item.products?.product_code || '',
          name: item.products?.name || 'Unknown',
          sale_price: parseFloat(item.unit_price) || parseFloat(item.products?.sale_price) || 0,
          unit: 'pcs',
        },
        products: item.products,
        quantity: parseFloat(item.quantity) || 1,
        unit_price: parseFloat(item.unit_price) || 0,
        total_price: parseFloat(item.total_price) || 0,
      }));

      setActiveInvoice(fullSale);
      setInvoiceItems(mappedItems);
      setShowInvoicePrint(true);
    } catch (err) {
      console.error('Error loading invoice items:', err);
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
      const effectivePrice = (invItem.sale_price !== null && invItem.sale_price !== undefined)
        ? parseFloat(invItem.sale_price) || 0
        : (product.sale_price !== undefined ? parseFloat(product.sale_price) || 0 : 0);

      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          size: '',
          number_of_carton: '',
          unitPrice: effectivePrice,
          stockLimit: isFactory ? 999999 : invItem.quantity,
        },
      ]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const updateItemSize = (productId, size) => {
    setCart(cart.map((item) => (item.product.id === productId ? { ...item, size } : item)));
  };

  const updateItemCarton = (productId, number_of_carton) => {
    setCart(cart.map((item) => (item.product.id === productId ? { ...item, number_of_carton } : item)));
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
  const getTotalQuantity = () => {
    return cart.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + getItemPrice(item) * (parseFloat(item.quantity) || 0), 0);
  };

  const getTaxAmount = () => {
    const sub = getSubtotal();
    const disc = parseFloat(discount) || 0;
    const rate = parseFloat(taxRate) || 0;
    return Math.max(0, (sub - disc) * (rate / 100));
  };

  const getGrandTotal = () => {
    const sub = getSubtotal();
    const disc = parseFloat(discount) || 0;
    const subAfterDiscount = Math.max(0, sub - disc);
    const tax = getTaxAmount();
    return Math.max(0, subAfterDiscount + tax);
  };

  // Add Unlisted Product (Not from Book) to POS Cart
  const handleAddCustomProduct = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = customProdCode.trim();
    const cleanName = customProdName.trim();
    const cleanCategory = customProdCategory.trim();

    if (!cleanCode) {
      showMessage('Please provide a Product Code for the unlisted item.', 'error');
      return;
    }

    // 1. Check if same code is already in current Cart
    const alreadyInCart = cart.some(
      (item) =>
        (item.product?.sku && item.product.sku.toLowerCase() === cleanCode.toLowerCase()) ||
        (item.product?.product_code && item.product.product_code.toLowerCase() === cleanCode.toLowerCase())
    );
    if (alreadyInCart) {
      showMessage(`Product with code "${cleanCode}" is already in your invoice cart!`, 'error');
      return;
    }

    // 2. Check if product exists in local loaded branch products catalog
    const existsInLocal = products.some(
      (p) =>
        (p.products?.sku && p.products.sku.toLowerCase() === cleanCode.toLowerCase()) ||
        (p.products?.product_code && p.products.product_code.toLowerCase() === cleanCode.toLowerCase())
    );
    if (existsInLocal) {
      showMessage(`Product with code "${cleanCode}" already exists in the product list! Please select it from the catalog.`, 'error');
      return;
    }

    // 3. Query Supabase products table to verify globally
    setIsCheckingCustomCode(true);
    try {
      const { data: existingDbProds, error: checkErr } = await supabase
        .from('products')
        .select('id, name, sku, product_code')
        .or(`sku.ilike.${cleanCode},product_code.ilike.${cleanCode}`)
        .limit(1);

      if (checkErr) throw checkErr;

      if (existingDbProds && existingDbProds.length > 0) {
        const existingItem = existingDbProds[0];
        showMessage(
          `Product with code "${cleanCode}" already exists in the product list (${existingItem.name || existingItem.sku || 'Catalog item'})!`,
          'error'
        );
        setIsCheckingCustomCode(false);
        return;
      }

      const parsedPrice = parseFloat(customProdPrice) || 0;
      const parsedQty = parseFloat(customProdQty) || 1;
      const displayName = cleanName || cleanCode;

      const customCartItem = {
        product: {
          id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          sku: cleanCode,
          product_code: cleanCode,
          name: displayName,
          sale_price: parsedPrice,
          category: cleanCategory || null,
          unit: 'pcs',
          is_custom_unlisted: true,
        },
        quantity: parsedQty > 0 ? parsedQty : 1,
        size: customProdSize.trim(),
        number_of_carton: customProdCarton !== '' ? customProdCarton : '',
        unitPrice: parsedPrice,
        stockLimit: 999999,
        isCustomUnlisted: true,
        rawCode: cleanCode,
        rawName: displayName,
        rawCategory: cleanCategory,
      };

      setCart([...cart, customCartItem]);
      setCustomProdCode('');
      setCustomProdName('');
      setCustomProdPrice('');
      setCustomProdQty(1);
      setCustomProdSize('');
      setCustomProdCarton('');
      setCustomProdCategory('');
      setShowCustomProdForm(false);
      setCartSearchQuery('');
      setShowCartSearchSuggestions(false);
      showMessage(`Added unlisted item "${displayName}" [${cleanCode}] to invoice cart.`, 'success');
    } catch (err) {
      console.error('Error verifying product code:', err);
      showMessage('Failed to verify product code.', 'error');
    } finally {
      setIsCheckingCustomCode(false);
    }
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
      if (!isFactory && !item.isCustomUnlisted && q > item.stockLimit) {
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
      // 0. Auto-save any Custom / Unlisted products to `products` and `inventory` tables
      const customProdIdMap = {};
      for (const item of cart) {
        if (item.isCustomUnlisted || item.product?.is_custom_unlisted) {
          const cleanCode = item.product.sku || item.rawCode;
          const displayName = item.product.name || item.rawName || cleanCode;
          const price = getItemPrice(item);
          const cat = item.rawCategory || item.product.category || null;

          // Check if already in DB (in case created concurrently)
          const { data: existingList } = await supabase
            .from('products')
            .select('id, name, sku, product_code')
            .or(`sku.ilike.${cleanCode},product_code.ilike.${cleanCode}`)
            .limit(1);

          let realProdId = null;
          if (existingList && existingList.length > 0) {
            realProdId = existingList[0].id;
          } else {
            const { data: newProd, error: insertProdErr } = await supabase
              .from('products')
              .insert([
                {
                  sku: cleanCode,
                  product_code: cleanCode,
                  name: displayName,
                  category: cat,
                  purchase_price: 0,
                  sale_price: price,
                  description: 'Added via POS Invoice (Custom / Unlisted item)',
                },
              ])
              .select()
              .single();

            if (insertProdErr) throw insertProdErr;
            realProdId = newProd.id;

            if (branches && branches.length > 0) {
              const invUpserts = branches.map((b) => ({
                branch_id: b.id,
                product_id: realProdId,
                quantity: 0,
                purchase_price: null,
                sale_price: price,
                updated_at: new Date().toISOString(),
              }));
              const { error: invErr } = await supabase
                .from('inventory')
                .upsert(invUpserts, { onConflict: 'branch_id,product_id', ignoreDuplicates: false });
              if (invErr) console.warn('Inventory upsert warning for custom product:', invErr);
            }
          }
          customProdIdMap[item.product.id] = realProdId;
        }
      }

      // Create or link contact if it's a new customer
      if (customerType === 'new') {
        const trimmedCustName = newCustName.trim();
        const trimmedCustPhone = newCustPhone.trim();
        const trimmedCustAddress = newCustAddress.trim();

        if (!trimmedCustName) {
          showMessage('Please enter the customer name.', 'error');
          setLoading(false);
          return;
        }

        if (trimmedCustPhone) {
          if (!/^\+?[0-9\s\-()]{7,15}$/.test(trimmedCustPhone)) {
            showMessage('Please enter a valid customer phone number (7-15 digits).', 'error');
            setLoading(false);
            return;
          }

          // Check if customer with this phone number already exists
          const { data: dupClient, error: dupErr } = await supabase
            .from('contacts')
            .select('id, name, phone')
            .eq('phone', trimmedCustPhone)
            .eq('type', 'customer');

          if (dupErr) throw dupErr;

          if (dupClient && dupClient.length > 0) {
            const existingCustomer = dupClient[0];
            customerId = existingCustomer.id;
            setSelectedCustomerId(existingCustomer.id);
            showMessage(`Customer with phone "${trimmedCustPhone}" already exists (${existingCustomer.name}). Linking invoice to existing profile.`, 'info');
          } else {
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
            setCustomers((prev) => [contactData, ...prev]);
            setSelectedCustomerId(contactData.id);
          }
        } else {
          const { data: contactData, error: contactError } = await supabase
            .from('contacts')
            .insert([
              {
                type: 'customer',
                name: trimmedCustName,
                phone: null,
                address: trimmedCustAddress || null,
                branch_id: selectedBranchId,
              }
            ])
            .select()
            .single();

          if (contactError) throw contactError;
          customerId = contactData.id;
          setCustomers((prev) => [contactData, ...prev]);
          setSelectedCustomerId(contactData.id);
        }
      }

      const subtotal = getSubtotal();
      const taxAmount = getTaxAmount();
      const grandTotal = getGrandTotal();
      const rawPaid = parseFloat(paidAmount) || 0.00;
      const initialPaid = Math.min(rawPaid, grandTotal);

      const cleanUserNotes = notes.trim();
      const cleanReceipt = storedReceiptNo.trim();

      // 1. Insert Sales Invoice
      const isChallan = isFactory && Boolean(isShowroomChallan || isShowroomContact(customerId));

      const salePayload = {
        branch_id: selectedBranchId,
        customer_id: customerId,
        total_amount: subtotal,
        discount: discount,
        tax: taxAmount,
        net_amount: grandTotal,
        paid_amount: 0.00, // Trigger will compute this from payments
        payment_status: 'unpaid', // Trigger will compute this
        created_by: userProfile.id,
        receipt_number: cleanReceipt || null,
        notes: cleanUserNotes || null,
        is_showroom_challan: isChallan,
      };

      let { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([salePayload])
        .select();

      if (saleError && (saleError.message?.includes('is_showroom_challan') || saleError.message?.includes('tax'))) {
        if (saleError.message?.includes('is_showroom_challan')) delete salePayload.is_showroom_challan;
        if (saleError.message?.includes('tax')) delete salePayload.tax;
        const retry = await supabase.from('sales').insert([salePayload]).select();
        if (retry.error) throw retry.error;
        saleData = retry.data;
        saleError = null;
      }

      if (saleError) throw saleError;
      const saleId = saleData[0].id;

      // 2. Insert Sale Items (including size, number_of_carton, and resolved custom product_id)
      const saleItemsData = cart.map((item) => {
        const resolvedProductId = customProdIdMap[item.product.id] || item.product.id;
        const qty = parseFloat(item.quantity) || 1;
        const price = getItemPrice(item);
        const row = {
          sale_id: saleId,
          product_id: resolvedProductId,
          quantity: qty,
          unit_price: price,
          total_price: price * qty,
        };
        if (item.size) row.size = item.size;
        if (item.number_of_carton) {
          const ctn = parseInt(item.number_of_carton, 10);
          if (!isNaN(ctn)) row.number_of_carton = ctn;
        }
        return row;
      });

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsData);
      if (itemsError) {
        if (itemsError.message?.includes('size') || itemsError.message?.includes('number_of_carton')) {
          const fallbackData = cart.map((item) => {
            const resolvedProductId = customProdIdMap[item.product.id] || item.product.id;
            const qty = parseFloat(item.quantity) || 1;
            const price = getItemPrice(item);
            return {
              sale_id: saleId,
              product_id: resolvedProductId,
              quantity: qty,
              unit_price: price,
              total_price: price * qty,
            };
          });
          const { error: fbErr } = await supabase.from('sale_items').insert(fallbackData);
          if (fbErr) throw fbErr;
        } else {
          throw itemsError;
        }
      }

      // 2.1 FIFO deduction on branch_challan_items for this branch (tracks sold vs left on Challans)
      if (!isFactory) {
        for (const item of cart) {
          if (item.isCustomUnlisted || item.product?.is_custom_unlisted) continue;
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

        // 2.2 Deduct sold quantities from branch inventory
        for (const item of cart) {
          const resolvedProdId = customProdIdMap[item.product.id] || item.product.id;
          const qty = parseFloat(item.quantity) || 1;
          if (resolvedProdId && qty > 0) {
            try {
              const { data: invItem } = await supabase
                .from('inventory')
                .select('id, quantity')
                .eq('branch_id', selectedBranchId)
                .eq('product_id', resolvedProdId)
                .maybeSingle();

              if (invItem) {
                await supabase
                  .from('inventory')
                  .update({
                    quantity: Math.max(0, (invItem.quantity || 0) - qty),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', invItem.id);
              }
            } catch (stockErr) {
              console.error('Error updating inventory stock on checkout:', stockErr);
            }
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
            reference_number: referenceNumber ? referenceNumber.trim() : null,
            notes: cleanUserNotes || null,
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

      const mappedCartForPrint = cart.map((item) => {
        const p = getItemPrice(item);
        const q = parseFloat(item.quantity) || 1;
        return {
          ...item,
          unit_price: p,
          unitPrice: p,
          total_price: p * q,
          products: item.product || item.products,
        };
      });

      setActiveInvoice(populatedSale);
      setInvoiceItems(mappedCartForPrint);
      setShowInvoicePrint(true);

      // Reset state
      setCustomerType('existing');
      resetPosForm();
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

  // Open Sale Details Modal
  const handleOpenSaleDetails = async (sale) => {
    setSelectedSaleForDetails(sale);
    setShowSaleDetailsModal(true);
    setLoadingSaleDetails(true);

    try {
      const { data: items, error } = await supabase
        .from('sale_items')
        .select(`
          *,
          products (
            id,
            sku,
            product_code,
            name,
            sale_price,
            category
          )
        `)
        .eq('sale_id', sale.id);

      if (error) throw error;

      let fullSale = sale;
      if (!sale.contacts && sale.customer_id) {
        const { data: cust } = await supabase
          .from('contacts')
          .select('name, phone, address')
          .eq('id', sale.customer_id)
          .maybeSingle();
        if (cust) {
          fullSale = { ...sale, contacts: cust };
          setSelectedSaleForDetails(fullSale);
        }
      }

      setSaleDetailItems(items || []);

      // Fetch returned and exchange replacement products logged for this invoice
      const invNumber = sale.invoice_number || '';
      const saleIdSub = sale.id ? sale.id.substring(0, 8) : '';

      let movementsQuery = supabase
        .from('inventory_movements')
        .select(`
          id,
          type,
          quantity,
          description,
          created_at,
          products (
            id,
            name,
            sku,
            product_code,
            sale_price,
            category
          )
        `);

      if (invNumber && saleIdSub) {
        movementsQuery = movementsQuery.or(`description.ilike.%${invNumber}%,description.ilike.%${saleIdSub}%`);
      } else if (invNumber) {
        movementsQuery = movementsQuery.ilike('description', `%${invNumber}%`);
      } else if (saleIdSub) {
        movementsQuery = movementsQuery.ilike('description', `%${saleIdSub}%`);
      }

      const { data: movements } = await movementsQuery.order('created_at', { ascending: false });

      const returnsList = [];
      const replacementsList = [];

      (movements || []).forEach((m) => {
        const desc = (m.description || '').toLowerCase();
        if (desc.includes('return') || desc.includes('restocked') || desc.includes('crn-')) {
          returnsList.push({
            id: m.id,
            product: m.products,
            quantity: m.quantity,
            date: m.created_at,
            description: m.description,
          });
        } else if (desc.includes('exchange out') || desc.includes('exchange replacement') || desc.includes('replacement out')) {
          replacementsList.push({
            id: m.id,
            product: m.products,
            quantity: m.quantity,
            date: m.created_at,
            description: m.description,
          });
        }
      });

      setSaleDetailReturns(returnsList);
      setSaleDetailReplacements(replacementsList);

      // Fetch payment records for this invoice
      try {
        const { data: payHistory } = await supabase
          .from('payments')
          .select('*')
          .eq('reference_invoice_id', sale.id)
          .order('payment_date', { ascending: true });
        setSaleDetailPayments(payHistory || []);
      } catch (payErr) {
        console.error('Error loading sale payments:', payErr);
        setSaleDetailPayments([]);
      }
    } catch (err) {
      console.error('Error loading sale details:', err);
      showMessage('Failed to load invoice items details.', 'error');
    } finally {
      setLoadingSaleDetails(false);
    }
  };

  // Open Edit Sale Modal
  const handleOpenEditSale = async (sale) => {
    setEditingSale(sale);
    setEditCustomerId(sale.customer_id || '');
    setEditSaleDate(sale.sale_date ? new Date(sale.sale_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEditDiscount(sale.discount || 0);
    const sub = parseFloat(sale.total_amount || 0);
    const disc = parseFloat(sale.discount || 0);
    const subAfterDisc = Math.max(0, sub - disc);
    const taxAmt = parseFloat(sale.tax || 0);
    const computedTaxRate = subAfterDisc > 0 ? (taxAmt / subAfterDisc) * 100 : 0;
    setEditTaxRate(Math.round(computedTaxRate * 100) / 100);
    setEditStoredReceiptNo(getSaleReceiptNo(sale));
    setEditNotes(getSaleCleanNotes(sale));
    setEditProductSearch('');
    setShowEditSearchDropdown(false);

    const saleBranch = branches.find(b => b.id === sale.branch_id);
    const isSaleFactory = Boolean(saleBranch?.is_factory || saleBranch?.name?.toLowerCase().includes('factory') || isFactory);
    const isChallan = isSaleFactory && Boolean(
      sale.is_showroom_challan ||
      isShowroomContact(sale.customer_id) ||
      sale.contacts?.name?.toLowerCase().includes('showroom') ||
      sale.contacts?.name === 'Gazipur Showroom'
    );
    setEditIsShowroomChallan(isChallan);

    setShowEditSaleModal(true);
    setLoadingEditItems(true);

    try {
      const { data: items, error } = await supabase
        .from('sale_items')
        .select(`
          *,
          products (
            id,
            sku,
            product_code,
            name,
            sale_price,
            category
          )
        `)
        .eq('sale_id', sale.id);

      if (error) throw error;

      const mapped = (items || []).map((it) => ({
        id: it.id,
        product_id: it.product_id,
        product: it.products || { id: it.product_id, name: 'Item', sku: '' },
        quantity: parseFloat(it.quantity) || 1,
        size: it.size || '',
        number_of_carton: it.number_of_carton === 0 ? '0' : (it.number_of_carton || ''),
        unit_price: parseFloat(it.unit_price) || 0,
        total_price: parseFloat(it.total_price) || 0,
        original_quantity: parseFloat(it.quantity) || 1,
      }));

      setEditCart(mapped);
      setOriginalSaleItems(mapped);
    } catch (err) {
      console.error('Error loading sale items for edit:', err);
      showMessage('Failed to load invoice items for editing.', 'error');
    } finally {
      setLoadingEditItems(false);
    }
  };

  // Calculations for Edit Modal
  const getEditTotalQuantity = () => {
    return editCart.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  };

  const getEditSubtotal = () => {
    return editCart.reduce((sum, item) => sum + (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0), 0);
  };

  const getEditTaxAmount = () => {
    const sub = getEditSubtotal();
    const disc = parseFloat(editDiscount) || 0;
    const rate = parseFloat(editTaxRate) || 0;
    return Math.max(0, (sub - disc) * (rate / 100));
  };

  const getEditGrandTotal = () => {
    const sub = getEditSubtotal();
    const disc = parseFloat(editDiscount) || 0;
    const subAfterDisc = Math.max(0, sub - disc);
    return Math.max(0, subAfterDisc + getEditTaxAmount());
  };

  const addToEditCart = (invProduct) => {
    const p = invProduct.products || invProduct;
    const existing = editCart.find((c) => c.product_id === p.id);
    if (existing) {
      setEditCart(
        editCart.map((c) =>
          c.product_id === p.id ? { ...c, quantity: (parseFloat(c.quantity) || 0) + 1 } : c
        )
      );
    } else {
      setEditCart([
        ...editCart,
        {
          product_id: p.id,
          product: p,
          quantity: 1,
          size: '',
          number_of_carton: '',
          unit_price: parseFloat(p.sale_price) || 0,
          total_price: parseFloat(p.sale_price) || 0,
          original_quantity: 0,
        },
      ]);
    }
    setEditProductSearch('');
    setShowEditSearchDropdown(false);
  };

  const removeFromEditCart = (productId) => {
    setEditCart(editCart.filter((c) => c.product_id !== productId));
  };

  // Validate and prompt confirmation before saving edited invoice
  const handlePromptSaveEditedSale = (e) => {
    e.preventDefault();
    if (!editingSale) return;

    if (!editCustomerId) {
      showMessage('Please select a customer for this invoice.', 'error');
      return;
    }

    if (editCart.length === 0) {
      showMessage('Invoice must contain at least one item.', 'error');
      return;
    }

    for (const item of editCart) {
      const q = parseFloat(item.quantity);
      const p = parseFloat(item.unit_price);
      if (isNaN(q) || q <= 0) {
        showMessage(`Invalid quantity for ${item.product?.name || 'item'}.`, 'error');
        return;
      }
      if (isNaN(p) || p < 0) {
        showMessage(`Invalid unit price for ${item.product?.name || 'item'}.`, 'error');
        return;
      }
    }

    setShowEditConfirmModal(true);
  };

  // Perform actual save after user confirms
  const handleConfirmSaveEditedSale = async () => {
    if (!editingSale) return;

    setIsSubmittingEdit(true);
    try {
      const targetBranchId = editingSale.branch_id || selectedBranchId;
      const subtotal = getEditSubtotal();
      const disc = parseFloat(editDiscount) || 0;
      const taxAmt = getEditTaxAmount();
      const grandTotal = getEditGrandTotal();
      const currentPaid = parseFloat(editingSale.paid_amount || 0);

      // 1. Physical Inventory Adjustments (if not factory)
      if (!isFactory) {
        const originalMap = {};
        originalSaleItems.forEach((it) => {
          originalMap[it.product_id] = (originalMap[it.product_id] || 0) + it.original_quantity;
        });

        const newMap = {};
        editCart.forEach((it) => {
          newMap[it.product_id] = (newMap[it.product_id] || 0) + parseFloat(it.quantity);
        });

        const allProductIds = Array.from(new Set([...Object.keys(originalMap), ...Object.keys(newMap)]));

        for (const prodId of allProductIds) {
          const oldQ = originalMap[prodId] || 0;
          const newQ = newMap[prodId] || 0;
          const diff = newQ - oldQ; // > 0 means sold more (deduct stock), < 0 means sold less (restock)

          if (diff !== 0) {
            const { data: invItem } = await supabase
              .from('inventory')
              .select('id, quantity')
              .eq('branch_id', targetBranchId)
              .eq('product_id', prodId)
              .maybeSingle();

            if (invItem) {
              const updatedStock = Math.max(0, (invItem.quantity || 0) - diff);
              await supabase
                .from('inventory')
                .update({
                  quantity: updatedStock,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', invItem.id);
            }

            // Log movement audit
            await supabase.from('inventory_movements').insert([
              {
                branch_id: targetBranchId,
                product_id: prodId,
                type: diff > 0 ? 'sale' : 'adjustment_in',
                quantity: Math.abs(diff),
                description: `Invoice Edited [${editingSale.invoice_number || editingSale.id.substring(0, 8)}]: Qty changed from ${oldQ} to ${newQ}`,
                created_by: userProfile.id,
              },
            ]);
          }
        }
      }

      // 2. Delete and re-insert sale_items (including size and number_of_carton)
      await supabase.from('sale_items').delete().eq('sale_id', editingSale.id);

      const newSaleItems = editCart.map((it) => {
        const qty = parseFloat(it.quantity) || 1;
        const price = parseFloat(it.unit_price) || 0;
        const row = {
          sale_id: editingSale.id,
          product_id: it.product_id,
          quantity: qty,
          unit_price: price,
          total_price: qty * price,
        };
        if (it.size) row.size = it.size;
        if (it.number_of_carton) {
          const ctn = parseInt(it.number_of_carton, 10);
          if (!isNaN(ctn)) row.number_of_carton = ctn;
        }
        return row;
      });

      const { error: itemsErr } = await supabase.from('sale_items').insert(newSaleItems);
      if (itemsErr) {
        if (itemsErr.message?.includes('size') || itemsErr.message?.includes('number_of_carton')) {
          const fallbackData = editCart.map((it) => {
            const qty = parseFloat(it.quantity) || 1;
            const price = parseFloat(it.unit_price) || 0;
            return {
              sale_id: editingSale.id,
              product_id: it.product_id,
              quantity: qty,
              unit_price: price,
              total_price: qty * price,
            };
          });
          const { error: fbErr } = await supabase.from('sale_items').insert(fallbackData);
          if (fbErr) throw fbErr;
        } else {
          throw itemsErr;
        }
      }

      // 3. Recalculate Payment Status
      const newStatus = currentPaid >= grandTotal - 0.01 ? 'paid' : (currentPaid > 0 ? 'partial' : 'unpaid');

      // 4. Update Sales Table
      const cleanUserNotes = editNotes.trim();
      const cleanReceipt = editStoredReceiptNo.trim();

      const editBranch = branches.find(b => b.id === targetBranchId);
      const isEditBranchFactory = Boolean(editBranch?.is_factory || editBranch?.name?.toLowerCase().includes('factory') || isFactory);
      const editIsChallan = isEditBranchFactory && Boolean(editIsShowroomChallan || isShowroomContact(editCustomerId));

      const editSalePayload = {
        customer_id: editCustomerId,
        sale_date: editSaleDate,
        total_amount: subtotal,
        discount: disc,
        tax: taxAmt,
        net_amount: grandTotal,
        payment_status: newStatus,
        receipt_number: cleanReceipt || null,
        notes: cleanUserNotes || null,
        is_showroom_challan: editIsChallan,
      };

      let { error: saleErr } = await supabase
        .from('sales')
        .update(editSalePayload)
        .eq('id', editingSale.id);

      if (saleErr && (saleErr.message?.includes('is_showroom_challan') || saleErr.message?.includes('tax'))) {
        if (saleErr.message?.includes('is_showroom_challan')) delete editSalePayload.is_showroom_challan;
        if (saleErr.message?.includes('tax')) delete editSalePayload.tax;
        const retry = await supabase.from('sales').update(editSalePayload).eq('id', editingSale.id);
        saleErr = retry.error;
      }

      if (saleErr) throw saleErr;

      showMessage(`Invoice ${editingSale.invoice_number || editingSale.id.substring(0, 8)} updated successfully!`, 'success');
      setShowEditConfirmModal(false);
      setShowEditSaleModal(false);
      fetchSalesHistory();
      fetchBranchInventory();
    } catch (err) {
      console.error('Error saving edited sale:', err);
      showMessage(err.message || 'Failed to update invoice.', 'error');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Delete Sale Handler (Allowed only if no payment history and no return history)
  const handleDeleteSale = async (sale) => {
    if (!sale) return;

    const invNum = sale.invoice_number || `INV#${sale.id.substring(0, 8).toUpperCase()}`;

    // 1. Check if sale has any recorded paid amount
    const paid = parseFloat(sale.paid_amount || 0);
    if (paid > 0) {
      showMessage(`Cannot delete invoice ${invNum}. It has recorded payments of ৳${formatAmount(paid)}. Only unpaid sales without payment history can be deleted.`, 'error');
      return;
    }

    try {
      // Check payments table for any linked records
      const { data: payments, error: payErr } = await supabase
        .from('payments')
        .select('id, amount')
        .eq('reference_invoice_id', sale.id);

      if (payErr) throw payErr;

      if (payments && payments.length > 0) {
        showMessage(`Cannot delete invoice ${invNum}. It has ${payments.length} payment record(s) linked to it.`, 'error');
        return;
      }

      // 2. Check if sale has any returns / exchanges recorded
      const saleIdSub = sale.id ? sale.id.substring(0, 8) : '';
      let movementsQuery = supabase
        .from('inventory_movements')
        .select('id, description');

      if (sale.invoice_number && saleIdSub) {
        movementsQuery = movementsQuery.or(`description.ilike.%${sale.invoice_number}%,description.ilike.%${saleIdSub}%`);
      } else if (sale.invoice_number) {
        movementsQuery = movementsQuery.ilike('description', `%${sale.invoice_number}%`);
      } else if (saleIdSub) {
        movementsQuery = movementsQuery.ilike('description', `%${saleIdSub}%`);
      }

      const { data: movements, error: movErr } = await movementsQuery;
      if (movErr) throw movErr;

      const hasReturnRecords = (movements || []).some((m) => {
        const desc = (m.description || '').toLowerCase();
        return desc.includes('return') || desc.includes('restocked') || desc.includes('crn-') || desc.includes('exchange');
      });

      if (hasReturnRecords) {
        showMessage(`Cannot delete invoice ${invNum}. It has associated return or exchange records.`, 'error');
        return;
      }

      // 3. User Confirmation
      const confirmed = window.confirm(
        `Are you sure you want to permanently delete Invoice ${invNum}?\n\nAll items in this invoice will be restored to inventory stock.`
      );
      if (!confirmed) return;

      setLoading(true);

      // 4. Fetch sale items to restore inventory
      const { data: itemsToRestore, error: itemsFetchErr } = await supabase
        .from('sale_items')
        .select('id, product_id, quantity')
        .eq('sale_id', sale.id);

      if (itemsFetchErr) throw itemsFetchErr;

      const targetBranchId = sale.branch_id || selectedBranchId;
      const branchObj = branches.find((b) => b.id === targetBranchId);
      const isTargetFactory = branchObj ? Boolean(branchObj.is_factory) : false;

      // 5. Restore stock for physical branch
      if (!isTargetFactory && itemsToRestore && itemsToRestore.length > 0) {
        for (const it of itemsToRestore) {
          const restoreQty = parseFloat(it.quantity) || 0;
          if (restoreQty <= 0) continue;

          // 5.1 Update branch inventory
          const { data: invItem } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('branch_id', targetBranchId)
            .eq('product_id', it.product_id)
            .maybeSingle();

          if (invItem) {
            await supabase
              .from('inventory')
              .update({
                quantity: (invItem.quantity || 0) + restoreQty,
                updated_at: new Date().toISOString(),
              })
              .eq('id', invItem.id);
          }

          // 5.2 Log movement audit
          await supabase.from('inventory_movements').insert([
            {
              branch_id: targetBranchId,
              product_id: it.product_id,
              type: 'adjustment_in',
              quantity: restoreQty,
              description: `Invoice Deleted [${invNum}]: Restored ${restoreQty} units back to stock`,
              created_by: userProfile.id,
            },
          ]);

          // 5.3 Restore Challan FIFO remaining_qty if applicable
          try {
            const { data: chItems } = await supabase
              .from('branch_challan_items')
              .select('id, sold_qty, remaining_qty, challan_id, branch_challans!inner(to_branch_id)')
              .eq('product_id', it.product_id)
              .eq('branch_challans.to_branch_id', targetBranchId)
              .gt('sold_qty', 0)
              .order('created_at', { ascending: false });

            if (chItems && chItems.length > 0) {
              let qtyRemainingToRestore = restoreQty;
              for (const chItem of chItems) {
                if (qtyRemainingToRestore <= 0) break;
                const canRestore = Math.min(qtyRemainingToRestore, chItem.sold_qty);
                await supabase
                  .from('branch_challan_items')
                  .update({
                    sold_qty: Math.max(0, (chItem.sold_qty || 0) - canRestore),
                    remaining_qty: (chItem.remaining_qty || 0) + canRestore,
                  })
                  .eq('id', chItem.id);
                qtyRemainingToRestore -= canRestore;
              }
            }
          } catch (chErr) {
            console.error('Error rolling back challan remaining qty on sale delete:', chErr);
          }
        }
      }

      // 6. Delete the sale record (CASCADE deletes sale_items)
      const { error: delErr } = await supabase
        .from('sales')
        .delete()
        .eq('id', sale.id);

      if (delErr) throw delErr;

      showMessage(`Invoice ${invNum} was deleted successfully and stock has been restored.`, 'success');

      if (showSaleDetailsModal) {
        setShowSaleDetailsModal(false);
      }

      // 7. Refresh data
      fetchSales();
      fetchInventory();
    } catch (err) {
      console.error('Error deleting sale:', err);
      showMessage(err.message || 'Failed to delete invoice.', 'error');
    } finally {
      setLoading(false);
    }
  };


  // Open Payment Collection Modal
  const handleOpenPaymentModal = (sale) => {
    const due = Math.max(0, (parseFloat(sale.net_amount) || 0) - (parseFloat(sale.paid_amount) || 0));
    setSelectedSaleForPayment(sale);
    setCollectPaymentAmount(due > 0 ? formatPlainNumber(due) : '');
    setCollectPaymentDate(new Date().toISOString().split('T')[0]);
    setCollectPaymentMethod('cash');
    setCollectPaymentRef('');
    setCollectPaymentNotes('');
    setShowPaymentModal(true);
  };

  // Submit Payment Collection
  const handleCollectPayment = async (e) => {
    if (e) e.preventDefault();
    if (!selectedSaleForPayment || !collectPaymentAmount) return;

    const amountNum = parseFloat(collectPaymentAmount);
    const currentNet = parseFloat(selectedSaleForPayment.net_amount || 0);
    const currentPaid = parseFloat(selectedSaleForPayment.paid_amount || 0);
    const currentDue = Math.max(0, currentNet - currentPaid);

    if (isNaN(amountNum) || amountNum <= 0) {
      showMessage('Please enter a valid payment amount greater than zero.', 'error');
      return;
    }

    if (amountNum > currentDue + 0.01) {
      showMessage(`Payment amount (৳${formatAmount(amountNum)}) cannot exceed the remaining due of ৳${formatAmount(currentDue)}.`, 'error');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const sale = selectedSaleForPayment;
      const targetBranchId = sale.branch_id || selectedBranchId;
      const paymentIsoDate = new Date(collectPaymentDate).toISOString();

      // 1. Insert payment record
      const { error: payErr } = await supabase.from('payments').insert([{
        branch_id: targetBranchId,
        contact_id: sale.customer_id,
        payment_date: paymentIsoDate,
        amount: amountNum,
        payment_method: collectPaymentMethod,
        transaction_type: 'customer_collection',
        reference_invoice_id: sale.id,
        reference_number: collectPaymentRef ? collectPaymentRef.trim() : null,
        notes: collectPaymentNotes ? collectPaymentNotes.trim() : null,
        created_by: userProfile?.id,
      }]);

      if (payErr) throw payErr;

      // 2. Insert record into cash_ledger
      const { error: ledgerErr } = await supabase.from('cash_ledger').insert([{
        branch_id: targetBranchId,
        amount_in: amountNum,
        amount_out: 0,
        reference_id: sale.id,
        description: `Customer Due Collection: Invoice #${sale.invoice_number || sale.id.substring(0, 8).toUpperCase()} (${collectPaymentMethod})`,
        transaction_date: paymentIsoDate,
        created_by: userProfile?.id,
      }]);

      if (ledgerErr) throw ledgerErr;

      // 3. Update sale record with updated paid_amount & payment_status
      const newPaid = currentPaid + amountNum;
      const newDue = Math.max(0, currentNet - newPaid);
      const newStatus = newDue <= 0.01 ? 'paid' : 'partial';

      const noteEntry = `[Collected ৳${formatAmount(amountNum)} on ${new Date(collectPaymentDate).toLocaleDateString()} via ${collectPaymentMethod}${collectPaymentRef ? ` (Ref: ${collectPaymentRef})` : ''}]`;
      const updatedNotes = sale.notes ? `${sale.notes}\n${noteEntry}` : noteEntry;

      const { error: saleErr } = await supabase.from('sales').update({
        paid_amount: newPaid,
        payment_status: newStatus,
        notes: updatedNotes,
      }).eq('id', sale.id);

      if (saleErr) throw saleErr;

      showMessage(`Payment of ৳${formatAmount(amountNum)} collected successfully!`, 'success');
      setShowPaymentModal(false);
      setSelectedSaleForPayment(null);
      fetchSalesHistory();
    } catch (err) {
      console.error('Error collecting payment:', err);
      showMessage(err.message || 'Failed to collect payment.', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
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
      const effectivePrice = (invItem.sale_price !== null && invItem.sale_price !== undefined)
        ? parseFloat(invItem.sale_price) || 0
        : (product.sale_price !== undefined ? parseFloat(product.sale_price) || 0 : 0);

      setExchangeCart([
        ...exchangeCart,
        {
          product_id: product.id,
          product: product,
          quantity: 1,
          unit_price: effectivePrice,
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
      const originalGross = parseFloat(sale.total_amount) || parseFloat(sale.net_amount) || 0;
      const originalDiscount = parseFloat(sale.discount) || Math.max(0, originalGross - (parseFloat(sale.net_amount) || 0));
      const discountRatio = originalGross > 0 ? (originalDiscount / originalGross) : 0;
      const originalNet = parseFloat(sale.net_amount || 0);
      const originalPaid = parseFloat(sale.paid_amount || 0);
      const currentDue = Math.max(0, originalNet - originalPaid);
      const isExchange = returnType === 'exchange';

      // Calculate return goods gross & net credit with proportional invoice discount deduction
      const grossReturnTotal = itemsToReturn.reduce((sum, it) => {
        const unitP = parseFloat(it.unit_price) || 0;
        const q = parseInt(it.returnQty);
        return sum + (unitP * q);
      }, 0);
      const returnDiscountDeduction = grossReturnTotal * discountRatio;
      const totalReturnCredit = Math.max(0, grossReturnTotal - returnDiscountDeduction);

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
      const newGross = Math.max(0, originalGross - grossReturnTotal);
      const newDiscount = Math.max(0, originalDiscount - returnDiscountDeduction);
      let newNet = originalNet;
      let newPaid = originalPaid;
      let newStatus = sale.payment_status;

      const dueCleared = Math.min(currentDue, totalReturnCredit);
      const remainingDue = Math.max(0, currentDue - dueCleared);
      const payableCashRefund = Math.min(originalPaid, Math.max(0, totalReturnCredit - dueCleared));

      if (!isExchange) {
        // Pure Refund
        newNet = Math.max(0, originalNet - totalReturnCredit);
        if (refundMethod === 'deduct_due') {
          newPaid = originalPaid;
          const newDue = Math.max(0, newNet - newPaid);
          newStatus = newDue <= 0.01 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
        } else {
          // Cash payout to customer (only the net excess after clearing unpaid due)
          if (payableCashRefund > 0) {
            await supabase.from('cash_ledger').insert([{
              branch_id: targetBranchId,
              amount_in: 0,
              amount_out: payableCashRefund,
              reference_id: sale.id,
              description: `Sales Return Refund [${creditNoteNumber}]: Inv #${sale.invoice_number || sale.id.substring(0, 8)} to ${sale.contacts?.name || 'Customer'} (${refundMethod})`,
              transaction_date: new Date().toISOString(),
              created_by: userProfile.id,
            }]);
          }

          newPaid = Math.max(0, originalPaid - payableCashRefund);
          const newDue = Math.max(0, newNet - newPaid);
          newStatus = newDue <= 0.01 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
        }
      } else {
        // Product Exchange Settlement
        newNet = Math.max(0, originalNet - totalReturnCredit + totalExchangeValue);
        if (exchangeDifference > 0) {
          // Customer pays extra difference
          await supabase.from('payments').insert([{
            branch_id: targetBranchId,
            contact_id: sale.customer_id,
            amount: exchangeDifference,
            payment_method: exchangePaymentMethod,
            transaction_type: 'customer_collection',
            reference_invoice_id: sale.id,
            reference_number: creditNoteNumber,
            notes: 'Exchange Extra Difference',
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

          newPaid = originalPaid + exchangeDifference;
        } else if (exchangeDifference < 0) {
          // Store refunds difference to customer (first clearing any due)
          const refundDiff = Math.abs(exchangeDifference);
          const exDueCleared = Math.min(currentDue, refundDiff);
          const exPayableCash = Math.min(originalPaid, Math.max(0, refundDiff - exDueCleared));

          if (refundMethod !== 'deduct_due' && exPayableCash > 0) {
            await supabase.from('cash_ledger').insert([{
              branch_id: targetBranchId,
              amount_in: 0,
              amount_out: exPayableCash,
              reference_id: sale.id,
              description: `Exchange Refund Difference [${creditNoteNumber}]: Inv #${sale.invoice_number || sale.id.substring(0, 8)} (${refundMethod})`,
              transaction_date: new Date().toISOString(),
              created_by: userProfile.id,
            }]);
            newPaid = Math.max(0, originalPaid - exPayableCash);
          }
        }
        const newDue = Math.max(0, newNet - newPaid);
        newStatus = newDue <= 0.01 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
      }

      // 4. Update Sale record with notes
      const returnNote = isExchange
        ? `[Exchange ${creditNoteNumber}: Returned gross ৳${formatAmount(grossReturnTotal)}, less discount ৳${formatAmount(returnDiscountDeduction)} = credit ৳${formatAmount(totalReturnCredit)}, Replacement ৳${formatAmount(totalExchangeValue)}, Net diff: ৳${formatAmount(exchangeDifference)}]`
        : `[Return ${creditNoteNumber}: Gross ৳${formatAmount(grossReturnTotal)}, less discount ৳${formatAmount(returnDiscountDeduction)} = refund ৳${formatAmount(totalReturnCredit)} (${refundMethod}) - ${returnReasonCategory} ${returnReasonNotes ? `(${returnReasonNotes})` : ''}]`;
      const combinedNotes = sale.notes ? `${sale.notes}\n${returnNote}` : returnNote;

      const { error: saleUpdateErr } = await supabase
        .from('sales')
        .update({
          total_amount: newGross,
          discount: newDiscount,
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
          : `Sales return of ৳${formatAmount(totalReturnCredit)} processed & restocked!`,
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
    item.products?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.products?.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.products?.product_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter products for quick search & add in cart (mobile and desktop)
  const filteredCartSearchProducts = products.filter((item) => {
    if (!cartSearchQuery.trim()) return true; // Initially show available products on click/focus
    const q = cartSearchQuery.toLowerCase();
    const p = item.products;
    return (
      p?.name?.toLowerCase().includes(q) ||
      p?.sku?.toLowerCase().includes(q) ||
      p?.product_code?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="no-print top-bar">
        <div className="page-title-group">
          <h1>Customer Sales Invoices</h1>
        </div>
        <div className="top-bar-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {userProfile?.role === 'owner' ? (
            <div className="form-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>Active Branch:</label>
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
          ) : (
            <span
              className="badge"
              style={{
                backgroundColor: isFactory ? '#fef3c7' : '#e0f2fe',
                color: isFactory ? '#92400e' : '#0369a1',
                border: `1px solid ${isFactory ? '#fde68a' : '#bae6fd'}`,
                fontSize: '0.82rem',
                fontWeight: 600,
                padding: '0.4rem 0.75rem',
              }}
            >
              {isFactory ? '🏭' : '🏪'} {activeBranch?.name || 'My Branch'}
            </span>
          )}
          {!showInvoicePrint && (
            <button className="btn btn-primary" onClick={() => {
              resetPosForm();
              setShowPosModal(true);
            }}>
              <Plus size={16} />
              <span>Create Invoice (POS)</span>
            </button>
          )}
        </div>
      </div>

      {/* SALES HISTORY LIST VIEW */}
      <div className="no-print card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '1rem 1.25rem' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Invoices History</h3>
          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-control"
              style={{ paddingLeft: '2.25rem', padding: '0.35rem 0.6rem 0.35rem 2.25rem', fontSize: '0.82rem' }}
              placeholder="Search by invoice #, receipt #, buyer, phone..."
              value={historySearchQuery}
              onChange={(e) => {
                setHistorySearchQuery(e.target.value);
                setSalesPage(1);
              }}
            />
          </div>
        </div>
        {/* Desktop Table View */}
        <div className="table-container hide-on-mobile" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>SL</th>
                <th>Invoice ID</th>
                <th>Receipt No</th>
                {userProfile?.role === 'owner' && <th>Branch</th>}
                <th>Sale Date</th>
                <th>Buyer Name</th>
                <th style={{ width: '85px', textAlign: 'center' }}>Total Qty</th>
                <th>Net Value</th>
                <th>Paid Amount</th>
                <th>Dues</th>
                <th>Payment Status</th>
                <th style={{ minWidth: '240px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoading colSpan={userProfile?.role === 'owner' ? 12 : 11} message="Fetching sales records..." />
              ) : salesHistory.length === 0 ? (
                <tr>
                  <td colSpan={userProfile?.role === 'owner' ? 12 : 11} style={{ textAlign: 'center', padding: '2rem' }}>
                    {historySearchQuery.trim() ? `No sales invoices found matching "${historySearchQuery}".` : 'No sales invoices recorded yet. Click "Create Invoice (POS)" to sell items.'}
                  </td>
                </tr>
              ) : (
                salesHistory.map((sale, index) => {
                  const due = sale.net_amount - sale.paid_amount;
                  const rowNumber = (salesPage - 1) * salesPageSize + index + 1;
                  const receiptNo = getSaleReceiptNo(sale);
                  const totalQty = (sale.sale_items || []).reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
                  return (
                    <tr key={sale.id}>
                      <td>{rowNumber}</td>
                      <td
                        style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', color: '#0284c7', cursor: 'pointer' }}
                        onClick={() => handleOpenSaleDetails(sale)}
                        title="Click to view full invoice breakdown"
                      >
                        {sale.invoice_number || `INV#${sale.id.substring(0, 8).toUpperCase()}`}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                        {receiptNo ? (
                          <span
                            style={{
                              backgroundColor: '#f0f9ff',
                              color: '#0369a1',
                              border: '1px solid #bae6fd',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              display: 'inline-block'
                            }}
                          >
                            {receiptNo}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      {userProfile?.role === 'owner' && (
                        <td style={{ fontWeight: 600 }}>{branches.find(b => b.id === sale.branch_id)?.name || 'Unknown'}</td>
                      )}
                      <td>{new Date(sale.sale_date).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sale.contacts?.name || 'Walk-in Customer'}</span>
                          {isSaleShowroomChallan(sale) && (
                            <span
                              style={{
                                backgroundColor: '#f0fdf4',
                                color: '#15803d',
                                border: '1px solid #bbf7d0',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                              }}
                            >
                              🏪 Showroom Challan
                            </span>
                          )}
                        </div>
                        {sale.contacts?.phone && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{sale.contacts.phone}</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>
                        {totalQty > 0 ? totalQty : '—'}
                      </td>
                      <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>৳{formatAmount(sale.net_amount)}</td>
                      <td style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--success-text)' }}>৳{formatAmount(sale.paid_amount)}</td>
                      <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: due > 0 ? 'var(--danger-text)' : 'inherit' }}>৳{formatAmount(due)}</td>
                      <td>
                        <span className={`badge badge-${sale.payment_status}`}>{sale.payment_status}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
                          {due > 0.01 && (
                            <button
                              className="btn btn-secondary btn-sm btn-icon"
                              onClick={() => handleOpenPaymentModal(sale)}
                              title={`Collect Payment (Due: ৳${formatAmount(due)})`}
                              style={{ color: '#16a34a', padding: '0.35rem 0.45rem' }}
                            >
                              <DollarSign size={15} />
                            </button>
                          )}
                          <button
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => handleOpenSaleDetails(sale)}
                            title="View Invoice Details"
                            style={{ color: '#0284c7', padding: '0.35rem 0.45rem' }}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => handleOpenEditSale(sale)}
                            title="Edit Invoice"
                            style={{ color: '#4f46e5', padding: '0.35rem 0.45rem' }}
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => handleRePrint(sale)}
                            title="Print Invoice / Challan"
                            style={{ color: '#334155', padding: '0.35rem 0.45rem' }}
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => handleOpenReturnModal(sale)}
                            title="Process Sales Return / Credit Note"
                            style={{ color: 'var(--warning-text, #d97706)', padding: '0.35rem 0.45rem' }}
                          >
                            <RotateCcw size={15} />
                          </button>
                          <button
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => handleDeleteSale(sale)}
                            title="Delete Invoice (Restores Inventory Stock)"
                            style={{ color: 'var(--danger, #ef4444)', padding: '0.35rem 0.45rem' }}
                          >
                            <Trash2 size={15} />
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

        {/* Mobile Card List View for Invoices */}
        <div className="hide-on-desktop" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              Fetching sales records...
            </div>
          ) : salesHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              {historySearchQuery.trim() ? `No sales invoices found matching "${historySearchQuery}".` : 'No sales invoices recorded yet. Tap "Create Invoice (POS)" to sell items.'}
            </div>
          ) : (
            salesHistory.map((sale, index) => {
              const due = sale.net_amount - sale.paid_amount;
              const rowNumber = (salesPage - 1) * salesPageSize + index + 1;
              const receiptNo = getSaleReceiptNo(sale);
              const branchName = branches.find((b) => b.id === sale.branch_id)?.name;

              return (
                <div
                  key={sale.id}
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
                  {/* Header: SL Badge, Invoice ID, Receipt No, Payment Status */}
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
                      <span
                        style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: '#0284c7', cursor: 'pointer' }}
                        onClick={() => handleOpenSaleDetails(sale)}
                      >
                        {sale.invoice_number || `INV#${sale.id.substring(0, 8).toUpperCase()}`}
                      </span>
                      {receiptNo && (
                        <span
                          style={{
                            backgroundColor: '#f0fdf4',
                            color: '#166534',
                            border: '1px solid #bbf7d0',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            fontFamily: 'monospace',
                          }}
                        >
                          {receiptNo}
                        </span>
                      )}
                    </div>
                    <span className={`badge badge-${sale.payment_status}`} style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                      {sale.payment_status}
                    </span>
                  </div>

                  {/* Buyer & Date & Branch */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                          {sale.contacts?.name || 'Walk-in Customer'}
                        </span>
                        {isSaleShowroomChallan(sale) && (
                          <span
                            style={{
                              backgroundColor: '#f0fdf4',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                            }}
                          >
                            🏪 Showroom Challan
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(sale.sale_date).toLocaleDateString()}
                      </span>
                    </div>
                    {sale.contacts?.phone && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        📞 {sale.contacts.phone}
                      </div>
                    )}
                    {userProfile?.role === 'owner' && branchName && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        🏪 {branchName}
                      </div>
                    )}
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
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Total Qty</span>
                      <span style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.88rem' }}>
                        {((sale.sale_items || []).reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0)) || '—'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Net Value</span>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                        ৳{formatAmount(sale.net_amount)}
                      </span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Paid</span>
                      <span style={{ fontWeight: 700, color: 'var(--success-text)', fontSize: '0.92rem' }}>
                        ৳{formatAmount(sale.paid_amount)}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Due</span>
                      <span style={{ fontWeight: 800, color: due > 0 ? 'var(--danger-text)' : 'inherit', fontSize: '0.92rem' }}>
                        ৳{formatAmount(due)}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end', paddingTop: '0.15rem' }}>
                    {due > 0.01 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenPaymentModal(sale)}
                        style={{
                          flex: 1,
                          minWidth: '70px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                          height: '32px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: '#16a34a',
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        <DollarSign size={13} />
                        <span>Collect</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenSaleDetails(sale)}
                      style={{
                        flex: 1,
                        minWidth: '65px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.25rem',
                        height: '32px',
                        fontSize: '0.78rem',
                        color: '#0284c7',
                        backgroundColor: '#f0f9ff',
                        border: '1px solid #bae6fd',
                      }}
                    >
                      <Eye size={13} />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenEditSale(sale)}
                      style={{
                        flex: 1,
                        minWidth: '60px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.25rem',
                        height: '32px',
                        fontSize: '0.78rem',
                        color: '#4f46e5',
                        backgroundColor: '#eef2ff',
                        border: '1px solid #c7d2fe',
                      }}
                    >
                      <Edit size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm btn-icon"
                      onClick={() => handleRePrint(sale)}
                      style={{
                        height: '32px',
                        minWidth: '32px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#334155',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                      }}
                      title="Print"
                    >
                      <Printer size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm btn-icon"
                      onClick={() => handleOpenReturnModal(sale)}
                      style={{
                        height: '32px',
                        minWidth: '32px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#d97706',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                      }}
                      title="Return / Credit Note"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm btn-icon"
                      onClick={() => handleDeleteSale(sale)}
                      style={{
                        height: '32px',
                        minWidth: '32px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--danger)',
                        backgroundColor: '#fee2e2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                      }}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
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
          <div className="modal-content modal-xl">
            <div className="modal-header">
              <h3 className="modal-title">New Invoice (POS)</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                resetPosForm();
                setShowPosModal(false);
              }} style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}>✕</button>
            </div>
            <div className="modal-body pos-layout">
              {/* Product Picker (Desktop Only) */}
              <div className="pos-catalog pos-catalog-desktop-only">
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div className="catalog-search-bar">
                    <div style={{ position: 'relative', width: '100%' }}>
                      <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="input-control"
                        style={{ paddingLeft: '2.75rem' }}
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="product-grid">
                  {loadingInventory ? (
                    <div className="card" style={{ gridColumn: '1 / -1' }}>
                      <LoadingBlock message="Loading stock catalog..." />
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
                      No available items found.
                    </div>
                  ) : (
                    filteredProducts.map((invItem) => {
                      const isOutOfStock = !isFactory && invItem.quantity <= 0;
                      return (
                        <div
                          key={invItem.product_id}
                          className="pos-product-card card"
                          onClick={() => {
                            if (isOutOfStock) {
                              showMessage("This item is currently out of stock.", "error");
                              return;
                            }
                            addToCart(invItem);
                          }}
                          style={{ cursor: isOutOfStock ? 'not-allowed' : 'pointer', opacity: isOutOfStock ? 0.6 : 1 }}
                        >
                          <div className="pos-product-sku">{invItem.products?.sku}</div>
                          <div className="pos-product-name">{invItem.products?.name}</div>
                          <span className="pos-product-price">৳{formatAmount(invItem.products?.sale_price)}</span>
                          {!isFactory && (
                            <span className="pos-product-stock">Stock: {invItem.quantity} {invItem.products?.unit || 'pcs'}</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Cart & Customer Picker (Responsive & Mobile-First) */}
              <div className="pos-cart">
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                  {/* Customer Info Header with Factory Showroom Challan Toggle */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.1rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Customer & Invoice Info
                    </span>
                    {isFactory && (
                      <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        userSelect: 'none',
                        backgroundColor: isShowroomChallan ? '#f0fdf4' : '#ffffff',
                        border: isShowroomChallan ? '1.5px solid #16a34a' : '1px solid var(--border-color)',
                        color: isShowroomChallan ? '#15803d' : 'var(--text-primary)',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        transition: 'all 0.15s ease',
                      }}>
                        <input
                          type="checkbox"
                          checked={isShowroomChallan}
                          onChange={(e) => handleToggleShowroomChallan(e.target.checked)}
                          style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#16a34a' }}
                        />
                        <span>🏪 Is Showroom Challan</span>
                      </label>
                    )}
                  </div>

                  {/* Customer Type & Stored Receipt No Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Customer Type</label>
                      <select
                        className="input-control"
                        value={customerType}
                        onChange={(e) => setCustomerType(e.target.value)}
                        disabled={isFactory && isShowroomChallan}
                        style={{
                          backgroundColor: (isFactory && isShowroomChallan) ? '#f1f5f9' : '#ffffff',
                          cursor: (isFactory && isShowroomChallan) ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <option value="existing">Existing Buyer</option>
                        <option value="new">New Buyer</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Stored Receipt No</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="e.g. REC-102 (optional)"
                        value={storedReceiptNo}
                        onChange={(e) => setStoredReceiptNo(e.target.value)}
                      />
                    </div>
                  </div>

                  {customerType === 'existing' ? (
                    <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <label style={{ margin: 0 }}>Customer *</label>
                        {isFactory && isShowroomChallan && (
                          <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 700 }}>
                            🔒 Locked to Showroom Branches
                          </span>
                        )}
                      </div>
                      <select
                        className="input-control"
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        required={customerType === 'existing'}
                        style={{
                          backgroundColor: (isFactory && isShowroomChallan) ? '#f0fdf4' : '#ffffff',
                          borderColor: (isFactory && isShowroomChallan) ? '#86efac' : '#cbd5e1',
                        }}
                      >
                        <option value="">-- Select Customer --</option>
                        {((isFactory && isShowroomChallan) ? getShowroomCustomers() : customers).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0.5rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.25rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.74rem', color: 'var(--primary)' }}>New Customer Details</div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Name *</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="Enter customer name"
                          value={newCustName}
                          onChange={(e) => setNewCustName(e.target.value)}
                          required={customerType === 'new'}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Phone *</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="Enter phone number"
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                          required={customerType === 'new'}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Address</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="Enter address (optional)..."
                          value={newCustAddress}
                          onChange={(e) => setNewCustAddress(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* QUICK SEARCH & ADD PRODUCT (Mobile & Quick-Desktop) */}
                  <div ref={cartSearchRef} style={{ position: 'relative', marginBottom: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem' }}>Search & Add Product</label>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{
                          padding: '0.2rem 0.55rem',
                          fontSize: '0.74rem',
                          backgroundColor: showCustomProdForm ? '#fee2e2' : '#f0fdf4',
                          color: showCustomProdForm ? '#b91c1c' : '#15803d',
                          border: `1px solid ${showCustomProdForm ? '#fca5a5' : '#86efac'}`,
                          borderRadius: 'var(--border-radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          setShowCustomProdForm(!showCustomProdForm);
                          if (!showCustomProdForm && cartSearchQuery.trim()) {
                            setCustomProdCode(cartSearchQuery.trim());
                          }
                        }}
                      >
                        <Plus size={13} />
                        {showCustomProdForm ? 'Cancel Unlisted Item' : '+ Add Item (Not in Book)'}
                      </button>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="input-control"
                        placeholder="Search product code, name or SKU..."
                        value={cartSearchQuery}
                        onChange={(e) => {
                          setCartSearchQuery(e.target.value);
                          setShowCartSearchSuggestions(true);
                        }}
                        onFocus={() => setShowCartSearchSuggestions(true)}
                        onClick={() => setShowCartSearchSuggestions(true)}
                        style={{ paddingLeft: '2.25rem', paddingRight: cartSearchQuery ? '2rem' : '0.65rem', fontSize: '0.85rem' }}
                      />
                      {cartSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setCartSearchQuery('');
                            setShowCartSearchSuggestions(false);
                          }}
                          style={{
                            position: 'absolute',
                            right: '0.5rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '0.2rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Autocomplete Suggestions Popup */}
                    {showCartSearchSuggestions && (
                      <div
                        className="pos-search-dropdown"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          backgroundColor: '#ffffff',
                          border: '1.5px solid #0284c7',
                          borderRadius: 'var(--border-radius-sm)',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                          maxHeight: '280px',
                          overflowY: 'auto',
                          zIndex: 1000,
                          marginTop: '0.25rem'
                        }}
                      >
                        {!cartSearchQuery.trim() && (
                          <div style={{ padding: '0.4rem 0.85rem', backgroundColor: '#f8fafc', fontSize: '0.72rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Available Products ({products.length})</span>
                            <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Tap to add</span>
                          </div>
                        )}
                        {filteredCartSearchProducts.length === 0 ? (
                          <div style={{ padding: '0.85rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            No products in book matching "{cartSearchQuery}"
                          </div>
                        ) : (
                          filteredCartSearchProducts.map((invItem) => {
                            const isOutOfStock = !isFactory && invItem.quantity <= 0;
                            return (
                              <div
                                key={invItem.product_id}
                                onClick={() => {
                                  if (isOutOfStock) {
                                    showMessage('This item is currently out of stock.', 'error');
                                    return;
                                  }
                                  addToCart(invItem);
                                  setCartSearchQuery('');
                                  setShowCartSearchSuggestions(false);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.65rem 0.85rem',
                                  borderBottom: '1px solid var(--border-color)',
                                  cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                                  opacity: isOutOfStock ? 0.6 : 1,
                                  backgroundColor: '#ffffff',
                                  transition: 'background-color 0.15s ease'
                                }}
                                onMouseEnter={(e) => { if (!isOutOfStock) e.currentTarget.style.backgroundColor = '#f0f9ff'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', maxWidth: '65%' }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {invItem.products?.name}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>
                                      {invItem.products?.sku || invItem.products?.product_code || 'NO-SKU'}
                                    </span>
                                    {!isFactory && (
                                      <>
                                        <span>•</span>
                                        <span style={{ color: isOutOfStock ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                          Stock: {invItem.quantity} {invItem.products?.unit || 'pcs'}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                  <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: '#0284c7', fontSize: '0.95rem' }}>
                                    ৳{formatAmount(invItem.products?.sale_price)}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    disabled={isOutOfStock}
                                    style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                  >
                                    <Plus size={13} /> Add
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}

                        {/* Direct Option to Add as Unlisted Item (Not from book) */}
                        {cartSearchQuery.trim() && (
                          <div
                            onClick={() => {
                              setCustomProdCode(cartSearchQuery.trim());
                              setShowCustomProdForm(true);
                              setShowCartSearchSuggestions(false);
                            }}
                            style={{
                              padding: '0.75rem 0.85rem',
                              backgroundColor: '#f0fdf4',
                              borderTop: '1px solid #bbf7d0',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              color: '#15803d',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              transition: 'background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dcfce7'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f0fdf4'; }}
                          >
                            <Plus size={15} />
                            <span>Add <strong>"{cartSearchQuery.trim()}"</strong> as New / Unlisted Product (Not in Book)</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* UNLISTED PRODUCT QUICK FORM */}
                  {showCustomProdForm && (
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1.5px dashed #0284c7',
                        borderRadius: 'var(--border-radius-sm)',
                        padding: '0.85rem',
                        marginBottom: '0.35rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Package size={15} style={{ color: '#0284c7' }} />
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0369a1' }}>
                            Add Unlisted Product (Not from Book)
                          </span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Saves to catalog upon sale
                        </span>
                      </div>

                      <form onSubmit={handleAddCustomProduct} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.45rem' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600 }}>Product Code *</label>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="e.g. ART-1002"
                              value={customProdCode}
                              onChange={(e) => setCustomProdCode(e.target.value)}
                              style={{ fontSize: '0.8rem', padding: '0.3rem 0.45rem' }}
                              required
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600 }}>Name (Optional)</label>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="Defaults to code"
                              value={customProdName}
                              onChange={(e) => setCustomProdName(e.target.value)}
                              style={{ fontSize: '0.8rem', padding: '0.3rem 0.45rem' }}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600 }}>Sale Price (৳) *</label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="input-control"
                              placeholder="0.00"
                              value={customProdPrice}
                              onChange={(e) => setCustomProdPrice(e.target.value)}
                              style={{ fontSize: '0.8rem', padding: '0.3rem 0.45rem' }}
                              required
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600 }}>Qty *</label>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              className="input-control"
                              placeholder="1"
                              value={customProdQty}
                              onChange={(e) => setCustomProdQty(e.target.value)}
                              style={{ fontSize: '0.8rem', padding: '0.3rem 0.45rem' }}
                              required
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600 }}>Size (Opt)</label>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="e.g. XL, 32"
                              value={customProdSize}
                              onChange={(e) => setCustomProdSize(e.target.value)}
                              style={{ fontSize: '0.8rem', padding: '0.3rem 0.45rem' }}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600 }}>Cartons (Opt)</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              className="input-control"
                              placeholder="0"
                              value={customProdCarton}
                              onChange={(e) => setCustomProdCarton(e.target.value)}
                              style={{ fontSize: '0.8rem', padding: '0.3rem 0.45rem' }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem', marginTop: '0.2rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setShowCustomProdForm(false);
                              setCustomProdCode('');
                              setCustomProdName('');
                              setCustomProdPrice('');
                              setCustomProdQty(1);
                              setCustomProdSize('');
                              setCustomProdCarton('');
                            }}
                            style={{ fontSize: '0.76rem', padding: '0.25rem 0.55rem' }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary btn-sm"
                            disabled={isCheckingCustomCode}
                            style={{ fontSize: '0.76rem', padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            {isCheckingCustomCode ? (
                              <span>Checking Code...</span>
                            ) : (
                              <>
                                <Plus size={13} />
                                <span>Add to Invoice</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Cart Items Table (Desktop) */}
                  <div className="table-container hide-on-mobile" style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', marginTop: '0.4rem' }}>
                    <table style={{ margin: 0, fontSize: '0.82rem' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 5, backgroundColor: 'var(--bg-secondary, #f8fafc)' }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '0.45rem 0.5rem' }}>Product</th>
                          <th style={{ width: '90px', textAlign: 'center', padding: '0.45rem 0.35rem' }}>Size</th>
                          <th style={{ width: '70px', textAlign: 'center', padding: '0.45rem 0.35rem' }}>Cartons</th>
                          <th style={{ width: '100px', textAlign: 'center', padding: '0.45rem 0.35rem' }}>Qty</th>
                          <th style={{ width: '95px', textAlign: 'right', padding: '0.45rem 0.35rem' }}>Price (৳)</th>
                          <th style={{ width: '85px', textAlign: 'right', padding: '0.45rem 0.5rem' }}>Total (৳)</th>
                          <th style={{ width: '36px', textAlign: 'center', padding: '0.45rem 0.25rem' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                              Cart is empty. Search above to add items to invoice.
                            </td>
                          </tr>
                        ) : (
                          cart.map((item) => {
                            const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (item.product.sale_price || 0);
                            const lineTotal = (parseFloat(unitPrice) || 0) * (parseFloat(item.quantity) || 0);
                            const isUnlisted = item.isCustomUnlisted || item.product?.is_custom_unlisted;
                            return (
                              <tr key={item.product.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'middle' }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.25, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                                    <span>{item.product.name}</span>
                                    {isUnlisted && (
                                      <span
                                        style={{
                                          backgroundColor: '#fef3c7',
                                          color: '#92400e',
                                          fontSize: '0.64rem',
                                          fontWeight: 700,
                                          padding: '0.1rem 0.35rem',
                                          borderRadius: '3px',
                                          border: '1px solid #fde68a'
                                        }}
                                        title="Unlisted item — will be automatically added to product book on checkout"
                                      >
                                        NEW ITEM
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                    {item.product.sku || item.product.product_code ? (
                                      <span style={{ fontFamily: 'monospace' }}>{item.product.sku || item.product.product_code}</span>
                                    ) : null}
                                    {item.product.unit ? ` • ${item.product.unit}` : ''}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center', padding: '0.35rem 0.25rem', verticalAlign: 'middle' }}>
                                  <input
                                    type="text"
                                    className="input-control"
                                    placeholder="Size"
                                    style={{ width: '100%', minWidth: '70px', padding: '0.25rem 0.35rem', fontSize: '0.8rem', textAlign: 'center', height: '28px', minHeight: '28px' }}
                                    value={item.size || ''}
                                    onChange={(e) => updateItemSize(item.product.id, e.target.value)}
                                  />
                                </td>
                                <td style={{ textAlign: 'center', padding: '0.35rem 0.25rem', verticalAlign: 'middle' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="0"
                                    className="input-control"
                                    style={{ width: '100%', minWidth: '55px', padding: '0.25rem 0.35rem', fontSize: '0.8rem', textAlign: 'center', height: '28px', minHeight: '28px' }}
                                    value={item.number_of_carton === '' ? '' : (item.number_of_carton ?? '')}
                                    onChange={(e) => updateItemCarton(item.product.id, e.target.value)}
                                  />
                                </td>
                                <td style={{ textAlign: 'center', padding: '0.35rem 0.25rem', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      style={{ width: '22px', height: '26px', padding: 0, minWidth: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
                                      onClick={() => updateQty(item.product.id, -1)}
                                      title="Decrease"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      className="input-control"
                                      min="1"
                                      step="any"
                                      max={!isFactory ? item.stockLimit : undefined}
                                      style={{ width: '45px', textAlign: 'center', padding: '0.2rem 0.2rem', height: '26px', minHeight: '26px', fontSize: '0.82rem', fontWeight: 600 }}
                                      value={item.quantity}
                                      onChange={(e) => handleCustomQtyChange(item.product.id, e.target.value)}
                                      onBlur={() => handleQtyBlur(item.product.id)}
                                      title={!isFactory ? `Available: ${item.stockLimit}` : undefined}
                                    />
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      style={{ width: '22px', height: '26px', padding: 0, minWidth: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
                                      onClick={() => updateQty(item.product.id, 1)}
                                      title="Increase"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right', padding: '0.35rem 0.25rem', verticalAlign: 'middle' }}>
                                  <input
                                    type="number"
                                    className="input-control"
                                    min="0"
                                    step="any"
                                    style={{ width: '100%', minWidth: '70px', textAlign: 'right', padding: '0.25rem 0.4rem', fontSize: '0.82rem', height: '28px', minHeight: '28px' }}
                                    value={unitPrice}
                                    onChange={(e) => handleCustomPriceChange(item.product.id, e.target.value)}
                                    onBlur={() => handlePriceBlur(item.product.id)}
                                    title="Unit Sale Price"
                                  />
                                </td>
                                <td style={{ textAlign: 'right', padding: '0.45rem 0.5rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', verticalAlign: 'middle' }}>
                                  ৳{formatAmount(lineTotal)}
                                </td>
                                <td style={{ textAlign: 'center', padding: '0.35rem 0.25rem', verticalAlign: 'middle' }}>
                                  <button
                                    type="button"
                                    style={{ background: 'none', border: 'none', color: 'var(--danger, #ef4444)', cursor: 'pointer', padding: '0.25rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                    onClick={() => removeFromCart(item.product.id)}
                                    title="Remove item"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cart Items Card View */}
                  <div className="hide-on-desktop mobile-card-list" style={{ maxHeight: '350px', overflowY: 'auto', marginTop: '0.4rem' }}>
                    {cart.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-muted)', backgroundColor: '#f8fafc', borderRadius: 'var(--border-radius-sm)', border: '1px dashed var(--border-color)', fontSize: '0.85rem' }}>
                        Cart is empty. Search above to add items to invoice.
                      </div>
                    ) : (
                      cart.map((item, idx) => {
                        const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (item.product.sale_price || 0);
                        const lineTotal = (parseFloat(unitPrice) || 0) * (parseFloat(item.quantity) || 0);
                        const isUnlisted = item.isCustomUnlisted || item.product?.is_custom_unlisted;
                        return (
                          <div key={item.product.id || idx} className="mobile-item-card">
                            <div className="mobile-card-header">
                              <span className="mobile-card-badge">#{idx + 1}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                                  <span>{item.product.name}</span>
                                  {isUnlisted && (
                                    <span style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                                      NEW
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                  {item.product.sku || item.product.product_code ? <span style={{ fontFamily: 'monospace' }}>{item.product.sku || item.product.product_code}</span> : null}
                                  {item.product.unit ? ` • ${item.product.unit}` : ''}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.product.id)}
                                style={{ border: 'none', background: 'none', color: 'var(--danger, #ef4444)', cursor: 'pointer', padding: '0.25rem' }}
                                title="Remove item"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            <div className="mobile-card-row-2">
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Size (Opt)</label>
                                <input
                                  type="text"
                                  className="input-control"
                                  placeholder="e.g. XL"
                                  value={item.size || ''}
                                  onChange={(e) => updateItemSize(item.product.id, e.target.value)}
                                  style={{ height: '34px', fontSize: '0.85rem', textAlign: 'center' }}
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Cartons (Opt)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="0"
                                  className="input-control"
                                  value={item.number_of_carton === '' ? '' : (item.number_of_carton ?? '')}
                                  onChange={(e) => updateItemCarton(item.product.id, e.target.value)}
                                  style={{ height: '34px', fontSize: '0.85rem', textAlign: 'center' }}
                                />
                              </div>
                            </div>

                            <div className="mobile-card-row-pricing">
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Quantity</label>
                                <div className="mobile-qty-stepper">
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.product.id, -1)}
                                    title="Decrease"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    step="any"
                                    max={!isFactory ? item.stockLimit : undefined}
                                    value={item.quantity}
                                    onChange={(e) => handleCustomQtyChange(item.product.id, e.target.value)}
                                    onBlur={() => handleQtyBlur(item.product.id)}
                                    style={{ height: '34px', width: '46px', textAlign: 'center', fontSize: '0.88rem' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.product.id, 1)}
                                    title="Increase"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Unit Price (৳)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="input-control"
                                  value={unitPrice}
                                  onChange={(e) => handleCustomPriceChange(item.product.id, e.target.value)}
                                  onBlur={() => handlePriceBlur(item.product.id)}
                                  style={{ height: '34px', fontSize: '0.85rem', textAlign: 'right' }}
                                />
                              </div>

                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Line Total</div>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)', marginTop: '0.2rem' }}>
                                  ৳{formatAmount(lineTotal)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Totals Summary */}
                  {cart.length > 0 && (
                    <div className="cart-totals-summary">
                      <div className="totals-row">
                        <span>Total Quantity</span>
                        <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{getTotalQuantity()}</strong>
                      </div>
                      <div className="totals-row">
                        <span>Subtotal</span>
                        <span>৳{formatAmount(getSubtotal())}</span>
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
                          step="any"
                          placeholder="0"
                          className="input-control"
                          style={{ width: '100px', padding: '0.25rem 0.5rem', textAlign: 'right' }}
                          value={taxRate === 0 ? '' : taxRate}
                          onChange={(e) => setTaxRate(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                        />
                      </div>
                      <div className="totals-row grand-total">
                        <span>Grand Total</span>
                        <span>৳{formatAmount(getGrandTotal())}</span>
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: '0.5rem', padding: '0.8rem', fontWeight: 700 }}
                        onClick={() => {
                          if (customerType === 'new') {
                            if (!newCustName.trim()) {
                              showMessage('Please enter the customer name.', 'error');
                              return;
                            }
                          } else {
                            if (!selectedCustomerId) {
                              showMessage('Please select a customer before checkout.', 'error');
                              return;
                            }
                          }
                          setPaidAmount(formatPlainNumber(getGrandTotal()));
                          setPaymentMethod('cash');
                          setCustomerGivenCash('');
                          setShowCheckoutModal(true);
                        }}
                      >
                        Checkout
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
                Checkout
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCheckoutModal(false)} style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}>✕</button>
            </div>

            <form onSubmit={handleCheckoutSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', padding: '1.25rem' }}>

                {/* TOTAL AMOUNT & QUANTITY BANNER */}
                <div style={{
                  background: 'var(--primary-light, rgba(37,99,235,0.08))',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md, 8px)',
                  textAlign: 'center',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '0.35rem', fontSize: '0.84rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Quantity:</span>
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{getTotalQuantity()}</strong>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, marginTop: '0.2rem' }}>Total Amount</div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.85rem', fontWeight: 800, color: 'var(--primary-color, #2563eb)' }}>
                    ৳{formatAmount(getGrandTotal())}
                  </div>
                </div>

                {/* QUICK PRESETS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPaidAmount(formatPlainNumber(getGrandTotal()));
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
                      fontSize: '0.85rem'
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
                      fontSize: '0.85rem'
                    }}
                  >
                    Full Due
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
                      <option value="mobile_banking">Mobile Banking (bKash/Nagad)</option>
                      <option value="bank">Bank</option>
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
                          Due:
                        </span>
                        <span style={{ color: '#dc2626', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem' }}>
                          ৳{formatAmount(due)}
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
                          Change:
                        </span>
                        <span style={{ color: '#2563eb', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem' }}>
                          ৳{formatAmount(overpaid)}
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

                {/* OPTIONAL NOTES, RECEIPT & TRX */}
                <div className="form-grid-responsive-3" style={{ gap: '0.65rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>
                      Stored Receipt No
                    </label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. REC-102"
                      style={{ fontSize: '0.85rem', height: '36px' }}
                      value={storedReceiptNo}
                      onChange={(e) => setStoredReceiptNo(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>
                      Reference No
                    </label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. Trx ID"
                      style={{ fontSize: '0.85rem', height: '36px' }}
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>
                      Notes
                    </label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Enter notes..."
                      style={{ fontSize: '0.85rem', height: '36px' }}
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
      {/* SALES CHALLAN PRINT MODAL */}
      {showInvoicePrint && activeInvoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px', width: '95%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header no-print">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Printer size={18} />
                <span>Sales Challan Print Preview — {activeInvoice.invoice_number || `INV#${activeInvoice.id.substring(0, 8).toUpperCase()}`}</span>
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowInvoicePrint(false)}
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: '1.25rem', backgroundColor: '#f8fafc' }}>
              <div
                className="invoice-print-view"
                style={{
                  margin: '0 auto',
                  border: '1px solid #000',
                  backgroundColor: '#ffffff',
                  padding: '0.8rem 1rem',
                  position: 'relative',
                  color: '#000',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}
              >
                {/* WATERMARK */}
                <div style={{
                  position: 'absolute',
                  top: '55%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-25deg)',
                  fontSize: '3.8rem',
                  fontWeight: 900,
                  color: 'rgba(0, 0, 0, 0.04)',
                  letterSpacing: '10px',
                  textTransform: 'uppercase',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  border: '4px solid rgba(0,0,0,0.04)',
                  padding: '0.5rem 2.5rem',
                  borderRadius: '12px',
                  fontFamily: 'Outfit, sans-serif'
                }}>
                  SALES CHALLAN
                </div>

                {/* 1. TOP HEADER WITH OFFICIAL LOGO & TITLE */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #000', paddingBottom: '0.3rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <img
                      src={almasLogo}
                      alt="Almas Logo"
                      style={{ width: '38px', height: '38px', objectFit: 'contain', border: '1px solid #000', padding: '1px', background: '#fff', borderRadius: '3px' }}
                    />
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.2px', color: '#000', textTransform: 'uppercase', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>
                        ALMAS ACCESSORIES INDUSTRIES
                      </h1>
                      <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#334155', fontStyle: 'italic', marginTop: '0.05rem' }}>
                        100% Export Oriented Garments Accessories Industries
                      </div>
                    </div>
                  </div>

                  {/* DISTINCTIVE SALES CHALLAN PILL BADGE */}
                  <div style={{
                    border: '1.5px solid #000',
                    borderRadius: '9999px',
                    padding: '0.2rem 0.85rem',
                    textAlign: 'center',
                    backgroundColor: '#ffffff',
                    boxShadow: 'inset 0 0 0 1px #fff, inset 0 0 0 2px #000',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <span style={{
                      fontFamily: '"Times New Roman", Times, Georgia, serif',
                      fontSize: '0.85rem',
                      fontWeight: 900,
                      fontStyle: 'italic',
                      letterSpacing: '1px',
                      color: '#000',
                      textTransform: 'uppercase',
                      padding: '0 0.1rem',
                      lineHeight: 1
                    }}>
                      SALES CHALLAN
                    </span>
                  </div>
                </div>

                {/* 2. CHALLAN METADATA GRID */}
                <div style={{ marginTop: '0.32rem', display: 'flex', flexDirection: 'column', gap: '0.18rem', fontSize: '0.76rem', lineHeight: 1.2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Challan No. :</span>
                      <span style={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif', letterSpacing: '0.2px', borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem' }}>
                        {activeInvoice.invoice_number || `INV#${activeInvoice.id.substring(0, 8).toUpperCase()}`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.3rem', width: '38%' }}>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Date :</span>
                      <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontWeight: 700 }}>
                        {new Date(activeInvoice.sale_date).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  </div>

                  {getSaleReceiptNo(activeInvoice) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Receipt No. :</span>
                        <span style={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif', letterSpacing: '0.2px', borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', color: '#0369a1' }}>
                          {getSaleReceiptNo(activeInvoice)}
                        </span>
                      </div>
                      <div style={{ width: '38%' }}></div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Messrs :</span>
                      <span style={{ fontWeight: 800, borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontSize: '0.84rem' }}>
                        {activeInvoice.contacts?.name || ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', width: '38%' }}>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Branch :</span>
                      <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontWeight: 700 }}>
                        {branches.find((b) => b.id === activeInvoice.branch_id)?.name || branches.find((b) => b.id === selectedBranchId)?.name || ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Address :</span>
                      <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem' }}>
                        {activeInvoice.contacts?.address || ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', width: '38%' }}>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Location :</span>
                      <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontWeight: 600 }}>
                        {branches.find((b) => b.id === activeInvoice.branch_id)?.address || branches.find((b) => b.id === selectedBranchId)?.address || ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Export L/c. No. :</span>
                      <span style={{ borderBottom: '1px dotted #000', flex: 1 }}></span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.3rem', width: '38%' }}>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>L/c. No. :</span>
                      <span style={{ borderBottom: '1px dotted #000', flex: 1 }}></span>
                    </div>
                  </div>
                </div>

                {/* 3. GOODS TABLE */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginTop: '0.85rem',
                    border: '1.5px solid #000',
                    fontSize: '0.84rem'
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#f1f5f9' }}>
                      <th style={{ width: '35px', borderRight: '1px solid #000', padding: '0.45rem 0.25rem', textAlign: 'center', fontWeight: 800 }}>Sl.</th>
                      <th style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 800 }}>Description of Goods</th>
                      <th style={{ width: '80px', borderRight: '1px solid #000', padding: '0.45rem 0.35rem', textAlign: 'center', fontWeight: 800 }}>Size</th>
                      <th style={{ width: '65px', borderRight: '1px solid #000', padding: '0.45rem 0.35rem', textAlign: 'center', fontWeight: 800 }}>Cartons</th>
                      <th style={{ width: '75px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'center', fontWeight: 800 }}>Quantity</th>
                      <th style={{ width: '90px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Price (৳)</th>
                      <th style={{ width: '100px', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Total (৳)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.map((item, index) => {
                      const qty = parseFloat(item.quantity) || 1;
                      const price = parseFloat(
                        item.unit_price !== undefined && item.unit_price !== ''
                          ? item.unit_price
                          : item.unitPrice !== undefined && item.unitPrice !== ''
                          ? item.unitPrice
                          : item.products?.sale_price || item.product?.sale_price || 0
                      );
                      const total = parseFloat(item.total_price !== undefined && item.total_price !== '' ? item.total_price : (qty * price));
                      const itemSize = item.size || item.products?.category || item.product?.category || '—';
                      const itemCartons = item.number_of_carton !== undefined && item.number_of_carton !== null ? item.number_of_carton : '0';
                      return (
                        <tr key={item.id || index} style={{ borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.45rem 0.25rem', fontWeight: 600 }}>
                            {index + 1}
                          </td>
                          <td style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem' }}>
                            <div style={{ fontWeight: 700 }}>{item.products?.name || item.product?.name || 'Item'}</div>
                            <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                              Code: {item.products?.product_code || item.products?.sku || item.product?.sku || 'N/A'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.45rem 0.35rem', fontSize: '0.78rem', fontWeight: 600 }}>
                            {itemSize}
                          </td>
                          <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.45rem 0.35rem', fontSize: '0.8rem', fontWeight: 700 }}>
                            {itemCartons}
                          </td>
                          <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', fontWeight: 800 }}>
                            {qty}
                          </td>
                          <td style={{ textAlign: 'right', borderRight: '1px solid #000', padding: '0.45rem 0.5rem' }}>
                            ৳{formatAmount(price)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0.5rem', fontWeight: 700 }}>
                            ৳{formatAmount(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* 4. TOTALS & BILLING SUMMARY */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', marginTop: '0.75rem' }}>
                  <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', border: '1px solid #000', padding: '0.65rem 0.85rem', borderRadius: '4px', backgroundColor: '#fdfdfd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600 }}>Subtotal:</span>
                      <span>৳{formatAmount(activeInvoice.total_amount)}</span>
                    </div>
                    {activeInvoice.discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                        <span>Discount:</span>
                        <span>-৳{formatAmount(activeInvoice.discount)}</span>
                      </div>
                    )}
                    {activeInvoice.tax > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Tax / VAT:</span>
                        <span>৳{formatAmount(activeInvoice.tax)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, borderTop: '1.5px solid #000', paddingTop: '0.35rem', fontSize: '0.98rem' }}>
                      <span>Total Bill:</span>
                      <span>৳{formatAmount(activeInvoice.net_amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700 }}>
                      <span>Paid Amount:</span>
                      <span>৳{formatAmount(activeInvoice.paid_amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: (activeInvoice.net_amount - activeInvoice.paid_amount) > 0 ? '#dc2626' : '#000', fontWeight: 800 }}>
                      <span>Due Balance:</span>
                      <span>৳{formatAmount(Math.max(0, (activeInvoice.net_amount || 0) - (activeInvoice.paid_amount || 0)))}</span>
                    </div>
                  </div>
                </div>

                {/* 5. FOUR SIGNATURE BOXES */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginTop: '3.5rem', textAlign: 'center', fontSize: '0.78rem' }}>
                  <div>
                    <div style={{ borderTop: '1px dotted #000', paddingTop: '0.35rem', fontWeight: 700 }}>Receiver's Signature</div>
                  </div>
                  <div>
                    <div style={{ borderTop: '1px dotted #000', paddingTop: '0.35rem', fontWeight: 700 }}>Prepared by</div>
                  </div>
                  <div>
                    <div style={{ borderTop: '1px dotted #000', paddingTop: '0.35rem', fontWeight: 700 }}>Store Incharge</div>
                  </div>
                  <div>
                    <div style={{ borderTop: '1px dotted #000', paddingTop: '0.35rem', fontWeight: 700 }}>Authorised Signature</div>
                  </div>
                </div>

                {/* 6. BOTTOM OFFICIAL FACTORY / BRANCH FOOTER */}
                {(() => {
                  const currentBranch = branches.find((b) => b.id === activeInvoice?.branch_id) || branches.find((b) => b.id === selectedBranchId);
                  const isFactoryBranch = currentBranch ? Boolean(currentBranch.is_factory) : true;
                  const label = isFactoryBranch ? 'Office & Factory' : 'Showroom';
                  const branchAddr = currentBranch?.address || '604/750, Najir Ahamed Mistiri Sodok, West Jharnapara, Baro Quarter, Doublemooring, Chattogram, Bangladesh.';
                  const branchCell = currentBranch?.phone || '01819-898617, 01845-069803';

                  return (
                    <div style={{ borderTop: '1.5px solid #000', marginTop: '1.25rem', paddingTop: '0.5rem', textAlign: 'center', fontSize: '0.74rem', color: '#1e293b', lineHeight: 1.4 }}>
                      <div style={{ fontWeight: 700 }}>
                        {label} : {branchAddr} &nbsp;|&nbsp; Cell : {branchCell}
                      </div>
                      <div style={{ color: '#475569' }}>
                        E-mail : almasaccessoriesind@gmail.com, Web : www.almasaccessories.com
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="modal-footer no-print">
              <button type="button" className="btn btn-secondary" onClick={() => setShowInvoicePrint(false)}>Close</button>
              <button type="button" className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Printer size={16} />
                <span>Print Sales Challan</span>
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
                    <div style={{ fontWeight: 700 }}>৳{formatAmount(selectedSaleForReturn.net_amount)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Paid</div>
                    <div style={{ fontWeight: 700, color: 'var(--success-text)' }}>৳{formatAmount(selectedSaleForReturn.paid_amount)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Due</div>
                    <div style={{ fontWeight: 700, color: (selectedSaleForReturn.net_amount - selectedSaleForReturn.paid_amount) > 0 ? 'var(--danger-text)' : 'inherit' }}>
                      ৳{formatAmount(Math.max(0, (selectedSaleForReturn.net_amount || 0) - (selectedSaleForReturn.paid_amount || 0)))}
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
                                  ৳{formatAmount(unitP)}
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
                                  ৳{formatAmount(lineTotal)}
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
                  const grossReturn = returnLineItems.reduce((sum, it) => sum + (parseFloat(it.unit_price || 0) * (parseInt(it.returnQty || 0) || 0)), 0);
                  const invoiceGross = parseFloat(selectedSaleForReturn.total_amount) || parseFloat(selectedSaleForReturn.net_amount) || 0;
                  const invoiceDiscount = parseFloat(selectedSaleForReturn.discount) || Math.max(0, invoiceGross - (parseFloat(selectedSaleForReturn.net_amount) || 0));
                  const discountRatio = invoiceGross > 0 ? (invoiceDiscount / invoiceGross) : 0;
                  const discountDeduction = grossReturn * discountRatio;
                  const totalReturnCredit = Math.max(0, grossReturn - discountDeduction);

                  const originalPaid = parseFloat(selectedSaleForReturn.paid_amount || 0);
                  const due = Math.max(0, (selectedSaleForReturn.net_amount || 0) - originalPaid);
                  const dueCleared = Math.min(due, totalReturnCredit);
                  const remainingDue = Math.max(0, due - dueCleared);
                  const payableCashRefund = Math.min(originalPaid, Math.max(0, totalReturnCredit - dueCleared));

                  return (
                    <div style={{
                      padding: '0.85rem 1rem',
                      background: totalReturnCredit > 0 ? 'rgba(217, 119, 6, 0.08)' : 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${totalReturnCredit > 0 ? 'var(--warning-text, #d97706)' : 'var(--border-color)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                          Returned Goods (Net): <span style={{ color: 'var(--warning-text, #d97706)' }}>৳{formatAmount(totalReturnCredit)}</span>
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: payableCashRefund > 0 ? '#15803d' : 'var(--text-secondary)' }}>
                          Cash to Refund: ৳{formatAmount(payableCashRefund)}
                        </div>
                      </div>

                      {discountDeduction > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.3rem' }}>
                          <span>Gross Value: <strong>৳{formatAmount(grossReturn)}</strong></span>
                          <span style={{ color: 'var(--danger-text, #dc2626)', fontWeight: 600 }}>
                            Less Invoice Discount ({(discountRatio * 100).toFixed(1)}%): <strong>-৳{formatAmount(discountDeduction)}</strong>
                          </span>
                        </div>
                      )}

                      {due > 0 && totalReturnCredit > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.3rem' }}>
                          <span>Adjusted Unpaid Due: <strong style={{ color: '#dc2626' }}>-৳{formatAmount(dueCleared)}</strong></span>
                          <span>Remaining Invoice Due: <strong style={{ color: remainingDue > 0 ? '#ea580c' : '#15803d' }}>৳{formatAmount(remainingDue)}</strong></span>
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
                              <span>৳{formatAmount(item.products?.sale_price)}</span>
                              {!isFactory && <span>Stock: {item.quantity}</span>}
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
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.15rem' }}>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>৳</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={it.unit_price === '' ? '' : it.unit_price}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setExchangeCart(
                                            exchangeCart.map((c, i) => {
                                              if (i === idx) {
                                                if (val === '') return { ...c, unit_price: '' };
                                                const parsed = parseFloat(val);
                                                return { ...c, unit_price: isNaN(parsed) ? 0 : parsed };
                                              }
                                              return c;
                                            })
                                          );
                                        }}
                                        className="input-control"
                                        style={{ width: '70px', textAlign: 'right', padding: '0.2rem 0.35rem', fontSize: '0.82rem' }}
                                      />
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                    ৳{formatAmount((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0))}
                                  </td>
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
                  const grossReturn = returnLineItems.reduce((sum, it) => sum + (parseFloat(it.unit_price || 0) * (parseInt(it.returnQty || 0) || 0)), 0);
                  const invoiceGross = parseFloat(selectedSaleForReturn.total_amount) || parseFloat(selectedSaleForReturn.net_amount) || 0;
                  const invoiceDiscount = parseFloat(selectedSaleForReturn.discount) || Math.max(0, invoiceGross - (parseFloat(selectedSaleForReturn.net_amount) || 0));
                  const discountRatio = invoiceGross > 0 ? (invoiceDiscount / invoiceGross) : 0;
                  const discountDeduction = grossReturn * discountRatio;
                  const totalReturn = Math.max(0, grossReturn - discountDeduction);

                  const originalPaid = parseFloat(selectedSaleForReturn.paid_amount || 0);
                  const due = Math.max(0, (selectedSaleForReturn.net_amount || 0) - originalPaid);
                  const dueCleared = Math.min(due, totalReturn);
                  const remainingDue = Math.max(0, due - dueCleared);
                  const payableCashRefund = Math.min(originalPaid, Math.max(0, totalReturn - dueCleared));

                  const totalExchange = returnType === 'exchange'
                    ? exchangeCart.reduce((sum, it) => sum + (parseFloat(it.unit_price || 0) * (parseFloat(it.quantity || 0) || 0)), 0)
                    : 0;
                  const diff = totalExchange - totalReturn;

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
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Returned Goods Total (Net):</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--warning-text, #d97706)' }}>
                          ৳{formatAmount(totalReturn)}
                        </div>
                      </div>

                      {discountDeduction > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <span>Gross Value: ৳{formatAmount(grossReturn)}</span>
                          <span style={{ color: 'var(--danger-text, #dc2626)', fontWeight: 600 }}>
                            Less Invoice Discount ({(discountRatio * 100).toFixed(1)}%): -৳{formatAmount(discountDeduction)}
                          </span>
                        </div>
                      )}

                      {returnType === 'exchange' && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Replacement Goods Total:</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary-color)' }}>
                              ৳{formatAmount(totalExchange)}
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Settlement:</div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: diff > 0 ? 'var(--danger-text)' : (diff < 0 ? 'var(--success-text)' : 'inherit') }}>
                              {diff > 0 ? `Customer to Pay: +৳${formatAmount(diff)}` : (diff < 0 ? `Store to Refund: -৳${formatAmount(Math.min(originalPaid, Math.abs(diff)))}` : 'Even Exchange (৳0)')}
                            </div>
                          </div>
                        </>
                      )}

                      {returnType === 'cash' && (
                        <>
                          {due > 0 && totalReturn > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.3rem' }}>
                              <span>Adjusted against Unpaid Due: <strong style={{ color: '#dc2626' }}>-৳{formatAmount(dueCleared)}</strong></span>
                              <span>Remaining Due: <strong style={{ color: remainingDue > 0 ? '#ea580c' : '#15803d' }}>৳{formatAmount(remainingDue)}</strong></span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Actual Cash Refund to Customer:</div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: payableCashRefund > 0 ? '#15803d' : 'inherit' }}>
                              ৳{formatAmount(payableCashRefund)}
                            </div>
                          </div>
                        </>
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
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.85rem' }}>Payment Method (+৳{formatAmount(diff)})</label>
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
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.85rem' }}>Refund Difference (-৳{formatAmount(Math.abs(diff))})</label>
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
                              ✓ Even Exchange (৳0)
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
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, letterSpacing: '0.2px' }}>
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
                          <td style={{ textAlign: 'right' }}>৳{formatAmount(unitP)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{formatAmount(lineTotal)}</td>
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
                              <td style={{ textAlign: 'right' }}>৳{formatAmount(unitP)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{formatAmount(lineTotal)}</td>
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
                    <span>৳{formatAmount(activeCreditNote.totalRefundValue)}</span>
                  </div>

                  {activeCreditNote.type === 'exchange' ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        <span>Replacement Items Value:</span>
                        <span>৳{formatAmount(activeCreditNote.totalExchangeValue)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '2px solid var(--text-primary)', paddingTop: '0.5rem', fontSize: '1.1rem' }}>
                        <span>Net Settlement:</span>
                        <span style={{ color: activeCreditNote.exchangeDifference > 0 ? '#dc2626' : (activeCreditNote.exchangeDifference < 0 ? '#10b981' : '#2563eb') }}>
                          {activeCreditNote.exchangeDifference > 0
                            ? `Customer Paid: +৳${formatAmount(activeCreditNote.exchangeDifference)}`
                            : (activeCreditNote.exchangeDifference < 0
                              ? `Refunded: -৳${formatAmount(Math.abs(activeCreditNote.exchangeDifference))}`
                              : 'Even Exchange (৳0)')}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '2px solid var(--text-primary)', paddingTop: '0.5rem', fontSize: '1.15rem' }}>
                      <span>Total Credit Amount:</span>
                      <span style={{ color: '#b45309' }}>৳{formatAmount(activeCreditNote.totalRefundValue)}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3.5rem', paddingTop: '0.5rem' }}>
                  <div style={{ textAlign: 'center', width: '150px', borderTop: '1px dotted #000' }}>
                    <p style={{ margin: '0.35rem 0', fontSize: '0.78rem', fontWeight: 700 }}>Customer Signature</p>
                  </div>
                  <div style={{ textAlign: 'center', width: '150px', borderTop: '1px dotted #000' }}>
                    <p style={{ margin: '0.35rem 0', fontSize: '0.78rem', fontWeight: 700 }}>Store In-Charge</p>
                  </div>
                  <div style={{ textAlign: 'center', width: '150px', borderTop: '1px dotted #000' }}>
                    <p style={{ margin: '0.35rem 0', fontSize: '0.78rem', fontWeight: 700 }}>Authorised Signature</p>
                  </div>
                </div>

                {/* Official Footer */}
                {(() => {
                  const currentBranch = branches.find((b) => b.id === activeCreditNote?.sale?.branch_id) || activeBranch;
                  const isFactoryBranch = currentBranch ? Boolean(currentBranch.is_factory) : true;
                  const label = isFactoryBranch ? 'Office & Factory' : 'Showroom';
                  const branchAddr = currentBranch?.address || '604/750, Najir Ahamed Mistiri Sodok, West Jharnapara, Baro Quarter, Doublemooring, Chattogram, Bangladesh.';
                  const branchCell = currentBranch?.phone || '01819-898617, 01845-069803';

                  return (
                    <div style={{ borderTop: '1.5px solid #000', marginTop: '1.5rem', paddingTop: '0.5rem', textAlign: 'center', fontSize: '0.74rem', color: '#1e293b', lineHeight: 1.4 }}>
                      <div style={{ fontWeight: 700 }}>
                        {label} : {branchAddr} &nbsp;|&nbsp; Cell : {branchCell}
                      </div>
                      <div style={{ color: '#475569' }}>
                        E-mail : almasaccessoriesind@gmail.com, Web : www.almasaccessories.com
                      </div>
                    </div>
                  );
                })()}
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

      {/* SALES DETAILS MODAL (CLEAN & MINIMAL) */}
      {showSaleDetailsModal && selectedSaleForDetails && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg" style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div className="modal-header" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileText size={18} style={{ color: '#0284c7' }} />
                <h3 className="modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  Invoice {selectedSaleForDetails.invoice_number || `INV#${selectedSaleForDetails.id.substring(0, 8).toUpperCase()}`}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span className={`badge badge-${selectedSaleForDetails.payment_status}`} style={{ textTransform: 'capitalize' }}>
                  {selectedSaleForDetails.payment_status}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowSaleDetailsModal(false)}
                  style={{ borderRadius: '50%', padding: '0.35rem', border: 'none' }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Clean Meta Info Bar */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                fontSize: '0.84rem'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block', fontWeight: 600 }}>BUYER</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <strong>{selectedSaleForDetails.contacts?.name || 'Walk-in Customer'}</strong>
                    {isSaleShowroomChallan(selectedSaleForDetails) && (
                      <span
                        style={{
                          backgroundColor: '#f0fdf4',
                          color: '#15803d',
                          border: '1px solid #bbf7d0',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                      >
                        🏪 Showroom Challan
                      </span>
                    )}
                  </div>
                  {selectedSaleForDetails.contacts?.phone && <span style={{ color: 'var(--text-secondary)' }}> ({selectedSaleForDetails.contacts.phone})</span>}
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block', fontWeight: 600 }}>OUTLET / BRANCH</span>
                  <strong>{branches.find(b => b.id === selectedSaleForDetails.branch_id)?.name || 'Main Factory'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block', fontWeight: 600 }}>INVOICE DATE</span>
                  <strong>{new Date(selectedSaleForDetails.sale_date).toLocaleDateString()}</strong>
                </div>
                {getSaleReceiptNo(selectedSaleForDetails) && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block', fontWeight: 600 }}>STORED RECEIPT NO</span>
                    <strong style={{ color: '#0284c7' }}>{getSaleReceiptNo(selectedSaleForDetails)}</strong>
                  </div>
                )}
              </div>

              {/* ITEMS & TOTALS SECTION */}
              {(() => {
                const hasModifications = (saleDetailReturns && saleDetailReturns.length > 0) || (saleDetailReplacements && saleDetailReplacements.length > 0);

                // 1. Retained original items (initial qty - returned)
                const retainedItems = saleDetailItems
                  .map((item) => {
                    const initialQty = parseFloat(item.quantity) || 0;
                    const price = parseFloat(item.unit_price) || 0;
                    const returnedQty = saleDetailReturns
                      .filter((r) => r.product?.id === item.product_id || r.product_id === item.product_id)
                      .reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
                    const currentQty = Math.max(0, initialQty - returnedQty);
                    return {
                      key: `orig-${item.id || item.product_id}`,
                      name: item.products?.name || 'Product',
                      sku: item.products?.sku || item.products?.product_code || '—',
                      size: item.size || '—',
                      cartons: item.number_of_carton !== undefined && item.number_of_carton !== null ? item.number_of_carton : 0,
                      quantity: currentQty,
                      price: price,
                      total: currentQty * price,
                      isExchange: false,
                    };
                  })
                  .filter((it) => it.quantity > 0);

                // 2. Replacement exchange items
                const replacementItems = (saleDetailReplacements || []).map((rep, idx) => {
                  const repQty = parseFloat(rep.quantity) || 1;
                  const repPrice = parseFloat(rep.product?.sale_price) || 0;
                  return {
                    key: `rep-${rep.id || idx}`,
                    name: `${rep.product?.name || 'Replacement Item'} (Replacement)`,
                    sku: rep.product?.sku || rep.product?.product_code || '—',
                    size: rep.size || '—',
                    cartons: rep.number_of_carton !== undefined && rep.number_of_carton !== null ? rep.number_of_carton : 0,
                    quantity: repQty,
                    price: repPrice,
                    total: repQty * repPrice,
                    isExchange: true,
                  };
                });

                const currentItems = [...retainedItems, ...replacementItems];
                const currentSubtotal = hasModifications
                  ? currentItems.reduce((acc, it) => acc + it.total, 0)
                  : saleDetailItems.reduce((acc, it) => acc + ((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0)), 0);
                const initialSubtotal = saleDetailItems.reduce((acc, it) => acc + ((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0)), 0) || (selectedSaleForDetails.total_amount || 0);

                const discount = parseFloat(selectedSaleForDetails.discount) || 0;
                const tax = parseFloat(selectedSaleForDetails.tax) || 0;
                const currentNet = hasModifications
                  ? Math.max(0, currentSubtotal - discount + tax)
                  : (parseFloat(selectedSaleForDetails.net_amount) || Math.max(0, currentSubtotal - discount + tax));
                const paidAmount = parseFloat(selectedSaleForDetails.paid_amount) || 0;
                const currentDue = Math.max(0, currentNet - paidAmount);

                return (
                  <>
                    {hasModifications ? (
                      <>
                        {/* TABLE 1: OLD PRODUCTS (INITIAL SOLD ITEMS & RETURNS) */}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.4rem', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Old Products (Initial Sold & Returns)</span>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              {saleDetailItems.length} {saleDetailItems.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                          <div className="table-container">
                            <table>
                              <thead>
                                <tr>
                                  <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                                  <th>Product</th>
                                  <th style={{ width: '80px', textAlign: 'center' }}>Size</th>
                                  <th style={{ width: '70px', textAlign: 'center' }}>Cartons</th>
                                  <th style={{ width: '110px' }}>SKU / Code</th>
                                  <th style={{ textAlign: 'center', width: '80px' }}>Initial Qty</th>
                                  <th style={{ textAlign: 'center', width: '80px', color: '#c2410c' }}>Returned</th>
                                  <th style={{ textAlign: 'right', width: '90px' }}>Price</th>
                                  <th style={{ textAlign: 'right', width: '100px' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {loadingSaleDetails ? (
                                  <TableLoading colSpan={9} message="Loading items..." />
                                ) : saleDetailItems.length === 0 ? (
                                  <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                                      No items recorded.
                                    </td>
                                  </tr>
                                ) : (
                                  saleDetailItems.map((item, idx) => {
                                    const initialQty = parseFloat(item.quantity) || 1;
                                    const price = parseFloat(item.unit_price) || 0;
                                    const initialTotal = initialQty * price;
                                    const itemSize = item.size || '—';
                                    const itemCarton = item.number_of_carton !== undefined && item.number_of_carton !== null ? item.number_of_carton : 0;

                                    const returnedQty = saleDetailReturns
                                      .filter((r) => r.product?.id === item.product_id || r.product_id === item.product_id)
                                      .reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);

                                    return (
                                      <tr key={item.id || idx}>
                                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                        <td style={{ fontWeight: 600 }}>{item.products?.name || 'Product'}</td>
                                        <td style={{ textAlign: 'center', fontSize: '0.82rem' }}>{itemSize}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{itemCarton}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                          {item.products?.sku || item.products?.product_code || '—'}
                                        </td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{initialQty}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 700, color: returnedQty > 0 ? '#c2410c' : 'var(--text-muted)' }}>
                                          {returnedQty > 0 ? `${returnedQty}` : '0'}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>৳{formatAmount(price)}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{formatAmount(initialTotal)}</td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* TABLE 2: CURRENT INVOICE ITEMS (RETAINED + REPLACEMENTS) */}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.4rem', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>New Products (Current Invoice Items)</span>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              {currentItems.length} {currentItems.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                          <div className="table-container">
                            <table>
                              <thead>
                                <tr style={{ backgroundColor: '#f0f9ff' }}>
                                  <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                                  <th>Product</th>
                                  <th style={{ width: '80px', textAlign: 'center' }}>Size</th>
                                  <th style={{ width: '70px', textAlign: 'center' }}>Cartons</th>
                                  <th style={{ width: '110px' }}>SKU / Code</th>
                                  <th style={{ textAlign: 'center', width: '80px' }}>Current Qty</th>
                                  <th style={{ textAlign: 'right', width: '90px' }}>Price</th>
                                  <th style={{ textAlign: 'right', width: '100px' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {loadingSaleDetails ? (
                                  <TableLoading colSpan={8} message="Loading current items..." />
                                ) : currentItems.length === 0 ? (
                                  <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '0.85rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                      No active products on this invoice.
                                    </td>
                                  </tr>
                                ) : (
                                  currentItems.map((it, idx) => (
                                    <tr key={it.key || idx}>
                                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                      <td style={{ fontWeight: 600, color: it.isExchange ? '#0369a1' : 'var(--text-primary)' }}>
                                        {it.name}
                                      </td>
                                      <td style={{ textAlign: 'center', fontSize: '0.82rem' }}>{it.size}</td>
                                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{it.cartons}</td>
                                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {it.sku}
                                      </td>
                                      <td style={{ textAlign: 'center', fontWeight: 800, color: '#0284c7' }}>
                                        {it.quantity}
                                      </td>
                                      <td style={{ textAlign: 'right' }}>৳{formatAmount(it.price)}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{formatAmount(it.total)}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* SINGLE CLEAN TABLE FOR NORMAL INVOICE WITHOUT RETURNS/EXCHANGES */
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.4rem', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>Invoice Items</span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {saleDetailItems.length} {saleDetailItems.length === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                        <div className="table-container">
                          <table>
                            <thead>
                              <tr>
                                <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                                <th>Product</th>
                                <th style={{ width: '80px', textAlign: 'center' }}>Size</th>
                                <th style={{ width: '70px', textAlign: 'center' }}>Cartons</th>
                                <th style={{ width: '110px' }}>SKU / Code</th>
                                <th style={{ textAlign: 'center', width: '80px' }}>Qty</th>
                                <th style={{ textAlign: 'right', width: '90px' }}>Price</th>
                                <th style={{ textAlign: 'right', width: '100px' }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {loadingSaleDetails ? (
                                <TableLoading colSpan={8} message="Loading items..." />
                              ) : saleDetailItems.length === 0 ? (
                                <tr>
                                  <td colSpan={8} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                                    No items recorded.
                                  </td>
                                </tr>
                              ) : (
                                saleDetailItems.map((item, idx) => {
                                  const qty = parseFloat(item.quantity) || 1;
                                  const price = parseFloat(item.unit_price) || 0;
                                  const itemTotal = qty * price;
                                  const itemSize = item.size || '—';
                                  const itemCarton = item.number_of_carton !== undefined && item.number_of_carton !== null ? item.number_of_carton : 0;

                                  return (
                                    <tr key={item.id || idx}>
                                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                      <td style={{ fontWeight: 600 }}>{item.products?.name || 'Product'}</td>
                                      <td style={{ textAlign: 'center', fontSize: '0.82rem' }}>{itemSize}</td>
                                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{itemCarton}</td>
                                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {item.products?.sku || item.products?.product_code || '—'}
                                      </td>
                                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>{qty}</td>
                                      <td style={{ textAlign: 'right' }}>৳{formatAmount(price)}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{formatAmount(itemTotal)}</td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* TOTALS & OPTIONAL NOTES */}
                    <div style={{ display: 'flex', justifyContent: selectedSaleForDetails.notes ? 'space-between' : 'flex-end', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                      {selectedSaleForDetails.notes && (
                        <div style={{ flex: 1, minWidth: '220px', fontSize: '0.82rem', backgroundColor: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block', marginBottom: '0.2rem' }}>NOTES</span>
                          <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>{selectedSaleForDetails.notes}</div>
                        </div>
                      )}

                      <div style={{
                        width: '270px',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                        fontSize: '0.85rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Total Quantity:</span>
                          <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {hasModifications
                              ? currentItems.reduce((acc, it) => acc + (parseFloat(it.quantity) || 0), 0)
                              : saleDetailItems.reduce((acc, it) => acc + (parseFloat(it.quantity) || 0), 0)}
                          </strong>
                        </div>
                        {hasModifications && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            <span>Initial Total:</span>
                            <span>৳{formatAmount(initialSubtotal)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{hasModifications ? 'Current Subtotal:' : 'Subtotal:'}</span>
                          <span style={{ fontWeight: 600 }}>৳{formatAmount(currentSubtotal)}</span>
                        </div>
                        {discount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                            <span>Discount:</span>
                            <span>-৳{formatAmount(discount)}</span>
                          </div>
                        )}
                        {tax > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Tax:</span>
                            <span>+৳{formatAmount(tax)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid var(--border-color)', paddingTop: '0.35rem', marginTop: '0.15rem' }}>
                          <span>{hasModifications ? 'Current Total Bill:' : 'Total Bill:'}</span>
                          <span style={{ color: '#0284c7' }}>৳{formatAmount(currentNet)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700 }}>
                          <span>Paid:</span>
                          <span>৳{formatAmount(paidAmount)}</span>
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 800,
                          color: currentDue > 0.01 ? '#dc2626' : '#059669'
                        }}>
                          <span>{hasModifications ? 'Current Due:' : 'Due:'}</span>
                          <span>৳{formatAmount(currentDue)}</span>
                        </div>
                      </div>
                    </div>
                    {/* SECTION 3: PAYMENT HISTORY & COLLECTIONS */}
                    {saleDetailPayments.length > 0 && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.4rem', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>Payment History & Receipts</span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {saleDetailPayments.length} {saleDetailPayments.length === 1 ? 'transaction' : 'transactions'}
                          </span>
                        </div>
                        <div className="table-container">
                          <table>
                            <thead>
                              <tr style={{ backgroundColor: '#f0fdf4' }}>
                                <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                                <th style={{ width: '130px' }}>Receipt / Trx ID</th>
                                <th style={{ width: '110px' }}>Date</th>
                                <th style={{ width: '120px' }}>Method</th>
                                <th>Notes / Reference</th>
                                <th style={{ textAlign: 'right', width: '120px' }}>Amount Collected</th>
                              </tr>
                            </thead>
                            <tbody>
                              {saleDetailPayments.map((pay, idx) => (
                                <tr key={pay.id || idx}>
                                  <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                  <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem' }}>
                                    {pay.payment_number || `PM#${pay.id.substring(0, 8).toUpperCase()}`}
                                  </td>
                                  <td>{new Date(pay.payment_date).toLocaleDateString()}</td>
                                  <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                                    {pay.payment_method?.replace('_', ' ') || 'Cash'}
                                  </td>
                                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                    {pay.notes || (idx === 0 ? 'POS Initial Sale Collection' : 'Due Clearance Collection')}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                                    ৳{formatAmount(pay.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', padding: '0.75rem 1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {selectedSaleForDetails && ((selectedSaleForDetails.net_amount || 0) - (selectedSaleForDetails.paid_amount || 0)) > 0.01 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowSaleDetailsModal(false);
                      handleOpenPaymentModal(selectedSaleForDetails);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: '#15803d',
                      background: 'rgba(22, 163, 74, 0.08)',
                      borderColor: 'rgba(22, 163, 74, 0.35)',
                      fontWeight: 700
                    }}
                  >
                    <Plus size={11} strokeWidth={3} />
                    <Banknote size={14} />
                    <span>Collect Due</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowSaleDetailsModal(false);
                    handleOpenEditSale(selectedSaleForDetails);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#4f46e5' }}
                >
                  <Edit size={13} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowSaleDetailsModal(false);
                    handleOpenReturnModal(selectedSaleForDetails);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--warning-text, #d97706)' }}
                >
                  <RotateCcw size={13} />
                  <span>Return</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    handleDeleteSale(selectedSaleForDetails);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--danger, #ef4444)' }}
                >
                  <Trash2 size={13} />
                  <span>Delete Invoice</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowSaleDetailsModal(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setShowSaleDetailsModal(false);
                    handleRePrint(selectedSaleForDetails);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SALES EDIT INVOICE MODAL */}
      {showEditSaleModal && editingSale && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg" style={{ maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(79, 70, 229, 0.1)',
                  color: '#4f46e5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Edit size={18} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                    Edit Sales Invoice — {editingSale.invoice_number || `INV#${editingSale.id.substring(0, 8).toUpperCase()}`}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Update buyer, items, prices, discounts, and order notes
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowEditSaleModal(false)}
                style={{ borderRadius: '50%', padding: '0.35rem', border: 'none' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePromptSaveEditedSale} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>

                {/* Customer & Date Selection with Showroom Challan Toggle */}
                {(() => {
                  const editSaleBranch = branches.find(b => b.id === (editingSale?.branch_id || selectedBranchId));
                  const isEditBranchFactory = Boolean(editSaleBranch?.is_factory || editSaleBranch?.name?.toLowerCase().includes('factory') || isFactory);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {isEditBranchFactory && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Customer & Date Info
                          </span>
                          <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            userSelect: 'none',
                            backgroundColor: editIsShowroomChallan ? '#f0fdf4' : '#ffffff',
                            border: editIsShowroomChallan ? '1.5px solid #16a34a' : '1px solid var(--border-color)',
                            color: editIsShowroomChallan ? '#15803d' : 'var(--text-primary)',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            transition: 'all 0.15s ease',
                          }}>
                            <input
                              type="checkbox"
                              checked={editIsShowroomChallan}
                              onChange={(e) => handleToggleEditShowroomChallan(e.target.checked)}
                              style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#16a34a' }}
                            />
                            <span>🏪 Is Showroom Challan</span>
                          </label>
                        </div>
                      )}

                      <div className="form-grid-responsive-2" style={{ gap: '0.85rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                            <label style={{ fontWeight: 600, fontSize: '0.82rem', margin: 0 }}>
                              Customer / Buyer *
                            </label>
                            {isEditBranchFactory && editIsShowroomChallan && (
                              <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 700 }}>
                                🔒 Showroom Only
                              </span>
                            )}
                          </div>
                          <select
                            className="input-control"
                            value={editCustomerId}
                            onChange={(e) => setEditCustomerId(e.target.value)}
                            required
                            style={{
                              height: '36px',
                              minHeight: '36px',
                              fontSize: '0.85rem',
                              backgroundColor: (isEditBranchFactory && editIsShowroomChallan) ? '#f0fdf4' : '#ffffff',
                              borderColor: (isEditBranchFactory && editIsShowroomChallan) ? '#86efac' : '#cbd5e1',
                            }}
                          >
                            <option value="">-- Select Customer --</option>
                            {((isEditBranchFactory && editIsShowroomChallan) ? getShowroomCustomers() : customers).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} {c.phone ? `(${c.phone})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.3rem', display: 'block' }}>
                            Invoice Date *
                          </label>
                          <input
                            type="date"
                            className="input-control"
                            value={editSaleDate}
                            onChange={(e) => setEditSaleDate(e.target.value)}
                            required
                            style={{ height: '36px', minHeight: '36px', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Quick Search & Add Product */}
                <div ref={editSearchRef} style={{ position: 'relative' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.82rem' }}>
                    <span>Add More Products from Stock</span>
                    <span style={{ fontSize: '0.74rem', color: '#0284c7' }}>Click below to search catalog</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Search product name, code or SKU to add..."
                      value={editProductSearch}
                      onChange={(e) => {
                        setEditProductSearch(e.target.value);
                        setShowEditSearchDropdown(true);
                      }}
                      onFocus={() => setShowEditSearchDropdown(true)}
                      style={{ paddingLeft: '2.25rem', fontSize: '0.85rem', height: '36px', minHeight: '36px' }}
                    />
                  </div>

                  {showEditSearchDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#ffffff',
                        border: '1.5px solid #0284c7',
                        borderRadius: 'var(--border-radius-sm)',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        marginTop: '0.25rem'
                      }}
                    >
                      {products
                        .filter((item) => {
                          if (!editProductSearch.trim()) return true;
                          const q = editProductSearch.toLowerCase();
                          const p = item.products;
                          return (
                            p?.name?.toLowerCase().includes(q) ||
                            p?.sku?.toLowerCase().includes(q) ||
                            p?.product_code?.toLowerCase().includes(q)
                          );
                        })
                        .map((invItem) => (
                          <div
                            key={invItem.product_id || invItem.id}
                            onClick={() => addToEditCart(invItem)}
                            style={{
                              padding: '0.55rem 0.85rem',
                              borderBottom: '1px solid var(--border-color)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{invItem.products?.name}</div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                SKU: {invItem.products?.sku || invItem.products?.product_code || 'N/A'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.85rem' }}>
                                ৳{formatAmount(invItem.products?.sale_price)}
                              </div>
                              {!isFactory && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  Stock: {invItem.quantity}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Items in Cart Table */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.45rem' }}>
                    Invoice Line Items ({editCart.length})
                  </div>
                  {/* Desktop Table View */}
                  <div className="table-container hide-on-mobile" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '35px', textAlign: 'center' }}>SL</th>
                          <th>Product Name</th>
                          <th style={{ width: '90px', textAlign: 'center' }}>Size</th>
                          <th style={{ width: '75px', textAlign: 'center' }}>Cartons</th>
                          <th style={{ width: '85px', textAlign: 'center' }}>Quantity</th>
                          <th style={{ width: '105px', textAlign: 'right' }}>Unit Price (৳)</th>
                          <th style={{ width: '105px', textAlign: 'right' }}>Total (৳)</th>
                          <th style={{ width: '40px', textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingEditItems ? (
                          <TableLoading colSpan={8} message="Loading invoice items..." />
                        ) : editCart.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: '#dc2626' }}>
                              Please add at least one product to this invoice.
                            </td>
                          </tr>
                        ) : (
                          editCart.map((item, index) => {
                            const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                            return (
                              <tr key={item.product_id || index}>
                                <td style={{ textAlign: 'center', fontWeight: 600 }}>{index + 1}</td>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{item.product?.name || 'Item'}</div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {item.product?.sku || item.product?.product_code || ''}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="text"
                                    placeholder="Size"
                                    className="input-control"
                                    style={{ width: '80px', textAlign: 'center', padding: '0.25rem 0.35rem', margin: '0 auto', fontSize: '0.8rem' }}
                                    value={item.size || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditCart(
                                        editCart.map((c, i) =>
                                          i === index ? { ...c, size: val } : c
                                        )
                                      );
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="0"
                                    className="input-control"
                                    style={{ width: '65px', textAlign: 'center', padding: '0.25rem 0.35rem', margin: '0 auto', fontSize: '0.8rem' }}
                                    value={item.number_of_carton ?? 0}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditCart(
                                        editCart.map((c, i) =>
                                          i === index ? { ...c, number_of_carton: val } : c
                                        )
                                      );
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="input-control"
                                    style={{ width: '70px', textAlign: 'center', padding: '0.25rem 0.35rem', margin: '0 auto' }}
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditCart(
                                        editCart.map((c, i) =>
                                          i === index ? { ...c, quantity: val } : c
                                        )
                                      );
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="input-control"
                                    style={{ width: '90px', textAlign: 'right', padding: '0.25rem 0.45rem', marginLeft: 'auto' }}
                                    value={item.unit_price}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditCart(
                                        editCart.map((c, i) =>
                                          i === index ? { ...c, unit_price: val } : c
                                        )
                                      );
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                                  ৳{formatAmount(lineTotal)}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => removeFromEditCart(item.product_id)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#ef4444',
                                      cursor: 'pointer',
                                      padding: '0.3rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRadius: '4px'
                                    }}
                                    title="Remove Item"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="hide-on-desktop mobile-card-list" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    {loadingEditItems ? (
                      <LoadingBlock message="Loading invoice items..." />
                    ) : editCart.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: '#dc2626', backgroundColor: '#fef2f2', borderRadius: 'var(--border-radius-sm)', border: '1px dashed #fca5a5', fontSize: '0.85rem' }}>
                        Please add at least one product to this invoice.
                      </div>
                    ) : (
                      editCart.map((item, index) => {
                        const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                        return (
                          <div key={item.product_id || index} className="mobile-item-card">
                            <div className="mobile-card-header">
                              <span className="mobile-card-badge">#{index + 1}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                  {item.product?.name || 'Item'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                  {item.product?.sku || item.product?.product_code || ''}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFromEditCart(item.product_id)}
                                style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                                title="Remove Item"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            <div className="mobile-card-row-2">
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Size (Opt)</label>
                                <input
                                  type="text"
                                  placeholder="Size"
                                  className="input-control"
                                  value={item.size || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditCart(editCart.map((c, i) => i === index ? { ...c, size: val } : c));
                                  }}
                                  style={{ height: '34px', fontSize: '0.85rem', textAlign: 'center' }}
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Cartons (Opt)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="0"
                                  className="input-control"
                                  value={item.number_of_carton ?? 0}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditCart(editCart.map((c, i) => i === index ? { ...c, number_of_carton: val } : c));
                                  }}
                                  style={{ height: '34px', fontSize: '0.85rem', textAlign: 'center' }}
                                />
                              </div>
                            </div>

                            <div className="mobile-card-row-pricing">
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Quantity</label>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  className="input-control"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditCart(editCart.map((c, i) => i === index ? { ...c, quantity: val } : c));
                                  }}
                                  style={{ height: '34px', fontSize: '0.88rem', textAlign: 'center', fontWeight: 600 }}
                                />
                              </div>

                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Unit Price (৳)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="input-control"
                                  value={item.unit_price}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditCart(editCart.map((c, i) => i === index ? { ...c, unit_price: val } : c));
                                  }}
                                  style={{ height: '34px', fontSize: '0.85rem', textAlign: 'right' }}
                                />
                              </div>

                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Line Total</div>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)', marginTop: '0.2rem' }}>
                                  ৳{formatAmount(lineTotal)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Calculation Inputs & Summary */}
                <div className="form-grid-responsive-2" style={{ gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                        Discount Amount (৳)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="input-control"
                        value={editDiscount}
                        onChange={(e) => setEditDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        style={{ height: '36px', minHeight: '36px', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                        Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        className="input-control"
                        value={editTaxRate === 0 ? '' : editTaxRate}
                        onChange={(e) => setEditTaxRate(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                        style={{ height: '36px', minHeight: '36px', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                        Stored Receipt No (Optional)
                      </label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="e.g. REC-102"
                        value={editStoredReceiptNo}
                        onChange={(e) => setEditStoredReceiptNo(e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                        Invoice Notes / Remarks
                      </label>
                      <textarea
                        className="input-control"
                        rows={2}
                        placeholder="Add optional notes or update details..."
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Live Total Card */}
                  <div style={{
                    padding: '1rem',
                    borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                    justifyContent: 'center'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Quantity:</span>
                      <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{getEditTotalQuantity()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>Subtotal:</span>
                      <span style={{ fontWeight: 600 }}>৳{formatAmount(getEditSubtotal())}</span>
                    </div>
                    {editDiscount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#dc2626' }}>
                        <span>Discount:</span>
                        <span>-৳{formatAmount(editDiscount)}</span>
                      </div>
                    )}
                    {editTaxRate > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span>Tax ({editTaxRate}%):</span>
                        <span>+৳{formatAmount(getEditTaxAmount())}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem', borderTop: '1.5px solid var(--border-color)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                      <span>New Grand Total:</span>
                      <span style={{ color: '#4f46e5' }}>৳{formatAmount(getEditGrandTotal())}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#059669', fontWeight: 700 }}>
                      <span>Already Paid:</span>
                      <span>৳{formatAmount(editingSale.paid_amount)}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      color: (getEditGrandTotal() - (editingSale.paid_amount || 0)) > 0.01 ? '#dc2626' : '#059669'
                    }}>
                      <span>Updated Due:</span>
                      <span>৳{formatAmount(Math.max(0, getEditGrandTotal() - (editingSale.paid_amount || 0)))}</span>
                    </div>
                  </div>
                </div>

              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditSaleModal(false)}
                  disabled={isSubmittingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingEdit}
                  style={{ fontWeight: 700, minWidth: '150px' }}
                >
                  {isSubmittingEdit ? 'Saving Changes...' : 'Save & Update Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM EDIT SAVE MODAL */}
      {showEditConfirmModal && editingSale && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '440px', width: '95%', padding: 0 }}>
            <div className="modal-header" style={{ padding: '1rem 1.25rem' }}>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '1.05rem', margin: 0 }}>
                <AlertCircle size={18} style={{ color: '#4f46e5' }} />
                Save Invoice Changes?
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowEditConfirmModal(false)}
                disabled={isSubmittingEdit}
                style={{ borderRadius: '50%', padding: '0.35rem', border: 'none' }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Are you sure you want to update this sales invoice? Physical stock quantities and invoice totals will be recalculated automatically.
              </p>

              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                fontSize: '0.84rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Invoice:</span>
                  <strong style={{ fontFamily: 'monospace' }}>{editingSale.invoice_number || `INV#${editingSale.id.substring(0, 8).toUpperCase()}`}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
                  <strong>{customers.find((c) => c.id === editCustomerId)?.name || 'Selected Customer'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Items:</span>
                  <strong>{editCart.length} item(s)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.35rem', marginTop: '0.2rem' }}>
                  <span style={{ fontWeight: 700 }}>New Total Bill:</span>
                  <strong style={{ color: '#4f46e5', fontSize: '0.95rem' }}>৳{formatAmount(getEditGrandTotal())}</strong>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowEditConfirmModal(false)}
                disabled={isSubmittingEdit}
              >
                No, Keep Editing
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmSaveEditedSale}
                disabled={isSubmittingEdit}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
              >
                {isSubmittingEdit ? 'Saving...' : 'Yes, Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COLLECT PAYMENT MODAL */}
      {/* ========================================================================= */}
      {showPaymentModal && selectedSaleForPayment && (
        <div className="modal-overlay">
          <div className="modal-content modal-md" style={{ maxWidth: '520px' }}>
            <div className="modal-header" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'rgba(22, 163, 74, 0.12)',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Banknote size={19} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700 }}>
                    Collect Due Payment
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Invoice: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedSaleForPayment.invoice_number || `INV#${selectedSaleForPayment.id.substring(0, 8).toUpperCase()}`}</span>
                    {' • '}
                    Customer: <span style={{ fontWeight: 600 }}>{selectedSaleForPayment.contacts?.name || 'Walk-in Customer'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPaymentModal(false)}
                disabled={isSubmittingPayment}
                style={{ borderRadius: '50%', padding: '0.35rem', border: 'none' }}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCollectPayment}>
              <div className="modal-body" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Due Breakdown Cards */}
                {(() => {
                  const bill = parseFloat(selectedSaleForPayment.net_amount || 0);
                  const paid = parseFloat(selectedSaleForPayment.paid_amount || 0);
                  const due = Math.max(0, bill - paid);
                  const entered = parseFloat(collectPaymentAmount) || 0;
                  const newPaid = paid + entered;
                  const newRemainingDue = Math.max(0, due - entered);

                  return (
                    <>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.5rem',
                        background: '#f8fafc',
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        textAlign: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Bill</div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>৳{formatAmount(bill)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Paid So Far</div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--success-text)' }}>৳{formatAmount(paid)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Current Due</div>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--danger-text)' }}>৳{formatAmount(due)}</div>
                        </div>
                      </div>

                      {/* Payment Inputs */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                            Collection Date <span style={{ color: 'red' }}>*</span>
                          </label>
                          <input
                            type="date"
                            className="input-control"
                            value={collectPaymentDate}
                            onChange={(e) => setCollectPaymentDate(e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                            Payment Method <span style={{ color: 'red' }}>*</span>
                          </label>
                          <select
                            className="input-control"
                            value={collectPaymentMethod}
                            onChange={(e) => setCollectPaymentMethod(e.target.value)}
                          >
                            <option value="cash">Cash</option>
                            <option value="bkash">bKash</option>
                            <option value="nagad">Nagad</option>
                            <option value="rocket">Rocket</option>
                            <option value="bank">Bank Transfer</option>
                            <option value="card">Card Payment</option>
                          </select>
                        </div>
                      </div>

                      {/* Amount to collect */}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <label style={{ fontWeight: 600, fontSize: '0.84rem', margin: 0 }}>
                            Amount to Collect (৳) <span style={{ color: 'red' }}>*</span>
                          </label>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem', fontWeight: 600 }}
                              onClick={() => setCollectPaymentAmount(formatPlainNumber(due))}
                            >
                              Full Due (৳{formatAmount(due)})
                            </button>
                            {due > 1 && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem', fontWeight: 600 }}
                                onClick={() => setCollectPaymentAmount(formatPlainNumber(Math.round(due / 2)))}
                              >
                                Half Due
                              </button>
                            )}
                          </div>
                        </div>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          max={due}
                          className="input-control"
                          placeholder="Enter collection amount..."
                          value={collectPaymentAmount}
                          onChange={(e) => setCollectPaymentAmount(e.target.value)}
                          style={{ fontSize: '1.05rem', fontWeight: 700, color: '#15803d' }}
                          required
                          autoFocus
                        />
                      </div>

                      {/* Reference & Notes */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                            Trx ID / Ref (Optional)
                          </label>
                          <input
                            type="text"
                            className="input-control"
                            placeholder="e.g. Trx# 9X4812"
                            value={collectPaymentRef}
                            onChange={(e) => setCollectPaymentRef(e.target.value)}
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                            Notes (Optional)
                          </label>
                          <input
                            type="text"
                            className="input-control"
                            placeholder="Payment notes..."
                            value={collectPaymentNotes}
                            onChange={(e) => setCollectPaymentNotes(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Settlement Preview */}
                      {entered > 0 && (
                        <div style={{
                          padding: '0.75rem 1rem',
                          background: 'rgba(22, 163, 74, 0.06)',
                          border: '1px solid rgba(22, 163, 74, 0.25)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.86rem'
                        }}>
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>New Paid Total: </span>
                            <strong>৳{formatAmount(newPaid)}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Remaining Due: </span>
                            <strong style={{ color: newRemainingDue <= 0.01 ? '#15803d' : '#ea580c' }}>
                              {newRemainingDue <= 0.01 ? '৳0 (Paid in Full ✓)' : `৳${formatAmount(newRemainingDue)}`}
                            </strong>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="modal-footer" style={{ padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={isSubmittingPayment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingPayment || !collectPaymentAmount || parseFloat(collectPaymentAmount) <= 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, background: '#16a34a', borderColor: '#16a34a' }}
                >
                  <Plus size={14} strokeWidth={3} />
                  <Banknote size={16} />
                  <span>{isSubmittingPayment ? 'Collecting...' : `Collect ৳${formatAmount(parseFloat(collectPaymentAmount) || 0)}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

