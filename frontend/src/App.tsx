import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { FileText, History, Database, Hammer, Shield, LogOut, User, KeyRound } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Generate from './pages/Generate';
import HistoryPage from './pages/History';
import MasterEditor from './pages/MasterEditor';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/AdminDashboard';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 16px' }} />
        <div style={{ color: 'var(--text-muted)' }}>Verifying session...</div>
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: JSX.Element }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 16px' }} />
        <div style={{ color: 'var(--text-muted)' }}>Verifying admin privileges...</div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function AppContent() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <div className="app-shell">
      <nav className="nav">
        <div className="nav-inner">
          <NavLink to="/" className="nav-brand">
            <div className="nav-logo-icon">
              <Hammer size={16} color="white" />
            </div>
            <span className="nav-brand-name">ResumeForge</span>
          </NavLink>

          {isAuthenticated ? (
            <ul className="nav-links">
              <li>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <FileText size={15} />
                  Generate
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/history"
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <History size={15} />
                  History
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/master"
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <Database size={15} />
                  Master Resume
                </NavLink>
              </li>
              {user?.role === 'admin' && (
                <li>
                  <NavLink
                    to="/admin"
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    style={{ color: 'var(--accent-secondary)' }}
                  >
                    <Shield size={15} />
                    Admin Panel
                  </NavLink>
                </li>
              )}
            </ul>
          ) : (
            <ul className="nav-links">
              <li>
                <NavLink to="/login" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  Sign In
                </NavLink>
              </li>
              <li>
                <NavLink to="/register" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  Register
                </NavLink>
              </li>
            </ul>
          )}

          {isAuthenticated && user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: '0.8rem', textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {user.role === 'admin' ? '👑 Admin' : '📱 ' + user.mobile}
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={logout}
                title="Log Out"
                style={{ padding: '6px 10px' }}
              >
                <LogOut size={14} /> Log Out
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="page-content">
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Application Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Generate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master"
            element={
              <ProtectedRoute>
                <MasterEditor />
              </ProtectedRoute>
            }
          />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
