import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Lock, ArrowRight, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<'details' | 'otp'>('details');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (step === 'otp' && resendTimer > 0) {
      interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !mobile || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!/^[0-9]{10}$/.test(mobile.trim())) {
      setError('Mobile number must be exactly 10 digits.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post('/api/auth/register-request-otp', {
        name: name.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        password,
      });

      setStep('otp');
      setResendTimer(60);
      setCanResend(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setError('Please enter the 6-digit OTP sent to your mobile.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await axios.post('/api/auth/register-verify-otp', {
        name: name.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        password,
        otp_code: otpCode.trim(),
      });

      const { user, accessToken, refreshToken } = res.data;
      login({ user, accessToken, refreshToken });
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    setLoading(true);
    setError(null);

    try {
      await axios.post('/api/auth/register-request-otp', {
        name: name.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        password,
      });
      setResendTimer(60);
      setCanResend(false);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: '30px auto 0', padding: '0 16px' }}>
      <div className="card animate-in">
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
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
            {step === 'details' ? (
              <User size={28} color="var(--accent-primary)" />
            ) : (
              <KeyRound size={28} color="var(--accent-primary)" />
            )}
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 6px 0' }}>
            {step === 'details' ? 'Create Your Account' : 'Verify Mobile OTP'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {step === 'details'
              ? 'Enter your details to generate your tailored resumes'
              : `6-digit code sent to +91 ${mobile}`}
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {step === 'details' ? (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">Full Name</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-name"
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 38 }}
                  placeholder="e.g. Pranit Patil"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email Address</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-email"
                  type="email"
                  className="form-control"
                  style={{ paddingLeft: 38 }}
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-mobile">Mobile Number (10 digits)</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-mobile"
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 38 }}
                  placeholder="e.g. 9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                />
                <Phone size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-password"
                  type="password"
                  className="form-control"
                  style={{ paddingLeft: 38 }}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 6 }}>
              {loading ? <><div className="spinner" /> Sending OTP...</> : <>Send Verification OTP <ArrowRight size={18} /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="alert alert-info" style={{ fontSize: '0.8rem' }}>
              💡 <strong>Dev Notice:</strong> Check your server console log for the 6-digit OTP code.
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="otp-input" style={{ textAlign: 'center' }}>
                Enter 6-Digit OTP Code
              </label>
              <input
                id="otp-input"
                type="text"
                className="form-control"
                style={{
                  fontSize: '1.4rem',
                  letterSpacing: '8px',
                  textAlign: 'center',
                  fontWeight: 700,
                  padding: '10px',
                }}
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                autoFocus
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
              {loading ? <><div className="spinner" /> Verifying...</> : <><CheckCircle2 size={18} /> Verify & Complete Registration</>}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setStep('details')}
              >
                Change Details
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResendOtp}
                disabled={!canResend || loading}
              >
                {canResend ? 'Resend OTP' : `Resend in ${resendTimer}s`}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
