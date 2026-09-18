import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Download,
  Package,
  Layers,
  CreditCard,
  Receipt,
  Users,
  BarChart3,
  UserCheck,
  Building2,
} from 'lucide-react';
import { hasPermission } from '../utils/permissions';

export default function Dashboard({ userProfile, branches }) {
  const navigate = useNavigate();

  const role = userProfile?.role || 'staff';
  const myBranchId = userProfile?.branch_id;
  const activeBranch = branches.find((b) => b.id === myBranchId);

  const quickActions = [
    {
      id: 'sales-pos',
      title: 'Sales (POS)',
      icon: ShoppingCart,
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      glow: 'rgba(37, 99, 235, 0.28)',
      hoverBorder: '#3b82f6',
      themeColor: '#1d4ed8',
      path: '/sales',
      state: { openPos: true },
      perm: 'sales.view',
    },
    {
      id: 'purchases-new',
      title: 'Purchases',
      icon: Download,
      gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      glow: 'rgba(2, 132, 199, 0.28)',
      hoverBorder: '#0ea5e9',
      themeColor: '#0284c7',
      path: '/purchases',
      state: { openNewPurchase: true },
      perm: 'purchases.view',
    },
    {
      id: 'inventory-stock',
      title: 'Inventory',
      icon: Package,
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      glow: 'rgba(5, 150, 105, 0.28)',
      hoverBorder: '#10b981',
      themeColor: '#059669',
      path: '/inventory',
      perm: 'inventory.view',
    },
    {
      id: 'product-catalog',
      title: 'Product',
      icon: Layers,
      gradient: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
      glow: 'rgba(79, 70, 229, 0.28)',
      hoverBorder: '#6366f1',
      themeColor: '#4338ca',
      path: '/products',
      perm: 'product.view',
    },
    {
      id: 'payments-manage',
      title: 'Payments',
      icon: CreditCard,
      gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
      glow: 'rgba(13, 148, 136, 0.28)',
      hoverBorder: '#14b8a6',
      themeColor: '#0d9488',
      path: '/payments',
      perm: 'payments.view',
    },
    {
      id: 'expenses-new',
      title: 'Expenses',
      icon: Receipt,
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      glow: 'rgba(217, 119, 6, 0.28)',
      hoverBorder: '#f59e0b',
      themeColor: '#d97706',
      path: '/expenses',
      state: { openCreateExpense: true },
      perm: 'expenses.view',
    },
    {
      id: 'contacts-directory',
      title: 'Contacts',
      icon: Users,
      gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
      glow: 'rgba(124, 58, 237, 0.28)',
      hoverBorder: '#a855f7',
      themeColor: '#7c3aed',
      path: '/contacts',
      perm: 'contacts.view',
    },
    {
      id: 'reports-analytics',
      title: 'Reports',
      icon: BarChart3,
      gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
      glow: 'rgba(225, 29, 72, 0.28)',
      hoverBorder: '#f43f5e',
      themeColor: '#e11d48',
      path: '/reports',
      perm: 'reports.view',
    },
    {
      id: 'users-manage',
      title: 'Staff',
      icon: UserCheck,
      gradient: 'linear-gradient(135deg, #64748b 0%, #334155 100%)',
      glow: 'rgba(51, 65, 85, 0.25)',
      hoverBorder: '#64748b',
      themeColor: '#334155',
      path: '/users',
      perm: 'users.manage',
      ownerOnly: true,
    },
  ];

  const visibleActions = quickActions.filter((action) => {
    if (role === 'owner') return true;
    if (action.ownerOnly) return false;
    if (!action.perm) return true;
    return hasPermission(userProfile, action.perm);
  });

  const handleActionClick = (action) => {
    navigate(action.path, { state: action.state || {} });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Welcome Bar */}
      <div className="dashboard-banner">
        <div className="dashboard-banner-text">
          <h1>Welcome, {userProfile?.full_name || 'Staff User'}!</h1>
          <p>Quick Action Launcher</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--border-radius)',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            <Building2 size={15} style={{ color: 'var(--primary)' }} />
            <span>
              {role === 'owner'
                ? 'All Branches'
                : activeBranch?.name || 'Assigned Branch'}
            </span>
          </div>

          <span
            className="badge"
            style={{
              backgroundColor: role === 'owner' ? '#eff6ff' : '#f1f5f9',
              color: role === 'owner' ? '#1d4ed8' : '#334155',
              border: role === 'owner' ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
              padding: '0.35rem 0.65rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            {role}
          </span>
        </div>
      </div>

      {/* Modern High-Aesthetic Action Grid (2 in one line on mobile) */}
      <div className="dashboard-actions-grid">
        {visibleActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              className="quick-action-card"
              style={{
                '--card-gradient': action.gradient,
                '--card-glow': action.glow,
                '--card-border-hover': action.hoverBorder,
                '--card-theme-color': action.themeColor,
              }}
              onClick={() => handleActionClick(action)}
            >
              <div className="quick-action-icon-box">
                <Icon size={24} strokeWidth={2.2} />
              </div>
              <span className="quick-action-title">{action.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
