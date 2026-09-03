import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { 
  UserPlus, 
  Building, 
  Shield, 
  Mail, 
  Lock, 
  User, 
  MapPin, 
  Phone, 
  Plus, 
  RotateCcw, 
  Save, 
  Sliders, 
  Edit, 
  CheckSquare, 
  Square,
  Receipt,
  ShoppingCart,
  Package,
  DollarSign,
  CreditCard,
  Users as UsersIcon,
  BarChart3,
  ArrowRightLeft
} from 'lucide-react';
import { TableLoading } from '../components/TableLoading';
import {
  MODULE_SERIAL_PERMISSIONS,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  getRolePermissions,
  saveRolePermissions,
  resetRolePermissionsToDefault,
  getUserPermissions,
  saveUserCustomPermissions,
  clearUserCustomPermissions,
} from '../utils/permissions';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create a non-session-persisting client so creating users doesn't log the owner out
const authCreatorClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export default function Users({ branches, fetchBranches, addToast }) {
  const [profiles, setProfiles] = useState([]);
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'branches', 'permissions'
  const [loading, setLoading] = useState(true);

  // Modal display states
  const [showUserModal, setShowUserModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showUserPermsModal, setShowUserPermsModal] = useState(false);

  // User form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [selectedBranch, setSelectedBranch] = useState('');

  // Edit user state
  const [editingProfile, setEditingProfile] = useState(null);
  const [editRole, setEditRole] = useState('staff');
  const [editBranch, setEditBranch] = useState('');

  // Custom User Permissions modal state
  const [selectedUserForPerms, setSelectedUserForPerms] = useState(null);
  const [userCustomPerms, setUserCustomPerms] = useState([]);
  const [isCustomOverride, setIsCustomOverride] = useState(false);

  // Branch form states
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');

  // Role Permissions Matrix State
  const [selectedMatrixRole, setSelectedMatrixRole] = useState('branch_manager'); // 'branch_manager' | 'staff'
  const [matrixPermissions, setMatrixPermissions] = useState(() => getRolePermissions('branch_manager'));

  useEffect(() => {
    fetchProfiles();
  }, []);

  // Sync matrix permissions when selected role changes
  useEffect(() => {
    setMatrixPermissions(getRolePermissions(selectedMatrixRole));
  }, [selectedMatrixRole]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (err) {
      console.error('Error fetching profiles:', err);
      showMessage('Failed to load user profiles.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type) => {
    addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      showMessage('Please fill all required user fields.', 'error');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showMessage('Please enter a valid email address.', 'error');
      return;
    }

    if (password.length < 6) {
      showMessage('Password must be at least 6 characters long.', 'error');
      return;
    }

    if (fullName.trim().length < 3) {
      showMessage('Full name must be at least 3 characters long.', 'error');
      return;
    }

    if (role !== 'owner' && !selectedBranch) {
      showMessage('Please select a branch location for this employee account.', 'error');
      return;
    }

    setLoading(true);
    try {
      // 1. Sign up the user in Supabase Auth (does not sign out current session)
      const { data, error } = await authCreatorClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      const newUserId = data.user?.id;
      if (!newUserId) throw new Error('No user ID returned from auth sign up.');

      // 2. Update their profile with the chosen role and branch
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          role: role,
          branch_id: role === 'owner' ? null : selectedBranch || null,
        })
        .eq('id', newUserId);

      if (profileError) throw profileError;

      showMessage(`User account for ${fullName} created successfully!`, 'success');
      resetUserForm();
      setShowUserModal(false);
      
      // Refresh the profiles list
      fetchProfiles();
    } catch (err) {
      console.error('Error creating user:', err);
      showMessage(err.message || 'Failed to create user account.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditUser = (profile) => {
    setEditingProfile(profile);
    setEditRole(profile.role || 'staff');
    setEditBranch(profile.branch_id || '');
    setShowEditUserModal(true);
  };

  const handleUpdateUserProfile = async (e) => {
    e.preventDefault();
    if (!editingProfile) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: editRole,
          branch_id: editRole === 'owner' ? null : editBranch || null,
        })
        .eq('id', editingProfile.id);

      if (error) throw error;

      showMessage(`Updated profile settings for ${editingProfile.full_name || editingProfile.email}.`, 'success');
      setShowEditUserModal(false);
      setEditingProfile(null);
      fetchProfiles();
    } catch (err) {
      console.error('Error updating user profile:', err);
      showMessage(err.message || 'Failed to update user profile.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUserPerms = (profile) => {
    setSelectedUserForPerms(profile);
    const perms = getUserPermissions(profile);
    setUserCustomPerms(perms);
    
    try {
      const customUsers = JSON.parse(localStorage.getItem('almas_erp_user_permissions') || '{}');
      setIsCustomOverride(Boolean(customUsers[profile.id]));
    } catch (e) {
      setIsCustomOverride(false);
    }
    setShowUserPermsModal(true);
  };

  const handleSaveUserCustomPerms = () => {
    if (!selectedUserForPerms) return;
    saveUserCustomPermissions(selectedUserForPerms.id, userCustomPerms);
    showMessage(`Permissions updated for ${selectedUserForPerms.full_name || 'Staff'}.`, 'success');
    setShowUserPermsModal(false);
  };

  const handleResetUserToRoleDefaults = () => {
    if (!selectedUserForPerms) return;
    clearUserCustomPermissions(selectedUserForPerms.id);
    const defaultPerms = getRolePermissions(selectedUserForPerms.role || 'staff');
    setUserCustomPerms(defaultPerms);
    setIsCustomOverride(false);
    showMessage(`Reset to standard ${selectedUserForPerms.role?.replace('_', ' ')} defaults.`, 'info');
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!branchName.trim()) {
      showMessage('Branch name is required.', 'error');
      return;
    }

    if (branchPhone.trim() && !/^\+?[0-9\s\-()]{7,15}$/.test(branchPhone.trim())) {
      showMessage('Please enter a valid phone number (7-15 digits).', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('branches').insert([
        {
          name: branchName,
          address: branchAddress || null,
          phone: branchPhone || null,
        },
      ]);

      if (error) throw error;

      showMessage(`Branch "${branchName}" created successfully!`, 'success');
      resetBranchForm();
      setShowBranchModal(false);
      fetchBranches();
    } catch (err) {
      console.error('Error creating branch:', err);
      showMessage('Failed to create branch location.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Matrix permission toggle helpers
  const handleToggleMatrixPerm = (permKey) => {
    if (!permKey) return;
    setMatrixPermissions((prev) =>
      prev.includes(permKey) ? prev.filter((k) => k !== permKey) : [...prev, permKey]
    );
  };

  const handleToggleModuleKeys = (keys, isAllChecked) => {
    if (isAllChecked) {
      setMatrixPermissions((prev) => prev.filter((k) => !keys.includes(k)));
    } else {
      setMatrixPermissions((prev) => Array.from(new Set([...prev, ...keys])));
    }
  };

  const handleSelectAllMatrix = () => {
    setMatrixPermissions([...ALL_PERMISSIONS]);
  };

  const handleClearAllMatrix = () => {
    setMatrixPermissions([]);
  };

  const handleSaveRoleMatrix = () => {
    saveRolePermissions(selectedMatrixRole, matrixPermissions);
    showMessage(`Saved permissions for "${selectedMatrixRole.replace('_', ' ').toUpperCase()}".`, 'success');
  };

  const handleResetRoleMatrix = () => {
    resetRolePermissionsToDefault(selectedMatrixRole);
    setMatrixPermissions(getRolePermissions(selectedMatrixRole));
    showMessage(`Reset role "${selectedMatrixRole.replace('_', ' ')}" to default permissions.`, 'info');
  };

  // User custom perms toggle
  const handleToggleUserPerm = (permKey) => {
    if (!permKey) return;
    setIsCustomOverride(true);
    setUserCustomPerms((prev) =>
      prev.includes(permKey) ? prev.filter((k) => k !== permKey) : [...prev, permKey]
    );
  };

  const handleToggleUserModuleKeys = (keys, isAllChecked) => {
    setIsCustomOverride(true);
    if (isAllChecked) {
      setUserCustomPerms((prev) => prev.filter((k) => !keys.includes(k)));
    } else {
      setUserCustomPerms((prev) => Array.from(new Set([...prev, ...keys])));
    }
  };

  const resetUserForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('staff');
    setSelectedBranch('');
  };

  const resetBranchForm = () => {
    setBranchName('');
    setBranchAddress('');
    setBranchPhone('');
  };

  const renderModuleIcon = (iconName) => {
    switch (iconName) {
      case 'Package': return <Package size={16} style={{ color: '#059669' }} />;
      case 'Receipt': return <Receipt size={16} style={{ color: '#2563eb' }} />;
      case 'ShoppingCart': return <ShoppingCart size={16} style={{ color: '#0284c7' }} />;
      case 'CreditCard': return <CreditCard size={16} style={{ color: '#16a34a' }} />;
      case 'DollarSign': return <DollarSign size={16} style={{ color: '#d97706' }} />;
      case 'Users': return <UsersIcon size={16} style={{ color: '#7c3aed' }} />;
      case 'BarChart3': return <BarChart3 size={16} style={{ color: '#db2777' }} />;
      case 'Shield': return <Shield size={16} style={{ color: '#475569' }} />;
      default: return <Shield size={16} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="top-bar">
        <div className="page-title-group">
          <h1>User Access & Locations</h1>
        </div>
        <div className="top-bar-actions">
          {activeTab === 'users' && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                resetUserForm();
                setShowUserModal(true);
              }}
            >
              <Plus size={16} />
              <span>Create Staff Account</span>
            </button>
          )}
          {activeTab === 'branches' && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                resetBranchForm();
                setShowBranchModal(true);
              }}
            >
              <Plus size={16} />
              <span>Create Branch Location</span>
            </button>
          )}
          {activeTab === 'permissions' && (
            <button 
              className="btn btn-primary"
              onClick={handleSaveRoleMatrix}
            >
              <Save size={16} />
              <span>Save Role Permissions</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1rem' }}>
        <button
          className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: '-1px' }}
          onClick={() => setActiveTab('users')}
        >
          <UserPlus size={16} />
          <span>Staff Accounts</span>
        </button>
        <button
          className={`btn ${activeTab === 'branches' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: '-1px' }}
          onClick={() => setActiveTab('branches')}
        >
          <Building size={16} />
          <span>Branch Locations</span>
        </button>
        <button
          className={`btn ${activeTab === 'permissions' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: '-1px' }}
          onClick={() => setActiveTab('permissions')}
        >
          <Shield size={16} />
          <span>Role & Permissions Matrix</span>
        </button>
      </div>

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title">Active Profiles ({profiles.length})</h3>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>SL</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Branch Office</th>
                    <th style={{ textAlign: 'center', width: '150px' }}>Permissions</th>
                    <th style={{ textAlign: 'center', width: '190px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableLoading colSpan={7} message="Fetching user profiles..." />
                  ) : profiles.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                        No profiles found.
                      </td>
                    </tr>
                  ) : (
                    profiles.map((p, index) => {
                      const userBranch = branches.find((b) => b.id === p.branch_id);
                      const perms = getUserPermissions(p);
                      const isOwner = p.role === 'owner';

                      return (
                        <tr key={p.id}>
                          <td>{index + 1}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.full_name || 'N/A'}</td>
                          <td style={{ fontSize: '0.85rem' }}>{p.email}</td>
                          <td>
                            <span className={`badge badge-${p.role}`}>{p.role.replace('_', ' ')}</span>
                          </td>
                          <td style={{ fontWeight: 500 }}>
                            {isOwner ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>🏢 All Branches (Master)</span>
                            ) : userBranch ? (
                              userBranch.name
                            ) : (
                              <span style={{ color: 'var(--danger-text)', fontSize: '0.82rem' }}>Unassigned</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isOwner ? (
                              <span className="badge badge-paid" style={{ fontSize: '0.72rem' }}>
                                Full Master Access
                              </span>
                            ) : (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: '#eef2ff',
                                  color: '#3730a3',
                                  border: '1px solid #c7d2fe',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                }}
                              >
                                {perms.length} / {ALL_PERMISSIONS.length} active
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                              {!isOwner && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleOpenUserPerms(p)}
                                  title="Manage granular permissions for this staff member"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  <Sliders size={13} />
                                  <span>Permissions</span>
                                </button>
                              )}
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenEditUser(p)}
                                title="Edit employee role and branch"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              >
                                <Edit size={13} />
                                <span>Edit</span>
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
          </div>
        </div>
      )}

      {/* TAB 2: BRANCHES */}
      {activeTab === 'branches' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Existing Branches ({branches.length})</h3>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>SL</th>
                    <th>Branch ID</th>
                    <th>Branch Name</th>
                    <th>Phone</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                        No branches registered. Add a branch to link staff profiles.
                      </td>
                    </tr>
                  ) : (
                    branches.map((b, index) => (
                      <tr key={b.id}>
                        <td>{index + 1}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {b.id}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</td>
                        <td style={{ fontWeight: 500 }}>{b.phone || 'N/A'}</td>
                        <td>{b.address || 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ROLE PERMISSIONS MATRIX (SERIAL-WISE MODULE LAYOUT) */}
      {activeTab === 'permissions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Top Role Selector Toolbar */}
          <div className="card" style={{ padding: '0.85rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Configure Role:
                </span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    className={`btn ${selectedMatrixRole === 'branch_manager' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => setSelectedMatrixRole('branch_manager')}
                  >
                    <Shield size={13} />
                    <span>Branch Manager</span>
                  </button>
                  <button
                    type="button"
                    className={`btn ${selectedMatrixRole === 'staff' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => setSelectedMatrixRole('staff')}
                  >
                    <User size={13} />
                    <span>Staff Member</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleSelectAllMatrix}
                  style={{ fontSize: '0.75rem' }}
                >
                  <CheckSquare size={13} />
                  <span>Select All</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleClearAllMatrix}
                  style={{ fontSize: '0.75rem' }}
                >
                  <Square size={13} />
                  <span>Clear All</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetRoleMatrix}
                  style={{ fontSize: '0.75rem' }}
                  title="Reset to default permissions for this role"
                >
                  <RotateCcw size={13} />
                  <span>Reset Defaults</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveRoleMatrix}
                  style={{ fontSize: '0.75rem' }}
                >
                  <Save size={13} />
                  <span>Save Role Permissions</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sleek Minimized Module Strips (No Icons, Ultra-Clean) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {MODULE_SERIAL_PERMISSIONS.map((mod) => {
              const allModKeys = mod.groups.flatMap((g) => g.permissions.map((p) => p.key));
              const selectedModKeys = allModKeys.filter((k) => matrixPermissions.includes(k));
              const isAllModSelected = selectedModKeys.length === allModKeys.length && allModKeys.length > 0;

              return (
                <div 
                  key={mod.id} 
                  className="card" 
                  style={{ 
                    border: '1px solid var(--border-color)', 
                    padding: '0.55rem 0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.85rem',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Left: Module Title */}
                  <div style={{ minWidth: '130px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      {mod.serial}. {mod.title}
                    </span>
                  </div>

                  {/* Middle: Compact Horizontal Groups (Tabs & Actions) */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', flex: 1, alignItems: 'center' }}>
                    {mod.groups.map((grp, gIdx) => (
                      <div
                        key={gIdx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {mod.groups.length > 1 && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginRight: '0.15rem' }}>
                            {grp.title}:
                          </span>
                        )}

                        <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {grp.permissions.map((p) => {
                            const isChecked = matrixPermissions.includes(p.key);
                            return (
                              <label
                                key={p.key}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.12rem 0.4rem',
                                  borderRadius: '3px',
                                  backgroundColor: isChecked ? '#fff' : 'transparent',
                                  border: isChecked ? '1px solid #94a3b8' : '1px solid transparent',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: isChecked ? 600 : 400,
                                  color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleMatrixPerm(p.key)}
                                  style={{ cursor: 'pointer', width: '13px', height: '13px', accentColor: p.isDanger ? '#dc2626' : 'var(--primary)' }}
                                />
                                <span>{p.label}</span>
                                {p.isDanger && (
                                  <span style={{ fontSize: '0.62rem', color: '#dc2626', fontWeight: 700 }}>
                                    (Del)
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right: Quick Module Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {selectedModKeys.length}/{allModKeys.length}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleToggleModuleKeys(allModKeys, isAllModSelected)}
                      style={{ fontSize: '0.68rem', padding: '0.12rem 0.45rem' }}
                    >
                      {isAllModSelected ? 'None' : 'All'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: CUSTOM USER PERMISSIONS (WIDE, CLEAN, NO ICONS) */}
      {showUserPermsModal && selectedUserForPerms && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1240px', width: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ padding: '0.85rem 1.25rem' }}>
              <div>
                <h3 className="modal-title" style={{ fontSize: '1.05rem' }}>Permissions: {selectedUserForPerms.full_name || selectedUserForPerms.email}</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Role: <strong style={{ textTransform: 'capitalize' }}>{selectedUserForPerms.role?.replace('_', ' ')}</strong> {isCustomOverride ? '• (Custom Override)' : '• (Role Standard)'}
                </div>
              </div>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowUserPermsModal(false)} 
                style={{ borderRadius: '50%', padding: '0.35rem 0.5rem', border: 'none' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: '0.85rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Active Privileges: {userCustomPerms.length} of {ALL_PERMISSIONS.length} enabled
                </span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleResetUserToRoleDefaults}
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                  >
                    <RotateCcw size={12} />
                    <span>Reset to Role Standard</span>
                  </button>
                </div>
              </div>

              {/* Module Serial-Wise List inside Modal */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {MODULE_SERIAL_PERMISSIONS.map((mod) => {
                  const allModKeys = mod.groups.flatMap((g) => g.permissions.map((p) => p.key));
                  const selectedModKeys = allModKeys.filter((k) => userCustomPerms.includes(k));
                  const isAllModSelected = selectedModKeys.length === allModKeys.length && allModKeys.length > 0;

                  return (
                    <div 
                      key={mod.id} 
                      style={{ 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '4px',
                        padding: '0.5rem 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.85rem',
                        flexWrap: 'wrap',
                        backgroundColor: '#fff',
                      }}
                    >
                      {/* Left: Module Title */}
                      <div style={{ minWidth: '125px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                          {mod.serial}. {mod.title}
                        </span>
                      </div>

                      {/* Middle: Compact Horizontal Groups */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', flex: 1, alignItems: 'center' }}>
                        {mod.groups.map((grp, gIdx) => (
                          <div
                            key={gIdx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.18rem 0.45rem',
                              borderRadius: '4px',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {mod.groups.length > 1 && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginRight: '0.12rem' }}>
                                {grp.title}:
                              </span>
                            )}

                            <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              {grp.permissions.map((p) => {
                                const isChecked = userCustomPerms.includes(p.key);
                                return (
                                  <label
                                    key={p.key}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.28rem',
                                      padding: '0.1rem 0.35rem',
                                      borderRadius: '3px',
                                      backgroundColor: isChecked ? '#fff' : 'transparent',
                                      border: isChecked ? '1px solid #94a3b8' : '1px solid transparent',
                                      cursor: 'pointer',
                                      fontSize: '0.74rem',
                                      fontWeight: isChecked ? 600 : 400,
                                      color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleUserPerm(p.key)}
                                      style={{ cursor: 'pointer', width: '13px', height: '13px', accentColor: p.isDanger ? '#dc2626' : 'var(--primary)' }}
                                    />
                                    <span>{p.label}</span>
                                    {p.isDanger && (
                                      <span style={{ fontSize: '0.6rem', color: '#dc2626', fontWeight: 700 }}>
                                        (Del)
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Right: Quick Module Toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {selectedModKeys.length}/{allModKeys.length}
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleToggleUserModuleKeys(allModKeys, isAllModSelected)}
                          style={{ fontSize: '0.66rem', padding: '0.12rem 0.4rem' }}
                        >
                          {isAllModSelected ? 'None' : 'All'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowUserPermsModal(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSaveUserCustomPerms}
              >
                <Save size={15} />
                <span>Save Permissions</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER PROFILE MODAL */}
      {showEditUserModal && editingProfile && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', width: '100%' }}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Staff Profile</h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowEditUserModal(false)} 
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateUserProfile}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    className="input-control"
                    value={editingProfile.full_name || ''}
                    disabled
                    style={{ backgroundColor: '#f8fafc', color: 'var(--text-muted)' }}
                  />
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="text"
                    className="input-control"
                    value={editingProfile.email || ''}
                    disabled
                    style={{ backgroundColor: '#f8fafc', color: 'var(--text-muted)' }}
                  />
                </div>

                <div className="form-group">
                  <label>Role Privilege *</label>
                  <select
                    className="input-control"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    required
                  >
                    <option value="staff">Staff (Standard POS & Catalog)</option>
                    <option value="branch_manager">Branch Manager (Branch Operations Admin)</option>
                    <option value="owner">Owner (Full Multi-Branch Master)</option>
                  </select>
                </div>

                {editRole !== 'owner' && (
                  <div className="form-group">
                    <label>Assigned Branch Location *</label>
                    <select
                      className="input-control"
                      value={editBranch}
                      onChange={(e) => setEditBranch(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Branch --</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowEditUserModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE STAFF MODAL */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '100%' }}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Staff / Employee</h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => {
                  setShowUserModal(false);
                  resetUserForm();
                }} 
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label>Full Name *</label>
                  <div style={{ position: 'relative' }}>
                    <User size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="input-control"
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Email Address *</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="email"
                      className="input-control"
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="staff@almasaccessories.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Password (Temporary) *</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="password"
                      className="input-control"
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Role Privilege *</label>
                  <div style={{ position: 'relative' }}>
                    <Shield size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <select
                      className="input-control"
                      style={{ paddingLeft: '2.5rem' }}
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      required
                    >
                      <option value="staff">Staff (Basic POS / Catalog access)</option>
                      <option value="branch_manager">Branch Manager (Branch specific admin)</option>
                      <option value="owner">Owner (Full access across all branches)</option>
                    </select>
                  </div>
                </div>

                {role !== 'owner' && (
                  <div className="form-group">
                    <label>Assign Branch Location *</label>
                    <div style={{ position: 'relative' }}>
                      <Building size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <select
                        className="input-control"
                        style={{ paddingLeft: '2.5rem' }}
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        required
                      >
                        <option value="">-- Choose Branch --</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowUserModal(false);
                    resetUserForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE BRANCH MODAL */}
      {showBranchModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '100%' }}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Branch Location</h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => {
                  setShowBranchModal(false);
                  resetBranchForm();
                }} 
                style={{ borderRadius: '50%', padding: '0.4rem', border: 'none' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateBranch}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label>Branch Name *</label>
                  <div style={{ position: 'relative' }}>
                    <Building size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="input-control"
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="Dhanmondi Outlet"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Address</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={14} style={{ position: 'absolute', left: '1rem', top: '1.1rem', color: 'var(--text-muted)' }} />
                    <textarea
                      className="input-control"
                      style={{ paddingLeft: '2.5rem', minHeight: '80px', resize: 'vertical' }}
                      placeholder="House 12, Road 4, Dhanmondi, Dhaka"
                      value={branchAddress}
                      onChange={(e) => setBranchAddress(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Contact Phone</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="input-control"
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="+8801700000000"
                      value={branchPhone}
                      onChange={(e) => setBranchPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowBranchModal(false);
                    resetBranchForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
