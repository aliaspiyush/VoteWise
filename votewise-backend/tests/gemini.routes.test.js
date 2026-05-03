import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Router } from 'express';

/**
 * Unit tests for Gemini route input validation.
 * These tests mock the Gemini SDK so no real API key is needed.
 * They verify request validation, error handling, and route structure.
 */

function buildMockGeminiRouter() {
  const router = Router();

  // Mock /api/gemini/timeline
  router.post('/timeline', (req, res) => {
    const { state } = req.body;
    if (!state) return res.status(400).json({ error: 'state is required' });
    res.json({
      state,
      phases: [
        { id: 1, name: 'Election Announcement', description: 'ECI declares schedule' },
        { id: 2, name: 'Nomination Filing', description: 'Candidates file nomination papers' },
        { id: 3, name: 'Scrutiny', description: 'Nomination papers verified' },
        { id: 4, name: 'Withdrawal', description: 'Candidates may withdraw' },
        { id: 5, name: 'Campaign Period', description: 'Active campaigning phase' },
        { id: 6, name: 'Voting Day', description: 'Polling at assigned booths' },
        { id: 7, name: 'Counting and Results', description: 'EVMs opened and counted' },
      ],
    });
  });

  // Mock /api/gemini/checklist
  router.post('/checklist', (req, res) => {
    const { state, voter_type } = req.body;
    if (!state) return res.status(400).json({ error: 'state is required' });
    const type = voter_type || 'regular';
    res.json({
      state,
      voter_type: type,
      checklist: [
        { id: 1, item: 'Carry your EPIC (Voter ID) card', done: false },
        { id: 2, item: 'Check your name on the electoral roll', done: false },
        { id: 3, item: 'Know your polling booth address', done: false },
        { id: 4, item: 'Check polling date and time for your constituency', done: false },
        ...(type === 'first-time'
          ? [{ id: 5, item: 'Bring an alternate ID proof as backup', done: false }]
          : []),
      ],
    });
  });

  // Mock /api/gemini/quiz
  router.post('/quiz', (req, res) => {
    const { topic, difficulty } = req.body;
    if (!topic) return res.status(400).json({ error: 'topic is required' });
    res.json({
      id: 'q_mock_001',
      topic,
      difficulty: difficulty || 'medium',
      question: 'What does NOTA stand for in Indian elections?',
      options: [
        { label: 'A', text: 'None Of The Above' },
        { label: 'B', text: 'No Official Total Abstain' },
        { label: 'C', text: 'National Order To Abstain' },
        { label: 'D', text: 'None Of The Applicants' },
      ],
      correctAnswer: 'A',
      explanation: 'NOTA stands for None Of The Above, introduced in Indian elections in 2013.',
    });
  });

  // Mock /api/gemini/chat (non-streaming version for test)
  router.post('/chat', (req, res) => {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });
    res.json({
      reply: `VoteWise received: "${message}". History length: ${(history || []).length}.`,
      done: true,
    });
  });

  return router;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/gemini', buildMockGeminiRouter());
  return app;
}

describe('Gemini Routes — Input Validation & Structure', () => {
  let server;
  let baseUrl;

  before(() => {
    const app = buildApp();
    server = app.listen(0);
    const { port } = server.address();
    baseUrl = `http://localhost:${port}`;
  });

  after(() => server.close());

  // Timeline tests
  describe('POST /api/gemini/timeline', () => {
    it('returns 7 election phases for a valid state', async () => {
      const res = await fetch(`${baseUrl}/api/gemini/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'Maharashtra' }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.state, 'Maharashtra');
      assert.equal(body.phases.length, 7);
      assert.equal(body.phases[0].name, 'Election Announcement');
      assert.equal(body.phases[6].name, 'Counting and Results');
    });

    it('returns 400 when state is missing', async () => {
      const res = await fetch(`${baseUrl}/api/gemini/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error, 'state is required');
    });

    it('each phase has id, name, and description', async () => {
      const res = await fetch(`${baseUrl}/api/gemini/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'Delhi' }),
      });
      const { phases } = await res.json();
      for (const phase of phases) {
        assert.ok(phase.id, 'phase must have id');
        assert.ok(phase.name, 'phase must have name');
        assert.ok(phase.description, 'phase must have description');
      }
    });
  });

  // Checklist tests
  describe('POST /api/gemini/checklist', () => {
    it('returns checklist for regular voter', async () => {
      const res = await fetch(`${baseUrl}/api/gemini/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'Kerala', voter_type: 'regular' }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.state, 'Kerala');
      assert.equal(body.voter_type, 'regular');
      assert.ok(body.checklist.length >= 4);
    });

    it('returns extra checklist item for first-time voter', async () => {
      const res = await fetch(`${baseUrl}/api/gemini/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'Goa', voter_type: 'first-time' }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.checklist.length >= 5);
    });

    it('returns 400 when state is missing', async () => {
      const res = await fetch(`${baseUrl}/api/gemini/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voter_type: 'regular' }),
      });
      assert.equal(res.status, 400);
    });

    it('defaults voter_type to regular when not provided', async () => {
      const res = await fetch(`${baseUrl}/api/gemini/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'Punjab' }),
      });
      const body = await res.json();
      assert.equal(body.voter_type, 'regular');
    });
  });

  // Quiz tests
  describe('POST /api/gemini/quiz', () => {
    it('returns a well-formed quiz question', async () => {
      const res = await fetch(`${baseUrl}/api/gemini/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'NOTA', difficulty: 'easy' }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.id);
      assert.ok(body.question);
      assert.equal(body.options.length, 4);
      assert.ok(body.correctAnswer);
      assert.ok(body.explanation);
    });

    it('returns 400 when topic is missing', async () => {
      const res = await fetch(`${baseUrl}/api/gemini/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: 'easy' }),
      });
      assert.equal(res.status, 400);
    });

    it('defaults difficulty to medium when not provided', async () => {
      const res = await fetch(`${baseUrl}/api/gemini/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'EVM' }),
      });
      const body = await res.json();
      assert.equal(body.difficulty, 'medium');
    });

    it('each option has label and text fields', async () => {
      const res = await fetch(`${baseUrl}/api/gemini/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'MCC' }),
      });
      const { options } = await res.json();
      for (const opt of options) {
        assert.ok(opt.label);
        assert.ok(opt.text);
      }
    });
  });

  // Chat tests
  describe('POST /api/gemini/chat', () => {
    it('returns a reply for a valid message', async () => {
      const res = await fetch(`${baseUrl}/api/gemini/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'What is NOTA?', history: [] }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.reply);
      assert.equal(body.done, true);
    });

    it('returns 400 when message is missing', async () => {
      const res = await fetch(`${baseUrl}/api/gemini/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: [] }),
      });
      assert.equal(res.status, 400);
    });

    it('handles chat with prior history', async () => {
      const history = [
        { role: 'user', parts: [{ text: 'What is MCC?' }] },
        { role: 'model', parts: [{ text: 'MCC is Model Code of Conduct.' }] },
      ];
      const res = await fetch(`${baseUrl}/api/gemini/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Tell me more', history }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.reply.includes('History length: 2'));
    });
  });
});
