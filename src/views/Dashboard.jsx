import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { LayoutDashboard, TrendingUp, ShoppingBag, Receipt, AlertCircle, ShoppingCart } from 'lucide-react';
import { TableLoading } from '../components/TableLoading';

export default function Dashboard({ userProfile, branches }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sales: 0, purchases: 0, expenses: 0, profit: 0 });
  const [lowStockCount, setLowStockCount] = useState(0);
  const [recentSales, setRecentSales] = useState([]);

  const role = userProfile?.role || 'staff';
  const myBranchId = userProfile?.branch_id;

  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    if (role === 'owner') return 'all';
    return myBranchId || (branches.length > 0 ? branches[0].id : '');
  });

  useEffect(() => {
    if (!selectedBranchId) {
      if (role === 'owner') {
        setSelectedBranchId('all');
      } else {
        setSelectedBranchId(myBranchId || (branches.length > 0 ? branches[0].id : ''));
      }
    }
  }, [branches, userProfile, role, myBranchId, selectedBranchId]);

  useEffect(() => {
    if (selectedBranchId) {
      fetchDashboardStats();
    }
  }, [selectedBranchId]);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      // 1. Fetch Sales Revenue
      let salesQuery = supabase.from('sales').select('net_amount');
      if (selectedBranchId !== 'all' && selectedBranchId) {
        salesQuery = salesQuery.eq('branch_id', selectedBranchId);
      }
      const { data: sales } = await salesQuery;
      const salesTotal = (sales || []).reduce((sum, s) => sum + s.net_amount, 0);

      // 2. Fetch Purchase Bills
      let purchasesQuery = supabase.from('purchases').select('net_amount');
      if (selectedBranchId !== 'all' && selectedBranchId) {
        purchasesQuery = purchasesQuery.eq('branch_id', selectedBranchId);
      }
      const { data: purchases } = await purchasesQuery;
      const purchasesTotal = (purchases || []).reduce((sum, p) => sum + p.net_amount, 0);

      // 3. Fetch Expense Payouts
      let expensesQuery = supabase.from('expenses').select('amount');
      if (selectedBranchId !== 'all' && selectedBranchId) {
        expensesQuery = expensesQuery.eq('branch_id', selectedBranchId);
      }
      const { data: expenses } = await expensesQuery;
      const expensesTotal = (expenses || []).reduce((sum, e) => sum + e.amount, 0);

      // Calculate Gross Profit = Sales - Procurement Costs (simplified for Dashboard, P&L handles COGS)
      const profitTotal = salesTotal - purchasesTotal - expensesTotal;

      setStats({
        sales: salesTotal,
        purchases: purchasesTotal,
        expenses: expensesTotal,
        profit: profitTotal,
      });

      // 4. Fetch Low Stock Inventory Count
      let stockQuery = supabase
        .from('inventory')
        .select('id, quantity, min_stock_level');

      if (selectedBranchId !== 'all' && selectedBranchId) {
        stockQuery = stockQuery.eq('branch_id', selectedBranchId);
      }
      const { data: stock } = await stockQuery;
      const lowCount = (stock || []).filter((s) => s.quantity <= (s.min_stock_level || 5)).length;
      setLowStockCount(lowCount);

      // 5. Fetch Recent Sales
      let recentQuery = supabase
        .from('sales')
        .select(`
          id,
          invoice_number,
          sale_date,
          net_amount,
          payment_status,
          contacts (
            name
          )
        `)
        .order('sale_date', { ascending: false })
        .limit(5);

      if (selectedBranchId !== 'all' && selectedBranchId) {
        recentQuery = recentQuery.eq('branch_id', selectedBranchId);
      }
      const { data: recSales } = await recentQuery;
      setRecentSales(recSales || []);

    } catch (err) {
      console.error('Error loading dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="top-bar">
        <div className="page-title-group">
          <h1>Welcome, {userProfile?.full_name || 'Staff User'}!</h1>
        </div>

        <div className="top-bar-actions">
          {role === 'owner' && (
            <div className="form-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ whiteSpace: 'nowrap' }}>Filter Branch:</label>
              <select
                className="input-control"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                style={{ width: '200px' }}
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* DASHBOARD STATS */}
      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon success">
            <TrendingUp size={24} />
          </div>
          <div className="stat-data">
            <span className="stat-label">Total Sales Invoice</span>
            <span className="stat-value">৳{stats.sales.toFixed(2)}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon warning">
            <ShoppingBag size={24} />
          </div>
          <div className="stat-data">
            <span className="stat-label">Total Purchases</span>
            <span className="stat-value">৳{stats.purchases.toFixed(2)}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon danger">
            <Receipt size={24} />
          </div>
          <div className="stat-data">
            <span className="stat-label">Overhead Expenses</span>
            <span className="stat-value">৳{stats.expenses.toFixed(2)}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon primary">
            <LayoutDashboard size={24} />
          </div>
          <div className="stat-data">
            <span className="stat-label">Cash Margin (Profit)</span>
            <span className="stat-value" style={{ color: stats.profit >= 0 ? 'var(--primary-dark)' : 'var(--danger-text)' }}>
              ৳{stats.profit.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* BODY SECTIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Recent Activity List */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Branch Sales (Last 5)</h3>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>SL</th>
                  <th>Invoice ID</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoading colSpan={5} message="Fetching recent transactions..." />
                ) : recentSales.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      No recent sales recorded.
                    </td>
                  </tr>
                ) : (
                  recentSales.map((sale, index) => (
                    <tr key={sale.id}>
                      <td>{index + 1}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem' }}>
                        {sale.invoice_number || `INV#${sale.id.substring(0, 8).toUpperCase()}`}
                      </td>
                      <td>{sale.contacts?.name || 'Walk-in'}</td>
                      <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                        ৳{sale.net_amount.toFixed(2)}
                      </td>
                      <td>
                        <span className={`badge badge-${sale.payment_status}`}>{sale.payment_status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shortcuts and Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Low Stock Warning Alert */}
          {lowStockCount > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                backgroundColor: 'var(--danger-light)',
                border: '1.5px solid #fca5a5',
                color: 'var(--danger-text)',
                padding: '1.5rem',
                borderRadius: 'var(--border-radius)',
              }}
            >
              <AlertCircle size={32} style={{ flexShrink: 0 }} />
              <div>
                <h4 style={{ fontWeight: 700, marginBottom: '0.15rem' }}>Low Stock Warning!</h4>
                <p style={{ fontSize: '0.88rem' }}>
                  There are <strong>{lowStockCount}</strong> product items in this branch running below the safe minimum level.
                </p>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ marginTop: '0.75rem', padding: '0.35rem 0.75rem' }}
                  onClick={() => navigate('/inventory')}
                >
                  View Inventory Stock
                </button>
              </div>
            </div>
          )}

          {/* Quick Shortcuts */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Quick Action Shortcuts</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="btn btn-primary"
                style={{ justifyContent: 'flex-start', padding: '0.55rem 1rem' }}
                onClick={() => navigate('/sales')}
              >
                <ShoppingCart size={18} />
                <span>New Sale / Create Bill</span>
              </button>
              <button
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '0.55rem 1rem' }}
                onClick={() => navigate('/inventory')}
              >
                <span>Add New Item (Thread/Yarn/Button)</span>
              </button>
              {role === 'owner' && (
                <button
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '0.55rem 1rem' }}
                  onClick={() => navigate('/users')}
                >
                  <span>Add New Staff / Employee</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
