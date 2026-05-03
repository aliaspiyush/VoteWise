import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context';
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import OnboardingFlow from './pages/OnboardingFlow';
import Dashboard from './pages/Dashboard';
import QuizMode from './pages/QuizMode';

export default function App() {
  const { session } = useApp();

  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/onboarding" element={<OnboardingFlow />} />
        <Route
          path="/dashboard"
          element={session ? <Dashboard /> : <Navigate to="/onboarding" replace />}
        />
        <Route
          path="/quiz"
          element={session ? <QuizMode /> : <Navigate to="/onboarding" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
