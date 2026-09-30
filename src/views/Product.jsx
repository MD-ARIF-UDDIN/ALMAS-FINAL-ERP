import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Package, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Layers
} from 'lucide-react';
import { TableLoading } from '../components/TableLoading';
import Pagination from '../components/Pagination';
import { hasPermission } from '../utils/permissions';
import { formatAmount } from '../utils/format';

export default function Product({ userProfile, branches, addToast }) {
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

  const handleOpenCreate = () => {
    resetForm();
    const initBranchPrices = {};
    (branches || []).forEach((b) => {
      initBranchPrices[b.id] = { buyPrice: '', salePrice: '' };
    });
    setBranchPrices(initBranchPrices);
    setShowModal(true);
  };

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

        {/* Products Table */}
        <div className="table-container">
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
                    <th rowSpan={2} style={{ width: '85px', textAlign: 'center' }}>Actions</th>
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
                  <th style={{ width: '85px', textAlign: 'center' }}>Actions</th>
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
    </div>
  );
}
