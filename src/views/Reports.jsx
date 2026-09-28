import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  BarChart3,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  Receipt,
  FileText,
  ShoppingBag,
  CreditCard,
  Truck,
  Package,
  Users,
  Building2,
  TrendingUp,
  Wallet
} from 'lucide-react';
import { TableLoading, LoadingBlock } from '../components/TableLoading';

export default function Reports({ userProfile, branches = [] }) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Main Report Navigation: 'summary', 'pnl', 'consignments', 'dues', 'inventory', 'journal'
  const [activeMainTab, setActiveMainTab] = useState('summary');

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
  const isOwner = role === 'owner';
  const myBranchId = userProfile?.branch_id;

  const [selectedBranchId, setSelectedBranchId] = useState(() => {
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
      setLoading(true);
      const startLocal = new Date(start.getTime() - start.getTimezoneOffset() * 60000);
      const endLocal = new Date(end.getTime() - end.getTimezoneOffset() * 60000);
      setStartDate(startLocal.toISOString().split('T')[0]);
      setEndDate(endLocal.toISOString().split('T')[0]);
    }
  };

  const handleMonthFilter = (monthVal) => {
    if (!monthVal) return;
    setLoading(true);
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
  const [salesCollected, setSalesCollected] = useState(0);
  const [customerDue, setCustomerDue] = useState(0);

  const [purchasesTotal, setPurchasesTotal] = useState(0);
  const [purchasesPaid, setPurchasesPaid] = useState(0);
  const [supplierDue, setSupplierDue] = useState(0);

  const [expensesTotal, setExpensesTotal] = useState(0);
  const [expensesByCategory, setExpensesByCategory] = useState({});
  const [netProfit, setNetProfit] = useState(0);

  // Cash balances (Ledger accounts)
  const [cashBalance, setCashBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  const [mobileBalance, setMobileBalance] = useState(0);

  // Branch Consignments / Challan metrics
  const [challansList, setChallansList] = useState([]);
  const [totalChallansDispatched, setTotalChallansDispatched] = useState(0);
  const [totalChallansPaid, setTotalChallansPaid] = useState(0);
  const [totalChallansDue, setTotalChallansDue] = useState(0);
  const [totalDispatchedQty, setTotalDispatchedQty] = useState(0);
  const [totalSoldQty, setTotalSoldQty] = useState(0);

  // Inventory Valuation
  const [inventoryList, setInventoryList] = useState([]);
  const [totalStockUnits, setTotalStockUnits] = useState(0);
  const [totalStockCostValue, setTotalStockCostValue] = useState(0);
  const [totalStockRetailValue, setTotalStockRetailValue] = useState(0);

  // Audit list logs
  const [salesList, setSalesList] = useState([]);
  const [purchasesList, setPurchasesList] = useState([]);
  const [expensesList, setExpensesList] = useState([]);
  const [activeAuditTab, setActiveAuditTab] = useState('sales');

  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      setSelectedBranchId(myBranchId || branches[0].id);
    }
  }, [branches, userProfile, myBranchId, selectedBranchId]);

  useEffect(() => {
    if (selectedBranchId) {
      fetchAllReportsData();
    }
  }, [selectedBranchId, startDate, endDate]);

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const fetchAllReportsData = async () => {
    if (!selectedBranchId) return;
    setLoading(true);
    try {
      await Promise.all([
        fetchFinancialMetrics(),
        fetchLedgerBalances(),
        fetchConsignmentChallans(),
        fetchInventoryValuation(),
      ]);
    } catch (err) {
      console.error(err);
      showMessage('Error loading reports data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialMetrics = async () => {
    // 1. Sales
    let salesQuery = supabase
      .from('sales')
      .select(`
        id, 
        invoice_number, 
        sale_date, 
        net_amount, 
        paid_amount, 
        payment_status,
        branch_id,
        contacts (
          id,
          name,
          phone
        )
      `)
      .eq('branch_id', selectedBranchId)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate);

    const { data: sales, error: salesError } = await salesQuery;
    if (salesError) throw salesError;

    const totalRev = (sales || []).reduce((sum, s) => sum + (parseFloat(s.net_amount) || 0), 0);
    const totalCollected = (sales || []).reduce((sum, s) => sum + (parseFloat(s.paid_amount) || 0), 0);
    const totalCustDue = Math.max(0, totalRev - totalCollected);

    setRevenue(totalRev);
    setSalesCollected(totalCollected);
    setCustomerDue(totalCustDue);
    setSalesList(sales || []);

    // 2. Purchases
    let purQuery = supabase
      .from('purchases')
      .select(`
        id,
        invoice_number,
        purchase_date,
        net_amount,
        paid_amount,
        payment_status,
        branch_id,
        contacts (
          id,
          name,
          phone
        )
      `)
      .eq('branch_id', selectedBranchId)
      .gte('purchase_date', startDate)
      .lte('purchase_date', endDate);

    const { data: purchases, error: purError } = await purQuery;
    if (purError) throw purError;

    const totalPur = (purchases || []).reduce((sum, p) => sum + (parseFloat(p.net_amount) || 0), 0);
    const totalPurPaid = (purchases || []).reduce((sum, p) => sum + (parseFloat(p.paid_amount) || 0), 0);
    const totalSuppDue = Math.max(0, totalPur - totalPurPaid);

    setPurchasesTotal(totalPur);
    setPurchasesPaid(totalPurPaid);
    setSupplierDue(totalSuppDue);
    setPurchasesList(purchases || []);

    // 3. Expenses
    let expQuery = supabase
      .from('expenses')
      .select(`
        id,
        category,
        amount,
        description,
        expense_date,
        payment_method,
        branch_id
      `)
      .eq('branch_id', selectedBranchId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);

    const { data: expenses, error: expError } = await expQuery;
    if (expError) throw expError;

    const totalExp = (expenses || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    setExpensesTotal(totalExp);
    setExpensesList(expenses || []);

    const catMap = {};
    (expenses || []).forEach((e) => {
      const cat = e.category || 'general';
      catMap[cat] = (catMap[cat] || 0) + (parseFloat(e.amount) || 0);
    });
    setExpensesByCategory(catMap);

    // 4. Net Profit
    const gross = totalRev - totalPur;
    setNetProfit(gross - totalExp);
  };

  const fetchLedgerBalances = async () => {
    let query = supabase
      .from('cash_ledger')
      .select('amount_in, amount_out, description')
      .eq('branch_id', selectedBranchId);

    const { data: entries, error } = await query;
    if (error) throw error;

    let cashSum = 0;
    let bankSum = 0;
    let mobileSum = 0;

    (entries || []).forEach((entry) => {
      const net = (parseFloat(entry.amount_in) || 0) - (parseFloat(entry.amount_out) || 0);
      const desc = (entry.description || '').toLowerCase();

      if (desc.includes('bank')) {
        bankSum += net;
      } else if (desc.includes('mobile') || desc.includes('bkash') || desc.includes('nagad')) {
        mobileSum += net;
      } else {
        cashSum += net;
      }
    });

    setCashBalance(cashSum);
    setBankBalance(bankSum);
    setMobileBalance(mobileSum);
  };

  const fetchConsignmentChallans = async () => {
    let query = supabase
      .from('branch_challans')
      .select(`
        id,
        challan_no,
        from_branch_id,
        to_branch_id,
        total_bill_amount,
        paid_amount,
        due_amount,
        payment_status,
        challan_date,
        from_branch:branches!branch_challans_from_branch_id_fkey (id, name, is_factory),
        to_branch:branches!branch_challans_to_branch_id_fkey (id, name, is_factory),
        items:branch_challan_items (
          dispatched_qty,
          sold_qty,
          remaining_qty,
          unit_transfer_price,
          total_price
        )
      `)
      .or(`from_branch_id.eq.${selectedBranchId},to_branch_id.eq.${selectedBranchId}`)
      .gte('challan_date', startDate)
      .lte('challan_date', endDate);

    const { data: chData, error } = await query;
    if (error) {
      console.error('Error fetching challans:', error);
      return;
    }

    const list = chData || [];
    setChallansList(list);

    const totalDispatched = list.reduce((sum, c) => sum + (parseFloat(c.total_bill_amount) || 0), 0);
    const totalPaid = list.reduce((sum, c) => sum + (parseFloat(c.paid_amount) || 0), 0);
    const totalDue = list.reduce((sum, c) => sum + (parseFloat(c.due_amount) || 0), 0);

    let dispatchedPcs = 0;
    let soldPcs = 0;
    list.forEach((c) => {
      (c.items || []).forEach((it) => {
        dispatchedPcs += parseInt(it.dispatched_qty) || 0;
        soldPcs += parseInt(it.sold_qty) || 0;
      });
    });

    setTotalChallansDispatched(totalDispatched);
    setTotalChallansPaid(totalPaid);
    setTotalChallansDue(totalDue);
    setTotalDispatchedQty(dispatchedPcs);
    setTotalSoldQty(soldPcs);
  };

  const fetchInventoryValuation = async () => {
    let query = supabase
      .from('inventory')
      .select(`
        id,
        quantity,
        branch_id,
        branch:branches (id, name, is_factory),
        product:products (
          id,
          sku,
          product_code,
          name,
          category,
          unit,
          purchase_price,
          sale_price
        )
      `)
      .eq('branch_id', selectedBranchId);

    const { data: invData, error } = await query;
    if (error) {
      console.error('Error fetching inventory:', error);
      return;
    }

    const list = invData || [];
    setInventoryList(list);

    let units = 0;
    let costVal = 0;
    let retailVal = 0;

    list.forEach((row) => {
      const q = parseInt(row.quantity) || 0;
      const cost = parseFloat(row.product?.purchase_price) || 0;
      const sale = parseFloat(row.product?.sale_price) || 0;

      units += q;
      costVal += q * cost;
      retailVal += q * sale;
    });

    setTotalStockUnits(units);
    setTotalStockCostValue(costVal);
    setTotalStockRetailValue(retailVal);
  };

  const handlePrint = () => {
    window.print();
  };

  const activeBranchName =
    branches.find((b) => b.id === selectedBranchId)?.name || 'Selected Branch';

  // Branch Financial Calculations
  const grossProfit = revenue - purchasesTotal;
  const grossMarginPct = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0;
  const netMarginPct = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : 0;
  const totalLiquidAssets = cashBalance + bankBalance + mobileBalance;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* TOP FILTER BAR */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          padding: '0.75rem 1rem',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--border-radius)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="page-title-group" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              backgroundColor: '#e0e7ff',
              color: 'var(--primary)',
            }}
          >
            <BarChart3 size={18} />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'Outfit, sans-serif' }}>
            Branch Reports
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Branch Select */}
          {isOwner ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Branch:</span>
              <select
                className="input-control"
                value={selectedBranchId}
                onChange={(e) => {
                  setLoading(true);
                  setSelectedBranchId(e.target.value);
                }}
                style={{ width: '165px', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.is_factory ? `🏭 ${b.name}` : `🏪 ${b.name}`}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>{branches.find((b) => b.id === selectedBranchId)?.is_factory ? '🏭' : '🏪'}</span>
              <span>{activeBranchName}</span>
            </div>
          )}

          {/* Date Picker Group */}
          <div
            style={{
              display: 'flex',
              gap: '0.35rem',
              alignItems: 'center',
              backgroundColor: 'var(--bg-app)',
              padding: '0.3rem 0.55rem',
              borderRadius: 'var(--border-radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
            <input
              type="date"
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.8rem',
                padding: 0,
                width: '100px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
              value={startDate}
              onChange={(e) => {
                setLoading(true);
                setStartDate(e.target.value);
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 0.1rem' }}>to</span>
            <input
              type="date"
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.8rem',
                padding: 0,
                width: '100px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
              value={endDate}
              onChange={(e) => {
                setLoading(true);
                setEndDate(e.target.value);
              }}
            />
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={handlePrint}
            style={{ padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Printer size={13} />
            <span style={{ fontSize: '0.8rem' }}>Print</span>
          </button>
        </div>
      </div>

      {/* QUICK PRESET FILTERS BAR */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          padding: '0.45rem 0.85rem',
          backgroundColor: '#f8fafc',
          borderRadius: 'var(--border-radius-sm)',
          border: '1px solid var(--border-color)',
          marginTop: '-0.75rem',
          fontSize: '0.78rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginRight: '0.2rem' }}>Quick:</span>
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'This Week' },
            { id: 'last_7_days', label: 'Last 7 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'last_30_days', label: 'Last 30 Days' },
            { id: 'year', label: 'This Year' },
            { id: 'last_year', label: 'Last Year' },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.15rem 0.45rem', fontSize: '0.74rem' }}
              onClick={() => handlePresetChange(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Month:</span>
          <select
            className="input-control"
            style={{ width: '145px', padding: '0.15rem 0.35rem', fontSize: '0.74rem', height: 'auto' }}
            onChange={(e) => handleMonthFilter(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>
              Select Month...
            </option>
            {getMonthOptions().map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          gap: '0.35rem',
          borderBottom: '2px solid var(--border-color)',
          paddingBottom: '0.1rem',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'summary', name: 'Branch Summary', icon: BarChart3 },
          { id: 'pnl', name: 'Profit & Loss', icon: TrendingUp },
          { id: 'consignments', name: 'Consignments', icon: Truck },
          { id: 'dues', name: 'Receivables & Payables', icon: CreditCard },
          { id: 'inventory', name: 'Inventory Valuation', icon: Package },
          { id: 'journal', name: 'Transactions Journal', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeMainTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveMainTab(tab.id)}
              style={{
                border: 'none',
                background: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {message.text && (
        <div
          className="no-print"
          style={{
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: message.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            color: message.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
            border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            fontWeight: 500,
            fontSize: '0.82rem',
          }}
        >
          {message.text}
        </div>
      )}

      {/* PRINT HEADER - SHOWS ONLY ON PRINT */}
      <div
        className="print-only"
        style={{ marginBottom: '1.25rem', borderBottom: '2px solid #000', paddingBottom: '0.6rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>
              ALMAS ACCESSORIES LTD
            </h1>
            <p style={{ margin: '0.15rem 0', fontSize: '0.82rem', color: '#475569' }}>
              Central Factory & Branch Network
            </p>
            <p style={{ margin: '0.15rem 0', fontSize: '0.78rem', color: '#64748b' }}>
              Chittagong / Dhaka, Bangladesh
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#2563eb' }}>
              BRANCH REPORT
            </h2>
            <p style={{ margin: '0.15rem 0', fontSize: '0.82rem', fontWeight: 600 }}>Branch: {activeBranchName}</p>
            <p style={{ margin: '0.15rem 0', fontSize: '0.78rem' }}>
              Period: {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LOADING STATE OR REPORT CONTENT                                           */}
      {/* ========================================================================= */}
      {loading ? (
        <div
          className="card"
          style={{
            padding: '3.5rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '340px',
            backgroundColor: '#ffffff',
            borderRadius: 'var(--border-radius)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <LoadingBlock message={`Loading report data for ${activeBranchName}...`} minHeight="140px" />
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* TAB 1: BRANCH SUMMARY                                                     */}
          {/* ========================================================================= */}
          {activeMainTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* KPI TILES */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {/* 1. Total Sales */}
            <div
              className="card"
              style={{
                padding: '0.85rem 1rem',
                borderLeft: '4px solid #10b981',
                backgroundColor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total Sales
                </span>
                <span
                  style={{
                    backgroundColor: '#ecfdf5',
                    color: '#059669',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                  }}
                >
                  {salesList.length} Invoices
                </span>
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>
                ৳{revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                <span>Collected: ৳{salesCollected.toLocaleString()}</span>
                <span style={{ color: customerDue > 0 ? '#dc2626' : 'inherit' }}>Due: ৳{customerDue.toLocaleString()}</span>
              </div>
            </div>

            {/* 2. Total Purchases */}
            <div
              className="card"
              style={{
                padding: '0.85rem 1rem',
                borderLeft: '4px solid #f59e0b',
                backgroundColor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total Purchases
                </span>
                <span
                  style={{
                    backgroundColor: '#fffbeb',
                    color: '#b45309',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                  }}
                >
                  {purchasesList.length} Bills
                </span>
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>
                ৳{purchasesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                <span>Paid: ৳{purchasesPaid.toLocaleString()}</span>
                <span style={{ color: supplierDue > 0 ? '#dc2626' : 'inherit' }}>Due: ৳{supplierDue.toLocaleString()}</span>
              </div>
            </div>

            {/* 3. Total Expenses */}
            <div
              className="card"
              style={{
                padding: '0.85rem 1rem',
                borderLeft: '4px solid #ef4444',
                backgroundColor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total Expenses
                </span>
                <span
                  style={{
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                  }}
                >
                  {expensesList.length} Entries
                </span>
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>
                ৳{expensesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Operational & overhead expenses
              </div>
            </div>

            {/* 4. Net Profit */}
            <div
              className="card"
              style={{
                padding: '0.85rem 1rem',
                borderLeft: `4px solid ${netProfit >= 0 ? '#4f46e5' : '#dc2626'}`,
                backgroundColor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Net Profit
                </span>
                <span
                  style={{
                    backgroundColor: netProfit >= 0 ? '#e0e7ff' : '#fef2f2',
                    color: netProfit >= 0 ? '#4338ca' : '#dc2626',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                  }}
                >
                  {netMarginPct}% Margin
                </span>
              </div>
              <div
                style={{
                  fontSize: '1.3rem',
                  fontWeight: 800,
                  fontFamily: 'Outfit, sans-serif',
                  color: netProfit >= 0 ? '#4338ca' : '#dc2626',
                }}
              >
                ৳{netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Gross Profit: ৳{grossProfit.toLocaleString()} ({grossMarginPct}%)
              </div>
            </div>
          </div>

          {/* SECONDARY ROW: CASH BALANCES, STOCK, CONSIGNMENTS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1rem',
            }}
          >
            {/* Cash & Bank Balances */}
            <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div className="card-header" style={{ padding: 0, border: 'none' }}>
                <h3 className="card-title" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Wallet size={15} style={{ color: 'var(--primary)' }} />
                  <span>Cash & Bank Balances</span>
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cash in Hand</span>
                  <span style={{ fontWeight: 600 }}>৳{cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Bank Account</span>
                  <span style={{ fontWeight: 600 }}>৳{bankBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Mobile Banking (bKash/Nagad)</span>
                  <span style={{ fontWeight: 600 }}>৳{mobileBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    backgroundColor: '#eef2ff',
                    color: '#3730a3',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    marginTop: '0.2rem',
                  }}
                >
                  <span>Total Available Funds</span>
                  <span>৳{totalLiquidAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Inventory Valuation Summary */}
            <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div className="card-header" style={{ padding: 0, border: 'none' }}>
                <h3 className="card-title" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Package size={15} style={{ color: '#059669' }} />
                  <span>Inventory Summary</span>
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Stock</span>
                  <span style={{ fontWeight: 600 }}>{totalStockUnits.toLocaleString()} units</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Stock Value (Cost)</span>
                  <span style={{ fontWeight: 600, color: '#059669' }}>৳{totalStockCostValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Stock Value (Retail)</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>৳{totalStockRetailValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    backgroundColor: '#ecfdf5',
                    color: '#065f46',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    marginTop: '0.2rem',
                  }}
                >
                  <span>Expected Profit</span>
                  <span>৳{Math.max(0, totalStockRetailValue - totalStockCostValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Consignments Summary */}
            <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div className="card-header" style={{ padding: 0, border: 'none' }}>
                <h3 className="card-title" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Truck size={15} style={{ color: '#d97706' }} />
                  <span>Consignments Summary</span>
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Sent</span>
                  <span style={{ fontWeight: 600 }}>৳{totalChallansDispatched.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Received</span>
                  <span style={{ fontWeight: 600, color: '#059669' }}>৳{totalChallansPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Due</span>
                  <span style={{ fontWeight: 600, color: totalChallansDue > 0 ? '#dc2626' : 'inherit' }}>
                    ৳{totalChallansDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    backgroundColor: '#fffbeb',
                    color: '#92400e',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    marginTop: '0.2rem',
                  }}
                >
                  <span>Dispatched / Sold</span>
                  <span>{totalSoldQty} / {totalDispatchedQty} pcs</span>
                </div>
              </div>
            </div>
          </div>

          {/* EXPENSES BY CATEGORY */}
          <div className="card" style={{ padding: '1rem' }}>
            <div className="card-header" style={{ paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.6rem' }}>
              <h3 className="card-title" style={{ fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Receipt size={16} style={{ color: '#ef4444' }} />
                <span>Expenses by Category</span>
              </h3>
            </div>

            {Object.keys(expensesByCategory).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No expenses recorded in this period.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(expensesByCategory).map(([cat, amt]) => {
                  const pct = expensesTotal > 0 ? ((amt / expensesTotal) * 100).toFixed(1) : 0;
                  return (
                    <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{cat.replace('_', ' ')}</span>
                        <span>
                          <strong>৳{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>{' '}
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({pct}%)</span>
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            backgroundColor: '#ef4444',
                            borderRadius: '3px',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PROFIT & LOSS                                                      */}
      {/* ========================================================================= */}
      {activeMainTab === 'pnl' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <div className="card-header" style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h3 className="card-title" style={{ fontSize: '1.05rem' }}>Profit & Loss Statement</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {/* 1. Sales */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.92rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                <span>1. Sales</span>
                <span>৳{revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', paddingLeft: '1rem', color: 'var(--text-secondary)' }}>
                <span>Total Sales</span>
                <span>৳{revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', paddingLeft: '1rem', color: '#059669' }}>
                <span>Collected Amount</span>
                <span>৳{salesCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', paddingLeft: '1rem', color: customerDue > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                <span>Customer Due</span>
                <span>৳{customerDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              {/* 2. Purchases */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.92rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem', marginTop: '0.75rem' }}>
                <span>2. Purchases</span>
                <span style={{ color: '#b45309' }}>-৳{purchasesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', paddingLeft: '1rem', color: 'var(--text-secondary)' }}>
                <span>Total Purchases</span>
                <span>৳{purchasesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', paddingLeft: '1rem', color: '#059669' }}>
                <span>Paid Amount</span>
                <span>৳{purchasesPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              {/* Gross Profit */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.8rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  marginTop: '0.5rem',
                }}
              >
                <span>Gross Profit ({grossMarginPct}%)</span>
                <span>৳{grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              {/* 3. Expenses */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.92rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem', marginTop: '0.75rem' }}>
                <span>3. Expenses</span>
                <span style={{ color: '#dc2626' }}>-৳{expensesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              {Object.entries(expensesByCategory).map(([cat, amt]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', paddingLeft: '1rem', color: 'var(--text-secondary)' }}>
                  <span style={{ textTransform: 'capitalize' }}>{cat.replace('_', ' ')}</span>
                  <span>৳{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              ))}

              {/* NET PROFIT */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.8rem 1rem',
                  borderRadius: '6px',
                  backgroundColor: netProfit >= 0 ? '#ecfdf5' : '#fef2f2',
                  color: netProfit >= 0 ? '#065f46' : '#991b1b',
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  marginTop: '1rem',
                }}
              >
                <span>Net Profit</span>
                <span>৳{netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CONSIGNMENTS                                                       */}
      {/* ========================================================================= */}
      {activeMainTab === 'consignments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1rem' }}>
            <div className="card-header" style={{ paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.6rem' }}>
              <h3 className="card-title" style={{ fontSize: '0.92rem' }}>Delivery Consignments</h3>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Challan #</th>
                    <th>Date</th>
                    <th>Branch</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Paid</th>
                    <th style={{ textAlign: 'right' }}>Due</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {challansList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No delivery challans recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    challansList.map((ch) => (
                      <tr key={ch.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{ch.challan_no}</td>
                        <td>{new Date(ch.challan_date).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600 }}>🏪 {ch.to_branch?.name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                          ৳{parseFloat(ch.total_bill_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', color: '#059669', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                          ৳{parseFloat(ch.paid_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            color: parseFloat(ch.due_amount) > 0 ? '#dc2626' : 'inherit',
                            fontWeight: 700,
                            fontFamily: 'Outfit, sans-serif',
                          }}
                        >
                          ৳{parseFloat(ch.due_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge badge-${ch.payment_status}`}>{ch.payment_status}</span>
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

      {/* ========================================================================= */}
      {/* TAB 4: RECEIVABLES & PAYABLES                                             */}
      {/* ========================================================================= */}
      {activeMainTab === 'dues' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {/* Customer Receivables */}
          <div className="card" style={{ padding: '1rem' }}>
            <div className="card-header" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.6rem' }}>
              <h3 className="card-title" style={{ fontSize: '0.9rem', color: '#dc2626' }}>
                Customer Receivables (Due: ৳{customerDue.toLocaleString()})
              </h3>
            </div>

            <div className="table-container" style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Invoice</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {salesList.filter((s) => s.net_amount - s.paid_amount > 0.01).length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No customer dues.
                      </td>
                    </tr>
                  ) : (
                    salesList
                      .filter((s) => s.net_amount - s.paid_amount > 0.01)
                      .map((s) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>{s.contacts?.name || 'Customer'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.invoice_number}</td>
                          <td style={{ textAlign: 'right' }}>৳{s.net_amount.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                            ৳{(s.net_amount - s.paid_amount).toFixed(2)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Supplier Payables */}
          <div className="card" style={{ padding: '1rem' }}>
            <div className="card-header" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.6rem' }}>
              <h3 className="card-title" style={{ fontSize: '0.9rem', color: '#b45309' }}>
                Supplier Payables (Due: ৳{supplierDue.toLocaleString()})
              </h3>
            </div>

            <div className="table-container" style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Bill #</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasesList.filter((p) => p.net_amount - p.paid_amount > 0.01).length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No supplier payables.
                      </td>
                    </tr>
                  ) : (
                    purchasesList
                      .filter((p) => p.net_amount - p.paid_amount > 0.01)
                      .map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600 }}>{p.contacts?.name || 'Supplier'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.invoice_number}</td>
                          <td style={{ textAlign: 'right' }}>৳{p.net_amount.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#b45309' }}>
                            ৳{(p.net_amount - p.paid_amount).toFixed(2)}
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

      {/* ========================================================================= */}
      {/* TAB 5: INVENTORY VALUATION                                                */}
      {/* ========================================================================= */}
      {activeMainTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1rem' }}>
            <div className="card-header" style={{ paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.6rem' }}>
              <h3 className="card-title" style={{ fontSize: '0.92rem' }}>
                Inventory Valuation ({totalStockUnits.toLocaleString()} units — Value: ৳{totalStockCostValue.toLocaleString()})
              </h3>
            </div>

            <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Branch</th>
                    <th style={{ textAlign: 'right' }}>Stock</th>
                    <th style={{ textAlign: 'right' }}>Cost Price</th>
                    <th style={{ textAlign: 'right' }}>Sale Price</th>
                    <th style={{ textAlign: 'right' }}>Total Cost</th>
                    <th style={{ textAlign: 'right' }}>Total Retail</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryList.map((inv) => {
                    const qty = parseInt(inv.quantity) || 0;
                    const cost = parseFloat(inv.product?.purchase_price) || 0;
                    const sale = parseFloat(inv.product?.sale_price) || 0;
                    return (
                      <tr key={inv.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{inv.product?.name}</div>
                          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {inv.product?.sku}
                          </div>
                        </td>
                        <td>{inv.branch?.name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {qty} {inv.product?.unit || 'pcs'}
                        </td>
                        <td style={{ textAlign: 'right' }}>৳{cost.toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>৳{sale.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                          ৳{(qty * cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                          ৳{(qty * sale).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: TRANSACTIONS JOURNAL                                               */}
      {/* ========================================================================= */}
      {activeMainTab === 'journal' && (
        <div className="card" style={{ padding: '1rem' }}>
          <div
            className="no-print card-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '0.5rem',
              marginBottom: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <h3 className="card-title" style={{ fontSize: '0.92rem' }}>Transactions Journal</h3>

            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--bg-app)',
                padding: '3px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
              }}
            >
              {[
                { id: 'sales', name: 'Sales', icon: FileText, count: salesList.length },
                { id: 'purchases', name: 'Purchases', icon: ShoppingBag, count: purchasesList.length },
                { id: 'expenses', name: 'Expenses', icon: Receipt, count: expensesList.length },
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
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={12} />
                    <span>
                      {tab.name} ({tab.count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="table-container">
            {activeAuditTab === 'sales' && (
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>SL</th>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Paid</th>
                    <th style={{ textAlign: 'right' }}>Due</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {salesList.map((sale, index) => {
                    const due = sale.net_amount - sale.paid_amount;
                    return (
                      <tr key={sale.id}>
                        <td>{index + 1}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{sale.invoice_number}</td>
                        <td>{new Date(sale.sale_date).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600 }}>{sale.contacts?.name || 'Walk-in'}</td>
                        <td style={{ textAlign: 'right' }}>৳{sale.net_amount.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--success-text)' }}>৳{sale.paid_amount.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: due > 0 ? 'var(--danger-text)' : 'inherit' }}>
                          ৳{due.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge badge-${sale.payment_status}`}>{sale.payment_status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {activeAuditTab === 'purchases' && (
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>SL</th>
                    <th>Bill #</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Paid</th>
                    <th style={{ textAlign: 'right' }}>Due</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasesList.map((pur, index) => {
                    const due = pur.net_amount - pur.paid_amount;
                    return (
                      <tr key={pur.id}>
                        <td>{index + 1}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{pur.invoice_number}</td>
                        <td>{new Date(pur.purchase_date).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600 }}>{pur.contacts?.name || 'Supplier'}</td>
                        <td style={{ textAlign: 'right' }}>৳{pur.net_amount.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--success-text)' }}>৳{pur.paid_amount.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: due > 0 ? 'var(--danger-text)' : 'inherit' }}>
                          ৳{due.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge badge-${pur.payment_status}`}>{pur.payment_status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {activeAuditTab === 'expenses' && (
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>SL</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Payment Method</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expensesList.map((exp, index) => (
                    <tr key={exp.id}>
                      <td>{index + 1}</td>
                      <td>{new Date(exp.expense_date).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{exp.category.replace('_', ' ')}</td>
                      <td>{exp.description || 'N/A'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{exp.payment_method?.replace('_', ' ')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger-text)' }}>
                        -৳{parseFloat(exp.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
        </>
      )}

      {/* SIGNATURE BLOCK FOR PRINT */}
      <div
        className="print-only"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '4rem',
          paddingTop: '1rem',
          pageBreakInside: 'avoid',
        }}
      >
        <div style={{ textAlign: 'center', width: '160px', borderTop: '1px solid #000' }}>
          <p style={{ margin: '0.4rem 0', fontSize: '0.82rem', fontWeight: 600 }}>Prepared By</p>
        </div>
        <div style={{ textAlign: 'center', width: '160px', borderTop: '1px solid #000' }}>
          <p style={{ margin: '0.4rem 0', fontSize: '0.82rem', fontWeight: 600 }}>Accounts & Audit</p>
        </div>
        <div style={{ textAlign: 'center', width: '160px', borderTop: '1px solid #000' }}>
          <p style={{ margin: '0.4rem 0', fontSize: '0.82rem', fontWeight: 600 }}>Managing Director</p>
        </div>
      </div>
    </div>
  );
}
