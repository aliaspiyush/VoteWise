import { GoogleGenerativeAI } from '@google/generative-ai';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

function getGemini() {
  if (!GEMINI_KEY) throw new Error('VITE_GEMINI_API_KEY is not set');
  return new GoogleGenerativeAI(GEMINI_KEY).getGenerativeModel({ model: 'gemini-1.5-flash' });
}

function generateSessionId(): string {
  return 'local_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
}

// ── Session API ───────────────────────────────────────────────────────────────
export async function createSession(data: {
  userState: string;
  isFirstTime: boolean;
  confusionTopic: string;
}) {
  if (!BASE_URL) {
    const sessionId = generateSessionId();
    localStorage.setItem('votewise_session', JSON.stringify({ sessionId, ...data }));
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
    console.warn('[VoteWise] Backend unavailable, using local session fallback.', err);
    const sessionId = generateSessionId();
    localStorage.setItem('votewise_session', JSON.stringify({ sessionId, ...data }));
    return { sessionId };
  }
}

// ── Timeline API ──────────────────────────────────────────────────────────────
export async function fetchTimeline(state: string) {
  if (BASE_URL) {
    const res = await fetch(`${BASE_URL}/api/gemini/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    });
    if (!res.ok) throw new Error('Failed to fetch timeline');
    return res.json();
  }

  // Direct Gemini fallback
  const model = getGemini();
  const prompt = `You are an Indian election expert. Generate a JSON election timeline for the state: "${state}".
Return ONLY valid JSON in this exact format, no markdown:
{
  "phases": [
    {
      "id": 1,
      "name": "Phase name",
      "duration": "Date range e.g. Jan 1 - Jan 15",
      "status": "completed" | "active" | "upcoming",
      "description": "Brief description",
      "keyActions": ["action1", "action2", "action3"]
    }
  ]
}
Include 6-8 phases covering: Announcement, Nomination Filing, Campaigning, Voting Day, Counting, Results. Make one phase "active".`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  // Strip markdown code fences if present
  const clean = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(clean);
}

// ── Checklist API ─────────────────────────────────────────────────────────────
export async function fetchChecklist(state: string, voter_type: string) {
  if (BASE_URL) {
    const res = await fetch(`${BASE_URL}/api/gemini/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, voter_type }),
    });
    if (!res.ok) throw new Error('Failed to fetch checklist');
    return res.json();
  }

  // Direct Gemini fallback
  const model = getGemini();
  const prompt = `You are an Indian election expert. Generate a voter checklist JSON for state "${state}", voter type "${voter_type}".
Return ONLY valid JSON, no markdown:
{
  "items": [
    { "id": "1", "text": "Checklist item", "category": "documents" | "preparation" | "ontheday", "required": true | false }
  ]
}
Include 8-12 items covering documents, day-of preparation, and voting day steps.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const clean = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(clean);
}

// ── Quiz API ──────────────────────────────────────────────────────────────────
export async function fetchQuizQuestion(topic: string, difficulty: string, usedIds: string[]) {
  if (BASE_URL) {
    const res = await fetch(`${BASE_URL}/api/gemini/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, difficulty, usedIds }),
    });
    if (!res.ok) throw new Error('Failed to fetch quiz question');
    return res.json();
  }

  // Direct Gemini fallback
  const model = getGemini();
  const prompt = `Generate a quiz question about Indian elections on topic "${topic}" at difficulty "${difficulty}".
Avoid these question IDs: ${usedIds.join(', ') || 'none'}.
Return ONLY valid JSON, no markdown:
{
  "id": "unique_id",
  "question": "Question text?",
  "options": ["A", "B", "C", "D"],
  "correct": 0,
  "explanation": "Why this is correct"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const clean = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(clean);
}

// ── Chat (streaming via Gemini direct fallback) ───────────────────────────────
export async function sendChatMessage(
  message: string,
  history: { role: string; parts: { text: string }[] }[],
  sessionData: { userState?: string; isFirstTime?: boolean; currentPhase?: string },
  onChunk: (text: string) => void,
  onDone: (fullText: string, functionCall?: unknown) => void,
  onError: (msg: string) => void
) {
  // Try backend first if available
  if (BASE_URL) {
    const res = await fetch(`${BASE_URL}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, ...sessionData }),
    });

    if (!res.ok) {
      // Fall through to direct Gemini below
    } else {
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
            if (data.type === 'text_chunk') { fullText += data.text; onChunk(data.text); }
            else if (data.type === 'text') { fullText = data.text; fnCall = data.functionCall; onChunk(data.text); }
            else if (data.type === 'done') { onDone(fullText || data.fullText || '', fnCall || undefined); }
            else if (data.type === 'error') { onError(data.message); }
          } catch { /* ignore partial lines */ }
        }
      }
      return;
    }
  }

  // Direct Gemini fallback (no backend)
  try {
    const model = getGemini();
    const systemPrompt = `You are VoteWise, an AI guide for Indian elections. The user is from ${sessionData.userState || 'India'}${
      sessionData.isFirstTime ? ' and is a first-time voter' : ''
    }. Answer clearly and helpfully about Indian elections, voting rights, EVM, voter ID, and the electoral process. Keep answers concise.`;

    const geminiHistory = history.map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: h.parts,
    }));

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood! I am VoteWise, ready to help with Indian elections.' }] },
        ...geminiHistory,
      ],
    });

    const result = await chat.sendMessageStream(message);
    let fullText = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullText += text;
      onChunk(text);
    }
    onDone(fullText);
  } catch (err: any) {
    console.error('[VoteWise] Gemini direct call failed:', err);
    onError('Could not reach AI. Check your API key in environment variables.');
  }
}
