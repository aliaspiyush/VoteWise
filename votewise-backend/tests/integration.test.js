import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Router } from 'express';
import { v4 as uuid } from 'uuid';

/**
 * Integration tests — full user journey:
 * Onboarding → Session creation → Timeline fetch → Checklist → Quiz → Quiz result save
 */

function buildFullApp() {
  const app = express();
  app.use(express.json());

  // Session router
  const sessions = new Map();
  const sessionRouter = Router();
  sessionRouter.post('/create', (req, res) => {
    const sessionId = uuid();
    const session = {
      id: sessionId,
      userState: req.body.userState || null,
      isFirstTime: req.body.isFirstTime || false,
      confusionTopic: req.body.confusionTopic || null,
      chatHistory: [],
      quizHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sessions.set(sessionId, session);
    res.json({ sessionId, session });
  });
  sessionRouter.get('/:id', (req, res) => {
    const s = sessions.get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Session not found' });
    res.json(s);
  });
  sessionRouter.post('/:id/quiz-result', (req, res) => {
    const s = sessions.get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Session not found' });
    s.quizHistory.push({ ...req.body, timestamp: new Date().toISOString() });
    res.json({ success: true });
  });

  // Gemini router (mock)
  const geminiRouter = Router();
  geminiRouter.post('/timeline', (req, res) => {
    if (!req.body.state) return res.status(400).json({ error: 'state is required' });
    res.json({ state: req.body.state, phases: Array.from({ length: 7 }, (_, i) => ({ id: i + 1, name: `Phase ${i + 1}` })) });
  });
  geminiRouter.post('/checklist', (req, res) => {
    if (!req.body.state) return res.status(400).json({ error: 'state is required' });
    res.json({ state: req.body.state, checklist: [{ id: 1, item: 'Carry EPIC card', done: false }] });
  });
  geminiRouter.post('/quiz', (req, res) => {
    if (!req.body.topic) return res.status(400).json({ error: 'topic is required' });
    res.json({ id: 'q1', question: 'What is EVM?', options: [], correctAnswer: 'A', explanation: 'Electronic Voting Machine' });
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'VoteWise API' }));
  app.use('/api/session', sessionRouter);
  app.use('/api/gemini', geminiRouter);

  return app;
}

describe('Integration — Full Voter Journey', () => {
  let server;
  let baseUrl;

  before(() => {
    const app = buildFullApp();
    server = app.listen(0);
    const { port } = server.address();
    baseUrl = `http://localhost:${port}`;
  });

  after(() => server.close());

  it('complete journey: health → create session → get timeline → get checklist → get quiz → save result', async () => {
    // Step 1: Health check
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);

    // Step 2: Create session (onboarding)
    const sessionRes = await fetch(`${baseUrl}/api/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userState: 'Maharashtra', isFirstTime: true, confusionTopic: 'voting phases' }),
    });
    const { sessionId, session } = await sessionRes.json();
    assert.ok(sessionId);
    assert.equal(session.userState, 'Maharashtra');

    // Step 3: Fetch election timeline
    const timelineRes = await fetch(`${baseUrl}/api/gemini/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: session.userState }),
    });
    const timeline = await timelineRes.json();
    assert.equal(timeline.phases.length, 7);

    // Step 4: Fetch voter checklist
    const checklistRes = await fetch(`${baseUrl}/api/gemini/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: session.userState, voter_type: 'first-time' }),
    });
    const checklist = await checklistRes.json();
    assert.ok(checklist.checklist.length > 0);

    // Step 5: Fetch a quiz question
    const quizRes = await fetch(`${baseUrl}/api/gemini/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'EVM', difficulty: 'easy' }),
    });
    const quiz = await quizRes.json();
    assert.ok(quiz.id);
    assert.ok(quiz.question);

    // Step 6: Save quiz result to session
    const resultRes = await fetch(`${baseUrl}/api/session/${sessionId}/quiz-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: quiz.id, correct: true, score: 1 }),
    });
    assert.equal(resultRes.status, 200);
    const result = await resultRes.json();
    assert.equal(result.success, true);

    // Step 7: Verify session now has quiz history
    const updatedSession = await fetch(`${baseUrl}/api/session/${sessionId}`);
    const updated = await updatedSession.json();
    assert.equal(updated.quizHistory.length, 1);
    assert.equal(updated.quizHistory[0].correct, true);
  });

  it('handles concurrent session creation without collision', async () => {
    const requests = Array.from({ length: 5 }, (_, i) =>
      fetch(`${baseUrl}/api/session/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userState: `State${i}` }),
      }).then(r => r.json())
    );
    const results = await Promise.all(requests);
    const ids = results.map(r => r.sessionId);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, 5, 'All session IDs must be unique');
  });
});
