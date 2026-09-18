import React, { useState, useEffect } from 'react';
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
import { hasPermission } from '../utils/permissions';

export default function Product({ userProfile, branches, addToast }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form Fields: Product Code, Name, Category, Description, Buy Price, Sell Price
  const [productCode, setProductCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');

  // Permissions
  const canView = hasPermission(userProfile, 'product.items_view') || hasPermission(userProfile, 'product.view') || hasPermission(userProfile, 'inventory.catalog_view');
  const canCreate = hasPermission(userProfile, 'product.items_create') || hasPermission(userProfile, 'inventory.catalog_create');
  const canDelete = hasPermission(userProfile, 'product.items_delete') || hasPermission(userProfile, 'inventory.catalog_delete');

  useEffect(() => {
    fetchProducts();
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

  const resetForm = () => {
    setProductCode('');
    setName('');
    setCategory('');
    setDescription('');
    setPurchasePrice('');
    setSalePrice('');
    setIsEditing(false);
    setEditId(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEdit = (prod) => {
    setProductCode(prod.product_code || prod.sku || '');
    setName(prod.name || '');
    setCategory(prod.category || '');
    setDescription(prod.description || '');
    setPurchasePrice(prod.purchase_price ?? '');
    setSalePrice(prod.sale_price ?? '');
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
    const buyPriceNum = parseFloat(purchasePrice) || 0;
    const sellPriceNum = parseFloat(salePrice) || 0;

    if (!cleanCode) {
      showMessage('Please provide a Product Code.', 'error');
      return;
    }

    setSaving(true);
    try {
      const displayName = cleanName || cleanCode;
      const payload = {
        sku: cleanCode,
        product_code: cleanCode,
        name: displayName,
        category: cleanCategory || null,
        description: cleanDesc || null,
        purchase_price: buyPriceNum,
        sale_price: sellPriceNum,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editId);

        if (error) throw error;
        showMessage(`Updated product "${displayName}".`, 'success');
      } else {
        const { data: newProd, error } = await supabase
          .from('products')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        // Auto initialize inventory across all branches
        if (branches && branches.length > 0 && newProd) {
          const invRecords = branches.map((b) => ({
            branch_id: b.id,
            product_id: newProd.id,
            quantity: 0,
            min_stock_level: 5,
          }));
          await supabase.from('inventory').insert(invRecords);
        }

        showMessage(`Created product "${displayName}".`, 'success');
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
    if (!window.confirm(`Are you sure you want to delete "${prodName}"? This will remove all linked inventory records.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('products').delete().eq('id', prodId);
      if (error) throw error;

      showMessage(`Deleted product "${prodName}".`, 'success');
      fetchProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      showMessage('Cannot delete product with linked sales or purchase transactions.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const codeMatch = (p.product_code || p.sku || '').toLowerCase().includes(q);
    const nameMatch = (p.name || '').toLowerCase().includes(q);
    const descMatch = (p.description || '').toLowerCase().includes(q);
    const catMatch = (p.category || '').toLowerCase().includes(q);
    const matchesSearch = codeMatch || nameMatch || descMatch || catMatch;

    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header */}
      <div className="top-bar">
        <div className="page-title-group">
          <h1>Product Master</h1>
        </div>
        <div className="top-bar-actions">
          {canCreate && (
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              <Plus size={16} />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Card */}
      <div className="card">
        {/* Search & Category Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, minWidth: '260px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
              <Search 
                size={15} 
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
              />
              <input
                type="text"
                className="input-control"
                style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                placeholder="Search by Code, Name, Category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Showing {filteredProducts.length} of {products.length} products
          </div>
        </div>

        {/* Products Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>SL</th>
                <th style={{ width: '150px' }}>Product Code</th>
                <th style={{ width: '240px' }}>Product Name</th>
                <th style={{ width: '140px' }}>Category</th>
                <th>Description</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Buy Price</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Sell Price</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoading colSpan={8} message="Loading products..." />
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <Package size={36} style={{ color: 'var(--border-focus)', opacity: 0.5 }} />
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No products found</div>
                      <div style={{ fontSize: '0.8rem' }}>
                        {searchQuery || categoryFilter !== 'all'
                          ? 'Try adjusting your search or category filter.' 
                          : 'Click "Add Product" above to create your first product.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, index) => (
                  <tr key={p.id}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {index + 1}
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
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      ৳{parseFloat(p.purchase_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success-text)' }}>
                      ৳{parseFloat(p.sale_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEdit(p)}
                          title="Edit product"
                          style={{ padding: '0.25rem 0.45rem' }}
                        >
                          <Edit size={13} />
                        </button>
                        {canDelete && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            title="Delete product"
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
      </div>

      {/* CREATE / EDIT PRODUCT MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px', width: '95vw' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {isEditing ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowModal(false)} 
                style={{ borderRadius: '50%', padding: '0.35rem 0.5rem', border: 'none' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProduct}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Product Code *</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. PRD-101, THREAD-40-2"
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
                      placeholder="e.g. Thread, Zipper"
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
                    placeholder="e.g. Sewing Thread 40/2 (5000m) (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Buy Price (৳) *</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input-control"
                      placeholder="0.00"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Sell Price (৳) *</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
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
                    style={{ minHeight: '75px', resize: 'vertical' }}
                    placeholder="Product notes or description..."
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
                  {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
