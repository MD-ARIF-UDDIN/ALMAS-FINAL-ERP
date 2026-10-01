import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/almas_logo.jpg';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  UserPlus,
  Building,
  Shield,
  ShieldCheck,
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
  ChevronDown,
  Truck,
  RotateCcw,
  TrendingUp,
  History,
  User,
} from 'lucide-react';

import { hasPermission } from '../utils/permissions';

export default function Sidebar({ userProfile, onLogout, branches, isOpen, setIsOpen, isCollapsed, setIsCollapsed }) {
  const role = userProfile?.role || 'staff';
  const assignedBranchId = userProfile?.branch_id;
  const activeBranch = branches.find((b) => b.id === assignedBranchId);

  const location = useLocation();
  const currentPath = location.pathname;
  const currentSearch = location.search || '';
  const currentTab = new URLSearchParams(currentSearch).get('tab');

  // Stores manual user toggle overrides for menus
  const [userToggledMenus, setUserToggledMenus] = useState({});

  const toggleSubmenu = (menuId, currentlyExpanded, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setUserToggledMenus((prev) => ({
      ...prev,
      [menuId]: !currentlyExpanded,
    }));
  };

  const checkIsSubActive = (sub) => {
    const subBasePath = sub.path.split('?')[0];
    if (subBasePath !== currentPath) return false;

    const subTab = new URLSearchParams(sub.path.split('?')[1] || '').get('tab');
    if (subTab) {
      if (currentTab) {
        return currentTab === subTab;
      }
      return Boolean(sub.isDefault);
    }
    return true;
  };

  const checkIsItemActive = (item) => {
    if (item.subItems && item.subItems.length > 0) {
      return item.subItems.some((sub) => checkIsSubActive(sub)) || currentPath === `/${item.id}`;
    }
    if (item.id === 'dashboard') {
      return currentPath === '/';
    }
    return currentPath === `/${item.id}`;
  };

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
        {
          id: 'inventory',
          name: 'Inventory',
          icon: Package,
          perm: 'inventory.view',
          subItems: [
            { id: 'stock', name: 'Stock Levels', icon: Package, path: '/inventory?tab=stock', isDefault: true },
            { id: 'logs', name: 'Stock Logs', icon: History, path: '/inventory?tab=logs' },
          ],
        },
      ],
    },
    {
      title: 'Finance & Accounts',
      items: [
        {
          id: 'payments',
          name: 'Payments',
          icon: CreditCard,
          perm: 'payments.view',
          subItems: [
            { id: 'invoices', name: 'Invoices Due', icon: Receipt, path: '/payments?tab=invoices', isDefault: true },
            { id: 'ledger', name: 'Payment Ledger', icon: History, path: '/payments?tab=ledger' },
          ],
        },
        { id: 'expenses', name: 'Expenses', icon: Receipt, perm: 'expenses.view' },
      ],
    },
    {
      title: 'Reports & Admin',
      items: [
        {
          id: 'reports',
          name: 'Reports',
          icon: BarChart3,
          perm: 'reports.view',
          subItems: [
            { id: 'overall', name: 'Sales & Turnover', icon: TrendingUp, path: '/reports?tab=overall', isDefault: true },
            { id: 'customer', name: 'Customer Statement', icon: User, path: '/reports?tab=customer' },
            { id: 'payments', name: 'Payment Collections', icon: CreditCard, path: '/reports?tab=payments' },
          ],
        },
        {
          id: 'contacts',
          name: 'Contacts',
          icon: Users,
          perm: 'contacts.view',
          subItems: [
            { id: 'customer', name: 'Customers', icon: User, path: '/contacts?tab=customer', isDefault: true },
            { id: 'supplier', name: 'Suppliers', icon: Building, path: '/contacts?tab=supplier' },
          ],
        },
        {
          id: 'users',
          name: 'Staff & Users',
          icon: UserCheck,
          perm: 'users.manage',
          ownerOnly: true,
          subItems: [
            { id: 'users', name: 'Staff Accounts', icon: UserPlus, path: '/users', isDefault: true },
            { id: 'branches', name: 'Branch Locations', icon: Building, path: '/branches' },
            { id: 'permissions', name: 'Role Permissions', icon: Shield, path: '/permissions' },
          ],
        },
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
            <img src={logo} alt="Almas Logo" style={{ width: '26px', height: '26px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }} />
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
              const hasSubs = Array.isArray(item.subItems) && item.subItems.length > 0;
              const isItemActive = checkIsItemActive(item);
              const isExpanded = userToggledMenus[item.id] !== undefined 
                ? userToggledMenus[item.id] 
                : isItemActive;

              if (hasSubs) {
                return (
                  <div key={item.id} className="sidebar-menu-parent-group">
                    <div
                      className={`sidebar-item sidebar-parent-item ${isItemActive ? 'active' : ''}`}
                      onClick={(e) => {
                        if (isCollapsed) {
                          setIsCollapsed(false);
                          toggleSubmenu(item.id, false, e);
                        } else {
                          toggleSubmenu(item.id, isExpanded, e);
                        }
                      }}
                      title={item.name}
                    >
                      <Icon size={17} />
                      <span style={{ flex: 1 }}>{item.name}</span>
                      {!isCollapsed && (
                        <span className="sidebar-chevron-icon">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                      )}
                    </div>
                    {!isCollapsed && isExpanded && (
                      <div className="sidebar-submenu">
                        {item.subItems.map((sub) => {
                          const SubIcon = sub.icon;
                          const isSubActive = checkIsSubActive(sub);
                          return (
                            <Link
                              key={sub.id + sub.path}
                              to={sub.path}
                              className={`sidebar-subitem ${isSubActive ? 'active' : ''}`}
                              onClick={() => setIsOpen(false)}
                              style={{ textDecoration: 'none' }}
                            >
                              <SubIcon size={15} />
                              <span>{sub.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.id}
                  to={item.id === 'dashboard' ? '/' : `/${item.id}`}
                  className={`sidebar-item ${isItemActive ? 'active' : ''}`}
                  onClick={() => setIsOpen(false)}
                  style={{ textDecoration: 'none' }}
                >
                  <Icon size={17} />
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
