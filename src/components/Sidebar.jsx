import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/almas_logo.jpg';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Package,
  Layers,
  ShoppingCart,
  Download,
  CreditCard,
  Receipt,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Truck,
  RotateCcw,
} from 'lucide-react';

import { hasPermission } from '../utils/permissions';

export default function Sidebar({ userProfile, onLogout, branches, isOpen, setIsOpen, isCollapsed, setIsCollapsed }) {
  const role = userProfile?.role || 'staff';
  const assignedBranchId = userProfile?.branch_id;
  const activeBranch = branches.find((b) => b.id === assignedBranchId);

  const location = useLocation();
  const getActiveView = () => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    return path.substring(1); // removes leading slash
  };
  const activeView = getActiveView();

  const menuGroups = [
    {
      title: null,
      items: [
        { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, perm: null },
      ],
    },
    {
      title: 'Sales & Orders',
      items: [
        { id: 'sales', name: 'Sales (POS)', icon: ShoppingCart, perm: 'sales.view' },
        { id: 'returns', name: 'Returns', icon: RotateCcw, perm: 'returns.view' },
        { id: 'purchases', name: 'Purchases', icon: Download, perm: 'purchases.view' },
      ],
    },
    {
      title: 'Inventory & Stock',
      items: [
        { id: 'products', name: 'Products', icon: Layers, perm: 'product.view' },
        { id: 'inventory', name: 'Inventory', icon: Package, perm: 'inventory.view' },
        { id: 'challans', name: 'Challans', icon: Truck, perm: 'inventory.view' },
      ],
    },
    {
      title: 'Finance & Accounts',
      items: [
        { id: 'payments', name: 'Payments', icon: CreditCard, perm: 'payments.view' },
        { id: 'expenses', name: 'Expenses', icon: Receipt, perm: 'expenses.view' },
      ],
    },
    {
      title: 'Reports & Admin',
      items: [
        { id: 'reports', name: 'Reports', icon: BarChart3, perm: 'reports.view' },
        { id: 'contacts', name: 'Contacts', icon: Users, perm: 'contacts.view' },
        { id: 'users', name: 'Staff & Users', icon: UserCheck, perm: 'users.manage', ownerOnly: true },
      ],
    },
  ];

  const visibleGroups = menuGroups
    .map((group) => {
      const visibleItems = group.items.filter((item) => {
        if (role === 'owner') return true;
        if (item.ownerOnly) return false;
        if (!item.perm) return true;
        return hasPermission(userProfile, item.perm);
      });
      return { ...group, items: visibleItems };
    })
    .filter((group) => group.items.length > 0);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
          <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src={logo} alt="Almas Logo" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }} />
            <span className="logo-full">ALMAS ERP</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button
              type="button"
              className="desktop-collapse-btn"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <button 
              className="sidebar-close-btn" 
              onClick={() => setIsOpen(false)}
              style={{ display: 'none', background: 'none', border: 'none', fontSize: '1.25rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        </div>
        <div className="sidebar-branch-badge">
          {role === 'owner' ? 'All Branches (Owner)' : activeBranch ? activeBranch.name : 'No Branch'}
        </div>
      </div>

      <nav className="sidebar-menu">
        {visibleGroups.map((group, gIdx) => (
          <div key={group.title || `group-${gIdx}`} className="sidebar-group">
            {group.title && <div className="sidebar-group-title">{group.title}</div>}
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  to={item.id === 'dashboard' ? '/' : `/${item.id}`}
                  className={`sidebar-item ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => setIsOpen(false)}
                  style={{ textDecoration: 'none' }}
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-name">{userProfile?.full_name || 'Staff User'}</div>
          <div className="user-role">{role}</div>
        </div>
        <button className="btn sidebar-logout-btn" onClick={onLogout}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
