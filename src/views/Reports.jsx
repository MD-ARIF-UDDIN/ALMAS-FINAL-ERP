import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart3, Calendar, DollarSign, ArrowUpRight, ArrowDownRight, Printer, Receipt, FileText, ShoppingBag, CreditCard } from 'lucide-react';
import { TableLoading } from '../components/TableLoading';

export default function Reports({ userProfile, branches }) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Date filters (Default: Start of current month to today)
  const defaultStart = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  };
  const defaultEnd = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(defaultEnd());

  const role = userProfile?.role || 'staff';
  const myBranchId = userProfile?.branch_id;

  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    if (role === 'owner') return 'all';
    return myBranchId || (branches.length > 0 ? branches[0].id : '');
  });

  const handlePresetChange = (preset) => {
    const today = new Date();
    let start, end;

    if (preset === 'today') {
      start = new Date();
      end = new Date();
    } else if (preset === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      start = yesterday;
      end = yesterday;
    } else if (preset === 'week') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const tempDate = new Date(today);
      tempDate.setDate(diff);
      start = tempDate;
      end = new Date();
    } else if (preset === 'last_7_days') {
      const last7 = new Date();
      last7.setDate(last7.getDate() - 6);
      start = last7;
      end = new Date();
    } else if (preset === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date();
    } else if (preset === 'last_month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (preset === 'last_30_days') {
      const last30 = new Date();
      last30.setDate(last30.getDate() - 29);
      start = last30;
      end = new Date();
    } else if (preset === 'year') {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date();
    } else if (preset === 'last_year') {
      start = new Date(today.getFullYear() - 1, 0, 1);
      end = new Date(today.getFullYear() - 1, 11, 31);
    }

    if (start && end) {
      // Offset timezone to avoid UTC shifts
      const startLocal = new Date(start.getTime() - start.getTimezoneOffset() * 60000);
      const endLocal = new Date(end.getTime() - end.getTimezoneOffset() * 60000);
      setStartDate(startLocal.toISOString().split('T')[0]);
      setEndDate(endLocal.toISOString().split('T')[0]);
    }
  };

  const handleMonthFilter = (monthVal) => {
    if (!monthVal) return;
    const [year, monthIndex] = monthVal.split('-');
    const start = new Date(parseInt(year), parseInt(monthIndex), 1);
    const end = new Date(parseInt(year), parseInt(monthIndex) + 1, 0);

    const startLocal = new Date(start.getTime() - start.getTimezoneOffset() * 60000);
    const endLocal = new Date(end.getTime() - end.getTimezoneOffset() * 60000);
    setStartDate(startLocal.toISOString().split('T')[0]);
    setEndDate(endLocal.toISOString().split('T')[0]);
  };

  const getMonthOptions = () => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const label = d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
      const value = `${d.getFullYear()}-${d.getMonth()}`;
      options.push({ label, value });
    }
    return options;
  };

  // Financial aggregates
  const [revenue, setRevenue] = useState(0);
  const [purchasesTotal, setPurchasesTotal] = useState(0);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const [netProfit, setNetProfit] = useState(0);

  // Cash balances (Ledger accounts)
  const [cashBalance, setCashBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  const [mobileBalance, setMobileBalance] = useState(0);

  // Audit list logs
  const [salesList, setSalesList] = useState([]);
  const [purchasesList, setPurchasesList] = useState([]);
  const [expensesList, setExpensesList] = useState([]);
  const [activeAuditTab, setActiveAuditTab] = useState('sales'); // 'sales', 'purchases', 'expenses'

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
      calculateProfitLoss();
      calculateLedgerBalances();
    }
  }, [selectedBranchId, startDate, endDate]);

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const calculateProfitLoss = async () => {
    setLoading(true);
    try {
      // 1. Fetch Sales and calculate Revenue
      let salesQuery = supabase
        .from('sales')
        .select(`
          id, 
          invoice_number, 
          sale_date, 
          net_amount, 
          paid_amount, 
          payment_status,
          contacts (
            name
          )
        `)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate);

      if (selectedBranchId !== 'all' && selectedBranchId) {
        salesQuery = salesQuery.eq('branch_id', selectedBranchId);
      }

      const { data: sales, error: salesError } = await salesQuery;
      if (salesError) throw salesError;

      const totalRevenue = sales.reduce((sum, s) => sum + s.net_amount, 0);
      setRevenue(totalRevenue);
      setSalesList(sales || []);

      // 2. Fetch Purchases for the same period and calculate Total Purchases
      let purQuery = supabase
        .from('purchases')
        .select(`
          id,
          invoice_number,
          purchase_date,
          net_amount,
          paid_amount,
          payment_status,
          contacts (
            name
          )
        `)
        .gte('purchase_date', startDate)
        .lte('purchase_date', endDate);

      if (selectedBranchId !== 'all' && selectedBranchId) {
        purQuery = purQuery.eq('branch_id', selectedBranchId);
      }

      const { data: purchases, error: purError } = await purQuery;
      if (purError) throw purError;
      setPurchasesList(purchases || []);

      const totalPurchases = purchases.reduce((sum, p) => sum + p.net_amount, 0);
      setPurchasesTotal(totalPurchases);

      // 3. Fetch Expenses
      let expQuery = supabase
        .from('expenses')
        .select(`
          id,
          category,
          amount,
          description,
          expense_date,
          payment_method
        `)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      if (selectedBranchId !== 'all' && selectedBranchId) {
        expQuery = expQuery.eq('branch_id', selectedBranchId);
      }

      const { data: expenses, error: expError } = await expQuery;
      if (expError) throw expError;

      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      setExpensesTotal(totalExpenses);
      setExpensesList(expenses || []);

      // 4. Net Profit calculation
      const grossProfit = totalRevenue - totalPurchases;
      setNetProfit(grossProfit - totalExpenses);
    } catch (err) {
      console.error(err);
      showMessage('Error calculating financial metrics.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateLedgerBalances = async () => {
    try {
      // Query cash ledger entries
      let query = supabase.from('cash_ledger').select('account_type, type, amount');

      if (selectedBranchId !== 'all' && selectedBranchId) {
        query = query.eq('branch_id', selectedBranchId);
      }

      const { data: entries, error } = await query;
      if (error) throw error;

      let cashSum = 0;
      let bankSum = 0;
      let mobileSum = 0;

      (entries || []).forEach((entry) => {
        const amt = entry.amount;
        const multiplier = entry.type === 'in' ? 1 : -1;
        const delta = amt * multiplier;

        if (entry.account_type === 'cash') {
          cashSum += delta;
        } else if (entry.account_type === 'bank') {
          bankSum += delta;
        } else if (entry.account_type === 'mobile_banking') {
          mobileSum += delta;
        }
      });

      setCashBalance(cashSum);
      setBankBalance(bankSum);
      setMobileBalance(mobileSum);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const activeBranchName = selectedBranchId === 'all' 
    ? 'All Branches Combined' 
    : (branches.find(b => b.id === selectedBranchId)?.name || 'Main Factory Outlet');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* FILTER BAR PANEL */}
      <div className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
        padding: '0.75rem 1rem',
        backgroundColor: '#ffffff',
        borderRadius: 'var(--border-radius)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div className="page-title-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>Profit & Loss Reports</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Branch Select */}
          {role === 'owner' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Branch:</span>
              <select
                className="input-control"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                style={{ width: '140px', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
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

          {/* Date Picker Group */}
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            alignItems: 'center',
            backgroundColor: 'var(--bg-app)',
            padding: '0.3rem 0.6rem',
            borderRadius: 'var(--border-radius-sm)',
            border: '1px solid var(--border-color)'
          }}>
            <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              type="date"
              style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', padding: 0, width: '105px', color: 'var(--text-primary)', outline: 'none' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 0.15rem' }}>to</span>
            <input
              type="date"
              style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', padding: 0, width: '105px', color: 'var(--text-primary)', outline: 'none' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <button className="btn btn-secondary btn-sm" onClick={handlePrint} style={{ padding: '0.4rem 0.75rem' }}>
            <Printer size={14} />
            <span style={{ fontSize: '0.8rem' }}>Print</span>
          </button>
        </div>
      </div>

      {/* QUICK PRESET FILTERS BAR */}
      <div className="no-print" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
        padding: '0.5rem 1rem',
        backgroundColor: '#f8fafc',
        borderRadius: 'var(--border-radius-sm)',
        border: '1px solid var(--border-color)',
        marginTop: '-1rem',
        fontSize: '0.8rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Quick Range:</span>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => handlePresetChange('today')}
          >
            Today
          </button>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => handlePresetChange('yesterday')}
          >
            Yesterday
          </button>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => handlePresetChange('week')}
          >
            This Week
          </button>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => handlePresetChange('last_7_days')}
          >
            Last 7 Days
          </button>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => handlePresetChange('month')}
          >
            This Month
          </button>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => handlePresetChange('last_month')}
          >
            Last Month
          </button>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => handlePresetChange('last_30_days')}
          >
            Last 30 Days
          </button>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => handlePresetChange('year')}
          >
            This Year
          </button>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => handlePresetChange('last_year')}
          >
            Last Year
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Specific Month:</span>
          <select
            className="input-control"
            style={{ width: '170px', padding: '0.2rem 0.4rem', fontSize: '0.75rem', height: 'auto' }}
            onChange={(e) => handleMonthFilter(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>Select Month...</option>
            {getMonthOptions().map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message.text && (
        <div
          className="no-print"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: message.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            color: message.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
            border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            fontWeight: 500,
            fontSize: '0.85rem',
          }}
        >
          {message.text}
        </div>
      )}

      {/* PRINT HEADERS - SHOWS ONLY ON PRINT */}
      <div className="print-only" style={{ marginBottom: '1.5rem', borderBottom: '2px solid var(--text-primary)', paddingBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>Almas Accessories ERP</h2>
        <h3 style={{ fontSize: '1.1rem', margin: '0.35rem 0 0.15rem 0', color: 'var(--text-secondary)' }}>Statement of Profit or Loss (Audit Report)</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
          <span><strong>Branch Office:</strong> {activeBranchName}</span>
          <span><strong>Reporting Period:</strong> {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}</span>
        </div>
      </div>

      {/* COMPACT FINANCIAL STATS CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '0.75rem'
      }}>
        {/* Card 1: Sales Revenue */}
        <div className="card" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          padding: '0.75rem 1rem',
          borderLeft: '4px solid #10b981',
          backgroundColor: '#ffffff'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            backgroundColor: '#ecfdf5',
            color: '#10b981',
            flexShrink: 0
          }}>
            <ArrowUpRight size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Sales</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>৳{revenue.toFixed(2)}</span>
          </div>
        </div>

        {/* Card 2: Total Purchases */}
        <div className="card" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          padding: '0.75rem 1rem',
          borderLeft: '4px solid #f59e0b',
          backgroundColor: '#ffffff'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            backgroundColor: '#fffbeb',
            color: '#f59e0b',
            flexShrink: 0
          }}>
            <ArrowDownRight size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Purchases</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>৳{purchasesTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Card 3: Expenses */}
        <div className="card" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          padding: '0.75rem 1rem',
          borderLeft: '4px solid #ef4444',
          backgroundColor: '#ffffff'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            backgroundColor: '#fef2f2',
            color: '#ef4444',
            flexShrink: 0
          }}>
            <ArrowDownRight size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Operating Expenses</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>৳{expensesTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Card 4: Net Profit */}
        <div className="card" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          padding: '0.75rem 1rem',
          borderLeft: `4px solid ${netProfit >= 0 ? '#4f46e5' : '#ef4444'}`,
          backgroundColor: '#ffffff'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            backgroundColor: netProfit >= 0 ? '#e0e7ff' : '#fef2f2',
            color: netProfit >= 0 ? '#4f46e5' : '#ef4444',
            flexShrink: 0
          }}>
            <BarChart3 size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net Profit Returns</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: netProfit >= 0 ? '#4f46e5' : '#ef4444' }}>৳{netProfit.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* STATEMENTS SIDE BY SIDE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', alignItems: 'start' }}>
        {/* Income Statement */}
        <div className="card" style={{ padding: '1rem' }}>
          <div className="card-header" style={{ paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
            <h3 className="card-title" style={{ fontSize: '0.95rem' }}>Income Statement (Profit & Loss)</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>Operating Revenue</span>
              <span>Amount</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.15rem 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Sales</span>
              <span>৳{revenue.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.82rem', padding: '0.15rem 0' }}>
              <span>Less: Total Purchases</span>
              <span style={{ color: 'var(--warning-text)' }}>-৳{purchasesTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, padding: '0.35rem 0', borderBottom: '1.5px solid var(--text-primary)', fontSize: '0.85rem' }}>
              <span>Gross Profit</span>
              <span>৳{(revenue - purchasesTotal).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.82rem', padding: '0.35rem 0' }}>
              <span>Operating Expenses (Overheads)</span>
              <span style={{ color: 'var(--danger-text)' }}>-৳{expensesTotal.toFixed(2)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              backgroundColor: netProfit >= 0 ? 'var(--success-light)' : 'var(--danger-light)',
              color: netProfit >= 0 ? 'var(--success-text)' : 'var(--danger-text)',
              fontWeight: 800,
              fontSize: '0.95rem',
              marginTop: '0.4rem'
            }}>
              <span>Net Profit Returns</span>
              <span>৳{netProfit.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Cash Ledgers Balance Sheet */}
        <div className="card" style={{ padding: '1rem' }}>
          <div className="card-header" style={{ paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
            <h3 className="card-title" style={{ fontSize: '0.95rem' }}>Asset Cash Ledgers</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>Ledger Account Type</span>
              <span>Balance</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.2rem 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Cash in Hand (Drawer)</span>
              <span style={{ fontWeight: 600, color: cashBalance >= 0 ? 'var(--text-primary)' : 'var(--danger-text)' }}>
                ৳{cashBalance.toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.2rem 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Bank Account Balance</span>
              <span style={{ fontWeight: 600, color: bankBalance >= 0 ? 'var(--text-primary)' : 'var(--danger-text)' }}>
                ৳{bankBalance.toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem', padding: '0.2rem 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Mobile Banking Balance (bKash/Nagad)</span>
              <span style={{ fontWeight: 600, color: mobileBalance >= 0 ? 'var(--text-primary)' : 'var(--danger-text)' }}>
                ৳{mobileBalance.toFixed(2)}
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              backgroundColor: '#eef2ff',
              color: '#3730a3',
              fontWeight: 800,
              fontSize: '0.95rem',
              marginTop: '0.4rem'
            }}>
              <span>Total Available Capital</span>
              <span>৳{(cashBalance + bankBalance + mobileBalance).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED AUDIT TRANSACTIONS TAB LIST */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="no-print card-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.6rem',
          marginBottom: '0.6rem',
          flexWrap: 'wrap'
        }}>
          <h3 className="card-title" style={{ fontSize: '0.95rem' }}>Detailed Audit Journal</h3>
          
          {/* Segmented Control / Pill tabs */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-app)',
            padding: '3px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)'
          }}>
            {[
              { id: 'sales', name: 'Sales', icon: FileText, count: salesList.length },
              { id: 'purchases', name: 'Purchases', icon: ShoppingBag, count: purchasesList.length },
              { id: 'expenses', name: 'Expenses', icon: Receipt, count: expensesList.length }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeAuditTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveAuditTab(tab.id)}
                  style={{
                    border: 'none',
                    background: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    borderRadius: '4px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={12} />
                  <span>{tab.name} ({tab.count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PRINT ONLY HEADER FOR THE JOURNAL */}
        <h4 className="print-only" style={{ margin: '1rem 0 0.35rem 0', fontSize: '0.95rem', textTransform: 'capitalize', borderBottom: '1px solid #ddd', paddingBottom: '0.2rem' }}>
          Detailed Audit Log: {activeAuditTab} Transactions
        </h4>

        <div className="table-container">
          {activeAuditTab === 'sales' && (
            <table className="compact-table">
              <thead>
                <tr>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>SL</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Invoice No</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Sale Date</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Buyer Name</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Net Value</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Paid Amount</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Dues</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoading colSpan={8} message="Fetching sales records..." />
                ) : salesList.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No sales recorded.</td>
                  </tr>
                ) : (
                  salesList.map((sale, index) => {
                    const due = sale.net_amount - sale.paid_amount;
                    return (
                      <tr key={sale.id}>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>{index + 1}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700 }}>{sale.invoice_number}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>{new Date(sale.sale_date).toLocaleDateString()}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', fontWeight: 600 }}>{sale.contacts?.name || 'Walk-in Buyer'}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>৳{sale.net_amount.toFixed(2)}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', color: 'var(--success-text)' }}>৳{sale.paid_amount.toFixed(2)}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', fontWeight: 700, color: due > 0 ? 'var(--danger-text)' : 'inherit' }}>
                          ৳{due.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.45rem 0.6rem' }}>
                          <span className={`badge badge-${sale.payment_status}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}>
                            {sale.payment_status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeAuditTab === 'purchases' && (
            <table className="compact-table">
              <thead>
                <tr>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>SL</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Bill ID</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Order Date</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Supplier / Mill</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Net Value</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Paid Amount</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Dues</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoading colSpan={8} message="Fetching purchase records..." />
                ) : purchasesList.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No purchases recorded.</td>
                  </tr>
                ) : (
                  purchasesList.map((pur, index) => {
                    const due = pur.net_amount - pur.paid_amount;
                    return (
                      <tr key={pur.id}>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>{index + 1}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700 }}>{pur.invoice_number}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>{new Date(pur.purchase_date).toLocaleDateString()}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', fontWeight: 600 }}>{pur.contacts?.name || 'Generic Supplier'}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>৳{pur.net_amount.toFixed(2)}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', color: 'var(--success-text)' }}>৳{pur.paid_amount.toFixed(2)}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', fontWeight: 700, color: due > 0 ? 'var(--danger-text)' : 'inherit' }}>
                          ৳{due.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.45rem 0.6rem' }}>
                          <span className={`badge badge-${pur.payment_status}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}>
                            {pur.payment_status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeAuditTab === 'expenses' && (
            <table className="compact-table">
              <thead>
                <tr>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>SL</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Expense Date</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Category</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Details / Description</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Paid From</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoading colSpan={6} message="Fetching expense records..." />
                ) : expensesList.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No overhead expenses logged.</td>
                  </tr>
                ) : (
                  expensesList.map((exp, index) => (
                    <tr key={exp.id}>
                      <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>{index + 1}</td>
                      <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>{new Date(exp.expense_date).toLocaleDateString()}</td>
                      <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize' }}>{exp.category.replace('_', ' ')}</td>
                      <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{exp.description || 'N/A'}</td>
                      <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.78rem', textTransform: 'capitalize' }}>{exp.payment_method.replace('_', ' ')}</td>
                      <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--danger-text)' }}>
                        -৳{exp.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
