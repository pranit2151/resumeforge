import { useEffect, useState, useMemo } from 'react';
import {
  FileDown, RefreshCw, History as HistoryIcon, FileText, File,
  Search, Building2, LayoutGrid, List, Mail, Copy, Check
} from 'lucide-react';
import { getHistory, downloadUrl, type ApplicationRecord } from '../api/client';

function scoreColor(score: number): string {
  if (score >= 75) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function HistoryPage() {
  const [apps, setApps] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'company'>('company');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getHistory();
      setApps(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Unique company list
  const companies = useMemo(() => {
    const list = apps.map((a) => a.company).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [apps]);

  // Filtered applications
  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      const matchCompany = selectedCompany === 'ALL' || app.company.toLowerCase() === selectedCompany.toLowerCase();
      const query = search.trim().toLowerCase();
      const matchQuery =
        !query ||
        app.company.toLowerCase().includes(query) ||
        app.job_title.toLowerCase().includes(query) ||
        (app.keywords_matched || []).some((k) => k.toLowerCase().includes(query));
      return matchCompany && matchQuery;
    });
  }, [apps, selectedCompany, search]);

  // Grouped by company
  const companyGroups = useMemo(() => {
    const map = new Map<string, ApplicationRecord[]>();
    filteredApps.forEach((app) => {
      const comp = app.company || 'Unknown Company';
      if (!map.has(comp)) map.set(comp, []);
      map.get(comp)!.push(app);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredApps]);

  const handleCopyCover = (id: number, text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Application History</h1>
          <p>Organize, filter, and review all your past tailored resumes and application messages.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn btn-sm ${viewMode === 'company' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('company')}
            title="Group applications by company"
          >
            <Building2 size={14} /> Company View
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('table')}
            title="List view"
          >
            <List size={14} /> Table View
          </button>
          <button className="btn btn-secondary btn-sm" onClick={load} id="refresh-history-btn">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      {apps.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 30, fontSize: '0.85rem' }}
                placeholder="Search by company, role, or skill..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Company Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                className="form-control"
                style={{ fontSize: '0.85rem', width: 'auto', padding: '6px 12px' }}
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
              >
                <option value="ALL">All Companies ({companies.length})</option>
                {companies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="card">
          <div className="loading-overlay">
            <div className="spinner" />
            <p>Loading history...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!loading && apps.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <HistoryIcon size={24} color="var(--text-muted)" />
            </div>
            <h3>No applications yet</h3>
            <p>Generated resumes will appear here. Go generate your first one!</p>
          </div>
        </div>
      )}

      {!loading && filteredApps.length === 0 && apps.length > 0 && (
        <div className="card">
          <div className="empty-state">
            <h3>No matching applications found</h3>
            <p>Try clearing your search query or company filter.</p>
          </div>
        </div>
      )}

      {/* ── COMPANY CARDS VIEW ── */}
      {!loading && viewMode === 'company' && companyGroups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {companyGroups.map(([companyName, companyApps]) => {
            const bestScore = Math.max(...companyApps.map((a) => a.ats_score));
            return (
              <div key={companyName} className="card animate-in" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Company Header Bar */}
                <div
                  style={{
                    padding: '12px 18px',
                    background: 'var(--bg-elevated)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Building2 size={18} color="var(--accent-secondary)" />
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {companyName}
                    </span>
                    <span className="badge badge-muted" style={{ fontSize: '0.72rem' }}>
                      {companyApps.length} application{companyApps.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Highest Score:{' '}
                      <strong style={{ color: scoreColor(bestScore) }}>{bestScore}%</strong>
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Latest: {formatDate(companyApps[0].created_at)}
                    </span>
                  </div>
                </div>

                {/* Company Application Rows */}
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {companyApps.map((app) => (
                    <div
                      key={app.id}
                      style={{
                        padding: '10px 14px',
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 200, flex: 1 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                          {app.job_title}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {formatDate(app.created_at)} · {app.actual_pages} page(s) · {app.resume_mode}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ fontWeight: 700, color: scoreColor(app.ats_score), fontSize: '1rem' }}>
                          {app.ats_score}%
                        </span>

                        {app.cover_email && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCopyCover(app.id!, app.cover_email)}
                            title="Copy Tailored Cover Email"
                          >
                            {copiedId === app.id ? (
                              <><Check size={12} color="var(--success)" /> Copied Email</>
                            ) : (
                              <><Mail size={12} /> Cover Email</>
                            )}
                          </button>
                        )}

                        <div style={{ display: 'flex', gap: 6 }}>
                          {app.pdf_path && (
                            <a
                              href={downloadUrl(app.pdf_path.split(/[\\/]/).pop()!)}
                              className="btn btn-primary btn-sm"
                              download={`Pranit_Patil_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_Resume.pdf`}
                              title="Download PDF"
                            >
                              <File size={13} /> PDF
                            </a>
                          )}
                          {app.docx_path && (
                            <a
                              href={downloadUrl(app.docx_path.split(/[\\/]/).pop()!)}
                              className="btn btn-secondary btn-sm"
                              download={`Pranit_Patil_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_Resume.docx`}
                              title="Download DOCX"
                            >
                              <FileText size={13} /> DOCX
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {!loading && viewMode === 'table' && filteredApps.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="history-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Company &amp; Role</th>
                <th>Date</th>
                <th>Mode</th>
                <th>Pages</th>
                <th>ATS Score</th>
                <th>Downloads</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredApps.map((app) => (
                <>
                  <tr key={app.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>#{app.id}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {app.company}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {app.job_title}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {formatDate(app.created_at)}
                    </td>
                    <td>
                      <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
                        {app.resume_mode === 'backend-focused' ? '⚙ Backend' : '⚡ Full-Stack'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {app.actual_pages}/{app.target_pages}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          color: scoreColor(app.ats_score),
                          fontSize: '0.95rem',
                        }}
                      >
                        {app.ats_score}%
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {app.pdf_path && (
                          <a
                            href={downloadUrl(app.pdf_path.split(/[\\/]/).pop()!)}
                            className="btn btn-primary btn-sm"
                            download={`Pranit_Patil_${app.company.replace(/[^a-zA-Z0-9]/g, '_')}_Resume.pdf`}
                            title="Download PDF"
                          >
                            <File size={13} /> PDF
                          </a>
                        )}
                        {app.docx_path && (
                          <a
                            href={downloadUrl(app.docx_path.split(/[\\/]/).pop()!)}
                            className="btn btn-secondary btn-sm"
                            download={`Pranit_Patil_${app.company.replace(/[^a-zA-Z0-9]/g, '_')}_Resume.docx`}
                            title="Download DOCX"
                          >
                            <FileText size={13} /> DOCX
                          </a>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setExpanded(expanded === app.id ? null : app.id!)}
                        aria-expanded={expanded === app.id}
                      >
                        {expanded === app.id ? '▲' : '▼'}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expanded === app.id && (
                    <tr key={`${app.id}-detail`}>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <div
                          style={{
                            padding: '16px 20px',
                            background: 'var(--bg-surface)',
                            borderTop: '1px solid var(--border-subtle)',
                          }}
                        >
                          {/* Cover Email box in table detail */}
                          {app.cover_email && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-secondary)' }}>
                                  Tailored Cover Email
                                </span>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleCopyCover(app.id!, app.cover_email)}
                                >
                                  {copiedId === app.id ? (
                                    <><Check size={12} color="var(--success)" /> Copied</>
                                  ) : (
                                    <><Copy size={12} /> Copy Email</>
                                  )}
                                </button>
                              </div>
                              <pre
                                style={{
                                  whiteSpace: 'pre-wrap',
                                  fontFamily: 'inherit',
                                  fontSize: '0.8rem',
                                  color: 'var(--text-primary)',
                                  background: 'rgba(255,255,255,0.02)',
                                  padding: '10px 12px',
                                  borderRadius: 'var(--radius-md)',
                                  border: '1px solid var(--border-subtle)',
                                  margin: 0,
                                  maxHeight: 200,
                                  overflowY: 'auto',
                                }}
                              >
                                {app.cover_email}
                              </pre>
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            {/* Keywords */}
                            <div>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  color: 'var(--success)',
                                  marginBottom: 6,
                                }}
                              >
                                Matched Keywords
                              </div>
                              <div className="keyword-list">
                                {app.keywords_matched?.slice(0, 15).map((k: string) => (
                                  <span key={k} className="badge badge-success">{k}</span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  color: 'var(--danger)',
                                  marginBottom: 6,
                                }}
                              >
                                Missing Keywords
                              </div>
                              <div className="keyword-list">
                                {app.keywords_missing?.slice(0, 15).map((k: string) => (
                                  <span key={k} className="badge badge-danger">{k}</span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Used bullets */}
                          {app.bullets_used?.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  color: 'var(--text-muted)',
                                  marginBottom: 8,
                                }}
                              >
                                {app.bullets_used.length} Bullets Used
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4,
                                  maxHeight: 200,
                                  overflowY: 'auto',
                                }}
                              >
                                {app.bullets_used.map((b: any, i: number) => (
                                  <div
                                    key={i}
                                    style={{
                                      fontSize: '0.82rem',
                                      color: 'var(--text-secondary)',
                                      padding: '4px 8px',
                                      borderLeft: '2px solid var(--success)',
                                      paddingLeft: 10,
                                    }}
                                  >
                                    {b.text || b.tailoredText || b.originalText}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

