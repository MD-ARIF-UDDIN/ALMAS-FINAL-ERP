import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { KeyRound, Mail, Eye, EyeOff, ShieldCheck, Sparkles, ArrowRight, Lock } from 'lucide-react';
import logo from '../assets/logo.svg';

export default function Auth({ onAuthSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [focusedField, setFocusedField] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      if (data.session) {
        onAuthSuccess(data.session);
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrorMsg(error.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-canvas">
      {/* Dynamic Animated Ambient Glow Orbs */}
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />
      <div className="glow-orb glow-orb-3" />

      {/* Subtle Geometric Thread Mesh Grid */}
      <div className="auth-grid-overlay" />

      {/* Main Glassmorphic Login Container */}
      <div className="auth-card-wrapper">
        <div className="auth-card">
          {/* Brand Header */}
          <div className="auth-brand-header">
            <div className="brand-badge-container">
              <img src={logo} alt="Almas ERP" className="brand-logo-img" />
            </div>
            <h1 className="auth-brand-title">ALMAS ACCESSORIES</h1>
            <p className="auth-brand-subtitle">Enterprise Resource Planning & Multi-Branch Hub</p>
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="auth-error-banner">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="auth-form">
            {/* Email Field */}
            <div className="auth-input-group">
              <label htmlFor="auth-email" className="auth-label">
                Work Email Address
              </label>
              <div className={`auth-input-wrapper ${focusedField === 'email' ? 'focused' : ''}`}>
                <Mail size={17} className="auth-input-icon" />
                <input
                  id="auth-email"
                  type="email"
                  placeholder="name@almasaccessories.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField('')}
                  required
                  autoComplete="email"
                  className="auth-input"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="auth-input-group">
              <label htmlFor="auth-password" className="auth-label">
                Security Password
              </label>
              <div className={`auth-input-wrapper ${focusedField === 'password' ? 'focused' : ''}`}>
                <Lock size={17} className="auth-input-icon" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
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
                  <span>Sign In to System</span>
                  <ArrowRight size={17} className="auth-btn-arrow" />
                </>
              )}
            </button>
          </form>

          {/* Footer Security Badges */}
          <div className="auth-footer-badge">
            <ShieldCheck size={14} className="auth-shield-icon" />
            <span>256-Bit Encrypted Session • Multi-Branch Isolated</span>
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
          background-color: #090d16;
          background-image: 
            radial-gradient(at 15% 20%, rgba(30, 58, 138, 0.45) 0px, transparent 50%),
            radial-gradient(at 85% 80%, rgba(13, 148, 136, 0.35) 0px, transparent 50%),
            radial-gradient(at 50% 50%, rgba(15, 23, 42, 0.9) 0px, transparent 100%);
          overflow: hidden;
          padding: 1.5rem;
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* Ambient Glowing Spheres */
        .glow-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          opacity: 0.6;
          animation: floatOrb 18s ease-in-out infinite alternate;
        }

        .glow-orb-1 {
          width: 380px;
          height: 380px;
          background: linear-gradient(135deg, #2563eb, #38bdf8);
          top: -80px;
          left: 10%;
          animation-duration: 20s;
        }

        .glow-orb-2 {
          width: 420px;
          height: 420px;
          background: linear-gradient(135deg, #059669, #10b981);
          bottom: -100px;
          right: 8%;
          animation-duration: 24s;
          animation-delay: -5s;
        }

        .glow-orb-3 {
          width: 260px;
          height: 260px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          top: 40%;
          right: 25%;
          animation-duration: 16s;
          animation-delay: -10s;
        }

        @keyframes floatOrb {
          0% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(35px, 45px) scale(1.1);
          }
          100% {
            transform: translate(-30px, -25px) scale(0.95);
          }
        }

        /* Subtle Grid Mesh Overlay */
        .auth-grid-overlay {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
          pointer-events: none;
        }

        /* Glassmorphic Container */
        .auth-card-wrapper {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 440px;
          animation: cardEntrance 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes cardEntrance {
          0% {
            opacity: 0;
            transform: translateY(24px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .auth-card {
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          padding: 2.75rem 2.25rem;
          box-shadow: 
            0 20px 40px -15px rgba(0, 0, 0, 0.7),
            0 0 0 1px rgba(255, 255, 255, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
          display: flex;
          flex-direction: column;
        }

        .auth-brand-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 2rem;
          text-align: center;
        }

        .brand-badge-container {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04));
          border: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.1rem;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.3);
          transition: transform 0.3s ease;
        }

        .brand-badge-container:hover {
          transform: translateY(-2px) scale(1.04);
        }

        .brand-logo-img {
          width: 40px;
          height: 40px;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
        }

        .auth-brand-title {
          margin: 0;
          font-size: 1.55rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          background: linear-gradient(135deg, #ffffff 30%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .auth-brand-subtitle {
          margin: 0.4rem 0 0 0;
          font-size: 0.82rem;
          color: #94a3b8;
          font-weight: 500;
          letter-spacing: 0.2px;
        }

        .auth-error-banner {
          background: rgba(220, 38, 38, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #fca5a5;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          font-size: 0.82rem;
          font-weight: 500;
          margin-bottom: 1.35rem;
          animation: shake 0.4s ease;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .auth-input-group {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .auth-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: #cbd5e1;
          letter-spacing: 0.2px;
        }

        .auth-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          background: rgba(2, 6, 23, 0.65);
          border: 1.5px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          transition: all 0.25s ease;
        }

        .auth-input-wrapper.focused {
          border-color: #38bdf8;
          background: rgba(2, 6, 23, 0.85);
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.18), 0 4px 12px rgba(0, 0, 0, 0.25);
        }

        .auth-input-icon {
          position: absolute;
          left: 0.95rem;
          color: #64748b;
          pointer-events: none;
          transition: color 0.25s ease;
        }

        .auth-input-wrapper.focused .auth-input-icon {
          color: #38bdf8;
        }

        .auth-input {
          width: 100%;
          background: transparent;
          border: none;
          padding: 0.78rem 2.8rem 0.78rem 2.8rem;
          color: #ffffff;
          font-size: 0.9rem;
          outline: none;
          font-family: inherit;
        }

        .auth-input::placeholder {
          color: #475569;
          font-size: 0.85rem;
        }

        .auth-eye-btn {
          position: absolute;
          right: 0.85rem;
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 0.3rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s ease;
        }

        .auth-eye-btn:hover {
          color: #cbd5e1;
        }

        .auth-submit-btn {
          margin-top: 0.5rem;
          position: relative;
          width: 100%;
          padding: 0.85rem 1.25rem;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          color: #ffffff;
          font-size: 0.92rem;
          font-weight: 700;
          letter-spacing: 0.3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25);
          transition: all 0.25s ease;
        }

        .auth-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
          transform: translateY(-1.5px);
          box-shadow: 0 6px 20px rgba(2, 132, 199, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.35);
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
          width: 20px;
          height: 20px;
          border: 2.5px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .auth-footer-badge {
          margin-top: 2rem;
          padding-top: 1.25rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 500;
        }

        .auth-shield-icon {
          color: #10b981;
        }
      `}</style>
    </div>
  );
}
