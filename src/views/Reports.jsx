import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import almasLogo from '../assets/almas_logo.jpg';
import {
  BarChart3,
  Calendar,
  Printer,
  CreditCard,
  Users,
  Search,
  Building2,
  Phone,
  ShoppingBag,
  DollarSign,
  X
} from 'lucide-react';
import { TableLoading } from '../components/TableLoading';
import { formatAmount } from '../utils/format';

export default function Reports({ userProfile, branches = [] }) {
  // 3 Major Report Tabs
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ['overall', 'customer', 'payments'];
  const tabParam = searchParams.get('tab');
  const activeTab = validTabs.includes(tabParam) ? tabParam : 'overall';
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });
  const [loading, setLoading] = useState(false);

  // Date filters
  const defaultStart = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const defaultEnd = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(defaultEnd());
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const isOwner = userProfile?.role === 'owner';
  const myBranchId = userProfile?.branch_id;
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    return myBranchId || (branches.length > 0 ? branches[0].id : '');
  });

  // Ensure branch selection is strictly enforced per role (reports are always branch-wise)
  useEffect(() => {
    if (!isOwner) {
      if (myBranchId && selectedBranchId !== myBranchId) {
        setSelectedBranchId(myBranchId);
      } else if (!myBranchId && branches.length > 0 && !selectedBranchId) {
        setSelectedBranchId(branches[0].id);
      }
    } else {
      if (!selectedBranchId || selectedBranchId === 'all') {
        const defaultBranch = myBranchId || (branches.length > 0 ? branches[0].id : '');
        if (defaultBranch) setSelectedBranchId(defaultBranch);
      }
    }
  }, [isOwner, myBranchId, branches, selectedBranchId]);

  // Overall Report State
  const [overallSales, setOverallSales] = useState([]);
  const [overallPurchasesTotal, setOverallPurchasesTotal] = useState(0);
  const [overallExpensesTotal, setOverallExpensesTotal] = useState(0);

  // Customer Report State
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [showPhoneList, setShowPhoneList] = useState(false);
  const phoneRef = useRef(null);

  const [customerSales, setCustomerSales] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Customer Payments State
  const [customerPayments, setCustomerPayments] = useState([]);
  const [paymentSalesMap, setPaymentSalesMap] = useState({});
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all'); // 'all' | 'cash' | 'bank' | 'bkash' | 'nagad'

  // Month Options for dropdown
  const monthOptions = useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push({ label, value });
    }
    return list;
  }, []);

  const handleMonthChange = (monthVal) => {
    setSelectedMonth(monthVal);
    if (!monthVal) return;
    const [y, m] = monthVal.split('-');
    const year = parseInt(y, 10);
    const month = parseInt(m, 10) - 1;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    setStartDate(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`);
    setEndDate(`${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`);
  };

  // Close phone autocomplete on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (phoneRef.current && !phoneRef.current.contains(e.target)) {
        setShowPhoneList(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, []);

  // Fetch customer list once
  useEffect(() => {
    const loadCustomers = async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id, name, phone, address')
        .eq('type', 'customer')
        .order('name', { ascending: true });
      setCustomers(data || []);
    };
    loadCustomers();
  }, []);

  // Sync selectedCustomer with selectedCustomerId
  useEffect(() => {
    if (selectedCustomerId) {
      const cust = customers.find((c) => c.id === selectedCustomerId);
      setSelectedCustomer(cust || null);
    } else {
      setSelectedCustomer(null);
    }
  }, [selectedCustomerId, customers]);

  // Fetch Overall Report
  useEffect(() => {
    if (activeTab === 'overall') {
      loadOverallData();
    }
  }, [activeTab, startDate, endDate, selectedBranchId]);

  const loadOverallData = async () => {
    setLoading(true);
    try {
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
          ),
          branches (
            id,
            name
          )
        `)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('sale_date', { ascending: false });

      if (selectedBranchId) {
        salesQuery = salesQuery.eq('branch_id', selectedBranchId);
      }
      const { data: sData } = await salesQuery;
      setOverallSales(sData || []);

      // 2. Purchases Total
      let purQuery = supabase
        .from('purchases')
        .select('net_amount')
        .gte('purchase_date', startDate)
        .lte('purchase_date', endDate);
      if (selectedBranchId) {
        purQuery = purQuery.eq('branch_id', selectedBranchId);
      }
      const { data: pData } = await purQuery;
      const pTotal = (pData || []).reduce((sum, p) => sum + (parseFloat(p.net_amount) || 0), 0);
      setOverallPurchasesTotal(pTotal);

      // 3. Expenses Total
      let expQuery = supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);
      if (selectedBranchId) {
        expQuery = expQuery.eq('branch_id', selectedBranchId);
      }
      const { data: eData } = await expQuery;
      const eTotal = (eData || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      setOverallExpensesTotal(eTotal);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Customer Report
  useEffect(() => {
    if (activeTab === 'customer' && selectedCustomerId) {
      loadCustomerData(selectedCustomerId);
    }
  }, [activeTab, selectedCustomerId, startDate, endDate, selectedBranchId]);

  const loadCustomerData = async (custId) => {
    setLoading(true);
    try {
      const cust = customers.find((c) => c.id === custId);
      setSelectedCustomer(cust || null);

      let query = supabase
        .from('sales')
        .select(`
          id,
          invoice_number,
          sale_date,
          total_amount,
          discount,
          net_amount,
          paid_amount,
          payment_status,
          notes,
          branch_id
        `)
        .eq('customer_id', custId)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('sale_date', { ascending: false });

      if (selectedBranchId) {
        query = query.eq('branch_id', selectedBranchId);
      }

      const { data: sData, error } = await query;
      if (error) throw error;
      setCustomerSales(sData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Customer Payments Report
  useEffect(() => {
    if (activeTab === 'payments') {
      loadCustomerPayments();
    }
  }, [activeTab, startDate, endDate, selectedBranchId, selectedCustomerId, paymentMethodFilter]);

  const loadCustomerPayments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('payments')
        .select(`
          id,
          payment_number,
          transaction_type,
          payment_date,
          amount,
          payment_method,
          reference_invoice_id,
          notes,
          branch_id,
          contact_id,
          contacts (
            id,
            name,
            phone,
            address
          ),
          branches (
            id,
            name,
            address,
            is_factory
          ),
          profiles (
            full_name
          )
        `)
        .gte('payment_date', `${startDate}T00:00:00`)
        .lte('payment_date', `${endDate}T23:59:59.999Z`)
        .order('payment_date', { ascending: false });

      // Filter by customer if selected
      if (selectedCustomerId) {
        query = query.eq('contact_id', selectedCustomerId);
      }

      // Filter by branch
      if (selectedBranchId) {
        query = query.eq('branch_id', selectedBranchId);
      }

      // Filter by payment method
      if (paymentMethodFilter && paymentMethodFilter !== 'all') {
        query = query.eq('payment_method', paymentMethodFilter);
      }

      // Customer collections only
      query = query.eq('transaction_type', 'customer_collection');

      const { data: payData, error } = await query;
      if (error) throw error;

      const list = payData || [];
      setCustomerPayments(list);

      // Resolve linked invoice numbers
      const invoiceIds = Array.from(new Set(list.map((p) => p.reference_invoice_id).filter(Boolean)));
      if (invoiceIds.length > 0) {
        const { data: salesList } = await supabase
          .from('sales')
          .select('id, invoice_number')
          .in('id', invoiceIds);
        if (salesList) {
          const map = {};
          salesList.forEach((s) => {
            map[s.id] = s.invoice_number;
          });
          setPaymentSalesMap(map);
        }
      }
    } catch (err) {
      console.error('Error loading customer payments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Overall Financial Calculations
  const overallTotalRevenue = useMemo(() => {
    return overallSales.reduce((sum, s) => sum + (parseFloat(s.net_amount) || 0), 0);
  }, [overallSales]);

  const overallTotalPaid = useMemo(() => {
    return overallSales.reduce((sum, s) => sum + (parseFloat(s.paid_amount) || 0), 0);
  }, [overallSales]);

  const overallTotalDue = Math.max(0, overallTotalRevenue - overallTotalPaid);
  const overallNetProfit = overallTotalRevenue - overallPurchasesTotal - overallExpensesTotal;

  // Customer Financial Calculations
  const customerTotalBilled = useMemo(() => {
    return customerSales.reduce((sum, s) => sum + (parseFloat(s.net_amount) || 0), 0);
  }, [customerSales]);

  const customerTotalPaid = useMemo(() => {
    return customerSales.reduce((sum, s) => sum + (parseFloat(s.paid_amount) || 0), 0);
  }, [customerSales]);

  const customerTotalDue = Math.max(0, customerTotalBilled - customerTotalPaid);

  // Customer Payments Financial Calculations
  const paymentsTotalAmount = useMemo(() => {
    return customerPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [customerPayments]);

  const paymentsCashAmount = useMemo(() => {
    return customerPayments
      .filter((p) => (p.payment_method || '').toLowerCase() === 'cash')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [customerPayments]);

  const paymentsDigitalAmount = useMemo(() => {
    return customerPayments
      .filter((p) => (p.payment_method || '').toLowerCase() !== 'cash')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [customerPayments]);

  const [showReportPrint, setShowReportPrint] = useState(false);

  // Phone filtered list
  const filteredCustomers = useMemo(() => {
    if (!phoneSearch.trim()) return customers.slice(0, 15);
    const q = phoneSearch.toLowerCase();
    return customers.filter(
      (c) =>
        (c.phone && c.phone.includes(q)) ||
        (c.name && c.name.toLowerCase().includes(q))
    );
  }, [customers, phoneSearch]);

  const selectedBranchObj = useMemo(() => {
    if (!selectedBranchId) return null;
    return branches.find((item) => item.id === selectedBranchId) || null;
  }, [branches, selectedBranchId]);

  const selectedBranchName = useMemo(() => {
    return selectedBranchObj ? selectedBranchObj.name : (branches[0]?.name || 'Branch');
  }, [selectedBranchObj, branches]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. TOP HEADER & REPORT TAB SELECTOR */}
      <div
        className="no-print card"
        style={{
          padding: '0.85rem 1.15rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#e0f2fe',
              color: '#0284c7',
            }}
          >
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
              Reports
            </h2>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              {activeTab === 'overall' ? 'Overall business turnover & sales summary' : 'Customer account statement & dues'}
            </div>
          </div>
        </div>

        {/* 3 Simple Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'overall' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('overall')}
            style={{ fontWeight: 700, padding: '0.4rem 0.85rem' }}
          >
            1. Overall Report
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'customer' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('customer')}
            style={{ fontWeight: 700, padding: '0.4rem 0.85rem' }}
          >
            2. Customer Statement
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('payments')}
            style={{ fontWeight: 700, padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <CreditCard size={14} />
            <span>3. Customer Payments</span>
          </button>
        </div>
      </div>

      {/* 2. DATE & FILTER CONTROLS */}
      <div
        className="no-print card"
        style={{
          padding: '0.5rem 0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem' }}>
          {/* Month Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: '1 1 140px' }}>
            <Calendar size={13} style={{ color: '#0284c7', flexShrink: 0 }} />
            <select
              className="input-control"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.78rem' }}
            >
              <option value="">Custom Range</option>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Date Range: From & To side by side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: '2 1 230px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>From:</span>
            <input
              type="date"
              className="input-control"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setSelectedMonth('');
              }}
              style={{ flex: 1, padding: '0.25rem 0.35rem', fontSize: '0.76rem', minWidth: '105px' }}
            />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
            <input
              type="date"
              className="input-control"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSelectedMonth('');
              }}
              style={{ flex: 1, padding: '0.25rem 0.35rem', fontSize: '0.76rem', minWidth: '105px' }}
            />
          </div>

          {/* Branch Filter */}
          {isOwner ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: '1 1 140px' }}>
              <Building2 size={13} style={{ color: '#0284c7', flexShrink: 0 }} />
              <select
                className="input-control"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.78rem', fontWeight: 600 }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: '1 1 120px' }}>
              <div style={{ width: '100%', padding: '0.25rem 0.5rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                🏢 {selectedBranchName}
              </div>
            </div>
          )}

          {/* Payment Method Filter (for Customer Payments tab) */}
          {activeTab === 'payments' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: '1 1 130px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Method:</span>
              <select
                className="input-control"
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.78rem' }}
              >
                <option value="all">All Methods</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          )}

          {/* Print Preview Button */}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowReportPrint(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, padding: '0.25rem 0.75rem', fontSize: '0.78rem', marginLeft: 'auto' }}
          >
            <Printer size={13} /> Print Report
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. OVERALL REPORT VIEW                                    */}
      {/* ========================================================= */}
      {activeTab === 'overall' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Summary Metric Cards */}
          <div
            className="stats-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: '0.35rem',
            }}
          >
            {/* Total Sales */}
            <div className="card" style={{ padding: '0.45rem 0.65rem', borderLeft: '3.5px solid #0284c7' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Total Sales</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', marginTop: '0.05rem' }}>
                ৳{formatAmount(overallTotalRevenue)}
              </div>
            </div>

            {/* Collected / Paid */}
            <div className="card" style={{ padding: '0.45rem 0.65rem', borderLeft: '3.5px solid #10b981' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Total Collected</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#059669', marginTop: '0.05rem' }}>
                ৳{formatAmount(overallTotalPaid)}
              </div>
            </div>

            {/* Total Due */}
            <div className="card" style={{ padding: '0.45rem 0.65rem', borderLeft: '3.5px solid #f59e0b' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Customer Due</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#d97706', marginTop: '0.05rem' }}>
                ৳{formatAmount(overallTotalDue)}
              </div>
            </div>

            {/* Purchases */}
            <div className="card" style={{ padding: '0.45rem 0.65rem', borderLeft: '3.5px solid #6366f1' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Total Purchases</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', marginTop: '0.05rem' }}>
                ৳{formatAmount(overallPurchasesTotal)}
              </div>
            </div>

            {/* Expenses */}
            <div className="card" style={{ padding: '0.45rem 0.65rem', borderLeft: '3.5px solid #ef4444' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Total Expenses</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#dc2626', marginTop: '0.05rem' }}>
                ৳{formatAmount(overallExpensesTotal)}
              </div>
            </div>

            {/* Net Profit */}
            <div className="card" style={{ padding: '0.45rem 0.65rem', borderLeft: `3.5px solid ${overallNetProfit >= 0 ? '#10b981' : '#ef4444'}` }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Net Profit</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: overallNetProfit >= 0 ? '#059669' : '#dc2626', marginTop: '0.05rem' }}>
                ৳{formatAmount(overallNetProfit)}
              </div>
            </div>
          </div>

          {/* Sales Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.65rem 0.95rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem' }}>
              Sales Invoices ({overallSales.length})
            </div>
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Invoice / Challan #</th>
                    <th>Date</th>
                    <th>Customer Name</th>
                    <th>Phone</th>
                    <th style={{ textAlign: 'right' }}>Total (৳)</th>
                    <th style={{ textAlign: 'right' }}>Paid (৳)</th>
                    <th style={{ textAlign: 'right' }}>Due (৳)</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableLoading colSpan={8} message="Loading sales..." />
                  ) : overallSales.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                        No sales found for this period.
                      </td>
                    </tr>
                  ) : (
                    overallSales.map((s) => {
                      const net = parseFloat(s.net_amount) || 0;
                      const paid = parseFloat(s.paid_amount) || 0;
                      const due = Math.max(0, net - paid);
                      return (
                        <tr key={s.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                            {s.invoice_number || `INV#${s.id.substring(0, 8).toUpperCase()}`}
                          </td>
                          <td>{new Date(s.sale_date).toLocaleDateString('en-GB')}</td>
                          <td style={{ fontWeight: 600 }}>{s.contacts?.name || 'Walk-in'}</td>
                          <td>{s.contacts?.phone || '-'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{formatAmount(net)}</td>
                          <td style={{ textAlign: 'right', color: '#059669' }}>৳{formatAmount(paid)}</td>
                          <td style={{ textAlign: 'right', color: due > 0 ? '#dc2626' : 'inherit', fontWeight: due > 0 ? 700 : 400 }}>
                            ৳{formatAmount(due)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge badge-${s.payment_status}`}>{s.payment_status}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. CUSTOMER REPORT VIEW                                   */}
      {/* ========================================================= */}
      {activeTab === 'customer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Customer Search / Selection Card (Ultra-Compact) */}
          <div
            className="no-print card"
            style={{
              padding: '0.45rem 0.65rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.4rem',
              overflow: 'visible',
              position: 'relative',
              zIndex: 150,
            }}
          >
            {/* Search by Phone input */}
            <div ref={phoneRef} style={{ position: 'relative', zIndex: 151 }}>
              <label style={{ display: 'block', marginBottom: '0.15rem', fontWeight: 600, fontSize: '0.7rem' }}>
                Search by Phone or Name:
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={12} style={{ position: 'absolute', left: '0.55rem', top: '50%', transform: 'translateY(-50%)', color: '#0284c7' }} />
                <input
                  type="text"
                  className="input-control"
                  placeholder="Type customer name or phone..."
                  value={phoneSearch}
                  onChange={(e) => {
                    setPhoneSearch(e.target.value);
                    setShowPhoneList(true);
                  }}
                  onFocus={() => setShowPhoneList(true)}
                  onClick={() => setShowPhoneList(true)}
                  style={{ paddingLeft: '1.65rem', paddingRight: '1.65rem', fontSize: '0.78rem', padding: '0.22rem 1.65rem' }}
                />
                {phoneSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneSearch('');
                      setShowPhoneList(false);
                    }}
                    style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Suggestions dropdown */}
              {showPhoneList && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #0284c7',
                    borderRadius: 'var(--border-radius-sm)',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    zIndex: 9999,
                    marginTop: '0.25rem',
                  }}
                >
                  {filteredCustomers.length === 0 ? (
                    <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No customers found
                    </div>
                  ) : (
                    filteredCustomers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setPhoneSearch(`${c.name} (${c.phone || 'No phone'})`);
                          setShowPhoneList(false);
                        }}
                        style={{
                          padding: '0.4rem 0.6rem',
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          backgroundColor: selectedCustomerId === c.id ? '#e0f2fe' : '#ffffff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = selectedCustomerId === c.id ? '#e0f2fe' : '#ffffff')}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{c.name}</div>
                          <div style={{ fontSize: '0.68rem', color: '#0284c7' }}>📞 {c.phone || 'No Phone'}</div>
                        </div>
                        <span className="badge badge-secondary" style={{ fontSize: '0.62rem' }}>Select</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Select Customer Dropdown */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.15rem', fontWeight: 600, fontSize: '0.7rem' }}>
                Or Choose from List:
              </label>
              <select
                className="input-control"
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  const found = customers.find((c) => c.id === e.target.value);
                  if (found) setPhoneSearch(`${found.name} (${found.phone || ''})`);
                }}
                style={{ fontSize: '0.78rem', padding: '0.22rem 0.4rem' }}
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer Report Content */}
          {!selectedCustomerId ? (
            <div className="card" style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Users size={32} style={{ margin: '0 auto 0.5rem', color: '#bae6fd' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Select a Customer</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem' }}>
                Search by phone number or select a customer to view their statement.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Selected Customer Header & Ultra-Compact Stats */}
              <div 
                className="card" 
                style={{ 
                  padding: '0.45rem 0.65rem', 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '0.4rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderLeft: '4px solid #0284c7'
                }}
              >
                {/* Top: Customer Info */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <div style={{ 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: '50%', 
                      backgroundColor: '#e0f2fe', 
                      color: '#0284c7', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      flexShrink: 0
                    }}>
                      {selectedCustomer?.name ? selectedCustomer.name.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>{selectedCustomer?.name}</span>
                        <span className="badge badge-info" style={{ fontSize: '0.58rem', padding: '0.05rem 0.25rem' }}>Customer</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {selectedCustomer?.phone && <span>📞 {selectedCustomer.phone}</span>}
                        <span>🏢 {selectedBranchName}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom: 3 Metric Cards strictly side-by-side on 1 row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', width: '100%' }}>
                  <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.25rem 0.35rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Invoiced ({customerSales.length})
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0284c7', fontFamily: 'Outfit, sans-serif' }}>
                      ৳{formatAmount(customerTotalBilled)}
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.25rem 0.35rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Total Paid
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#059669', fontFamily: 'Outfit, sans-serif' }}>
                      ৳{formatAmount(customerTotalPaid)}
                    </div>
                  </div>

                  <div style={{ 
                    backgroundColor: customerTotalDue > 0 ? '#fef2f2' : '#f0fdf4', 
                    border: `1px solid ${customerTotalDue > 0 ? '#fca5a5' : '#86efac'}`, 
                    borderRadius: '4px', 
                    padding: '0.25rem 0.35rem', 
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.6rem', color: customerTotalDue > 0 ? '#dc2626' : '#16a34a', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Due Balance
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: customerTotalDue > 0 ? '#dc2626' : '#16a34a', fontFamily: 'Outfit, sans-serif' }}>
                      ৳{formatAmount(customerTotalDue)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Sales Table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '0.65rem 0.95rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Customer Invoices ({customerSales.length})</span>
                </div>
                <div className="table-container" style={{ border: 'none' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice / Challan #</th>
                        <th>Date</th>
                        <th style={{ textAlign: 'right' }}>Subtotal</th>
                        <th style={{ textAlign: 'right' }}>Discount</th>
                        <th style={{ textAlign: 'right' }}>Net Bill (৳)</th>
                        <th style={{ textAlign: 'right' }}>Paid (৳)</th>
                        <th style={{ textAlign: 'right' }}>Due (৳)</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <TableLoading colSpan={8} message="Loading customer invoices..." />
                      ) : customerSales.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                            No invoices recorded for this customer in the selected date range.
                          </td>
                        </tr>
                      ) : (
                        customerSales.map((s) => {
                          const net = parseFloat(s.net_amount) || 0;
                          const paid = parseFloat(s.paid_amount) || 0;
                          const due = Math.max(0, net - paid);
                          return (
                            <tr key={s.id}>
                              <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                                {s.invoice_number || `INV#${s.id.substring(0, 8).toUpperCase()}`}
                              </td>
                              <td>{new Date(s.sale_date).toLocaleDateString('en-GB')}</td>
                              <td style={{ textAlign: 'right' }}>৳{formatAmount(s.total_amount)}</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>৳{formatAmount(s.discount)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{formatAmount(net)}</td>
                              <td style={{ textAlign: 'right', color: '#059669' }}>৳{formatAmount(paid)}</td>
                              <td style={{ textAlign: 'right', color: due > 0 ? '#dc2626' : 'inherit', fontWeight: due > 0 ? 700 : 400 }}>
                                ৳{formatAmount(due)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`badge badge-${s.payment_status}`}>{s.payment_status}</span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. CUSTOMER PAYMENTS REPORT VIEW                          */}
      {/* ========================================================= */}
      {activeTab === 'payments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Customer Search / Filter Card (Ultra-Compact) */}
          <div
            className="no-print card"
            style={{
              padding: '0.45rem 0.65rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.4rem',
              overflow: 'visible',
              position: 'relative',
              zIndex: 150,
            }}
          >
            {/* Search by Phone or Name */}
            <div ref={phoneRef} style={{ position: 'relative', zIndex: 151 }}>
              <label style={{ display: 'block', marginBottom: '0.15rem', fontWeight: 600, fontSize: '0.7rem' }}>
                Filter by Customer Phone or Name:
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={12} style={{ position: 'absolute', left: '0.55rem', top: '50%', transform: 'translateY(-50%)', color: '#0284c7' }} />
                <input
                  type="text"
                  className="input-control"
                  placeholder="All Customers (or type to filter)..."
                  value={phoneSearch}
                  onChange={(e) => {
                    setPhoneSearch(e.target.value);
                    setShowPhoneList(true);
                  }}
                  onFocus={() => setShowPhoneList(true)}
                  onClick={() => setShowPhoneList(true)}
                  style={{ paddingLeft: '1.65rem', paddingRight: '1.65rem', fontSize: '0.78rem', padding: '0.22rem 1.65rem' }}
                />
                {phoneSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneSearch('');
                      setSelectedCustomerId('');
                      setShowPhoneList(false);
                    }}
                    style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Dropdown Suggestions */}
              {showPhoneList && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #0284c7',
                    borderRadius: 'var(--border-radius-sm)',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    zIndex: 9999,
                    marginTop: '0.25rem',
                  }}
                >
                  <div
                    onClick={() => {
                      setSelectedCustomerId('');
                      setPhoneSearch('');
                      setShowPhoneList(false);
                    }}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      backgroundColor: !selectedCustomerId ? '#e0f2fe' : '#ffffff',
                      fontWeight: 700,
                      color: '#0284c7',
                      fontSize: '0.78rem'
                    }}
                  >
                    👥 View All Customers
                  </div>
                  {filteredCustomers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setPhoneSearch(`${c.name} (${c.phone || 'No phone'})`);
                        setShowPhoneList(false);
                      }}
                      style={{
                        padding: '0.4rem 0.6rem',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        backgroundColor: selectedCustomerId === c.id ? '#e0f2fe' : '#ffffff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = selectedCustomerId === c.id ? '#e0f2fe' : '#ffffff')}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{c.name}</div>
                        <div style={{ fontSize: '0.68rem', color: '#0284c7' }}>📞 {c.phone || 'No Phone'}</div>
                      </div>
                      <span className="badge badge-secondary" style={{ fontSize: '0.62rem' }}>Select</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Select Customer Dropdown */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.15rem', fontWeight: 600, fontSize: '0.7rem' }}>
                Customer Selection:
              </label>
              <select
                className="input-control"
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  const found = customers.find((c) => c.id === e.target.value);
                  if (found) {
                    setPhoneSearch(`${found.name} (${found.phone || ''})`);
                  } else {
                    setPhoneSearch('');
                  }
                }}
                style={{ fontSize: '0.78rem', padding: '0.22rem 0.4rem' }}
              >
                <option value="">All Customers (Company-wide)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Customer Scope & Ultra-Compact Summary Stats */}
          <div 
            className="card" 
            style={{ 
              padding: '0.45rem 0.65rem', 
              display: 'flex', 
              flexDirection: 'column',
              gap: '0.4rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderLeft: `4px solid ${selectedCustomer ? '#0284c7' : '#10b981'}`
            }}
          >
            {/* Top: Customer / Scope Details */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <div style={{ 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  backgroundColor: selectedCustomer ? '#e0f2fe' : '#dcfce7', 
                  color: selectedCustomer ? '#0284c7' : '#16a34a', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  flexShrink: 0
                }}>
                  {selectedCustomer ? selectedCustomer.name.charAt(0).toUpperCase() : '★'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>
                      {selectedCustomer ? selectedCustomer.name : 'All Customers (Company-wide)'}
                    </span>
                    <span className={`badge badge-${selectedCustomer ? 'info' : 'success'}`} style={{ fontSize: '0.58rem', padding: '0.05rem 0.25rem' }}>
                      {selectedCustomer ? 'Customer' : 'Company'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {selectedCustomer?.phone && <span>📞 {selectedCustomer.phone}</span>}
                    <span>🏢 {selectedBranchName}</span>
                    {paymentMethodFilter !== 'all' && <span>💳 {paymentMethodFilter.toUpperCase()}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom: 3 Metric Cards strictly side-by-side on 1 row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', width: '100%' }}>
              <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.25rem 0.35rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Total Collected ({customerPayments.length})
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#059669', fontFamily: 'Outfit, sans-serif' }}>
                  ৳{formatAmount(paymentsTotalAmount)}
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.25rem 0.35rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Cash Collections
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0284c7', fontFamily: 'Outfit, sans-serif' }}>
                  ৳{formatAmount(paymentsCashAmount)}
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.25rem 0.35rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Bank & Digital
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#7c3aed', fontFamily: 'Outfit, sans-serif' }}>
                  ৳{formatAmount(paymentsDigitalAmount)}
                </div>
              </div>
            </div>
          </div>

          {/* Customer Payments Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.65rem 0.95rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Customer Payment Collections ({customerPayments.length})</span>
            </div>
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Receipt / Trx #</th>
                    <th>Date</th>
                    {!selectedCustomerId && <th>Customer Name</th>}
                    <th>Invoice Ref</th>
                    <th>Method</th>
                    <th>Notes / Ref</th>
                    <th style={{ textAlign: 'right' }}>Amount (৳)</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableLoading colSpan={selectedCustomerId ? 6 : 7} message="Loading customer payments..." />
                  ) : customerPayments.length === 0 ? (
                    <tr>
                      <td colSpan={selectedCustomerId ? 6 : 7} style={{ textAlign: 'center', padding: '2rem' }}>
                        No payment records found for the selected filter & date range.
                      </td>
                    </tr>
                  ) : (
                    customerPayments.map((p) => {
                      const invNo = p.reference_invoice_id ? paymentSalesMap[p.reference_invoice_id] || `INV#${p.reference_invoice_id.substring(0, 8).toUpperCase()}` : 'Direct Receipt';
                      return (
                        <tr key={p.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                            {p.payment_number || `RCP#${p.id.substring(0, 8).toUpperCase()}`}
                          </td>
                          <td>{new Date(p.payment_date).toLocaleDateString('en-GB')}</td>
                          {!selectedCustomerId && (
                            <td>
                              <div style={{ fontWeight: 600 }}>{p.contacts?.name || 'Walk-in'}</div>
                              {p.contacts?.phone && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>📞 {p.contacts.phone}</div>}
                            </td>
                          )}
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {invNo}
                          </td>
                          <td>
                            <span className="badge badge-success" style={{ textTransform: 'uppercase', fontSize: '0.72rem' }}>
                              {p.payment_method || 'cash'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: '#475569' }}>
                            {p.notes || '-'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: '0.92rem' }}>
                            ৳{formatAmount(p.amount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* REPORT PRINT MODAL PREVIEW (MATCHING SALES PRINT EXACTLY) */}
      {/* ========================================================= */}
      {showReportPrint && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px', width: '95%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header no-print">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Printer size={18} />
                <span>
                  {activeTab === 'overall' 
                    ? 'Overall Business Report Print Preview' 
                    : activeTab === 'customer' 
                    ? `Customer Statement — ${selectedCustomer?.name || 'Customer'}`
                    : `Customer Payment Report — ${selectedCustomer?.name || 'All Customers'}`}
                </span>
              </h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowReportPrint(false)}
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body" style={{ overflowY: 'auto', padding: '0.85rem', backgroundColor: '#f8fafc' }}>
              <div 
                className="invoice-print-view" 
                style={{ 
                  margin: '0 auto', 
                  border: '1px solid #000', 
                  backgroundColor: '#ffffff',
                  padding: '0.8rem 1rem',
                  position: 'relative',
                  color: '#000',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}
              >
                {/* WATERMARK */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-25deg)',
                  fontSize: '2.8rem',
                  fontWeight: 900,
                  color: 'rgba(0, 0, 0, 0.035)',
                  letterSpacing: '8px',
                  textTransform: 'uppercase',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  border: '3px solid rgba(0,0,0,0.035)',
                  padding: '0.4rem 2rem',
                  borderRadius: '10px',
                  fontFamily: 'Outfit, sans-serif'
                }}>
                  {activeTab === 'overall' ? 'OVERALL REPORT' : activeTab === 'customer' ? 'CUSTOMER STATEMENT' : 'CUSTOMER PAYMENTS'}
                </div>

                {/* 1. COMPACT TOP HEADER WITH OFFICIAL LOGO & TITLE */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #000', paddingBottom: '0.3rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <img 
                      src={almasLogo} 
                      alt="Almas Logo" 
                      style={{ width: '38px', height: '38px', objectFit: 'contain', border: '1px solid #000', padding: '1px', background: '#fff', borderRadius: '3px' }} 
                    />
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.2px', color: '#000', textTransform: 'uppercase', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>
                        ALMAS ACCESSORIES INDUSTRIES
                      </h1>
                      <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#334155', fontStyle: 'italic', marginTop: '0.05rem' }}>
                        100% Export Oriented Garments Accessories Industries
                      </div>
                    </div>
                  </div>

                  {/* DISTINCTIVE COMPACT PILL BADGE */}
                  <div style={{
                    border: '1.5px solid #000',
                    borderRadius: '9999px',
                    padding: '0.2rem 0.85rem',
                    textAlign: 'center',
                    backgroundColor: '#ffffff',
                    boxShadow: 'inset 0 0 0 1px #fff, inset 0 0 0 2px #000',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <span style={{
                      fontFamily: '"Times New Roman", Times, Georgia, serif',
                      fontSize: '0.85rem',
                      fontWeight: 900,
                      fontStyle: 'italic',
                      letterSpacing: '1px',
                      color: '#000',
                      textTransform: 'uppercase',
                      padding: '0 0.1rem',
                      lineHeight: 1
                    }}>
                      {activeTab === 'overall' ? 'OVERALL REPORT' : activeTab === 'customer' ? 'CUSTOMER STATEMENT' : 'CUSTOMER PAYMENT REPORT'}
                    </span>
                  </div>
                </div>

                {/* 2. COMPACT REPORT METADATA GRID */}
                <div style={{ marginTop: '0.32rem', display: 'flex', flexDirection: 'column', gap: '0.18rem', fontSize: '0.76rem', lineHeight: 1.2 }}>
                  {activeTab === 'overall' ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Report Period :</span>
                          <span style={{ fontWeight: 800, borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem' }}>
                            {new Date(startDate).toLocaleDateString('en-GB')} — {new Date(endDate).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem', width: '38%' }}>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Date :</span>
                          <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontWeight: 700 }}>
                            {new Date().toLocaleDateString('en-GB')}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Branch :</span>
                          <span style={{ fontWeight: 700, borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem' }}>
                            {selectedBranchName} {selectedBranchObj?.address ? `(${selectedBranchObj.address})` : ''}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem', width: '38%' }}>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Total Invoices :</span>
                          <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontWeight: 800 }}>
                            {overallSales.length}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Messrs :</span>
                          <span style={{ fontWeight: 800, borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontSize: '0.84rem' }}>
                            {selectedCustomer?.name || 'All Customers (Company-wide)'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem', width: '38%' }}>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Date :</span>
                          <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontWeight: 700 }}>
                            {new Date().toLocaleDateString('en-GB')}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Phone :</span>
                          <span style={{ fontWeight: 700, borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem' }}>
                            {selectedCustomer?.phone || 'All Registered Customers'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem', width: '38%' }}>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Period :</span>
                          <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontWeight: 700 }}>
                            {new Date(startDate).toLocaleDateString('en-GB')} - {new Date(endDate).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Address :</span>
                          <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem' }}>
                            {selectedCustomer?.address || ''}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem', width: '38%' }}>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Branch :</span>
                          <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontWeight: 600 }}>
                            {selectedBranchName} {selectedBranchObj?.address ? `(${selectedBranchObj.address})` : ''}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 3. REPORT DATA TABLE */}
                {activeTab === 'overall' ? (
                  <table 
                    style={{ 
                      width: '100%', 
                      borderCollapse: 'collapse', 
                      marginTop: '0.85rem', 
                      border: '1.5px solid #000',
                      fontSize: '0.82rem'
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#f1f5f9' }}>
                        <th style={{ width: '40px', borderRight: '1px solid #000', padding: '0.45rem 0.35rem', textAlign: 'center', fontWeight: 800 }}>Sl.</th>
                        <th style={{ width: '130px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 800 }}>Invoice / Challan #</th>
                        <th style={{ width: '85px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'center', fontWeight: 800 }}>Date</th>
                        <th style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 800 }}>Customer Name</th>
                        <th style={{ width: '95px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Total (৳)</th>
                        <th style={{ width: '95px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Paid (৳)</th>
                        <th style={{ width: '95px', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Due (৳)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overallSales.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem' }}>No sales records found for this period.</td>
                        </tr>
                      ) : (
                        overallSales.map((s, idx) => {
                          const net = parseFloat(s.net_amount) || 0;
                          const paid = parseFloat(s.paid_amount) || 0;
                          const due = Math.max(0, net - paid);
                          return (
                            <tr key={s.id || idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                              <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.4rem 0.35rem', fontWeight: 600 }}>{idx + 1}</td>
                              <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, letterSpacing: '0.2px', borderRight: '1px solid #000', padding: '0.4rem 0.5rem' }}>
                                {s.invoice_number || `INV#${s.id.substring(0, 8).toUpperCase()}`}
                              </td>
                              <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.4rem 0.5rem' }}>
                                {new Date(s.sale_date).toLocaleDateString('en-GB')}
                              </td>
                              <td style={{ borderRight: '1px solid #000', padding: '0.4rem 0.5rem', fontWeight: 600 }}>
                                {s.contacts?.name || 'Walk-in'}
                              </td>
                              <td style={{ textAlign: 'right', borderRight: '1px solid #000', padding: '0.4rem 0.5rem', fontWeight: 700 }}>
                                ৳{formatAmount(net)}
                              </td>
                              <td style={{ textAlign: 'right', borderRight: '1px solid #000', padding: '0.4rem 0.5rem', color: '#059669', fontWeight: 600 }}>
                                ৳{formatAmount(paid)}
                              </td>
                              <td style={{ textAlign: 'right', padding: '0.4rem 0.5rem', fontWeight: due > 0 ? 800 : 600, color: due > 0 ? '#dc2626' : '#000' }}>
                                ৳{formatAmount(due)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                ) : activeTab === 'customer' ? (
                  <table 
                    style={{ 
                      width: '100%', 
                      borderCollapse: 'collapse', 
                      marginTop: '0.85rem', 
                      border: '1.5px solid #000',
                      fontSize: '0.82rem'
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#f1f5f9' }}>
                        <th style={{ width: '40px', borderRight: '1px solid #000', padding: '0.45rem 0.35rem', textAlign: 'center', fontWeight: 800 }}>Sl.</th>
                        <th style={{ width: '130px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 800 }}>Invoice / Challan #</th>
                        <th style={{ width: '85px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'center', fontWeight: 800 }}>Date</th>
                        <th style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Subtotal (৳)</th>
                        <th style={{ width: '90px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Discount</th>
                        <th style={{ width: '95px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Net Bill (৳)</th>
                        <th style={{ width: '95px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Paid (৳)</th>
                        <th style={{ width: '95px', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Due (৳)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerSales.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem' }}>No invoice records found for this customer.</td>
                        </tr>
                      ) : (
                        customerSales.map((s, idx) => {
                          const net = parseFloat(s.net_amount) || 0;
                          const paid = parseFloat(s.paid_amount) || 0;
                          const due = Math.max(0, net - paid);
                          return (
                            <tr key={s.id || idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                              <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.4rem 0.35rem', fontWeight: 600 }}>{idx + 1}</td>
                              <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, letterSpacing: '0.2px', borderRight: '1px solid #000', padding: '0.4rem 0.5rem' }}>
                                {s.invoice_number || `INV#${s.id.substring(0, 8).toUpperCase()}`}
                              </td>
                              <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.4rem 0.5rem' }}>
                                {new Date(s.sale_date).toLocaleDateString('en-GB')}
                              </td>
                              <td style={{ textAlign: 'right', borderRight: '1px solid #000', padding: '0.4rem 0.5rem' }}>
                                ৳{formatAmount(s.total_amount)}
                              </td>
                              <td style={{ textAlign: 'right', borderRight: '1px solid #000', padding: '0.4rem 0.5rem', color: '#475569' }}>
                                ৳{formatAmount(s.discount)}
                              </td>
                              <td style={{ textAlign: 'right', borderRight: '1px solid #000', padding: '0.4rem 0.5rem', fontWeight: 700 }}>
                                ৳{formatAmount(net)}
                              </td>
                              <td style={{ textAlign: 'right', borderRight: '1px solid #000', padding: '0.4rem 0.5rem', color: '#059669', fontWeight: 600 }}>
                                ৳{formatAmount(paid)}
                              </td>
                              <td style={{ textAlign: 'right', padding: '0.4rem 0.5rem', fontWeight: due > 0 ? 800 : 600, color: due > 0 ? '#dc2626' : '#000' }}>
                                ৳{formatAmount(due)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table 
                    style={{ 
                      width: '100%', 
                      borderCollapse: 'collapse', 
                      marginTop: '0.85rem', 
                      border: '1.5px solid #000',
                      fontSize: '0.82rem'
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#f1f5f9' }}>
                        <th style={{ width: '35px', borderRight: '1px solid #000', padding: '0.45rem 0.35rem', textAlign: 'center', fontWeight: 800 }}>Sl.</th>
                        <th style={{ width: '120px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 800 }}>Receipt / Trx #</th>
                        <th style={{ width: '80px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'center', fontWeight: 800 }}>Date</th>
                        {!selectedCustomerId && (
                          <th style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 800 }}>Customer Name</th>
                        )}
                        <th style={{ width: selectedCustomerId ? '160px' : '110px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 800 }}>Invoice Ref</th>
                        <th style={{ width: '75px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'center', fontWeight: 800 }}>Method</th>
                        <th style={{ width: '95px', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Amount (৳)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerPayments.length === 0 ? (
                        <tr>
                          <td colSpan={selectedCustomerId ? 6 : 7} style={{ textAlign: 'center', padding: '1.5rem' }}>No payment records found for this period.</td>
                        </tr>
                      ) : (
                        customerPayments.map((p, idx) => {
                          const invNo = p.reference_invoice_id ? paymentSalesMap[p.reference_invoice_id] || `INV#${p.reference_invoice_id.substring(0, 8).toUpperCase()}` : 'Direct Receipt';
                          return (
                            <tr key={p.id || idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                              <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.4rem 0.35rem', fontWeight: 600 }}>{idx + 1}</td>
                              <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, letterSpacing: '0.2px', borderRight: '1px solid #000', padding: '0.4rem 0.5rem' }}>
                                {p.payment_number || `RCP#${p.id.substring(0, 8).toUpperCase()}`}
                              </td>
                              <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.4rem 0.5rem' }}>
                                {new Date(p.payment_date).toLocaleDateString('en-GB')}
                              </td>
                              {!selectedCustomerId && (
                                <td style={{ borderRight: '1px solid #000', padding: '0.4rem 0.5rem', fontWeight: 600 }}>
                                  {p.contacts?.name || 'Walk-in'}
                                </td>
                              )}
                              <td style={{ borderRight: '1px solid #000', padding: '0.4rem 0.5rem', fontWeight: 700, fontSize: '0.78rem' }}>
                                {invNo}
                              </td>
                              <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.4rem 0.5rem', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600 }}>
                                {p.payment_method || 'cash'}
                              </td>
                              <td style={{ textAlign: 'right', padding: '0.4rem 0.5rem', fontWeight: 800, color: '#059669' }}>
                                ৳{formatAmount(p.amount)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}

                {/* 4. TOTALS & FINANCIAL SUMMARY BOX */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', marginTop: '0.85rem' }}>
                  <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', border: '1px solid #000', padding: '0.65rem 0.85rem', borderRadius: '4px', backgroundColor: '#fdfdfd' }}>
                    {activeTab === 'overall' ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600 }}>Total Sales:</span>
                          <span style={{ fontWeight: 700 }}>৳{formatAmount(overallTotalRevenue)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600 }}>Total Purchases:</span>
                          <span>৳{formatAmount(overallPurchasesTotal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600 }}>Total Expenses:</span>
                          <span>৳{formatAmount(overallExpensesTotal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px dashed #000', paddingTop: '0.25rem', color: overallNetProfit >= 0 ? '#059669' : '#dc2626' }}>
                          <span>Net Profit:</span>
                          <span>৳{formatAmount(overallNetProfit)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700, borderTop: '1.5px solid #000', paddingTop: '0.35rem' }}>
                          <span>Total Collected:</span>
                          <span>৳{formatAmount(overallTotalPaid)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: overallTotalDue > 0 ? '#dc2626' : '#000', fontWeight: 800 }}>
                          <span>Total Customer Due:</span>
                          <span>৳{formatAmount(overallTotalDue)}</span>
                        </div>
                      </>
                    ) : activeTab === 'customer' ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span>Total Invoiced:</span>
                          <span>৳{formatAmount(customerTotalBilled)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700 }}>
                          <span>Total Paid:</span>
                          <span>৳{formatAmount(customerTotalPaid)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, borderTop: '1.5px solid #000', paddingTop: '0.35rem', fontSize: '0.95rem', color: customerTotalDue > 0 ? '#dc2626' : '#059669' }}>
                          <span>Total Due Balance:</span>
                          <span>৳{formatAmount(customerTotalDue)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>Total Transactions:</span>
                          <span>{customerPayments.length}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600 }}>Cash Collections:</span>
                          <span>৳{formatAmount(paymentsCashAmount)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600 }}>Bank / Digital:</span>
                          <span>৳{formatAmount(paymentsDigitalAmount)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, borderTop: '1.5px solid #000', paddingTop: '0.35rem', fontSize: '0.95rem', color: '#059669' }}>
                          <span>Total Received:</span>
                          <span>৳{formatAmount(paymentsTotalAmount)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 5. BOTTOM OFFICIAL FACTORY / BRANCH FOOTER */}
                {(() => {
                  const isFactoryBranch = selectedBranchObj ? Boolean(selectedBranchObj.is_factory) : true;
                  const label = isFactoryBranch ? 'Office & Factory' : 'Showroom';
                  const branchAddr = selectedBranchObj?.address || '604/750, Najir Ahamed Mistiri Sodok, West Jharnapara, Baro Quarter, Doublemooring, Chattogram, Bangladesh.';
                  const branchCell = selectedBranchObj?.phone || '01819-898617, 01845-069803';

                  return (
                    <div style={{ borderTop: '1.5px solid #000', marginTop: '1.5rem', paddingTop: '0.5rem', textAlign: 'center', fontSize: '0.74rem', color: '#1e293b', lineHeight: 1.4 }}>
                      <div style={{ fontWeight: 700 }}>
                        {label} : {branchAddr} &nbsp;|&nbsp; Cell : {branchCell}
                      </div>
                      <div style={{ color: '#475569' }}>
                        E-mail : almasaccessoriesind@gmail.com, Web : www.almasaccessories.com
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="modal-footer no-print">
              <button type="button" className="btn btn-secondary" onClick={() => setShowReportPrint(false)}>Close</button>
              <button type="button" className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Printer size={16} /> Print Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DIRECT PRINT VIEW (IF WINDOW.PRINT TRIGGERED OUTSIDE MODAL) */}
      {/* ========================================================= */}
      <div className="print-only">
        <div 
          className="invoice-print-view" 
          style={{ 
            margin: '0 auto', 
            border: 'none', 
            backgroundColor: '#ffffff',
            padding: '1rem',
            position: 'relative',
            color: '#000'
          }}
        >
          {/* 1. COMPACT TOP HEADER WITH OFFICIAL LOGO & TITLE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #000', paddingBottom: '0.3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <img 
                src={almasLogo} 
                alt="Almas Logo" 
                style={{ width: '38px', height: '38px', objectFit: 'contain', border: '1px solid #000', padding: '1px', background: '#fff', borderRadius: '3px' }} 
              />
              <div>
                <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.2px', color: '#000', textTransform: 'uppercase', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>
                  ALMAS ACCESSORIES INDUSTRIES
                </h1>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#334155', fontStyle: 'italic', marginTop: '0.05rem' }}>
                  100% Export Oriented Garments Accessories Industries
                </div>
              </div>
            </div>

            {/* DISTINCTIVE COMPACT PILL BADGE */}
            <div style={{
              border: '1.5px solid #000',
              borderRadius: '9999px',
              padding: '0.2rem 0.85rem',
              textAlign: 'center',
              backgroundColor: '#ffffff',
              boxShadow: 'inset 0 0 0 1px #fff, inset 0 0 0 2px #000',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: '"Times New Roman", Times, Georgia, serif',
                fontSize: '0.85rem',
                fontWeight: 900,
                fontStyle: 'italic',
                letterSpacing: '1px',
                color: '#000',
                textTransform: 'uppercase',
                padding: '0 0.1rem',
                lineHeight: 1
              }}>
                {activeTab === 'overall' ? 'OVERALL REPORT' : activeTab === 'customer' ? 'CUSTOMER STATEMENT' : 'CUSTOMER PAYMENT REPORT'}
              </span>
            </div>
          </div>

          {/* 2. COMPACT REPORT METADATA GRID */}
          <div style={{ marginTop: '0.32rem', display: 'flex', flexDirection: 'column', gap: '0.18rem', fontSize: '0.76rem', lineHeight: 1.2 }}>
            {activeTab === 'overall' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Report Period :</span>
                    <span style={{ fontWeight: 800, borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem' }}>
                      {new Date(startDate).toLocaleDateString('en-GB')} — {new Date(endDate).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', width: '38%' }}>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Date :</span>
                    <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontWeight: 700 }}>
                      {new Date().toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Branch :</span>
                    <span style={{ fontWeight: 700, borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem' }}>
                      {selectedBranchName} {selectedBranchObj?.address ? `(${selectedBranchObj.address})` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', width: '38%' }}>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Total Invoices :</span>
                    <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontWeight: 800 }}>
                      {overallSales.length}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Messrs :</span>
                    <span style={{ fontWeight: 800, borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontSize: '0.84rem' }}>
                      {selectedCustomer?.name || 'All Customers (Company-wide)'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', width: '38%' }}>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Date :</span>
                    <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontWeight: 700 }}>
                      {new Date().toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Phone :</span>
                    <span style={{ fontWeight: 700, borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem' }}>
                      {selectedCustomer?.phone || 'All Registered Customers'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', width: '38%' }}>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Period :</span>
                    <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontWeight: 700 }}>
                      {new Date(startDate).toLocaleDateString('en-GB')} - {new Date(endDate).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.3rem', width: '58%' }}>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Address :</span>
                    <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem' }}>
                      {selectedCustomer?.address || ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', width: '38%' }}>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Branch :</span>
                    <span style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '0.2rem', fontWeight: 600 }}>
                      {selectedBranchName} {selectedBranchObj?.address ? `(${selectedBranchObj.address})` : ''}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3. REPORT DATA TABLE */}
          {activeTab === 'overall' ? (
            <table 
              style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                marginTop: '0.85rem', 
                border: '1.5px solid #000',
                fontSize: '0.82rem'
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#f1f5f9' }}>
                  <th style={{ width: '40px', borderRight: '1px solid #000', padding: '0.45rem 0.35rem', textAlign: 'center', fontWeight: 800 }}>Sl.</th>
                  <th style={{ width: '130px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 800 }}>Invoice / Challan #</th>
                  <th style={{ width: '85px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'center', fontWeight: 800 }}>Date</th>
                  <th style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 800 }}>Customer Name</th>
                  <th style={{ width: '95px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Total (৳)</th>
                  <th style={{ width: '95px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Paid (৳)</th>
                  <th style={{ width: '95px', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Due (৳)</th>
                </tr>
              </thead>
              <tbody>
                {overallSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem' }}>No sales records found for this period.</td>
                  </tr>
                ) : (
                  overallSales.map((s, idx) => {
                    const net = parseFloat(s.net_amount) || 0;
                    const paid = parseFloat(s.paid_amount) || 0;
                    const due = Math.max(0, net - paid);
                    return (
                      <tr key={s.id || idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.4rem 0.35rem', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, letterSpacing: '0.2px', borderRight: '1px solid #000', padding: '0.4rem 0.5rem' }}>
                          {s.invoice_number || `INV#${s.id.substring(0, 8).toUpperCase()}`}
                        </td>
                        <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.4rem 0.5rem' }}>
                          {new Date(s.sale_date).toLocaleDateString('en-GB')}
                        </td>
                        <td style={{ borderRight: '1px solid #000', padding: '0.4rem 0.5rem', fontWeight: 600 }}>
                          {s.contacts?.name || 'Walk-in'}
                        </td>
                        <td style={{ textAlign: 'right', borderRight: '1px solid #000', padding: '0.4rem 0.5rem', fontWeight: 700 }}>
                          ৳{formatAmount(net)}
                        </td>
                        <td style={{ textAlign: 'right', borderRight: '1px solid #000', padding: '0.4rem 0.5rem', color: '#059669', fontWeight: 600 }}>
                          ৳{formatAmount(paid)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.4rem 0.5rem', fontWeight: due > 0 ? 800 : 600, color: due > 0 ? '#dc2626' : '#000' }}>
                          ৳{formatAmount(due)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : activeTab === 'customer' ? (
            <table 
              style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                marginTop: '0.85rem', 
                border: '1.5px solid #000',
                fontSize: '0.82rem'
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#f1f5f9' }}>
                  <th style={{ width: '40px', borderRight: '1px solid #000', padding: '0.45rem 0.35rem', textAlign: 'center', fontWeight: 800 }}>Sl.</th>
                  <th style={{ width: '130px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 800 }}>Invoice / Challan #</th>
                  <th style={{ width: '85px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'center', fontWeight: 800 }}>Date</th>
                  <th style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Subtotal (৳)</th>
                  <th style={{ width: '90px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Discount</th>
                  <th style={{ width: '95px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Net Bill (৳)</th>
                  <th style={{ width: '95px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Paid (৳)</th>
                  <th style={{ width: '95px', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Due (৳)</th>
                </tr>
              </thead>
              <tbody>
                {customerSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem' }}>No invoice records found for this customer.</td>
                  </tr>
                ) : (
                  customerSales.map((s, idx) => {
                    const net = parseFloat(s.net_amount) || 0;
                    const paid = parseFloat(s.paid_amount) || 0;
                    const due = Math.max(0, net - paid);
                    return (
                      <tr key={s.id || idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.4rem 0.35rem', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, letterSpacing: '0.2px', borderRight: '1px solid #000', padding: '0.4rem 0.5rem' }}>
                          {s.invoice_number || `INV#${s.id.substring(0, 8).toUpperCase()}`}
                        </td>
                        <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.4rem 0.5rem' }}>
                          {new Date(s.sale_date).toLocaleDateString('en-GB')}
                        </td>
                        <td style={{ textAlign: 'right', borderRight: '1px solid #000', padding: '0.4rem 0.5rem' }}>
                          ৳{formatAmount(s.total_amount)}
                        </td>
                        <td style={{ textAlign: 'right', borderRight: '1px solid #000', padding: '0.4rem 0.5rem', color: '#475569' }}>
                          ৳{formatAmount(s.discount)}
                        </td>
                        <td style={{ textAlign: 'right', borderRight: '1px solid #000', padding: '0.4rem 0.5rem', fontWeight: 700 }}>
                          ৳{formatAmount(net)}
                        </td>
                        <td style={{ textAlign: 'right', borderRight: '1px solid #000', padding: '0.4rem 0.5rem', color: '#059669', fontWeight: 600 }}>
                          ৳{formatAmount(paid)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.4rem 0.5rem', fontWeight: due > 0 ? 800 : 600, color: due > 0 ? '#dc2626' : '#000' }}>
                          ৳{formatAmount(due)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table 
              style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                marginTop: '0.85rem', 
                border: '1.5px solid #000',
                fontSize: '0.82rem'
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#f1f5f9' }}>
                  <th style={{ width: '35px', borderRight: '1px solid #000', padding: '0.45rem 0.35rem', textAlign: 'center', fontWeight: 800 }}>Sl.</th>
                  <th style={{ width: '120px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 800 }}>Receipt / Trx #</th>
                  <th style={{ width: '80px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'center', fontWeight: 800 }}>Date</th>
                  {!selectedCustomerId && (
                    <th style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 800 }}>Customer Name</th>
                  )}
                  <th style={{ width: selectedCustomerId ? '160px' : '110px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 800 }}>Invoice Ref</th>
                  <th style={{ width: '75px', borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'center', fontWeight: 800 }}>Method</th>
                  <th style={{ width: '95px', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Amount (৳)</th>
                </tr>
              </thead>
              <tbody>
                {customerPayments.length === 0 ? (
                  <tr>
                    <td colSpan={selectedCustomerId ? 6 : 7} style={{ textAlign: 'center', padding: '1.5rem' }}>No payment records found for this period.</td>
                  </tr>
                ) : (
                  customerPayments.map((p, idx) => {
                    const invNo = p.reference_invoice_id ? paymentSalesMap[p.reference_invoice_id] || `INV#${p.reference_invoice_id.substring(0, 8).toUpperCase()}` : 'Direct Receipt';
                    return (
                      <tr key={p.id || idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.4rem 0.35rem', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, letterSpacing: '0.2px', borderRight: '1px solid #000', padding: '0.4rem 0.5rem' }}>
                          {p.payment_number || `RCP#${p.id.substring(0, 8).toUpperCase()}`}
                        </td>
                        <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.4rem 0.5rem' }}>
                          {new Date(p.payment_date).toLocaleDateString('en-GB')}
                        </td>
                        {!selectedCustomerId && (
                          <td style={{ borderRight: '1px solid #000', padding: '0.4rem 0.5rem', fontWeight: 600 }}>
                            {p.contacts?.name || 'Walk-in'}
                          </td>
                        )}
                        <td style={{ borderRight: '1px solid #000', padding: '0.4rem 0.5rem', fontWeight: 700, fontSize: '0.78rem' }}>
                          {invNo}
                        </td>
                        <td style={{ textAlign: 'center', borderRight: '1px solid #000', padding: '0.4rem 0.5rem', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600 }}>
                          {p.payment_method || 'cash'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.4rem 0.5rem', fontWeight: 800, color: '#059669' }}>
                          ৳{formatAmount(p.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* 4. TOTALS & FINANCIAL SUMMARY BOX */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', marginTop: '0.85rem' }}>
            <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', border: '1px solid #000', padding: '0.65rem 0.85rem', borderRadius: '4px', backgroundColor: '#fdfdfd' }}>
              {activeTab === 'overall' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Total Sales:</span>
                    <span style={{ fontWeight: 700 }}>৳{formatAmount(overallTotalRevenue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Total Purchases:</span>
                    <span>৳{formatAmount(overallPurchasesTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Total Expenses:</span>
                    <span>৳{formatAmount(overallExpensesTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px dashed #000', paddingTop: '0.25rem', color: overallNetProfit >= 0 ? '#059669' : '#dc2626' }}>
                    <span>Net Profit:</span>
                    <span>৳{formatAmount(overallNetProfit)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700, borderTop: '1.5px solid #000', paddingTop: '0.35rem' }}>
                    <span>Total Collected:</span>
                    <span>৳{formatAmount(overallTotalPaid)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: overallTotalDue > 0 ? '#dc2626' : '#000', fontWeight: 800 }}>
                    <span>Total Customer Due:</span>
                    <span>৳{formatAmount(overallTotalDue)}</span>
                  </div>
                </>
              ) : activeTab === 'customer' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>Total Invoiced:</span>
                    <span>৳{formatAmount(customerTotalBilled)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700 }}>
                    <span>Total Paid:</span>
                    <span>৳{formatAmount(customerTotalPaid)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, borderTop: '1.5px solid #000', paddingTop: '0.35rem', fontSize: '0.95rem', color: customerTotalDue > 0 ? '#dc2626' : '#059669' }}>
                    <span>Total Due Balance:</span>
                    <span>৳{formatAmount(customerTotalDue)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>Total Transactions:</span>
                    <span>{customerPayments.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Cash Collections:</span>
                    <span>৳{formatAmount(paymentsCashAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Bank / Digital:</span>
                    <span>৳{formatAmount(paymentsDigitalAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, borderTop: '1.5px solid #000', paddingTop: '0.35rem', fontSize: '0.95rem', color: '#059669' }}>
                    <span>Total Received:</span>
                    <span>৳{formatAmount(paymentsTotalAmount)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 5. BOTTOM OFFICIAL FACTORY / BRANCH FOOTER */}
          {(() => {
            const isFactoryBranch = selectedBranchObj ? Boolean(selectedBranchObj.is_factory) : true;
            const label = isFactoryBranch ? 'Office & Factory' : 'Showroom';
            const branchAddr = selectedBranchObj?.address || '604/750, Najir Ahamed Mistiri Sodok, West Jharnapara, Baro Quarter, Doublemooring, Chattogram, Bangladesh.';
            const branchCell = selectedBranchObj?.phone || '01819-898617, 01845-069803';

            return (
              <div style={{ borderTop: '1.5px solid #000', marginTop: '1.5rem', paddingTop: '0.5rem', textAlign: 'center', fontSize: '0.74rem', color: '#1e293b', lineHeight: 1.4 }}>
                <div style={{ fontWeight: 700 }}>
                  {label} : {branchAddr} &nbsp;|&nbsp; Cell : {branchCell}
                </div>
                <div style={{ color: '#475569' }}>
                  E-mail : almasaccessoriesind@gmail.com, Web : www.almasaccessories.com
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
