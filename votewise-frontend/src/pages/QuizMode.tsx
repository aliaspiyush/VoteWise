import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchQuizQuestion } from '../api';
import type { QuizQuestion } from '../types';
import './QuizMode.css';

const QUIZ_TOPICS = ['EVM', 'NOTA', 'MCC', 'Voting Rights', 'Election Process', 'Voter Registration'];
const DIFFICULTIES: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
const TOTAL_QUESTIONS = 10;
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

// ── Score Card ─────────────────────────────────────────────────────────────────
function ScoreCard({ score, total, onRestart }: { score: number; total: number; onRestart: () => void }) {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pct = Math.round((score / total) * 100);
  const badge = pct >= 80 ? 'Civic Champion' : pct >= 60 ? 'Informed Voter' : 'Keep Learning';
  const msg =
    pct >= 80 ? 'Excellent. You know your civic rights inside out.' :
    pct >= 60 ? 'Great result. You are a well-informed citizen.' :
    'Good start. Keep exploring VoteWise to sharpen your knowledge.';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 560; canvas.height = 280;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 560, 280);

    // Flag bar
    [['#FF9933', 0], ['#ffffff', 8], ['#138808', 16]].forEach(([c, y]) => {
      ctx.fillStyle = c as string;
      ctx.fillRect(0, y as number, 560, 8);
    });

    ctx.fillStyle = '#ececec';
    ctx.font = '600 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VoteWise', 280, 90);

    ctx.fillStyle = '#888';
    ctx.font = '400 14px Inter, sans-serif';
    ctx.fillText('Voter IQ Quiz', 280, 115);

    ctx.fillStyle = '#ececec';
    ctx.font = '700 64px Inter, sans-serif';
    ctx.fillText(`${score}/${total}`, 280, 195);

    ctx.fillStyle = '#10a37f';
    ctx.font = '600 16px Inter, sans-serif';
    ctx.fillText(badge, 280, 225);

    ctx.fillStyle = '#444';
    ctx.font = '400 12px Inter, sans-serif';
    ctx.fillText('votewise.web.app', 280, 260);
  }, [score, total, badge]);

  function downloadCard() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'votewise-score.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <div className="score-screen">
      <div className="score-card">
        <span className="score-badge-row">{badge}</span>
        <p className="score-number">
          {score}<span className="score-denom">/{total}</span>
        </p>
        <p className="score-pct-row">{pct}% correct</p>
        <p className="score-msg">{msg}</p>
        <canvas ref={canvasRef} className="score-canvas" aria-hidden="true" />
        <div className="score-actions">
          <button className="btn btn-primary" onClick={onRestart} id="quiz-restart-btn">Try again</button>
          <button className="btn btn-outline" onClick={downloadCard} id="quiz-share-btn">Download score card</button>
          <button className="btn btn-ghost" onClick={() => navigate('/dashboard')} id="quiz-dashboard-btn">Back to dashboard</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Quiz ──────────────────────────────────────────────────────────────────
export default function QuizMode() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [usedIds, setUsedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quizDone, setQuizDone] = useState(false);
  const [started, setStarted] = useState(false);

  const currentQ = questions[currentIdx];
  const progress = Math.round((currentIdx / TOTAL_QUESTIONS) * 100);

  const loadQuestion = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelected(null);
    setRevealed(false);
    try {
      const topic = QUIZ_TOPICS[Math.floor(Math.random() * QUIZ_TOPICS.length)];
      const difficulty = DIFFICULTIES[Math.min(Math.floor(questions.length / 4), 2)];
      const q = await fetchQuizQuestion(topic, difficulty, usedIds);
      setQuestions(prev => [...prev, q]);
      setUsedIds(prev => [...prev, q.id]);
    } catch {
      setError('Could not load question. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [usedIds, questions.length]);

  async function startQuiz() {
    setStarted(true);
    setQuestions([]); setCurrentIdx(0);
    setScore(0); setUsedIds([]);
    setQuizDone(false); setSelected(null); setRevealed(false);
    // loadQuestion will fire via useEffect
  }

  useEffect(() => {
    if (started && !quizDone && questions.length <= currentIdx && !loading) {
      loadQuestion();
    }
  }, [currentIdx, started, questions.length, quizDone, loading, loadQuestion]);

  function handleSelect(label: string) {
    if (revealed) return;
    setSelected(label);
    setRevealed(true);
    if (label === currentQ.correct) setScore(s => s + 1);
  }

  function handleNext() {
    const next = currentIdx + 1;
    if (next >= TOTAL_QUESTIONS) setQuizDone(true);
    else setCurrentIdx(next);
  }

  function handleRestart() {
    setStarted(false); setQuestions([]); setCurrentIdx(0);
    setScore(0); setUsedIds([]); setQuizDone(false);
    setSelected(null); setRevealed(false);
  }

  // ── Intro ────────────────────────────────────────────────────────────────────
  if (!started) {
    return (
      <main className="quiz-page" aria-labelledby="quiz-heading">
        <div className="quiz-intro">
          <div className="quiz-intro-icon" aria-hidden="true">◈</div>
          <h1 id="quiz-heading" className="quiz-intro-title">Voter IQ Quiz</h1>
          <p className="quiz-intro-desc">
            {TOTAL_QUESTIONS} adaptive questions generated by Gemini AI.
            Topics cover EVMs, NOTA, MCC, voting rights, and more.
            Difficulty increases as you progress.
          </p>
          <div className="quiz-meta-row">
            {[`${TOTAL_QUESTIONS} questions`, 'Adaptive difficulty', 'Instant explanations', 'Shareable score'].map(t => (
              <span key={t} className="quiz-meta-tag">{t}</span>
            ))}
          </div>
          <button id="start-quiz-btn" className="btn btn-primary quiz-start-btn" onClick={startQuiz}>
            Start quiz
          </button>
          <p className="quiz-hint">Questions are unique per session · Powered by Gemini AI</p>
        </div>
      </main>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (quizDone) {
    return (
      <main className="quiz-page">
        <ScoreCard score={score} total={TOTAL_QUESTIONS} onRestart={handleRestart} />
      </main>
    );
  }

  // ── Question ─────────────────────────────────────────────────────────────────
  return (
    <main className="quiz-page" aria-labelledby="question-heading">
      <div className="quiz-header">
        <div className="quiz-prog-track">
          <div className="quiz-prog-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="quiz-prog-meta">
          <span>Question {currentIdx + 1} of {TOTAL_QUESTIONS}</span>
          <span className="quiz-score-live">Score {score}/{currentIdx}</span>
        </div>
      </div>

      <div className="quiz-content">
        {loading && !currentQ ? (
          <div className="quiz-loading">
            <span className="spinner" style={{ width: 24, height: 24 }} />
            <p>Generating question…</p>
          </div>
        ) : error ? (
          <div className="quiz-error">
            <p>{error}</p>
            <button className="btn btn-ghost" style={{ fontSize: '0.8125rem' }} onClick={loadQuestion}>Retry</button>
          </div>
        ) : currentQ ? (
          <div className="question-card" key={currentIdx}>
            <div className="question-meta">
              <span className="q-badge">{currentQ.topic}</span>
              <span className={`q-badge diff-${currentQ.difficulty}`}>{currentQ.difficulty}</span>
            </div>

            <h2 id="question-heading" className="question-text">{currentQ.question}</h2>

            <div className="options-grid" role="radiogroup" aria-label="Answer options">
              {currentQ.options.map((opt, i) => {
                const label = OPTION_LABELS[i];
                const isCorrect = label === currentQ.correct;
                const isSelected = label === selected;
                let cls = 'option-btn';
                if (revealed) {
                  cls += isCorrect ? ' correct' : isSelected ? ' wrong' : ' dimmed';
                } else if (isSelected) cls += ' selected';

                return (
                  <button
                    key={label}
                    id={`option-${label}`}
                    className={cls}
                    onClick={() => handleSelect(label)}
                    disabled={revealed}
                    aria-pressed={isSelected}
                    role="radio"
                    aria-checked={isSelected}
                  >
                    <span className="option-label">{label}</span>
                    <span className="option-text">{opt.replace(/^[A-D]\)\s*/, '')}</span>
                    {revealed && isCorrect && <span className="option-tick">✓</span>}
                    {revealed && isSelected && !isCorrect && <span className="option-cross">✗</span>}
                  </button>
                );
              })}
            </div>

            {revealed && (
              <div className={`explanation ${selected === currentQ.correct ? 'correct' : 'wrong'}`}>
                <p className="explanation-header">
                  {selected === currentQ.correct ? 'Correct' : `Incorrect — answer was ${currentQ.correct}`}
                </p>
                <p className="explanation-text">{currentQ.explanation}</p>
              </div>
            )}

            {revealed && (
              <button
                id="next-question-btn"
                className="btn btn-primary next-btn"
                onClick={handleNext}
              >
                {currentIdx + 1 >= TOTAL_QUESTIONS ? 'See results' : 'Next question'}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
