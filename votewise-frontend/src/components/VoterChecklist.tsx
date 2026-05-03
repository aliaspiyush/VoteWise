import { useState } from 'react';
import { fetchChecklist } from '../api';
import type { ChecklistItem, ChecklistData } from '../types';
import './VoterChecklist.css';

interface Props { state: string; voterType: string; }

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Critical', important: 'Important', optional: 'Optional',
};

export default function VoterChecklist({ state, voterType }: Props) {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const result = await fetchChecklist(state, voterType);
      setData(result);
    } catch {
      setError('Could not generate checklist. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function toggleCheck(id: number) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!data) {
    return (
      <div className="checklist-empty">
        <div className="checklist-empty-icon" aria-hidden="true">✓</div>
        <h3>Voter Readiness Checklist</h3>
        <p>
          Get a personalised checklist for {state || 'your state'} to make sure you're
          fully prepared for polling day.
        </p>
        <button
          id="generate-checklist-btn"
          className="btn btn-outline"
          onClick={generate}
          disabled={loading}
          style={{ fontSize: '0.875rem' }}
        >
          {loading
            ? <><span className="spinner" /> Generating…</>
            : 'Generate my checklist'
          }
        </button>
        {error && <p className="checklist-error" role="alert">{error}</p>}
      </div>
    );
  }

  const total = data.checklist.length;
  const done = checkedIds.size;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="checklist-container">
      <div className="checklist-header">
        <div>
          <p className="checklist-title">Voter Checklist</p>
          <p className="checklist-meta">{state} · {voterType}</p>
        </div>
        <span className="checklist-score-badge">{pct}% ready</span>
      </div>

      <div className="checklist-progress" role="progressbar" aria-valuenow={pct} aria-valuemax={100}>
        <div className="prog-track">
          <div className="prog-fill" style={{ width: `${pct}%` }} />
        </div>
        <span>{done}/{total}</span>
      </div>

      <ul className="checklist-list" role="list">
        {data.checklist.map((item: ChecklistItem) => {
          const isChecked = checkedIds.has(item.id);
          const isExpanded = expandedId === item.id;

          return (
            <li
              key={item.id}
              id={`checklist-item-${item.id}`}
              className={`checklist-item priority-${item.priority} ${isChecked ? 'checked' : ''}`}
            >
              <div className="checklist-row">
                <button
                  className={`check-box ${isChecked ? 'checked' : ''}`}
                  onClick={() => toggleCheck(item.id)}
                  aria-pressed={isChecked}
                  aria-label={`Mark as ${isChecked ? 'incomplete' : 'complete'}`}
                >
                  {isChecked ? '✓' : ''}
                </button>
                <div
                  className="checklist-item-content"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="checklist-item-top">
                    <span className="priority-dot" title={PRIORITY_LABEL[item.priority]} />
                    <span className={`checklist-item-text ${isChecked ? 'done-text' : ''}`}>
                      {item.item}
                    </span>
                    <button className="expand-btn" aria-expanded={isExpanded}>
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="checklist-detail fade-up">
                      {item.detail}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {pct === 100 && (
        <div className="checklist-complete fade-up">
          All set — see you at the polling booth.
        </div>
      )}
    </div>
  );
}
