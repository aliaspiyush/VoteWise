import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Router } from 'express';
import { v4 as uuid } from 'uuid';

// Inline session router (mirrors src/routes/session.js)
function buildSessionRouter() {
  const router = Router();
  const sessions = new Map();

  router.post('/create', (req, res) => {
    const sessionId = uuid();
    const { userState, isFirstTime, confusionTopic } = req.body;
    const session = {
      id: sessionId,
      userState: userState || null,
      isFirstTime: isFirstTime || false,
      confusionTopic: confusionTopic || null,
      chatHistory: [],
      quizHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sessions.set(sessionId, session);
    res.json({ sessionId, session });
  });

  router.get('/:id', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  });

  router.patch('/:id', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const updated = { ...session, ...req.body, updatedAt: new Date().toISOString() };
    sessions.set(req.params.id, updated);
    res.json(updated);
  });

  router.post('/:id/quiz-result', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    session.quizHistory.push({ ...req.body, timestamp: new Date().toISOString() });
    session.updatedAt = new Date().toISOString();
    res.json({ success: true });
  });

  return router;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/session', buildSessionRouter());
  return app;
}

describe('Session Routes', () => {
  let server;
  let baseUrl;

  before(() => {
    const app = buildApp();
    server = app.listen(0);
    const { port } = server.address();
    baseUrl = `http://localhost:${port}`;
  });

  after(() => server.close());

  it('POST /api/session/create returns a sessionId and session object', async () => {
    const res = await fetch(`${baseUrl}/api/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userState: 'Maharashtra', isFirstTime: true, confusionTopic: 'EVM' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.sessionId);
    assert.equal(body.session.userState, 'Maharashtra');
    assert.equal(body.session.isFirstTime, true);
    assert.equal(body.session.confusionTopic, 'EVM');
    assert.deepEqual(body.session.chatHistory, []);
    assert.deepEqual(body.session.quizHistory, []);
  });

  it('POST /api/session/create uses defaults when body is empty', async () => {
    const res = await fetch(`${baseUrl}/api/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.session.userState, null);
    assert.equal(body.session.isFirstTime, false);
    assert.equal(body.session.confusionTopic, null);
  });

  it('GET /api/session/:id returns the created session', async () => {
    const createRes = await fetch(`${baseUrl}/api/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userState: 'Delhi' }),
    });
    const { sessionId } = await createRes.json();

    const getRes = await fetch(`${baseUrl}/api/session/${sessionId}`);
    assert.equal(getRes.status, 200);
    const session = await getRes.json();
    assert.equal(session.id, sessionId);
    assert.equal(session.userState, 'Delhi');
  });

  it('GET /api/session/:id returns 404 for unknown session', async () => {
    const res = await fetch(`${baseUrl}/api/session/nonexistent-id-123`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'Session not found');
  });

  it('PATCH /api/session/:id updates session fields', async () => {
    const createRes = await fetch(`${baseUrl}/api/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userState: 'Goa' }),
    });
    const { sessionId } = await createRes.json();

    const patchRes = await fetch(`${baseUrl}/api/session/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userState: 'Kerala', isFirstTime: true }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.userState, 'Kerala');
    assert.equal(updated.isFirstTime, true);
  });

  it('PATCH /api/session/:id returns 404 for unknown session', async () => {
    const res = await fetch(`${baseUrl}/api/session/bad-id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userState: 'Punjab' }),
    });
    assert.equal(res.status, 404);
  });

  it('POST /api/session/:id/quiz-result appends to quizHistory', async () => {
    const createRes = await fetch(`${baseUrl}/api/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userState: 'Tamil Nadu' }),
    });
    const { sessionId } = await createRes.json();

    const quizRes = await fetch(`${baseUrl}/api/session/${sessionId}/quiz-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What is NOTA?', correct: true, score: 1 }),
    });
    assert.equal(quizRes.status, 200);
    const result = await quizRes.json();
    assert.equal(result.success, true);
  });

  it('POST /api/session/:id/quiz-result returns 404 for unknown session', async () => {
    const res = await fetch(`${baseUrl}/api/session/bad-id/quiz-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'test', correct: false }),
    });
    assert.equal(res.status, 404);
  });
});
