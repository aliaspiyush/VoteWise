import { Router } from 'express';
import { getModel, getProModel } from '../gemini.js';

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Parse JSON embedded in a Gemini markdown code-fence (```json … ```) */
function extractJSON(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fence ? fence[1].trim() : text.trim());
}

// ── Election Timeline ──────────────────────────────────────────────────────────

/**
 * POST /api/gemini/timeline
 * Body: { state }
 */
router.post('/timeline', async (req, res) => {
  const { state } = req.body;
  if (!state) return res.status(400).json({ error: 'state is required' });

  const prompt = `
You are an Indian election information assistant.
Generate a realistic election timeline for the state "${state}" in India.

Return ONLY valid JSON (no markdown fences) in this exact shape:
{
  "state": "${state}",
  "phases": [
    {
      "id": 1,
      "name": "Voter Registration",
      "status": "completed",
      "duration": "Jan 1 – Feb 15, 2025",
      "keyActions": ["Register on voter rolls", "Verify EPIC card details"],
      "description": "Citizens register or update their voter information."
    }
  ],
  "currentPhase": 2,
  "note": "Dates are indicative. Always verify with the official ECI website."
}

Include 5–7 phases covering: Voter Registration, Nomination Filing, Campaign Period, Polling Day, Vote Counting, Result Declaration.
Mark one phase as "active", earlier ones as "completed", later ones as "upcoming".
currentPhase should be the id of the active phase.
  `.trim();

  try {
    const model = getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const data = extractJSON(text);
    return res.json(data);
  } catch (err) {
    console.error('Timeline error:', err);
    return res.status(500).json({ error: 'Failed to generate timeline', detail: err.message });
  }
});

// ── Voter Checklist ────────────────────────────────────────────────────────────

/**
 * POST /api/gemini/checklist
 * Body: { state, voter_type }
 */
router.post('/checklist', async (req, res) => {
  const { state, voter_type } = req.body;
  if (!state || !voter_type) return res.status(400).json({ error: 'state and voter_type are required' });

  const prompt = `
You are an Indian election information assistant.
Generate a voter checklist for a "${voter_type}" voter in "${state}", India.

Return ONLY valid JSON (no markdown fences) in this exact shape:
{
  "state": "${state}",
  "voter_type": "${voter_type}",
  "generated_at": "<ISO timestamp>",
  "checklist": [
    {
      "id": 1,
      "item": "Carry your EPIC (Voter ID) card",
      "priority": "critical",
      "detail": "This is the primary document required at the polling booth."
    }
  ]
}

Priority values: "critical", "important", "optional".
Include 8–12 items covering documents, preparation steps, day-of tasks, and post-voting actions.
voter_type may be: "first-time", "senior citizen", "differently-abled", "NRI", or "general".
  `.trim();

  try {
    const model = getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const data = extractJSON(text);
    if (!data.generated_at) data.generated_at = new Date().toISOString();
    return res.json(data);
  } catch (err) {
    console.error('Checklist error:', err);
    return res.status(500).json({ error: 'Failed to generate checklist', detail: err.message });
  }
});

// ── Quiz ───────────────────────────────────────────────────────────────────────

/**
 * POST /api/gemini/quiz
 * Body: { topic, difficulty, usedIds }
 */
router.post('/quiz', async (req, res) => {
  const { topic = 'Indian elections', difficulty = 'medium', usedIds = [] } = req.body;

  const exclusion = usedIds.length
    ? `Do NOT reuse any question with these IDs: ${usedIds.join(', ')}.`
    : '';

  const prompt = `
You are an Indian civic education quiz master.
Generate ONE multiple-choice quiz question about "${topic}" at "${difficulty}" difficulty.
${exclusion}

Return ONLY valid JSON (no markdown fences) in this exact shape:
{
  "id": "unique_snake_case_id",
  "question": "What is ...?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct": "Option A",
  "explanation": "Brief explanation of why Option A is correct.",
  "topic": "${topic}",
  "difficulty": "${difficulty}"
}

Rules:
- "correct" must be exactly one of the strings in "options".
- Keep options concise (under 80 characters each).
- Keep the explanation to 1–3 sentences.
  `.trim();

  try {
    const model = getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const data = extractJSON(text);
    return res.json(data);
  } catch (err) {
    console.error('Quiz error:', err);
    return res.status(500).json({ error: 'Failed to generate quiz question', detail: err.message });
  }
});

// ── Chat (SSE streaming) ───────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `
You are VoteWise, a friendly, authoritative AI assistant for Indian voters.
Your role is to help citizens understand:
- Indian electoral processes (Lok Sabha, Rajya Sabha, State Assemblies)
- How to register to vote, find polling booths, and check EPIC status
- Election dates, candidates, and results for any Indian state or constituency
- Voter rights, the Model Code of Conduct, and the role of the ECI
- How to raise complaints about electoral malpractices

Guidelines:
- Always be accurate and cite the Election Commission of India (ECI) as the authoritative source.
- Encourage civic participation. Be supportive of first-time voters.
- If unsure about live data (current results, live turnout), say so and direct the user to eci.gov.in.
- Keep responses concise and in plain language. Use bullet points when listing steps.
- Never express political bias or favour any party or candidate.
- If the user's state or phase context is provided, tailor your answer accordingly.
`.trim();

/**
 * POST /api/gemini/chat
 * Body: { message, history, userState, isFirstTime, currentPhase }
 *
 * Streams SSE events:
 *   data: {"type":"text_chunk","text":"..."}
 *   data: {"type":"done","fullText":"..."}
 *   data: {"type":"error","message":"..."}
 */
router.post('/chat', async (req, res) => {
  const { message, history = [], userState, isFirstTime, currentPhase } = req.body;

  if (!message) return res.status(400).json({ error: 'message is required' });

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const model = getProModel();

    // Build context preamble
    const contextLines = [];
    if (userState) contextLines.push(`User's state: ${userState}`);
    if (isFirstTime !== undefined) contextLines.push(`First-time voter: ${isFirstTime}`);
    if (currentPhase) contextLines.push(`Current election phase context: ${currentPhase}`);
    const contextNote = contextLines.length ? `\n[Context: ${contextLines.join(' | ')}]` : '';

    // Convert history to Gemini SDK format
    const geminiHistory = (history || []).map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: m.parts || [{ text: m.text || '' }],
    }));

    const chat = model.startChat({
      history: geminiHistory,
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const stream = await chat.sendMessageStream(message + contextNote);

    let fullText = '';
    for await (const chunk of stream) {
      const text = chunk.text();
      if (text) {
        fullText += text;
        sendEvent({ type: 'text_chunk', text });
      }
    }

    sendEvent({ type: 'done', fullText });
  } catch (err) {
    console.error('Chat error:', err);
    sendEvent({ type: 'error', message: err.message || 'Gemini request failed' });
  } finally {
    res.end();
  }
});

export default router;
