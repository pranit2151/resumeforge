import { useState, useCallback } from 'react';
import {
  Wand2, FileDown, RefreshCw, AlertTriangle, CheckCircle2,
  FileText, File, Zap, Settings2, Mail, Copy, Check
} from 'lucide-react';
import {
  generateResume, finalizeResume, downloadUrl, getMasterResume, saveMasterResume,
  type GenerateResponse, type TailoredBullet
} from '../api/client';
import AtsScoreCard from '../components/AtsScoreCard';
import DiffView from '../components/DiffView';
import BulletOverride from '../components/BulletOverride';

type Mode = 'backend-focused' | 'fullstack-focused';
type TargetPages = 1 | 2;
type Step = 'idle' | 'analyzing' | 'rendering' | 'done' | 'error';

const LOADING_STEPS = [
  { key: 'analyzing', label: 'Analyzing JD with Groq LLM...' },
  { key: 'selecting', label: 'Selecting & scoring bullets...' },
  { key: 'rendering', label: 'Rendering ATS-safe PDF...' },
  { key: 'fitting', label: 'Enforcing page limit...' },
  { key: 'docx', label: 'Generating DOCX...' },
  { key: 'scoring', label: 'Calculating ATS score...' },
];

export default function Generate() {
  const [jd, setJd] = useState('');
  const [mode, setMode] = useState<Mode>('fullstack-focused');
  const [targetPages, setTargetPages] = useState<TargetPages>(1);
  const [step, setStep] = useState<Step>('idle');
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [overrideBullets, setOverrideBullets] = useState<TailoredBullet[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState<Partial<GenerateResponse> | null>(null);
  const [tempSkills, setTempSkills] = useState<string[]>([]);
  const [savingPerm, setSavingPerm] = useState<string | null>(null);
  const [permSavedSkills, setPermSavedSkills] = useState<string[]>([]);
  // Live ATS state — recalculates client-side as skills are added
  const [liveMatched, setLiveMatched] = useState<string[]>([]);
  const [liveMissing, setLiveMissing] = useState<string[]>([]);
  // Custom Download Filename & Cover Email
  const [customFileName, setCustomFileName] = useState<string>('');
  const [copiedCover, setCopiedCover] = useState<boolean>(false);

  const handleGenerate = useCallback(async () => {
    if (!jd.trim() || jd.length < 50) {
      setError('Please paste a job description of at least 50 characters.');
      return;
    }

    setError(null);
    setResult(null);
    setFinalizeResult(null);
    setStep('analyzing');
    // Reset skill state on new generation
    setTempSkills([]);
    setPermSavedSkills([]);
    setLiveMatched([]);
    setLiveMissing([]);
    setCopiedCover(false);

    // Animate through loading steps
    let stepIdx = 0;
    const stepInterval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, LOADING_STEPS.length - 1);
      setLoadingStep(stepIdx);
    }, 3000);

    try {
      const data = await generateResume({ jd, mode, targetPages, tempSkills });
      clearInterval(stepInterval);
      setResult(data);
      setOverrideBullets([...data.includedBullets, ...data.cutBullets]);
      // Seed live ATS state from result
      setLiveMatched(data.keywordsMatched);
      setLiveMissing(data.keywordsMissing);
      // Pre-fill clean default custom filename
      const cleanCompany = (data.company || 'Company').replace(/[^a-zA-Z0-9]/g, '_');
      const cleanRole = (data.jobTitle || 'Resume').replace(/[^a-zA-Z0-9]/g, '_');
      setCustomFileName(`Pranit_Patil_${cleanCompany}_${cleanRole}`);
      setStep('done');
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.response?.data?.error || err.message || 'Generation failed.');
      setStep('error');
    }
  }, [jd, mode, targetPages]);

  const handleFinalize = useCallback(async () => {
    if (!result) return;
    setIsFinalizing(true);
    setError(null);
    try {
      const data = await finalizeResume({
        jd,
        mode,
        targetPages,
        overrideBullets,
        tempSkills,
      });
      setFinalizeResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Finalize failed.');
    } finally {
      setIsFinalizing(false);
    }
  }, [result, jd, mode, targetPages, overrideBullets, tempSkills]);

  // ── Move keyword from missing → matched live (shared by temp + perm) ──
  const applyLiveScore = useCallback((skill: string) => {
    const lower = skill.toLowerCase();
    setLiveMissing((prev) => {
      const nowMatched = prev.filter((kw) => kw.toLowerCase() === lower);
      const stillMissing = prev.filter((kw) => kw.toLowerCase() !== lower);
      if (nowMatched.length > 0) {
        setLiveMatched((m) => [...m, ...nowMatched]);
      }
      return stillMissing;
    });
  }, []);

  // ── Temporary skill: boosts ATS score for this session only ──
  const handleAddTemp = useCallback((skill: string) => {
    setTempSkills((prev) => prev.includes(skill) ? prev : [...prev, skill]);
    applyLiveScore(skill);
  }, [applyLiveScore]);

  // ── Permanent skill: writes to master-resume.json ──
  const handleAddPerm = useCallback(async (skill: string) => {
    // Guard: already saved or currently saving
    if (permSavedSkills.includes(skill) || savingPerm === skill) return;
    setSavingPerm(skill);
    try {
      const master = await getMasterResume();
      // Append to the appropriate skills array (deduplicated)
      const allExisting = [
        ...(master.skills?.languages ?? []),
        ...(master.skills?.frameworks ?? []),
        ...(master.skills?.tools ?? []),
        ...(master.skills?.databases ?? []),
      ].map((s: string) => s.toLowerCase());
      if (!allExisting.includes(skill.toLowerCase())) {
        master.skills.languages = [...(master.skills?.languages ?? []), skill];
      }
      await saveMasterResume(master);
      setPermSavedSkills((prev) =>
        prev.includes(skill) ? prev : [...prev, skill]
      );
      // Also count as temp for live score boost
      setTempSkills((prev) => prev.includes(skill) ? prev : [...prev, skill]);
      applyLiveScore(skill);
    } catch (err: any) {
      setError(`Failed to save "${skill}" to master: ${err.message}`);
    } finally {
      setSavingPerm(null);
    }
  }, []);

  const activeResult = finalizeResult || result;
  const pdfFile = (finalizeResult?.pdfFileName || result?.pdfFileName);
  const docxFile = (finalizeResult?.docxFileName || result?.docxFileName);

  return (
    <div>
      <div className="page-header">
        <h1>Generate Tailored Resume</h1>
        <p>Paste a job description and get an ATS-safe, page-perfect resume in seconds.</p>
      </div>

      <div className="generate-layout">
        {/* ── LEFT: Input Panel ── */}
        <div className="generate-sidebar">
          {/* JD Textarea */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <FileText size={14} /> Job Description
              </span>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="jd-input">Paste JD here</label>
              <textarea
                id="jd-input"
                className="form-control"
                style={{ minHeight: '260px' }}
                placeholder="Paste the full job description here. Include required skills, responsibilities, and qualifications for best results..."
                value={jd}
                onChange={(e) => setJd(e.target.value)}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                {jd.length} characters
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Settings2 size={14} /> Options
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Resume Mode</label>
                <div className="toggle-group" role="radiogroup" aria-label="Resume mode">
                  {(['backend-focused', 'fullstack-focused'] as Mode[]).map((m) => (
                    <div
                      key={m}
                      className={`toggle-option${mode === m ? ' active' : ''}`}
                      onClick={() => setMode(m)}
                      role="radio"
                      aria-checked={mode === m}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setMode(m)}
                    >
                      {m === 'backend-focused' ? '⚙ Backend' : '⚡ Full-Stack'}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {mode === 'backend-focused'
                    ? 'Prioritizes API, database, infrastructure bullets'
                    : 'Balances frontend & backend experience'}
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Target Page Count</label>
                <div className="toggle-group" role="radiogroup" aria-label="Target pages">
                  {([1, 2] as TargetPages[]).map((p) => (
                    <div
                      key={p}
                      className={`toggle-option${targetPages === p ? ' active' : ''}`}
                      onClick={() => setTargetPages(p)}
                      role="radio"
                      aria-checked={targetPages === p}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setTargetPages(p)}
                    >
                      {p === 1 ? '1 Page' : '2 Pages'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            id="generate-btn"
            className="btn btn-primary btn-lg"
            onClick={handleGenerate}
            disabled={step === 'analyzing' || step === 'rendering'}
            style={{ width: '100%' }}
          >
            {step === 'analyzing' || step === 'rendering' ? (
              <><div className="spinner" /> Generating...</>
            ) : (
              <><Wand2 size={18} /> Generate Resume</>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="alert alert-error">
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Download Links with Custom Filename */}
          {activeResult && pdfFile && (
            <div className="card animate-in">
              <div className="card-header">
                <span className="card-title">
                  <FileDown size={14} /> Downloads
                </span>
                {finalizeResult && (
                  <span className="badge badge-success">
                    <CheckCircle2 size={11} /> Finalized
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                    Custom File Name:
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="e.g. Pranit_Patil_Resume"
                  />
                </div>

                <a
                  href={downloadUrl(pdfFile)}
                  className="btn btn-primary"
                  download={customFileName ? `${customFileName.trim()}.pdf` : true}
                  id="download-pdf-btn"
                >
                  <File size={16} /> Download PDF
                </a>
                {docxFile && (
                  <a
                    href={downloadUrl(docxFile)}
                    className="btn btn-secondary"
                    download={customFileName ? `${customFileName.trim()}.docx` : true}
                    id="download-docx-btn"
                  >
                    <FileText size={16} /> Download DOCX
                  </a>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {activeResult.pageCount || 1} page(s) · ATS Score: {
                    liveMatched.length + liveMissing.length > 0
                      ? Math.round(liveMatched.length / (liveMatched.length + liveMissing.length) * 100)
                      : activeResult.atsScore
                  }%
                  · {result?.company} – {result?.jobTitle}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Results ── */}
        <div className="generate-main">
          {/* Loading */}
          {(step === 'analyzing' || step === 'rendering') && (
            <div className="card">
              <div className="loading-overlay">
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
                <div>
                  <h3 style={{ marginBottom: 16, textAlign: 'center' }}>Crafting your resume...</h3>
                  <ul className="loading-steps">
                    {LOADING_STEPS.map((s, idx) => (
                      <li
                        key={s.key}
                        className={`loading-step ${
                          idx < loadingStep ? 'done' : idx === loadingStep ? 'active' : ''
                        }`}
                      >
                        <div className="step-dot" />
                        {s.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
                  This takes 15–30 seconds for LLM + PDF generation.
                </p>
              </div>
            </div>
          )}

          {/* Idle */}
          {step === 'idle' && (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Zap size={24} color="var(--accent-secondary)" />
                </div>
                <h3>Ready to forge your resume</h3>
                <p style={{ maxWidth: 360 }}>
                  Paste a job description, choose your mode &amp; page target, then click "Generate Resume."
                  The AI will tailor your master resume in 15–30 seconds.
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {step === 'done' && result && (
            <>
              {/* ATS Score */}
              {permSavedSkills.length > 0 && (
                <div className="alert alert-success" style={{ marginBottom: 0 }}>
                  <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>{permSavedSkills.join(', ')}</strong> permanently saved to your master resume.
                  </span>
                </div>
              )}
              <AtsScoreCard
                score={liveMatched.length + liveMissing.length > 0
                  ? Math.round(liveMatched.length / (liveMatched.length + liveMissing.length) * 100)
                  : (activeResult?.atsScore ?? result.atsScore)}
                matched={liveMatched.length > 0 ? liveMatched : (activeResult?.keywordsMatched ?? result.keywordsMatched)}
                missing={liveMatched.length > 0 ? liveMissing : (activeResult?.keywordsMissing ?? result.keywordsMissing)}
                matchFlags={result.matchFlags}
                tempSkills={tempSkills}
                permSavedSkills={permSavedSkills}
                onAddTemp={handleAddTemp}
                onAddPerm={handleAddPerm}
                savingPerm={savingPerm}
              />

              {/* Cover Email & Application Message */}
              {(result.coverEmail || activeResult?.coverEmail) && (
                <div className="card animate-in">
                  <div className="card-header">
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={16} color="var(--accent-secondary)" />
                      Tailored Cover Email / Application Message
                    </span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const emailText = activeResult?.coverEmail || result.coverEmail || '';
                        navigator.clipboard.writeText(emailText);
                        setCopiedCover(true);
                        setTimeout(() => setCopiedCover(false), 2000);
                      }}
                    >
                      {copiedCover ? (
                        <><Check size={14} color="var(--success)" /> Copied!</>
                      ) : (
                        <><Copy size={14} /> Copy to Clipboard</>
                      )}
                    </button>
                  </div>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      fontSize: '0.85rem',
                      lineHeight: '1.6',
                      color: 'var(--text-primary)',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      margin: 0,
                    }}
                  >
                    {activeResult?.coverEmail || result.coverEmail}
                  </pre>
                </div>
              )}

              {/* Diff View */}
              <DiffView
                includedBullets={result.includedBullets}
                cutBullets={result.cutBullets}
              />

              {/* Override Panel */}
              <BulletOverride
                bullets={overrideBullets}
                onChange={setOverrideBullets}
              />

              {/* Finalize Button */}
              <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem' }}>Ready to finalize?</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Apply your manual overrides &amp; re-export both PDF and DOCX.
                  </p>
                </div>
                <button
                  id="finalize-btn"
                  className="btn btn-success"
                  onClick={handleFinalize}
                  disabled={isFinalizing}
                >
                  {isFinalizing ? (
                    <><div className="spinner" /> Re-generating...</>
                  ) : (
                    <><RefreshCw size={15} /> Finalize &amp; Export</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
