import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Phone, Eye, EyeOff, ArrowRight, Lock, ShieldCheck } from 'lucide-react';
import logo from '../assets/almas_logo.jpg';

export default function Auth({ onAuthSuccess }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [focusedField, setFocusedField] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const rawInput = phone.trim();
    if (!rawInput || !password) {
      setErrorMsg('Please enter both phone number and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      let loginEmail = rawInput.toLowerCase();

      // If it is a phone number without @
      if (!rawInput.includes('@')) {
        const cleanPhone = rawInput.replace(/[^0-9+]/g, '');
        const normalized = cleanPhone.replace('+', '');
        loginEmail = `${normalized}@almas.local`;

        // Check if there is an existing profile with this phone number or email match
        try {
          const { data: profileMatch } = await supabase
            .from('profiles')
            .select('email')
            .or(`email.ilike.${normalized}@almas.local,email.ilike.%${normalized}%`)
            .limit(1);

          if (profileMatch && profileMatch.length > 0 && profileMatch[0].email) {
            loginEmail = profileMatch[0].email;
          }
        } catch (lookupErr) {
          console.warn('Profile phone lookup notice:', lookupErr);
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) throw error;
      if (data.session) {
        onAuthSuccess(data.session);
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrorMsg(error.message || 'Invalid phone number or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-canvas">
      {/* Refined Ambient Glow */}
      <div className="auth-ambient-glow" />

      {/* Grid Pattern */}
      <div className="auth-grid-pattern" />

      {/* Card Wrapper */}
      <div className="auth-card-wrapper">
        <div className="auth-card">
          {/* Brand Header */}
          <div className="auth-brand-header">
            <div className="brand-logo-container">
              <img src={logo} alt="Almas Accessories Logo" className="brand-logo-img" />
            </div>
            <h1 className="auth-brand-title">ALMAS ACCESSORIES</h1>
            <p className="auth-brand-subtitle">Enterprise Resource Planning</p>
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="auth-error-banner">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="auth-form">
            {/* Phone Number Field */}
            <div className="auth-input-group">
              <label htmlFor="auth-phone" className="auth-label">
                Phone Number / Email
              </label>
              <div className={`auth-input-wrapper ${focusedField === 'phone' ? 'focused' : ''}`}>
                <Phone size={17} className="auth-input-icon" />
                <input
                  id="auth-phone"
                  type="text"
                  placeholder="e.g. 01825334505"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField('')}
                  required
                  autoComplete="username"
                  className="auth-input"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="auth-input-group">
              <label htmlFor="auth-password" className="auth-label">
                Password
              </label>
              <div className={`auth-input-wrapper ${focusedField === 'password' ? 'focused' : ''}`}>
                <Lock size={17} className="auth-input-icon" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField('')}
                  required
                  autoComplete="current-password"
                  className="auth-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-eye-btn"
                  tabIndex="-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
            >
              {loading ? (
                <div className="auth-spinner" />
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={17} className="auth-btn-arrow" />
                </>
              )}
            </button>
          </form>

          {/* Secure Portal Footer */}
          <div className="auth-footer-badge">
            <ShieldCheck size={14} />
            <span>Secure Authorized Portal</span>
          </div>
        </div>
      </div>

      <style>{`
        .auth-canvas {
          position: relative;
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #0b0f19;
          background-image: 
            radial-gradient(circle at 50% 0%, rgba(30, 58, 138, 0.28) 0%, transparent 60%),
            radial-gradient(circle at 50% 100%, rgba(15, 23, 42, 0.8) 0%, transparent 80%);
          overflow: hidden;
          padding: 1.5rem;
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .auth-ambient-glow {
          position: absolute;
          width: 550px;
          height: 550px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, rgba(37, 99, 235, 0.05) 50%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          filter: blur(50px);
          pointer-events: none;
        }

        .auth-grid-pattern {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse at center, black 40%, transparent 75%);
          pointer-events: none;
        }

        .auth-card-wrapper {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          animation: cardFadeIn 0.5s ease-out forwards;
        }

        @keyframes cardFadeIn {
          0% {
            opacity: 0;
            transform: translateY(16px) scale(0.99);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .auth-card {
          background: rgba(15, 23, 42, 0.82);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          padding: 2.5rem 2.2rem;
          box-shadow: 
            0 20px 45px -10px rgba(0, 0, 0, 0.6),
            0 0 0 1px rgba(255, 255, 255, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
          display: flex;
          flex-direction: column;
        }

        .auth-brand-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 1.85rem;
          text-align: center;
        }

        .brand-logo-container {
          width: 68px;
          height: 68px;
          border-radius: 14px;
          background: #ffffff;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.15);
          overflow: hidden;
        }

        .brand-logo-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 8px;
        }

        .auth-brand-title {
          margin: 0;
          font-size: 1.45rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #f8fafc;
        }

        .auth-brand-subtitle {
          margin: 0.35rem 0 0 0;
          font-size: 0.8rem;
          color: #94a3b8;
          font-weight: 500;
          letter-spacing: 0.2px;
        }

        .auth-error-banner {
          background: rgba(220, 38, 38, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 0.65rem 0.9rem;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 500;
          margin-bottom: 1.25rem;
          text-align: center;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
        }

        .auth-input-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .auth-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: #cbd5e1;
        }

        .auth-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          background: rgba(2, 6, 23, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .auth-input-wrapper.focused {
          border-color: #38bdf8;
          background: rgba(2, 6, 23, 0.8);
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
        }

        .auth-input-icon {
          position: absolute;
          left: 0.9rem;
          color: #64748b;
          pointer-events: none;
          transition: color 0.2s ease;
        }

        .auth-input-wrapper.focused .auth-input-icon {
          color: #38bdf8;
        }

        .auth-input {
          width: 100%;
          background: transparent;
          border: none;
          padding: 0.72rem 2.6rem 0.72rem 2.6rem;
          color: #f8fafc;
          font-size: 0.88rem;
          outline: none;
          font-family: inherit;
        }

        .auth-input::placeholder {
          color: #475569;
          font-size: 0.82rem;
        }

        .auth-eye-btn {
          position: absolute;
          right: 0.75rem;
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s ease;
        }

        .auth-eye-btn:hover {
          color: #cbd5e1;
        }

        .auth-submit-btn {
          margin-top: 0.35rem;
          width: 100%;
          padding: 0.78rem 1.2rem;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          color: #ffffff;
          font-size: 0.9rem;
          font-weight: 600;
          letter-spacing: 0.2px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
          transition: all 0.2s ease;
        }

        .auth-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
          box-shadow: 0 6px 16px rgba(2, 132, 199, 0.4);
          transform: translateY(-1px);
        }

        .auth-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .auth-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .auth-btn-arrow {
          transition: transform 0.2s ease;
        }

        .auth-submit-btn:hover .auth-btn-arrow {
          transform: translateX(3px);
        }

        .auth-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .auth-footer-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          margin-top: 1.6rem;
          color: #64748b;
          font-size: 0.74rem;
          font-weight: 500;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
