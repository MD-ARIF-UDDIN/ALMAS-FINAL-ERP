import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Package, 
  Palette, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Layers
} from 'lucide-react';
import { TableLoading } from '../components/TableLoading';
import { hasPermission } from '../utils/permissions';

export default function Product({ userProfile, branches, addToast }) {
  const [activeTab, setActiveTab] = useState('items'); // 'items' | 'shades'
  const [products, setProducts] = useState([]);
  const [shades, setShades] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter and Search states
  const [itemSearch, setItemSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [shadeSearch, setShadeSearch] = useState('');
  const [shadeCardFilter, setShadeCardFilter] = useState('all');

  // Product Form states
  const [showProductModal, setShowProductModal] = useState(false);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editProductId, setEditProductId] = useState(null);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Sewing Thread');
  const [unit, setUnit] = useState('pcs');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [description, setDescription] = useState('');

  // Multi-Color Batch Selection
  const [selectedColorIds, setSelectedColorIds] = useState([]);
  const [colorSearchInModal, setColorSearchInModal] = useState('');

  // Shade Form states
  const [showShadeModal, setShowShadeModal] = useState(false);
  const [isEditingShade, setIsEditingShade] = useState(false);
  const [editShadeId, setEditShadeId] = useState(null);
  const [shadeCode, setShadeCode] = useState('');
  const [shadeName, setShadeName] = useState('');
  const [shadeCard, setShadeCard] = useState('Almas Standard');
  const [shadeHex, setShadeHex] = useState('#000000');

  // Permissions
  const canViewItems = hasPermission(userProfile, 'product.items_view') || hasPermission(userProfile, 'inventory.catalog_view');
  const canCreateItem = hasPermission(userProfile, 'product.items_create') || hasPermission(userProfile, 'inventory.catalog_create');
  const canDeleteItem = hasPermission(userProfile, 'product.items_delete') || hasPermission(userProfile, 'inventory.catalog_delete');
  const canViewShades = hasPermission(userProfile, 'product.shades_view') || true;
  const canCreateShade = hasPermission(userProfile, 'product.shades_create') || true;
  const canDeleteShade = hasPermission(userProfile, 'product.shades_delete') || true;

  useEffect(() => {
    fetchProducts();
    fetchShades();
  }, []);

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      showMessage('Failed to load product list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchShades = async () => {
    try {
      const { data, error } = await supabase
        .from('colors')
        .select('*')
        .order('code', { ascending: true });

      if (!error && data) {
        setShades(data);
      } else {
        const local = localStorage.getItem('almas_erp_color_shades');
        if (local) {
          setShades(JSON.parse(local));
        } else {
          setShades([]);
        }
      }
    } catch (err) {
      console.error('Error loading shades:', err);
      const local = localStorage.getItem('almas_erp_color_shades');
      if (local) setShades(JSON.parse(local));
    }
  };

  // Product CRUD
  const resetProductForm = () => {
    setSku('');
    setName('');
    setCategory('Sewing Thread');
    setUnit('pcs');
    setPurchasePrice('');
    setSalePrice('');
    setDescription('');
    setSelectedColorIds([]);
    setColorSearchInModal('');
    setIsEditingProduct(false);
    setEditProductId(null);
  };

  const handleOpenEditProduct = (prod) => {
    setSku(prod.sku);
    setName(prod.name);
    setCategory(prod.category || '');
    setUnit(prod.unit || 'pcs');
    setPurchasePrice(prod.purchase_price);
    setSalePrice(prod.sale_price);
    setDescription(prod.description || '');
    setSelectedColorIds([]);
    setIsEditingProduct(true);
    setEditProductId(prod.id);
    setShowProductModal(true);
  };

  const handleToggleColorInModal = (shadeId) => {
    setSelectedColorIds((prev) =>
      prev.includes(shadeId) ? prev.filter((id) => id !== shadeId) : [...prev, shadeId]
    );
  };

  const handleSelectAllFilteredColors = (filtered) => {
    const ids = filtered.map((f) => f.id);
    setSelectedColorIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleClearColors = () => {
    setSelectedColorIds([]);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim() || !purchasePrice || !salePrice) {
      showMessage('Please fill all required product fields.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (isEditingProduct) {
        // Single Edit
        const { error } = await supabase
          .from('products')
          .update({
            sku: sku.trim(),
            name: name.trim(),
            category: category.trim() || null,
            unit: unit.trim() || 'pcs',
            purchase_price: parseFloat(purchasePrice) || 0,
            sale_price: parseFloat(salePrice) || 0,
            description: description.trim() || null,
          })
          .eq('id', editProductId);

        if (error) throw error;
        showMessage(`Updated item "${name}".`, 'success');
      } else {
        // Create Product(s) - check if multiple colors are selected
        const selectedShades = shades.filter((s) => selectedColorIds.includes(s.id));

        if (selectedShades.length > 0) {
          // BATCH CREATE 1 PRODUCT RECORD PER SELECTED COLOR
          const newProductsToInsert = selectedShades.map((sh) => {
            const variantSku = `${sku.trim()}-${sh.code}`;
            const variantName = `${name.trim()} - #${sh.code} ${sh.name}`;
            return {
              sku: variantSku,
              name: variantName,
              category: category.trim() || null,
              unit: unit.trim() || 'pcs',
              purchase_price: parseFloat(purchasePrice) || 0,
              sale_price: parseFloat(salePrice) || 0,
              description: description.trim() || null,
              color_code: sh.code,
              color_name: sh.name,
            };
          });

          const { data: insertedProds, error } = await supabase
            .from('products')
            .insert(newProductsToInsert)
            .select();

          if (error) throw error;

          // Auto initialize inventory across all branches for every new product
          if (branches.length > 0 && insertedProds && insertedProds.length > 0) {
            const invRecords = [];
            for (const prod of insertedProds) {
              for (const branch of branches) {
                invRecords.push({
                  branch_id: branch.id,
                  product_id: prod.id,
                  quantity: 0,
                  min_stock_level: 5,
                });
              }
            }
            await supabase.from('inventory').insert(invRecords);
          }

          showMessage(`Successfully created ${insertedProds?.length || selectedShades.length} color variants of "${name}"!`, 'success');
        } else {
          // Single Product without color
          const { data: newProd, error } = await supabase
            .from('products')
            .insert([
              {
                sku: sku.trim(),
                name: name.trim(),
                category: category.trim() || null,
                unit: unit.trim() || 'pcs',
                purchase_price: parseFloat(purchasePrice) || 0,
                sale_price: parseFloat(salePrice) || 0,
                description: description.trim() || null,
              },
            ])
            .select()
            .single();

          if (error) throw error;

          if (branches.length > 0 && newProd) {
            const invRecords = branches.map((b) => ({
              branch_id: b.id,
              product_id: newProd.id,
              quantity: 0,
              min_stock_level: 5,
            }));
            await supabase.from('inventory').insert(invRecords);
          }

          showMessage(`Created item "${name}".`, 'success');
        }
      }

      resetProductForm();
      setShowProductModal(false);
      fetchProducts();
    } catch (err) {
      console.error('Error saving product:', err);
      showMessage(err.message || 'Failed to save product.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (prodId, prodName) => {
    if (!window.confirm(`Are you sure you want to delete "${prodName}"? This will remove all linked stock records.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('products').delete().eq('id', prodId);
      if (error) throw error;

      showMessage(`Deleted item "${prodName}".`, 'success');
      fetchProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      showMessage('Cannot delete item with linked sales or purchase transactions.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Shade CRUD
  const resetShadeForm = () => {
    setShadeCode('');
    setShadeName('');
    setShadeCard('Almas Standard');
    setShadeHex('#000000');
    setIsEditingShade(false);
    setEditShadeId(null);
  };

  const handleOpenEditShade = (sh) => {
    setShadeCode(sh.code);
    setShadeName(sh.name);
    setShadeCard(sh.shade_card || 'Almas Standard');
    setShadeHex(sh.hex_code || '#000000');
    setIsEditingShade(true);
    setEditShadeId(sh.id);
    setShowShadeModal(true);
  };

  const handleSaveShade = async (e) => {
    e.preventDefault();
    if (!shadeCode.trim() || !shadeName.trim()) {
      showMessage('Please provide both Shade Code and Color Name.', 'error');
      return;
    }

    try {
      if (isEditingShade) {
        const { error } = await supabase
          .from('colors')
          .update({
            code: shadeCode.trim(),
            name: shadeName.trim(),
            shade_card: shadeCard.trim() || 'Almas Standard',
            hex_code: shadeHex,
          })
          .eq('id', editShadeId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('colors')
          .insert([
            {
              code: shadeCode.trim(),
              name: shadeName.trim(),
              shade_card: shadeCard.trim() || 'Almas Standard',
              hex_code: shadeHex,
            },
          ]);

        if (error) throw error;
      }
      showMessage(`Saved shade #${shadeCode} (${shadeName}).`, 'success');
    } catch (err) {
      const updated = isEditingShade
        ? shades.map((s) => (s.id === editShadeId ? { ...s, code: shadeCode.trim(), name: shadeName.trim(), shade_card: shadeCard, hex_code: shadeHex } : s))
        : [...shades, { id: `shade-${Date.now()}`, code: shadeCode.trim(), name: shadeName.trim(), shade_card: shadeCard, hex_code: shadeHex }];

      setShades(updated);
      localStorage.setItem('almas_erp_color_shades', JSON.stringify(updated));
      showMessage(`Saved shade #${shadeCode} (${shadeName}) locally.`, 'success');
    }

    resetShadeForm();
    setShowShadeModal(false);
    fetchShades();
  };

  const handleDeleteShade = async (shadeId, code) => {
    if (!window.confirm(`Delete shade #${code}?`)) return;

    try {
      await supabase.from('colors').delete().eq('id', shadeId);
    } catch (e) {
      // Fallback local
    }

    const filtered = shades.filter((s) => s.id !== shadeId);
    setShades(filtered);
    localStorage.setItem('almas_erp_color_shades', JSON.stringify(filtered));
    showMessage(`Deleted shade #${code}.`, 'info');
  };

  // Filtered Items
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (p.color_code && p.color_code.toLowerCase().includes(itemSearch.toLowerCase()));
    const matchesCat = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  // Filtered Shades for Master Table
  const filteredShades = shades.filter((s) => {
    const matchesSearch =
      s.code.toLowerCase().includes(shadeSearch.toLowerCase()) ||
      s.name.toLowerCase().includes(shadeSearch.toLowerCase());
    const matchesCard = shadeCardFilter === 'all' || s.shade_card === shadeCardFilter;
    return matchesSearch && matchesCard;
  });

  // Filtered Shades inside Product Creation Modal
  const modalFilteredShades = shades.filter((s) => {
    return (
      s.code.toLowerCase().includes(colorSearchInModal.toLowerCase()) ||
      s.name.toLowerCase().includes(colorSearchInModal.toLowerCase())
    );
  });

  const shadeCards = Array.from(new Set(shades.map((s) => s.shade_card).filter(Boolean)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="top-bar">
        <div className="page-title-group">
          <h1>Product Master & Shade Book</h1>
        </div>
        <div className="top-bar-actions">
          {activeTab === 'items' && canCreateItem && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                resetProductForm();
                setShowProductModal(true);
              }}
            >
              <Plus size={16} />
              <span>Add New Item / Color Batch</span>
            </button>
          )}

          {activeTab === 'shades' && canCreateShade && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                resetShadeForm();
                setShowProductModal(false);
                setShowShadeModal(true);
              }}
            >
              <Plus size={16} />
              <span>Add Color Shade</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1rem' }}>
        <button
          className={`btn ${activeTab === 'items' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: '-1px' }}
          onClick={() => setActiveTab('items')}
        >
          <Package size={16} />
          <span>Item List ({products.length})</span>
        </button>
        <button
          className={`btn ${activeTab === 'shades' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: '-1px' }}
          onClick={() => setActiveTab('shades')}
        >
          <Palette size={16} />
          <span>Color & Shade Book ({shades.length})</span>
        </button>
      </div>

      {/* TAB 1: ITEM LIST */}
      {activeTab === 'items' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            {/* Filter Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, minWidth: '240px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input-control"
                    style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                    placeholder="Search SKU, Shade # or Name..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                  />
                </div>

                {categories.length > 0 && (
                  <select
                    className="input-control"
                    style={{ width: '180px', fontSize: '0.85rem' }}
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Showing {filteredProducts.length} of {products.length} items
              </div>
            </div>

            {/* Products Table */}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>SL</th>
                    <th style={{ width: '140px' }}>SKU / Code</th>
                    <th>Item Specification / Name</th>
                    <th style={{ width: '130px' }}>Color Shade</th>
                    <th style={{ width: '130px' }}>Category</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>UoM</th>
                    <th style={{ width: '105px', textAlign: 'right' }}>Cost (Buy)</th>
                    <th style={{ width: '105px', textAlign: 'right' }}>Price (Sale)</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableLoading colSpan={9} message="Loading item specifications..." />
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                        No items found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p, index) => (
                      <tr key={p.id}>
                        <td>{index + 1}</td>
                        <td>
                          <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--primary)' }}>
                            {p.sku}
                          </div>
                          {p.product_code && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {p.product_code}
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                        <td>
                          {p.color_code ? (
                            <span
                              className="badge"
                              style={{
                                backgroundColor: '#f1f5f9',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                              }}
                            >
                              #{p.color_code} {p.color_name ? `(${p.color_name})` : ''}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
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
                        <td style={{ textAlign: 'center', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 600 }}>
                          {p.unit || 'PCS'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ৳{parseFloat(p.purchase_price || 0).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success-text)' }}>
                          ৳{parseFloat(p.sale_price || 0).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenEditProduct(p)}
                              title="Edit item details"
                              style={{ padding: '0.2rem 0.45rem' }}
                            >
                              <Edit size={13} />
                            </button>
                            {canDeleteItem && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                title="Delete item"
                                style={{ padding: '0.2rem 0.45rem' }}
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
          </div>
        </div>
      )}

      {/* TAB 2: COLOR & SHADE BOOK */}
      {activeTab === 'shades' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            {/* Shade Filter Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, minWidth: '240px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input-control"
                    style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                    placeholder="Search Shade Code (e.g. 101, 405) or Color..."
                    value={shadeSearch}
                    onChange={(e) => setShadeSearch(e.target.value)}
                  />
                </div>

                {shadeCards.length > 0 && (
                  <select
                    className="input-control"
                    style={{ width: '180px', fontSize: '0.85rem' }}
                    value={shadeCardFilter}
                    onChange={(e) => setShadeCardFilter(e.target.value)}
                  >
                    <option value="all">All Shade Cards</option>
                    {shadeCards.map((sc) => (
                      <option key={sc} value={sc}>
                        {sc}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {filteredShades.length} shades registered
              </div>
            </div>

            {/* Shades Grid / Table */}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>SL</th>
                    <th style={{ width: '90px' }}>Swatch</th>
                    <th style={{ width: '120px' }}>Shade Code</th>
                    <th>Color Description</th>
                    <th style={{ width: '180px' }}>Shade Card Book</th>
                    <th style={{ width: '100px', fontFamily: 'monospace' }}>Hex Code</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShades.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                        No color shades found. Click "Add Color Shade" or "Preload Standard Shades".
                      </td>
                    </tr>
                  ) : (
                    filteredShades.map((s, index) => (
                      <tr key={s.id || index}>
                        <td>{index + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                backgroundColor: s.hex_code || '#000',
                                border: '1px solid rgba(0,0,0,0.2)',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                              }}
                            />
                          </div>
                        </td>
                        <td style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--primary)' }}>
                          #{s.code}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                        <td>
                          <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                            {s.shade_card || 'Almas Standard'}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {s.hex_code || '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenEditShade(s)}
                              title="Edit shade"
                              style={{ padding: '0.2rem 0.45rem' }}
                            >
                              <Edit size={13} />
                            </button>
                            {canDeleteShade && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteShade(s.id, s.code)}
                                title="Delete shade"
                                style={{ padding: '0.2rem 0.45rem' }}
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
          </div>
        </div>
      )}

      {/* CREATE / EDIT PRODUCT MODAL (WITH MULTI-COLOR BATCH SUPPORT) */}
      {showProductModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px', width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {isEditingProduct ? 'Edit Item Specification' : 'Add Item / Multi-Color Batch'}
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowProductModal(false)} style={{ borderRadius: '50%', padding: '0.35rem 0.5rem', border: 'none' }}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Base SKU / Prefix *</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. SSP-40-2"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. Sewing Thread, Zipper"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Item Name / Specification *</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. Sewing Thread 40/2 (5000M)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Unit of Measure *</label>
                    <select
                      className="input-control"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      required
                    >
                      <option value="pcs">Cone / Pcs</option>
                      <option value="box">Box</option>
                      <option value="gross">Gross</option>
                      <option value="meter">Meter</option>
                      <option value="kg">Kg</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Cost Price (৳) *</label>
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
                    <label>Sale Price (৳) *</label>
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

                {/* MULTI-COLOR BATCH SELECTOR (For New Products) */}
                {!isEditingProduct && (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0.85rem', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                      <div>
                        <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          Select Colors (Each will be created as a separate variant)
                        </label>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {selectedColorIds.length > 0
                            ? `Selected ${selectedColorIds.length} colors. Each will generate SKU like: "${sku || 'SKU'}-101"`
                            : 'Optional: leave empty to create a single base item without color.'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSelectAllFilteredColors(modalFilteredShades)}
                          style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', backgroundColor: '#fff' }}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleClearColors}
                          style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', backgroundColor: '#fff' }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                      <Search size={13} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="input-control"
                        style={{ paddingLeft: '1.8rem', paddingHeight: '30px', fontSize: '0.78rem', backgroundColor: '#fff' }}
                        placeholder="Search shades to pick (e.g. 101, Navy, Red)..."
                        value={colorSearchInModal}
                        onChange={(e) => setColorSearchInModal(e.target.value)}
                      />
                    </div>

                    {/* Color Swatch Checkbox Pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '160px', overflowY: 'auto', padding: '0.2rem' }}>
                      {modalFilteredShades.map((sh) => {
                        const isSelected = selectedColorIds.includes(sh.id);
                        return (
                          <label
                            key={sh.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: isSelected ? '#fff' : 'transparent',
                              border: isSelected ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: isSelected ? 700 : 400,
                              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                              boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleColorInModal(sh.id)}
                              style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                            />
                            <div
                              style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor: sh.hex_code || '#000',
                                border: '1px solid rgba(0,0,0,0.2)',
                              }}
                            />
                            <span>#{sh.code} {sh.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Description / Technical Notes</label>
                  <textarea
                    className="input-control"
                    style={{ minHeight: '55px', resize: 'vertical' }}
                    placeholder="100% Spun Polyester, High Tenacity, Lubricated..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {isEditingProduct
                    ? 'Save Changes'
                    : selectedColorIds.length > 0
                    ? `Create ${selectedColorIds.length} Color Variants`
                    : 'Create Single Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SHADE MODAL */}
      {showShadeModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', width: '100%' }}>
            <div className="modal-header">
              <h3 className="modal-title">{isEditingShade ? 'Edit Color Shade' : 'Add Color Shade'}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowShadeModal(false)} style={{ borderRadius: '50%', padding: '0.35rem 0.5rem', border: 'none' }}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveShade}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Shade Code *</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. 101, 405, 999"
                      value={shadeCode}
                      onChange={(e) => setShadeCode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Shade Card Book</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. Almas Standard, Coats, Astra"
                      value={shadeCard}
                      onChange={(e) => setShadeCard(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Color Description / Name *</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. Midnight Navy Blue"
                    value={shadeName}
                    onChange={(e) => setShadeName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Visual Color Swatch (Hex Picker)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="color"
                      value={shadeHex}
                      onChange={(e) => setShadeHex(e.target.value)}
                      style={{ width: '48px', height: '38px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)', padding: 0 }}
                    />
                    <input
                      type="text"
                      className="input-control"
                      style={{ fontFamily: 'monospace', maxWidth: '140px' }}
                      value={shadeHex}
                      onChange={(e) => setShadeHex(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowShadeModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {isEditingShade ? 'Save Changes' : 'Add Shade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
