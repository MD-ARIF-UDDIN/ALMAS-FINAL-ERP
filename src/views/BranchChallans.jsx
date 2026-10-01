import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import almasLogo from '../assets/almas_logo.jpg';
import {
  Truck,
  Plus,
  Search,
  Printer,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  ArrowRight,
  FileText,
  Calendar,
  X,
  CreditCard,
  User,
  MapPin,
  Check,
  ChevronDown,
  ShieldCheck,
  XCircle,
  History,
  Send,
  AlertTriangle,
  Edit
} from 'lucide-react';
import { TableLoading } from '../components/TableLoading';
import Pagination from '../components/Pagination';
import { formatAmount, formatPlainNumber } from '../utils/format';

export const getChallanStatus = (ch) => {
  if (!ch) return 'approved';
  if (ch.status) return ch.status;
  if (ch.notes && typeof ch.notes === 'string') {
    if (ch.notes.includes('[STATUS:PENDING]')) return 'pending';
    if (ch.notes.includes('[STATUS:REJECTED')) return 'rejected';
  }
  return 'approved';
};

export const getChallanDiscount = (ch) => {
  if (!ch) return 0;
  if (ch.discount !== undefined && ch.discount !== null && !isNaN(parseFloat(ch.discount))) {
    return parseFloat(ch.discount);
  }
  if (ch.notes && typeof ch.notes === 'string') {
    const match = ch.notes.match(/\[DISCOUNT:([0-9.]+)\]/);
    if (match) return parseFloat(match[1]) || 0;
  }
  return 0;
};

export const getChallanCleanNotes = (ch) => {
  if (!ch || !ch.notes) return '';
  let str = ch.notes;
  str = str.replace(/\[STATUS:PENDING\]\s*/g, '');
  str = str.replace(/\[STATUS:REJECTED(:[^\]]*)?\]\s*/g, '');
  str = str.replace(/\[DISCOUNT:([0-9.]+)\]\s*/g, '');
  return str.trim();
};

export const getChallanRejectionReason = (ch) => {
  if (!ch || !ch.notes) return '';
  const match = ch.notes.match(/\[STATUS:REJECTED:([^\]]*)\]/);
  return match ? match[1].trim() : '';
};

export default function BranchChallans({ userProfile, branches = [], addToast }) {
  const role = userProfile?.role || 'staff';
  const isOwner = role === 'owner';
  const myBranchId = userProfile?.branch_id;

  // Selected Branch Filter for Owner
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    if (isOwner) {
      const factoryBranch = branches.find((b) => b.is_factory || b.name?.toLowerCase().includes('factory'));
      return factoryBranch ? factoryBranch.id : (branches.length > 0 ? branches[0].id : '');
    }
    return myBranchId || (branches.length > 0 ? branches[0].id : '');
  });

  const activeBranchObj = branches.find((b) => b.id === (isOwner ? selectedBranchId : myBranchId));
  const isFactoryPerspective = Boolean(
    !activeBranchObj || 
    activeBranchObj.is_factory || 
    activeBranchObj.name?.toLowerCase().includes('factory') || 
    (isOwner && selectedBranchId === 'all')
  );

  // Direct dispatch only applies when operating directly from the Factory branch.
  // Any challan created from a Showroom perspective requires Factory approval before stock is dispatched.
  const isDirectDispatch = Boolean(activeBranchObj?.is_factory && role !== 'staff');

  // State lists
  const [challans, setChallans] = useState([]);
  const [branchPayments, setBranchPayments] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'approved', 'unpaid', 'partial', 'paid'

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditChallanModal, setShowEditChallanModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRejectChallanModal, setShowRejectChallanModal] = useState(false);
  const [activeChallan, setActiveChallan] = useState(null);
  const [editingChallan, setEditingChallan] = useState(null);
  const [selectedPaymentForAction, setSelectedPaymentForAction] = useState(null);
  const [selectedChallanForReject, setSelectedChallanForReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [challanRejectionReason, setChallanRejectionReason] = useState('');

  // New Challan Form State
  const [fromBranchId, setFromBranchId] = useState(() => {
    const factory = branches.find((b) => b.is_factory || b.name?.toLowerCase().includes('factory'));
    return factory ? factory.id : (branches.length > 0 ? branches[0].id : '');
  });
  const [toBranchId, setToBranchId] = useState(() => {
    if (!isOwner && myBranchId) return myBranchId;
    return '';
  });
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [notes, setNotes] = useState('');
  const [challanDiscount, setChallanDiscount] = useState('');
  const [challanItems, setChallanItems] = useState([
    { productId: '', quantity: 1, unitPrice: 0.00, totalPrice: 0.00 }
  ]);
  const [isSubmittingChallan, setIsSubmittingChallan] = useState(false);

  // Edit Challan Form State (For pending challans)
  const [editFromBranchId, setEditFromBranchId] = useState('');
  const [editToBranchId, setEditToBranchId] = useState('');
  const [editChallanDate, setEditChallanDate] = useState('');
  const [editVehicleNo, setEditVehicleNo] = useState('');
  const [editDriverName, setEditDriverName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editChallanDiscount, setEditChallanDiscount] = useState('');
  const [editChallanItems, setEditChallanItems] = useState([]);
  const [isSavingEditChallan, setIsSavingEditChallan] = useState(false);

  // Payment Form State (Branch submits request / Owner records payment)
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const showMessage = (text, type = 'info') => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const fetchCatalogProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, product_code, name, sale_price, purchase_price, category, description')
        .order('name', { ascending: true });
      if (error) throw error;
      setCatalogProducts(data || []);
    } catch (err) {
      console.error('Error loading products:', err);
    }
  };

  const fetchChallans = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('branch_challans')
        .select(`
          *,
          from_branch:branches!branch_challans_from_branch_id_fkey (id, name, is_factory),
          to_branch:branches!branch_challans_to_branch_id_fkey (id, name, is_factory),
          items:branch_challan_items (
            id,
            product_id,
            dispatched_qty,
            sold_qty,
            remaining_qty,
            unit_transfer_price,
            total_price,
            product:products (id, sku, product_code, name, category)
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (!isOwner && myBranchId) {
        query = query.or(`from_branch_id.eq.${myBranchId},to_branch_id.eq.${myBranchId}`);
      } else if (isOwner && selectedBranchId && selectedBranchId !== 'all') {
        query = query.or(`from_branch_id.eq.${selectedBranchId},to_branch_id.eq.${selectedBranchId}`);
      }

      if (statusFilter !== 'all' && ['unpaid', 'partial', 'paid'].includes(statusFilter)) {
        query = query.eq('payment_status', statusFilter);
      }

      if (searchQuery.trim()) {
        const cleanQuery = searchQuery.trim().replace(/[%_]/g, '');
        query = query.or(`challan_no.ilike.%${cleanQuery}%,driver_name.ilike.%${cleanQuery}%,vehicle_no.ilike.%${cleanQuery}%`);
      }

      const { data, count, error } = await query.range(from, to);
      if (error) throw error;
      setChallans(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error loading challans:', err);
      showMessage('Failed to load branch delivery challans.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, isOwner, myBranchId, selectedBranchId, statusFilter, searchQuery]);

  const fetchBranchPayments = async () => {
    try {
      let query = supabase
        .from('branch_payments')
        .select(`
          *,
          branch:branches (id, name, is_factory),
          challan:branch_challans (
            id,
            challan_no,
            total_bill_amount,
            due_amount,
            from_branch_id,
            to_branch_id,
            from_branch:branches!branch_challans_from_branch_id_fkey (id, name, is_factory),
            to_branch:branches!branch_challans_to_branch_id_fkey (id, name, is_factory)
          )
        `)
        .order('created_at', { ascending: false });

      if (!isOwner && myBranchId) {
        query = query.eq('branch_id', myBranchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setBranchPayments(data || []);
    } catch (err) {
      console.error('Error loading payments:', err);
    }
  };

  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      if (isOwner) {
        const factoryBranch = branches.find((b) => b.is_factory || b.name?.toLowerCase().includes('factory'));
        setSelectedBranchId(factoryBranch ? factoryBranch.id : branches[0].id);
      } else {
        setSelectedBranchId(myBranchId || branches[0].id);
      }
    }
    if (!fromBranchId && branches.length > 0) {
      const factoryBranch = branches.find((b) => b.is_factory || b.name?.toLowerCase().includes('factory'));
      setFromBranchId(factoryBranch ? factoryBranch.id : branches[0].id);
    }
  }, [branches, isOwner, myBranchId, selectedBranchId, fromBranchId]);

  useEffect(() => {
    setPage(1);
  }, [selectedBranchId, statusFilter, searchQuery]);

  useEffect(() => {
    fetchChallans();
  }, [fetchChallans]);

  useEffect(() => {
    fetchBranchPayments();
    fetchCatalogProducts();
  }, []);

  // Pending payments awaiting Owner approval
  const pendingPayments = branchPayments.filter((p) => (p.status || 'approved') === 'pending');

  // KPI Computations
  const totalDispatchedValue = challans.reduce((sum, c) => sum + (parseFloat(c.total_bill_amount) || 0), 0);
  const totalPaidValue = challans.reduce((sum, c) => sum + (parseFloat(c.paid_amount) || 0), 0);
  const totalDueValue = challans.reduce((sum, c) => sum + (parseFloat(c.due_amount) || 0), 0);

  const totalDispatchedQty = challans.reduce((sum, c) => {
    const itemQty = (c.items || []).reduce((iSum, it) => iSum + (it.dispatched_qty || 0), 0);
    return sum + itemQty;
  }, 0);

  const totalSoldQty = challans.reduce((sum, c) => {
    const itemSold = (c.items || []).reduce((iSum, it) => iSum + (it.sold_qty || 0), 0);
    return sum + itemSold;
  }, 0);

  // Pending challans awaiting Owner/Factory approval
  const pendingChallans = challans.filter((c) => getChallanStatus(c) === 'pending');

  // Filtered list by search query and statusFilter
  const filteredChallans = challans.filter((c) => {
    const st = getChallanStatus(c);
    if (statusFilter === 'pending' && st !== 'pending') return false;
    if (statusFilter === 'approved' && st !== 'approved') return false;
    if (statusFilter === 'rejected' && st !== 'rejected') return false;
    if (statusFilter === 'unpaid' && (st !== 'approved' || c.payment_status !== 'unpaid')) return false;
    if (statusFilter === 'partial' && (st !== 'approved' || c.payment_status !== 'partial')) return false;
    if (statusFilter === 'paid' && (st !== 'approved' || c.payment_status !== 'paid')) return false;

    const q = searchQuery.toLowerCase();
    return (
      c.challan_no?.toLowerCase().includes(q) ||
      c.to_branch?.name?.toLowerCase().includes(q) ||
      c.from_branch?.name?.toLowerCase().includes(q) ||
      c.driver_name?.toLowerCase().includes(q) ||
      c.vehicle_no?.toLowerCase().includes(q) ||
      (c.items || []).some((it) => it.product?.name?.toLowerCase().includes(q) || it.product?.sku?.toLowerCase().includes(q))
    );
  });

  // Handle Item Row changes in Create Challan Modal
  const addItemRow = () => {
    setChallanItems([...challanItems, { productId: '', quantity: 1, unitPrice: 0.00, totalPrice: 0.00 }]);
  };

  const removeItemRow = (index) => {
    if (challanItems.length <= 1) return;
    setChallanItems(challanItems.filter((_, idx) => idx !== index));
  };

  const updateItemRow = (index, field, value) => {
    const updated = [...challanItems];
    const row = { ...updated[index] };

    if (field === 'productId') {
      row.productId = value;
      const matchedProd = catalogProducts.find((p) => p.id === value);
      if (matchedProd) {
        row.unitPrice = parseFloat(matchedProd.sale_price) || parseFloat(matchedProd.purchase_price) || 0;
      }
    } else if (field === 'quantity') {
      row.quantity = value;
    } else if (field === 'unitPrice') {
      row.unitPrice = value;
    }

    const qty = parseInt(row.quantity) || 0;
    const price = parseFloat(row.unitPrice) || 0;
    row.totalPrice = qty * price;
    updated[index] = row;
    setChallanItems(updated);
  };

  const getNewChallanSubtotal = () => {
    return challanItems.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
  };

  const getNewChallanGrandTotal = () => {
    const sub = getNewChallanSubtotal();
    const disc = parseFloat(challanDiscount) || 0;
    return Math.max(0, sub - disc);
  };

  // Submit Create Delivery Challan / Requisition
  const handleCreateChallan = async (e) => {
    e.preventDefault();
    if (!toBranchId) {
      showMessage('Please select a Destination Branch.', 'error');
      return;
    }
    if (fromBranchId === toBranchId) {
      showMessage('Origin Factory and Destination Branch cannot be the same.', 'error');
      return;
    }
    const validItems = challanItems.filter((it) => it.productId && (parseInt(it.quantity) || 0) > 0);
    if (validItems.length === 0) {
      showMessage('Please add at least one product with valid quantity.', 'error');
      return;
    }

    setIsSubmittingChallan(true);
    try {
      const subtotal = getNewChallanSubtotal();
      const disc = parseFloat(challanDiscount) || 0;
      const grandTotal = Math.max(0, subtotal - disc);
      const challanNo = `CHL-${Date.now().toString().slice(-6)}`;
      const cleanUserNotes = notes.trim();

      const requiresApproval = !activeBranchObj?.is_factory || role === 'staff' || role === 'branch_manager';
      const challanStatus = requiresApproval ? 'pending' : 'approved';

      // 1. Insert Challan Header
      const { data: challanData, error: challanErr } = await supabase
        .from('branch_challans')
        .insert([
          {
            challan_no: challanNo,
            from_branch_id: fromBranchId,
            to_branch_id: toBranchId,
            total_bill_amount: grandTotal,
            discount: disc,
            status: challanStatus,
            paid_amount: 0.00,
            due_amount: grandTotal,
            payment_status: 'unpaid',
            challan_date: challanDate,
            vehicle_no: vehicleNo.trim() || null,
            driver_name: driverName.trim() || null,
            notes: cleanUserNotes || null,
            created_by: userProfile?.id,
          },
        ])
        .select()
        .single();

      if (challanErr) throw challanErr;

      // 2. Insert Challan Line Items
      const itemsPayload = validItems.map((it) => {
        const q = parseInt(it.quantity) || 0;
        const p = parseFloat(it.unitPrice) || 0;
        return {
          challan_id: challanData.id,
          product_id: it.productId,
          dispatched_qty: q,
          sold_qty: 0,
          remaining_qty: q,
          unit_transfer_price: p,
          total_price: q * p,
        };
      });

      const { error: itemsErr } = await supabase.from('branch_challan_items').insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      // 3. If Direct Dispatch by Factory, increment Destination Branch Inventory immediately
      if (!requiresApproval) {
        for (const it of validItems) {
          const q = parseInt(it.quantity) || 0;
          const { data: existingInv } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('branch_id', toBranchId)
            .eq('product_id', it.productId)
            .maybeSingle();

          if (existingInv) {
            await supabase
              .from('inventory')
              .update({ quantity: (existingInv.quantity || 0) + q })
              .eq('id', existingInv.id);
          } else {
            await supabase
              .from('inventory')
              .insert([{ branch_id: toBranchId, product_id: it.productId, quantity: q }]);
          }
        }
        showMessage(`Delivery Challan #${challanNo} created & dispatched successfully!`, 'success');
      } else {
        showMessage(`Challan #${challanNo} created! Awaiting Factory approval before dispatch.`, 'success');
      }

      setShowCreateModal(false);
      resetChallanForm();
      fetchChallans();
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Failed to create challan.', 'error');
    } finally {
      setIsSubmittingChallan(false);
    }
  };

  // --- EDIT PENDING CHALLAN HANDLERS ---
  const handleOpenEditChallan = async (challanObj) => {
    setEditingChallan(challanObj);
    setEditFromBranchId(challanObj.from_branch_id || '');
    setEditToBranchId(challanObj.to_branch_id || '');
    setEditChallanDate(challanObj.challan_date || new Date().toISOString().split('T')[0]);
    setEditVehicleNo(challanObj.vehicle_no || '');
    setEditDriverName(challanObj.driver_name || '');
    setEditNotes(getChallanCleanNotes(challanObj));
    const disc = getChallanDiscount(challanObj);
    setEditChallanDiscount(disc > 0 ? disc : '');

    try {
      let items = challanObj.items || [];
      if (items.length === 0) {
        const { data: fetchedItems, error: fErr } = await supabase
          .from('branch_challan_items')
          .select('*')
          .eq('challan_id', challanObj.id);
        if (fErr) throw fErr;
        items = fetchedItems || [];
      }

      const formatted = items.map((it) => ({
        id: it.id,
        productId: it.product_id,
        quantity: it.dispatched_qty || 1,
        unitPrice: it.unit_transfer_price || 0,
        totalPrice: it.total_price || 0,
      }));

      setEditChallanItems(
        formatted.length > 0 ? formatted : [{ productId: '', quantity: 1, unitPrice: 0.00, totalPrice: 0.00 }]
      );
      setShowEditChallanModal(true);
    } catch (err) {
      console.error('Error fetching items for edit:', err);
      showMessage('Failed to load challan items.', 'error');
    }
  };

  const addEditChallanItemRow = () => {
    setEditChallanItems([...editChallanItems, { productId: '', quantity: 1, unitPrice: 0.00, totalPrice: 0.00 }]);
  };

  const removeEditChallanItemRow = (index) => {
    if (editChallanItems.length <= 1) return;
    setEditChallanItems(editChallanItems.filter((_, idx) => idx !== index));
  };

  const updateEditChallanItemRow = (index, field, value) => {
    const updated = [...editChallanItems];
    const row = { ...updated[index] };

    if (field === 'productId') {
      row.productId = value;
      const matchedProd = catalogProducts.find((p) => p.id === value);
      if (matchedProd) {
        row.unitPrice = parseFloat(matchedProd.sale_price) || parseFloat(matchedProd.purchase_price) || 0;
      }
    } else if (field === 'quantity') {
      row.quantity = value;
    } else if (field === 'unitPrice') {
      row.unitPrice = value;
    }

    const qty = parseInt(row.quantity) || 0;
    const price = parseFloat(row.unitPrice) || 0;
    row.totalPrice = qty * price;
    updated[index] = row;
    setEditChallanItems(updated);
  };

  const getEditChallanSubtotal = () => {
    return editChallanItems.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
  };

  const getEditChallanGrandTotal = () => {
    const sub = getEditChallanSubtotal();
    const disc = parseFloat(editChallanDiscount) || 0;
    return Math.max(0, sub - disc);
  };

  const handleSaveEditChallan = async (e) => {
    e.preventDefault();
    if (!editingChallan) return;

    const validItems = editChallanItems.filter((it) => it.productId && (parseInt(it.quantity) || 0) > 0);
    if (validItems.length === 0) {
      showMessage('Please add at least one product with valid quantity.', 'error');
      return;
    }

    setIsSavingEditChallan(true);
    try {
      const subtotal = getEditChallanSubtotal();
      const disc = parseFloat(editChallanDiscount) || 0;
      const grandTotal = Math.max(0, subtotal - disc);
      const cleanUserNotes = editNotes.trim();

      // 1. Update Challan Header
      const { error: updErr } = await supabase
        .from('branch_challans')
        .update({
          from_branch_id: editFromBranchId,
          to_branch_id: editToBranchId,
          total_bill_amount: grandTotal,
          discount: disc,
          status: editingChallan.status || 'pending',
          due_amount: Math.max(0, grandTotal - (parseFloat(editingChallan.paid_amount) || 0)),
          challan_date: editChallanDate,
          vehicle_no: editVehicleNo.trim() || null,
          driver_name: editDriverName.trim() || null,
          notes: cleanUserNotes || null,
        })
        .eq('id', editingChallan.id);

      if (updErr) throw updErr;

      // 2. Replace Line Items in database
      await supabase.from('branch_challan_items').delete().eq('challan_id', editingChallan.id);

      const itemsPayload = validItems.map((it) => {
        const q = parseInt(it.quantity) || 0;
        const p = parseFloat(it.unitPrice) || 0;
        return {
          challan_id: editingChallan.id,
          product_id: it.productId,
          dispatched_qty: q,
          sold_qty: 0,
          remaining_qty: q,
          unit_transfer_price: p,
          total_price: q * p,
        };
      });

      const { error: itemsErr } = await supabase.from('branch_challan_items').insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      showMessage(`Challan #${editingChallan.challan_no} updated successfully!`, 'success');
      setShowEditChallanModal(false);
      setEditingChallan(null);
      fetchChallans();
    } catch (err) {
      console.error('Error updating challan:', err);
      showMessage(err.message || 'Failed to update challan.', 'error');
    } finally {
      setIsSavingEditChallan(false);
    }
  };

  // Factory / Owner Action: Approve Pending Challan Requisition
  const handleApproveChallan = async (challanObj) => {
    if (!isOwner && role !== 'factory_manager' && !activeBranchObj?.is_factory) {
      showMessage('Only Factory Managers or Owners can approve challans.', 'error');
      return;
    }

    const confirm = window.confirm(
      `Approve and dispatch Challan #${challanObj.challan_no} to "${challanObj.to_branch?.name || 'Branch'}"?\nThis will credit the items to their inventory and auto-approve any submitted payments.`
    );
    if (!confirm) return;

    setLoading(true);
    try {
      // 1. Fetch line items if not loaded
      let items = challanObj.items || [];
      if (items.length === 0) {
        const { data: fetchedItems, error: fErr } = await supabase
          .from('branch_challan_items')
          .select('*')
          .eq('challan_id', challanObj.id);
        if (fErr) throw fErr;
        items = fetchedItems || [];
      }

      // 2. Increment Destination Branch Inventory
      for (const it of items) {
        const q = parseInt(it.dispatched_qty) || 0;
        if (q > 0) {
          const { data: existingInv } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('branch_id', challanObj.to_branch_id)
            .eq('product_id', it.product_id)
            .maybeSingle();

          if (existingInv) {
            await supabase
              .from('inventory')
              .update({ quantity: (existingInv.quantity || 0) + q })
              .eq('id', existingInv.id);
          } else {
            await supabase
              .from('inventory')
              .insert([{ branch_id: challanObj.to_branch_id, product_id: it.product_id, quantity: q }]);
          }
        }
      }

      // 3. Auto-Approve any pending payments attached to this challan
      const { data: pendingPaymentsForChallan } = await supabase
        .from('branch_payments')
        .select('*')
        .eq('challan_id', challanObj.id)
        .eq('status', 'pending');

      let approvedPaymentSum = 0;
      if (pendingPaymentsForChallan && pendingPaymentsForChallan.length > 0) {
        approvedPaymentSum = pendingPaymentsForChallan.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        await supabase
          .from('branch_payments')
          .update({
            status: 'approved',
            approved_by: userProfile?.id,
            approved_at: new Date().toISOString(),
          })
          .eq('challan_id', challanObj.id)
          .eq('status', 'pending');

        // Credit factory cash ledger for auto-approved payments
        for (const p of pendingPaymentsForChallan) {
          await supabase.from('cash_ledger').insert([
            {
              branch_id: challanObj.from_branch_id || selectedBranchId,
              amount_in: parseFloat(p.amount) || 0,
              amount_out: 0,
              reference_id: challanObj.id,
              description: `Settlement Approved: Challan #${challanObj.challan_no} from ${challanObj.to_branch?.name || 'Branch'} (${p.payment_method})`,
              transaction_date: p.payment_date ? new Date(p.payment_date).toISOString() : new Date().toISOString(),
              created_by: userProfile?.id,
            },
          ]);
        }
      }

      const totalBill = parseFloat(challanObj.total_bill_amount) || 0;
      const currentPaid = parseFloat(challanObj.paid_amount) || 0;
      const newPaid = currentPaid + approvedPaymentSum;
      const newDue = Math.max(0, totalBill - newPaid);
      const newPaymentStatus = newDue <= 0.01 && totalBill > 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');

      // 4. Update Challan status and paid/due amounts
      const cleanNotes = getChallanCleanNotes(challanObj);
      const { error: updErr } = await supabase
        .from('branch_challans')
        .update({
          status: 'approved',
          notes: cleanNotes || null,
          paid_amount: newPaid,
          due_amount: newDue,
          payment_status: newPaymentStatus,
        })
        .eq('id', challanObj.id);

      if (updErr) throw updErr;

      showMessage(`Challan #${challanObj.challan_no} approved & payments auto-confirmed!`, 'success');
      fetchChallans();
      fetchBranchPayments();
    } catch (err) {
      console.error('Error approving challan:', err);
      showMessage(err.message || 'Failed to approve challan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Factory / Owner Action: Open Reject Modal for Challan
  const handleOpenRejectChallanModal = (challanObj) => {
    setSelectedChallanForReject(challanObj);
    setChallanRejectionReason('');
    setShowRejectChallanModal(true);
  };

  // Factory / Owner Action: Confirm Rejection of Challan
  const handleConfirmRejectChallan = async (e) => {
    e.preventDefault();
    if (!selectedChallanForReject) return;

    setLoading(true);
    try {
      const cleanNotes = getChallanCleanNotes(selectedChallanForReject);
      const reasonText = challanRejectionReason.trim();

      const { error: rejErr } = await supabase
        .from('branch_challans')
        .update({
          status: 'rejected',
          notes: reasonText ? `${reasonText}${cleanNotes ? ` - ${cleanNotes}` : ''}` : (cleanNotes || null),
        })
        .eq('id', selectedChallanForReject.id);

      if (rejErr) throw rejErr;

      showMessage(`Challan #${selectedChallanForReject.challan_no} marked as rejected.`, 'info');
      setShowRejectChallanModal(false);
      setSelectedChallanForReject(null);
      fetchChallans();
    } catch (err) {
      console.error('Error rejecting challan:', err);
      showMessage(err.message || 'Failed to reject challan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetChallanForm = () => {
    setToBranchId('');
    setChallanDate(new Date().toISOString().split('T')[0]);
    setVehicleNo('');
    setDriverName('');
    setNotes('');
    setChallanDiscount('');
    setChallanItems([{ productId: '', quantity: 1, unitPrice: 0.00, totalPrice: 0.00 }]);
  };

  // Open Payment / Submission Modal
  const handleOpenPaymentModal = (challan) => {
    setActiveChallan(challan);
    setPayAmount(formatPlainNumber(parseFloat(challan.due_amount) || 0));
    setPayMethod('cash');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayReference('');
    setPayNotes('');
    setShowPaymentModal(true);
  };

  // Open Payment History Modal for a specific challan
  const handleOpenPaymentHistory = (challan) => {
    setActiveChallan(challan);
    fetchBranchPayments();
    setShowPaymentHistoryModal(true);
  };

  // Submit Payment (Branch submits request ➔ Owner directly approves)
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!activeChallan) return;

    const amountNum = parseFloat(payAmount) || 0;
    const currentDue = parseFloat(activeChallan.due_amount) || 0;

    if (amountNum <= 0) {
      showMessage('Please enter a valid payment amount.', 'error');
      return;
    }
    if (amountNum > currentDue + 0.01) {
      showMessage(`Payment amount cannot exceed the remaining due of ৳${formatAmount(currentDue)}.`, 'error');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const paymentNo = `PAY-${Date.now().toString().slice(-6)}`;
      const targetBranchId = activeChallan.to_branch_id;
      const initialStatus = isOwner ? 'approved' : 'pending';

      // 1. Insert into branch_payments audit table
      const paymentPayload = {
        payment_no: paymentNo,
        branch_id: targetBranchId,
        challan_id: activeChallan.id,
        amount: amountNum,
        payment_method: payMethod,
        payment_date: payDate,
        reference_number: payReference.trim() || null,
        notes: payNotes.trim() || `Payment for Challan #${activeChallan.challan_no}`,
        status: initialStatus,
        submitted_by: userProfile?.id,
        approved_by: isOwner ? userProfile?.id : null,
        approved_at: isOwner ? new Date().toISOString() : null,
      };

      const { error: bpErr } = await supabase.from('branch_payments').insert([paymentPayload]);
      if (bpErr) throw bpErr;

      if (isOwner) {
        // If Owner entered it, credit Factory cash ledger & deduct challan due immediately
        await applyApprovedPayment(activeChallan, amountNum, payMethod, payDate);
        showMessage(`Payment of ৳${formatAmount(amountNum)} recorded & settled directly!`, 'success');
      } else {
        // If Branch submitted it, it stays pending until Owner approves
        showMessage(`Payment request of ৳${formatAmount(amountNum)} submitted! Awaiting Owner verification.`, 'success');
      }

      setShowPaymentModal(false);
      fetchChallans();
      fetchBranchPayments();
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Failed to submit payment.', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Helper to apply approved payment to Challan and Cash Ledger
  const applyApprovedPayment = async (challanObj, amountNum, method, date) => {
    // 1. Insert into cash_ledger for Factory Cash/Bank Balance
    await supabase.from('cash_ledger').insert([
      {
        branch_id: challanObj.from_branch_id || selectedBranchId,
        amount_in: amountNum,
        amount_out: 0,
        reference_id: challanObj.id,
        description: `Settlement Approved: Challan #${challanObj.challan_no} from ${challanObj.to_branch?.name || 'Branch'} (${method})`,
        transaction_date: new Date(date).toISOString(),
        created_by: userProfile?.id,
      },
    ]);

    // 2. Update branch_challans Due & Status
    const currentPaid = parseFloat(challanObj.paid_amount) || 0;
    const totalBill = parseFloat(challanObj.total_bill_amount) || 0;
    const newPaid = currentPaid + amountNum;
    const newDue = Math.max(0, totalBill - newPaid);
    const newStatus = newDue <= 0.01 ? 'paid' : 'partial';

    await supabase
      .from('branch_challans')
      .update({
        paid_amount: newPaid,
        due_amount: newDue,
        payment_status: newStatus,
      })
      .eq('id', challanObj.id);
  };

  // Owner Action: Approve Pending Payment Request
  const handleApprovePaymentRequest = async (payment) => {
    if (!isOwner) return;

    try {
      const { data: targetChallan, error: chErr } = await supabase
        .from('branch_challans')
        .select(`
          *,
          from_branch:branches!branch_challans_from_branch_id_fkey (id, name, is_factory),
          to_branch:branches!branch_challans_to_branch_id_fkey (id, name, is_factory)
        `)
        .eq('id', payment.challan_id)
        .single();

      if (chErr) throw chErr;

      // 1. Apply payment settlement
      await applyApprovedPayment(
        targetChallan,
        parseFloat(payment.amount),
        payment.payment_method,
        payment.payment_date
      );

      // 2. Update branch_payments status to 'approved'
      const { error: payUpdateErr } = await supabase
        .from('branch_payments')
        .update({
          status: 'approved',
          approved_by: userProfile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      if (payUpdateErr) throw payUpdateErr;

      showMessage(`Payment #${payment.payment_no} (৳${formatAmount(payment.amount)}) approved & credited to Factory!`, 'success');
      fetchChallans();
      fetchBranchPayments();
    } catch (err) {
      console.error(err);
      showMessage('Failed to approve payment request.', 'error');
    }
  };

  // Owner Action: Open Reject Modal
  const handleOpenRejectModal = (payment) => {
    setSelectedPaymentForAction(payment);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  // Owner Action: Confirm Rejection
  const handleConfirmRejection = async (e) => {
    e.preventDefault();
    if (!selectedPaymentForAction) return;

    try {
      const { error } = await supabase
        .from('branch_payments')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim() || 'Payment not verified / funds not received.',
          approved_by: userProfile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', selectedPaymentForAction.id);

      if (error) throw error;

      showMessage(`Payment #${selectedPaymentForAction.payment_no} rejected.`, 'info');
      setShowRejectModal(false);
      setSelectedPaymentForAction(null);
      fetchBranchPayments();
    } catch (err) {
      console.error(err);
      showMessage('Failed to reject payment request.', 'error');
    }
  };

  const handlePrint = (challan) => {
    setActiveChallan(challan);
    setShowPrintModal(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* TOP BAR */}
      <div className="no-print top-bar">
        <div className="page-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={22} style={{ color: 'var(--primary)' }} />
            <h1 style={{ margin: 0 }}>Branch Challans</h1>
          </div>
        </div>

        <div className="top-bar-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isOwner ? (
            branches.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Branch:</span>
                <select
                  className="input-control"
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  style={{ width: '180px', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
                >
                  <option value="all">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.is_factory ? `🏭 ${b.name}` : `🏪 ${b.name}`}
                    </option>
                  ))}
                </select>
              </div>
            )
          ) : (
            <span
              className="badge"
              style={{
                backgroundColor: '#e0f2fe',
                color: '#0369a1',
                border: '1px solid #bae6fd',
                fontSize: '0.82rem',
                fontWeight: 600,
                padding: '0.4rem 0.75rem',
              }}
            >
              🏪 {branches.find((b) => b.id === myBranchId)?.name || 'My Branch'}
            </span>
          )}

          <button 
            className="btn btn-primary" 
            onClick={() => {
              resetChallanForm();
              const destBranchId = !isOwner ? myBranchId : (activeBranchObj && !activeBranchObj.is_factory ? activeBranchObj.id : '');
              if (destBranchId) {
                setToBranchId(destBranchId);
              }
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} />
            <span>Create Challan</span>
          </button>
        </div>
      </div>

      {/* PENDING CHALLANS APPROVAL BANNER (For Owner / Factory) */}
      {(isOwner || isFactoryPerspective) && pendingChallans.length > 0 && (
        <div
          className="no-print"
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 'var(--border-radius)',
            padding: '0.85rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                backgroundColor: '#fef3c7',
                color: '#d97706',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Truck size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#92400e' }}>
                {pendingChallans.length} Challan {pendingChallans.length === 1 ? 'Request' : 'Requests'} Awaiting Approval
              </div>
              <div style={{ fontSize: '0.78rem', color: '#b45309' }}>
                Branches created challans totaling ৳{formatAmount(pendingChallans.reduce((s, c) => s + (parseFloat(c.total_bill_amount) || 0), 0))}.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setStatusFilter('pending')}
            style={{ backgroundColor: '#d97706', borderColor: '#b45309' }}
          >
            <span>Review Pending Challans ({pendingChallans.length})</span>
          </button>
        </div>
      )}

      {/* PENDING PAYMENT APPROVAL BANNER (For Owner when requests exist) */}
      {isOwner && pendingPayments.length > 0 && (
        <div
          className="no-print"
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 'var(--border-radius)',
            padding: '0.85rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                backgroundColor: '#dcfce7',
                color: '#16a34a',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#166534' }}>
                {pendingPayments.length} Payment {pendingPayments.length === 1 ? 'Request' : 'Requests'} Pending Approval
              </div>
              <div style={{ fontSize: '0.78rem', color: '#15803d' }}>
                Total ৳{formatAmount(pendingPayments.reduce((s, p) => s + parseFloat(p.amount), 0))} submitted by branches.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              const firstPending = pendingPayments[0];
              const targetCh = challans.find((c) => c.id === firstPending?.challan_id);
              if (targetCh) handleOpenPaymentHistory(targetCh);
            }}
            style={{ backgroundColor: '#16a34a', borderColor: '#15803d' }}
          >
            <span>Review Payments ({pendingPayments.length})</span>
          </button>
        </div>
      )}

      {/* KPI METRIC CARDS (Clear & Compact) */}
      <div
        className="no-print"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.45rem',
        }}
      >
        {/* Total Consignment */}
        <div className="card" style={{ padding: '0.55rem 0.75rem', borderLeft: '3.5px solid #2563eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {isFactoryPerspective ? 'Total Sent' : 'Consignment'}
            </span>
            <span className="badge badge-info" style={{ fontSize: '0.6rem', padding: '0.05rem 0.3rem' }}>
              {challans.length} Ch.
            </span>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', fontFamily: 'Outfit, sans-serif', marginTop: '0.15rem' }}>
            ৳{formatAmount(totalDispatchedValue)}
          </div>
        </div>

        {/* Total Sold */}
        <div className="card" style={{ padding: '0.55rem 0.75rem', borderLeft: '3.5px solid #16a34a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Total Sold
            </span>
            <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '0.05rem 0.3rem' }}>
              {totalDispatchedQty > 0 ? `${((totalSoldQty / totalDispatchedQty) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#16a34a', fontFamily: 'Outfit, sans-serif', marginTop: '0.15rem' }}>
            {formatAmount(totalSoldQty)} <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>/ {formatAmount(totalDispatchedQty)}</span>
          </div>
        </div>

        {/* Total Paid / Received */}
        <div className="card" style={{ padding: '0.55rem 0.75rem', borderLeft: '3.5px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {isFactoryPerspective ? 'Received' : 'Total Paid'}
            </span>
            <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '0.05rem 0.3rem' }}>
              Settled
            </span>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#059669', fontFamily: 'Outfit, sans-serif', marginTop: '0.15rem' }}>
            ৳{formatAmount(totalPaidValue)}
          </div>
        </div>

        {/* Total Due */}
        <div className="card" style={{ padding: '0.55rem 0.75rem', borderLeft: `3.5px solid ${totalDueValue > 0 ? '#ef4444' : '#10b981'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {isFactoryPerspective ? 'Receivable' : 'Payable'}
            </span>
            <span className={`badge badge-${totalDueValue > 0 ? 'danger' : 'success'}`} style={{ fontSize: '0.6rem', padding: '0.05rem 0.3rem' }}>
              {totalDueValue > 0 ? 'Due' : 'Clear'}
            </span>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: totalDueValue > 0 ? '#dc2626' : '#059669', fontFamily: 'Outfit, sans-serif', marginTop: '0.15rem' }}>
            ৳{formatAmount(totalDueValue)}
          </div>
        </div>
      </div>

      {/* CHALLANS LIST TABLE (Direct, No Tabs) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Search & Filter bar */}
        <div
          className="no-print card"
          style={{ padding: '0.75rem 1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="input-control"
              style={{ paddingLeft: '2.4rem' }}
              placeholder="Search by Challan #, Branch, Product, Driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: 'var(--bg-app)', padding: '0.25rem', borderRadius: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'pending', label: `Pending (${pendingChallans.length})`, highlight: pendingChallans.length > 0 },
              { id: 'approved', label: 'Dispatched' },
              { id: 'unpaid', label: 'Unpaid' },
              { id: 'partial', label: 'Partial' },
              { id: 'paid', label: 'Paid' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ 
                  padding: '0.3rem 0.65rem', 
                  fontSize: '0.78rem',
                  backgroundColor: statusFilter === tab.id ? undefined : (tab.highlight ? '#fef3c7' : undefined),
                  color: statusFilter === tab.id ? undefined : (tab.highlight ? '#92400e' : undefined),
                  borderColor: tab.highlight ? '#fde68a' : undefined
                }}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* TABLE */}
        <div className="no-print table-container card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>SL</th>
                <th>Challan # & Date</th>
                <th>Branch</th>
                <th>Items</th>
                <th>Sold / Total Qty</th>
                <th style={{ textAlign: 'right' }}>Total Bill</th>
                <th style={{ textAlign: 'right' }}>Discount</th>
                <th style={{ textAlign: 'right' }}>{isFactoryPerspective ? 'Received' : 'Paid'}</th>
                <th style={{ textAlign: 'right' }}>{isFactoryPerspective ? 'Receivable' : 'Due'}</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ width: '220px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoading colSpan={11} message="Loading branch challans..." />
              ) : filteredChallans.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No challans found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredChallans.map((ch, idx) => {
                  const totalBill = parseFloat(ch.total_bill_amount) || 0;
                  const paid = parseFloat(ch.paid_amount) || 0;
                  const due = parseFloat(ch.due_amount) || 0;
                  const discountVal = getChallanDiscount(ch);

                  const itemsCount = (ch.items || []).length;
                  const totalQty = (ch.items || []).reduce((s, it) => s + (it.dispatched_qty || 0), 0);
                  const soldQty = (ch.items || []).reduce((s, it) => s + (it.sold_qty || 0), 0);
                  const isPaid = ch.payment_status === 'paid' || due <= 0.01;

                  const challanStatus = getChallanStatus(ch);
                  const isPending = challanStatus === 'pending';
                  const isRejected = challanStatus === 'rejected';
                  const rejectionReasonText = getChallanRejectionReason(ch);

                  // Check if there are payments submitted for this challan
                  const paymentsForChallan = branchPayments.filter((p) => p.challan_id === ch.id);
                  const pendingForChallan = paymentsForChallan.filter((p) => p.status === 'pending');
                  const pendingAmount = pendingForChallan.reduce((s, p) => s + parseFloat(p.amount), 0);

                  return (
                    <tr key={ch.id}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)', fontSize: '0.85rem' }}>
                          {ch.challan_no}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {new Date(ch.challan_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>🏪 {ch.to_branch?.name || 'Branch'}</div>
                        {ch.vehicle_no && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            🚛 {ch.vehicle_no} {ch.driver_name ? `• ${ch.driver_name}` : ''}
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setActiveChallan(ch);
                            setShowDetailModal(true);
                          }}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          <Layers size={13} />
                          <span>
                            {itemsCount} {itemsCount === 1 ? 'Product' : 'Products'} ({totalQty} pcs)
                          </span>
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '100px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                            <span style={{ color: '#16a34a' }}>{soldQty} sold</span>
                            <span style={{ color: 'var(--text-muted)' }}>{Math.max(0, totalQty - soldQty)} left</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: totalQty > 0 ? `${Math.min(100, (soldQty / totalQty) * 100)}%` : '0%',
                                height: '100%',
                                backgroundColor: '#16a34a',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                        ৳{formatAmount(totalBill)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: discountVal > 0 ? '#dc2626' : 'var(--text-muted)', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem' }}>
                        {discountVal > 0 ? `-৳${formatAmount(discountVal)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: '#059669', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                        ৳{formatAmount(paid)}
                      </td>
                      <td style={{ textAlign: 'right', color: due > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                        ৳{formatAmount(due)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isPending ? (
                          <span 
                            className="badge badge-warning" 
                            style={{ 
                              backgroundColor: '#fef3c7', 
                              color: '#b45309', 
                              border: '1px solid #fde68a', 
                              fontSize: '0.72rem', 
                              fontWeight: 700 
                            }}
                          >
                            ⏳ Pending Approval
                          </span>
                        ) : isRejected ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                            <span 
                              className="badge badge-danger" 
                              style={{ 
                                backgroundColor: '#fee2e2', 
                                color: '#991b1b', 
                                border: '1px solid #fca5a5', 
                                fontSize: '0.72rem', 
                                fontWeight: 700 
                              }}
                            >
                              ✕ Rejected
                            </span>
                            {rejectionReasonText && (
                              <span style={{ fontSize: '0.66rem', color: '#991b1b', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rejectionReasonText}>
                                {rejectionReasonText}
                              </span>
                            )}
                          </div>
                        ) : isPaid ? (
                          <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                            Paid
                          </span>
                        ) : paid > 0 ? (
                          <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                            Partial
                          </span>
                        ) : (
                          <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>
                            Unpaid
                          </span>
                        )}

                        {!isPending && !isRejected && pendingAmount > 0 && (
                          <div style={{ marginTop: '0.2rem' }}>
                            <span
                              className="badge"
                              style={{
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                fontSize: '0.68rem',
                                border: '1px solid #fde68a',
                              }}
                            >
                              ⏳ ৳{formatAmount(pendingAmount)} Pending
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
                          {/* If Challan is Pending Approval */}
                          {isPending && (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenEditChallan(ch)}
                                style={{ color: '#2563eb', borderColor: '#bfdbfe', backgroundColor: '#eff6ff', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                title="Edit Pending Challan"
                              >
                                <Edit size={13} />
                                <span>Edit</span>
                              </button>
                              {(isOwner || isFactoryPerspective || role === 'factory_manager') ? (
                                <div style={{ display: 'inline-flex', gap: '0.3rem' }}>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleApproveChallan(ch)}
                                    style={{ backgroundColor: '#16a34a', borderColor: '#15803d', padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                                    title="Approve Challan & Dispatch Stock"
                                  >
                                    <Check size={14} />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleOpenRejectChallanModal(ch)}
                                    style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '0.25rem 0.45rem', fontSize: '0.75rem' }}
                                    title="Reject Challan"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <span 
                                  className="badge" 
                                  style={{ 
                                    backgroundColor: '#f1f5f9', 
                                    color: '#64748b', 
                                    fontSize: '0.72rem',
                                    border: '1px solid #e2e8f0',
                                    padding: '0.25rem 0.5rem'
                                  }}
                                >
                                  Awaiting Factory
                                </span>
                              )}
                            </>
                          )}

                          {/* Payment Button (Available for Pending & Approved challans before full payment) */}
                          {!isRejected && !isPaid && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm btn-icon"
                              onClick={() => handleOpenPaymentModal(ch)}
                              title={isFactoryPerspective ? 'Record Payment Settlement' : 'Submit Payment'}
                              style={{ padding: '0.35rem 0.45rem' }}
                            >
                              <CreditCard size={15} />
                            </button>
                          )}

                          {/* Payment History & Approve Action */}
                          {!isRejected && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm btn-icon"
                              onClick={() => handleOpenPaymentHistory(ch)}
                              title="Payment History & Approvals"
                              style={{
                                padding: '0.35rem 0.45rem',
                                position: 'relative',
                                borderColor: pendingForChallan.length > 0 ? '#f59e0b' : 'var(--border-color)',
                                backgroundColor: pendingForChallan.length > 0 ? '#fffbeb' : undefined,
                              }}
                            >
                              <History size={15} style={{ color: pendingForChallan.length > 0 ? '#d97706' : '#0284c7' }} />
                              {pendingForChallan.length > 0 && (
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: '-4px',
                                    right: '-4px',
                                    backgroundColor: '#dc2626',
                                    color: '#ffffff',
                                    borderRadius: '50%',
                                    width: '14px',
                                    height: '14px',
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {pendingForChallan.length}
                                </span>
                              )}
                            </button>
                          )}

                          {/* Print Challan */}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => handlePrint(ch)}
                            title="Print Delivery Challan"
                            style={{ color: '#334155', padding: '0.35rem 0.45rem' }}
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

      {/* PAYMENT HISTORY & APPROVAL MODAL */}
      {showPaymentHistoryModal && activeChallan && (() => {
        const currentChallan = challans.find((c) => c.id === activeChallan.id) || activeChallan;
        const currentPayments = branchPayments.filter((p) => p.challan_id === currentChallan.id);
        const totalBill = parseFloat(currentChallan.total_bill_amount) || 0;
        const paid = parseFloat(currentChallan.paid_amount) || 0;
        const due = parseFloat(currentChallan.due_amount) || 0;
        const isFullyPaid = currentChallan.payment_status === 'paid' || due <= 0.01;

        return (
          <div className="modal-overlay">
            <div className="modal-content modal-lg" style={{ maxWidth: '780px', width: '100%' }}>
              <div className="modal-header">
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <History size={18} />
                  <span>Payments — Challan #{currentChallan.challan_no}</span>
                </h3>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowPaymentHistoryModal(false)}
                  style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Summary Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '0.75rem',
                    backgroundColor: '#f8fafc',
                    padding: '0.85rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Branch</div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>🏪 {currentChallan.to_branch?.name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Bill</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'Outfit, sans-serif' }}>
                      ৳{formatAmount(totalBill)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Paid to Factory</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#059669', fontFamily: 'Outfit, sans-serif' }}>
                      ৳{formatAmount(paid)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Remaining Due</div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '1rem',
                        color: due > 0 ? '#dc2626' : '#059669',
                        fontFamily: 'Outfit, sans-serif',
                      }}
                    >
                      ৳{formatAmount(due)}
                    </div>
                  </div>
                </div>

                {/* Payments Table */}
                <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                        <th>Payment #</th>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Ref / Trx ID</th>
                        <th style={{ textAlign: 'right' }}>Amount (৳)</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th>Notes</th>
                        {isOwner && <th style={{ textAlign: 'center', width: '140px' }}>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {currentPayments.length === 0 ? (
                        <tr>
                          <td colSpan={isOwner ? 9 : 8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                            No payments recorded for this challan yet.
                          </td>
                        </tr>
                      ) : (
                        currentPayments.map((p, idx) => {
                          const st = p.status || 'pending';
                          return (
                            <tr key={p.id}>
                              <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                              <td style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)', fontSize: '0.82rem' }}>
                                {p.payment_no}
                              </td>
                              <td style={{ fontSize: '0.82rem' }}>{new Date(p.payment_date).toLocaleDateString()}</td>
                              <td>
                                <span style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}>
                                  {p.payment_method === 'cash' ? '💵 Cash' : p.payment_method === 'bank' ? '🏦 Bank' : '📱 Mobile'}
                                </span>
                              </td>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.reference_number || '-'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'Outfit, sans-serif', fontSize: '0.92rem' }}>
                                ৳{formatAmount(p.amount)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {st === 'approved' ? (
                                  <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                                    Approved
                                  </span>
                                ) : st === 'rejected' ? (
                                  <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>
                                    Rejected
                                  </span>
                                ) : (
                                  <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                                    Pending
                                  </span>
                                )}
                              </td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '140px' }}>
                                {st === 'rejected' ? `Reason: ${p.rejection_reason || 'Discrepancy'}` : p.notes || '-'}
                              </td>
                              {isOwner && (
                                <td style={{ textAlign: 'center' }}>
                                  {st === 'pending' ? (
                                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                                      <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleApprovePaymentRequest(p)}
                                        style={{ backgroundColor: '#16a34a', borderColor: '#15803d', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                        title="Approve & deduct due"
                                      >
                                        <CheckCircle2 size={13} />
                                        <span>Approve</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleOpenRejectModal(p)}
                                        style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                        title="Reject request"
                                      >
                                        <XCircle size={13} />
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <div>
                  {!isFullyPaid && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setShowPaymentHistoryModal(false);
                        handleOpenPaymentModal(currentChallan);
                      }}
                      style={{ fontSize: '0.85rem' }}
                    >
                      <CreditCard size={15} />
                      <span>{isOwner ? 'Take Payment' : 'Submit Payment'}</span>
                    </button>
                  )}
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentHistoryModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CREATE DELIVERY CHALLAN MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg" style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Truck size={18} />
                <span>Create Challan</span>
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(false)} style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateChallan} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Branch Routing Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>From *</label>
                    <select
                      className="input-control"
                      value={fromBranchId}
                      onChange={(e) => setFromBranchId(e.target.value)}
                      required
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.is_factory ? `🏭 ${b.name}` : `🏪 ${b.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>To Branch *</label>
                    <select
                      className="input-control"
                      value={toBranchId}
                      onChange={(e) => setToBranchId(e.target.value)}
                      required
                    >
                      <option value="">-- Select Branch --</option>
                      {branches
                        .filter((b) => b.id !== fromBranchId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            🏪 {b.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Date & Transport Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Date *</label>
                    <input
                      type="date"
                      className="input-control"
                      value={challanDate}
                      onChange={(e) => setChallanDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Vehicle No</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Vehicle number"
                      value={vehicleNo}
                      onChange={(e) => setVehicleNo(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Driver Info</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Driver name and phone"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Product Items Table */}
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontWeight: 700, fontSize: '0.85rem' }}>Products *</label>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow} style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}>
                      <Plus size={13} />
                      <span>Add Product</span>
                    </button>
                  </div>

                  <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '30px', textAlign: 'center' }}>#</th>
                          <th>Product *</th>
                          <th style={{ width: '90px', textAlign: 'right' }}>Qty *</th>
                          <th style={{ width: '120px', textAlign: 'right' }}>Price (৳)</th>
                          <th style={{ width: '120px', textAlign: 'right' }}>Total (৳)</th>
                          <th style={{ width: '35px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {challanItems.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td>
                              <select
                                className="input-control"
                                value={item.productId}
                                onChange={(e) => updateItemRow(idx, 'productId', e.target.value)}
                                required
                                style={{ fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
                              >
                                <option value="">-- Select Product --</option>
                                {catalogProducts.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.sku} - {p.name} {p.category ? `[${p.category}]` : ''}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                className="input-control"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateItemRow(idx, 'quantity', e.target.value)}
                                style={{ textAlign: 'right', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                className="input-control"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => updateItemRow(idx, 'unitPrice', e.target.value)}
                                style={{ textAlign: 'right', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
                                required
                              />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                              ৳{formatAmount(item.totalPrice)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {challanItems.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => removeItemRow(idx)}
                                  style={{ padding: '0.2rem 0.4rem', border: 'none', color: 'var(--danger)' }}
                                >
                                  ✕
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Discount & Grand Total Bar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      marginTop: '0.75rem',
                      padding: '0.65rem 1rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Discount (৳):</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={getNewChallanSubtotal()}
                        className="input-control"
                        placeholder="0.00"
                        value={challanDiscount}
                        onChange={(e) => setChallanDiscount(e.target.value)}
                        style={{ width: '110px', fontSize: '0.85rem', padding: '0.25rem 0.5rem', textAlign: 'right' }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      {parseFloat(challanDiscount) > 0 && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Subtotal: ৳{formatAmount(getNewChallanSubtotal())}
                        </span>
                      )}
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Total Amount:</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'Outfit, sans-serif' }}>
                        ৳{formatAmount(getNewChallanGrandTotal())}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Notes</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Enter notes (optional)..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingChallan}>
                  {isSubmittingChallan ? 'Saving...' : 'Save Challan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CHALLAN MODAL (AVAILABLE BEFORE APPROVAL) */}
      {showEditChallanModal && editingChallan && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg" style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit size={18} />
                <span>Edit Pending Challan ({editingChallan.challan_no})</span>
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEditChallanModal(false)} style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditChallan} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Branch Routing Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>From *</label>
                    <select
                      className="input-control"
                      value={editFromBranchId}
                      onChange={(e) => setEditFromBranchId(e.target.value)}
                      required
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.is_factory ? `🏭 ${b.name}` : `🏪 ${b.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>To Branch *</label>
                    <select
                      className="input-control"
                      value={editToBranchId}
                      onChange={(e) => setEditToBranchId(e.target.value)}
                      required
                    >
                      <option value="">-- Select Branch --</option>
                      {branches
                        .filter((b) => b.id !== editFromBranchId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            🏪 {b.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Date & Transport Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Date *</label>
                    <input
                      type="date"
                      className="input-control"
                      value={editChallanDate}
                      onChange={(e) => setEditChallanDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Vehicle No</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Vehicle number"
                      value={editVehicleNo}
                      onChange={(e) => setEditVehicleNo(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Driver Info</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Driver name and phone"
                      value={editDriverName}
                      onChange={(e) => setEditDriverName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Product Items Table */}
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontWeight: 700, fontSize: '0.85rem' }}>Products *</label>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addEditChallanItemRow} style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}>
                      <Plus size={13} />
                      <span>Add Product</span>
                    </button>
                  </div>

                  <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '30px', textAlign: 'center' }}>#</th>
                          <th>Product *</th>
                          <th style={{ width: '90px', textAlign: 'right' }}>Qty *</th>
                          <th style={{ width: '120px', textAlign: 'right' }}>Price (৳)</th>
                          <th style={{ width: '120px', textAlign: 'right' }}>Total (৳)</th>
                          <th style={{ width: '35px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editChallanItems.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td>
                              <select
                                className="input-control"
                                value={item.productId}
                                onChange={(e) => updateEditChallanItemRow(idx, 'productId', e.target.value)}
                                required
                                style={{ fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
                              >
                                <option value="">-- Select Product --</option>
                                {catalogProducts.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.sku} - {p.name} {p.category ? `[${p.category}]` : ''}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                className="input-control"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateEditChallanItemRow(idx, 'quantity', e.target.value)}
                                style={{ textAlign: 'right', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                className="input-control"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => updateEditChallanItemRow(idx, 'unitPrice', e.target.value)}
                                style={{ textAlign: 'right', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
                                required
                              />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                              ৳{formatAmount(item.totalPrice)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {editChallanItems.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => removeEditChallanItemRow(idx)}
                                  style={{ padding: '0.2rem 0.4rem', border: 'none', color: 'var(--danger)' }}
                                >
                                  ✕
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Discount & Grand Total Bar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      marginTop: '0.75rem',
                      padding: '0.65rem 1rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Discount (৳):</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={getEditChallanSubtotal()}
                        className="input-control"
                        placeholder="0.00"
                        value={editChallanDiscount}
                        onChange={(e) => setEditChallanDiscount(e.target.value)}
                        style={{ width: '110px', fontSize: '0.85rem', padding: '0.25rem 0.5rem', textAlign: 'right' }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      {parseFloat(editChallanDiscount) > 0 && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Subtotal: ৳{formatAmount(getEditChallanSubtotal())}
                        </span>
                      )}
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Total Amount:</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'Outfit, sans-serif' }}>
                        ৳{formatAmount(getEditChallanGrandTotal())}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Notes</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Enter notes (optional)..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditChallanModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingEditChallan}>
                  {isSavingEditChallan ? 'Saving Changes...' : 'Update Challan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT / SETTLEMENT MODAL */}
      {showPaymentModal && activeChallan && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', width: '100%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={18} />
                <span>{isFactoryPerspective ? 'Receive Payment' : 'Submit Payment'}</span>
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowPaymentModal(false)} style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Summary Box */}
                <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Challan:</span>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>{activeChallan.challan_no}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {isFactoryPerspective ? 'Branch:' : 'Factory:'}
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      {isFactoryPerspective ? `🏪 ${activeChallan.to_branch?.name}` : `🏭 ${activeChallan.from_branch?.name || 'Factory'}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '0.35rem', marginTop: '0.35rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      Due Amount:
                    </span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#dc2626', fontFamily: 'Outfit, sans-serif' }}>
                      ৳{formatAmount(activeChallan.due_amount)}
                    </span>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Amount (৳) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={parseFloat(activeChallan.due_amount)}
                    className="input-control"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                    style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Payment Method *</label>
                    <select className="input-control" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      <option value="cash">💵 Cash</option>
                      <option value="bank">🏦 Bank</option>
                      <option value="mobile_banking">📱 Mobile Banking (bKash/Nagad)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Date *</label>
                    <input type="date" className="input-control" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>{isFactoryPerspective ? 'Reference No (Optional)' : 'Reference No *'}</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. Slip # or Trx ID"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    required={!isOwner && !isFactoryPerspective}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Notes</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Enter notes (optional)..."
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingPayment}>
                  {isSubmittingPayment 
                    ? (isFactoryPerspective ? 'Saving...' : 'Submitting...') 
                    : (isFactoryPerspective ? 'Save Payment' : 'Submit Payment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT PAYMENT MODAL (For Owner) */}
      {showRejectModal && selectedPaymentForAction && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px', width: '100%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
                <AlertTriangle size={18} />
                <span>Reject Payment Request</span>
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowRejectModal(false)} style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmRejection}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  Are you sure you want to reject payment <strong>#{selectedPaymentForAction.payment_no}</strong> (৳{formatAmount(selectedPaymentForAction.amount)}) from <strong>{selectedPaymentForAction.branch?.name}</strong>?
                </p>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Reason for Rejection *</label>
                  <textarea
                    className="input-control"
                    rows="3"
                    placeholder="e.g. Trx ID not found in bank statement, amount mismatch..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}>
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT CHALLAN MODAL (For Owner / Factory) */}
      {showRejectChallanModal && selectedChallanForReject && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px', width: '100%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
                <AlertTriangle size={18} />
                <span>Reject Challan</span>
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowRejectChallanModal(false)} style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmRejectChallan}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  Are you sure you want to reject Challan <strong>#{selectedChallanForReject.challan_no}</strong> for <strong>{selectedChallanForReject.to_branch?.name || 'Branch'}</strong> (৳{formatAmount(selectedChallanForReject.total_bill_amount)})?
                </p>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Reason for Rejection *</label>
                  <textarea
                    className="input-control"
                    rows="3"
                    placeholder="e.g. Stock currently unavailable at factory, incorrect item quantities..."
                    value={challanRejectionReason}
                    onChange={(e) => setChallanRejectionReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRejectChallanModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}>
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ITEMS DETAILS MODAL */}
      {showDetailModal && activeChallan && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px', width: '100%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} />
                <span>Challan #{activeChallan.challan_no} Items</span>
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowDetailModal(false)} style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem' }}>
              {/* Status Notice if Pending or Rejected */}
              {getChallanStatus(activeChallan) === 'pending' && (
                <div style={{ marginBottom: '1rem', padding: '0.65rem 0.85rem', borderRadius: '6px', background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={16} style={{ flexShrink: 0 }} />
                  <span><strong>Pending Approval:</strong> Awaiting Factory / Owner approval.</span>
                </div>
              )}
              {getChallanStatus(activeChallan) === 'rejected' && (
                <div style={{ marginBottom: '1rem', padding: '0.65rem 0.85rem', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.84rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Challan Rejected:</strong> {getChallanRejectionReason(activeChallan) || 'Rejected by Factory / Owner'}
                  </div>
                </div>
              )}

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product SKU & Name</th>
                      <th style={{ textAlign: 'right' }}>Dispatched</th>
                      <th style={{ textAlign: 'right' }}>Sold</th>
                      <th style={{ textAlign: 'right' }}>Remaining</th>
                      <th style={{ textAlign: 'right' }}>Rate (৳)</th>
                      <th style={{ textAlign: 'right' }}>Total (৳)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeChallan.items || []).map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td>{idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{it.product?.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{it.product?.sku}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{it.dispatched_qty}</td>
                        <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{it.sold_qty || 0}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{it.remaining_qty || 0}</td>
                        <td style={{ textAlign: 'right' }}>৳{formatAmount(it.unit_transfer_price)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{formatAmount(it.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const itemsSubtotal = (activeChallan.items || []).reduce((s, it) => s + (parseFloat(it.total_price) || 0), 0);
                      const discountVal = getChallanDiscount(activeChallan);
                      return (
                        <>
                          {discountVal > 0 && (
                            <>
                              <tr style={{ borderTop: '1px solid var(--border-color)', fontWeight: 600 }}>
                                <td colSpan={6} style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Subtotal:</td>
                                <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>৳{formatAmount(itemsSubtotal)}</td>
                              </tr>
                              <tr style={{ fontWeight: 600, color: '#dc2626' }}>
                                <td colSpan={6} style={{ textAlign: 'right', fontSize: '0.85rem' }}>Factory Discount:</td>
                                <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>-৳{formatAmount(discountVal)}</td>
                              </tr>
                            </>
                          )}
                          <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 800 }}>
                            <td colSpan={6} style={{ textAlign: 'right' }}>Total Bill:</td>
                            <td style={{ textAlign: 'right', color: 'var(--primary)', fontFamily: 'Outfit, sans-serif' }}>৳{formatAmount(activeChallan.total_bill_amount)}</td>
                          </tr>
                          <tr style={{ fontWeight: 600 }}>
                            <td colSpan={6} style={{ textAlign: 'right', color: '#059669' }}>Paid / Received:</td>
                            <td style={{ textAlign: 'right', color: '#059669', fontFamily: 'Outfit, sans-serif' }}>৳{formatAmount(activeChallan.paid_amount)}</td>
                          </tr>
                          <tr style={{ fontWeight: 700 }}>
                            <td colSpan={6} style={{ textAlign: 'right', color: parseFloat(activeChallan.due_amount) > 0 ? '#dc2626' : 'var(--text-muted)' }}>Due / Receivable:</td>
                            <td style={{ textAlign: 'right', color: parseFloat(activeChallan.due_amount) > 0 ? '#dc2626' : 'var(--text-muted)', fontFamily: 'Outfit, sans-serif' }}>৳{formatAmount(activeChallan.due_amount)}</td>
                          </tr>
                        </>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE DELIVERY CHALLAN PREVIEW MODAL */}
      {showPrintModal && activeChallan && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg" style={{ maxWidth: '850px', width: '95%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header no-print">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Printer size={18} />
                <span>Delivery Challan Preview — #{activeChallan.challan_no}</span>
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => window.print()}
                >
                  <Printer size={14} />
                  <span>Print Document</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowPrintModal(false)}
                  style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: '1.25rem', backgroundColor: '#f8fafc' }}>
              <div
                className="invoice-print-view"
                style={{
                  backgroundColor: '#ffffff',
                  padding: '1.25rem 1.5rem',
                  borderRadius: '4px',
                  border: '1.5px solid #000',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  fontFamily: 'Outfit, sans-serif',
                  color: '#000',
                  margin: '0 auto',
                  maxWidth: '780px',
                  position: 'relative'
                }}
              >
                {/* 1. TOP HEADER WITH OFFICIAL LOGO & TITLE */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #000', paddingBottom: '0.35rem', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <img 
                      src={almasLogo} 
                      alt="Almas Logo" 
                      style={{ width: '38px', height: '38px', objectFit: 'contain', border: '1px solid #000', padding: '1px', background: '#fff', borderRadius: '3px' }} 
                    />
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2px', lineHeight: 1.1 }}>ALMAS ACCESSORIES INDUSTRIES</h1>
                      <p style={{ margin: '0.05rem 0 0 0', fontSize: '0.68rem', color: '#334155', fontStyle: 'italic' }}>100% Export Oriented Garments Accessories Industries</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
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
                      marginBottom: '0.2rem'
                    }}>
                      <span style={{ fontFamily: '"Times New Roman", Times, Georgia, serif', fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '1px', lineHeight: 1 }}>DELIVERY CHALLAN</span>
                    </div>
                    <p style={{ margin: '0.05rem 0', fontWeight: 800, fontSize: '0.86rem', color: '#000' }}>#{activeChallan.challan_no}</p>
                    <p style={{ margin: 0, fontSize: '0.76rem', color: '#475569', fontWeight: 600 }}>Date: {new Date(activeChallan.challan_date).toLocaleDateString('en-GB')}</p>
                  </div>
                </div>

                {/* 2. ORIGIN & DESTINATION */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.72rem', color: '#64748b' }}>Delivered From (Origin):</p>
                    <p style={{ margin: '0.2rem 0 0', fontWeight: 800, fontSize: '0.92rem' }}>🏭 {activeChallan.from_branch?.name || 'Central Factory'}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.72rem', color: '#64748b' }}>Delivered To (Destination):</p>
                    <p style={{ margin: '0.2rem 0 0', fontWeight: 800, fontSize: '0.92rem' }}>🏪 {activeChallan.to_branch?.name || 'Branch Outlet'}</p>
                  </div>
                </div>

                {activeChallan.vehicle_no && (
                  <div style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.82rem', backgroundColor: '#fafafa' }}>
                    <strong>Transport:</strong> Vehicle #{activeChallan.vehicle_no} {activeChallan.driver_name ? ` | Driver: ${activeChallan.driver_name}` : ''}
                  </div>
                )}

                {/* 3. ITEMS TABLE */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', fontSize: '0.82rem', border: '1.5px solid #000' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #000' }}>
                      <th style={{ borderRight: '1px solid #000', padding: '0.45rem 0.35rem', textAlign: 'center', width: '40px', fontWeight: 800 }}>SL</th>
                      <th style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 800 }}>Product SKU & Description</th>
                      <th style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', width: '100px', fontWeight: 800 }}>Dispatched</th>
                      <th style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', width: '110px', fontWeight: 800 }}>Transfer Rate (৳)</th>
                      <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right', width: '120px', fontWeight: 800 }}>Total Bill (৳)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeChallan.items || []).map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ borderRight: '1px solid #000', padding: '0.45rem 0.35rem', textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem' }}>
                          <span style={{ fontWeight: 800, color: '#000', letterSpacing: '0.2px' }}>{it.product?.sku}</span> - <span>{it.product?.name}</span>
                        </td>
                        <td style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>
                          {it.dispatched_qty} {it.product?.unit || 'pcs'}
                        </td>
                        <td style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right' }}>
                          ৳{formatAmount(it.unit_transfer_price)}
                        </td>
                        <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>
                          ৳{formatAmount(it.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {getChallanDiscount(activeChallan) > 0 && (
                      <tr style={{ backgroundColor: '#f8fafc', borderTop: '1.5px solid #000' }}>
                        <td colSpan={4} style={{ borderRight: '1px solid #000', padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>Factory Discount:</td>
                        <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                          -৳{formatAmount(getChallanDiscount(activeChallan))}
                        </td>
                      </tr>
                    )}
                    <tr style={{ backgroundColor: '#f8fafc', borderTop: '1.5px solid #000' }}>
                      <td colSpan={4} style={{ borderRight: '1px solid #000', padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>Grand Consignment Bill Total:</td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 900, fontSize: '0.98rem', color: '#000' }}>
                        ৳{formatAmount(activeChallan.total_bill_amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {getChallanCleanNotes(activeChallan) && (
                  <p style={{ fontSize: '0.8rem', marginBottom: '1.5rem', color: '#475569' }}>
                    <strong>Remarks:</strong> {getChallanCleanNotes(activeChallan)}
                  </p>
                )}

                {/* 4. SIGNATURE ROWS */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3.5rem', paddingTop: '0.5rem' }}>
                  <div style={{ textAlign: 'center', width: '150px', borderTop: '1px dotted #000' }}>
                    <p style={{ margin: '0.35rem 0', fontSize: '0.78rem', fontWeight: 700 }}>Factory Dispatcher</p>
                  </div>
                  <div style={{ textAlign: 'center', width: '150px', borderTop: '1px dotted #000' }}>
                    <p style={{ margin: '0.35rem 0', fontSize: '0.78rem', fontWeight: 700 }}>Driver / Carrier</p>
                  </div>
                  <div style={{ textAlign: 'center', width: '150px', borderTop: '1px dotted #000' }}>
                    <p style={{ margin: '0.35rem 0', fontSize: '0.78rem', fontWeight: 700 }}>Branch Receiver</p>
                  </div>
                </div>

                {/* 5. OFFICIAL FOOTER */}
                <div style={{ borderTop: '1.5px solid #000', marginTop: '1.5rem', paddingTop: '0.45rem', textAlign: 'center', fontSize: '0.72rem', color: '#1e293b', lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 700 }}>
                    Office & Factory : 604/750, Najir Ahamed Mistiri Sodok, West Jharnapara, Baro Quarter, Doublemooring, Chattogram, Bangladesh. &nbsp;|&nbsp; Cell : 01819-898617, 01845-069803
                  </div>
                  <div style={{ color: '#475569' }}>
                    E-mail : almasaccessoriesind@gmail.com, Web : www.almasaccessories.com
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer no-print" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowPrintModal(false)}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={15} />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
