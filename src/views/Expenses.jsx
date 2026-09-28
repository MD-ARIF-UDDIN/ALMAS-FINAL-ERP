import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Plus, Search, Trash2, Receipt, CreditCard } from 'lucide-react';
import { TableLoading } from '../components/TableLoading';
import Pagination from '../components/Pagination';

export default function Expenses({ userProfile, branches, addToast }) {
  const location = useLocation();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Expense states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [category, setCategory] = useState('utilities');
  const [customCategory, setCustomCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (location.state?.openCreateExpense) {
      setShowCreateModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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

  const categoriesList = [
    { id: 'raw_materials', name: 'Raw Materials & Yarn' },
    { id: 'factory_maintenance', name: 'Factory & Machine Maintenance' },
    { id: 'utilities', name: 'Factory/Office Utilities (Power/Water)' },
    { id: 'rent', name: 'Factory/Office Rent' },
    { id: 'salaries', name: 'Staff & Labor Wages' },
    { id: 'transport', name: 'Transport & Carriage' },
    { id: 'packaging', name: 'Packaging Materials (Cones/Cartons)' },
    { id: 'marketing', name: 'Marketing & Sales Commission' },
    { id: 'others', name: 'Others (Custom)' },
  ];

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const fetchExpenses = useCallback(async () => {
    if (!selectedBranchId) return;
    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('expenses')
        .select(`
          *,
          profiles (
            full_name
          )
        `, { count: 'exact' });

      if (userProfile?.role === 'owner') {
        if (selectedBranchId && selectedBranchId !== 'all') {
          query = query.eq('branch_id', selectedBranchId);
        }
      } else if (selectedBranchId) {
        query = query.eq('branch_id', selectedBranchId);
      }

      if (searchQuery.trim()) {
        query = query.or(`description.ilike.%${searchQuery.trim()}%,category.ilike.%${searchQuery.trim()}%`);
      }

      query = query.order('expense_date', { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      setExpenses(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error(err);
      showMessage('Failed to load expenses list.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, page, pageSize, searchQuery, userProfile?.role]);

  useEffect(() => {
    if (selectedBranchId) {
      fetchExpenses();
    }
  }, [selectedBranchId, fetchExpenses]);

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      showMessage('Please enter a valid expense amount.', 'error');
      return;
    }

    if (category === 'others' && !customCategory.trim()) {
      showMessage('Please provide a name for the custom category.', 'error');
      return;
    }

    setLoading(true);
    try {
      const finalCategory = category === 'others' && customCategory ? customCategory : category;
      const expenseAmount = parseFloat(amount);

      // 1. Insert into expenses table
      const { data: expData, error: expError } = await supabase
        .from('expenses')
        .insert([
          {
            branch_id: selectedBranchId,
            category: finalCategory,
            amount: expenseAmount,
            description: description || null,
            expense_date: expenseDate,
            payment_method: paymentMethod,
            created_by: userProfile.id,
          },
        ])
        .select();

      if (expError) throw expError;
      const expenseId = expData[0].id;

      // 2. Insert cash_ledger cash-out record
      const { error: ledgerError } = await supabase.from('cash_ledger').insert([
        {
          branch_id: selectedBranchId,
          amount_in: 0,
          amount_out: expenseAmount,
          reference_id: expenseId,
          description: `Business Expense [${finalCategory.toUpperCase()}]: ${description || 'No details'} (${paymentMethod})`,
          transaction_date: new Date(expenseDate).toISOString(),
          created_by: userProfile.id,
        },
      ]);

      if (ledgerError) throw ledgerError;

      showMessage('Expense logged and ledger updated successfully!', 'success');
      resetForm();
      setShowCreateModal(false);
      
      // Refresh list
      fetchExpenses();
    } catch (err) {
      console.error(err);
      showMessage('Failed to record expense.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (id, expAmount, expMethod) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;

    setLoading(true);
    try {
      // 1. Delete from expenses table
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;

      // 2. Add an adjusting ledger record (money back in) to correct the cash account
      const { error: ledgerError } = await supabase.from('cash_ledger').insert([
        {
          branch_id: selectedBranchId,
          amount_in: expAmount,
          amount_out: 0,
          reference_id: id,
          description: `Reversal / Deletion of Expense ID #${id.substring(0, 8).toUpperCase()}`,
          transaction_date: new Date().toISOString(),
          created_by: userProfile.id,
        },
      ]);
      if (ledgerError) throw ledgerError;

      showMessage('Expense record removed and cash adjusted.', 'success');
      fetchExpenses();
    } catch (err) {
      console.error(err);
      showMessage('Failed to delete expense record.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setCustomCategory('');
    setCategory('utilities');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('cash');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="top-bar">
        <div className="page-title-group">
          <h1>Expense Ledger</h1>
        </div>
        <div className="top-bar-actions">
          {userProfile?.role === 'owner' && branches.length > 0 && (
            <div className="form-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ whiteSpace: 'nowrap' }}>Active Branch:</label>
              <select
                className="input-control"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                style={{ width: '200px' }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.is_factory ? `🏭 ${b.name}` : `🏪 ${b.name}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button 
            className="btn btn-primary"
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} />
            <span>Create Expense</span>
          </button>
        </div>
      </div>

      {/* Expenses List occupying full width */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '1rem 1.25rem' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Expense History</h3>
            <div className="catalog-search-bar" style={{ width: '240px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input-control"
                  style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                  placeholder="Filter expenses..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="table-container" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>SL</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoading colSpan={7} message="Fetching expense records..." />
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                      No expenses logged for this branch.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp, index) => {
                    const rowNumber = (page - 1) * pageSize + index + 1;
                    return (
                      <tr key={exp.id}>
                        <td>{rowNumber}</td>
                        <td>{new Date(exp.expense_date).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                          {exp.category.replace('_', ' ')}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{exp.description || 'N/A'}</td>
                        <td style={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: 'var(--danger-text)' }}>
                          -৳{exp.amount.toFixed(2)}
                        </td>
                        <td style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}>
                          {exp.payment_method.replace('_', ' ')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm btn-icon"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => handleDeleteExpense(exp.id, exp.amount, exp.payment_method)}
                              title="Delete Log"
                            >
                              <Trash2 size={14} />
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
            currentPage={page}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* CREATE EXPENSE MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '100%' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Expense</h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }} 
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateExpense}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label>Expense Category *</label>
                  <select
                    className="input-control"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {category === 'others' && (
                  <div className="form-group">
                    <label>Specify Custom Category *</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. Stationery, Repair, Tea"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Amount Spent (৳) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="input-control"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Expense Date *</label>
                    <input
                      type="date"
                      className="input-control"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Paid From (Payment Account) *</label>
                  <select
                    className="input-control"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    required
                  >
                    <option value="cash">Cash In Hand</option>
                    <option value="bank">Bank / Card Account</option>
                    <option value="mobile_banking">Mobile Money (bKash/Nagad)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Description / Details</label>
                  <textarea
                    className="input-control"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    placeholder="e.g. Electric bill for July 2026"
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
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Create Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
