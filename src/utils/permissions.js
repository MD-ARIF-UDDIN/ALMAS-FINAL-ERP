// Serial-Wise Module & Tab Permissions Manager for Almas ERP (Database-Backed)
// Exact System Naming: eProduct, eInventory, eSales, ePurchases, ePayments, eExpenses, eContacts, eReports, eStaff
import { supabase } from '../supabaseClient';

export const MODULE_SERIAL_PERMISSIONS = [
  {
    serial: 1,
    id: 'product',
    title: 'eProduct',
    icon: 'Layers',
    color: '#0284c7',
    bgColor: '#f0f9ff',
    groups: [
      {
        title: 'Item List',
        permissions: [
          { key: 'product.items_view', label: 'View List' },
          { key: 'product.items_create', label: 'Create Item' },
          { key: 'product.items_delete', label: 'Delete', isDanger: true },
        ],
      },
      {
        title: 'Shade Book',
        permissions: [
          { key: 'product.shades_view', label: 'View Shades' },
          { key: 'product.shades_create', label: 'Add Shade' },
          { key: 'product.shades_delete', label: 'Delete', isDanger: true },
        ],
      },
    ],
  },
  {
    serial: 2,
    id: 'inventory',
    title: 'eInventory',
    icon: 'Package',
    color: '#059669',
    bgColor: '#f0fdf4',
    groups: [
      {
        title: 'Stock In Hand',
        permissions: [
          { key: 'inventory.stock_view', label: 'View Stock Matrix' },
          { key: 'inventory.adjust', label: 'Manual Adjust' },
        ],
      },
      {
        title: 'Stock Transfers',
        permissions: [
          { key: 'inventory.transfer_view', label: 'View Transfers' },
          { key: 'inventory.transfer', label: 'Execute Transfer' },
        ],
      },
      {
        title: 'Ledger Logs',
        permissions: [
          { key: 'inventory.logs_view', label: 'View Logs' },
        ],
      },
    ],
  },
  {
    serial: 3,
    id: 'sales',
    title: 'eSales',
    icon: 'Receipt',
    color: '#2563eb',
    bgColor: '#eff6ff',
    groups: [
      {
        title: 'Sales Invoices',
        permissions: [
          { key: 'sales.view', label: 'View Invoices' },
          { key: 'sales.delete', label: 'Delete', isDanger: true },
        ],
      },
      {
        title: 'POS Terminal',
        permissions: [
          { key: 'sales.pos_view', label: 'Access POS' },
          { key: 'sales.create', label: 'Create POS Invoice' },
        ],
      },
    ],
  },
  {
    serial: 4,
    id: 'purchases',
    title: 'ePurchases',
    icon: 'ShoppingCart',
    color: '#0284c7',
    bgColor: '#f0f9ff',
    groups: [
      {
        title: 'Purchase Orders',
        permissions: [
          { key: 'purchases.view', label: 'View Orders' },
          { key: 'purchases.delete', label: 'Delete', isDanger: true },
        ],
      },
      {
        title: 'New Purchase',
        permissions: [
          { key: 'purchases.new_view', label: 'Access New Entry' },
          { key: 'purchases.create', label: 'Record Stock In' },
        ],
      },
    ],
  },
  {
    serial: 5,
    id: 'payments',
    title: 'ePayments',
    icon: 'CreditCard',
    color: '#16a34a',
    bgColor: '#f0fdf4',
    groups: [
      {
        title: 'Payment Ledger',
        permissions: [
          { key: 'payments.view', label: 'View Payments' },
          { key: 'payments.create', label: 'Collect / Record' },
          { key: 'payments.delete', label: 'Delete', isDanger: true },
        ],
      },
    ],
  },
  {
    serial: 6,
    id: 'expenses',
    title: 'eExpenses',
    icon: 'DollarSign',
    color: '#d97706',
    bgColor: '#fffbeb',
    groups: [
      {
        title: 'Expense Ledger',
        permissions: [
          { key: 'expenses.view', label: 'View Expenses' },
          { key: 'expenses.create', label: 'Record Expense' },
          { key: 'expenses.delete', label: 'Delete', isDanger: true },
        ],
      },
    ],
  },
  {
    serial: 7,
    id: 'contacts',
    title: 'eContacts',
    icon: 'Users',
    color: '#7c3aed',
    bgColor: '#faf5ff',
    groups: [
      {
        title: 'Contacts Directory',
        permissions: [
          { key: 'contacts.view', label: 'View Directory' },
          { key: 'contacts.create', label: 'Create Contact' },
          { key: 'contacts.edit', label: 'Edit Balance' },
          { key: 'contacts.delete', label: 'Delete', isDanger: true },
        ],
      },
    ],
  },
  {
    serial: 8,
    id: 'reports',
    title: 'eReports',
    icon: 'BarChart3',
    color: '#db2777',
    bgColor: '#fdf2f8',
    groups: [
      {
        title: 'Profit & Loss',
        permissions: [
          { key: 'reports.view', label: 'View Profit & Loss / Financials' },
        ],
      },
    ],
  },
  {
    serial: 9,
    id: 'users',
    title: 'eStaff',
    icon: 'Shield',
    color: '#475569',
    bgColor: '#f8fafc',
    groups: [
      {
        title: 'Staff & Branch Setup',
        permissions: [
          { key: 'users.manage', label: 'Manage Staff Accounts & Branches' },
        ],
      },
    ],
  },
];

// Extract all unique keys
export const ALL_PERMISSIONS = Array.from(
  new Set(
    MODULE_SERIAL_PERMISSIONS.flatMap((m) =>
      m.groups.flatMap((g) => g.permissions.map((p) => p.key))
    )
  )
);

// Standard Default Templates
export const DEFAULT_ROLE_PERMISSIONS = {
  owner: [...ALL_PERMISSIONS],
  branch_manager: [
    'product.items_view',
    'product.items_create',
    'product.shades_view',
    'product.shades_create',
    'inventory.stock_view',
    'inventory.adjust',
    'inventory.transfer_view',
    'inventory.transfer',
    'inventory.logs_view',
    'sales.view',
    'sales.pos_view',
    'sales.create',
    'purchases.view',
    'purchases.new_view',
    'purchases.create',
    'payments.view',
    'payments.create',
    'expenses.view',
    'expenses.create',
    'contacts.view',
    'contacts.create',
    'contacts.edit',
    'reports.view',
  ],
  staff: [
    'product.items_view',
    'product.shades_view',
    'inventory.stock_view',
    'sales.view',
    'sales.pos_view',
    'sales.create',
    'payments.view',
    'payments.create',
    'contacts.view',
    'contacts.create',
  ],
};

const STORAGE_KEY_ROLES = 'almas_erp_role_permissions';
const STORAGE_KEY_USERS = 'almas_erp_user_permissions';

/**
 * Fetch role templates from Supabase and sync local cache
 */
export async function syncRolePermissionsFromDB() {
  try {
    const { data, error } = await supabase.from('role_permissions').select('*');
    if (!error && data && data.length > 0) {
      const roleMap = {};
      data.forEach((r) => {
        if (r.role && Array.isArray(r.permissions)) {
          roleMap[r.role] = r.permissions;
        }
      });
      localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(roleMap));
      return roleMap;
    }
  } catch (err) {
    console.error('Error syncing role permissions from DB:', err);
  }
  return null;
}

/**
 * Get current effective permissions for a role
 */
export function getRolePermissions(role) {
  if (role === 'owner') return [...ALL_PERMISSIONS];
  try {
    const customRoles = JSON.parse(localStorage.getItem(STORAGE_KEY_ROLES) || '{}');
    if (customRoles[role] && Array.isArray(customRoles[role])) {
      return customRoles[role];
    }
  } catch (e) {
    console.error('Error reading role permissions:', e);
  }
  return DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.staff;
}

/**
 * Save custom permissions for a role (Both Supabase DB & Local Cache)
 */
export async function saveRolePermissions(role, permissions) {
  if (role === 'owner') return;
  // Update local cache immediately
  try {
    const customRoles = JSON.parse(localStorage.getItem(STORAGE_KEY_ROLES) || '{}');
    customRoles[role] = permissions;
    localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(customRoles));
  } catch (e) {
    console.error('Error saving role permissions to cache:', e);
  }

  // Persist to Supabase Database
  try {
    await supabase.from('role_permissions').upsert({
      role,
      permissions,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error persisting role permissions to Supabase:', err);
  }
}

/**
 * Reset role permissions to factory defaults
 */
export async function resetRolePermissionsToDefault(role) {
  try {
    const customRoles = JSON.parse(localStorage.getItem(STORAGE_KEY_ROLES) || '{}');
    delete customRoles[role];
    localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(customRoles));
  } catch (e) {
    console.error('Error resetting role permissions in cache:', e);
  }

  try {
    await supabase.from('role_permissions').delete().eq('role', role);
  } catch (err) {
    console.error('Error deleting role permissions in DB:', err);
  }
}

/**
 * Get effective permissions for a specific user profile
 */
export function getUserPermissions(userProfile) {
  if (!userProfile) return [];
  if (userProfile.role === 'owner') return [...ALL_PERMISSIONS];

  // 1. Direct profile permissions column in Supabase DB
  if (userProfile.permissions && Array.isArray(userProfile.permissions) && userProfile.permissions.length > 0) {
    return userProfile.permissions;
  }

  // 2. Local custom override fallback
  try {
    const customUsers = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '{}');
    if (customUsers[userProfile.id] && Array.isArray(customUsers[userProfile.id])) {
      return customUsers[userProfile.id];
    }
  } catch (e) {
    console.error('Error reading user custom permissions:', e);
  }

  // 3. Fallback to Role standard
  return getRolePermissions(userProfile.role || 'staff');
}

/**
 * Save custom permissions for an individual user (Both Supabase DB & Local Cache)
 */
export async function saveUserCustomPermissions(userId, permissions) {
  // Update local cache
  try {
    const customUsers = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '{}');
    customUsers[userId] = permissions;
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(customUsers));
  } catch (e) {
    console.error('Error saving user custom permissions to cache:', e);
  }

  // Persist to Supabase DB profiles.permissions
  try {
    await supabase.from('profiles').update({ permissions }).eq('id', userId);
  } catch (err) {
    console.error('Error persisting user permissions to profiles table:', err);
  }
}

/**
 * Clear custom overrides for an individual user
 */
export async function clearUserCustomPermissions(userId) {
  try {
    const customUsers = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '{}');
    delete customUsers[userId];
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(customUsers));
  } catch (e) {
    console.error('Error clearing user custom permissions in cache:', e);
  }

  try {
    await supabase.from('profiles').update({ permissions: null }).eq('id', userId);
  } catch (err) {
    console.error('Error clearing user permissions in profiles table:', err);
  }
}

/**
 * Check if the given profile has a specific permission
 */
export function hasPermission(userProfile, permissionKey) {
  if (!userProfile) return false;
  if (userProfile.role === 'owner') return true;
  
  const perms = getUserPermissions(userProfile);

  // Aliases and module-level permission checks
  if (permissionKey === 'product.view') {
    return perms.includes('product.items_view') || perms.includes('product.shades_view') || perms.includes('inventory.catalog_view');
  }
  if (permissionKey === 'inventory.view') {
    return perms.includes('inventory.stock_view') || perms.includes('inventory.transfer_view') || perms.includes('inventory.logs_view');
  }
  if (permissionKey === 'inventory.catalog_view' || permissionKey === 'product.items_view') {
    return perms.includes('product.items_view') || perms.includes('inventory.catalog_view');
  }
  if (permissionKey === 'inventory.catalog_create' || permissionKey === 'product.items_create') {
    return perms.includes('product.items_create') || perms.includes('inventory.catalog_create');
  }
  if (permissionKey === 'inventory.catalog_delete' || permissionKey === 'product.items_delete') {
    return perms.includes('product.items_delete') || perms.includes('inventory.catalog_delete');
  }
  
  return perms.includes(permissionKey);
}
