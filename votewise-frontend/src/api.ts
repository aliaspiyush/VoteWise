const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Generates a simple client-side session ID when backend is unavailable
function generateSessionId(): string {
  return 'local_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
}

// ── Session API ───────────────────────────────────────────────────────────────
export async function createSession(data: {
  userState: string;
  isFirstTime: boolean;
  confusionTopic: string;
}) {
  // If no backend URL is configured, fall back to a local session
  if (!BASE_URL) {
    const sessionId = generateSessionId();
    const session = { sessionId, ...data };
    localStorage.setItem('votewise_session', JSON.stringify(session));
    return { sessionId };
  }

  try {
    const res = await fetch(`${BASE_URL}/api/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    return res.json();
  } catch (err) {
    // Backend unreachable — fall back to local session so the app still works
    console.warn('[VoteWise] Backend unavailable, using local session fallback.', err);
    const sessionId = generateSessionId();
    const session = { sessionId, ...data };
    localStorage.setItem('votewise_session', JSON.stringify(session));
    return { sessionId };
  }
}

// ── Timeline API ──────────────────────────────────────────────────────────────
export async function fetchTimeline(state: string) {
  const res = await fetch(`${BASE_URL}/api/gemini/timeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  if (!res.ok) throw new Error('Failed to fetch timeline');
  return res.json();
}

// ── Checklist API ─────────────────────────────────────────────────────────────
export async function fetchChecklist(state: string, voter_type: string) {
  const res = await fetch(`${BASE_URL}/api/gemini/checklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, voter_type }),
  });
  if (!res.ok) throw new Error('Failed to fetch checklist');
  return res.json();
}

// ── Quiz API ──────────────────────────────────────────────────────────────────
export async function fetchQuizQuestion(topic: string, difficulty: string, usedIds: string[]) {
  const res = await fetch(`${BASE_URL}/api/gemini/quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, difficulty, usedIds }),
  });
  if (!res.ok) throw new Error('Failed to fetch quiz question');
  return res.json();
}

// ── Chat (SSE streaming) ──────────────────────────────────────────────────────
export async function sendChatMessage(
  message: string,
  history: { role: string; parts: { text: string }[] }[],
  sessionData: { userState?: string; isFirstTime?: boolean; currentPhase?: string },
  onChunk: (text: string) => void,
  onDone: (fullText: string, functionCall?: unknown) => void,
  onError: (msg: string) => void
) {
  const res = await fetch(`${BASE_URL}/api/gemini/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, ...sessionData }),
  });

  if (!res.ok) {
    onError('ECI servers are busy. Please try again.');
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let fnCall: unknown = null;
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'text_chunk') {
          fullText += data.text;
          onChunk(data.text);
        } else if (data.type === 'text') {
          fullText = data.text;
          fnCall = data.functionCall;
          onChunk(data.text);
        } else if (data.type === 'done') {
          onDone(fullText || data.fullText || '', fnCall || undefined);
        } else if (data.type === 'error') {
          onError(data.message);
        }
      } catch {
        // ignore parse errors on partial lines
      }
    }
  }
}
