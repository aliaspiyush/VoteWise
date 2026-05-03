// ── Session & User ────────────────────────────────────────────────────────────
export interface UserSession {
  sessionId: string;
  userState: string;
  isFirstTime: boolean;
  confusionTopic: string;
}

// ── Election Timeline ─────────────────────────────────────────────────────────
export type PhaseStatus = 'completed' | 'active' | 'upcoming';

export interface ElectionPhase {
  id: number;
  name: string;
  status: PhaseStatus;
  duration: string;
  keyActions: string[];
  description: string;
}

export interface TimelineData {
  state: string;
  phases: ElectionPhase[];
  currentPhase: number;
  note: string;
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export type MessageRole = 'user' | 'model';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
  functionCall?: { name: string; result: unknown };
  isStreaming?: boolean;
}

// ── Quiz ──────────────────────────────────────────────────────────────────────
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

// ── Checklist ─────────────────────────────────────────────────────────────────
export interface ChecklistItem {
  id: number;
  item: string;
  priority: 'critical' | 'important' | 'optional';
  detail: string;
  checked?: boolean;
}

export interface ChecklistData {
  state: string;
  voter_type: string;
  checklist: ChecklistItem[];
  generated_at: string;
}
