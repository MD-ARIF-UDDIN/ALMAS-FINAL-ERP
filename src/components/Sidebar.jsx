import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/logo.svg';
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

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, perm: null },
    { id: 'users', name: 'eStaff', icon: UserCheck, perm: 'users.manage', ownerOnly: true },
    { id: 'contacts', name: 'eContacts', icon: Users, perm: 'contacts.view' },
    { id: 'products', name: 'eProduct', icon: Layers, perm: 'product.view' },
    { id: 'inventory', name: 'eInventory', icon: Package, perm: 'inventory.view' },
    { id: 'sales', name: 'eSales', icon: ShoppingCart, perm: 'sales.view' },
    { id: 'purchases', name: 'ePurchases', icon: Download, perm: 'purchases.view' },
    { id: 'payments', name: 'ePayments', icon: CreditCard, perm: 'payments.view' },
    { id: 'expenses', name: 'eExpenses', icon: Receipt, perm: 'expenses.view' },
    { id: 'reports', name: 'eReports', icon: BarChart3, perm: 'reports.view' },
  ];

  const visibleMenuItems = menuItems.filter((item) => {
    if (role === 'owner') return true;
    if (item.ownerOnly) return false;
    if (!item.perm) return true;
    return hasPermission(userProfile, item.perm);
  });

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
          <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src={logo} alt="Almas Logo" style={{ width: '26px', height: '26px', flexShrink: 0 }} />
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
        {visibleMenuItems.map((item) => {
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
