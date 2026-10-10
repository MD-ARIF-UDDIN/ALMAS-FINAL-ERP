import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Auth from './views/Auth';
import Sidebar from './components/Sidebar';
import { Menu } from 'lucide-react';
import logo from './assets/almas_logo.jpg';

// Code-split route components for lightning-fast initial load & page transitions
const Dashboard = lazy(() => import('./views/Dashboard'));
const Users = lazy(() => import('./views/Users'));
const Product = lazy(() => import('./views/Product'));
const Inventory = lazy(() => import('./views/Inventory'));
const Sales = lazy(() => import('./views/Sales'));
const Purchases = lazy(() => import('./views/Purchases'));
const Payments = lazy(() => import('./views/Payments'));
const Expenses = lazy(() => import('./views/Expenses'));
const Reports = lazy(() => import('./views/Reports'));
const Contacts = lazy(() => import('./views/Contacts'));
// BranchChallans removed — not required for branch operations
const Returns = lazy(() => import('./views/Returns'));

function App() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  // Global toast states
  const [toasts, setToasts] = useState([]);

  const addToast = (text, type = 'info') => {
    let message = '';
    if (typeof text === 'string') {
      message = text;
    } else if (text instanceof Error) {
      message = text.message || 'An error occurred';
    } else if (typeof text === 'object' && text !== null) {
      message = text.message || text.error_description || text.msg || JSON.stringify(text);
    } else {
      message = String(text ?? '');
    }
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text: message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      const branchList = data || [];
      setBranches(branchList);
      return branchList;
    } catch (err) {
      console.error('Error fetching branches:', err);
      return [];
    }
  };

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserProfile(data);
      return data;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return null;
    }
  };

  // Monitor auth state changes on mount with coordinated initialization
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(session);
        if (session) {
          await Promise.allSettled([
            fetchUserProfile(session.user.id),
            fetchBranches(),
          ]);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setSession(session);
      if (session) {
        await Promise.allSettled([
          fetchUserProfile(session.user.id),
          fetchBranches(),
        ]);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserProfile(null);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="app-loader-container">
        <div className="app-loader-card">
          <div className="app-loader-logo-wrapper">
            <div className="app-loader-ring"></div>
            <div className="app-loader-ring-pulse"></div>
            <img src={logo} alt="ALMAS ERP" className="app-loader-logo-img" />
          </div>
          <h2 className="app-loader-title">ALMAS <span>ACCESSORIES</span></h2>
          <p className="app-loader-subtitle">Enterprise Resource Planning</p>
          <div className="app-loader-progress-track">
            <div className="app-loader-progress-bar"></div>
          </div>
          <div className="app-loader-status">
            <div className="app-loader-status-dot"></div>
            <span>Connecting securely to database...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!session || !userProfile) {
    return <Auth onAuthSuccess={(s) => setSession(s)} />;
  }

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile Top Navbar */}
      <div className="mobile-header no-print">
        <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
          <Menu size={20} />
        </button>
        <div className="mobile-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <img src={logo} alt="Almas Logo" style={{ width: '26px', height: '26px', objectFit: 'contain', borderRadius: '4px' }} />
          <span style={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#0369a1' }}>ALMAS ERP</span>
        </div>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {userProfile?.role === 'owner' ? 'Owner' : (branches.find(b => b.id === userProfile?.branch_id)?.name || '')}
        </div>
      </div>

      {/* Backdrop Overlay for Mobile Sidebar */}
      {isSidebarOpen && (
        <div className="sidebar-overlay no-print" onClick={() => setIsSidebarOpen(false)} />
      )}

      <Sidebar
        userProfile={userProfile}
        onLogout={handleLogout}
        branches={branches}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={(val) => {
          setIsSidebarCollapsed(val);
          localStorage.setItem('sidebar_collapsed', val);
        }}
      />
      <main className="main-content">
        <Suspense
          fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '0.6rem', color: 'var(--text-secondary)' }}>
              <div className="table-loading-spinner" style={{ width: '22px', height: '22px' }}></div>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Loading view...</span>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Dashboard userProfile={userProfile} branches={branches} addToast={addToast} />} />
            <Route 
              path="/users" 
              element={
                userProfile?.role === 'owner' ? (
                  <Users userProfile={userProfile} branches={branches} fetchBranches={fetchBranches} addToast={addToast} defaultTab="users" />
                ) : (
                  <Navigate to="/" replace />
                )
              } 
            />
            <Route 
              path="/branches" 
              element={
                userProfile?.role === 'owner' ? (
                  <Users userProfile={userProfile} branches={branches} fetchBranches={fetchBranches} addToast={addToast} defaultTab="branches" />
                ) : (
                  <Navigate to="/" replace />
                )
              } 
            />
            <Route 
              path="/permissions" 
              element={
                userProfile?.role === 'owner' ? (
                  <Users userProfile={userProfile} branches={branches} fetchBranches={fetchBranches} addToast={addToast} defaultTab="permissions" />
                ) : (
                  <Navigate to="/" replace />
                )
              } 
            />
            <Route path="/products" element={<Product userProfile={userProfile} branches={branches} addToast={addToast} />} />
            <Route path="/inventory" element={<Inventory userProfile={userProfile} branches={branches} addToast={addToast} />} />
            {/* /challans route removed — Branch Challans not required */}
            <Route path="/sales" element={<Sales userProfile={userProfile} branches={branches} addToast={addToast} />} />
            <Route path="/returns" element={<Returns userProfile={userProfile} branches={branches} addToast={addToast} />} />
            <Route path="/purchases" element={<Purchases userProfile={userProfile} branches={branches} addToast={addToast} />} />
            <Route path="/payments" element={<Payments userProfile={userProfile} branches={branches} addToast={addToast} />} />
            <Route path="/expenses" element={<Expenses userProfile={userProfile} branches={branches} addToast={addToast} />} />
            <Route path="/reports" element={<Reports userProfile={userProfile} branches={branches} addToast={addToast} />} />
            <Route path="/contacts" element={<Contacts userProfile={userProfile} branches={branches} addToast={addToast} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* Toast Notification Container */}
      <div className="toast-container no-print">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item toast-${toast.type}`}>
            <span className="toast-message">{toast.text}</span>
            <button className="toast-close" onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
