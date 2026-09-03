import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Package, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Search, Plus, Eye, Edit, ArrowRightLeft, Truck, Printer, Trash2, Send, CheckCircle2 } from 'lucide-react';
import { TableLoading } from '../components/TableLoading';
import { hasPermission } from '../utils/permissions';

const BRANCH_PALETTES = [
  { headerBg: '#eef2ff', headerText: '#312e81', subHeaderBg: '#f5f7ff', cellBg: 'rgba(99, 102, 241, 0.025)', inHandBg: 'rgba(99, 102, 241, 0.07)' },
  { headerBg: '#ecfdf5', headerText: '#064e3b', subHeaderBg: '#f2fdf7', cellBg: 'rgba(16, 185, 129, 0.025)', inHandBg: 'rgba(16, 185, 129, 0.07)' },
  { headerBg: '#fffbeb', headerText: '#78350f', subHeaderBg: '#fefce8', cellBg: 'rgba(245, 158, 11, 0.025)', inHandBg: 'rgba(245, 158, 11, 0.07)' },
  { headerBg: '#faf5ff', headerText: '#581c87', subHeaderBg: '#f8f2ff', cellBg: 'rgba(168, 85, 247, 0.025)', inHandBg: 'rgba(168, 85, 247, 0.07)' },
  { headerBg: '#fff1f2', headerText: '#881337', subHeaderBg: '#fff5f6', cellBg: 'rgba(244, 63, 94, 0.025)', inHandBg: 'rgba(244, 63, 94, 0.07)' },
  { headerBg: '#f0f9ff', headerText: '#075985', subHeaderBg: '#f3faff', cellBg: 'rgba(14, 165, 233, 0.025)', inHandBg: 'rgba(14, 165, 233, 0.07)' },
];

export default function Inventory({ userProfile, branches, addToast }) {
  const [products, setProducts] = useState([]);
  const [stockLevels, setStockLevels] = useState([]);
  const [movements, setMovements] = useState([]);
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog', 'stock', 'logs'
  const [loading, setLoading] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Filtering states
  const role = userProfile?.role || 'staff';
  const myBranchId = userProfile?.branch_id;

  // Fine-grained tab & action permissions
  const canViewCatalog = hasPermission(userProfile, 'inventory.catalog_view');
  const canViewStock = hasPermission(userProfile, 'inventory.stock_view');
  const canViewTransfers = hasPermission(userProfile, 'inventory.transfer_view') || hasPermission(userProfile, 'inventory.transfer');
  const canViewLogs = hasPermission(userProfile, 'inventory.logs_view');
  const canCreateProduct = hasPermission(userProfile, 'inventory.catalog_create');
  const canTransferStock = hasPermission(userProfile, 'inventory.transfer');
  const canAdjustStock = hasPermission(userProfile, 'inventory.adjust');

  // Fallback to first permitted tab
  useEffect(() => {
    if (activeTab === 'catalog' && !canViewCatalog) {
      if (canViewStock) setActiveTab('stock');
      else if (canViewTransfers) setActiveTab('transfers');
      else if (canViewLogs) setActiveTab('logs');
    } else if (activeTab === 'stock' && !canViewStock) {
      if (canViewCatalog) setActiveTab('catalog');
      else if (canViewTransfers) setActiveTab('transfers');
      else if (canViewLogs) setActiveTab('logs');
    } else if (activeTab === 'transfers' && !canViewTransfers) {
      if (canViewCatalog) setActiveTab('catalog');
      else if (canViewStock) setActiveTab('stock');
      else if (canViewLogs) setActiveTab('logs');
    } else if (activeTab === 'logs' && !canViewLogs) {
      if (canViewCatalog) setActiveTab('catalog');
      else if (canViewStock) setActiveTab('stock');
      else if (canViewTransfers) setActiveTab('transfers');
    }
  }, [activeTab, canViewCatalog, canViewStock, canViewTransfers, canViewLogs]);

  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    if (role === 'owner') {
      return 'all';
    }
    return myBranchId || (branches.length > 0 ? branches[0].id : '');
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [movementFilter, setMovementFilter] = useState('all'); // 'all', 'transfers', 'purchases', 'sales', 'adjustments'

  // Product form states
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [description, setDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editProductId, setEditProductId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Manual stock adjustment states
  const [adjustmentProductId, setAdjustmentProductId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('adjustment_in');
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  // Inter-Branch Stock Transfer States
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFromBranch, setTransferFromBranch] = useState('');
  const [transferToBranch, setTransferToBranch] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferNotes, setTransferNotes] = useState('');
  const [transferVehicle, setTransferVehicle] = useState('');
  const [transferDriver, setTransferDriver] = useState('');
  const [transferItems, setTransferItems] = useState([
    { productId: '', quantity: 1, availableStock: 0, unit: 'pcs' },
  ]);
  const [isTransferring, setIsTransferring] = useState(false);

  // Printable Transfer Delivery Challan States
  const [activeTransferChallan, setActiveTransferChallan] = useState(null);
  const [showTransferPrint, setShowTransferPrint] = useState(false);

  // Sync initial branch selection
  useEffect(() => {
    if (!selectedBranchId) {
      if (role === 'owner') {
        setSelectedBranchId('all');
      } else {
        setSelectedBranchId(myBranchId || (branches.length > 0 ? branches[0].id : ''));
      }
    }
  }, [branches, userProfile, selectedBranchId, role, myBranchId]);

  // Global Products catalog fetched on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Branch stock levels and movements fetched when selected branch is available
  useEffect(() => {
    if (selectedBranchId) {
      fetchStockLevels();
      fetchMovements();
    }
  }, [selectedBranchId]);

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load products.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStockLevels = async () => {
    if (!selectedBranchId) return;
    setLoadingStock(true);
    try {
      let query = supabase
        .from('inventory')
        .select(`
          id,
          branch_id,
          quantity,
          min_stock_level,
          product_id,
          products (
            sku,
            name,
            category,
            unit
          ),
          branches (
            name
          )
        `);

      if (selectedBranchId !== 'all') {
        query = query.eq('branch_id', selectedBranchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStockLevels(data || []);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load branch stock levels.', 'error');
    } finally {
      setLoadingStock(false);
    }
  };

  const fetchMovements = async () => {
    if (!selectedBranchId) return;
    setLoadingMovements(true);
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
            sku,
            name
          ),
          profiles (
            full_name
          ),
          branches (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (selectedBranchId !== 'all') {
        query = query.eq('branch_id', selectedBranchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMovements(data || []);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load stock movements log.', 'error');
    } finally {
      setLoadingMovements(false);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!sku || !name || !purchasePrice || !salePrice) {
      showMessage('Please fill all required fields.', 'error');
      return;
    }

    const trimmedSku = sku.trim();
    if (!/^[a-zA-Z0-9\-_]{3,20}$/.test(trimmedSku)) {
      showMessage('SKU must be 3-20 characters long and contain only letters, numbers, hyphens, or underscores.', 'error');
      return;
    }

    const pPrice = parseFloat(purchasePrice);
    const sPrice = parseFloat(salePrice);

    if (isNaN(pPrice) || pPrice <= 0) {
      showMessage('Purchase price must be a valid positive number.', 'error');
      return;
    }
    if (isNaN(sPrice) || sPrice <= 0) {
      showMessage('Sale price must be a valid positive number.', 'error');
      return;
    }
    if (sPrice < pPrice) {
      if (!window.confirm(`Warning: The selling price (৳${sPrice.toFixed(2)}) is lower than the purchase price (৳${pPrice.toFixed(2)}). Do you want to save this product anyway?`)) {
        return;
      }
    }

    setLoading(true);
    try {
      const productData = {
        sku,
        name,
        category: category || null,
        unit,
        purchase_price: parseFloat(purchasePrice),
        sale_price: parseFloat(salePrice),
        description: description || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editProductId);

        if (error) throw error;
        showMessage(`Product "${name}" updated successfully!`, 'success');
      } else {
        const { error } = await supabase.from('products').insert([productData]);
        if (error) throw error;
        showMessage(`Product "${name}" added to catalog!`, 'success');
      }

      setSku('');
      setName('');
      setCategory('');
      setUnit('pcs');
      setPurchasePrice('');
      setSalePrice('');
      setDescription('');
      setIsEditing(false);
      setEditProductId(null);
      setShowCreateModal(false);
      fetchProducts();
      fetchStockLevels(); // refresh stock screen product options
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Error saving product.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetProductForm = () => {
    setSku('');
    setName('');
    setCategory('');
    setUnit('pcs');
    setPurchasePrice('');
    setSalePrice('');
    setDescription('');
    setIsEditing(false);
    setEditProductId(null);
  };

  const handleEditProduct = (product) => {
    setSku(product.sku);
    setName(product.name);
    setCategory(product.category || '');
    setUnit(product.unit || 'pcs');
    setPurchasePrice(product.purchase_price);
    setSalePrice(product.sale_price);
    setDescription(product.description || '');
    setIsEditing(true);
    setEditProductId(product.id);
    setShowCreateModal(true);
    setActiveTab('catalog');
  };

  const handleManualAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustmentProductId || !adjustmentQty || !adjustmentReason) {
      showMessage('Please fill all adjustment fields.', 'error');
      return;
    }

    const qty = parseInt(adjustmentQty);
    if (isNaN(qty) || qty <= 0) {
      showMessage('Adjustment quantity must be a positive integer.', 'error');
      return;
    }

    const isOut = adjustmentType === 'adjustment_out';
    if (isOut) {
      const currentStockItem = stockLevels.find(item => item.product_id === adjustmentProductId);
      const currentQty = currentStockItem ? currentStockItem.quantity : 0;
      if (qty > currentQty) {
        if (!window.confirm(`Warning: You are attempting to adjust out ${qty} units, but the current branch stock is only ${currentQty} units. This will result in a negative stock level of ${currentQty - qty} units. Do you want to proceed?`)) {
          return;
        }
      }
    }

    setLoading(true);
    try {
      const qty = parseInt(adjustmentQty);
      const isOut = adjustmentType === 'adjustment_out';
      const actualQtyChange = isOut ? -qty : qty;

      // 1. Log manual movement in inventory_movements table
      const { error: moveError } = await supabase.from('inventory_movements').insert([
        {
          branch_id: selectedBranchId,
          product_id: adjustmentProductId,
          type: adjustmentType,
          quantity: qty,
          description: `Manual adjustment: ${adjustmentReason}`,
          created_by: userProfile.id,
        },
      ]);
      if (moveError) throw moveError;

      // 2. Adjust inventory levels
      const { error: invError } = await supabase.rpc('adjust_stock', {
        p_branch_id: selectedBranchId,
        p_product_id: adjustmentProductId,
        p_qty_change: actualQtyChange,
      });

      // RPC call fallback: if adjust_stock RPC is not created, do manual upsert
      if (invError) {
        // Fetch current quantity
        const { data: currentInv } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('branch_id', selectedBranchId)
          .eq('product_id', adjustmentProductId)
          .maybeSingle();

        const currentQty = currentInv ? currentInv.quantity : 0;
        const newQty = currentQty + actualQtyChange;

        const { error: upsertError } = await supabase
          .from('inventory')
          .upsert({
            branch_id: selectedBranchId,
            product_id: adjustmentProductId,
            quantity: newQty,
            updated_at: new Date().toISOString()
          }, { onConflict: 'branch_id,product_id' });

        if (upsertError) throw upsertError;
      }

      showMessage('Stock level adjusted successfully!', 'success');
      setAdjustmentProductId('');
      setAdjustmentQty('');
      setAdjustmentReason('');
      setShowAdjustmentModal(false);
      fetchStockLevels();
      fetchMovements();
    } catch (err) {
      console.error(err);
      showMessage('Failed to complete stock adjustment.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ====================================================================
  // INTER-BRANCH STOCK TRANSFER HANDLERS
  // ====================================================================
  const getStockAtBranch = async (branchId, productId) => {
    if (!branchId || !productId) return 0;
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('branch_id', branchId)
        .eq('product_id', productId)
        .maybeSingle();

      if (error) throw error;
      return data ? data.quantity : 0;
    } catch (err) {
      console.error('Error getting branch stock:', err);
      return 0;
    }
  };

  const handleOpenTransferModal = () => {
    const fromId = selectedBranchId || (branches.length > 0 ? branches[0].id : '');
    const remainingBranches = branches.filter((b) => b.id !== fromId);
    const toId = remainingBranches.length > 0 ? remainingBranches[0].id : '';

    setTransferFromBranch(fromId);
    setTransferToBranch(toId);
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferNotes('');
    setTransferVehicle('');
    setTransferDriver('');
    setTransferItems([{ productId: '', quantity: 1, availableStock: 0, unit: 'pcs' }]);
    setShowTransferModal(true);
  };

  const handleFromBranchChange = async (newFromId) => {
    setTransferFromBranch(newFromId);
    // If toBranch is the same as newFromId, change toBranch
    if (transferToBranch === newFromId) {
      const other = branches.find((b) => b.id !== newFromId);
      setTransferToBranch(other ? other.id : '');
    }

    // Refresh available stock for all selected products
    const updated = await Promise.all(
      transferItems.map(async (it) => {
        if (!it.productId) return it;
        const stockQty = await getStockAtBranch(newFromId, it.productId);
        return {
          ...it,
          availableStock: stockQty,
          quantity: Math.min(it.quantity || 1, Math.max(1, stockQty)),
        };
      })
    );
    setTransferItems(updated);
  };

  const updateTransferItemProduct = async (index, productId) => {
    const selectedProd = products.find((p) => p.id === productId);
    let stockQty = 0;
    if (productId && transferFromBranch) {
      if (transferFromBranch === selectedBranchId) {
        const localItem = stockLevels.find((s) => s.product_id === productId);
        stockQty = localItem ? localItem.quantity : 0;
      } else {
        stockQty = await getStockAtBranch(transferFromBranch, productId);
      }
    }

    setTransferItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        productId,
        availableStock: stockQty,
        unit: selectedProd?.unit || 'pcs',
        quantity: Math.min(copy[index].quantity || 1, Math.max(1, stockQty)),
      };
      return copy;
    });
  };

  const updateTransferItemQty = (index, qty) => {
    setTransferItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        quantity: parseInt(qty) || 1,
      };
      return copy;
    });
  };

  const addTransferItemRow = () => {
    setTransferItems((prev) => [
      ...prev,
      { productId: '', quantity: 1, availableStock: 0, unit: 'pcs' },
    ]);
  };

  const removeTransferItemRow = (index) => {
    if (transferItems.length <= 1) return;
    setTransferItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleExecuteTransfer = async (e) => {
    e.preventDefault();
    if (!transferFromBranch || !transferToBranch) {
      showMessage('Please select both Source (From) and Destination (To) branches.', 'error');
      return;
    }
    if (transferFromBranch === transferToBranch) {
      showMessage('Origin and Destination branch cannot be the same.', 'error');
      return;
    }

    const validItems = transferItems.filter((item) => item.productId && item.quantity > 0);
    if (validItems.length === 0) {
      showMessage('Please select at least one item with quantity greater than zero.', 'error');
      return;
    }

    // Check stock for all items
    for (const item of validItems) {
      const prod = products.find((p) => p.id === item.productId);
      const currentStock = await getStockAtBranch(transferFromBranch, item.productId);
      if (item.quantity > currentStock) {
        showMessage(
          `Insufficient stock for "${prod?.name || 'Product'}". Available: ${currentStock} ${item.unit}, Requested: ${item.quantity} ${item.unit}.`,
          'error'
        );
        return;
      }
    }

    setIsTransferring(true);
    const fromBranchObj = branches.find((b) => b.id === transferFromBranch);
    const toBranchObj = branches.find((b) => b.id === transferToBranch);
    const challanNumber = 'TRF-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    try {
      const printItemsList = [];

      for (const item of validItems) {
        const prod = products.find((p) => p.id === item.productId);

        // 1. Source Branch Stock Update (transfer_out)
        const sourceCurrentStock = await getStockAtBranch(transferFromBranch, item.productId);
        const newSourceStock = Math.max(0, sourceCurrentStock - item.quantity);

        const { error: srcUpsertErr } = await supabase
          .from('inventory')
          .upsert({
            branch_id: transferFromBranch,
            product_id: item.productId,
            quantity: newSourceStock,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'branch_id,product_id' });
        if (srcUpsertErr) throw srcUpsertErr;

        const { error: srcMoveErr } = await supabase.from('inventory_movements').insert([
          {
            branch_id: transferFromBranch,
            product_id: item.productId,
            type: 'transfer_out',
            quantity: item.quantity,
            description: `[Challan: ${challanNumber}] Transfer to ${toBranchObj?.name || 'Branch'}. ${transferNotes ? 'Notes: ' + transferNotes : ''}`,
            created_by: userProfile.id,
          },
        ]);
        if (srcMoveErr) throw srcMoveErr;

        // 2. Destination Branch Stock Update (transfer_in)
        const destCurrentStock = await getStockAtBranch(transferToBranch, item.productId);
        const newDestStock = destCurrentStock + item.quantity;

        const { error: destUpsertErr } = await supabase
          .from('inventory')
          .upsert({
            branch_id: transferToBranch,
            product_id: item.productId,
            quantity: newDestStock,
            min_stock_level: 5,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'branch_id,product_id' });
        if (destUpsertErr) throw destUpsertErr;

        const { error: destMoveErr } = await supabase.from('inventory_movements').insert([
          {
            branch_id: transferToBranch,
            product_id: item.productId,
            type: 'transfer_in',
            quantity: item.quantity,
            description: `[Challan: ${challanNumber}] Transfer received from ${fromBranchObj?.name || 'Branch'}. ${transferNotes ? 'Notes: ' + transferNotes : ''}`,
            created_by: userProfile.id,
          },
        ]);
        if (destMoveErr) throw destMoveErr;

        printItemsList.push({
          ...prod,
          quantity: item.quantity,
          unit: item.unit || prod?.unit || 'pcs',
        });
      }

      // Build Challan Print payload
      const challanData = {
        challanNumber,
        transferDate,
        fromBranch: fromBranchObj,
        toBranch: toBranchObj,
        driverName: transferDriver,
        vehicleNumber: transferVehicle,
        notes: transferNotes,
        items: printItemsList,
        totalItems: printItemsList.length,
        totalUnits: printItemsList.reduce((sum, it) => sum + it.quantity, 0),
        createdByName: userProfile?.full_name || 'Staff User',
      };

      setActiveTransferChallan(challanData);
      setShowTransferModal(false);
      setShowTransferPrint(true);
      showMessage(`Stock Transfer Challan #${challanNumber} created & dispatched successfully!`, 'success');

      // Refresh listings
      fetchStockLevels();
      fetchMovements();
    } catch (err) {
      console.error('Transfer execution error:', err);
      showMessage('Failed to complete stock transfer: ' + (err.message || 'Database error'), 'error');
    } finally {
      setIsTransferring(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredStock = stockLevels.filter(
    (s) =>
      s.products?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.products?.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="top-bar">
        <div className="page-title-group">
          <h1>Thread Catalog & Stock</h1>
        </div>

        <div className="top-bar-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {role === 'owner' && (
            <div className="form-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ whiteSpace: 'nowrap' }}>Active Branch:</label>
              <select
                className="input-control"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                style={{ width: '220px', fontWeight: 600 }}
              >
                <option value="all">🏢 All Branches (Matrix)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {canTransferStock && branches.length > 1 && (
            <button 
              className="btn btn-secondary"
              onClick={handleOpenTransferModal}
              title="Transfer stock to another branch or factory location"
            >
              <ArrowRightLeft size={16} />
              <span>Transfer Stock</span>
            </button>
          )}
          {activeTab === 'catalog' && canCreateProduct && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                resetProductForm();
                setShowCreateModal(true);
              }}
            >
              <Plus size={16} />
              <span>Create Thread / Accessory</span>
            </button>
          )}
        </div>
      </div>



      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1rem' }}>
        {canViewCatalog && (
          <button
            className={`btn ${activeTab === 'catalog' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('catalog')}
          >
            <Package size={16} />
            <span>Item List</span>
          </button>
        )}
        {canViewStock && (
          <button
            className={`btn ${activeTab === 'stock' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('stock')}
          >
            <AlertTriangle size={16} />
            <span>Inventory Stock In Hand</span>
          </button>
        )}
        {canViewTransfers && (
          <button
            className={`btn ${activeTab === 'transfers' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('transfers')}
          >
            <ArrowRightLeft size={16} />
            <span>Stock Transfers</span>
          </button>
        )}
        {canViewLogs && (
          <button
            className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('logs')}
          >
            <RefreshCw size={16} />
            <span>Inventory Ledger Logs</span>
          </button>
        )}
      </div>

      {/* TAB CONTENT: CATALOG / ITEM LIST */}
      {activeTab === 'catalog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Item Listing Full Width */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <h3 className="card-title">Item List ({filteredProducts.length})</h3>
              <div className="catalog-search-bar" style={{ width: '250px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input-control"
                    style={{ paddingLeft: '2.2rem', paddingHeight: '34px', fontSize: '0.85rem' }}
                    placeholder="Search by SKU or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>SL</th>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Cost Price</th>
                    <th>Sale Price</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableLoading colSpan={7} message="Fetching catalog products..." />
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                        No products found. Add a product to configure pricing.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p, index) => (
                      <tr key={p.id}>
                        <td>{index + 1}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.sku}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                        <td>{p.category || 'N/A'}</td>
                        <td style={{ fontFamily: 'Outfit, sans-serif' }}>৳{p.purchase_price.toFixed(2)}</td>
                        <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: 'var(--primary)' }}>
                          ৳{p.sale_price.toFixed(2)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm btn-icon"
                              onClick={() => handleEditProduct(p)}
                              title="Edit Item"
                            >
                              <Edit size={14} />
                            </button>
                          </div>
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

      {/* CREATE / EDIT PRODUCT MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px', width: '100%' }}>
            <div className="modal-header">
              <h3 className="modal-title">{isEditing ? 'Edit Thread / Accessory Item' : 'Create Thread / Accessory'}</h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => {
                  setShowCreateModal(false);
                  resetProductForm();
                }} 
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProduct}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>SKU / Barcode *</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="TH-402-001"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      required
                      disabled={isEditing}
                    />
                  </div>
                  <div className="form-group">
                    <label>Unit of Measure *</label>
                    <select className="input-control" value={unit} onChange={(e) => setUnit(e.target.value)}>
                      <option value="cone">Cone (cone)</option>
                      <option value="carton">Carton (ctn)</option>
                      <option value="box">Box (box)</option>
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="dzn">Dozen (dzn)</option>
                      <option value="kg">Kilograms (kg)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. Spun Polyester Sewing Thread 40/2 (5000 Yds) - DTM Color"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Sewing Thread, Embroidery, Zippers, Buttons, etc."
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Default Buying Cost *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-control"
                      placeholder="0.00"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Default Selling Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-control"
                      placeholder="0.00"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="input-control"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    placeholder="e.g. Color code, ply count, material composition, count thickness (e.g., 40s/2, 20s/2)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowCreateModal(false);
                    resetProductForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {isEditing ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB CONTENT: STOCK LEVELS */}
      {activeTab === 'stock' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Current Inventory Levels</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="catalog-search-bar" style={{ width: '250px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input-control"
                    style={{ paddingLeft: '2.2rem' }}
                    placeholder="Filter products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              {canTransferStock && branches.length > 1 && (
                <button className="btn btn-secondary" onClick={handleOpenTransferModal}>
                  <ArrowRightLeft size={16} />
                  <span>Transfer Stock</span>
                </button>
              )}
              {canAdjustStock && (
                <button className="btn btn-primary" onClick={() => setShowAdjustmentModal(true)}>
                  <Plus size={16} />
                  <span>Manual Stock Adjust</span>
                </button>
              )}
            </div>
          </div>

          <div className="table-container">
            {selectedBranchId === 'all' ? (
              /* MULTI-BRANCH STOCK MATRIX (ALL BRANCHES) */
              <table className="compact-table">
                <thead>
                  <tr>
                    <th rowSpan="2" style={{ width: '35px', verticalAlign: 'middle' }}>SL</th>
                    <th rowSpan="2" style={{ width: '90px', verticalAlign: 'middle' }}>SKU</th>
                    <th rowSpan="2" style={{ verticalAlign: 'middle' }}>Product Name</th>
                    <th rowSpan="2" style={{ width: '50px', textAlign: 'center', verticalAlign: 'middle' }}>UoM</th>
                    {branches.map((b, bIdx) => {
                      const pal = BRANCH_PALETTES[bIdx % BRANCH_PALETTES.length];
                      return (
                        <th
                          key={b.id}
                          colSpan="3"
                          style={{
                            textAlign: 'center',
                            backgroundColor: pal.headerBg,
                            color: pal.headerText,
                            borderLeft: '1.5px solid var(--border-color)',
                            borderRight: '1.5px solid var(--border-color)',
                            padding: '0.4rem 0.5rem',
                          }}
                        >
                          <div style={{ fontWeight: 800, fontSize: '0.82rem' }}>{b.name}</div>
                        </th>
                      );
                    })}
                    <th rowSpan="2" style={{ textAlign: 'center', fontWeight: 800, verticalAlign: 'middle', width: '100px', backgroundColor: '#f8fafc' }}>
                      Total In Hand
                    </th>
                    <th rowSpan="2" style={{ textAlign: 'center', width: '90px', verticalAlign: 'middle' }}>
                      Status
                    </th>
                  </tr>
                  <tr>
                    {branches.map((b, bIdx) => {
                      const pal = BRANCH_PALETTES[bIdx % BRANCH_PALETTES.length];
                      return (
                        <React.Fragment key={b.id}>
                          <th style={{ textAlign: 'center', fontSize: '0.7rem', padding: '0.25rem 0.4rem', color: 'var(--success-text)', backgroundColor: pal.subHeaderBg, borderLeft: '1.5px solid var(--border-color)' }}>
                            In
                          </th>
                          <th style={{ textAlign: 'center', fontSize: '0.7rem', padding: '0.25rem 0.4rem', color: 'var(--danger-text)', backgroundColor: pal.subHeaderBg }}>
                            Out
                          </th>
                          <th style={{ textAlign: 'center', fontSize: '0.7rem', padding: '0.25rem 0.4rem', fontWeight: 800, color: pal.headerText, backgroundColor: pal.inHandBg, borderRight: '1.5px solid var(--border-color)' }}>
                            In Hand
                          </th>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {loadingStock ? (
                    <TableLoading colSpan={6 + branches.length * 3} message="Fetching multi-branch stock matrix..." />
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6 + branches.length * 3} style={{ textAlign: 'center', padding: '2rem' }}>
                        No products found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p, index) => {
                      let totalStock = 0;
                      let minStock = 5;

                      return (
                        <tr key={p.id}>
                          <td>{index + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.78rem' }}>{p.sku}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                          <td style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.unit}</td>
                          {branches.map((b, bIdx) => {
                            const pal = BRANCH_PALETTES[bIdx % BRANCH_PALETTES.length];
                            const branchInv = stockLevels.find(
                              (s) => s.product_id === p.id && s.branch_id === b.id
                            );
                            const qty = branchInv ? branchInv.quantity : 0;
                            if (branchInv?.min_stock_level) minStock = branchInv.min_stock_level;
                            totalStock += qty;

                            const branchMovements = movements.filter(
                              (m) => m.product_id === p.id && m.branch_id === b.id
                            );
                            const stockIn = branchMovements
                              .filter((m) => ['purchase', 'adjustment_in', 'transfer_in'].includes(m.type))
                              .reduce((sum, m) => sum + m.quantity, 0);
                            const stockOut = branchMovements
                              .filter((m) => ['sale', 'adjustment_out', 'transfer_out'].includes(m.type))
                              .reduce((sum, m) => sum + m.quantity, 0);

                            return (
                              <React.Fragment key={b.id}>
                                <td style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--success-text)', backgroundColor: pal.cellBg, borderLeft: '1.5px solid var(--border-color)' }}>
                                  {stockIn}
                                </td>
                                <td style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--danger-text)', backgroundColor: pal.cellBg }}>
                                  {stockOut}
                                </td>
                                <td
                                  style={{
                                    textAlign: 'center',
                                    fontWeight: 700,
                                    fontFamily: 'Outfit, sans-serif',
                                    fontSize: '0.88rem',
                                    color: qty === 0 ? 'var(--text-muted)' : qty <= 5 ? 'var(--danger-text)' : pal.headerText,
                                    backgroundColor: pal.inHandBg,
                                    borderRight: '1.5px solid var(--border-color)',
                                  }}
                                >
                                  {qty}
                                </td>
                              </React.Fragment>
                            );
                          })}
                          <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', color: totalStock <= minStock ? 'var(--danger-text)' : 'var(--primary)', backgroundColor: '#f8fafc' }}>
                            {totalStock}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {totalStock <= minStock ? (
                              <span className="badge badge-unpaid" style={{ fontSize: '0.68rem', padding: '0.15rem 0.35rem' }}>
                                <AlertTriangle size={11} />
                                <span>Low</span>
                              </span>
                            ) : (
                              <span className="badge badge-paid" style={{ fontSize: '0.68rem', padding: '0.15rem 0.35rem' }}>
                                Healthy
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              /* SINGLE BRANCH STOCK VIEW */
              <table>
                <thead>
                  <tr>
                    <th>SL</th>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th>UoM</th>
                    <th>Stock In</th>
                    <th>Stock Out</th>
                    <th>Stock In Hand</th>
                    <th>Alert Level</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingStock ? (
                    <TableLoading colSpan={9} message="Fetching branch stock levels..." />
                  ) : filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>
                        No inventory records found for this branch. Finalize a Purchase or add manual stock.
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map((s, index) => {
                      const isLow = s.quantity <= (s.min_stock_level || 5);
                      const productMovements = movements.filter(m => m.product_id === s.product_id);
                      const stockIn = productMovements
                        .filter(m => ['purchase', 'adjustment_in', 'transfer_in'].includes(m.type))
                        .reduce((sum, m) => sum + m.quantity, 0);
                      const stockOut = productMovements
                        .filter(m => ['sale', 'adjustment_out', 'transfer_out'].includes(m.type))
                        .reduce((sum, m) => sum + m.quantity, 0);
                      return (
                        <tr key={s.id}>
                          <td>{index + 1}</td>
                          <td style={{ fontFamily: 'monospace' }}>{s.products?.sku}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.products?.name}</td>
                          <td>{s.products?.unit}</td>
                          <td>{stockIn}</td>
                          <td>{stockOut}</td>
                          <td style={{ fontWeight: 700, fontSize: '1.05rem', color: isLow ? 'var(--danger-text)' : 'var(--text-primary)' }}>
                            {s.quantity}
                          </td>
                          <td>{s.min_stock_level}</td>
                          <td>
                            {isLow ? (
                              <span className="badge badge-unpaid">
                                <AlertTriangle size={12} />
                                <span>Low Stock</span>
                              </span>
                            ) : (
                              <span className="badge badge-paid">Healthy</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: STOCK TRANSFERS */}
      {activeTab === 'transfers' && (() => {
        const transferLogs = movements.filter((m) => m.type === 'transfer_in' || m.type === 'transfer_out');
        const filteredTransferLogs = transferLogs.filter((m) =>
          (m.products?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (m.products?.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (m.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (m.branches?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 className="card-title">Inter-Branch Stock Transfers</h3>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div className="catalog-search-bar" style={{ width: '240px' }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="input-control"
                      style={{ paddingLeft: '2.2rem', fontSize: '0.8rem', padding: '0.35rem 0.6rem 0.35rem 2.2rem' }}
                      placeholder="Search transfer ref or item..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                {branches.length > 1 && (
                  <button className="btn btn-primary" onClick={handleOpenTransferModal} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ArrowRightLeft size={15} />
                    <span>New Transfer</span>
                  </button>
                )}
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '35px' }}>SL</th>
                    <th style={{ width: '140px' }}>Date & Time</th>
                    <th>Location Branch</th>
                    <th>Product / Item</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Type</th>
                    <th style={{ width: '90px', textAlign: 'right' }}>Qty</th>
                    <th>Challan / Details</th>
                    <th style={{ width: '130px' }}>Logged By</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingMovements ? (
                    <TableLoading colSpan={8} message="Fetching stock transfer history..." />
                  ) : filteredTransferLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No stock transfers recorded yet.</div>
                        {branches.length > 1 && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleOpenTransferModal}
                            style={{ marginTop: '0.75rem' }}
                          >
                            <ArrowRightLeft size={13} />
                            <span>Initiate First Stock Transfer</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredTransferLogs.map((m, index) => {
                      const isTransferIn = m.type === 'transfer_in';

                      return (
                        <tr key={m.id}>
                          <td>{index + 1}</td>
                          <td style={{ fontSize: '0.82rem' }}>{new Date(m.created_at).toLocaleString()}</td>
                          <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                            {m.branches?.name || 'Main'}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            <span style={{ color: 'var(--text-primary)' }}>{m.products?.name}</span>
                            <span style={{ fontSize: '0.72rem', display: 'block', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {m.products?.sku}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isTransferIn ? (
                              <span className="badge" style={{ backgroundColor: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem' }}>
                                <ArrowRightLeft size={11} />
                                <span>Transfer In</span>
                              </span>
                            ) : (
                              <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #e9d5ff', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem' }}>
                                <ArrowRightLeft size={11} />
                                <span>Transfer Out</span>
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', color: isTransferIn ? 'var(--success-text)' : 'var(--danger-text)' }}>
                            {isTransferIn ? '+' : '-'}{m.quantity}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.description}</td>
                          <td style={{ fontSize: '0.82rem', fontWeight: 500 }}>{m.profiles?.full_name || 'System'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* TAB CONTENT: STOCK FLOW LOGS */}
      {activeTab === 'logs' && (() => {
        const filteredMovements = movements.filter((m) => {
          if (movementFilter === 'transfers') return m.type === 'transfer_in' || m.type === 'transfer_out';
          if (movementFilter === 'purchases') return m.type === 'purchase';
          if (movementFilter === 'sales') return m.type === 'sale';
          if (movementFilter === 'adjustments') return m.type === 'adjustment_in' || m.type === 'adjustment_out';
          return true;
        });

        return (
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 className="card-title">Stock In / Stock Out Ledger</h3>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Filter Activity:</span>
                <select
                  className="input-control"
                  value={movementFilter}
                  onChange={(e) => setMovementFilter(e.target.value)}
                  style={{ width: '190px', fontSize: '0.8rem', padding: '0.3rem 0.6rem', fontWeight: 600 }}
                >
                  <option value="all">All Movements ({movements.length})</option>
                  <option value="transfers">🔄 Stock Transfers ({movements.filter(m => m.type === 'transfer_in' || m.type === 'transfer_out').length})</option>
                  <option value="purchases">📦 Purchases (Stock In)</option>
                  <option value="sales">🛒 POS Sales (Stock Out)</option>
                  <option value="adjustments">⚙️ Manual Adjustments</option>
                </select>
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>SL</th>
                    <th>Timestamp</th>
                    {selectedBranchId === 'all' && <th>Branch</th>}
                    <th>Product</th>
                    <th>Movement Type</th>
                    <th>Quantity Change</th>
                    <th>Description</th>
                    <th>Logged By</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingMovements ? (
                    <TableLoading colSpan={selectedBranchId === 'all' ? 8 : 7} message="Fetching stock movements ledger..." />
                  ) : filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={selectedBranchId === 'all' ? 8 : 7} style={{ textAlign: 'center', padding: '2rem' }}>
                        No movements found matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m, index) => {
                      const isIn = ['purchase', 'adjustment_in', 'transfer_in'].includes(m.type);
                      const isTransferIn = m.type === 'transfer_in';
                      const isTransferOut = m.type === 'transfer_out';

                      return (
                        <tr key={m.id}>
                          <td>{index + 1}</td>
                          <td style={{ fontSize: '0.85rem' }}>{new Date(m.created_at).toLocaleString()}</td>
                          {selectedBranchId === 'all' && (
                            <td style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                              {m.branches?.name || 'Main'}
                            </td>
                          )}
                          <td style={{ fontWeight: 600 }}>
                            <span style={{ color: 'var(--text-primary)' }}>{m.products?.name}</span>
                            <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {m.products?.sku}
                            </span>
                          </td>
                          <td>
                            {isTransferIn ? (
                              <span className="badge" style={{ backgroundColor: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                <ArrowRightLeft size={12} />
                                <span>Transfer In</span>
                              </span>
                            ) : isTransferOut ? (
                              <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #e9d5ff', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                <ArrowRightLeft size={12} />
                                <span>Transfer Out</span>
                              </span>
                            ) : (
                              <span className={`badge ${isIn ? 'badge-paid' : 'badge-unpaid'}`}>
                                {isIn ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                <span style={{ marginLeft: '0.25rem' }}>{m.type.replace('_', ' ')}</span>
                              </span>
                            )}
                          </td>
                          <td style={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: isIn ? 'var(--success-text)' : 'var(--danger-text)' }}>
                            {isIn ? '+' : '-'}{m.quantity}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>{m.description}</td>
                          <td style={{ fontSize: '0.85rem', fontWeight: 500 }}>{m.profiles?.full_name || 'System'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* MANUAL ADJUSTMENT MODAL */}
      {showAdjustmentModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Manual Inventory Stock Adjustment</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAdjustmentModal(false)}
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleManualAdjustment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label>Select Yarn / Accessory *</label>
                  <select
                    className="input-control"
                    value={adjustmentProductId}
                    onChange={(e) => setAdjustmentProductId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Thread / Accessory --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Adjustment Type *</label>
                    <select
                      className="input-control"
                      value={adjustmentType}
                      onChange={(e) => setAdjustmentType(e.target.value)}
                      required
                    >
                      <option value="adjustment_in">Stock In (Winding / Return / Excess)</option>
                      <option value="adjustment_out">Stock Out (Wastage / Breakage / Damage)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      className="input-control"
                      placeholder="Enter amount"
                      value={adjustmentQty}
                      onChange={(e) => setAdjustmentQty(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Reason / Notes *</label>
                  <textarea
                    className="input-control"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    placeholder="e.g. Thread winding wastage, yarn breakage, damage, physical count discrepancy..."
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAdjustmentModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Post Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INTER-BRANCH STOCK TRANSFER MODAL */}
      {showTransferModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowRightLeft size={16} style={{ color: 'var(--primary)' }} />
                <h3 className="modal-title" style={{ margin: 0, fontSize: '1rem' }}>Transfer Stock</h3>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowTransferModal(false)}
                style={{ borderRadius: '50%', padding: '0.3rem', border: 'none' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <div className="modal-body" style={{ overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Branch Routing Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.6rem', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.6rem 0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>From Branch *</label>
                    {role === 'owner' ? (
                      <select
                        className="input-control"
                        value={transferFromBranch}
                        onChange={(e) => handleFromBranchChange(e.target.value)}
                        required
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', fontWeight: 600 }}
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="input-control"
                        value={branches.find((b) => b.id === transferFromBranch)?.name || 'My Branch'}
                        disabled
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', fontWeight: 600, backgroundColor: '#f1f5f9' }}
                      />
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', paddingTop: '1rem' }}>
                    <ArrowRightLeft size={16} />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>To Branch *</label>
                    <select
                      className="input-control"
                      value={transferToBranch}
                      onChange={(e) => setTransferToBranch(e.target.value)}
                      required
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', fontWeight: 600 }}
                    >
                      <option value="">-- Select Destination --</option>
                      {branches
                        .filter((b) => b.id !== transferFromBranch)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Dispatch Details Metadata */}
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '0.6rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Date *</label>
                    <input
                      type="date"
                      className="input-control"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                      required
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.5rem' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Transport / Driver</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. Van / Driver name"
                      value={transferVehicle}
                      onChange={(e) => setTransferVehicle(e.target.value)}
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.5rem' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem' }}>Notes / Ref</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Optional reference or notes..."
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.5rem' }}
                  />
                </div>

                {/* Items to Transfer Table */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.78rem' }}>Items to Transfer *</label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={addTransferItemRow}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <Plus size={12} />
                      <span>Add Item</span>
                    </button>
                  </div>

                  <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', maxHeight: '200px', overflowY: 'auto' }}>
                    <table style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: '30px', padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}>SL</th>
                          <th style={{ padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}>Product *</th>
                          <th style={{ width: '85px', textAlign: 'center', padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}>Available</th>
                          <th style={{ width: '85px', textAlign: 'right', padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}>Qty *</th>
                          <th style={{ width: '45px', textAlign: 'center', padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}>Unit</th>
                          <th style={{ width: '35px', textAlign: 'center', padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {transferItems.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ verticalAlign: 'middle', fontWeight: 600, fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}>{idx + 1}</td>
                            <td style={{ verticalAlign: 'middle', padding: '0.3rem 0.5rem' }}>
                              <select
                                className="input-control"
                                value={item.productId}
                                onChange={(e) => updateTransferItemProduct(idx, e.target.value)}
                                required
                                style={{ fontSize: '0.78rem', padding: '0.25rem 0.4rem' }}
                              >
                                <option value="">-- Choose Item --</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.sku})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ verticalAlign: 'middle', textAlign: 'center', padding: '0.3rem 0.5rem' }}>
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '0.1rem 0.35rem',
                                  backgroundColor: item.availableStock > 0 ? 'var(--primary-light)' : 'var(--danger-light)',
                                  color: item.availableStock > 0 ? 'var(--primary-dark)' : 'var(--danger-text)',
                                  fontWeight: 700,
                                }}
                              >
                                {item.availableStock}
                              </span>
                            </td>
                            <td style={{ verticalAlign: 'middle', textAlign: 'right', padding: '0.3rem 0.5rem' }}>
                              <input
                                type="number"
                                min="1"
                                max={item.availableStock > 0 ? item.availableStock : 1}
                                className="input-control"
                                value={item.quantity}
                                onChange={(e) => updateTransferItemQty(idx, e.target.value)}
                                required
                                style={{
                                  textAlign: 'right',
                                  width: '70px',
                                  marginLeft: 'auto',
                                  padding: '0.25rem 0.4rem',
                                  fontSize: '0.78rem',
                                  borderColor: item.quantity > item.availableStock ? 'var(--danger)' : 'var(--border-color)',
                                }}
                              />
                            </td>
                            <td style={{ verticalAlign: 'middle', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}>
                              {item.unit}
                            </td>
                            <td style={{ verticalAlign: 'middle', textAlign: 'center', padding: '0.3rem 0.5rem' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm btn-icon"
                                onClick={() => removeTransferItemRow(idx)}
                                disabled={transferItems.length <= 1}
                                style={{ color: 'var(--danger-text)', opacity: transferItems.length <= 1 ? 0.3 : 1, padding: '0.2rem' }}
                                title="Remove Line"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Total Items: <strong style={{ color: 'var(--text-primary)' }}>{transferItems.filter(it => it.productId).length}</strong>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    Total Units: <strong style={{ color: 'var(--primary)', fontFamily: 'Outfit, sans-serif' }}>
                      {transferItems.filter(it => it.productId).reduce((sum, it) => sum + (parseInt(it.quantity) || 0), 0)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '0.75rem 1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowTransferModal(false)}
                  disabled={isTransferring}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isTransferring || !transferToBranch}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Send size={14} />
                  <span>{isTransferring ? 'Transferring...' : 'Transfer Stock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE TRANSFER DELIVERY CHALLAN MODAL */}
      {showTransferPrint && activeTransferChallan && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '92%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header no-print">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                <h3 className="modal-title" style={{ margin: 0, fontSize: '1rem' }}>Transfer Challan Generated</h3>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Printer size={14} />
                  <span>Print Challan Slip</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowTransferPrint(false)}
                  style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: '1.5rem' }}>
              <div className="invoice-print-view" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
                {/* Official Challan Header */}
                <div className="invoice-header">
                  <div className="invoice-company-details">
                    <div className="invoice-company-name">ALMAS ACCESSORIES</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Stock Transfer Delivery Challan
                    </div>
                  </div>
                  <div className="invoice-meta">
                    <div className="invoice-title" style={{ fontSize: '1.05rem', color: '#3730a3' }}>
                      TRANSFER CHALLAN
                    </div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.88rem' }}>
                      {activeTransferChallan.challanNumber}
                    </div>
                    <div style={{ fontSize: '0.8rem' }}>
                      Date: {new Date(activeTransferChallan.transferDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Routing Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '1.25rem 0', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#fafafa' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.5px' }}>
                      DISPATCHED FROM (ORIGIN):
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {activeTransferChallan.fromBranch?.name || 'Main Factory'}
                    </div>
                    {activeTransferChallan.fromBranch?.address && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {activeTransferChallan.fromBranch.address}
                      </div>
                    )}
                    {activeTransferChallan.fromBranch?.phone && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Phone: {activeTransferChallan.fromBranch.phone}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#3730a3', letterSpacing: '0.5px' }}>
                      TRANSFER DESTINATION (RECIPIENT):
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {activeTransferChallan.toBranch?.name || 'Branch Office'}
                    </div>
                    {activeTransferChallan.toBranch?.address && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {activeTransferChallan.toBranch.address}
                      </div>
                    )}
                    {activeTransferChallan.toBranch?.phone && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Phone: {activeTransferChallan.toBranch.phone}
                      </div>
                    )}
                  </div>
                </div>

                {/* Transport & Carrier Info */}
                {(activeTransferChallan.driverName || activeTransferChallan.vehicleNumber || activeTransferChallan.notes) && (
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem', padding: '0.5rem 0.75rem', backgroundColor: '#f1f5f9', borderRadius: '4px', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {activeTransferChallan.driverName && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Driver / Person: </span>
                        <strong>{activeTransferChallan.driverName}</strong>
                      </div>
                    )}
                    {activeTransferChallan.vehicleNumber && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Transport / Vehicle: </span>
                        <strong>{activeTransferChallan.vehicleNumber}</strong>
                      </div>
                    )}
                    {activeTransferChallan.notes && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Notes / Purpose: </span>
                        <span>{activeTransferChallan.notes}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Itemized Table */}
                <table className="invoice-table" style={{ marginTop: '0.5rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>SL</th>
                      <th style={{ width: '130px' }}>SKU Code</th>
                      <th>Thread / Accessory Description</th>
                      <th style={{ width: '120px' }}>Category</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>Qty</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>UoM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTransferChallan.items.map((item, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem' }}>
                          {item.sku}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.name}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {item.category || 'Standard'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem' }}>
                          {item.quantity}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'right', fontWeight: 700, padding: '0.6rem 0.75rem' }}>
                        TOTAL DISPATCHED UNITS:
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1rem', color: 'var(--primary)', padding: '0.6rem 0.75rem' }}>
                        {activeTransferChallan.totalUnits}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Items ({activeTransferChallan.totalItems})
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Official 3-Column Signature Footer */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginTop: '3.5rem', textAlign: 'center' }}>
                  <div>
                    <div style={{ borderTop: '1.5px dashed #64748b', paddingTop: '0.4rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Dispatched By
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {activeTransferChallan.createdByName}
                    </div>
                  </div>

                  <div>
                    <div style={{ borderTop: '1.5px dashed #64748b', paddingTop: '0.4rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Carrier / Driver Signature
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {activeTransferChallan.driverName || 'Goods Received for Transit'}
                    </div>
                  </div>

                  <div>
                    <div style={{ borderTop: '1.5px dashed #64748b', paddingTop: '0.4rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Received & Verified By
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Destination Branch In-Charge
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
