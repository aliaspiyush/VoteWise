import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context';
import { createSession } from '../api';
import './OnboardingFlow.css';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Puducherry','Chandigarh',
];

const CONFUSION_TOPICS = [
  'Don\'t understand the election phases',
  'Not sure how to check my voter ID / registration',
  'Confused about what to bring on voting day',
  'Want to know about NOTA and my rights',
  'Interested in the Model Code of Conduct',
  'Want to understand EVM voting',
  'First-time voter — need full guidance',
  'Other',
];

export default function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [userState, setUserState] = useState('');
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [confusionTopic, setConfusionTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { setSession } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPage = searchParams.get('next') || 'dashboard';

  const canNext = [
    !!userState,
    isFirstTime !== null,
    !!confusionTopic,
  ];

  async function handleFinish() {
    setLoading(true);
    setError('');
    try {
      const data = await createSession({
        userState,
        isFirstTime: isFirstTime!,
        confusionTopic,
      });
      setSession({
        sessionId: data.sessionId,
        userState,
        isFirstTime: isFirstTime!,
        confusionTopic,
      });
      navigate(nextPage === 'quiz' ? '/quiz' : '/dashboard');
    } catch {
      setError('Failed to create session. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    {
      title: 'Which state are you in?',
      subtitle: 'We\'ll personalise your election timeline and information.',
      content: (
        <div className="step-content">
          <div className="state-grid">
            {INDIAN_STATES.map(state => (
              <button
                key={state}
                id={`state-${state.replace(/\s+/g, '-').toLowerCase()}`}
                className={`state-btn ${userState === state ? 'selected' : ''}`}
                onClick={() => setUserState(state)}
                aria-pressed={userState === state}
              >
                {state}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Are you a first-time voter?',
      subtitle: 'We\'ll tailor advice based on your experience level.',
      content: (
        <div className="step-content">
          <div className="toggle-cards">
            <button
              id="first-time-yes"
              className={`toggle-card ${isFirstTime === true ? 'selected' : ''}`}
              onClick={() => setIsFirstTime(true)}
              aria-pressed={isFirstTime === true}
            >
              <span className="toggle-icon">🌟</span>
              <span className="toggle-label">Yes, first time!</span>
              <span className="toggle-sub">I need full guidance</span>
            </button>
            <button
              id="first-time-no"
              className={`toggle-card ${isFirstTime === false ? 'selected' : ''}`}
              onClick={() => setIsFirstTime(false)}
              aria-pressed={isFirstTime === false}
            >
              <span className="toggle-icon">🗳️</span>
              <span className="toggle-label">No, I've voted before</span>
              <span className="toggle-sub">Just need a refresher</span>
            </button>
          </div>
        </div>
      ),
    },
    {
      title: 'What confuses you most?',
      subtitle: 'VoteWise will focus on this topic in your personalised guide.',
      content: (
        <div className="step-content">
          <div className="topic-list">
            {CONFUSION_TOPICS.map(topic => (
              <button
                key={topic}
                id={`topic-${topic.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                className={`topic-btn ${confusionTopic === topic ? 'selected' : ''}`}
                onClick={() => setConfusionTopic(topic)}
                aria-pressed={confusionTopic === topic}
              >
                <span className="topic-text">{topic}</span>
                <span className="topic-check" aria-hidden="true">{confusionTopic === topic ? '✓' : ''}</span>
              </button>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <main className="onboarding" aria-labelledby="onboarding-heading">
      <div className="onboarding-card">
        {/* Progress */}
        <div className="step-progress" role="progressbar" aria-valuenow={step + 1} aria-valuemax={3}>
          {[0, 1, 2].map(i => (
            <div key={i} className="step-bar">
              <div className="step-bar-fill" style={{ width: i <= step ? '100%' : '0%' }} />
            </div>
          ))}
          <span className="step-counter">{step + 1}/3</span>
        </div>

        <h1 id="onboarding-heading" className="onboarding-title">
          {steps[step].title}
        </h1>
        <p className="onboarding-subtitle">{steps[step].subtitle}</p>

        <div className="onboarding-body">
          {steps[step].content}
        </div>

        {error && <p className="onboarding-error" role="alert">{error}</p>}

        {/* Navigation */}
        <div className="onboarding-nav">
          {step > 0 && (
            <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>
              ← Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 2 ? (
            <button
              className="btn btn-primary"
              disabled={!canNext[step]}
              onClick={() => setStep(s => s + 1)}
              id="onboarding-next"
            >
              Continue →
            </button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={!canNext[2] || loading}
              onClick={handleFinish}
              id="onboarding-finish"
            >
              {loading ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> Setting up...</>
              ) : (
                '🗳️ Start My Journey →'
              )}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
