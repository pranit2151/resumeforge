import { CheckCircle2, XCircle, Clock, BookmarkPlus } from 'lucide-react';

interface AtsScoreCardProps {
  score: number;
  matched: string[];
  missing: string[];
  matchFlags?: { have: string[]; missing: string[] };
  tempSkills?: string[];
  permSavedSkills?: string[];
  onAddTemp?: (skill: string) => void;
  onAddPerm?: (skill: string) => void;
  savingPerm?: string | null;
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

export default function AtsScoreCard({
  score,
  matched,
  missing,
  matchFlags,
  tempSkills = [],
  permSavedSkills = [],
  onAddTemp,
  onAddPerm,
  savingPerm,
}: AtsScoreCardProps) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const color = getScoreColor(score);
  const offset = circumference - (score / 100) * circumference;

  const label =
    score >= 75 ? 'Strong Match' :
    score >= 50 ? 'Moderate Match' :
    'Weak Match';

  // Skills flagged by LLM as truly absent from master resume
  const masterGaps = new Set((matchFlags?.missing ?? []).map((s) => s.toLowerCase()));
  const hasActions = onAddTemp || onAddPerm;

  return (
    <div className="card animate-in">
      <div className="card-header">
        <span className="card-title">ATS Match Score</span>
        <span
          className={`badge ${
            score >= 75 ? 'badge-success' : score >= 50 ? 'badge-warning' : 'badge-danger'
          }`}
        >
          {label}
        </span>
      </div>

      <div className="ats-card">
        {/* Score Ring */}
        <div className="score-ring-container">
          <div className="score-ring">
            <svg viewBox="0 0 96 96" width="96" height="96">
              <circle className="score-ring-track" cx="48" cy="48" r={radius} />
              <circle
                className="score-ring-fill"
                cx="48"
                cy="48"
                r={radius}
                stroke={color}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
              />
            </svg>
            <div className="score-ring-label">
              {score}
              <small>%</small>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            {matched.length}/{matched.length + missing.length} keywords
          </div>
        </div>

        {/* Keywords */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minWidth: 0 }}>

          {/* ── Matched ── */}
          {matched.length > 0 && (
            <div>
              <div className="ats-section-label" style={{ color: 'var(--success)' }}>
                <CheckCircle2 size={12} />
                Matched ({matched.length})
              </div>
              <div className="keyword-list">
                {matched.slice(0, 20).map((kw) => (
                  <span key={kw} className="badge badge-success">{kw}</span>
                ))}
                {matched.length > 20 && (
                  <span className="badge badge-muted">+{matched.length - 20} more</span>
                )}
              </div>
            </div>
          )}

          {/* ── Missing — with add buttons ── */}
          {missing.length > 0 && (
            <div>
              <div className="ats-section-label" style={{ color: 'var(--danger)' }}>
                <XCircle size={12} />
                Missing ({missing.length})
              </div>

              {/* Legend */}
              {hasActions && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {onAddTemp && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <Clock size={10} style={{ color: '#60a5fa' }} />
                      +Temp — this resume only
                    </div>
                  )}
                  {onAddPerm && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <BookmarkPlus size={10} style={{ color: '#34d399' }} />
                      +Master — save permanently
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {missing.map((kw) => {
                  const isTemp = tempSkills.includes(kw);
                  const isSaving = savingPerm === kw;
                  const isGap = masterGaps.has(kw.toLowerCase());
                  return (
                    <div key={kw} className="skill-gap-row">
                      {/* Keyword badge */}
                      <span
                        className={`badge ${isTemp ? 'badge-info' : 'badge-danger'}`}
                        style={{ flex: 1 }}
                        title={isGap ? 'Not found in master resume' : 'Synonym/format mismatch with your skills'}
                      >
                        {isTemp && <Clock size={10} style={{ marginRight: 3 }} />}
                        {kw}
                        {isTemp && <span style={{ opacity: 0.65, marginLeft: 4, fontSize: '0.65rem' }}>(temp)</span>}
                        {isGap && !isTemp && (
                          <span style={{ opacity: 0.6, marginLeft: 4, fontSize: '0.65rem' }}>⚠ not in master</span>
                        )}
                      </span>

                      {/* Action buttons */}
                      {hasActions && (
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          {!isTemp && onAddTemp && (
                            <button
                              className="skill-gap-btn skill-gap-btn-temp"
                              onClick={() => onAddTemp(kw)}
                              title="Add temporarily — boosts ATS score for this resume only"
                              id={`add-temp-${kw.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`}
                            >
                              <Clock size={10} />
                              +Temp
                            </button>
                          )}
                          {onAddPerm && (() => {
                            const isPermanent = permSavedSkills.includes(kw);
                            const isSaving = savingPerm === kw;
                            if (isPermanent) {
                              return (
                                <span className="skill-gap-btn skill-gap-saved" title="Saved to master resume">
                                  <CheckCircle2 size={10} />
                                  Saved
                                </span>
                              );
                            }
                            return (
                              <button
                                className="skill-gap-btn skill-gap-btn-perm"
                                onClick={() => onAddPerm(kw)}
                                disabled={isSaving}
                                title="Save to master resume permanently"
                                id={`add-perm-${kw.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`}
                              >
                                {isSaving ? (
                                  <><div className="spinner" style={{ width: 8, height: 8, borderWidth: 1 }} />Saving…</>
                                ) : (
                                  <><BookmarkPlus size={10} />+Master</>
                                )}
                              </button>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
