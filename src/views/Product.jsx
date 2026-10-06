import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  Package, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Layers,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Store,
  Calendar,
  DollarSign,
  X,
  Filter
} from 'lucide-react';
import { TableLoading } from '../components/TableLoading';
import Pagination from '../components/Pagination';
import { hasPermission } from '../utils/permissions';
import { formatAmount } from '../utils/format';

export default function Product({ userProfile, branches, addToast }) {
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form Fields: Product Code, Name, Category, Description
  const [productCode, setProductCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [branchPrices, setBranchPrices] = useState({});

  // Product Transaction History Modal States
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryProduct, setSelectedHistoryProduct] = useState(null);
  const [historyPurchases, setHistoryPurchases] = useState([]);
  const [historySales, setHistorySales] = useState([]);
  const [historyInventory, setHistoryInventory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState('all'); // 'all' | 'purchases' | 'sales' | 'stock'
  const [historyBranchFilter, setHistoryBranchFilter] = useState('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  const handleOpenHistory = async (product) => {
    setSelectedHistoryProduct(product);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    setHistoryTab('all');
    setHistoryBranchFilter('all');
    setHistorySearchQuery('');

    try {
      // 1. Fetch Purchases
      const { data: purItems, error: purErr } = await supabase
        .from('purchase_items')
        .select(`
          id,
          quantity,
          unit_price,
          total_price,
          purchase_id,
          purchases (
            id,
            invoice_number,
            purchase_date,
            branch_id,
            branches (id, name),
            supplier:contacts!purchases_supplier_id_fkey (id, name, phone)
          )
        `)
        .eq('product_id', product.id);

      if (purErr) console.warn('Purchase history query error:', purErr);

      // 2. Fetch Sales
      const { data: saleItems, error: saleErr } = await supabase
        .from('sale_items')
        .select(`
          id,
          quantity,
          unit_price,
          total_price,
          size,
          number_of_carton,
          sale_id,
          sales (
            id,
            invoice_number,
            sale_date,
            branch_id,
            branches (id, name),
            customer:contacts!sales_customer_id_fkey (id, name, phone)
          )
        `)
        .eq('product_id', product.id);

      if (saleErr) console.warn('Sale history query error:', saleErr);

      // 3. Fetch Stock per branch
      const { data: invRows, error: invErr } = await supabase
        .from('inventory')
        .select('id, quantity, purchase_price, sale_price, updated_at, branches (id, name, is_factory)')
        .eq('product_id', product.id);

      if (invErr) console.warn('Inventory stock query error:', invErr);

      setHistoryPurchases(purItems || []);
      setHistorySales(saleItems || []);
      setHistoryInventory(invRows || []);
    } catch (err) {
      console.error('Error fetching product history:', err);
      showMessage('Failed to load product transaction history.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const isOwner = userProfile?.role === 'owner';
  const userBranchId = userProfile?.branch_id;
  const userBranch = branches.find((b) => b.id === userBranchId);
  const activeBranches = (isOwner || !userBranchId) ? (branches || []) : branches.filter((b) => b.id === userBranchId);

  // Permissions
  const canView = hasPermission(userProfile, 'product.items_view') || hasPermission(userProfile, 'product.view') || hasPermission(userProfile, 'inventory.catalog_view');
  const canCreate = hasPermission(userProfile, 'product.items_create') || hasPermission(userProfile, 'inventory.catalog_create');
  const canDelete = hasPermission(userProfile, 'product.items_delete') || hasPermission(userProfile, 'inventory.catalog_delete');

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const fetchCategories = async () => {
    try {
      const { data } = await supabase.from('products').select('category');
      if (data) {
        const unique = [...new Set(data.map((p) => p.category).filter(Boolean))].sort();
        setCategories(unique);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('products')
        .select('*', { count: 'exact' });

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery.trim()}%,sku.ilike.%${searchQuery.trim()}%,product_code.ilike.%${searchQuery.trim()}%,category.ilike.%${searchQuery.trim()}%`);
      }

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      const prods = data || [];
      if (prods.length > 0) {
        const prodIds = prods.map((p) => p.id);
        const { data: invPrices, error: invErr } = await supabase
          .from('inventory')
          .select('product_id, branch_id, purchase_price, sale_price')
          .in('product_id', prodIds);

        if (!invErr && invPrices) {
          const priceMap = {};
          invPrices.forEach((inv) => {
            if (!priceMap[inv.product_id]) priceMap[inv.product_id] = {};
            priceMap[inv.product_id][inv.branch_id] = {
              purchase_price: inv.purchase_price,
              sale_price: inv.sale_price,
            };
          });

          const enriched = prods.map((p) => ({
            ...p,
            branch_prices: priceMap[p.id] || {},
          }));
          setProducts(enriched);
        } else {
          setProducts(prods);
        }
      } else {
        setProducts([]);
      }

      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching products:', err);
      showMessage('Failed to load product list.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, categoryFilter, searchQuery]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const resetForm = () => {
    setProductCode('');
    setName('');
    setCategory('');
    setDescription('');
    setBranchPrices({});
    setIsEditing(false);
    setEditId(null);
  };

  const handleOpenCreate = useCallback(() => {
    resetForm();
    const initBranchPrices = {};
    (branches || []).forEach((b) => {
      initBranchPrices[b.id] = { buyPrice: '', salePrice: '' };
    });
    setBranchPrices(initBranchPrices);
    setShowModal(true);
  }, [branches]);

  useEffect(() => {
    if (location.state?.openCreateProduct) {
      handleOpenCreate();
      window.history.replaceState({}, document.title);
    }
  }, [location.state, handleOpenCreate]);

  const handleOpenEdit = (prod) => {
    setProductCode(prod.product_code || prod.sku || '');
    setName(prod.name || '');
    setCategory(prod.category || '');
    setDescription(prod.description || '');

    const initBranchPrices = {};
    (branches || []).forEach((b) => {
      const existing = prod.branch_prices?.[b.id];
      const bBuy = existing?.purchase_price !== null && existing?.purchase_price !== undefined 
        ? existing.purchase_price 
        : (prod.purchase_price ?? '');
      const bSell = existing?.sale_price !== null && existing?.sale_price !== undefined 
        ? existing.sale_price 
        : (prod.sale_price ?? '');

      initBranchPrices[b.id] = { 
        buyPrice: bBuy !== '' && bBuy !== null && bBuy !== undefined ? bBuy : '', 
        salePrice: bSell !== '' && bSell !== null && bSell !== undefined ? bSell : '' 
      };
    });
    setBranchPrices(initBranchPrices);

    setIsEditing(true);
    setEditId(prod.id);
    setShowModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const cleanCode = productCode.trim();
    const cleanName = name.trim();
    const cleanCategory = category.trim();
    const cleanDesc = description.trim();

    if (!cleanCode) {
      showMessage('Please provide a Product Code.', 'error');
      return;
    }

    setSaving(true);
    try {
      const displayName = cleanName || cleanCode;
      let savedProdId = editId;

      // Find first non-empty price to store as fallback on products table
      let firstBuy = null;
      let firstSell = null;
      Object.values(branchPrices).forEach((bp) => {
        if (firstBuy === null && bp.buyPrice !== '' && !isNaN(parseFloat(bp.buyPrice))) {
          firstBuy = parseFloat(bp.buyPrice);
        }
        if (firstSell === null && bp.salePrice !== '' && !isNaN(parseFloat(bp.salePrice))) {
          firstSell = parseFloat(bp.salePrice);
        }
      });

      const productPayload = {
        sku: cleanCode,
        product_code: cleanCode,
        name: displayName,
        category: cleanCategory || null,
        description: cleanDesc || null,
        purchase_price: firstBuy ?? 0,
        sale_price: firstSell ?? 0,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('products')
          .update(productPayload)
          .eq('id', editId);

        if (error) throw error;
        showMessage(`Updated product "${displayName}".`, 'success');
      } else {
        const { data: newProd, error } = await supabase
          .from('products')
          .insert([productPayload])
          .select()
          .single();

        if (error) throw error;
        savedProdId = newProd.id;
        showMessage(`Created product "${displayName}".`, 'success');
      }

      // Upsert branch prices into inventory table for each active branch
      if (branches && branches.length > 0 && savedProdId) {
        let invUpserts = [];

        if (isOwner) {
          invUpserts = branches.map((b) => {
            const bp = branchPrices[b.id] || {};
            const customBuy = bp.buyPrice !== '' && !isNaN(parseFloat(bp.buyPrice)) ? parseFloat(bp.buyPrice) : null;
            const customSell = bp.salePrice !== '' && !isNaN(parseFloat(bp.salePrice)) ? parseFloat(bp.salePrice) : null;

            return {
              branch_id: b.id,
              product_id: savedProdId,
              purchase_price: customBuy,
              sale_price: customSell,
              updated_at: new Date().toISOString(),
            };
          });
        } else if (userBranchId) {
          const bp = branchPrices[userBranchId] || {};
          const customBuy = bp.buyPrice !== '' && !isNaN(parseFloat(bp.buyPrice)) ? parseFloat(bp.buyPrice) : null;
          const customSell = bp.salePrice !== '' && !isNaN(parseFloat(bp.salePrice)) ? parseFloat(bp.salePrice) : null;

          invUpserts = [
            {
              branch_id: userBranchId,
              product_id: savedProdId,
              purchase_price: customBuy,
              sale_price: customSell,
              updated_at: new Date().toISOString(),
            },
          ];

          if (!isEditing) {
            branches.forEach((b) => {
              if (b.id !== userBranchId) {
                invUpserts.push({
                  branch_id: b.id,
                  product_id: savedProdId,
                  purchase_price: null,
                  sale_price: null,
                  updated_at: new Date().toISOString(),
                });
              }
            });
          }
        }

        if (invUpserts.length > 0) {
          const { error: upsertErr } = await supabase
            .from('inventory')
            .upsert(invUpserts, { onConflict: 'branch_id,product_id', ignoreDuplicates: false });

          if (upsertErr) {
            console.warn('Inventory upsert warning:', upsertErr);
          }
        }
      }

      resetForm();
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      console.error('Error saving product:', err);
      showMessage(err.message || 'Failed to save product.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (prodId, prodName) => {
    try {
      // 1. Check for sales or purchase records
      const { count: salesCount } = await supabase
        .from('sale_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', prodId);

      if (salesCount && salesCount > 0) {
        showMessage(`Cannot delete "${prodName}": Linked with ${salesCount} sales transaction${salesCount > 1 ? 's' : ''}.`, 'error');
        return;
      }

      const { count: purCount } = await supabase
        .from('purchase_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', prodId);

      if (purCount && purCount > 0) {
        showMessage(`Cannot delete "${prodName}": Linked with ${purCount} purchase record${purCount > 1 ? 's' : ''}.`, 'error');
        return;
      }

      if (!window.confirm(`Are you sure you want to delete "${prodName}"?`)) {
        return;
      }

      const { error } = await supabase.from('products').delete().eq('id', prodId);
      if (error) throw error;

      showMessage(`Deleted product "${prodName}".`, 'success');
      fetchProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      showMessage('Cannot delete product with linked transactions or records.', 'error');
    }
  };

  // Filter states
  const [selectedPriceBranch, setSelectedPriceBranch] = useState('all');

  const getBranchBuyPrice = (p, branchId) => {
    const custom = p.branch_prices?.[branchId]?.purchase_price;
    if (custom !== null && custom !== undefined && custom !== '') return custom;
    if (p.purchase_price !== null && p.purchase_price !== undefined && p.purchase_price !== '') return p.purchase_price;
    return null;
  };

  const getBranchSellPrice = (p, branchId) => {
    const custom = p.branch_prices?.[branchId]?.sale_price;
    if (custom !== null && custom !== undefined && custom !== '') return custom;
    if (p.sale_price !== null && p.sale_price !== undefined && p.sale_price !== '') return p.sale_price;
    return null;
  };

  const renderBuyPrice = (p) => {
    if (!isOwner) {
      const price = getBranchBuyPrice(p, userBranchId);
      return price !== null && price !== undefined && parseFloat(price) > 0 ? (
        <span style={{ fontWeight: 600 }}>৳{formatAmount(price)}</span>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      );
    }

    if (selectedPriceBranch !== 'all') {
      const price = getBranchBuyPrice(p, selectedPriceBranch);
      return price !== null && price !== undefined && parseFloat(price) > 0 ? (
        <span style={{ fontWeight: 600 }}>৳{formatAmount(price)}</span>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      );
    }

    // Owner "All Branches" view
    const branchPriceList = (branches || []).map((b) => ({
      ...b,
      price: getBranchBuyPrice(p, b.id),
    })).filter((b) => b.price !== null && b.price !== undefined && parseFloat(b.price) > 0);

    if (branchPriceList.length === 0) {
      return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    }

    const firstVal = branchPriceList[0].price;
    const allSame = branchPriceList.every((b) => b.price === firstVal);

    if (allSame && branchPriceList.length === branches.length) {
      return (
        <span style={{ fontWeight: 600 }}>৳{formatAmount(firstVal)}</span>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
        {branchPriceList.map((b) => (
          <div key={b.id} style={{ fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{b.name}: </span>
            <span style={{ fontWeight: 600 }}>৳{formatAmount(b.price)}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderSellPrice = (p) => {
    if (!isOwner) {
      const price = getBranchSellPrice(p, userBranchId);
      return price !== null && price !== undefined && parseFloat(price) > 0 ? (
        <span style={{ fontWeight: 700, color: 'var(--success-text)' }}>৳{formatAmount(price)}</span>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      );
    }

    if (selectedPriceBranch !== 'all') {
      const price = getBranchSellPrice(p, selectedPriceBranch);
      return price !== null && price !== undefined && parseFloat(price) > 0 ? (
        <span style={{ fontWeight: 700, color: 'var(--success-text)' }}>৳{formatAmount(price)}</span>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      );
    }

    // Owner "All Branches" view
    const branchPriceList = (branches || []).map((b) => ({
      ...b,
      price: getBranchSellPrice(p, b.id),
    })).filter((b) => b.price !== null && b.price !== undefined && parseFloat(b.price) > 0);

    if (branchPriceList.length === 0) {
      return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    }

    const firstVal = branchPriceList[0].price;
    const allSame = branchPriceList.every((b) => b.price === firstVal);

    if (allSame && branchPriceList.length === branches.length) {
      return (
        <span style={{ fontWeight: 700, color: 'var(--success-text)' }}>৳{formatAmount(firstVal)}</span>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
        {branchPriceList.map((b) => (
          <div key={b.id} style={{ fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{b.name}: </span>
            <span style={{ fontWeight: 700, color: 'var(--success-text)' }}>৳{formatAmount(b.price)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header */}
      <div className="top-bar">
        <div className="page-title-group">
          <h1>Products</h1>
        </div>
        <div className="top-bar-actions">
          {canCreate && (
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              <Plus size={16} />
              <span>New Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Card */}
      <div className="card">
        {/* Search & Category Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, minWidth: '260px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <Search 
                size={15} 
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
              />
              <input
                type="text"
                className="input-control"
                style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {categories.length > 0 && (
              <select
                className="input-control"
                style={{ width: '160px', fontSize: '0.85rem' }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}

            {isOwner && branches && branches.length > 1 && (
              <select
                className="input-control"
                style={{ width: '190px', fontSize: '0.85rem' }}
                value={selectedPriceBranch}
                onChange={(e) => setSelectedPriceBranch(e.target.value)}
              >
                <option value="all">Pricing: All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Pricing: {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Products Table (Desktop View) */}
        <div className="table-container hide-on-mobile">
          <table>
            <thead>
              {isOwner && branches && branches.length > 1 ? (
                <>
                  <tr>
                    <th rowSpan={2} style={{ width: '45px', textAlign: 'center' }}>SL</th>
                    <th rowSpan={2} style={{ width: '130px' }}>Product Code</th>
                    <th rowSpan={2} style={{ width: '220px' }}>Product Name</th>
                    <th rowSpan={2} style={{ width: '120px' }}>Category</th>
                    <th rowSpan={2}>Description</th>
                    <th colSpan={branches.length} style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>
                      Buy Price (৳)
                    </th>
                    <th colSpan={branches.length} style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>
                      Sell Price (৳)
                    </th>
                    <th rowSpan={2} style={{ width: '115px', textAlign: 'center' }}>Actions</th>
                  </tr>
                  <tr>
                    {branches.map((b) => (
                      <th key={`buy-${b.id}`} style={{ textAlign: 'right', fontSize: '0.74rem', width: '110px' }}>
                        {b.name}
                      </th>
                    ))}
                    {branches.map((b) => (
                      <th key={`sell-${b.id}`} style={{ textAlign: 'right', fontSize: '0.74rem', width: '110px' }}>
                        {b.name}
                      </th>
                    ))}
                  </tr>
                </>
              ) : (
                <tr>
                  <th style={{ width: '45px', textAlign: 'center' }}>SL</th>
                  <th style={{ width: '140px' }}>Product Code</th>
                  <th style={{ width: '230px' }}>Product Name</th>
                  <th style={{ width: '130px' }}>Category</th>
                  <th>Description</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Buy Price (৳)</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Sell Price (৳)</th>
                  <th style={{ width: '115px', textAlign: 'center' }}>Actions</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <TableLoading colSpan={isOwner && branches && branches.length > 1 ? 6 + branches.length * 2 : 8} message="Loading products..." />
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={isOwner && branches && branches.length > 1 ? 6 + branches.length * 2 : 8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <Package size={36} style={{ color: 'var(--border-focus)', opacity: 0.5 }} />
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No products found</div>
                      <div style={{ fontSize: '0.8rem' }}>
                        {searchQuery || categoryFilter !== 'all'
                          ? 'Try adjusting your search or category filter.' 
                          : 'Click "New Product" above to create your first product.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((p, index) => (
                  <tr key={p.id}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          fontSize: '0.85rem',
                          color: 'var(--primary)',
                          backgroundColor: 'var(--primary-light)',
                          padding: '0.2rem 0.45rem',
                          borderRadius: '4px',
                        }}
                      >
                        {p.product_code || p.sku}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {p.name || <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}
                    </td>
                    <td>
                      {p.category ? (
                        <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                          {p.category}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ color: p.description ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {p.description || '—'}
                    </td>
                    {isOwner && branches && branches.length > 1 ? (
                      <>
                        {branches.map((b) => {
                          const price = getBranchBuyPrice(p, b.id);
                          return (
                            <td key={`buy-${b.id}`} style={{ textAlign: 'right', fontWeight: 600 }}>
                              {price !== null && price !== undefined && parseFloat(price) > 0 ? (
                                `৳${formatAmount(price)}`
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                          );
                        })}
                        {branches.map((b) => {
                          const price = getBranchSellPrice(p, b.id);
                          return (
                            <td key={`sell-${b.id}`} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success-text)' }}>
                              {price !== null && price !== undefined && parseFloat(price) > 0 ? (
                                `৳${formatAmount(price)}`
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                          );
                        })}
                      </>
                    ) : (
                      <>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {(() => {
                            const price = getBranchBuyPrice(p, userBranchId);
                            return price !== null && price !== undefined && parseFloat(price) > 0 ? (
                              `৳${formatAmount(price)}`
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            );
                          })()}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success-text)' }}>
                          {(() => {
                            const price = getBranchSellPrice(p, userBranchId);
                            return price !== null && price !== undefined && parseFloat(price) > 0 ? (
                              `৳${formatAmount(price)}`
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            );
                          })()}
                        </td>
                      </>
                    )}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenHistory(p)}
                          title="Purchase & Sales History"
                          style={{
                            padding: '0.25rem 0.45rem',
                            color: '#0284c7',
                            backgroundColor: '#f0f9ff',
                            borderColor: '#bae6fd',
                          }}
                        >
                          <History size={13} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEdit(p)}
                          title="Edit"
                          style={{ padding: '0.25rem 0.45rem' }}
                        >
                          <Edit size={13} />
                        </button>
                        {canDelete && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            title="Delete"
                            style={{ padding: '0.25rem 0.45rem' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View for Products */}
        <div className="hide-on-desktop" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No products found.
            </div>
          ) : (
            products.map((p, index) => {
              const rowNumber = (page - 1) * pageSize + index + 1;

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
                    gap: '0.55rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  {/* Header: SL Badge, Product Name, Category */}
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
                        {p.name || '—'}
                      </span>
                    </div>
                    {p.category && (
                      <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                        {p.category}
                      </span>
                    )}
                  </div>

                  {/* Code & Description */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)', backgroundColor: '#f0f9ff', padding: '0.1rem 0.4rem', borderRadius: '4px', width: 'fit-content', fontSize: '0.8rem' }}>
                      Code: {p.product_code || p.sku || '—'}
                    </span>
                    {p.description && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {p.description}
                      </div>
                    )}
                  </div>

                  {/* Pricing Strip */}
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
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Buy Price</span>
                      <div style={{ fontSize: '0.85rem' }}>{renderBuyPrice(p)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Sell Price</span>
                      <div style={{ fontSize: '0.88rem' }}>{renderSellPrice(p)}</div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.15rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenHistory(p)}
                      style={{
                        flex: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        height: '34px',
                        fontSize: '0.8rem',
                        color: '#0284c7',
                        backgroundColor: '#f0f9ff',
                        border: '1px solid #bae6fd',
                      }}
                      title="History"
                    >
                      <History size={14} />
                      <span>History</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenEdit(p)}
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
                    {canDelete && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-icon"
                        onClick={() => handleDeleteProduct(p.id, p.name)}
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
                        title="Delete Product"
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

        <Pagination 
          page={page}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </div>

      {/* CREATE / EDIT PRODUCT MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {isEditing ? 'Edit Product' : 'New Product'}
              </h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowModal(false)} 
                style={{ borderRadius: '50%', padding: '0.35rem 0.5rem', border: 'none' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Product Code *</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Enter product code"
                      value={productCode}
                      onChange={(e) => setProductCode(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Enter category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Product Name</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Enter product name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                {/* Per-Branch Direct Pricing Rows */}
                {activeBranches && activeBranches.length > 0 && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {isOwner ? 'Branch & Factory Pricing (Optional)' : `Branch Pricing (${userBranch?.name || 'Your Branch'})`}
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.35rem' }}>
                      {activeBranches.map((b) => (
                        <div 
                          key={b.id} 
                          style={{ 
                            display: 'grid', 
                            gridTemplateColumns: activeBranches.length > 1 ? '1.2fr 1fr 1fr' : '1fr 1fr', 
                            gap: '0.5rem', 
                            alignItems: 'center', 
                            padding: '0.5rem', 
                            borderRadius: '6px', 
                            backgroundColor: 'var(--bg-app)',
                            border: '1px solid var(--border-color)' 
                          }}
                        >
                          {activeBranches.length > 1 && (
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.name}>
                              {b.name}
                            </span>
                          )}
                          <div>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              className="input-control"
                              style={{ height: '32px', fontSize: '0.82rem' }}
                              placeholder="Buy Price (৳)"
                              value={branchPrices[b.id]?.buyPrice ?? ''}
                              onChange={(e) => setBranchPrices({
                                ...branchPrices,
                                [b.id]: { ...(branchPrices[b.id] || {}), buyPrice: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              className="input-control"
                              style={{ height: '32px', fontSize: '0.82rem' }}
                              placeholder="Sell Price (৳)"
                              value={branchPrices[b.id]?.salePrice ?? ''}
                              onChange={(e) => setBranchPrices({
                                ...branchPrices,
                                [b.id]: { ...(branchPrices[b.id] || {}), salePrice: e.target.value }
                              })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="input-control"
                    style={{ minHeight: '65px', resize: 'vertical' }}
                    placeholder="Enter description (optional)..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : isEditing ? 'Update' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRODUCT TRANSACTION HISTORY MODAL */}
      {showHistoryModal && selectedHistoryProduct && (() => {
        // Filter by branch
        const filteredPurchases = historyPurchases.filter((pi) => {
          if (historyBranchFilter !== 'all' && pi.purchases?.branch_id !== historyBranchFilter) return false;
          if (historySearchQuery.trim()) {
            const q = historySearchQuery.toLowerCase().trim();
            const invNum = (pi.purchases?.invoice_number || '').toLowerCase();
            const supName = (pi.purchases?.supplier?.name || '').toLowerCase();
            const bName = (pi.purchases?.branches?.name || '').toLowerCase();
            return invNum.includes(q) || supName.includes(q) || bName.includes(q);
          }
          return true;
        });

        const filteredSales = historySales.filter((si) => {
          if (historyBranchFilter !== 'all' && si.sales?.branch_id !== historyBranchFilter) return false;
          if (historySearchQuery.trim()) {
            const q = historySearchQuery.toLowerCase().trim();
            const invNum = (si.sales?.invoice_number || '').toLowerCase();
            const custName = (si.sales?.customer?.name || '').toLowerCase();
            const bName = (si.sales?.branches?.name || '').toLowerCase();
            return invNum.includes(q) || custName.includes(q) || bName.includes(q);
          }
          return true;
        });

        const filteredInventory = historyInventory.filter((inv) => {
          if (historyBranchFilter !== 'all' && inv.branches?.id !== historyBranchFilter) return false;
          return true;
        });

        // Compute KPIs
        const totalPurchasedQty = filteredPurchases.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
        const totalPurchasedAmount = filteredPurchases.reduce((sum, p) => sum + (Number(p.total_price) || (Number(p.quantity) * Number(p.unit_price)) || 0), 0);
        
        const totalSoldQty = filteredSales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
        const totalSoldAmount = filteredSales.reduce((sum, s) => sum + (Number(s.total_price) || (Number(s.quantity) * Number(s.unit_price)) || 0), 0);

        const totalStockInHand = filteredInventory.reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0);
        const totalStockValuation = filteredInventory.reduce((sum, inv) => sum + ((Number(inv.quantity) || 0) * (Number(inv.purchase_price) || 0)), 0);

        // Combined activity timeline
        const allActivities = [
          ...filteredPurchases.map((pi) => ({
            id: `pur-${pi.id}`,
            date: pi.purchases?.purchase_date || '',
            type: 'purchase',
            invoiceNumber: pi.purchases?.invoice_number || '—',
            branchName: pi.purchases?.branches?.name || '—',
            contactName: pi.purchases?.supplier?.name || 'Unknown Supplier',
            contactPhone: pi.purchases?.supplier?.phone || '',
            quantity: Number(pi.quantity) || 0,
            unitPrice: Number(pi.unit_price) || 0,
            totalPrice: Number(pi.total_price) || (Number(pi.quantity) * Number(pi.unit_price)) || 0,
          })),
          ...filteredSales.map((si) => ({
            id: `sale-${si.id}`,
            date: si.sales?.sale_date || '',
            type: 'sale',
            invoiceNumber: si.sales?.invoice_number || '—',
            branchName: si.sales?.branches?.name || '—',
            contactName: si.sales?.customer?.name || 'Unknown Customer',
            contactPhone: si.sales?.customer?.phone || '',
            quantity: Number(si.quantity) || 0,
            unitPrice: Number(si.unit_price) || 0,
            totalPrice: Number(si.total_price) || (Number(si.quantity) * Number(si.unit_price)) || 0,
            size: si.size,
          })),
        ];

        allActivities.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        return (
          <div className="modal-overlay" style={{ zIndex: 1050 }}>
            <div className="modal-content" style={{ maxWidth: '960px', width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
              {/* Modal Header */}
              <div className="modal-header" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ backgroundColor: '#e0f2fe', color: '#0284c7', padding: '0.5rem', borderRadius: '8px', display: 'flex' }}>
                    <History size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 className="modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                        {selectedHistoryProduct.name || selectedHistoryProduct.product_code || 'Product History'}
                      </h3>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary)', backgroundColor: 'var(--primary-light)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                        {selectedHistoryProduct.product_code || selectedHistoryProduct.sku}
                      </span>
                    </div>
                    {selectedHistoryProduct.category && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Category: {selectedHistoryProduct.category}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowHistoryModal(false)}
                  style={{ borderRadius: '50%', padding: '0.35rem 0.5rem', border: 'none', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', overflowY: 'auto' }}>
                {/* 4-KPI Metric Strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  {/* Total Purchased */}
                  <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>Total Purchased</span>
                      <ArrowDownLeft size={16} style={{ color: '#16a34a' }} />
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>
                      {totalPurchasedQty.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>pcs</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: '2px' }}>
                      Total Cost: ৳{formatAmount(totalPurchasedAmount)}
                    </div>
                  </div>

                  {/* Total Sold */}
                  <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e40af', textTransform: 'uppercase' }}>Total Sold</span>
                      <ArrowUpRight size={16} style={{ color: '#2563eb' }} />
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1d4ed8' }}>
                      {totalSoldQty.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>pcs</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#1e40af', marginTop: '2px' }}>
                      Revenue: ৳{formatAmount(totalSoldAmount)}
                    </div>
                  </div>

                  {/* Stock in Hand */}
                  <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b21a8', textTransform: 'uppercase' }}>Stock In Hand</span>
                      <Store size={16} style={{ color: '#9333ea' }} />
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: totalStockInHand > 0 ? '#7e22ce' : '#dc2626' }}>
                      {totalStockInHand.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>pcs</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#6b21a8', marginTop: '2px' }}>
                      Balance: (Purchased − Sold)
                    </div>
                  </div>

                  {/* Stock Valuation */}
                  <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e', textTransform: 'uppercase' }}>Stock Valuation</span>
                      <DollarSign size={16} style={{ color: '#d97706' }} />
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309' }}>
                      ৳{formatAmount(totalStockValuation)}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#92400e', marginTop: '2px' }}>
                      Based on current unit cost
                    </div>
                  </div>
                </div>

                {/* Filter and Tab Navigation Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  {/* Tabs */}
                  <div style={{ display: 'flex', gap: '0.4rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${historyTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setHistoryTab('all')}
                      style={{ borderRadius: '6px', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      All Activity ({allActivities.length})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${historyTab === 'purchases' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setHistoryTab('purchases')}
                      style={{ borderRadius: '6px', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      Purchases ({filteredPurchases.length})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${historyTab === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setHistoryTab('sales')}
                      style={{ borderRadius: '6px', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      Sales ({filteredSales.length})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${historyTab === 'stock' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setHistoryTab('stock')}
                      style={{ borderRadius: '6px', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      Branch Stock ({filteredInventory.length})
                    </button>
                  </div>

                  {/* Branch Filter and Search */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {isOwner && branches && branches.length > 1 && (
                      <select
                        className="input-control"
                        style={{ height: '34px', fontSize: '0.8rem', width: '170px' }}
                        value={historyBranchFilter}
                        onChange={(e) => setHistoryBranchFilter(e.target.value)}
                      >
                        <option value="all">All Branches</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Search invoice or contact..."
                      style={{ height: '34px', fontSize: '0.8rem', width: '190px' }}
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Table Content */}
                {loadingHistory ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Loading transaction records...
                  </div>
                ) : (
                  <>
                    {/* 1. ALL ACTIVITY TAB */}
                    {historyTab === 'all' && (
                      <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: '100px' }}>Date</th>
                              <th style={{ width: '110px' }}>Type</th>
                              <th style={{ width: '160px' }}>Invoice #</th>
                              <th style={{ width: '140px' }}>Branch</th>
                              <th>Party / Contact</th>
                              <th style={{ width: '90px', textAlign: 'right' }}>Qty</th>
                              <th style={{ width: '100px', textAlign: 'right' }}>Unit Price</th>
                              <th style={{ width: '110px', textAlign: 'right' }}>Total (৳)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allActivities.length === 0 ? (
                              <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                                  No transaction activity found for this product.
                                </td>
                              </tr>
                            ) : (
                              allActivities.map((act) => (
                                <tr key={act.id}>
                                  <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                    {act.date || '—'}
                                  </td>
                                  <td>
                                    {act.type === 'purchase' ? (
                                      <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <ArrowDownLeft size={11} /> PURCHASE
                                      </span>
                                    ) : (
                                      <span style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <ArrowUpRight size={11} /> SALE
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem' }}>
                                    {act.invoiceNumber}
                                  </td>
                                  <td style={{ fontSize: '0.82rem' }}>
                                    {act.branchName}
                                  </td>
                                  <td style={{ fontSize: '0.82rem' }}>
                                    <div style={{ fontWeight: 600 }}>{act.contactName}</div>
                                    {act.contactPhone && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{act.contactPhone}</div>}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: act.type === 'purchase' ? '#16a34a' : '#2563eb' }}>
                                    {act.type === 'purchase' ? `+${act.quantity}` : `-${act.quantity}`}
                                  </td>
                                  <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>
                                    ৳{formatAmount(act.unitPrice)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>
                                    ৳{formatAmount(act.totalPrice)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 2. PURCHASES TAB */}
                    {historyTab === 'purchases' && (
                      <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: '100px' }}>Date</th>
                              <th style={{ width: '160px' }}>Purchase Bill #</th>
                              <th style={{ width: '150px' }}>Branch</th>
                              <th>Supplier</th>
                              <th style={{ width: '90px', textAlign: 'right' }}>Qty</th>
                              <th style={{ width: '110px', textAlign: 'right' }}>Cost Price</th>
                              <th style={{ width: '120px', textAlign: 'right' }}>Total Cost (৳)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPurchases.length === 0 ? (
                              <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                                  No purchase records found for this product.
                                </td>
                              </tr>
                            ) : (
                              filteredPurchases.map((pi) => (
                                <tr key={pi.id}>
                                  <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                    {pi.purchases?.purchase_date || '—'}
                                  </td>
                                  <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)' }}>
                                    {pi.purchases?.invoice_number || '—'}
                                  </td>
                                  <td style={{ fontSize: '0.82rem' }}>
                                    {pi.purchases?.branches?.name || '—'}
                                  </td>
                                  <td style={{ fontSize: '0.82rem' }}>
                                    <div style={{ fontWeight: 600 }}>{pi.purchases?.supplier?.name || 'Supplier'}</div>
                                    {pi.purchases?.supplier?.phone && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{pi.purchases?.supplier?.phone}</div>}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                                    +{pi.quantity}
                                  </td>
                                  <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>
                                    ৳{formatAmount(pi.unit_price)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                    ৳{formatAmount(pi.total_price || (pi.quantity * pi.unit_price))}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 3. SALES TAB */}
                    {historyTab === 'sales' && (
                      <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: '100px' }}>Date</th>
                              <th style={{ width: '160px' }}>Sale Invoice #</th>
                              <th style={{ width: '150px' }}>Branch</th>
                              <th>Customer</th>
                              <th style={{ width: '80px' }}>Size</th>
                              <th style={{ width: '90px', textAlign: 'right' }}>Qty</th>
                              <th style={{ width: '110px', textAlign: 'right' }}>Sell Price</th>
                              <th style={{ width: '120px', textAlign: 'right' }}>Total (৳)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSales.length === 0 ? (
                              <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                                  No sales records found for this product.
                                </td>
                              </tr>
                            ) : (
                              filteredSales.map((si) => (
                                <tr key={si.id}>
                                  <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                    {si.sales?.sale_date || '—'}
                                  </td>
                                  <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)' }}>
                                    {si.sales?.invoice_number || '—'}
                                  </td>
                                  <td style={{ fontSize: '0.82rem' }}>
                                    {si.sales?.branches?.name || '—'}
                                  </td>
                                  <td style={{ fontSize: '0.82rem' }}>
                                    <div style={{ fontWeight: 600 }}>{si.sales?.customer?.name || 'Customer'}</div>
                                    {si.sales?.customer?.phone && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{si.sales?.customer?.phone}</div>}
                                  </td>
                                  <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    {si.size || '—'}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                                    -{si.quantity}
                                  </td>
                                  <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>
                                    ৳{formatAmount(si.unit_price)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                    ৳{formatAmount(si.total_price || (si.quantity * si.unit_price))}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 4. BRANCH STOCK BREAKDOWN TAB */}
                    {historyTab === 'stock' && (
                      <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Branch Name</th>
                              <th style={{ width: '120px' }}>Type</th>
                              <th style={{ width: '130px', textAlign: 'right' }}>Stock in Hand</th>
                              <th style={{ width: '130px', textAlign: 'right' }}>Unit Buy Cost</th>
                              <th style={{ width: '150px', textAlign: 'right' }}>Stock Valuation (৳)</th>
                              <th style={{ width: '150px' }}>Last Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredInventory.length === 0 ? (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                                  No branch stock records found.
                                </td>
                              </tr>
                            ) : (
                              filteredInventory.map((inv) => {
                                const q = Number(inv.quantity) || 0;
                                const cost = Number(inv.purchase_price) || 0;
                                const val = q * cost;
                                return (
                                  <tr key={inv.id}>
                                    <td style={{ fontWeight: 600 }}>
                                      {inv.branches?.name || 'Branch'}
                                    </td>
                                    <td>
                                      {inv.branches?.is_factory ? (
                                        <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>🏭 Factory</span>
                                      ) : (
                                        <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>🏪 Showroom</span>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', color: q > 0 ? '#15803d' : 'var(--text-muted)' }}>
                                      {q.toLocaleString()} pcs
                                    </td>
                                    <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                                      {cost > 0 ? `৳${formatAmount(cost)}` : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem' }}>
                                      {val > 0 ? `৳${formatAmount(val)}` : '—'}
                                    </td>
                                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                      {inv.updated_at ? new Date(inv.updated_at).toLocaleDateString() : '—'}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="modal-footer" style={{ padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
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
