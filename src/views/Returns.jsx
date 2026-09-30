import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Eye, Printer } from 'lucide-react';
import { TableLoading, LoadingBlock } from '../components/TableLoading';
import Pagination from '../components/Pagination';
import { formatAmount } from '../utils/format';

// Helper to extract voucher code, invoice number, and reason from description string
function parseMovementDescription(description = '') {
  let voucherNumber = null;
  let invoiceNumber = null;
  let reason = '';
  let movementKind = 'return';

  const voucherMatch = description.match(/\[([A-Z]{3}-\d+)\]/i);
  if (voucherMatch) {
    voucherNumber = voucherMatch[1].toUpperCase();
  }

  const invoiceMatch = description.match(/Inv\s*#?([A-Za-z0-9\-_]+)/i);
  if (invoiceMatch) {
    invoiceNumber = invoiceMatch[1];
  }

  const reasonMatch = description.match(/\(([^)]+)\)$/);
  if (reasonMatch) {
    reason = reasonMatch[1];
  }

  if (description.toLowerCase().includes('replacement out') || description.toLowerCase().includes('exchange out')) {
    movementKind = 'replacement_out';
  } else if (description.toLowerCase().includes('exchange return') || description.toLowerCase().includes('exchange')) {
    movementKind = 'exchange_return';
  } else {
    movementKind = 'customer_return';
  }

  return { voucherNumber, invoiceNumber, reason, movementKind };
}

export default function Returns({ userProfile, branches, addToast }) {
  const [activeBranchId, setActiveBranchId] = useState(() => {
    if (userProfile?.role === 'owner') {
      const factoryBranch = branches.find((b) => b.is_factory || b.name?.toLowerCase().includes('factory'));
      return factoryBranch ? factoryBranch.id : (branches.length > 0 ? branches[0].id : '');
    }
    return userProfile?.branch_id || (branches.length > 0 ? branches[0].id : '');
  });

  const activeBranch = useMemo(() => branches.find((b) => b.id === activeBranchId) || null, [branches, activeBranchId]);

  const [loading, setLoading] = useState(true);
  const [rawMovements, setRawMovements] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1: Pick Invoice, 2: Configure Return
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceSearchResults, setInvoiceSearchResults] = useState([]);
  const [searchingInvoices, setSearchingInvoices] = useState(false);

  // Return items & mode
  const [returnItems, setReturnItems] = useState([]);
  const [loadingInvoiceItems, setLoadingInvoiceItems] = useState(false);
  const [resolutionMode, setResolutionMode] = useState('exchange'); // 'exchange' | 'refund'
  const [refundMethod, setRefundMethod] = useState('cash');
  const [returnReason, setReturnReason] = useState('Size / Variant Swap');
  const [returnNotes, setReturnNotes] = useState('');

  // Exchange replacement items
  const [branchCatalog, setBranchCatalog] = useState([]);
  const [exchangeCart, setExchangeCart] = useState([]);
  const [exchangePaymentMethod, setExchangePaymentMethod] = useState('cash');

  // Submitting & Print state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [activeVoucher, setActiveVoucher] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTransactionDetails, setSelectedTransactionDetails] = useState(null);

  const showMessage = (text, type = 'info') => {
    if (addToast) addToast(text, type);
  };

  const [salesCustomerMap, setSalesCustomerMap] = useState({});

  // Fetch Return / Exchange History from inventory_movements with Customer Name / Phone search support
  const fetchReturnHistory = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('inventory_movements')
        .select(`
          id,
          branch_id,
          product_id,
          type,
          quantity,
          description,
          created_at,
          products (
            id,
            name,
            sku,
            sale_price
          ),
          branches (
            id,
            name,
            address,
            phone,
            is_factory
          )
        `)
        .or('description.ilike.%[CRN-%,description.ilike.%[EXC-%,description.ilike.%Customer Return%,description.ilike.%Customer Exchange%')
        .order('created_at', { ascending: false })
        .limit(300);

      if (activeBranchId && userProfile?.role !== 'owner') {
        query = query.eq('branch_id', activeBranchId);
      } else if (activeBranchId) {
        query = query.eq('branch_id', activeBranchId);
      }

      if (searchQuery.trim()) {
        const clean = searchQuery.trim();
        // 1. Check if search query matches customer name or phone in contacts
        const { data: matchedContacts } = await supabase
          .from('contacts')
          .select('id')
          .or(`name.ilike.%${clean}%,phone.ilike.%${clean}%`)
          .limit(30);

        let matchingInvoices = [];
        if (matchedContacts && matchedContacts.length > 0) {
          const contactIds = matchedContacts.map((c) => c.id);
          const { data: matchedSales } = await supabase
            .from('sales')
            .select('invoice_number')
            .in('customer_id', contactIds)
            .limit(50);
          if (matchedSales) {
            matchingInvoices = matchedSales.map((s) => s.invoice_number).filter(Boolean);
          }
        }

        const orConditions = [`description.ilike.%${clean}%`];
        matchingInvoices.forEach((inv) => {
          orConditions.push(`description.ilike.%${inv}%`);
        });

        query = query.or(orConditions.join(','));
      }

      const { data, error } = await query;
      if (error) throw error;

      setRawMovements(data || []);

      // Batch load customer details for invoices
      const invNumbers = [...new Set((data || []).map((m) => parseMovementDescription(m.description).invoiceNumber).filter(Boolean))];
      if (invNumbers.length > 0) {
        const { data: salesData } = await supabase
          .from('sales')
          .select('invoice_number, contacts (id, name, phone, address)')
          .in('invoice_number', invNumbers);

        if (salesData) {
          const cMap = {};
          salesData.forEach((s) => {
            if (s.invoice_number) cMap[s.invoice_number] = s.contacts;
          });
          setSalesCustomerMap(cMap);
        }
      }
    } catch (err) {
      console.error('Error fetching return movements:', err);
      showMessage('Failed to load return records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, userProfile, searchQuery]);

  useEffect(() => {
    fetchReturnHistory();
  }, [fetchReturnHistory]);

  // Group raw movements into comprehensive transactions
  const groupedTransactions = useMemo(() => {
    const map = new Map();

    for (const mov of rawMovements) {
      const parsed = parseMovementDescription(mov.description);
      const groupKey = parsed.voucherNumber
        ? parsed.voucherNumber
        : `NO_VOUCHER-${parsed.invoiceNumber || 'NO_INV'}-${mov.created_at.slice(0, 16)}`;

      const customerInfo = (parsed.invoiceNumber && salesCustomerMap[parsed.invoiceNumber]) || null;
      const customerName = customerInfo?.name || 'Walk-in Customer';

      if (!map.has(groupKey)) {
        const isExchange = (parsed.voucherNumber && parsed.voucherNumber.startsWith('EXC')) || mov.description?.toLowerCase().includes('exchange');
        map.set(groupKey, {
          id: groupKey,
          voucherNumber: parsed.voucherNumber || groupKey,
          invoiceNumber: parsed.invoiceNumber || '-',
          customerName: customerName,
          customerPhone: customerInfo?.phone || '',
          customerAddress: customerInfo?.address || '',
          type: isExchange ? 'Exchange' : 'Return',
          date: mov.created_at,
          branch: mov.branches,
          reason: parsed.reason || 'Customer Return / Exchange',
          returnedItems: [],
          exchangeItems: [],
          totalReturnQty: 0,
          totalExchangeQty: 0,
          totalReturnCredit: 0,
          totalExchangeValue: 0,
        });
      }

      const tx = map.get(groupKey);
      if (customerInfo && tx.customerName === 'Walk-in Customer') {
        tx.customerName = customerInfo.name || 'Walk-in Customer';
        tx.customerPhone = customerInfo.phone || '';
        tx.customerAddress = customerInfo.address || '';
      }
      const isReplacement = parsed.movementKind === 'replacement_out';
      const itemPrice = parseFloat(mov.products?.sale_price || 0);
      const absQty = Math.abs(mov.quantity || 0);

      if (isReplacement) {
        tx.exchangeItems.push({
          product_id: mov.product_id,
          name: mov.products?.name || 'Unknown Product',
          sku: mov.products?.sku || '',
          quantity: absQty,
          unit_price: itemPrice,
          total_price: absQty * itemPrice,
          products: mov.products,
        });
        tx.totalExchangeQty += absQty;
        tx.totalExchangeValue += absQty * itemPrice;
      } else {
        tx.returnedItems.push({
          product_id: mov.product_id,
          name: mov.products?.name || 'Unknown Product',
          sku: mov.products?.sku || '',
          quantity: absQty,
          returnQty: absQty,
          unit_price: itemPrice,
          total_price: absQty * itemPrice,
          products: mov.products,
        });
        tx.totalReturnQty += absQty;
        tx.totalReturnCredit += absQty * itemPrice;
      }
    }

    return Array.from(map.values());
  }, [rawMovements, salesCustomerMap]);

  // Client-side search & filter by Customer Name, Phone, Address, Invoice #, Voucher #, and Product
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groupedTransactions;

    return groupedTransactions.filter((tx) => {
      const vMatch = (tx.voucherNumber || '').toLowerCase().includes(q);
      const iMatch = (tx.invoiceNumber || '').toLowerCase().includes(q);
      const nameMatch = (tx.customerName || '').toLowerCase().includes(q);
      const phoneMatch = (tx.customerPhone || '').toLowerCase().includes(q);
      const addressMatch = (tx.customerAddress || '').toLowerCase().includes(q);
      const reasonMatch = (tx.reason || '').toLowerCase().includes(q);
      const itemMatch =
        (tx.returnedItems || []).some((it) => (it.name || '').toLowerCase().includes(q) || (it.sku || '').toLowerCase().includes(q)) ||
        (tx.exchangeItems || []).some((it) => (it.name || '').toLowerCase().includes(q) || (it.sku || '').toLowerCase().includes(q));

      return vMatch || iMatch || nameMatch || phoneMatch || addressMatch || reasonMatch || itemMatch;
    });
  }, [groupedTransactions, searchQuery]);

  // Paginated transactions
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Search Invoices for Return Modal by Customer Name, Phone, or Invoice #
  const searchInvoices = async (queryText) => {
    setSearchingInvoices(true);
    try {
      let query = supabase
        .from('sales')
        .select(`
          id,
          invoice_number,
          sale_date,
          total_amount,
          net_amount,
          paid_amount,
          payment_status,
          branch_id,
          notes,
          contacts (
            id,
            name,
            phone,
            address
          )
        `)
        .order('sale_date', { ascending: false })
        .limit(25);

      if (activeBranchId) {
        query = query.eq('branch_id', activeBranchId);
      }

      if (queryText && queryText.trim()) {
        const clean = queryText.trim();
        // 1. Search matching contacts by name or phone
        const { data: matchedContacts } = await supabase
          .from('contacts')
          .select('id')
          .or(`name.ilike.%${clean}%,phone.ilike.%${clean}%`)
          .limit(30);

        if (matchedContacts && matchedContacts.length > 0) {
          const contactIds = matchedContacts.map((c) => c.id).join(',');
          query = query.or(`invoice_number.ilike.%${clean}%,notes.ilike.%${clean}%,customer_id.in.(${contactIds})`);
        } else {
          query = query.or(`invoice_number.ilike.%${clean}%,notes.ilike.%${clean}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setInvoiceSearchResults(data || []);
    } catch (err) {
      console.error('Error searching invoices:', err);
    } finally {
      setSearchingInvoices(false);
    }
  };

  // Select an invoice and fetch its items
  const handleSelectInvoice = async (invoice) => {
    setSelectedInvoice(invoice);
    setLoadingInvoiceItems(true);
    setModalStep(2);

    const due = Math.max(0, (invoice.net_amount || 0) - (invoice.paid_amount || 0));
    setRefundMethod(due > 0.01 ? 'deduct_due' : 'cash');

    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          id,
          product_id,
          quantity,
          unit_price,
          total_price,
          products (
            id,
            name,
            sku,
            sale_price
          )
        `)
        .eq('sale_id', invoice.id);

      if (error) throw error;

      setReturnItems(
        (data || []).map((it) => ({
          ...it,
          returnQty: 0,
        }))
      );
    } catch (err) {
      console.error('Error fetching invoice items:', err);
      showMessage('Failed to load invoice items.', 'error');
    } finally {
      setLoadingInvoiceItems(false);
    }

    fetchBranchCatalog(invoice.branch_id || activeBranchId);
  };

  // Fetch branch catalog for exchange
  const fetchBranchCatalog = async (branchId) => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          id,
          product_id,
          quantity,
          products (
            id,
            name,
            sku,
            sale_price
          )
        `)
        .eq('branch_id', branchId || activeBranchId)
        .gt('quantity', 0)
        .order('quantity', { ascending: false });

      if (error) throw error;
      setBranchCatalog(data || []);
    } catch (err) {
      console.error('Error fetching catalog:', err);
    }
  };

  // Add item to exchange cart
  const addToExchangeCart = (item) => {
    const existing = exchangeCart.find((c) => c.product_id === item.product_id);
    if (existing) {
      if (existing.quantity >= item.quantity) {
        showMessage(`Cannot exceed available stock of ${item.quantity}.`, 'error');
        return;
      }
      setExchangeCart(
        exchangeCart.map((c) =>
          c.product_id === item.product_id ? { ...c, quantity: c.quantity + 1 } : c
        )
      );
    } else {
      setExchangeCart([
        ...exchangeCart,
        {
          product_id: item.product_id,
          product: item.products,
          quantity: 1,
          unit_price: item.products?.sale_price || 0,
          maxStock: item.quantity,
        },
      ]);
    }
  };

  // Calculations
  const totalReturnCredit = returnItems.reduce((sum, it) => {
    const retQty = parseInt(it.returnQty || 0, 10);
    const price = parseFloat(it.unit_price || 0);
    return sum + retQty * price;
  }, 0);

  const totalExchangeValue = exchangeCart.reduce((sum, it) => {
    const qty = parseFloat(it.quantity || 0);
    const price = parseFloat(it.unit_price || 0);
    return sum + qty * price;
  }, 0);

  const exchangeDifference = totalExchangeValue - totalReturnCredit;

  // Process Return & Restock / Exchange
  const handleSubmitReturnOrExchange = async (e) => {
    if (e) e.preventDefault();
    if (!selectedInvoice) return;

    const itemsToReturn = returnItems.filter((it) => parseInt(it.returnQty || 0, 10) > 0);
    if (itemsToReturn.length === 0) {
      showMessage('Please enter return quantity for at least 1 item.', 'error');
      return;
    }

    if (resolutionMode === 'exchange' && exchangeCart.length === 0) {
      showMessage('Please pick at least 1 replacement product for the exchange.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetBranchId = selectedInvoice.branch_id || activeBranchId;
      const voucherPrefix = resolutionMode === 'exchange' ? 'EXC' : 'CRN';
      const voucherNumber = `${voucherPrefix}-${Date.now().toString().slice(-6)}`;
      const timestamp = new Date().toISOString();

      // 1. Restock returned items back to inventory (+Qty)
      for (const it of itemsToReturn) {
        const rQty = parseInt(it.returnQty, 10);
        const prodId = it.product_id;

        const { data: currentInv } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('branch_id', targetBranchId)
          .eq('product_id', prodId)
          .maybeSingle();

        if (currentInv) {
          await supabase
            .from('inventory')
            .update({
              quantity: (currentInv.quantity || 0) + rQty,
              updated_at: timestamp,
            })
            .eq('id', currentInv.id);
        } else {
          await supabase.from('inventory').insert([{
            branch_id: targetBranchId,
            product_id: prodId,
            quantity: rQty,
            updated_at: timestamp,
          }]);
        }

        // Log movement
        await supabase.from('inventory_movements').insert([{
          branch_id: targetBranchId,
          product_id: prodId,
          type: 'adjustment_in',
          quantity: rQty,
          description: `${resolutionMode === 'exchange' ? 'Exchange Return' : 'Customer Return'} [${voucherNumber}]: Inv #${selectedInvoice.invoice_number || selectedInvoice.id.substring(0, 8)} (${returnReason})`,
          created_by: userProfile.id,
        }]);
      }

      // 2. If exchange: deduct replacement items (-Qty)
      if (resolutionMode === 'exchange') {
        for (const it of exchangeCart) {
          const eQty = parseFloat(it.quantity);
          const prodId = it.product_id;

          const { data: currentInv } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('branch_id', targetBranchId)
            .eq('product_id', prodId)
            .maybeSingle();

          if (currentInv) {
            await supabase
              .from('inventory')
              .update({
                quantity: Math.max(0, (currentInv.quantity || 0) - eQty),
                updated_at: timestamp,
              })
              .eq('id', currentInv.id);
          }

          await supabase.from('inventory_movements').insert([{
            branch_id: targetBranchId,
            product_id: prodId,
            type: 'adjustment_out',
            quantity: Math.max(1, Math.round(eQty)),
            description: `Exchange Replacement Out [${voucherNumber}]: Inv #${selectedInvoice.invoice_number || selectedInvoice.id.substring(0, 8)}`,
            created_by: userProfile.id,
          }]);
        }
      }

      // 3. Financial update
      const originalNet = parseFloat(selectedInvoice.net_amount || 0);
      const originalPaid = parseFloat(selectedInvoice.paid_amount || 0);
      const currentDue = Math.max(0, originalNet - originalPaid);

      if (resolutionMode === 'refund') {
        let newTotal = Math.max(0, (parseFloat(selectedInvoice.total_amount) || originalNet) - totalReturnCredit);
        let newNet = Math.max(0, originalNet - totalReturnCredit);
        let newPaid = originalPaid;
        let newStatus = selectedInvoice.payment_status;

        if (refundMethod === 'deduct_due') {
          const newDue = Math.max(0, currentDue - totalReturnCredit);
          newStatus = newDue <= 0.01 ? 'paid' : 'partial';
        } else {
          await supabase.from('cash_ledger').insert([{
            branch_id: targetBranchId,
            amount_in: 0,
            amount_out: totalReturnCredit,
            reference_id: selectedInvoice.id,
            description: `Sales Return Refund [${voucherNumber}]: Inv #${selectedInvoice.invoice_number || selectedInvoice.id.substring(0, 8)} (${refundMethod})`,
            transaction_date: timestamp,
            created_by: userProfile?.id,
          }]);

          newPaid = Math.max(0, originalPaid - totalReturnCredit);
          const newDue = Math.max(0, newNet - newPaid);
          newStatus = newDue <= 0.01 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
        }

        const noteEntry = `[${voucherNumber}: Return credit ৳${formatAmount(totalReturnCredit)} (${refundMethod}) - ${returnReason}]`;
        const updatedNotes = selectedInvoice.notes ? `${selectedInvoice.notes}\n${noteEntry}` : noteEntry;

        await supabase.from('sales').update({
          total_amount: newTotal,
          net_amount: newNet,
          paid_amount: newPaid,
          payment_status: newStatus,
          notes: updatedNotes,
        }).eq('id', selectedInvoice.id);

      } else {
        if (exchangeDifference > 0) {
          await supabase.from('cash_ledger').insert([{
            branch_id: targetBranchId,
            amount_in: exchangeDifference,
            amount_out: 0,
            reference_id: selectedInvoice.id,
            description: `Product Exchange Extra Payment [${voucherNumber}]: Inv #${selectedInvoice.invoice_number || selectedInvoice.id.substring(0, 8)} (${exchangePaymentMethod})`,
            transaction_date: timestamp,
            created_by: userProfile?.id,
          }]);
        } else if (exchangeDifference < 0) {
          const refundDiff = Math.abs(exchangeDifference);
          if (refundMethod !== 'deduct_due') {
            await supabase.from('cash_ledger').insert([{
              branch_id: targetBranchId,
              amount_in: 0,
              amount_out: refundDiff,
              reference_id: selectedInvoice.id,
              description: `Product Exchange Refund Difference [${voucherNumber}]: Inv #${selectedInvoice.invoice_number || selectedInvoice.id.substring(0, 8)} (${refundMethod})`,
              transaction_date: timestamp,
              created_by: userProfile?.id,
            }]);
          }
        }

        let newTotal = Math.max(0, (parseFloat(selectedInvoice.total_amount) || originalNet) - totalReturnCredit + totalExchangeValue);
        let newNet = Math.max(0, originalNet + exchangeDifference);
        let newPaid = originalPaid;

        if (exchangeDifference > 0) {
          newPaid = originalPaid + exchangeDifference;
        } else if (exchangeDifference < 0) {
          if (refundMethod !== 'deduct_due') {
            newPaid = Math.max(0, originalPaid - Math.abs(exchangeDifference));
          }
        }

        const newDue = Math.max(0, newNet - newPaid);
        const newStatus = newDue <= 0.01 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');

        const noteEntry = `[${voucherNumber}: Exchange - Returned ৳${formatAmount(totalReturnCredit)}, Taken ৳${formatAmount(totalExchangeValue)}, Net: ৳${formatAmount(exchangeDifference)}]`;
        const updatedNotes = selectedInvoice.notes ? `${selectedInvoice.notes}\n${noteEntry}` : noteEntry;

        await supabase.from('sales').update({
          total_amount: newTotal,
          net_amount: newNet,
          paid_amount: newPaid,
          payment_status: newStatus,
          notes: updatedNotes,
        }).eq('id', selectedInvoice.id);
      }

      // Voucher object for printing
      setActiveVoucher({
        voucherNumber,
        type: resolutionMode,
        date: timestamp,
        invoice: selectedInvoice,
        branch: branches.find((b) => b.id === targetBranchId),
        returnedItems: itemsToReturn,
        exchangeItems: resolutionMode === 'exchange' ? exchangeCart : [],
        totalReturnCredit,
        totalExchangeValue,
        exchangeDifference,
        refundMethod,
        exchangePaymentMethod,
        returnReason,
        returnNotes,
      });

      setShowModal(false);
      setShowPrintModal(true);
      fetchReturnHistory();
      showMessage(`Return / Exchange [${voucherNumber}] processed successfully!`, 'success');
    } catch (err) {
      console.error('Error processing return/exchange:', err);
      showMessage(err.message || 'Failed to process transaction.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Re-open historical voucher
  const handleOpenHistoricalVoucher = (tx) => {
    setActiveVoucher({
      voucherNumber: tx.voucherNumber,
      type: tx.type === 'Exchange' ? 'exchange' : 'refund',
      date: tx.date,
      invoice: {
        invoice_number: tx.invoiceNumber.replace(/^INV#/i, ''),
        contacts: {
          name: tx.customerName || 'Walk-in Customer',
          phone: tx.customerPhone || '',
          address: tx.customerAddress || '',
        },
      },
      branch: tx.branch || activeBranch,
      returnedItems: tx.returnedItems,
      exchangeItems: tx.exchangeItems,
      totalReturnCredit: tx.totalReturnCredit,
      totalExchangeValue: tx.totalExchangeValue,
      exchangeDifference: tx.totalExchangeValue - tx.totalReturnCredit,
      returnReason: tx.reason,
      returnNotes: '',
    });
    setShowPrintModal(true);
  };

  // Open Details Modal
  const handleOpenDetailsModal = (tx) => {
    setSelectedTransactionDetails(tx);
    setShowDetailsModal(true);
  };

  const handleOpenNewModal = () => {
    setSelectedInvoice(null);
    setInvoiceSearch('');
    setInvoiceSearchResults([]);
    setReturnItems([]);
    setExchangeCart([]);
    setModalStep(1);
    setResolutionMode('exchange');
    setReturnReason('Size / Variant Swap');
    setReturnNotes('');
    setShowModal(true);
    searchInvoices('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* TOP BAR */}
      <div className="no-print top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="page-title-group">
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
            Returns & Exchanges
          </h1>
        </div>

        <div className="top-bar-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {userProfile?.role === 'owner' ? (
            <div className="form-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>Active Branch:</label>
              <select
                className="input-control"
                value={activeBranchId}
                onChange={(e) => setActiveBranchId(e.target.value)}
                style={{ width: '220px' }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.is_factory ? `🏭 ${b.name}` : `🏪 ${b.name}`}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span
              className="badge"
              style={{
                backgroundColor: activeBranch?.is_factory ? '#fef3c7' : '#e0f2fe',
                color: activeBranch?.is_factory ? '#92400e' : '#0369a1',
                border: `1px solid ${activeBranch?.is_factory ? '#fde68a' : '#bae6fd'}`,
                fontSize: '0.82rem',
                fontWeight: 600,
                padding: '0.35rem 0.75rem',
              }}
            >
              {activeBranch?.is_factory ? `🏭 ${activeBranch?.name}` : `🏪 ${activeBranch?.name}`}
            </span>
          )}

          <button className="btn btn-primary" onClick={handleOpenNewModal} style={{ fontWeight: 700 }}>
            New Return / Exchange
          </button>
        </div>
      </div>

      {/* OPTION 2: MULTI-PRODUCT RETURN & EXCHANGE LIST (NO ICONS) */}
      <div className="no-print card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 className="card-title" style={{ margin: 0, fontSize: '0.98rem' }}>
              Return History
            </h3>
            <span className="badge badge-info" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
              {filteredTransactions.length} Transactions
            </span>
          </div>

          <div style={{ position: 'relative', width: '340px' }}>
            <input
              type="text"
              className="input-control"
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
              placeholder="Search by customer name, phone, invoice, voucher..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="table-container" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '45px' }}>SL</th>
                <th style={{ width: '115px' }}>Date</th>
                <th style={{ width: '135px' }}>Sales Invoice Ref</th>
                <th style={{ width: '150px' }}>Customer</th>
                <th style={{ width: '110px' }}>Voucher Ref</th>
                <th style={{ width: '90px' }}>Type</th>
                <th>Returned & Exchanged Products</th>
                <th style={{ textAlign: 'center', width: '90px' }}>Total Qty</th>
                <th style={{ textAlign: 'right', width: '110px' }}>Total Return</th>
                <th style={{ width: '130px' }}>Settlement</th>
                <th style={{ width: '130px' }}>Reason</th>
                <th style={{ textAlign: 'center', width: '130px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoading colSpan={12} message="Loading returns..." />
              ) : paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '2.5rem' }}>
                    {searchQuery.trim() ? `No return or exchange records found matching "${searchQuery}".` : 'No return or exchange records found.'}
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx, index) => {
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;
                  const isExchange = tx.type === 'Exchange';
                  const netDiff = (tx.totalExchangeValue || 0) - (tx.totalReturnCredit || 0);

                  return (
                    <tr key={tx.id} style={{ verticalAlign: 'top' }}>
                      <td>{rowNumber}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>{new Date(tx.date).toLocaleDateString()}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>
                        {tx.invoiceNumber}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                          {tx.customerName || 'Walk-in Customer'}
                        </div>
                        {tx.customerPhone && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                            {tx.customerPhone}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {tx.voucherNumber}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${isExchange ? 'info' : 'warning'}`} style={{ fontWeight: 700, fontSize: '0.75rem' }}>
                          {tx.type}
                        </span>
                      </td>

                      {/* OPTION 2: MULTI-LINE PRODUCTS LIST */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem' }}>
                          {/* Returned Products List */}
                          {tx.returnedItems.length > 0 && (
                            <div>
                              <span style={{ fontWeight: 700, color: '#c2410c', fontSize: '0.78rem' }}>Returned:</span>
                              <div style={{ paddingLeft: '0.4rem', marginTop: '0.1rem' }}>
                                {tx.returnedItems.map((it, i) => (
                                  <div key={i} style={{ color: 'var(--text-primary)', lineHeight: 1.35 }}>
                                    • {it.quantity}x {it.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(৳{formatAmount(it.unit_price)})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Replacement Products List */}
                          {isExchange && tx.exchangeItems.length > 0 && (
                            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.25rem', marginTop: '0.15rem' }}>
                              <span style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.78rem' }}>Replacement:</span>
                              <div style={{ paddingLeft: '0.4rem', marginTop: '0.1rem' }}>
                                {tx.exchangeItems.map((it, i) => (
                                  <div key={i} style={{ color: 'var(--text-primary)', lineHeight: 1.35 }}>
                                    • {it.quantity}x {it.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(৳{formatAmount(it.unit_price)})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Total Qty */}
                      <td style={{ textAlign: 'center', fontSize: '0.82rem' }}>
                        <div style={{ fontWeight: 700, color: '#c2410c' }}>+{tx.totalReturnQty} ret</div>
                        {isExchange && tx.totalExchangeQty > 0 && (
                          <div style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.75rem' }}>-{tx.totalExchangeQty} rep</div>
                        )}
                      </td>

                      {/* Total Return Value */}
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>
                        ৳{formatAmount(tx.totalReturnCredit)}
                      </td>

                      {/* Settlement */}
                      <td style={{ fontSize: '0.82rem' }}>
                        {isExchange ? (
                          netDiff > 0 ? (
                            <span style={{ color: '#16a34a', fontWeight: 700 }}>Customer Paid: +৳{formatAmount(netDiff)}</span>
                          ) : netDiff < 0 ? (
                            <span style={{ color: '#dc2626', fontWeight: 700 }}>Refunded: -৳{formatAmount(Math.abs(netDiff))}</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Even Swap (৳0)</span>
                          )
                        ) : (
                          <span style={{ color: '#b45309', fontWeight: 700 }}>Refunded ৳{formatAmount(tx.totalReturnCredit)}</span>
                        )}
                      </td>

                      {/* Reason */}
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                        {tx.reason}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-icon"
                            style={{ color: '#0284c7', padding: '0.35rem 0.45rem' }}
                            onClick={() => handleOpenDetailsModal(tx)}
                            title="View Return / Exchange Breakdown"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-icon"
                            style={{ color: '#334155', padding: '0.35rem 0.45rem' }}
                            onClick={() => handleOpenHistoricalVoucher(tx)}
                            title="Print Voucher / Credit Note"
                          >
                            <Printer size={15} />
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
          currentPage={currentPage}
          totalCount={filteredTransactions.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* ========================================================================= */}
      {/* RETURN & EXCHANGE MODAL */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg" style={{ maxHeight: '92vh', maxWidth: '850px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '0.75rem 1.25rem' }}>
              <div>
                <h3 className="modal-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                  {modalStep === 1 ? 'Step 1: Select Invoice' : 'Step 2: Return & Exchange'}
                </h3>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowModal(false)}
                style={{ borderRadius: '50%', padding: '0.35rem 0.5rem', border: 'none' }}
              >
                ✕
              </button>
            </div>

            {modalStep === 1 ? (
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input
                  type="text"
                  className="input-control"
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                  placeholder="Search by customer name, phone number, or invoice #..."
                  value={invoiceSearch}
                  autoFocus
                  onChange={(e) => {
                    setInvoiceSearch(e.target.value);
                    searchInvoices(e.target.value);
                  }}
                />

                <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Date</th>
                        <th>Customer & Phone</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                        <th style={{ textAlign: 'right' }}>Due</th>
                        <th style={{ textAlign: 'center', width: '90px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchingInvoices ? (
                        <TableLoading colSpan={6} message="Searching invoices..." />
                      ) : invoiceSearchResults.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                            {invoiceSearch.trim() ? `No invoices found matching "${invoiceSearch}".` : 'No invoices found.'}
                          </td>
                        </tr>
                      ) : (
                        invoiceSearchResults.map((inv) => {
                          const due = Math.max(0, (inv.net_amount || 0) - (inv.paid_amount || 0));
                          return (
                            <tr key={inv.id}>
                              <td style={{ fontWeight: 700, color: 'var(--primary-color)' }}>
                                {inv.invoice_number || inv.id.substring(0, 8)}
                              </td>
                              <td>{new Date(inv.sale_date).toLocaleDateString()}</td>
                              <td>
                                <div style={{ fontWeight: 700 }}>{inv.contacts?.name || 'Walk-in Customer'}</div>
                                {inv.contacts?.phone && (
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                    {inv.contacts.phone}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>৳{formatAmount(inv.net_amount)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: due > 0 ? '#dc2626' : 'inherit' }}>৳{formatAmount(due)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                                  onClick={() => handleSelectInvoice(inv)}
                                >
                                  Select
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitReturnOrExchange} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', margin: 0 }}>
                <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

                  {/* Top Bar with Invoice Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}>
                    <div>
                      <strong>{selectedInvoice.invoice_number}</strong> • {selectedInvoice.contacts?.name || 'Walk-in Customer'}
                    </div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalStep(1)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                      Change Invoice
                    </button>
                  </div>

                  {/* Mode Selector */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setResolutionMode('exchange')}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: `1.5px solid ${resolutionMode === 'exchange' ? '#2563eb' : 'var(--border-color)'}`,
                        background: resolutionMode === 'exchange' ? '#eff6ff' : '#fff',
                        color: resolutionMode === 'exchange' ? '#1d4ed8' : 'inherit',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Product Exchange (Swap)
                    </button>

                    <button
                      type="button"
                      onClick={() => setResolutionMode('refund')}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: `1.5px solid ${resolutionMode === 'refund' ? '#d97706' : 'var(--border-color)'}`,
                        background: resolutionMode === 'refund' ? '#fffbeb' : '#fff',
                        color: resolutionMode === 'refund' ? '#b45309' : 'inherit',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Money Return / Credit Note
                    </button>
                  </div>

                  {/* 1. Returned Items */}
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.6rem', background: '#fafafa' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.4rem', color: '#c2410c' }}>
                      Items Returning (from Customer):
                    </div>

                    {loadingInvoiceItems ? (
                      <LoadingBlock message="Loading items..." />
                    ) : (
                      <table style={{ width: '100%', fontSize: '0.82rem', background: '#fff' }}>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th style={{ textAlign: 'center', width: '50px' }}>Sold</th>
                            <th style={{ textAlign: 'right', width: '70px' }}>Price</th>
                            <th style={{ textAlign: 'center', width: '110px' }}>Return Qty</th>
                            <th style={{ textAlign: 'right', width: '75px' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {returnItems.map((item, idx) => {
                            const retQty = parseInt(item.returnQty || 0, 10);
                            const price = parseFloat(item.unit_price || 0);

                            return (
                              <tr key={item.id || idx}>
                                <td>
                                  <strong>{item.products?.name}</strong>
                                </td>
                                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                <td style={{ textAlign: 'right' }}>৳{formatAmount(price)}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', justifyContent: 'center' }}>
                                    <input
                                      type="number"
                                      min="0"
                                      max={item.quantity}
                                      value={item.returnQty === '' ? '' : item.returnQty}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setReturnItems(returnItems.map((it, i) => {
                                          if (i === idx) {
                                            if (val === '') return { ...it, returnQty: '' };
                                            const p = parseInt(val, 10);
                                            return { ...it, returnQty: isNaN(p) ? 0 : Math.min(item.quantity, Math.max(0, p)) };
                                          }
                                          return it;
                                        }));
                                      }}
                                      className="input-control"
                                      style={{ width: '45px', textAlign: 'center', padding: '0.15rem', fontSize: '0.8rem' }}
                                    />
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: '0.1rem 0.35rem', fontSize: '0.7rem' }}
                                      onClick={() => setReturnItems(returnItems.map((it, i) => i === idx ? { ...it, returnQty: it.quantity } : it))}
                                    >
                                      All
                                    </button>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: retQty > 0 ? '#ea580c' : 'inherit' }}>
                                  ৳{formatAmount(retQty * price)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                    <div style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.88rem', color: '#c2410c', marginTop: '0.4rem' }}>
                      Return Credit: ৳{formatAmount(totalReturnCredit)}
                    </div>
                  </div>

                  {/* 2. Replacement Items (If Exchange) */}
                  {resolutionMode === 'exchange' && (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.6rem', background: '#fafafa' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.4rem', color: '#0369a1' }}>
                        Replacement Items to Give Customer:
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                        <select
                          className="input-control"
                          style={{ flex: 1, fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
                          onChange={(e) => {
                            const found = branchCatalog.find((c) => c.product_id === e.target.value);
                            if (found) addToExchangeCart(found);
                            e.target.value = '';
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>+ Choose product from catalog...</option>
                          {branchCatalog.map((c) => (
                            <option key={c.product_id} value={c.product_id}>
                              {c.products?.name} {!activeBranch?.is_factory ? `(Stock: ${c.quantity}) ` : ''}- ৳{formatAmount(c.products?.sale_price)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {exchangeCart.length > 0 && (
                        <table style={{ width: '100%', fontSize: '0.82rem', background: '#fff' }}>
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th style={{ width: '60px', textAlign: 'center' }}>Qty</th>
                              <th style={{ width: '75px', textAlign: 'right' }}>Price</th>
                              <th style={{ width: '75px', textAlign: 'right' }}>Total</th>
                              <th style={{ width: '30px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {exchangeCart.map((it, idx) => (
                              <tr key={it.product_id}>
                                <td>{it.product?.name}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min="1"
                                    max={it.maxStock}
                                    value={it.quantity}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 1;
                                      setExchangeCart(exchangeCart.map((c, i) => i === idx ? { ...c, quantity: Math.min(it.maxStock, val) } : c));
                                    }}
                                    className="input-control"
                                    style={{ width: '40px', textAlign: 'center', padding: '0.1rem' }}
                                  />
                                </td>
                                <td style={{ textAlign: 'right' }}>৳{formatAmount(it.unit_price)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{formatAmount(it.quantity * it.unit_price)}</td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => setExchangeCart(exchangeCart.filter((_, i) => i !== idx))}
                                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      <div style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.88rem', color: '#0284c7', marginTop: '0.4rem' }}>
                        Replacement Total: ৳{formatAmount(totalExchangeValue)}
                      </div>
                    </div>
                  )}

                  {/* Settlement & Reason */}
                  <div style={{ padding: '0.65rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Settlement:</span>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: resolutionMode === 'exchange' ? (exchangeDifference > 0 ? '#dc2626' : '#16a34a') : '#d97706' }}>
                        {resolutionMode === 'exchange'
                          ? (exchangeDifference > 0 ? `Customer Pays: +৳${formatAmount(exchangeDifference)}` : (exchangeDifference < 0 ? `Refund Customer: -৳${formatAmount(Math.abs(exchangeDifference))}` : 'Even Swap (৳0)'))
                          : `Refund to Customer: ৳${formatAmount(totalReturnCredit)}`}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Reason</label>
                        <select
                          className="input-control"
                          style={{ padding: '0.3rem', fontSize: '0.8rem' }}
                          value={returnReason}
                          onChange={(e) => setReturnReason(e.target.value)}
                        >
                          <option value="Size / Variant Swap">Size / Variant Swap</option>
                          <option value="Defective / Damaged">Defective / Damaged</option>
                          <option value="Wrong Item">Wrong Item</option>
                          <option value="Customer Choice">Customer Choice</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>
                          {resolutionMode === 'exchange' && exchangeDifference > 0 ? 'Customer Paid Via' : 'Refund Method'}
                        </label>
                        <select
                          className="input-control"
                          style={{ padding: '0.3rem', fontSize: '0.8rem' }}
                          value={resolutionMode === 'exchange' && exchangeDifference > 0 ? exchangePaymentMethod : refundMethod}
                          onChange={(e) => {
                            if (resolutionMode === 'exchange' && exchangeDifference > 0) {
                              setExchangePaymentMethod(e.target.value);
                            } else {
                              setRefundMethod(e.target.value);
                            }
                          }}
                        >
                          {resolutionMode === 'refund' && ((selectedInvoice?.net_amount || 0) - (selectedInvoice?.paid_amount || 0)) > 0.01 && (
                            <option value="deduct_due">Deduct from Invoice Due</option>
                          )}
                          <option value="cash">Cash</option>
                          <option value="mobile_banking">Mobile Banking</option>
                          <option value="bank">Bank</option>
                        </select>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="modal-footer" style={{ padding: '0.65rem 1rem', display: 'flex', justifyContent: 'space-between' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalStep(1)} disabled={isSubmitting}>
                    Back
                  </button>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)} disabled={isSubmitting}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={isSubmitting || returnItems.every((it) => !parseInt(it.returnQty || 0, 10))}
                      style={{ fontWeight: 700 }}
                    >
                      {isSubmitting ? 'Saving...' : 'Confirm & Print Voucher'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VOUCHER PRINT MODAL */}
      {/* ========================================================================= */}
      {showPrintModal && activeVoucher && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header no-print" style={{ padding: '0.75rem 1rem' }}>
              <h3 className="modal-title" style={{ fontSize: '1rem' }}>
                {activeVoucher.type === 'exchange' ? 'Product Exchange Voucher' : 'Credit Note / Sales Return Receipt'}
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPrintModal(false)}
                style={{ borderRadius: '50%', padding: '0.35rem 0.5rem', border: 'none' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: '1.5rem' }}>
              <div className="invoice-print-view" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
                {/* Header */}
                <div className="invoice-header">
                  <div className="invoice-company-details">
                    <div className="invoice-company-name">ALMAS ACCESSORIES</div>
                    <div>{activeVoucher.branch ? activeVoucher.branch.name : 'Main Factory Outlet'}</div>
                    {activeVoucher.branch?.phone && <div>Phone: {activeVoucher.branch.phone}</div>}
                    {activeVoucher.branch?.address && <div>Address: {activeVoucher.branch.address}</div>}
                  </div>
                  <div className="invoice-meta">
                    <div className="invoice-title" style={{ color: activeVoucher.type === 'exchange' ? '#2563eb' : '#b45309' }}>
                      {activeVoucher.type === 'exchange' ? 'EXCHANGE VOUCHER' : 'CREDIT NOTE'}
                    </div>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800 }}>
                      {activeVoucher.voucherNumber}
                    </div>
                    <div>Date: {new Date(activeVoucher.date).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                      Ref Inv: <strong>{activeVoucher.invoice?.invoice_number || activeVoucher.invoice?.id?.substring(0, 8) || 'N/A'}</strong>
                    </div>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="invoice-details-grid" style={{ marginTop: '1rem' }}>
                  <div className="invoice-bill-to">
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>CUSTOMER:</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{activeVoucher.invoice?.contacts?.name || 'Walk-in Customer'}</div>
                    {activeVoucher.invoice?.contacts?.phone && <div>Phone: {activeVoucher.invoice.contacts.phone}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>TRANSACTION INFO:</div>
                    <div>Type: <strong>{activeVoucher.type === 'exchange' ? 'Product Exchange' : 'Direct Return'}</strong></div>
                    <div>Reason: <strong>{activeVoucher.returnReason}</strong></div>
                  </div>
                </div>

                {/* Returned items */}
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.3rem', color: '#b45309' }}>
                    Returned Items:
                  </div>
                  <table className="invoice-table">
                    <thead>
                      <tr>
                        <th style={{ width: '35px' }}>SL</th>
                        <th>Product</th>
                        <th style={{ textAlign: 'center', width: '80px' }}>Return Qty</th>
                        <th style={{ textAlign: 'right', width: '90px' }}>Price</th>
                        <th style={{ textAlign: 'right', width: '100px' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeVoucher.returnedItems.map((item, index) => {
                        const rQty = parseInt(item.returnQty || item.quantity || 0, 10);
                        const price = parseFloat(item.unit_price || item.products?.sale_price || 0);
                        return (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{item.name || item.products?.name || item.product?.name || 'Product'}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{rQty}</td>
                            <td style={{ textAlign: 'right' }}>৳{formatAmount(price)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{formatAmount(rQty * price)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Replacement items if Exchange */}
                {activeVoucher.type === 'exchange' && activeVoucher.exchangeItems.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.3rem', color: '#2563eb' }}>
                      Replacement Items:
                    </div>
                    <table className="invoice-table">
                      <thead>
                        <tr>
                          <th style={{ width: '35px' }}>SL</th>
                          <th>Product</th>
                          <th style={{ textAlign: 'center', width: '80px' }}>Qty</th>
                          <th style={{ textAlign: 'right', width: '90px' }}>Price</th>
                          <th style={{ textAlign: 'right', width: '100px' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeVoucher.exchangeItems.map((item, index) => {
                          const price = parseFloat(item.unit_price || item.products?.sale_price || 0);
                          const qty = parseFloat(item.quantity || 0);
                          return (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td>{item.name || item.product?.name || item.products?.name || 'Product'}</td>
                              <td style={{ textAlign: 'center', fontWeight: 700 }}>{qty}</td>
                              <td style={{ textAlign: 'right' }}>৳{formatAmount(price)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{formatAmount(qty * price)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '280px', alignSelf: 'flex-end', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span>Return Value:</span>
                    <strong>৳{formatAmount(activeVoucher.totalReturnCredit)}</strong>
                  </div>
                  {activeVoucher.type === 'exchange' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                        <span>Replacement Value:</span>
                        <strong>৳{formatAmount(activeVoucher.totalExchangeValue)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid #000', paddingTop: '0.4rem', fontSize: '1rem' }}>
                        <span>Net Difference:</span>
                        <span>
                          {activeVoucher.exchangeDifference > 0
                            ? `+৳${formatAmount(activeVoucher.exchangeDifference)} (Paid)`
                            : (activeVoucher.exchangeDifference < 0 ? `-৳${formatAmount(Math.abs(activeVoucher.exchangeDifference))} (Refunded)` : '৳0')}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', paddingTop: '0.5rem' }}>
                  <div style={{ textAlign: 'center', width: '130px', borderTop: '1px dotted #000' }}>
                    <p style={{ margin: '0.3rem 0', fontSize: '0.75rem', fontWeight: 700 }}>Customer</p>
                  </div>
                  <div style={{ textAlign: 'center', width: '130px', borderTop: '1px dotted #000' }}>
                    <p style={{ margin: '0.3rem 0', fontSize: '0.75rem', fontWeight: 700 }}>Authorised</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer no-print" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPrintModal(false)}>Close</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()} style={{ fontWeight: 700 }}>
                Print Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TRANSACTION DETAILS MODAL */}
      {/* ========================================================================= */}
      {showDetailsModal && selectedTransactionDetails && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg" style={{ maxHeight: '90vh', maxWidth: '800px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                {selectedTransactionDetails.type === 'Exchange' ? 'Exchange Details' : 'Return Details'} - {selectedTransactionDetails.voucherNumber}
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDetailsModal(false)}
                style={{ borderRadius: '50%', padding: '0.35rem 0.5rem', border: 'none' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Sales Invoice Ref</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-color)', fontFamily: 'monospace' }}>
                    {selectedTransactionDetails.invoiceNumber}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Customer</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {selectedTransactionDetails.customerName || 'Walk-in Customer'}
                  </div>
                  {selectedTransactionDetails.customerPhone && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {selectedTransactionDetails.customerPhone}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Date & Time</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {new Date(selectedTransactionDetails.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Reason</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {selectedTransactionDetails.reason}
                  </div>
                </div>
              </div>

              {/* Returned Items Table */}
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#c2410c', marginBottom: '0.4rem' }}>
                  Returned Items:
                </div>
                <div className="table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>SL</th>
                        <th>Product</th>
                        <th style={{ textAlign: 'center', width: '90px' }}>Return Qty</th>
                        <th style={{ textAlign: 'right', width: '100px' }}>Unit Price</th>
                        <th style={{ textAlign: 'right', width: '110px' }}>Total Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTransactionDetails.returnedItems.map((it, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>
                            <strong>{it.name}</strong>
                            {it.sku && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SKU: {it.sku}</div>}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#c2410c' }}>{it.quantity}</td>
                          <td style={{ textAlign: 'right' }}>৳{formatAmount(it.unit_price)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{formatAmount(it.total_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.9rem', color: '#c2410c', marginTop: '0.4rem' }}>
                  Total Return Value: ৳{formatAmount(selectedTransactionDetails.totalReturnCredit)}
                </div>
              </div>

              {/* Replacement Items Table (if Exchange) */}
              {selectedTransactionDetails.type === 'Exchange' && selectedTransactionDetails.exchangeItems.length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0369a1', marginBottom: '0.4rem' }}>
                    Replacement Items:
                  </div>
                  <div className="table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>SL</th>
                          <th>Product</th>
                          <th style={{ textAlign: 'center', width: '90px' }}>Replacement Qty</th>
                          <th style={{ textAlign: 'right', width: '100px' }}>Unit Price</th>
                          <th style={{ textAlign: 'right', width: '110px' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTransactionDetails.exchangeItems.map((it, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <strong>{it.name}</strong>
                              {it.sku && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SKU: {it.sku}</div>}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: '#0369a1' }}>{it.quantity}</td>
                            <td style={{ textAlign: 'right' }}>৳{formatAmount(it.unit_price)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{formatAmount(it.total_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.9rem', color: '#0284c7', marginTop: '0.4rem' }}>
                    Total Replacement Value: ৳{formatAmount(selectedTransactionDetails.totalExchangeValue)}
                  </div>
                </div>
              )}

              {/* Financial Settlement Box */}
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Final Settlement:</span>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: selectedTransactionDetails.type === 'Exchange' ? ((selectedTransactionDetails.totalExchangeValue - selectedTransactionDetails.totalReturnCredit) > 0 ? '#16a34a' : '#dc2626') : '#b45309' }}>
                  {selectedTransactionDetails.type === 'Exchange'
                    ? ((selectedTransactionDetails.totalExchangeValue - selectedTransactionDetails.totalReturnCredit) > 0
                      ? `Customer Paid Difference: +৳${formatAmount(selectedTransactionDetails.totalExchangeValue - selectedTransactionDetails.totalReturnCredit)}`
                      : ((selectedTransactionDetails.totalExchangeValue - selectedTransactionDetails.totalReturnCredit) < 0
                        ? `Store Refunded Difference: -৳${formatAmount(Math.abs(selectedTransactionDetails.totalExchangeValue - selectedTransactionDetails.totalReturnCredit))}`
                        : 'Even Swap (৳0)'))
                    : `Total Refunded: ৳${formatAmount(selectedTransactionDetails.totalReturnCredit)}`}
                </span>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setShowDetailsModal(false);
                  handleOpenHistoricalVoucher(selectedTransactionDetails);
                }}
                style={{ fontWeight: 700 }}
              >
                Print Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
