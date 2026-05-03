import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserSession } from './types';

interface AppContextValue {
  session: UserSession | null;
  setSession: (s: UserSession | null) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  chatHistory: { role: string; parts: { text: string }[] }[];
  addToChatHistory: (role: string, text: string) => void;
  clearChatHistory: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const stored = localStorage.getItem('votewise_session');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('votewise_dark') === 'true' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [chatHistory, setChatHistory] = useState<{ role: string; parts: { text: string }[] }[]>([]);

  // Persist session
  useEffect(() => {
    if (session) localStorage.setItem('votewise_session', JSON.stringify(session));
    else localStorage.removeItem('votewise_session');
  }, [session]);

  // Apply dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('votewise_dark', String(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  const addToChatHistory = (role: string, text: string) => {
    setChatHistory(prev => [...prev, { role, parts: [{ text }] }]);
  };

  const clearChatHistory = () => setChatHistory([]);

  return (
    <AppContext.Provider value={{
      session, setSession,
      darkMode, toggleDarkMode,
      chatHistory, addToChatHistory, clearChatHistory,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
