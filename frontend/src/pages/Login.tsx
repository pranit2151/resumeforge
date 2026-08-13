import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Lock, Phone, ArrowRight, AlertTriangle, ShieldCheck, KeyRound } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login, updateUser } = useAuth();

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Admin Force Change Password Modal State
  const [mustChangeModal, setMustChangeModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeLoading, setChangeLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || !password) {
      setError('Please enter your mobile number (or admin email) and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await axios.post('/api/auth/login', { mobile: mobile.trim(), password });
      const { user, accessToken, refreshToken } = res.data;

      login({ user, accessToken, refreshToken });

      if (user.mustChangePassword) {
        setCurrentPassword(password);
        setMustChangeModal(true);
      } else {
        if (user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setChangeError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeError('New passwords do not match.');
      return;
    }

    setChangeLoading(true);
    setChangeError(null);

    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(
        '/api/auth/change-password',
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateUser({ mustChangePassword: false });
      setMustChangeModal(false);
      navigate('/admin');
    } catch (err: any) {
      setChangeError(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setChangeLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '40px auto 0', padding: '0 16px' }}>
      <div className="card animate-in">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--accent-glow)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <ShieldCheck size={28} color="var(--accent-primary)" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px 0' }}>Welcome Back</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Log in with your mobile number to access ResumeForge
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-mobile">
              Mobile Number (or Email for Admin)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-mobile"
                type="text"
                className="form-control"
                style={{ paddingLeft: 38 }}
                placeholder="e.g. 8788413561"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
              />
              <Phone
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="login-password">
                Password
              </label>
              <Link
                to="/forgot-password"
                style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textDecoration: 'none' }}
              >
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type="password"
                className="form-control"
                style={{ paddingLeft: 38 }}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: '100%', marginTop: 8 }}
          >
            {loading ? (
              <><div className="spinner" /> Logging in...</>
            ) : (
              <>Sign In <ArrowRight size={18} /></>
            )}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
            Register with Mobile OTP
          </Link>
        </div>
      </div>

      {/* Force Change Password Modal */}
      {mustChangeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div className="card animate-in" style={{ maxWidth: 440, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <KeyRound size={22} color="var(--accent-secondary)" />
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Change Default Password</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
              For security, you must set a custom password for your administrator account on first boot.
            </p>

            {changeError && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                {changeError}
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={changeLoading}>
                {changeLoading ? <><div className="spinner" /> Saving...</> : 'Set Password & Continue'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
