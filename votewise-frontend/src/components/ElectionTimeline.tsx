import { useState, useEffect } from 'react';
import { fetchTimeline } from '../api';
import type { ElectionPhase, TimelineData } from '../types';
import './ElectionTimeline.css';

interface Props { state: string; }

function PhaseDetailPanel({ phase }: { phase: ElectionPhase }) {
  return (
    <div className="phase-detail" aria-live="polite">
      <p className="phase-detail-name">Phase {phase.id} — {phase.name}</p>
      <span className={`phase-status-pill ${phase.status}`}>
        {phase.status === 'active' ? '● Active now' : phase.status === 'completed' ? '✓ Completed' : '○ Upcoming'}
      </span>
      <p className="phase-detail-desc">{phase.description}</p>
      <p className="phase-detail-dur">Duration: <strong>{phase.duration}</strong></p>
      <p className="actions-heading">Key actions</p>
      <ul className="actions-list">
        {phase.keyActions.map((action, i) => (
          <li key={i} className="action-item">
            <span className="action-dot" aria-hidden="true" />
            {action}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ElectionTimeline({ state }: Props) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<ElectionPhase | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchTimeline(state)
      .then(d => {
        setData(d);
        const active = d.phases.find((p: ElectionPhase) => p.status === 'active');
        if (active) setSelectedPhase(active);
      })
      .catch(() => setError('Could not load timeline.'))
      .finally(() => setLoading(false));
  }, [state]);

  if (loading) {
    return (
      <div className="timeline-container">
        <div className="timeline-skel">
          <div className="skeleton" style={{ height: 18, width: '55%' }} />
          <div className="skeleton" style={{ height: 13, width: '75%' }} />
          {[1,2,3,4,5,6,7].map(i => (
            <div key={i} className="skeleton" style={{ height: 44 }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="timeline-container">
        <div className="timeline-error">
          <p>{error || 'No data'}</p>
          <button className="btn btn-ghost" style={{ fontSize: '0.8125rem' }} onClick={() => setLoading(true)}>Retry</button>
        </div>
      </div>
    );
  }

  const completedCount = data.phases.filter(p => p.status === 'completed').length;
  const progressPct = Math.round((completedCount / data.phases.length) * 100);

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <p className="timeline-title">Election Timeline</p>
        <div className="timeline-state-tag">
          <span className="timeline-state-dot" />
          {state}
        </div>
        <div className="timeline-progress" role="progressbar" aria-valuenow={progressPct} aria-valuemax={100}>
          <div className="prog-track">
            <div className="prog-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="prog-label">{progressPct}% done</span>
        </div>
      </div>

      <div className="phases-list" role="list">
        {data.phases.map(phase => (
          <button
            key={phase.id}
            id={`phase-card-${phase.id}`}
            className={`phase-card status-${phase.status} ${selectedPhase?.id === phase.id ? 'selected' : ''} ${phase.status === 'active' ? 'pulse-ring' : ''}`}
            onClick={() => setSelectedPhase(prev => prev?.id === phase.id ? null : phase)}
            aria-expanded={selectedPhase?.id === phase.id}
            aria-label={`Phase ${phase.id}: ${phase.name}`}
            role="listitem"
          >
            <div className="phase-card-left">
              <div className="phase-card-index" aria-hidden="true">
                {phase.status === 'completed' ? '✓' : phase.id}
              </div>
              <div className="phase-card-info">
                <span className="phase-card-name">{phase.name}</span>
                <span className="phase-card-dur">{phase.duration}</span>
              </div>
            </div>
            <span className="phase-chevron" aria-hidden="true">›</span>
          </button>
        ))}
      </div>

      {selectedPhase && <PhaseDetailPanel phase={selectedPhase} />}
    </div>
  );
}
