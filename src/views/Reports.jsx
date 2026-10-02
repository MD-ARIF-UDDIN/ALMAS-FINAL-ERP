import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import almasLogo from '../assets/almas_logo.jpg';
import html2pdf from 'html2pdf.js';
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
  Truck,
  Download,
  FileText,
  Loader2,
  X
} from 'lucide-react';
import { TableLoading } from '../components/TableLoading';
import { formatAmount } from '../utils/format';

export default function Reports({ userProfile, branches = [] }) {
  // 4 Major Report Tabs
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ['overall', 'customer', 'supplier', 'payments'];
  const tabParam = searchParams.get('tab');
  const activeTab = validTabs.includes(tabParam) ? tabParam : 'overall';
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });
  const [loading, setLoading] = useState(false);

  // Date filters - default to All Time for comprehensive statement ledger
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');

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

  // Supplier Report State
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierPhoneSearch, setSupplierPhoneSearch] = useState('');
  const [showSupplierPhoneList, setShowSupplierPhoneList] = useState(false);
  const supplierPhoneRef = useRef(null);

  const [supplierPurchases, setSupplierPurchases] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Customer Payments State
  const [customerPayments, setCustomerPayments] = useState([]);
  const [paymentSalesMap, setPaymentSalesMap] = useState({});
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all'); // 'all' | 'cash' | 'bank' | 'bkash' | 'nagad'

  // Month Options for dropdown with "All Time"
  const monthOptions = useMemo(() => {
    const list = [{ label: 'All Time (Full History)', value: 'all' }];
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
    if (!monthVal || monthVal === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
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
      if (supplierPhoneRef.current && !supplierPhoneRef.current.contains(e.target)) {
        setShowSupplierPhoneList(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, []);

  // Fetch customer and supplier list once
  useEffect(() => {
    const loadContacts = async () => {
      const { data: custData } = await supabase
        .from('contacts')
        .select('id, name, phone, address')
        .eq('type', 'customer')
        .order('name', { ascending: true });
      setCustomers(custData || []);

      const { data: suppData } = await supabase
        .from('contacts')
        .select('id, name, phone, address')
        .eq('type', 'supplier')
        .order('name', { ascending: true });
      setSuppliers(suppData || []);
    };
    loadContacts();
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

  // Sync selectedSupplier with selectedSupplierId
  useEffect(() => {
    if (selectedSupplierId) {
      const supp = suppliers.find((s) => s.id === selectedSupplierId);
      setSelectedSupplier(supp || null);
    } else {
      setSelectedSupplier(null);
    }
  }, [selectedSupplierId, suppliers]);

  // Fetch Overall Report
  useEffect(() => {
    if (activeTab === 'overall') {
      loadOverallData();
    }
  }, [activeTab, startDate, endDate, selectedBranchId]);

  const loadOverallData = async () => {
    setLoading(true);
    try {
      // 1. Prepare Queries
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
        .order('sale_date', { ascending: false });

      if (startDate) salesQuery = salesQuery.gte('sale_date', startDate);
      if (endDate) salesQuery = salesQuery.lte('sale_date', endDate);

      let purQuery = supabase
        .from('purchases')
        .select('net_amount');

      if (startDate) purQuery = purQuery.gte('purchase_date', startDate);
      if (endDate) purQuery = purQuery.lte('purchase_date', endDate);

      let expQuery = supabase
        .from('expenses')
        .select('amount');

      if (startDate) expQuery = expQuery.gte('expense_date', startDate);
      if (endDate) expQuery = expQuery.lte('expense_date', endDate);

      if (selectedBranchId) {
        salesQuery = salesQuery.eq('branch_id', selectedBranchId);
        purQuery = purQuery.eq('branch_id', selectedBranchId);
        expQuery = expQuery.eq('branch_id', selectedBranchId);
      }

      // Execute all 3 queries concurrently in parallel
      const [{ data: sData }, { data: pData }, { data: eData }] = await Promise.all([
        salesQuery,
        purQuery,
        expQuery,
      ]);

      setOverallSales(sData || []);

      const pTotal = (pData || []).reduce((sum, p) => sum + (parseFloat(p.net_amount) || 0), 0);
      setOverallPurchasesTotal(pTotal);

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
        .order('sale_date', { ascending: false });

      if (startDate) query = query.gte('sale_date', startDate);
      if (endDate) query = query.lte('sale_date', endDate);

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

  // Fetch Supplier Report
  useEffect(() => {
    if (activeTab === 'supplier' && selectedSupplierId) {
      loadSupplierData(selectedSupplierId);
    }
  }, [activeTab, selectedSupplierId, startDate, endDate, selectedBranchId]);

  const loadSupplierData = async (suppId) => {
    setLoading(true);
    try {
      const supp = suppliers.find((s) => s.id === suppId);
      setSelectedSupplier(supp || null);

      let purQuery = supabase
        .from('purchases')
        .select(`
          id,
          invoice_number,
          purchase_date,
          total_amount,
          discount,
          net_amount,
          paid_amount,
          payment_status,
          notes,
          branch_id,
          purchase_items (
            id,
            item_name,
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('supplier_id', suppId)
        .order('purchase_date', { ascending: true });

      if (startDate) purQuery = purQuery.gte('purchase_date', startDate);
      if (endDate) purQuery = purQuery.lte('purchase_date', endDate);

      let payQuery = supabase
        .from('payments')
        .select(`
          id,
          payment_number,
          transaction_type,
          payment_date,
          amount,
          payment_method,
          reference_number,
          reference_invoice_id,
          notes,
          branch_id
        `)
        .eq('contact_id', suppId)
        .order('payment_date', { ascending: true });

      if (startDate) payQuery = payQuery.gte('payment_date', `${startDate}T00:00:00`);
      if (endDate) payQuery = payQuery.lte('payment_date', `${endDate}T23:59:59.999Z`);

      if (selectedBranchId) {
        purQuery = purQuery.eq('branch_id', selectedBranchId);
        payQuery = payQuery.eq('branch_id', selectedBranchId);
      }

      const [{ data: pData, error: pErr }, { data: payData, error: payErr }] = await Promise.all([
        purQuery,
        payQuery,
      ]);

      if (pErr) throw pErr;
      if (payErr) throw payErr;

      setSupplierPurchases(pData || []);
      setSupplierPayments(payData || []);
    } catch (err) {
      console.error('Error loading supplier data:', err);
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
        .order('payment_date', { ascending: false });

      if (startDate) query = query.gte('payment_date', `${startDate}T00:00:00`);
      if (endDate) query = query.lte('payment_date', `${endDate}T23:59:59.999Z`);

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

  // Supplier Statement Chronological Ledger Calculations
  const supplierLedger = useMemo(() => {
    const events = [];

    // Purchases (Debit)
    (supplierPurchases || []).forEach((p) => {
      events.push({
        id: p.id,
        type: 'purchase',
        date: p.purchase_date,
        dateTime: new Date(p.purchase_date).getTime(),
        refNo: p.invoice_number || `PUR#${p.id.substring(0, 8).toUpperCase()}`,
        description: p.notes || 'Raw / Material Purchase',
        items: p.purchase_items || [],
        debit: parseFloat(p.net_amount) || 0,
        credit: 0,
        status: p.payment_status,
      });
    });

    // Payments (Credit)
    (supplierPayments || []).forEach((pay) => {
      events.push({
        id: pay.id,
        type: 'payment',
        date: pay.payment_date?.split('T')[0] || pay.payment_date,
        dateTime: new Date(pay.payment_date).getTime(),
        refNo: pay.reference_number || pay.payment_number || `PAY#${pay.id.substring(0, 8).toUpperCase()}`,
        description: pay.notes || `Paid via ${pay.payment_method || 'Bank'}`,
        items: [],
        debit: 0,
        credit: parseFloat(pay.amount) || 0,
        status: 'paid',
        paymentMethod: pay.payment_method,
      });
    });

    // Sort chronologically ascending
    events.sort((a, b) => a.dateTime - b.dateTime);

    let runningBalance = 0;
    return events.map((ev, idx) => {
      runningBalance += (ev.debit - ev.credit);
      return {
        ...ev,
        sl: idx + 1,
        balance: runningBalance,
      };
    });
  }, [supplierPurchases, supplierPayments]);

  const supplierTotalBilled = useMemo(() => {
    return (supplierPurchases || []).reduce((sum, p) => sum + (parseFloat(p.net_amount) || 0), 0);
  }, [supplierPurchases]);

  const supplierTotalQty = useMemo(() => {
    return (supplierPurchases || []).reduce((sum, p) => {
      const itemsSum = (p.purchase_items || []).reduce((iSum, it) => iSum + (parseInt(it.quantity) || 0), 0);
      return sum + itemsSum;
    }, 0);
  }, [supplierPurchases]);

  const supplierTotalPaid = useMemo(() => {
    return (supplierPayments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [supplierPayments]);

  const supplierTotalDue = Math.max(0, supplierTotalBilled - supplierTotalPaid);

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

  const filteredSuppliers = useMemo(() => {
    if (!supplierPhoneSearch.trim()) return suppliers.slice(0, 15);
    const q = supplierPhoneSearch.toLowerCase();
    return suppliers.filter(
      (s) =>
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q))
    );
  }, [suppliers, supplierPhoneSearch]);

  const selectedBranchObj = useMemo(() => {
    if (!selectedBranchId) return null;
    return branches.find((item) => item.id === selectedBranchId) || null;
  }, [branches, selectedBranchId]);

  const selectedBranchName = useMemo(() => {
    return selectedBranchObj ? selectedBranchObj.name : (branches[0]?.name || 'Branch');
  }, [selectedBranchObj, branches]);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const getPdfFileName = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayStr = `${dd}-${mm}-${yyyy}`;

    if (activeTab === 'supplier') {
      const sName = selectedSupplier?.name || 'Supplier';
      const sPhone = selectedSupplier?.phone ? ` - ${selectedSupplier.phone}` : '';
      return `purchase (${sName}${sPhone}) - ${todayStr}.pdf`;
    }
    if (activeTab === 'customer') {
      const cName = selectedCustomer?.name || 'Customer';
      const cPhone = selectedCustomer?.phone ? ` - ${selectedCustomer.phone}` : '';
      return `customer (${cName}${cPhone}) - ${todayStr}.pdf`;
    }
    if (activeTab === 'payments') {
      const cName = selectedCustomer?.name || 'All Customers';
      const cPhone = selectedCustomer?.phone ? ` - ${selectedCustomer.phone}` : '';
      return `customer_payments (${cName}${cPhone}) - ${todayStr}.pdf`;
    }
    return `business_summary - ${todayStr}.pdf`;
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('report-pdf-render-target') || document.getElementById('report-printable-area');
    if (!element) return;

    setIsDownloadingPdf(true);
    try {
      const filename = getPdfFileName();
      const opt = {
        margin: [6, 6, 6, 6],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF auto-download failed:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const renderPrintDocument = () => {
    const printDate = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const isSupplier = activeTab === 'supplier';
    const isCustomer = activeTab === 'customer';
    const isPayment = activeTab === 'payments';
    const isOverall = activeTab === 'overall';

    const reportTitle = isSupplier
      ? 'SUPPLIER STATEMENT / PURCHASE LEDGER'
      : isCustomer
      ? 'CUSTOMER ACCOUNT STATEMENT'
      : isPayment
      ? 'CUSTOMER PAYMENT COLLECTIONS REGISTER'
      : 'OVERALL BUSINESS SUMMARY REPORT';

    return (
      <div
        id="report-printable-area"
        style={{
          fontFamily: '"Outfit", "Segoe UI", Arial, sans-serif',
          color: '#000000',
          backgroundColor: '#ffffff',
          padding: '16px',
          width: '100%',
          maxWidth: '850px',
          margin: '0 auto',
          fontSize: '11px',
          lineHeight: '1.3',
        }}
      >
        {/* 1. TOP HEADER WITH OFFICIAL LOGO & TITLE (BLACK & WHITE) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #000000',
            paddingBottom: '8px',
            marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={almasLogo}
              alt="Almas Logo"
              style={{
                width: '42px',
                height: '42px',
                objectFit: 'contain',
                border: '1.5px solid #000000',
                padding: '2px',
                background: '#ffffff',
                borderRadius: '2px',
                filter: 'grayscale(100%)',
              }}
            />
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '1.2rem',
                  fontWeight: 900,
                  letterSpacing: '0.5px',
                  color: '#000000',
                  textTransform: 'uppercase',
                  lineHeight: 1.1,
                }}
              >
                ALMAS ACCESSORIES INDUSTRIES
              </h1>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#333333',
                  fontStyle: 'italic',
                  marginTop: '2px',
                }}
              >
                100% Export Oriented Garments Accessories Industries
              </div>
            </div>
          </div>

          {/* DOCUMENT PILL BADGE */}
          <div
            style={{
              border: '2px solid #000000',
              padding: '4px 12px',
              textAlign: 'center',
              backgroundColor: '#ffffff',
              borderRadius: '9999px',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 900,
                letterSpacing: '0.8px',
                color: '#000000',
                textTransform: 'uppercase',
                display: 'block',
                lineHeight: 1,
              }}
            >
              {reportTitle}
            </span>
          </div>
        </div>

        {/* 2. METADATA SECTION */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            paddingBottom: '8px',
            borderBottom: '1px solid #cccccc',
            marginBottom: '10px',
            fontSize: '10.5px',
          }}
        >
          <div>
            {isSupplier ? (
              <>
                <div>
                  <strong>Supplier : </strong>
                  <span style={{ fontWeight: 800 }}>{selectedSupplier?.name || 'All Suppliers'}</span>
                </div>
                {selectedSupplier?.phone && (
                  <div>
                    <strong>Phone : </strong>
                    <span>{selectedSupplier.phone}</span>
                  </div>
                )}
                {selectedSupplier?.address && (
                  <div>
                    <strong>Address : </strong>
                    <span>{selectedSupplier.address}</span>
                  </div>
                )}
              </>
            ) : isCustomer ? (
              <>
                <div>
                  <strong>Customer : </strong>
                  <span style={{ fontWeight: 800 }}>{selectedCustomer?.name || 'Customer'}</span>
                </div>
                {selectedCustomer?.phone && (
                  <div>
                    <strong>Phone : </strong>
                    <span>{selectedCustomer.phone}</span>
                  </div>
                )}
                {selectedCustomer?.address && (
                  <div>
                    <strong>Address : </strong>
                    <span>{selectedCustomer.address}</span>
                  </div>
                )}
              </>
            ) : isPayment ? (
              <>
                <div>
                  <strong>Account / Scope : </strong>
                  <span style={{ fontWeight: 800 }}>{selectedCustomer?.name || 'All Customers (Company-wide)'}</span>
                </div>
                {selectedCustomer?.phone && (
                  <div>
                    <strong>Phone : </strong>
                    <span>{selectedCustomer.phone}</span>
                  </div>
                )}
              </>
            ) : (
              <div>
                <strong>Scope : </strong>
                <span style={{ fontWeight: 800 }}>Overall Business Summary</span>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            <div>
              <strong>Branch / Factory : </strong>
              <span>{selectedBranchName}</span>
            </div>
            <div>
              <strong>Statement Period : </strong>
              <span>{startDate ? `${startDate} to ${endDate}` : 'All Time (Full History)'}</span>
            </div>
            <div>
              <strong>Printed On : </strong>
              <span>{printDate}</span>
            </div>
          </div>
        </div>

        {/* 3. TOP SUMMARY BOX (BLACK & WHITE, NO ICONS) */}
        {isSupplier && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              border: '1.5px solid #000000',
              marginBottom: '12px',
              backgroundColor: '#ffffff',
            }}
          >
            <div style={{ padding: '6px 8px', borderRight: '1px solid #000000', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#555555' }}>
                Total Purchases ({supplierPurchases.length})
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, marginTop: '2px' }}>
                ৳{formatAmount(supplierTotalBilled)}
              </div>
            </div>
            <div style={{ padding: '6px 8px', borderRight: '1px solid #000000', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#555555' }}>
                Total Quantity
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, marginTop: '2px' }}>
                {supplierTotalQty.toLocaleString()} pcs
              </div>
            </div>
            <div style={{ padding: '6px 8px', borderRight: '1px solid #000000', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#555555' }}>
                Total Paid ({supplierPayments.length})
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, marginTop: '2px' }}>
                ৳{formatAmount(supplierTotalPaid)}
              </div>
            </div>
            <div style={{ padding: '6px 8px', textAlign: 'center', backgroundColor: '#f5f5f5' }}>
              <div style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#000000' }}>
                Closing Balance Due
              </div>
              <div style={{ fontSize: '14px', fontWeight: 900, marginTop: '2px' }}>
                ৳{formatAmount(supplierTotalDue)}
              </div>
            </div>
          </div>
        )}

        {isCustomer && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              border: '1.5px solid #000000',
              marginBottom: '12px',
              backgroundColor: '#ffffff',
            }}
          >
            <div style={{ padding: '6px 8px', borderRight: '1px solid #000000', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#555555' }}>
                Total Invoiced ({customerSales.length})
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, marginTop: '2px' }}>
                ৳{formatAmount(customerTotalBilled)}
              </div>
            </div>
            <div style={{ padding: '6px 8px', borderRight: '1px solid #000000', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#555555' }}>
                Total Paid
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, marginTop: '2px' }}>
                ৳{formatAmount(customerTotalPaid)}
              </div>
            </div>
            <div style={{ padding: '6px 8px', textAlign: 'center', backgroundColor: '#f5f5f5' }}>
              <div style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#000000' }}>
                Closing Due Balance
              </div>
              <div style={{ fontSize: '14px', fontWeight: 900, marginTop: '2px' }}>
                ৳{formatAmount(customerTotalDue)}
              </div>
            </div>
          </div>
        )}

        {isPayment && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              border: '1.5px solid #000000',
              marginBottom: '12px',
              backgroundColor: '#ffffff',
            }}
          >
            <div style={{ padding: '6px 8px', borderRight: '1px solid #000000', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#555555' }}>
                Total Collected ({customerPayments.length})
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, marginTop: '2px' }}>
                ৳{formatAmount(paymentsTotalAmount)}
              </div>
            </div>
            <div style={{ padding: '6px 8px', borderRight: '1px solid #000000', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#555555' }}>
                Cash Collections
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, marginTop: '2px' }}>
                ৳{formatAmount(paymentsCashAmount)}
              </div>
            </div>
            <div style={{ padding: '6px 8px', textAlign: 'center', backgroundColor: '#f5f5f5' }}>
              <div style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#000000' }}>
                Bank & Digital
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, marginTop: '2px' }}>
                ৳{formatAmount(paymentsDigitalAmount)}
              </div>
            </div>
          </div>
        )}

        {isOverall && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              border: '1.5px solid #000000',
              marginBottom: '12px',
              backgroundColor: '#ffffff',
            }}
          >
            <div style={{ padding: '6px 8px', borderRight: '1px solid #000000', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#555555' }}>
                Gross Turnover
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, marginTop: '2px' }}>
                ৳{formatAmount(overallMetrics.grossSales)}
              </div>
            </div>
            <div style={{ padding: '6px 8px', borderRight: '1px solid #000000', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#555555' }}>
                Total Invoices
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, marginTop: '2px' }}>
                {overallMetrics.totalSalesCount}
              </div>
            </div>
            <div style={{ padding: '6px 8px', borderRight: '1px solid #000000', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#555555' }}>
                Collections Received
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, marginTop: '2px' }}>
                ৳{formatAmount(overallMetrics.totalCollected)}
              </div>
            </div>
            <div style={{ padding: '6px 8px', textAlign: 'center', backgroundColor: '#f5f5f5' }}>
              <div style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#000000' }}>
                Outstanding Due
              </div>
              <div style={{ fontSize: '14px', fontWeight: 900, marginTop: '2px' }}>
                ৳{formatAmount(overallMetrics.totalDue)}
              </div>
            </div>
          </div>
        )}

        {/* 4. DATA TABLE (CLEAN, BLACK & WHITE, NO ICONS) */}
        {isSupplier && (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1.5px solid #000000',
              marginBottom: '16px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1.5px solid #000000' }}>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '30px', textAlign: 'center', fontSize: '9.5px' }}>SL</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '70px', textAlign: 'left', fontSize: '9.5px' }}>DATE</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '90px', textAlign: 'left', fontSize: '9.5px' }}>CHALLAN / REF</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'left', fontSize: '9.5px' }}>PARTICULARS / DESCRIPTION</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '85px', textAlign: 'right', fontSize: '9.5px' }}>DEBIT (৳)</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '85px', textAlign: 'right', fontSize: '9.5px' }}>CREDIT (৳)</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '85px', textAlign: 'right', fontSize: '9.5px' }}>BALANCE (৳)</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '60px', textAlign: 'center', fontSize: '9.5px' }}>MODE</th>
              </tr>
            </thead>
            <tbody>
              {supplierLedger.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ border: '1px solid #000000', padding: '16px', textAlign: 'center' }}>
                    No transactions found for the selected supplier and date range.
                  </td>
                </tr>
              ) : (
                supplierLedger.map((row) => {
                  const isPur = row.type === 'purchase';
                  return (
                    <tr key={`p-${row.type}-${row.id}`}>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'center' }}>{row.sl}</td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px' }}>
                        {new Date(row.date).toLocaleDateString('en-GB')}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', fontWeight: 700, fontFamily: 'monospace' }}>
                        {row.refNo}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px' }}>
                        <span style={{ fontWeight: 600 }}>{row.description}</span>
                        {row.items && row.items.length > 0 && (
                          <div style={{ fontSize: '9.5px', color: '#444444', marginTop: '1px' }}>
                            {row.items.map((it, idx) => (
                              <span key={idx} style={{ marginRight: '6px' }}>
                                [{it.item_name || 'Item'}: {it.quantity} pcs @ ৳{it.unit_price}]
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'right', fontWeight: isPur ? 700 : 400 }}>
                        {row.debit > 0 ? `৳${formatAmount(row.debit)}` : '-'}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'right', fontWeight: !isPur ? 700 : 400 }}>
                        {row.credit > 0 ? `৳${formatAmount(row.credit)}` : '-'}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'right', fontWeight: 800 }}>
                        ৳{formatAmount(row.balance)}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'center', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                        {isPur ? row.status : (row.paymentMethod || 'PAID')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f0f0f0', borderTop: '2px solid #000000', fontWeight: 900 }}>
                <td colSpan={4} style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'right' }}>
                  GRAND TOTALS:
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'right' }}>
                  ৳{formatAmount(supplierTotalBilled)}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'right' }}>
                  ৳{formatAmount(supplierTotalPaid)}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'right' }}>
                  ৳{formatAmount(supplierTotalDue)}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'center', fontSize: '9px' }}>
                  {supplierTotalDue > 0 ? 'DUE' : 'CLEAR'}
                </td>
              </tr>
            </tfoot>
          </table>
        )}

        {isCustomer && (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1.5px solid #000000',
              marginBottom: '16px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1.5px solid #000000' }}>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '30px', textAlign: 'center', fontSize: '9.5px' }}>SL</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '70px', textAlign: 'left', fontSize: '9.5px' }}>DATE</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '100px', textAlign: 'left', fontSize: '9.5px' }}>INVOICE / CHALLAN</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'right', fontSize: '9.5px' }}>SUBTOTAL (৳)</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'right', fontSize: '9.5px' }}>DISCOUNT (৳)</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'right', fontSize: '9.5px' }}>NET BILL (৳)</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'right', fontSize: '9.5px' }}>PAID (৳)</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'right', fontSize: '9.5px' }}>DUE (৳)</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '60px', textAlign: 'center', fontSize: '9.5px' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {customerSales.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ border: '1px solid #000000', padding: '16px', textAlign: 'center' }}>
                    No customer invoices found for the selected period.
                  </td>
                </tr>
              ) : (
                customerSales.map((s, idx) => {
                  const net = parseFloat(s.net_amount) || 0;
                  const paid = parseFloat(s.paid_amount) || 0;
                  const due = Math.max(0, net - paid);
                  return (
                    <tr key={`cs-${s.id}`}>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px' }}>
                        {new Date(s.sale_date).toLocaleDateString('en-GB')}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', fontWeight: 700, fontFamily: 'monospace' }}>
                        {s.invoice_number || `INV#${s.id.substring(0, 8).toUpperCase()}`}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'right' }}>
                        ৳{formatAmount(s.total_amount)}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'right' }}>
                        ৳{formatAmount(s.discount)}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'right', fontWeight: 700 }}>
                        ৳{formatAmount(net)}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'right' }}>
                        ৳{formatAmount(paid)}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'right', fontWeight: 800 }}>
                        ৳{formatAmount(due)}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'center', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                        {s.payment_status}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f0f0f0', borderTop: '2px solid #000000', fontWeight: 900 }}>
                <td colSpan={5} style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'right' }}>
                  GRAND TOTALS:
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'right' }}>
                  ৳{formatAmount(customerTotalBilled)}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'right' }}>
                  ৳{formatAmount(customerTotalPaid)}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'right' }}>
                  ৳{formatAmount(customerTotalDue)}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'center', fontSize: '9px' }}>
                  {customerTotalDue > 0 ? 'DUE' : 'PAID'}
                </td>
              </tr>
            </tfoot>
          </table>
        )}

        {isPayment && (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1.5px solid #000000',
              marginBottom: '16px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1.5px solid #000000' }}>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '30px', textAlign: 'center', fontSize: '9.5px' }}>SL</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '70px', textAlign: 'left', fontSize: '9.5px' }}>DATE</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '90px', textAlign: 'left', fontSize: '9.5px' }}>RECEIPT #</th>
                {!selectedCustomerId && (
                  <th style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'left', fontSize: '9.5px' }}>CUSTOMER NAME</th>
                )}
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '90px', textAlign: 'left', fontSize: '9.5px' }}>INVOICE REF</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '60px', textAlign: 'center', fontSize: '9.5px' }}>METHOD</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'left', fontSize: '9.5px' }}>NOTES / REF</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '90px', textAlign: 'right', fontSize: '9.5px' }}>AMOUNT (৳)</th>
              </tr>
            </thead>
            <tbody>
              {customerPayments.length === 0 ? (
                <tr>
                  <td colSpan={selectedCustomerId ? 7 : 8} style={{ border: '1px solid #000000', padding: '16px', textAlign: 'center' }}>
                    No payment collections found for the selected filter.
                  </td>
                </tr>
              ) : (
                customerPayments.map((p, idx) => {
                  const invNo = p.reference_invoice_id
                    ? paymentSalesMap[p.reference_invoice_id] || `INV#${p.reference_invoice_id.substring(0, 8).toUpperCase()}`
                    : 'Direct Receipt';
                  return (
                    <tr key={`p-${p.id}`}>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px' }}>
                        {new Date(p.payment_date).toLocaleDateString('en-GB')}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', fontWeight: 700, fontFamily: 'monospace' }}>
                        {p.payment_number || `RCP#${p.id.substring(0, 8).toUpperCase()}`}
                      </td>
                      {!selectedCustomerId && (
                        <td style={{ border: '1px solid #000000', padding: '3px 6px', fontWeight: 600 }}>
                          {p.contacts?.name || 'Walk-in'}
                        </td>
                      )}
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', fontFamily: 'monospace' }}>
                        {invNo}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'center', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                        {p.payment_method || 'CASH'}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', color: '#333333' }}>
                        {p.notes || '-'}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'right', fontWeight: 800 }}>
                        ৳{formatAmount(p.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f0f0f0', borderTop: '2px solid #000000', fontWeight: 900 }}>
                <td colSpan={selectedCustomerId ? 6 : 7} style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'right' }}>
                  TOTAL COLLECTED:
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'right' }}>
                  ৳{formatAmount(paymentsTotalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}

        {isOverall && (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1.5px solid #000000',
              marginBottom: '16px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1.5px solid #000000' }}>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'left', fontSize: '9.5px' }}>BRANCH / PLANT</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', width: '80px', textAlign: 'center', fontSize: '9.5px' }}>INVOICES</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'right', fontSize: '9.5px' }}>GROSS SALES (৳)</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'right', fontSize: '9.5px' }}>COLLECTIONS (৳)</th>
                <th style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'right', fontSize: '9.5px' }}>DUE BALANCE (৳)</th>
              </tr>
            </thead>
            <tbody>
              {overallMetrics.branchBreakdown.map((b) => (
                <tr key={b.branchId}>
                  <td style={{ border: '1px solid #000000', padding: '4px 6px', fontWeight: 600 }}>{b.branchName}</td>
                  <td style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'center' }}>{b.salesCount}</td>
                  <td style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'right' }}>৳{formatAmount(b.grossSales)}</td>
                  <td style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'right' }}>৳{formatAmount(b.totalCollected)}</td>
                  <td style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'right', fontWeight: 800 }}>৳{formatAmount(b.totalDue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f0f0f0', borderTop: '2px solid #000000', fontWeight: 900 }}>
                <td style={{ border: '1px solid #000000', padding: '5px 6px' }}>TOTAL</td>
                <td style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'center' }}>{overallMetrics.totalSalesCount}</td>
                <td style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'right' }}>৳{formatAmount(overallMetrics.grossSales)}</td>
                <td style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'right' }}>৳{formatAmount(overallMetrics.totalCollected)}</td>
                <td style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'right' }}>৳{formatAmount(overallMetrics.totalDue)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {/* 5. OFFICIAL SIGNATURES (BLACK & WHITE) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: '28px',
            marginBottom: '16px',
            paddingTop: '6px',
          }}
        >
          <div style={{ textAlign: 'center', width: '130px' }}>
            <div style={{ borderTop: '1px solid #000000', paddingTop: '4px', fontSize: '9.5px', fontWeight: 700 }}>
              Prepared By
            </div>
          </div>
          <div style={{ textAlign: 'center', width: '130px' }}>
            <div style={{ borderTop: '1px solid #000000', paddingTop: '4px', fontSize: '9.5px', fontWeight: 700 }}>
              Checked By
            </div>
          </div>
          <div style={{ textAlign: 'center', width: '150px' }}>
            <div style={{ borderTop: '1px solid #000000', paddingTop: '4px', fontSize: '9.5px', fontWeight: 700 }}>
              Authorized Signatory
            </div>
          </div>
        </div>

        {/* 6. FACTORY & OFFICE FOOTER */}
        <div
          style={{
            borderTop: '1.5px solid #000000',
            paddingTop: '6px',
            fontSize: '8.5px',
            color: '#333333',
            textAlign: 'center',
            lineHeight: 1.35,
          }}
        >
          <div>
            <strong>Factory 1 : </strong> 177, Islampur, Baipal, Ashulia, Savar, Dhaka. &nbsp;|&nbsp;
            <strong>Factory 2 : </strong> 120/A, Amir Market, Khatungonj, Chittagong.
          </div>
          <div>
            <strong>Showroom : </strong> 18, Anis Super Market, Baipal, Ashulia, Dhaka.
          </div>
          <div>
            E-mail : almasaccessoriesind@gmail.com &nbsp;|&nbsp; Web : www.almasaccessories.com
          </div>
        </div>
      </div>
    );
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
              {activeTab === 'overall' 
                ? 'Overall business turnover & sales summary' 
                : activeTab === 'customer' 
                ? 'Customer account statement & dues' 
                : activeTab === 'supplier'
                ? 'Supplier purchase ledger & payments'
                : 'Customer payment collections register'}
            </div>
          </div>
        </div>

        {/* 4 Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
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
            className={`btn btn-sm ${activeTab === 'supplier' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('supplier')}
            style={{ fontWeight: 700, padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Truck size={14} />
            <span>3. Supplier Statement</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('payments')}
            style={{ fontWeight: 700, padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <CreditCard size={14} />
            <span>4. Customer Payments</span>
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

          {/* Download PDF & Print Preview Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setShowReportPrint(true);
                setTimeout(() => window.print(), 350);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}
              title="Download Report as PDF"
            >
              <Download size={13} /> Download PDF
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowReportPrint(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}
              title="Print Report"
            >
              <Printer size={13} /> Print
            </button>
          </div>
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

              {/* Customer Sales Table & Mobile Cards */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '0.65rem 0.95rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <span>Customer Invoices ({customerSales.length})</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleDownloadPdf}
                      disabled={isDownloadingPdf}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.55rem', fontSize: '0.74rem', fontWeight: 700 }}
                    >
                      {isDownloadingPdf ? <Loader2 size={12} className="spin" /> : <Download size={12} />}
                      {isDownloadingPdf ? 'Downloading...' : 'Download PDF'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowReportPrint(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.55rem', fontSize: '0.74rem', fontWeight: 700 }}
                    >
                      <Printer size={12} /> Print
                    </button>
                  </div>
                </div>

                {/* 1. Desktop Table */}
                <div className="report-desktop-table table-container" style={{ border: 'none' }}>
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

                {/* 2. Mobile Responsive Card View (No Horizontal Scrollbar) */}
                <div className="report-mobile-cards">
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>Loading invoices...</div>
                  ) : customerSales.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                      No invoices recorded for this customer.
                    </div>
                  ) : (
                    customerSales.map((s) => {
                      const net = parseFloat(s.net_amount) || 0;
                      const paid = parseFloat(s.paid_amount) || 0;
                      const due = Math.max(0, net - paid);
                      return (
                        <div key={`mc-${s.id}`} className="report-item-card is-purchase">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.82rem', color: '#0284c7' }}>
                              {s.invoice_number || `INV#${s.id.substring(0, 8).toUpperCase()}`}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {new Date(s.sale_date).toLocaleDateString('en-GB')}
                              </span>
                              <span className={`badge badge-${s.payment_status}`} style={{ fontSize: '0.62rem', padding: '0.05rem 0.25rem' }}>
                                {s.payment_status}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.2rem', marginTop: '0.2rem', backgroundColor: '#f8fafc', padding: '0.3rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '0.58rem', fontWeight: 600, color: 'var(--text-muted)' }}>Net Bill</div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                                ৳{formatAmount(net)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '0.58rem', fontWeight: 600, color: 'var(--text-muted)' }}>Paid</div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#059669', fontFamily: 'Outfit, sans-serif' }}>
                                ৳{formatAmount(paid)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '0.58rem', fontWeight: 700, color: due > 0 ? '#dc2626' : '#059669' }}>Due</div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: due > 0 ? '#dc2626' : '#059669', fontFamily: 'Outfit, sans-serif' }}>
                                ৳{formatAmount(due)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. SUPPLIER STATEMENT REPORT VIEW                         */}
      {/* ========================================================= */}
      {activeTab === 'supplier' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Supplier Search / Selection Card */}
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
            <div ref={supplierPhoneRef} style={{ position: 'relative', zIndex: 151 }}>
              <label style={{ display: 'block', marginBottom: '0.15rem', fontWeight: 600, fontSize: '0.7rem' }}>
                Search Supplier by Phone or Name:
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={12} style={{ position: 'absolute', left: '0.55rem', top: '50%', transform: 'translateY(-50%)', color: '#0284c7' }} />
                <input
                  type="text"
                  className="input-control"
                  placeholder="Type supplier name or phone..."
                  value={supplierPhoneSearch}
                  onChange={(e) => {
                    setSupplierPhoneSearch(e.target.value);
                    setShowSupplierPhoneList(true);
                  }}
                  onFocus={() => setShowSupplierPhoneList(true)}
                  onClick={() => setShowSupplierPhoneList(true)}
                  style={{ paddingLeft: '1.65rem', paddingRight: '1.65rem', fontSize: '0.78rem', padding: '0.22rem 1.65rem' }}
                />
                {supplierPhoneSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setSupplierPhoneSearch('');
                      setShowSupplierPhoneList(false);
                    }}
                    style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Suggestions dropdown */}
              {showSupplierPhoneList && (
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
                  {filteredSuppliers.length === 0 ? (
                    <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No suppliers found
                    </div>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedSupplierId(s.id);
                          setSupplierPhoneSearch(`${s.name} (${s.phone || 'No phone'})`);
                          setShowSupplierPhoneList(false);
                        }}
                        style={{
                          padding: '0.4rem 0.6rem',
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          backgroundColor: selectedSupplierId === s.id ? '#e0f2fe' : '#ffffff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = selectedSupplierId === s.id ? '#e0f2fe' : '#ffffff')}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{s.name}</div>
                          <div style={{ fontSize: '0.68rem', color: '#0284c7' }}>📞 {s.phone || 'No Phone'}</div>
                        </div>
                        <span className="badge badge-secondary" style={{ fontSize: '0.62rem' }}>Select</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Select Supplier Dropdown */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.15rem', fontWeight: 600, fontSize: '0.7rem' }}>
                Or Choose from Supplier List:
              </label>
              <select
                className="input-control"
                value={selectedSupplierId}
                onChange={(e) => {
                  setSelectedSupplierId(e.target.value);
                  const found = suppliers.find((s) => s.id === e.target.value);
                  if (found) setSupplierPhoneSearch(`${found.name} (${found.phone || ''})`);
                }}
                style={{ fontSize: '0.78rem', padding: '0.22rem 0.4rem' }}
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `(${s.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Supplier Report Content */}
          {!selectedSupplierId ? (
            <div className="card" style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Truck size={32} style={{ margin: '0 auto 0.5rem', color: '#bae6fd' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Select a Supplier</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem' }}>
                Search by supplier name or phone number to view their complete purchases and payments ledger.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Selected Supplier Header & Stats */}
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
                {/* Top: Supplier Info */}
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
                      {selectedSupplier?.name ? selectedSupplier.name.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>{selectedSupplier?.name}</span>
                        <span className="badge badge-warning" style={{ fontSize: '0.58rem', padding: '0.05rem 0.25rem' }}>Supplier</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {selectedSupplier?.phone && <span>📞 {selectedSupplier.phone}</span>}
                        {selectedSupplier?.address && <span>📍 {selectedSupplier.address}</span>}
                        <span>🏢 {selectedBranchName}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom: 4 Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.35rem', width: '100%' }}>
                  <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.25rem 0.35rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Total Purchases ({supplierPurchases.length})
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0284c7', fontFamily: 'Outfit, sans-serif' }}>
                      ৳{formatAmount(supplierTotalBilled)}
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.25rem 0.35rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Total Qty Purchased
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0369a1', fontFamily: 'Outfit, sans-serif' }}>
                      {supplierTotalQty.toLocaleString()} pcs
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.25rem 0.35rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Total Paid ({supplierPayments.length})
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#059669', fontFamily: 'Outfit, sans-serif' }}>
                      ৳{formatAmount(supplierTotalPaid)}
                    </div>
                  </div>

                  <div style={{ 
                    backgroundColor: supplierTotalDue > 0 ? '#fef2f2' : '#f0fdf4', 
                    border: `1px solid ${supplierTotalDue > 0 ? '#fca5a5' : '#86efac'}`, 
                    borderRadius: '4px', 
                    padding: '0.25rem 0.35rem', 
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.6rem', color: supplierTotalDue > 0 ? '#dc2626' : '#16a34a', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Balance Due
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: supplierTotalDue > 0 ? '#dc2626' : '#16a34a', fontFamily: 'Outfit, sans-serif' }}>
                      ৳{formatAmount(supplierTotalDue)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Supplier Statement Ledger Table & Mobile Cards */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '0.65rem 0.95rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <span>Supplier Statement / Ledger ({supplierLedger.length} Transactions)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleDownloadPdf}
                      disabled={isDownloadingPdf}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.55rem', fontSize: '0.74rem', fontWeight: 700 }}
                    >
                      {isDownloadingPdf ? <Loader2 size={12} className="spin" /> : <Download size={12} />}
                      {isDownloadingPdf ? 'Downloading...' : 'Download PDF'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowReportPrint(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.55rem', fontSize: '0.74rem', fontWeight: 700 }}
                    >
                      <Printer size={12} /> Print
                    </button>
                  </div>
                </div>

                {/* 1. Desktop Table View */}
                <div className="report-desktop-table table-container" style={{ border: 'none' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
                        <th>Date</th>
                        <th>Challan / Ref #</th>
                        <th>Particulars / Description</th>
                        <th style={{ textAlign: 'right' }}>Debit (Purchase ৳)</th>
                        <th style={{ textAlign: 'right' }}>Credit (Paid ৳)</th>
                        <th style={{ textAlign: 'right' }}>Balance (৳)</th>
                        <th style={{ textAlign: 'center' }}>Status / Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <TableLoading colSpan={8} message="Loading supplier ledger..." />
                      ) : supplierLedger.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                            No purchases or payment records found for this supplier in the selected period.
                          </td>
                        </tr>
                      ) : (
                        supplierLedger.map((row) => {
                          const isPur = row.type === 'purchase';
                          return (
                            <tr key={`${row.type}-${row.id}`} style={{ backgroundColor: isPur ? '#ffffff' : '#f0fdf4' }}>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.sl}</td>
                              <td>{new Date(row.date).toLocaleDateString('en-GB')}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 700, color: isPur ? '#0284c7' : '#059669' }}>
                                {row.refNo}
                              </td>
                              <td style={{ fontSize: '0.82rem' }}>
                                <div style={{ fontWeight: 600 }}>{row.description}</div>
                                {row.items && row.items.length > 0 && (
                                   <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {row.items.map((it, i) => (
                                      <span key={i} style={{ marginRight: '0.5rem' }}>
                                        • {it.item_name || 'Item'}: {it.quantity} @ ৳{it.unit_price}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: isPur ? 700 : 400, color: isPur ? '#0f172a' : 'var(--text-muted)' }}>
                                {row.debit > 0 ? `৳${formatAmount(row.debit)}` : '-'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: !isPur ? 700 : 400, color: !isPur ? '#059669' : 'var(--text-muted)' }}>
                                {row.credit > 0 ? `৳${formatAmount(row.credit)}` : '-'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800, color: row.balance > 0 ? '#dc2626' : '#059669' }}>
                                ৳{formatAmount(row.balance)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {isPur ? (
                                  <span className={`badge badge-${row.status}`}>{row.status}</span>
                                ) : (
                                  <span className="badge badge-success" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
                                    {row.paymentMethod || 'Paid'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 2. Mobile Responsive Card View (No Horizontal Scrollbar) */}
                <div className="report-mobile-cards">
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>Loading ledger...</div>
                  ) : supplierLedger.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                      No purchases or payment records found.
                    </div>
                  ) : (
                    supplierLedger.map((row) => {
                      const isPur = row.type === 'purchase';
                      return (
                        <div key={`m-${row.type}-${row.id}`} className={`report-item-card ${isPur ? 'is-purchase' : 'is-payment'}`}>
                          {/* Top: Sl, Date, Ref#, Status Badge */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', backgroundColor: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                #{row.sl}
                              </span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.82rem', color: isPur ? '#0284c7' : '#059669' }}>
                                {row.refNo}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {new Date(row.date).toLocaleDateString('en-GB')}
                              </span>
                              {isPur ? (
                                <span className={`badge badge-${row.status}`} style={{ fontSize: '0.62rem', padding: '0.05rem 0.25rem' }}>
                                  {row.status}
                                </span>
                              ) : (
                                <span className="badge badge-success" style={{ textTransform: 'uppercase', fontSize: '0.62rem', padding: '0.05rem 0.25rem' }}>
                                  {row.paymentMethod || 'Paid'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Middle: Description & Item Details */}
                          <div style={{ fontSize: '0.78rem', color: '#1e293b' }}>
                            <div style={{ fontWeight: 600 }}>{row.description}</div>
                            {row.items && row.items.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                                {row.items.map((it, i) => (
                                  <span key={i} style={{ fontSize: '0.7rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.1rem 0.35rem', color: '#334155' }}>
                                    📦 {it.item_name || 'Item'}: <strong>{it.quantity} pcs</strong> @ ৳{it.unit_price}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Bottom: 3 Compact Columns (Debit, Credit, Balance) */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.2rem', marginTop: '0.2rem', backgroundColor: '#f8fafc', padding: '0.3rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '0.58rem', fontWeight: 600, color: 'var(--text-muted)' }}>Debit (Purchase)</div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: isPur ? '#0f172a' : '#94a3b8', fontFamily: 'Outfit, sans-serif' }}>
                                {row.debit > 0 ? `৳${formatAmount(row.debit)}` : '-'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '0.58rem', fontWeight: 600, color: 'var(--text-muted)' }}>Credit (Paid)</div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: !isPur ? '#059669' : '#94a3b8', fontFamily: 'Outfit, sans-serif' }}>
                                {row.credit > 0 ? `৳${formatAmount(row.credit)}` : '-'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '0.58rem', fontWeight: 700, color: row.balance > 0 ? '#dc2626' : '#059669' }}>Balance Due</div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: row.balance > 0 ? '#dc2626' : '#059669', fontFamily: 'Outfit, sans-serif' }}>
                                ৳{formatAmount(row.balance)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. CUSTOMER PAYMENTS REPORT VIEW                          */}
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
                    : activeTab === 'supplier'
                    ? `Supplier Statement — ${selectedSupplier?.name || 'Supplier'}`
                    : `Customer Payment Report — ${selectedCustomer?.name || 'All Customers'}`}
                </span>
              </h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowReportPrint(false)}
                style={{ padding: '0.2rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: '0.85rem', backgroundColor: '#f8fafc' }}>
              {renderPrintDocument()}
            </div>

            <div className="modal-footer no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowReportPrint(false)}>Close</button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
                >
                  {isDownloadingPdf ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                  {isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Printer size={16} /> Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* HIDDEN TARGET FOR DIRECT AUTO-DOWNLOAD OF PDF (NO PRINT)  */}
      {/* ========================================================= */}
      <div
        id="report-pdf-render-target"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '850px',
          backgroundColor: '#ffffff',
          zIndex: -100,
          pointerEvents: 'none',
        }}
      >
        {renderPrintDocument()}
      </div>

      {/* ========================================================= */}
      {/* DIRECT PRINT VIEW (FOR BROWSER PRINT / PDF SAVE)          */}
      {/* ========================================================= */}
      <div className="print-only">
        {renderPrintDocument()}
      </div>
    </div>
  );
}
