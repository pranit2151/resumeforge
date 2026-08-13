import { useEffect, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Save, RefreshCw, AlertTriangle, CheckCircle2, Database, Info } from 'lucide-react';
import { getMasterResume, saveMasterResume } from '../api/client';

export default function MasterEditor() {
  const [jsonValue, setJsonValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMasterResume();
      setJsonValue(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setError(err.message || 'Failed to load master resume');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (value: string | undefined) => {
    const v = value || '';
    setJsonValue(v);
    setParseError(null);
    try {
      JSON.parse(v);
    } catch (e: any) {
      setParseError(e.message);
    }
  };

  const handleSave = async () => {
    if (parseError) {
      setError('Fix JSON syntax errors before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const parsed = JSON.parse(jsonValue);
      await saveMasterResume(parsed);
      setSuccess('master-resume.json saved successfully! A .bak backup was created.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut: Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [jsonValue, parseError]);

  return (
    <div>
      <div
        className="page-header"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1>Master Resume Editor</h1>
          <p>
            Edit your master-resume.json — the single source of truth for all experience, projects, and skills.
            The AI will only draw from this file, never fabricate.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={load} id="reload-master-btn">
            <RefreshCw size={14} />
            Reload
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !!parseError || loading}
            id="save-master-btn"
          >
            {saving ? (
              <><div className="spinner" /> Saving...</>
            ) : (
              <><Save size={15} /> Save (Ctrl+S)</>
            )}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="alert alert-info" style={{ marginBottom: 16 }}>
        <Info size={16} style={{ flexShrink: 0 }} />
        <span>
          <strong>Structure guide:</strong> Add bullets as objects with{' '}
          <code
            style={{
              background: 'rgba(59,130,246,0.15)',
              padding: '1px 5px',
              borderRadius: 3,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.82rem',
            }}
          >
            {`{"id":"...", "text":"...", "tags":["backend","api"]}`}
          </code>
          . Tags drive mode biasing. Every bullet must have a unique <code>id</code>.
        </span>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: 12 }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          {success}
        </div>
      )}

      {parseError && (
        <div className="alert alert-warning" style={{ marginBottom: 12 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>
            <strong>JSON Error:</strong> {parseError}
          </span>
        </div>
      )}

      <div className="monaco-wrapper">
        {loading ? (
          <div className="loading-overlay">
            <div className="spinner" />
            <p>Loading master resume...</p>
          </div>
        ) : (
          <Editor
            height="72vh"
            language="json"
            value={jsonValue}
            onChange={handleChange}
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              minimap: { enabled: true },
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              tabSize: 2,
              formatOnType: true,
              bracketPairColorization: { enabled: true },
              renderLineHighlight: 'gutter',
              smoothScrolling: true,
            }}
          />
        )}
      </div>

      {/* Schema Guide */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-title">
            <Database size={14} /> Schema Reference
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {[
            {
              section: 'contact',
              fields: ['name', 'email', 'phone', 'location', 'linkedin', 'github'],
            },
            {
              section: 'skills',
              fields: ['languages[]', 'frameworks[]', 'databases[]', 'cloud[]', 'tools[]'],
            },
            {
              section: 'experience[]',
              fields: ['id', 'company', 'role', 'start', 'end', 'location', 'bullets[{id,text,tags}]'],
            },
            {
              section: 'projects[]',
              fields: ['id', 'name', 'url', 'tech[]', 'tags[]', 'bullets[{id,text,tags}]'],
            },
            {
              section: 'education[]',
              fields: ['id', 'degree', 'school', 'year', 'gpa?', 'highlights[]?'],
            },
            {
              section: 'certifications[]',
              fields: ['id', 'name', 'issuer', 'year'],
            },
          ].map((s) => (
            <div key={s.section}>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--accent-secondary)',
                  marginBottom: 6,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {s.section}
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {s.fields.map((f) => (
                  <li
                    key={f}
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    · {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
