import { CheckCircle2, XCircle, GripVertical } from 'lucide-react';
import type { TailoredBullet } from '../api/client';

interface DiffViewProps {
  includedBullets: TailoredBullet[];
  cutBullets: TailoredBullet[];
}

function scoreBadgeClass(score: number): string {
  if (score >= 7) return 'score-high';
  if (score >= 4) return 'score-mid';
  return 'score-low';
}

function BulletCard({ bullet, type }: { bullet: TailoredBullet; type: 'included' | 'cut' }) {
  const source = bullet.source?.split(':') ?? [];
  const sourceLabel = source[0] === 'experience' ? 'Exp' : source[0] === 'project' ? 'Project' : '?';

  return (
    <div className={`bullet-item ${type === 'included' ? 'included' : 'excluded'}`}>
      <div className={`bullet-score ${scoreBadgeClass(bullet.relevanceScore)}`}>
        {bullet.relevanceScore}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="bullet-text">{bullet.tailoredText}</div>
        {bullet.tailoredText !== bullet.originalText && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginTop: '4px',
              fontStyle: 'italic',
            }}
          >
            ✏ Rewritten from: "{bullet.originalText}"
          </div>
        )}
        {type === 'cut' && bullet.reason && (
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--danger)',
              marginTop: '4px',
            }}
          >
            Reason: {bullet.reason}
          </div>
        )}
        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
          <span className="chip">{sourceLabel}</span>
          {bullet.tags?.slice(0, 3).map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DiffView({ includedBullets, cutBullets }: DiffViewProps) {
  return (
    <div className="card animate-in animate-in-delay-1">
      <div className="card-header">
        <span className="card-title">Bullet Diff View</span>
        <span className="badge badge-muted">
          {includedBullets.length} included · {cutBullets.length} cut
        </span>
      </div>

      <div className="diff-grid">
        {/* Included */}
        <div className="diff-panel">
          <div className="diff-panel-header included">
            <CheckCircle2 size={13} />
            Included ({includedBullets.length})
          </div>
          <div className="diff-panel-body">
            {includedBullets.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
                No bullets included
              </p>
            ) : (
              includedBullets.map((b) => (
                <BulletCard key={b.id} bullet={b} type="included" />
              ))
            )}
          </div>
        </div>

        {/* Cut */}
        <div className="diff-panel">
          <div className="diff-panel-header excluded">
            <XCircle size={13} />
            Cut / Excluded ({cutBullets.length})
          </div>
          <div className="diff-panel-body">
            {cutBullets.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
                No bullets were cut
              </p>
            ) : (
              cutBullets.map((b) => (
                <BulletCard key={b.id} bullet={b} type="cut" />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
