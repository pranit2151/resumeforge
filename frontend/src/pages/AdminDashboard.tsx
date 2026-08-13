import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import {
  Users,
  Search,
  UserCheck,
  UserX,
  Shield,
  Trash2,
  Lock,
  Unlock,
  SlidersHorizontal,
  AlertTriangle,
  RefreshCw,
  X,
  CheckCircle2,
} from 'lucide-react';

interface UserItem {
  id: number;
  name: string;
  email: string;
  mobile: string;
  role: 'user' | 'admin';
  mobile_verified: boolean;
  is_blocked: boolean;
  failed_login_attempts: number;
  must_change_password: boolean;
  last_login_at?: string;
  created_at: string;
  services: { service_name: string; enabled: number }[];
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');

  // Modals
  const [deleteModalUser, setDeleteModalUser] = useState<UserItem | null>(null);
  const [serviceModalUser, setServiceModalUser] = useState<UserItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/users', {
        params: { search, status: statusFilter, role: roleFilter },
      });
      setUsers(res.data.users);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch user directory.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleBlock = async (user: UserItem) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/admin/users/${user.id}/block`, {
        block: !user.is_blocked,
      });
      showToast(res.data.message);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user block status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteModalUser) return;
    setActionLoading(true);
    try {
      const res = await api.delete(`/admin/users/${deleteModalUser.id}`);
      showToast(res.data.message);
      setDeleteModalUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete user.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleService = async (user: UserItem, serviceName: string, currentEnabled: boolean) => {
    setActionLoading(true);
    try {
      await api.post(`/admin/users/${user.id}/services`, {
        service_name: serviceName,
        enabled: !currentEnabled,
      });
      showToast(`Updated '${serviceName}' access for ${user.name}`);
      fetchUsers();
      // Update local modal state
      setServiceModalUser((prev) => {
        if (!prev) return null;
        const updatedServices = prev.services.map((s) =>
          s.service_name === serviceName ? { ...s, enabled: currentEnabled ? 0 : 1 } : s
        );
        return { ...prev, services: updatedServices };
      });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update service permission.');
    } finally {
      setActionLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const stats = {
    total: users.length,
    active: users.filter((u) => !u.is_blocked).length,
    blocked: users.filter((u) => u.is_blocked).length,
    admins: users.filter((u) => u.role === 'admin').length,
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield color="var(--accent-primary)" size={28} /> Admin Management Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Manage user accounts, block/unblock access, cascade delete, and control service permissions.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={fetchUsers} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spinner' : ''} /> Refresh
        </button>
      </div>

      {/* Toast Notice */}
      {toastMessage && (
        <div className="alert alert-success animate-in" style={{ marginBottom: 20 }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          {toastMessage}
        </div>
      )}

      {/* Stats Summary Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ padding: 10, background: 'rgba(59, 130, 246, 0.15)', borderRadius: 10 }}>
            <Users color="var(--accent-primary)" size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{stats.total}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Users</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ padding: 10, background: 'rgba(34, 197, 94, 0.15)', borderRadius: 10 }}>
            <UserCheck color="var(--success)" size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>{stats.active}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Accounts</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ padding: 10, background: 'rgba(239, 68, 68, 0.15)', borderRadius: 10 }}>
            <UserX color="var(--danger)" size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger)' }}>{stats.blocked}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Blocked Accounts</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ padding: 10, background: 'rgba(168, 85, 247, 0.15)', borderRadius: 10 }}>
            <Shield color="var(--accent-secondary)" size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{stats.admins}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Administrators</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: 38 }}
              placeholder="Search by name, email, or mobile number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SlidersHorizontal size={14} color="var(--text-muted)" />
            <select
              className="form-control"
              style={{ width: 140 }}
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="blocked">Blocked Only</option>
            </select>
          </div>

          {/* Role Filter */}
          <div>
            <select
              className="form-control"
              style={{ width: 130 }}
              value={roleFilter}
              onChange={(e: any) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="user">Standard User</option>
              <option value="admin">Admin Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
            <div style={{ color: 'var(--text-muted)' }}>Loading user directory...</div>
          </div>
        ) : error ? (
          <div className="alert alert-error" style={{ margin: 20 }}>
            <AlertTriangle size={16} /> {error}
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No user accounts found matching your search criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>User</th>
                  <th style={{ padding: '12px 16px' }}>Contact</th>
                  <th style={{ padding: '12px 16px' }}>Role</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Last Login</th>
                  <th style={{ padding: '12px 16px' }}>Services</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const resumeService = u.services.find((s) => s.service_name === 'resume-tailoring');
                  const serviceEnabled = resumeService ? resumeService.enabled === 1 : true;

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {/* Name & ID */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Registered: {formatDate(u.created_at)}</div>
                      </td>

                      {/* Contact */}
                      <td style={{ padding: '12px 16px' }}>
                        <div>{u.email}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          📱 +91 {u.mobile} {u.mobile_verified && <span style={{ color: 'var(--success)' }}>✓</span>}
                        </div>
                      </td>

                      {/* Role */}
                      <td style={{ padding: '12px 16px' }}>
                        {u.role === 'admin' ? (
                          <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Shield size={11} /> Admin
                          </span>
                        ) : (
                          <span className="badge badge-muted">User</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        {u.is_blocked ? (
                          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Lock size={11} /> Blocked
                          </span>
                        ) : (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Unlock size={11} /> Active
                          </span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatDate(u.last_login_at)}
                      </td>

                      {/* Services Toggle */}
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          className={`btn btn-sm ${serviceEnabled ? 'btn-secondary' : 'btn-secondary'}`}
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 8px',
                            borderColor: serviceEnabled ? 'var(--success)' : 'var(--danger)',
                            color: serviceEnabled ? 'var(--success)' : 'var(--danger)',
                          }}
                          onClick={() => setServiceModalUser(u)}
                        >
                          Resume Tailoring: {serviceEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          {/* Block/Unblock */}
                          <button
                            className={`btn btn-sm ${u.is_blocked ? 'btn-secondary' : 'btn-secondary'}`}
                            onClick={() => handleToggleBlock(u)}
                            disabled={actionLoading}
                            title={u.is_blocked ? 'Unblock User' : 'Block User'}
                          >
                            {u.is_blocked ? <Unlock size={14} color="var(--success)" /> : <Lock size={14} color="var(--danger)" />}
                          </button>

                          {/* Delete */}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setDeleteModalUser(u)}
                            disabled={actionLoading}
                            title="Delete User & History"
                          >
                            <Trash2 size={14} color="var(--danger)" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Service Permissions Modal */}
      {serviceModalUser && (
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
          <div className="card animate-in" style={{ maxWidth: 460, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Service Access: {serviceModalUser.name}</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setServiceModalUser(null)}
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
              Toggle application feature permissions for this user. Disabled services reject requests immediately with HTTP 403.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['resume-tailoring'].map((svcName) => {
                const svc = serviceModalUser.services.find((s) => s.service_name === svcName);
                const enabled = svc ? svc.enabled === 1 : true;

                return (
                  <div
                    key={svcName}
                    style={{
                      padding: 14,
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Resume Tailoring Service</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        AI keyword matching, bullet tailoring, PDF/DOCX exports
                      </div>
                    </div>

                    <button
                      className={`btn btn-sm ${enabled ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleToggleService(serviceModalUser, svcName, enabled)}
                      disabled={actionLoading}
                    >
                      {enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button className="btn btn-secondary" onClick={() => setServiceModalUser(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deleteModalUser && (
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
              <AlertTriangle size={24} color="var(--danger)" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--danger)' }}>Confirm Hard Delete</h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 12 }}>
              Are you sure you want to permanently delete user <strong>{deleteModalUser.name}</strong> (<code>{deleteModalUser.email}</code>)?
            </p>

            <div className="alert alert-error" style={{ fontSize: '0.8rem', marginBottom: 20 }}>
              ⚠️ <strong>Warning:</strong> This action cannot be undone. All generated application history and PDF/DOCX records for this user will be permanently deleted from the database.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setDeleteModalUser(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteUser} disabled={actionLoading}>
                {actionLoading ? <><div className="spinner" /> Deleting...</> : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
