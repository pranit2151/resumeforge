import { useState } from 'react';
import { GripVertical, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import type { TailoredBullet } from '../api/client';

interface BulletOverrideProps {
  bullets: TailoredBullet[];
  onChange: (bullets: TailoredBullet[]) => void;
}

function scoreBadgeClass(score: number): string {
  if (score >= 7) return 'score-high';
  if (score >= 4) return 'score-mid';
  return 'score-low';
}

export default function BulletOverride({ bullets, onChange }: BulletOverrideProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const toggle = (idx: number) => {
    const next = [...bullets];
    next[idx] = { ...next[idx], included: !next[idx].included };
    onChange(next);
  };

  const move = (from: number, direction: 'up' | 'down') => {
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= bullets.length) return;
    const next = [...bullets];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOver(idx);
  };
  const handleDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) {
      setDragIdx(null);
      setDragOver(null);
      return;
    }
    const next = [...bullets];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(toIdx, 0, moved);
    onChange(next);
    setDragIdx(null);
    setDragOver(null);
  };

  const includedCount = bullets.filter((b) => b.included).length;

  return (
    <div className="card animate-in animate-in-delay-2">
      <div className="card-header">
        <span className="card-title">Manual Override Panel</span>
        <span className="badge badge-accent">
          {includedCount} / {bullets.length} active
        </span>
      </div>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Toggle bullets on/off, drag to reorder, then click "Finalize &amp; Export" to re-generate.
        Scores indicate relevance to the JD (10 = perfect match).
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {bullets.map((bullet, idx) => {
          const source = bullet.source?.split(':') ?? [];
          const sourceLabel = source[0] === 'experience' ? 'Exp' : 'Proj';
          return (
            <div
              key={bullet.id}
              className={`bullet-item ${bullet.included ? 'included' : 'excluded'} ${dragIdx === idx ? 'dragging' : ''}`}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setDragOver(null); }}
              style={{
                outline: dragOver === idx ? '2px dashed var(--accent-primary)' : undefined,
                outlineOffset: '2px',
              }}
            >
              {/* Drag handle */}
              <div
                style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }}
                title="Drag to reorder"
              >
                <GripVertical size={16} />
              </div>

              {/* Score */}
              <div className={`bullet-score ${scoreBadgeClass(bullet.relevanceScore)}`}>
                {bullet.relevanceScore}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="bullet-text"
                  style={{ opacity: bullet.included ? 1 : 0.5 }}
                >
                  {bullet.tailoredText}
                </div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <span className="chip">{sourceLabel}</span>
                  {bullet.tags?.slice(0, 3).map((t) => (
                    <span key={t} className="chip">{t}</span>
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className="bullet-controls">
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => move(idx, 'up')}
                  disabled={idx === 0}
                  title="Move up"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => move(idx, 'down')}
                  disabled={idx === bullets.length - 1}
                  title="Move down"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  className={`btn btn-icon btn-sm ${bullet.included ? 'btn-ghost' : 'btn-secondary'}`}
                  onClick={() => toggle(idx)}
                  title={bullet.included ? 'Exclude this bullet' : 'Include this bullet'}
                  style={{ color: bullet.included ? 'var(--success)' : 'var(--text-muted)' }}
                >
                  {bullet.included ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
