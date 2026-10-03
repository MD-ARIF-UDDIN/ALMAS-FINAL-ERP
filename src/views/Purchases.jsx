import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Download, Plus, Search, Trash2, UserPlus, CreditCard, Eye, X, Edit } from 'lucide-react';
import { TableLoading } from '../components/TableLoading';
import Pagination from '../components/Pagination';
import { formatAmount } from '../utils/format';
import { SearchableSelect, SearchableCreatableSelect } from '../components/SearchableSelect';

export default function Purchases({ userProfile, branches, addToast }) {
  const location = useLocation();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  
  // Refs for auto-scrolling on row addition
  const purchaseTableContainerRef = useRef(null);
  const purchaseItemsEndRef = useRef(null);
  const editPurchaseTableContainerRef = useRef(null);
  const editPurchaseItemsEndRef = useRef(null);
  
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

  // Edit Purchase States
  const [showEditPurchaseModal, setShowEditPurchaseModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editIsFactoryChallan, setEditIsFactoryChallan] = useState(false);
  const [editPurchaseItems, setEditPurchaseItems] = useState([]);
  const [originalEditItems, setOriginalEditItems] = useState([]);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editSearchQuery, setEditSearchQuery] = useState('');
  const [showEditSearchSuggestions, setShowEditSearchSuggestions] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [loadingEditItems, setLoadingEditItems] = useState(false);

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
  const [isFactoryChallan, setIsFactoryChallan] = useState(false);
  const [purchaseItems, setPurchaseItems] = useState([{ productId: '', code: '', name: '', quantity: 1, costPrice: 0.00 }]); // { productId, code, name, quantity, costPrice }
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

  const activeBranch = branches.find((b) => b.id === selectedBranchId);
  const isFactory = Boolean(activeBranch?.is_factory || activeBranch?.name?.toLowerCase().includes('factory'));

  useEffect(() => {
    if (isFactory) {
      setIsFactoryChallan(false);
    }
  }, [selectedBranchId, isFactory]);

  // Global lookups: Suppliers and Product catalog are fetched on mount
  useEffect(() => {
    fetchSuppliers();
    fetchCatalogProducts();
  }, []);

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const getFactorySupplier = useCallback(() => {
    return suppliers.find(
      (s) => s.name?.toLowerCase().trim() === 'chittagong factory' || s.name?.toLowerCase().includes('factory')
    );
  }, [suppliers]);

  const handleToggleFactoryChallan = (checked) => {
    setIsFactoryChallan(checked);
    if (checked) {
      const factorySup = getFactorySupplier();
      if (factorySup) {
        setSupplierType('existing');
        setSelectedSupplierId(factorySup.id);
      }
    } else {
      setSelectedSupplierId('');
    }
  };

  const handleToggleEditFactoryChallan = (checked) => {
    setEditIsFactoryChallan(checked);
    if (checked) {
      const factorySup = getFactorySupplier();
      if (factorySup) {
        setEditSupplierId(factorySup.id);
      }
    }
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
          ),
          purchase_items (
            quantity
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
        const clean = purchaseSearchQuery.trim();
        const { data: matchedContacts } = await supabase
          .from('contacts')
          .select('id')
          .or(`name.ilike.%${clean}%,phone.ilike.%${clean}%`)
          .limit(30);

        if (matchedContacts && matchedContacts.length > 0) {
          const contactIds = matchedContacts.map((c) => c.id).join(',');
          query = query.or(`invoice_number.ilike.%${clean}%,notes.ilike.%${clean}%,supplier_id.in.(${contactIds})`);
        } else {
          query = query.or(`invoice_number.ilike.%${clean}%,notes.ilike.%${clean}%`);
        }
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
      const prods = data || [];
      if (prods.length > 0) {
        const prodIds = prods.map((p) => p.id);
        const { data: invPrices } = await supabase
          .from('inventory')
          .select('product_id, branch_id, purchase_price, sale_price')
          .in('product_id', prodIds);

        const priceMap = {};
        (invPrices || []).forEach((inv) => {
          if (!priceMap[inv.product_id]) priceMap[inv.product_id] = {};
          priceMap[inv.product_id][inv.branch_id] = inv;
        });

        const enriched = prods.map((p) => ({
          ...p,
          branch_prices: priceMap[p.id] || {},
        }));
        setCatalogProducts(enriched);
      } else {
        setCatalogProducts([]);
      }
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
          id,
          purchase_id,
          product_id,
          item_name,
          quantity,
          unit_price,
          total_price,
          products (
            id,
            name,
            sku
          )
        `)
        .eq('purchase_id', purchase.id);
      if (itemsError) throw itemsError;
      setSelectedPurchaseItems(items || []);

      // 2. Fetch payments
      const { data: payHistory, error: payError } = await supabase
        .from('payments')
        .select('*')
        .eq('reference_invoice_id', purchase.id)
        .order('payment_date', { ascending: true });
      if (payError) throw payError;
      setSelectedPurchasePayments(payHistory || []);
    } catch (err) {
      console.error('Error fetching purchase details:', err);
      showMessage('Failed to load purchase details and payment history.', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };



  const addItemToPurchase = () => {
    setPurchaseItems((prev) => [...prev, { productId: '', code: '', name: '', quantity: 1, costPrice: 0.00 }]);
    setTimeout(() => {
      if (purchaseTableContainerRef.current) {
        purchaseTableContainerRef.current.scrollTop = purchaseTableContainerRef.current.scrollHeight;
      }
      purchaseItemsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 60);
  };

  const updateItemField = (index, field, value) => {
    const updated = purchaseItems.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setPurchaseItems(updated);
  };

  const updateItemRow = (index, fields) => {
    const updated = purchaseItems.map((item, idx) => {
      if (idx === index) {
        return { ...item, ...fields };
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
  const getTotalQuantity = () => {
    return purchaseItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
  };

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

    if (purchaseItems.length === 0 || purchaseItems.some((item) => !item.productId && !item.name?.trim())) {
      showMessage('Please specify a product or item name for all purchase rows.', 'error');
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
      showMessage(`Initial payment cannot exceed the grand total of ৳${formatAmount(grandTotal)}.`, 'error');
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
      const factorySup = getFactorySupplier();
      const isChallan = !isFactory && Boolean(isFactoryChallan || (supplierId === factorySup?.id));

      const purPayload = {
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
        is_factory_challan: isChallan,
      };

      let { data: purData, error: purError } = await supabase
        .from('purchases')
        .insert([purPayload])
        .select();

      if (purError && purError.message?.includes('is_factory_challan')) {
        delete purPayload.is_factory_challan;
        const retry = await supabase.from('purchases').insert([purPayload]).select();
        if (retry.error) throw retry.error;
        purData = retry.data;
        purError = null;
      }

      if (purError) throw purError;
      const purchaseId = purData[0].id;

      // 2. Resolve Purchase Items:
      // If Factory: Unlisted items are saved with product_id: null and NOT added to products catalog or inventory.
      // If Branch/Showroom: Unlisted items are auto-saved to products catalog, and inventory stock is increased for the branch.
      const resolvedPurchaseItems = [];
      let hadNewProducts = false;

      for (const item of purchaseItems) {
        let finalProdId = item.productId || null;
        const cleanName = (item.name || '').trim();
        const costVal = parseFloat(item.costPrice) || 0;
        const itemQty = parseInt(item.quantity) || 1;

        if (isFactory) {
          // Factory Purchase: do not insert to products catalog if unlisted
          resolvedPurchaseItems.push({
            purchase_id: purchaseId,
            product_id: finalProdId,
            item_name: cleanName || 'Custom Item',
            quantity: itemQty,
            unit_price: costVal,
            total_price: costVal * itemQty,
          });
        } else {
          // Branch / Showroom Purchase:
          if (!finalProdId && (cleanName || (item.code || '').trim())) {
            const cleanCode = (item.code || '').trim();
            const displayName = cleanName || cleanCode || 'Purchased Item';
            const autoCode = cleanCode || cleanName || displayName;

            // Check if product exists in catalog
            let query = supabase
              .from('products')
              .select('id, name, sku, product_code');

            if (cleanCode && cleanName) {
              query = query.or(`sku.ilike.${cleanCode},product_code.ilike.${cleanCode},name.ilike.${cleanName}`);
            } else if (cleanCode) {
              query = query.or(`sku.ilike.${cleanCode},product_code.ilike.${cleanCode}`);
            } else {
              query = query.ilike('name', cleanName);
            }

            const { data: matchedProd } = await query.limit(1);

            if (matchedProd && matchedProd.length > 0) {
              finalProdId = matchedProd[0].id;
            } else {
              // Create new product in products catalog
              const { data: createdProd, error: createProdErr } = await supabase
                .from('products')
                .insert([
                  {
                    sku: autoCode,
                    product_code: autoCode,
                    name: displayName,
                    purchase_price: costVal,
                    sale_price: costVal,
                    description: 'Added via Branch Purchase Bill',
                  }
                ])
                .select()
                .single();

              if (createProdErr) throw createProdErr;
              finalProdId = createdProd.id;
              hadNewProducts = true;
            }
          }


          resolvedPurchaseItems.push({
            purchase_id: purchaseId,
            product_id: finalProdId,
            item_name: cleanName || 'Custom Item',
            quantity: itemQty,
            unit_price: costVal,
            total_price: costVal * itemQty,
          });
        }
      }

      const { error: itemsError } = await supabase.from('purchase_items').insert(resolvedPurchaseItems);
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
            reference_number: referenceNumber ? referenceNumber.trim() : null,
            notes: null,
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

      showMessage('Purchase record and invoice saved successfully!', 'success');
      // Reset forms
      setSupplierType('existing');
      setSelectedSupplierId('');
      setIsFactoryChallan(false);
      setPurchaseItems([{ productId: '', code: '', name: '', quantity: 1, costPrice: 0.00 }]);
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
      
      // Refresh history list and catalog if new products were created
      fetchPurchases();
      if (hadNewProducts) {
        fetchCatalogProducts();
      }
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Error occurred saving purchase.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- EDIT PURCHASE METHODS ---
  const handleOpenEditPurchase = async (purchase) => {
    setEditingPurchase(purchase);
    setEditSupplierId(purchase.supplier_id || '');
    setEditPurchaseDate(purchase.purchase_date || new Date().toISOString().split('T')[0]);
    
    const editBranch = branches.find((b) => b.id === purchase.branch_id);
    const isEditBranchFactory = Boolean(editBranch?.is_factory || editBranch?.name?.toLowerCase().includes('factory'));
    const factorySup = getFactorySupplier();
    const isChallan = !isEditBranchFactory && Boolean(
      purchase.is_factory_challan || 
      (purchase.supplier_id && purchase.supplier_id === factorySup?.id) || 
      purchase.contacts?.name?.toLowerCase().includes('factory') ||
      purchase.contacts?.name === 'Chittagong Factory'
    );
    setEditIsFactoryChallan(isChallan);
    setEditDiscount(purchase.discount || 0);
    setEditNotes(purchase.notes || '');
    setEditSearchQuery('');
    setShowEditSearchSuggestions(false);
    setShowEditPurchaseModal(true);
    setLoadingEditItems(true);

    try {
      const { data: items, error } = await supabase
        .from('purchase_items')
        .select(`
          id,
          purchase_id,
          product_id,
          item_name,
          quantity,
          unit_price,
          total_price,
          products (
            id,
            name,
            sku,
            product_code
          )
        `)
        .eq('purchase_id', purchase.id);

      if (error) throw error;

      const formattedItems = (items || []).map((it) => {
        let pId = it.product_id || it.products?.id || '';
        let code = it.products?.sku || it.products?.product_code || '';
        let name = it.products?.name || it.item_name || '';

        // If product_id was not linked, try to find match in catalog
        if (!pId && name) {
          const matched = catalogProducts.find(
            (p) => p.name?.toLowerCase() === name.toLowerCase() || p.sku?.toLowerCase() === name.toLowerCase()
          );
          if (matched) {
            pId = matched.id;
            code = matched.sku || matched.product_code || code;
            name = matched.name;
          }
        }

        return {
          id: it.id,
          productId: pId,
          code: code,
          name: name,
          quantity: it.quantity || 1,
          costPrice: it.unit_price || 0,
        };
      });

      setEditPurchaseItems(formattedItems.length > 0 ? formattedItems : [{ productId: '', code: '', name: '', quantity: 1, costPrice: 0.00 }]);
      setOriginalEditItems(JSON.parse(JSON.stringify(formattedItems)));
    } catch (err) {
      console.error('Error fetching items for edit:', err);
      showMessage('Failed to load items for editing.', 'error');
    } finally {
      setLoadingEditItems(false);
    }
  };

  const updateEditItemRow = (index, updates) => {
    setEditPurchaseItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const updateEditItemField = (index, field, value) => {
    setEditPurchaseItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addEditItemRow = () => {
    setEditPurchaseItems((prev) => [...prev, { productId: '', code: '', name: '', quantity: 1, costPrice: 0.00 }]);
    setTimeout(() => {
      if (editPurchaseTableContainerRef.current) {
        editPurchaseTableContainerRef.current.scrollTop = editPurchaseTableContainerRef.current.scrollHeight;
      }
      editPurchaseItemsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 60);
  };

  const removeEditItemRow = (index) => {
    if (editPurchaseItems.length === 1) {
      setEditPurchaseItems([{ productId: '', code: '', name: '', quantity: 1, costPrice: 0.00 }]);
      return;
    }
    setEditPurchaseItems((prev) => prev.filter((_, i) => i !== index));
  };

  const getEditTotalQuantity = () => {
    return editPurchaseItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
  };

  const getEditSubtotal = () => {
    return editPurchaseItems.reduce((sum, item) => {
      return sum + (parseFloat(item.costPrice) || 0) * (parseInt(item.quantity) || 0);
    }, 0);
  };

  const getEditGrandTotal = () => {
    const sub = getEditSubtotal();
    return Math.max(0, sub - (parseFloat(editDiscount) || 0));
  };

  const handleSaveEditPurchase = async (e) => {
    e?.preventDefault();
    if (!editingPurchase || savingEdit) return;

    if (!editSupplierId) {
      showMessage('Please select a supplier.', 'error');
      return;
    }

    const validItems = editPurchaseItems.filter((i) => i.name?.trim() && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) {
      showMessage('Please enter at least one valid item with name and quantity.', 'error');
      return;
    }

    setSavingEdit(true);
    try {
      const activeBranch = branches.find((b) => b.id === editingPurchase.branch_id);
      const isFactoryPurchase = Boolean(activeBranch?.is_factory || activeBranch?.name?.toLowerCase().includes('factory'));
      const targetBranchId = editingPurchase.branch_id;

      let subtotal = 0;
      validItems.forEach((i) => {
        subtotal += (parseFloat(i.costPrice) || 0) * (parseFloat(i.quantity) || 1);
      });
      const disc = Math.max(0, parseFloat(editDiscount) || 0);
      const netTotal = Math.max(0, subtotal - disc);

      const paid = parseFloat(editingPurchase.paid_amount) || 0;
      let newPaymentStatus = 'unpaid';
      if (paid >= netTotal && netTotal > 0) {
        newPaymentStatus = 'paid';
      } else if (paid > 0) {
        newPaymentStatus = 'partial';
      } else {
        newPaymentStatus = 'unpaid';
      }

      // 1. Update purchase summary
      const factorySup = getFactorySupplier();
      const isChallan = !isFactoryPurchase && Boolean(editIsFactoryChallan || (editSupplierId === factorySup?.id));

      const editPayload = {
        supplier_id: editSupplierId,
        purchase_date: editPurchaseDate,
        total_amount: subtotal,
        discount: disc,
        net_amount: netTotal,
        payment_status: newPaymentStatus,
        notes: editNotes || null,
        is_factory_challan: isChallan,
      };

      let { error: purUpdateErr } = await supabase
        .from('purchases')
        .update(editPayload)
        .eq('id', editingPurchase.id);

      if (purUpdateErr && purUpdateErr.message?.includes('is_factory_challan')) {
        delete editPayload.is_factory_challan;
        const retry = await supabase.from('purchases').update(editPayload).eq('id', editingPurchase.id);
        if (retry.error) throw retry.error;
        purUpdateErr = null;
      }

      if (purUpdateErr) throw purUpdateErr;

      // 2. Fetch current DB purchase items for differential sync
      const { data: dbItems, error: dbItemsErr } = await supabase
        .from('purchase_items')
        .select('id, product_id, item_name, quantity, unit_price, total_price')
        .eq('purchase_id', editingPurchase.id);

      if (dbItemsErr) throw dbItemsErr;

      const currentDbItems = dbItems || [];

      // Resolve product IDs for any new items created in edit modal
      if (!isFactoryPurchase) {
        for (const item of validItems) {
          let finalProdId = item.productId;
          const cleanName = item.name?.trim();
          const cleanCode = item.code?.trim();
          const costVal = parseFloat(item.costPrice) || 0;

          if (!finalProdId) {
            const displayName = cleanName || cleanCode || 'Purchased Item';
            const autoCode = cleanCode || cleanName || displayName;
            let query = supabase.from('products').select('id, name, sku, product_code');
            if (cleanCode && cleanName) {
              query = query.or(`sku.ilike.${cleanCode},product_code.ilike.${cleanCode},name.ilike.${cleanName}`);
            } else if (cleanCode) {
              query = query.or(`sku.ilike.${cleanCode},product_code.ilike.${cleanCode}`);
            } else {
              query = query.ilike('name', cleanName);
            }

            const { data: matchedProd } = await query.limit(1);
            if (matchedProd && matchedProd.length > 0) {
              finalProdId = matchedProd[0].id;
            } else {
              const { data: createdProd, error: createProdErr } = await supabase
                .from('products')
                .insert([
                  {
                    sku: autoCode,
                    product_code: autoCode,
                    name: cleanName,
                    purchase_price: costVal,
                    sale_price: costVal,
                    description: 'Added via Branch Purchase Edit',
                  },
                ])
                .select()
                .single();

              if (createProdErr) throw createProdErr;
              finalProdId = createdProd.id;
            }
            item.productId = finalProdId;
          }
        }
      }

      // Identify deleted items, updated items, and new items
      const validItemIds = new Set(validItems.map((v) => v.id).filter(Boolean));
      const deletedDbItems = currentDbItems.filter((d) => !validItemIds.has(d.id));
      const existingItemsToUpdate = validItems.filter((v) => v.id && currentDbItems.some((d) => d.id === v.id));
      const newItemsToInsert = validItems.filter((v) => !v.id);

      // A. Process Deleted Items
      for (const delIt of deletedDbItems) {
        const pId = delIt.product_id;
        const delQty = parseFloat(delIt.quantity) || 0;

        if (!isFactoryPurchase && targetBranchId && pId && delQty > 0) {
          const { data: curInv } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('branch_id', targetBranchId)
            .eq('product_id', pId)
            .maybeSingle();

          if (curInv) {
            await supabase
              .from('inventory')
              .update({
                quantity: Math.max(0, (curInv.quantity || 0) - delQty),
                updated_at: new Date().toISOString(),
              })
              .eq('id', curInv.id);
          }

          await supabase.from('inventory_movements').insert([
            {
              branch_id: targetBranchId,
              product_id: pId,
              type: 'adjustment_out',
              quantity: delQty,
              reference_id: editingPurchase.id,
              description: `Purchase Bill Edited [${editingPurchase.invoice_number || editingPurchase.id.substring(0, 8)}]: Item removed, Qty reduced by -${delQty}`,
              created_by: userProfile.id,
            },
          ]);
        }

        await supabase.from('purchase_items').delete().eq('id', delIt.id);
      }

      // B. Process Existing Updated Items (Uses UPDATE - avoids triggering INSERT stock double-count)
      for (const upIt of existingItemsToUpdate) {
        const dbMatch = currentDbItems.find((d) => d.id === upIt.id);
        const oldQ = parseFloat(dbMatch?.quantity) || 0;
        const newQ = parseFloat(upIt.quantity) || 0;
        const pId = upIt.productId || dbMatch?.product_id;
        const unitPrice = parseFloat(upIt.costPrice) || 0;
        const diff = newQ - oldQ;

        // Update purchase_items table row directly
        const { error: upErr } = await supabase
          .from('purchase_items')
          .update({
            product_id: isFactoryPurchase ? null : (pId || null),
            item_name: upIt.name?.trim() || 'Custom Item',
            quantity: newQ,
            unit_price: unitPrice,
            total_price: newQ * unitPrice,
          })
          .eq('id', upIt.id);

        if (upErr) throw upErr;

        // Adjust inventory only if quantity changed for branch purchases
        if (!isFactoryPurchase && targetBranchId && pId && diff !== 0) {
          const { data: curInv } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('branch_id', targetBranchId)
            .eq('product_id', pId)
            .maybeSingle();

          if (curInv) {
            await supabase
              .from('inventory')
              .update({
                quantity: Math.max(0, (curInv.quantity || 0) + diff),
                updated_at: new Date().toISOString(),
              })
              .eq('id', curInv.id);
          } else if (diff > 0) {
            await supabase.from('inventory').insert([
              {
                branch_id: targetBranchId,
                product_id: pId,
                quantity: diff,
                updated_at: new Date().toISOString(),
              },
            ]);
          }

          await supabase.from('inventory_movements').insert([
            {
              branch_id: targetBranchId,
              product_id: pId,
              type: diff > 0 ? 'purchase' : 'adjustment_out',
              quantity: Math.abs(diff),
              reference_id: editingPurchase.id,
              description: `Purchase Bill Edited [${editingPurchase.invoice_number || editingPurchase.id.substring(0, 8)}]: Qty adjusted by ${diff > 0 ? '+' : ''}${diff}`,
              created_by: userProfile.id,
            },
          ]);
        }
      }

      // C. Process Brand New Items (INSERT fires DB trigger which automatically adds to inventory)
      if (newItemsToInsert.length > 0) {
        const resolvedNewItems = newItemsToInsert.map((it) => {
          const qty = parseFloat(it.quantity) || 1;
          const price = parseFloat(it.costPrice) || 0;
          return {
            purchase_id: editingPurchase.id,
            product_id: isFactoryPurchase ? null : (it.productId || null),
            item_name: it.name?.trim() || 'Custom Item',
            quantity: qty,
            unit_price: price,
            total_price: qty * price,
          };
        });

        const { error: newItemsErr } = await supabase.from('purchase_items').insert(resolvedNewItems);
        if (newItemsErr) throw newItemsErr;
      }

      showMessage('Purchase bill updated successfully!', 'success');
      setShowEditPurchaseModal(false);
      setEditingPurchase(null);
      fetchPurchases();
      fetchCatalogProducts();
    } catch (err) {
      console.error('Error saving purchase edit:', err);
      showMessage(err.message || 'Failed to update purchase.', 'error');
    } finally {
      setSavingEdit(false);
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
            setPurchaseItems([{ productId: '', code: '', name: '', quantity: 1, costPrice: 0.00 }]);
            setSupplierType('existing');
            setSelectedSupplierId('');
            setIsFactoryChallan(false);
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
            <div style={{ position: 'relative', width: '320px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-control"
                style={{ paddingLeft: '2.25rem', padding: '0.35rem 0.6rem 0.35rem 2.25rem', fontSize: '0.82rem' }}
                placeholder="Search by invoice #, supplier, phone..."
                value={purchaseSearchQuery}
                onChange={(e) => {
                  setPurchaseSearchQuery(e.target.value);
                  setPurchasesPage(1);
                }}
              />
            </div>
          </div>
          {/* Desktop Table View */}
          <div className="table-container hide-on-mobile" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>SL</th>
                  <th>Purchase ID</th>
                  {userProfile?.role === 'owner' && <th>Branch</th>}
                  <th>Date</th>
                  <th>Supplier</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>Total Qty</th>
                  <th>Total Bill</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoading colSpan={userProfile?.role === 'owner' ? 10 : 9} message="Fetching purchase records..." />
                ) : purchases.length === 0 ? (
                  <tr>
                    <td colSpan={userProfile?.role === 'owner' ? 10 : 9} style={{ textAlign: 'center', padding: '2rem' }}>
                      {purchaseSearchQuery.trim() ? `No purchases found matching "${purchaseSearchQuery}".` : 'No purchases logged. Click "New Purchase" to add items to stock.'}
                    </td>
                  </tr>
                ) : (
                  purchases.map((p, index) => {
                    const rowNumber = (purchasesPage - 1) * purchasesPageSize + index + 1;
                    const factorySup = getFactorySupplier();
                    const isChallan = Boolean(
                      p.is_factory_challan || 
                      p.supplier_id === factorySup?.id || 
                      p.contacts?.name?.toLowerCase().includes('factory') ||
                      p.contacts?.name === 'Chittagong Factory'
                    );
                    const totalQty = (p.purchase_items || []).reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);

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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <span>{p.contacts?.name || 'Unknown Supplier'}</span>
                            {isChallan && (
                              <span
                                style={{
                                  backgroundColor: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                }}
                              >
                                🏭 Factory Challan
                              </span>
                            )}
                          </div>
                          {p.contacts?.phone && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{p.contacts.phone}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#0369a1' }}>
                          {totalQty}
                        </td>
                        <td style={{ fontFamily: 'Outfit, sans-serif' }}>৳{formatAmount(p.net_amount)}</td>
                        <td style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--success-text)' }}>
                          ৳{formatAmount(p.paid_amount)}
                        </td>
                        <td>
                          <span className={`badge badge-${p.payment_status}`}>{p.payment_status}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm btn-icon"
                              onClick={() => handleViewPurchaseDetails(p)}
                              title="View Purchase Breakdown"
                              style={{ color: '#0284c7', padding: '0.35rem 0.45rem' }}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              className="btn btn-secondary btn-sm btn-icon"
                              onClick={() => handleOpenEditPurchase(p)}
                              title="Edit Purchase Bill"
                              style={{ color: '#059669', padding: '0.35rem 0.45rem' }}
                            >
                              <Edit size={15} />
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

          {/* Mobile Card View (No Horizontal Scroll Required) */}
          <div className="hide-on-desktop" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Fetching purchase records...
              </div>
            ) : purchases.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                {purchaseSearchQuery.trim() ? `No purchases found matching "${purchaseSearchQuery}".` : 'No purchases logged. Tap "New Purchase" to add items to stock.'}
              </div>
            ) : (
              purchases.map((p, index) => {
                const rowNumber = (purchasesPage - 1) * purchasesPageSize + index + 1;
                const factorySup = getFactorySupplier();
                const isChallan = Boolean(
                  p.is_factory_challan || 
                  p.supplier_id === factorySup?.id || 
                  p.contacts?.name?.toLowerCase().includes('factory') ||
                  p.contacts?.name === 'Chittagong Factory'
                );
                const branchName = branches.find((b) => b.id === p.branch_id)?.name;
                const totalQty = (p.purchase_items || []).reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);

                return (
                  <div
                    key={p.id}
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
                    {/* Header: SL Badge, Purchase ID, Factory Challan Badge, Status */}
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
                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {p.invoice_number || `PUR#${p.id.substring(0, 8).toUpperCase()}`}
                        </span>
                        {isChallan && (
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
                            🏭 Factory Challan
                          </span>
                        )}
                      </div>
                      <span className={`badge badge-${p.payment_status}`} style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                        {p.payment_status}
                      </span>
                    </div>

                    {/* Body Info: Supplier, Phone, Date, Branch */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                          {p.contacts?.name || 'Unknown Supplier'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(p.purchase_date).toLocaleDateString()}
                        </span>
                      </div>
                      {p.contacts?.phone && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          📞 {p.contacts.phone}
                        </div>
                      )}
                      {userProfile?.role === 'owner' && branchName && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          🏪 Branch: {branchName}
                        </div>
                      )}
                    </div>

                    {/* Financials & Qty Strip */}
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
                        <span style={{ fontWeight: 800, color: '#0369a1', fontSize: '0.92rem' }}>
                          {totalQty}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Total Bill</span>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                          ৳{formatAmount(p.net_amount)}
                        </span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Paid</span>
                        <span style={{ fontWeight: 700, color: 'var(--success-text)', fontSize: '0.92rem' }}>
                          ৳{formatAmount(p.paid_amount)}
                        </span>
                      </div>
                      {p.net_amount - p.paid_amount > 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: 'var(--danger-text)', fontSize: '0.7rem', display: 'block' }}>Due</span>
                          <span style={{ fontWeight: 700, color: 'var(--danger-text)', fontSize: '0.92rem' }}>
                            ৳{formatAmount(p.net_amount - p.paid_amount)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions Bar */}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.15rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleViewPurchaseDetails(p)}
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
                        <Eye size={14} />
                        <span>View Details</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEditPurchase(p)}
                        style={{
                          flex: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          height: '34px',
                          fontSize: '0.8rem',
                          color: '#059669',
                          borderColor: '#a7f3d0',
                          backgroundColor: '#ecfdf5',
                        }}
                      >
                        <Edit size={14} />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <Pagination
            currentPage={purchasesPage}
            totalCount={purchasesTotalCount}
            pageSize={purchasesPageSize}
            onPageChange={setPurchasesPage}
            onPageSizeChange={setPurchasesPageSize}
          />
        </div>

      {/* RECORD NEW PURCHASE MODAL (COMPACT & SLEEK) */}
      {showPurchaseModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-xl" style={{ maxWidth: '1060px', width: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '0.65rem 1.15rem' }}>
              <h3 className="modal-title" style={{ fontSize: '1.05rem', margin: 0 }}>New Purchase</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPurchaseModal(false)}
                style={{ borderRadius: '50%', padding: '0.3rem 0.45rem', border: 'none' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePurchase} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body purchase-form-grid" style={{ flex: 1, overflowY: 'auto' }}>
                {/* Left Column: Supplier & Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
                  
                  {/* Supplier & Date Bar */}
                  <div className="purchase-supplier-bar">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Supplier Information
                      </span>
                      {!isFactory && (
                        <label style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          userSelect: 'none',
                          backgroundColor: isFactoryChallan ? '#eff6ff' : '#ffffff',
                          border: isFactoryChallan ? '1.5px solid #3b82f6' : '1px solid var(--border-color)',
                          color: isFactoryChallan ? '#1d4ed8' : 'var(--text-primary)',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '6px',
                          transition: 'all 0.15s ease',
                        }}>
                          <input
                            type="checkbox"
                            checked={isFactoryChallan}
                            onChange={(e) => handleToggleFactoryChallan(e.target.checked)}
                            style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#2563eb' }}
                          />
                          <span>🏭 Is Factory Challan</span>
                        </label>
                      )}
                    </div>
                    {supplierType === 'existing' ? (
                      <div className="purchase-supplier-grid">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Supplier Type</label>
                          <select
                            className="input-control"
                            value={supplierType}
                            onChange={(e) => setSupplierType(e.target.value)}
                            disabled={!isFactory && isFactoryChallan}
                            style={{
                              height: '36px',
                              minHeight: '36px',
                              fontSize: '0.85rem',
                              backgroundColor: (!isFactory && isFactoryChallan) ? '#f1f5f9' : '#ffffff',
                              cursor: (!isFactory && isFactoryChallan) ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <option value="existing">Existing</option>
                            <option value="new">New</option>
                          </select>
                        </div>

                        <div className="form-group supplier-select-cell" style={{ marginBottom: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Supplier *</label>
                            {(!isFactory && isFactoryChallan) && (
                              <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 700 }}>
                                🔒 Locked to Factory
                              </span>
                            )}
                          </div>
                          <SearchableSelect
                            value={
                              selectedSupplierId
                                ? {
                                    value: selectedSupplierId,
                                    label: `${suppliers.find((s) => s.id === selectedSupplierId)?.name || 'Supplier'} ${suppliers.find((s) => s.id === selectedSupplierId)?.phone ? `(${suppliers.find((s) => s.id === selectedSupplierId)?.phone})` : ''}`,
                                  }
                                : null
                            }
                            options={suppliers.map((s) => ({
                              value: s.id,
                              label: `${s.name} ${s.phone ? `(${s.phone})` : ''}`,
                            }))}
                            onChange={(opt) => setSelectedSupplierId(opt ? opt.value : '')}
                            placeholder="-- Select Supplier --"
                            isDisabled={!isFactory && isFactoryChallan}
                            isClearable
                            styles={{
                              control: (base) => ({
                                ...base,
                                minHeight: '36px',
                                height: '36px',
                                fontSize: '0.85rem',
                                backgroundColor: (!isFactory && isFactoryChallan) ? '#eff6ff' : '#ffffff',
                                borderColor: (!isFactory && isFactoryChallan) ? '#93c5fd' : '#cbd5e1',
                              }),
                            }}
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Purchase Date *</label>
                          <input
                            type="date"
                            className="input-control"
                            value={purchaseDate}
                            onChange={(e) => setPurchaseDate(e.target.value)}
                            required
                            style={{ height: '36px', minHeight: '36px', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {/* Top row: Type and Date */}
                        <div className="purchase-supplier-grid-new">
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Supplier Type</label>
                            <select
                              className="input-control"
                              value={supplierType}
                              onChange={(e) => setSupplierType(e.target.value)}
                              style={{ height: '36px', minHeight: '36px', fontSize: '0.85rem' }}
                            >
                              <option value="existing">Existing</option>
                              <option value="new">New</option>
                            </select>
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Purchase Date *</label>
                            <input
                              type="date"
                              className="input-control"
                              value={purchaseDate}
                              onChange={(e) => setPurchaseDate(e.target.value)}
                              required
                              style={{ height: '36px', minHeight: '36px', fontSize: '0.85rem' }}
                            />
                          </div>
                        </div>

                        {/* Large Name and Phone row */}
                        <div className="purchase-supplier-new-details">
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Supplier Name *</label>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="Enter supplier name"
                              value={newSupName}
                              onChange={(e) => setNewSupName(e.target.value)}
                              required={supplierType === 'new'}
                              style={{ height: '38px', minHeight: '38px', fontSize: '0.88rem', padding: '0.35rem 0.65rem' }}
                            />
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Phone Number *</label>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="Enter phone number"
                              value={newSupPhone}
                              onChange={(e) => setNewSupPhone(e.target.value)}
                              required={supplierType === 'new'}
                              style={{ height: '38px', minHeight: '38px', fontSize: '0.88rem', padding: '0.35rem 0.65rem' }}
                            />
                          </div>
                        </div>

                        {/* Address row */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Address</label>
                          <input
                            type="text"
                            className="input-control"
                            placeholder="Enter supplier address (optional)"
                            value={newSupAddress}
                            onChange={(e) => setNewSupAddress(e.target.value)}
                            style={{ height: '36px', minHeight: '36px', fontSize: '0.84rem' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Search Product Bar */}
                  <div>
                    <SearchableSelect
                      options={catalogProducts.map((prod) => {
                        const bPrice = prod.branch_prices?.[selectedBranchId]?.purchase_price;
                        const effectiveCost = (bPrice !== null && bPrice !== undefined) ? bPrice : prod.purchase_price;
                        return {
                          value: prod.id,
                          label: prod.name,
                          code: prod.product_code || prod.sku || '',
                          costPrice: effectiveCost,
                          product: prod,
                        };
                      })}
                      value={null}
                      onChange={(opt) => {
                        if (!opt) return;
                        const prod = opt.product;
                        const effectiveCost = opt.costPrice;
                        if (purchaseItems.length === 1 && !purchaseItems[0].productId && !purchaseItems[0].name && !purchaseItems[0].code) {
                          updateItemRow(0, { productId: prod.id, code: prod.product_code || prod.sku || '', name: prod.name, quantity: 1, costPrice: effectiveCost });
                        } else {
                          setPurchaseItems((prev) => [...prev, { productId: prod.id, code: prod.product_code || prod.sku || '', name: prod.name, quantity: 1, costPrice: effectiveCost }]);
                        }
                        showMessage(`${prod.name} added to list.`, 'success');
                      }}
                      placeholder="🔍 Search & add product from catalog to list..."
                      isClearable={false}
                      formatOptionLabel={(opt) => (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600 }}>{opt.label}</span>
                          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            {opt.code ? `Code: ${opt.code} | ` : ''}৳{formatAmount(opt.costPrice || 0)}
                          </span>
                        </div>
                      )}
                      styles={{
                        control: (base) => ({
                          ...base,
                          minHeight: '38px',
                          height: '38px',
                          fontSize: '0.85rem',
                        }),
                      }}
                    />
                  </div>

                  {/* Desktop Items Table */}
                  <div ref={purchaseTableContainerRef} className="hide-on-mobile table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '450px', overflowY: 'auto', width: '100%' }}>
                    <table style={{ width: '100%', minWidth: '640px', fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '35px', padding: '0.35rem 0.4rem', textAlign: 'center' }}>SL</th>
                          <th style={{ width: '120px', padding: '0.35rem 0.4rem' }}>Code</th>
                          <th style={{ padding: '0.35rem 0.4rem', minWidth: '200px' }}>Product Name *</th>
                          <th style={{ width: '70px', textAlign: 'right', padding: '0.35rem 0.4rem' }}>Qty *</th>
                          <th style={{ width: '90px', textAlign: 'right', padding: '0.35rem 0.4rem' }}>Cost *</th>
                          <th style={{ width: '85px', textAlign: 'right', padding: '0.35rem 0.4rem' }}>Total</th>
                          <th style={{ width: '38px', textAlign: 'center', padding: '0.35rem 0.3rem' }}>Del</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseItems.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ verticalAlign: 'middle', fontWeight: 600, padding: '0.3rem 0.4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                              {idx + 1}
                            </td>
                            <td style={{ verticalAlign: 'middle', padding: '0.3rem 0.3rem' }}>
                              <input
                                type="text"
                                className="input-control"
                                placeholder="Code (opt)"
                                value={item.code || ''}
                                readOnly={Boolean(item.productId)}
                                onChange={(e) => {
                                  if (item.productId) return;
                                  const val = e.target.value;
                                  const matched = catalogProducts.find(
                                    (p) => p.sku?.toLowerCase() === val.toLowerCase() || p.product_code?.toLowerCase() === val.toLowerCase()
                                  );
                                  if (matched) {
                                    const bPrice = matched.branch_prices?.[selectedBranchId]?.purchase_price;
                                    const effectiveCost = (bPrice !== null && bPrice !== undefined) ? bPrice : matched.purchase_price;
                                    updateItemRow(idx, { productId: matched.id, code: matched.sku || matched.product_code || val, name: matched.name, costPrice: effectiveCost });
                                  } else {
                                    updateItemField(idx, 'code', val);
                                  }
                                }}
                                style={{
                                  height: '30px',
                                  minHeight: '30px',
                                  width: '100%',
                                  padding: '0.15rem 0.35rem',
                                  fontSize: '0.8rem',
                                  fontFamily: 'monospace',
                                  backgroundColor: item.productId ? '#f1f5f9' : '#ffffff',
                                  cursor: item.productId ? 'not-allowed' : 'text',
                                  color: item.productId ? 'var(--text-secondary)' : 'inherit',
                                }}
                                title={item.productId ? `Catalog code (locked): ${item.code}` : 'Enter custom product code'}
                              />
                            </td>
                            <td style={{ verticalAlign: 'middle', padding: '0.3rem 0.3rem' }}>
                              <SearchableCreatableSelect
                                value={
                                  item.productId
                                    ? { value: item.productId, label: item.name, code: item.code, costPrice: item.costPrice }
                                    : item.name
                                    ? { value: item.name, label: item.name, isNew: true, code: item.code, costPrice: item.costPrice }
                                    : null
                                }
                                options={catalogProducts.map((p) => {
                                  const bPrice = p.branch_prices?.[selectedBranchId]?.purchase_price;
                                  const effectiveCost = (bPrice !== null && bPrice !== undefined) ? bPrice : p.purchase_price;
                                  return {
                                    value: p.id,
                                    label: p.name,
                                    code: p.product_code || p.sku || '',
                                    costPrice: effectiveCost,
                                  };
                                })}
                                onChange={(opt) => {
                                  if (!opt) {
                                    updateItemRow(idx, { productId: '', code: '', name: '', costPrice: 0 });
                                    return;
                                  }
                                  if (opt.__isNew__ || opt.isNew) {
                                    updateItemRow(idx, {
                                      productId: '',
                                      name: opt.label || opt.value,
                                      code: item.code || opt.label || opt.value,
                                      costPrice: item.costPrice || 0,
                                    });
                                  } else {
                                    updateItemRow(idx, {
                                      productId: opt.value,
                                      name: opt.label,
                                      code: opt.code || '',
                                      costPrice: opt.costPrice || 0,
                                    });
                                  }
                                }}
                                formatOptionLabel={(opt) => (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                    <span style={{ fontWeight: 600 }}>{opt.label}</span>
                                    {opt.costPrice !== undefined && (
                                      <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                        {opt.code ? `Code: ${opt.code} | ` : ''}৳{formatAmount(opt.costPrice || 0)}
                                      </span>
                                    )}
                                  </div>
                                )}
                                placeholder="Type or select product..."
                                isClearable
                                styles={{
                                  control: (base) => ({
                                    ...base,
                                    minHeight: '32px',
                                    height: '32px',
                                    fontSize: '0.82rem',
                                  }),
                                }}
                              />
                            </td>
                            <td style={{ verticalAlign: 'middle', textAlign: 'right', padding: '0.3rem 0.3rem' }}>
                              <input
                                type="number"
                                min="1"
                                placeholder="Qty"
                                className="input-control"
                                value={item.quantity}
                                onChange={(e) => updateItemField(idx, 'quantity', parseInt(e.target.value) || 1)}
                                required
                                style={{ height: '30px', minHeight: '30px', padding: '0.15rem 0.3rem', fontSize: '0.8rem', textAlign: 'right', width: '100%' }}
                              />
                            </td>
                            <td style={{ verticalAlign: 'middle', textAlign: 'right', padding: '0.3rem 0.3rem' }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Cost"
                                className="input-control"
                                value={item.costPrice}
                                onChange={(e) => updateItemField(idx, 'costPrice', parseFloat(e.target.value) || 0.00)}
                                required
                                style={{ height: '30px', minHeight: '30px', padding: '0.15rem 0.3rem', fontSize: '0.8rem', textAlign: 'right', width: '100%' }}
                              />
                            </td>
                            <td style={{ verticalAlign: 'middle', textAlign: 'right', fontWeight: 700, padding: '0.3rem 0.4rem', whiteSpace: 'nowrap' }}>
                              ৳{formatAmount((parseFloat(item.costPrice) || 0) * (parseInt(item.quantity) || 0))}
                            </td>
                            <td style={{ verticalAlign: 'middle', textAlign: 'center', padding: '0.3rem 0.2rem' }}>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm btn-icon"
                                style={{ border: 'none', background: 'none', color: 'var(--danger)', display: 'inline-flex', padding: '0.2rem' }}
                                onClick={() => removeItemFromPurchase(idx)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Items Card View */}
                  <div className="hide-on-desktop mobile-card-list">
                    {purchaseItems.map((item, idx) => (
                      <div key={idx} className="mobile-item-card">
                        <div className="mobile-card-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0284c7' }}>#{idx + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <SearchableCreatableSelect
                                value={
                                  item.productId
                                    ? { value: item.productId, label: item.name, code: item.code, costPrice: item.costPrice }
                                    : item.name
                                    ? { value: item.name, label: item.name, isNew: true, code: item.code, costPrice: item.costPrice }
                                    : null
                                }
                                options={catalogProducts.map((p) => {
                                  const bPrice = p.branch_prices?.[selectedBranchId]?.purchase_price;
                                  const effectiveCost = (bPrice !== null && bPrice !== undefined) ? bPrice : p.purchase_price;
                                  return {
                                    value: p.id,
                                    label: p.name,
                                    code: p.product_code || p.sku || '',
                                    costPrice: effectiveCost,
                                  };
                                })}
                                onChange={(opt) => {
                                  if (!opt) {
                                    updateItemRow(idx, { productId: '', code: '', name: '', costPrice: 0 });
                                    return;
                                  }
                                  if (opt.__isNew__ || opt.isNew) {
                                    updateItemRow(idx, {
                                      productId: '',
                                      name: opt.label || opt.value,
                                      code: item.code || opt.label || opt.value,
                                      costPrice: item.costPrice || 0,
                                    });
                                  } else {
                                    updateItemRow(idx, {
                                      productId: opt.value,
                                      name: opt.label,
                                      code: opt.code || '',
                                      costPrice: opt.costPrice || 0,
                                    });
                                  }
                                }}
                                formatOptionLabel={(opt) => (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                    <span style={{ fontWeight: 600 }}>{opt.label}</span>
                                    {opt.costPrice !== undefined && (
                                      <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                        {opt.code ? `Code: ${opt.code} | ` : ''}৳{formatAmount(opt.costPrice || 0)}
                                      </span>
                                    )}
                                  </div>
                                )}
                                placeholder="Type or select product..."
                                isClearable
                                styles={{
                                  control: (base) => ({
                                    ...base,
                                    minHeight: '36px',
                                    height: '36px',
                                    fontSize: '0.85rem',
                                  }),
                                }}
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm btn-icon"
                            style={{ border: 'none', background: '#fee2e2', color: 'var(--danger)', display: 'inline-flex', padding: '0.35rem', borderRadius: '6px', minWidth: '32px', height: '32px', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => removeItemFromPurchase(idx)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        <div className="mobile-card-row-2">
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="mobile-card-label">Code (Optional)</label>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="Code (optional)"
                              value={item.code || ''}
                              readOnly={Boolean(item.productId)}
                              onChange={(e) => {
                                if (item.productId) return;
                                const val = e.target.value;
                                const matched = catalogProducts.find(
                                  (p) => p.sku?.toLowerCase() === val.toLowerCase() || p.product_code?.toLowerCase() === val.toLowerCase()
                                );
                                if (matched) {
                                  const bPrice = matched.branch_prices?.[selectedBranchId]?.purchase_price;
                                  const effectiveCost = (bPrice !== null && bPrice !== undefined) ? bPrice : matched.purchase_price;
                                  updateItemRow(idx, { productId: matched.id, code: matched.sku || matched.product_code || val, name: matched.name, costPrice: effectiveCost });
                                } else {
                                  updateItemField(idx, 'code', val);
                                }
                              }}
                              style={{
                                height: '34px',
                                minHeight: '34px',
                                width: '100%',
                                fontSize: '0.84rem',
                                fontFamily: 'monospace',
                                backgroundColor: item.productId ? '#f1f5f9' : '#ffffff',
                              }}
                            />
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="mobile-card-label">Quantity *</label>
                            <input
                              type="number"
                              min="1"
                              placeholder="Qty"
                              className="input-control"
                              value={item.quantity}
                              onChange={(e) => updateItemField(idx, 'quantity', parseInt(e.target.value) || 1)}
                              required
                              style={{ height: '34px', minHeight: '34px', fontSize: '0.88rem', textAlign: 'center', fontWeight: 700 }}
                            />
                          </div>
                        </div>

                        <div className="mobile-card-row-pricing">
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="mobile-card-label">Unit Cost (৳) *</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="input-control"
                              value={item.costPrice}
                              onChange={(e) => updateItemField(idx, 'costPrice', parseFloat(e.target.value) || 0.00)}
                              required
                              style={{ height: '34px', minHeight: '34px', fontSize: '0.88rem', textAlign: 'right', fontWeight: 600 }}
                            />
                          </div>
                          <div></div>
                          <div className="mobile-card-total-display">
                            <span className="mobile-card-label">Total Cost</span>
                            <span className="mobile-card-total-value">
                              ৳{formatAmount((parseFloat(item.costPrice) || 0) * (parseInt(item.quantity) || 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Add Row Bar (Right aligned blue plus button) */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={addItemToPurchase}
                      title="Add New Product Row"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '32px',
                        minWidth: '38px',
                        padding: '0 0.65rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
                      }}
                    >
                      <Plus size={18} strokeWidth={2.6} />
                    </button>
                  </div>
                  <div ref={purchaseItemsEndRef} />
                </div>

                {/* Right Column: Bill Summary & Payment Settlement */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: '#f8fafc', padding: '0.9rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.45rem' }}>
                    Payment Summary
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Quantity:</span>
                    <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{getTotalQuantity()}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                    <strong>৳{formatAmount(getSubtotal())}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Discount:</span>
                    <input
                      type="number"
                      min="0"
                      className="input-control"
                      style={{ width: '110px', height: '34px', minHeight: '34px', padding: '0.2rem 0.5rem', textAlign: 'right', fontSize: '0.86rem' }}
                      value={discount}
                      onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: '1.05rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', color: 'var(--primary)' }}>
                    <span>Net Total:</span>
                    <span>৳{formatAmount(getGrandTotal())}</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0, marginTop: '0.2rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Paid Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={getGrandTotal()}
                      className="input-control"
                      placeholder="0.00"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      style={{ height: '36px', minHeight: '36px', fontSize: '0.9rem', padding: '0.3rem 0.6rem', fontWeight: 700 }}
                    />
                  </div>

                  {parseFloat(paidAmount) > 0 && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Payment Method</label>
                      <select
                        className="input-control"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        style={{ height: '36px', minHeight: '36px', fontSize: '0.88rem', padding: '0.3rem 0.6rem' }}
                      >
                        <option value="cash">Cash</option>
                        <option value="bank">Bank</option>
                        <option value="mobile_banking">Mobile Banking (bKash/Nagad)</option>
                      </select>
                    </div>
                  )}

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Reference No</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Check # or Trx ID (optional)"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      style={{ height: '36px', minHeight: '36px', fontSize: '0.88rem', padding: '0.3rem 0.6rem' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Notes / Challan No</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Notes or challan (optional)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      style={{ height: '36px', minHeight: '36px', fontSize: '0.88rem', padding: '0.3rem 0.6rem' }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '0.75rem 1.15rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: '#f8fafc' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPurchaseModal(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={loading}
                  style={{ fontWeight: 700 }}
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
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="modal-title" style={{ margin: 0 }}>
                  Purchase Invoice: {selectedPurchase.invoice_number || `PUR#${selectedPurchase.id.substring(0, 8).toUpperCase()}`}
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const purchaseToEdit = selectedPurchase;
                      setShowDetailModal(false);
                      setSelectedPurchase(null);
                      setSelectedPurchaseItems([]);
                      setSelectedPurchasePayments([]);
                      handleOpenEditPurchase(purchaseToEdit);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                  >
                    <Edit size={14} /> Edit Bill
                  </button>
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
                            ৳{formatAmount(selectedPurchase.net_amount - selectedPurchase.paid_amount)}
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
                                  <span style={{ fontWeight: 600 }}>{item.products?.name || item.item_name || 'Custom Item'}</span>
                                </td>
                                <td>
                                  <span style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{item.products?.sku || '—'}</span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {item.quantity} {item.products?.unit || 'pcs'}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  ৳{formatAmount(item.unit_price)}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  ৳{formatAmount(item.total_price)}
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
                            <span>৳{formatAmount(selectedPurchase.total_amount)}</span>
                          </div>
                          {selectedPurchase.discount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger-text)', fontSize: '0.9rem' }}>
                              <span>Discount:</span>
                              <span>-৳{formatAmount(selectedPurchase.discount)}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                            <span>Net Total:</span>
                            <span>৳{formatAmount(selectedPurchase.net_amount)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-text)', fontSize: '0.9rem' }}>
                            <span>Paid Amount:</span>
                            <span>৳{formatAmount(selectedPurchase.paid_amount)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: selectedPurchase.net_amount - selectedPurchase.paid_amount > 0 ? 'var(--danger-text)' : 'inherit', fontSize: '0.9rem' }}>
                            <span>Due Amount:</span>
                            <span>৳{formatAmount(selectedPurchase.net_amount - selectedPurchase.paid_amount)}</span>
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
                                    ৳{formatAmount(pay.amount)}
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

      {/* EDIT PURCHASE MODAL */}
      {showEditPurchaseModal && editingPurchase && (
        <div className="modal-overlay">
          <div className="modal-content modal-xl" style={{ maxWidth: '1060px', width: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '0.65rem 1.15rem' }}>
              <h3 className="modal-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                Edit Purchase: {editingPurchase.invoice_number || `PUR#${editingPurchase.id.substring(0, 8).toUpperCase()}`}
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowEditPurchaseModal(false);
                  setEditingPurchase(null);
                }}
                style={{ borderRadius: '50%', padding: '0.3rem 0.45rem', border: 'none' }}
              >
                ✕
              </button>
            </div>

            {loadingEditItems ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <TableLoading message="Loading purchase items for edit..." />
              </div>
            ) : (
              <form onSubmit={handleSaveEditPurchase} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div className="modal-body purchase-form-grid" style={{ flex: 1, overflowY: 'auto' }}>
                  {/* Left Column: Supplier & Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
                    {/* Supplier & Date Bar */}
                    <div className="purchase-supplier-bar">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Supplier Information
                        </span>
                        {(() => {
                          const editBranch = branches.find((b) => b.id === editingPurchase?.branch_id);
                          const isEditBranchFactory = Boolean(editBranch?.is_factory || editBranch?.name?.toLowerCase().includes('factory'));
                          if (isEditBranchFactory) return null;
                          return (
                            <label style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              cursor: 'pointer',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              userSelect: 'none',
                              backgroundColor: editIsFactoryChallan ? '#eff6ff' : '#ffffff',
                              border: editIsFactoryChallan ? '1.5px solid #3b82f6' : '1px solid var(--border-color)',
                              color: editIsFactoryChallan ? '#1d4ed8' : 'var(--text-primary)',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '6px',
                              transition: 'all 0.15s ease',
                            }}>
                              <input
                                type="checkbox"
                                checked={editIsFactoryChallan}
                                onChange={(e) => handleToggleEditFactoryChallan(e.target.checked)}
                                style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#2563eb' }}
                              />
                              <span>🏭 Is Factory Challan</span>
                            </label>
                          );
                        })()}
                      </div>
                      {(() => {
                        const editBranch = branches.find((b) => b.id === editingPurchase?.branch_id);
                        const isEditBranchFactory = Boolean(editBranch?.is_factory || editBranch?.name?.toLowerCase().includes('factory'));
                        const isLocked = !isEditBranchFactory && editIsFactoryChallan;

                        return (
                          <div className="purchase-supplier-grid">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Supplier *</label>
                                {isLocked && (
                                  <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 700 }}>
                                    🔒 Locked to Factory
                                  </span>
                                )}
                              </div>
                              <SearchableSelect
                                value={
                                  editSupplierId
                                    ? {
                                        value: editSupplierId,
                                        label: `${suppliers.find((s) => s.id === editSupplierId)?.name || 'Supplier'} ${suppliers.find((s) => s.id === editSupplierId)?.phone ? `(${suppliers.find((s) => s.id === editSupplierId)?.phone})` : ''}`,
                                      }
                                    : null
                                }
                                options={suppliers.map((s) => ({
                                  value: s.id,
                                  label: `${s.name} ${s.phone ? `(${s.phone})` : ''}`,
                                }))}
                                onChange={(opt) => setEditSupplierId(opt ? opt.value : '')}
                                placeholder="-- Select Supplier --"
                                isDisabled={isLocked}
                                isClearable
                                styles={{
                                  control: (base) => ({
                                    ...base,
                                    minHeight: '36px',
                                    height: '36px',
                                    fontSize: '0.85rem',
                                    backgroundColor: isLocked ? '#eff6ff' : '#ffffff',
                                    borderColor: isLocked ? '#93c5fd' : '#cbd5e1',
                                  }),
                                }}
                              />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Purchase Date *</label>
                              <input
                                type="date"
                                className="input-control"
                                value={editPurchaseDate}
                                onChange={(e) => setEditPurchaseDate(e.target.value)}
                                required
                                style={{ height: '36px', minHeight: '36px', fontSize: '0.85rem' }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Search Product Bar */}
                    <div>
                      <SearchableSelect
                        options={catalogProducts.map((prod) => {
                          const bPrice = prod.branch_prices?.[editingPurchase.branch_id]?.purchase_price;
                          const effectiveCost = (bPrice !== null && bPrice !== undefined) ? bPrice : prod.purchase_price;
                          return {
                            value: prod.id,
                            label: prod.name,
                            code: prod.product_code || prod.sku || '',
                            costPrice: effectiveCost,
                            product: prod,
                          };
                        })}
                        value={null}
                        onChange={(opt) => {
                          if (!opt) return;
                          const prod = opt.product;
                          const effectiveCost = opt.costPrice;
                          if (editPurchaseItems.length === 1 && !editPurchaseItems[0].productId && !editPurchaseItems[0].name && !editPurchaseItems[0].code) {
                            updateEditItemRow(0, { productId: prod.id, code: prod.product_code || prod.sku || '', name: prod.name, quantity: 1, costPrice: effectiveCost });
                          } else {
                            setEditPurchaseItems((prev) => [...prev, { productId: prod.id, code: prod.product_code || prod.sku || '', name: prod.name, quantity: 1, costPrice: effectiveCost }]);
                          }
                          showMessage(`${prod.name} added to list.`, 'success');
                        }}
                        placeholder="🔍 Search & add product from catalog to list..."
                        isClearable={false}
                        formatOptionLabel={(opt) => (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600 }}>{opt.label}</span>
                            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                              {opt.code ? `Code: ${opt.code} | ` : ''}৳{formatAmount(opt.costPrice || 0)}
                            </span>
                          </div>
                        )}
                        styles={{
                          control: (base) => ({
                            ...base,
                            minHeight: '38px',
                            height: '38px',
                            fontSize: '0.85rem',
                          }),
                        }}
                      />
                    </div>

                    {/* Desktop Items Table */}
                    <div ref={editPurchaseTableContainerRef} className="table-container hide-on-mobile" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '420px', overflowY: 'auto', width: '100%' }}>
                      <table style={{ width: '100%', minWidth: '640px', fontSize: '0.82rem' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '35px', padding: '0.35rem 0.4rem', textAlign: 'center' }}>SL</th>
                            <th style={{ width: '120px', padding: '0.35rem 0.4rem' }}>Code</th>
                            <th style={{ padding: '0.35rem 0.4rem', minWidth: '200px' }}>Product Name *</th>
                            <th style={{ width: '70px', textAlign: 'right', padding: '0.35rem 0.4rem' }}>Qty *</th>
                            <th style={{ width: '90px', textAlign: 'right', padding: '0.35rem 0.4rem' }}>Cost *</th>
                            <th style={{ width: '85px', textAlign: 'right', padding: '0.35rem 0.4rem' }}>Total</th>
                            <th style={{ width: '38px', textAlign: 'center', padding: '0.35rem 0.3rem' }}>Del</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editPurchaseItems.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ verticalAlign: 'middle', fontWeight: 600, padding: '0.3rem 0.4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                {idx + 1}
                              </td>
                              <td style={{ verticalAlign: 'middle', padding: '0.3rem 0.3rem' }}>
                                <input
                                  type="text"
                                  className="input-control"
                                  placeholder="Code (opt)"
                                  value={item.code || ''}
                                  readOnly={Boolean(item.productId)}
                                  onChange={(e) => {
                                    if (item.productId) return;
                                    const val = e.target.value;
                                    const matched = catalogProducts.find(
                                      (p) => p.sku?.toLowerCase() === val.toLowerCase() || p.product_code?.toLowerCase() === val.toLowerCase()
                                    );
                                    if (matched) {
                                      const bPrice = matched.branch_prices?.[editingPurchase.branch_id]?.purchase_price;
                                      const effectiveCost = (bPrice !== null && bPrice !== undefined) ? bPrice : matched.purchase_price;
                                      updateEditItemRow(idx, { productId: matched.id, code: matched.sku || matched.product_code || val, name: matched.name, costPrice: effectiveCost });
                                    } else {
                                      updateEditItemField(idx, 'code', val);
                                    }
                                  }}
                                  style={{
                                    height: '30px',
                                    minHeight: '30px',
                                    width: '100%',
                                    padding: '0.15rem 0.35rem',
                                    fontSize: '0.8rem',
                                    fontFamily: 'monospace',
                                    backgroundColor: item.productId ? '#f1f5f9' : '#ffffff',
                                    cursor: item.productId ? 'not-allowed' : 'text',
                                    color: item.productId ? 'var(--text-secondary)' : 'inherit',
                                  }}
                                  title={item.productId ? `Catalog code (locked): ${item.code}` : 'Enter custom product code'}
                                />
                              </td>
                              <td style={{ verticalAlign: 'middle', padding: '0.3rem 0.3rem' }}>
                                <SearchableCreatableSelect
                                  value={
                                    item.productId
                                      ? { value: item.productId, label: item.name, code: item.code, costPrice: item.costPrice }
                                      : item.name
                                      ? { value: item.name, label: item.name, isNew: true, code: item.code, costPrice: item.costPrice }
                                      : null
                                  }
                                  options={catalogProducts.map((p) => {
                                    const bPrice = p.branch_prices?.[editingPurchase.branch_id]?.purchase_price;
                                    const effectiveCost = (bPrice !== null && bPrice !== undefined) ? bPrice : p.purchase_price;
                                    return {
                                      value: p.id,
                                      label: p.name,
                                      code: p.product_code || p.sku || '',
                                      costPrice: effectiveCost,
                                    };
                                  })}
                                  onChange={(opt) => {
                                    if (!opt) {
                                      updateEditItemRow(idx, { productId: '', code: '', name: '', costPrice: 0 });
                                      return;
                                    }
                                    if (opt.__isNew__ || opt.isNew) {
                                      updateEditItemRow(idx, {
                                        productId: '',
                                        name: opt.label || opt.value,
                                        code: item.code || opt.label || opt.value,
                                        costPrice: item.costPrice || 0,
                                      });
                                    } else {
                                      updateEditItemRow(idx, {
                                        productId: opt.value,
                                        name: opt.label,
                                        code: opt.code || '',
                                        costPrice: opt.costPrice || 0,
                                      });
                                    }
                                  }}
                                  formatOptionLabel={(opt) => (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                      <span style={{ fontWeight: 600 }}>{opt.label}</span>
                                      {opt.costPrice !== undefined && (
                                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                          {opt.code ? `Code: ${opt.code} | ` : ''}৳{formatAmount(opt.costPrice || 0)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  placeholder="Type or select product..."
                                  isClearable
                                  styles={{
                                    control: (base) => ({
                                      ...base,
                                      minHeight: '32px',
                                      height: '32px',
                                      fontSize: '0.82rem',
                                    }),
                                  }}
                                />
                              </td>
                              <td style={{ verticalAlign: 'middle', textAlign: 'right', padding: '0.3rem 0.3rem' }}>
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="Qty"
                                  className="input-control"
                                  value={item.quantity}
                                  onChange={(e) => updateEditItemField(idx, 'quantity', parseInt(e.target.value) || 1)}
                                  required
                                  style={{ height: '30px', minHeight: '30px', padding: '0.15rem 0.3rem', fontSize: '0.8rem', textAlign: 'right', width: '100%' }}
                                />
                              </td>
                              <td style={{ verticalAlign: 'middle', textAlign: 'right', padding: '0.3rem 0.3rem' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="Cost"
                                  className="input-control"
                                  value={item.costPrice}
                                  onChange={(e) => updateEditItemField(idx, 'costPrice', parseFloat(e.target.value) || 0.00)}
                                  required
                                  style={{ height: '30px', minHeight: '30px', padding: '0.15rem 0.3rem', fontSize: '0.8rem', textAlign: 'right', width: '100%' }}
                                />
                              </td>
                              <td style={{ verticalAlign: 'middle', textAlign: 'right', fontWeight: 700, padding: '0.3rem 0.4rem', whiteSpace: 'nowrap' }}>
                                ৳{formatAmount((parseFloat(item.costPrice) || 0) * (parseInt(item.quantity) || 0))}
                              </td>
                              <td style={{ verticalAlign: 'middle', textAlign: 'center', padding: '0.3rem 0.2rem' }}>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm btn-icon"
                                  style={{ border: 'none', background: 'none', color: 'var(--danger)', display: 'inline-flex', padding: '0.2rem' }}
                                  onClick={() => removeEditItemRow(idx)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Items Card View */}
                    <div className="hide-on-desktop mobile-card-list">
                      {editPurchaseItems.map((item, idx) => (
                        <div key={idx} className="mobile-item-card">
                          <div className="mobile-card-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0284c7' }}>#{idx + 1}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <SearchableCreatableSelect
                                  value={
                                    item.productId
                                      ? { value: item.productId, label: item.name, code: item.code, costPrice: item.costPrice }
                                      : item.name
                                      ? { value: item.name, label: item.name, isNew: true, code: item.code, costPrice: item.costPrice }
                                      : null
                                  }
                                  options={catalogProducts.map((p) => {
                                    const bPrice = p.branch_prices?.[editingPurchase.branch_id]?.purchase_price;
                                    const effectiveCost = (bPrice !== null && bPrice !== undefined) ? bPrice : p.purchase_price;
                                    return {
                                      value: p.id,
                                      label: p.name,
                                      code: p.product_code || p.sku || '',
                                      costPrice: effectiveCost,
                                    };
                                  })}
                                  onChange={(opt) => {
                                    if (!opt) {
                                      updateEditItemRow(idx, { productId: '', code: '', name: '', costPrice: 0 });
                                      return;
                                    }
                                    if (opt.__isNew__ || opt.isNew) {
                                      updateEditItemRow(idx, {
                                        productId: '',
                                        name: opt.label || opt.value,
                                        code: item.code || opt.label || opt.value,
                                        costPrice: item.costPrice || 0,
                                      });
                                    } else {
                                      updateEditItemRow(idx, {
                                        productId: opt.value,
                                        name: opt.label,
                                        code: opt.code || '',
                                        costPrice: opt.costPrice || 0,
                                      });
                                    }
                                  }}
                                  formatOptionLabel={(opt) => (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                      <span style={{ fontWeight: 600 }}>{opt.label}</span>
                                      {opt.costPrice !== undefined && (
                                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                          {opt.code ? `Code: ${opt.code} | ` : ''}৳{formatAmount(opt.costPrice || 0)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  placeholder="Type or select product..."
                                  isClearable
                                  styles={{
                                    control: (base) => ({
                                      ...base,
                                      minHeight: '36px',
                                      height: '36px',
                                      fontSize: '0.85rem',
                                    }),
                                  }}
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm btn-icon"
                              style={{ border: 'none', background: '#fee2e2', color: 'var(--danger)', display: 'inline-flex', padding: '0.35rem', borderRadius: '6px', minWidth: '32px', height: '32px', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => removeEditItemRow(idx)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          <div className="mobile-card-row-2">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="mobile-card-label">Code (Optional)</label>
                              <input
                                type="text"
                                className="input-control"
                                placeholder="Code (optional)"
                                value={item.code || ''}
                                readOnly={Boolean(item.productId)}
                                onChange={(e) => {
                                  if (item.productId) return;
                                  const val = e.target.value;
                                  const matched = catalogProducts.find(
                                    (p) => p.sku?.toLowerCase() === val.toLowerCase() || p.product_code?.toLowerCase() === val.toLowerCase()
                                  );
                                  if (matched) {
                                    const bPrice = matched.branch_prices?.[editingPurchase.branch_id]?.purchase_price;
                                    const effectiveCost = (bPrice !== null && bPrice !== undefined) ? bPrice : matched.purchase_price;
                                    updateEditItemRow(idx, { productId: matched.id, code: matched.sku || matched.product_code || val, name: matched.name, costPrice: effectiveCost });
                                  } else {
                                    updateEditItemField(idx, 'code', val);
                                  }
                                }}
                                style={{
                                  height: '34px',
                                  minHeight: '34px',
                                  width: '100%',
                                  fontSize: '0.84rem',
                                  fontFamily: 'monospace',
                                  backgroundColor: item.productId ? '#f1f5f9' : '#ffffff',
                                }}
                              />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="mobile-card-label">Quantity *</label>
                              <input
                                type="number"
                                min="1"
                                placeholder="Qty"
                                className="input-control"
                                value={item.quantity}
                                onChange={(e) => updateEditItemField(idx, 'quantity', parseInt(e.target.value) || 1)}
                                required
                                style={{ height: '34px', minHeight: '34px', fontSize: '0.88rem', textAlign: 'center', fontWeight: 700 }}
                              />
                            </div>
                          </div>

                          <div className="mobile-card-row-pricing">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Quantity *</label>
                              <input
                                type="number"
                                min="1"
                                className="input-control"
                                value={item.quantity}
                                onChange={(e) => updateEditItemField(idx, 'quantity', parseInt(e.target.value) || 1)}
                                required
                                style={{ height: '34px', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Unit Cost (৳) *</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input-control"
                                value={item.costPrice}
                                onChange={(e) => updateEditItemField(idx, 'costPrice', parseFloat(e.target.value) || 0.00)}
                                required
                                style={{ height: '34px', fontSize: '0.85rem', textAlign: 'right' }}
                              />
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Line Total</div>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)', marginTop: '0.2rem' }}>
                                ৳{formatAmount((parseFloat(item.costPrice) || 0) * (parseInt(item.quantity) || 0))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Bottom Add Row Bar (Right aligned blue plus button) */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={addEditItemRow}
                        title="Add New Product Row"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '32px',
                          minWidth: '38px',
                          padding: '0 0.65rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
                        }}
                      >
                        <Plus size={18} strokeWidth={2.6} />
                      </button>
                    </div>
                    <div ref={editPurchaseItemsEndRef} />
                  </div>

                  {/* Right Column: Bill Summary */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', backgroundColor: '#f8fafc', padding: '0.75rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                      Purchase Summary
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Quantity:</span>
                      <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{getEditTotalQuantity()}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                      <strong>৳{formatAmount(getEditSubtotal())}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Discount:</span>
                      <input
                        type="number"
                        min="0"
                        className="input-control"
                        style={{ width: '95px', height: '28px', minHeight: '28px', padding: '0.15rem 0.4rem', textAlign: 'right', fontSize: '0.8rem' }}
                        value={editDiscount}
                        onChange={(e) => setEditDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: '0.95rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem', color: 'var(--primary)' }}>
                      <span>Net Total:</span>
                      <span>৳{formatAmount(getEditGrandTotal())}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--success-text)', marginTop: '0.2rem' }}>
                      <span>Paid Amount:</span>
                      <strong>৳{formatAmount(editingPurchase.paid_amount || 0)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: getEditGrandTotal() - (editingPurchase.paid_amount || 0) > 0 ? 'var(--danger-text)' : 'inherit' }}>
                      <span>Remaining Due:</span>
                      <strong>৳{formatAmount(Math.max(0, getEditGrandTotal() - (editingPurchase.paid_amount || 0)))}</strong>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0, marginTop: '0.3rem' }}>
                      <label style={{ fontSize: '0.75rem' }}>Notes / Challan No</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="Notes or challan (optional)"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        style={{ height: '30px', minHeight: '30px', fontSize: '0.82rem', padding: '0.2rem 0.5rem' }}
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '0.65rem 1.15rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: '#f8fafc' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowEditPurchaseModal(false);
                      setEditingPurchase(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={savingEdit}
                    style={{ fontWeight: 700 }}
                  >
                    {savingEdit ? 'Updating...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
