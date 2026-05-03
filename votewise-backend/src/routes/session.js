import { Router } from 'express';
import { v4 as uuid } from 'uuid';

const router = Router();

// In-memory session store (replace with Firestore in production)
const sessions = new Map();

// POST /api/session/create
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

// GET /api/session/:id
router.get('/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// PATCH /api/session/:id
router.patch('/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const updated = { ...session, ...req.body, updatedAt: new Date().toISOString() };
  sessions.set(req.params.id, updated);
  res.json(updated);
});

// POST /api/session/:id/quiz-result
router.post('/:id/quiz-result', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  session.quizHistory.push({ ...req.body, timestamp: new Date().toISOString() });
  session.updatedAt = new Date().toISOString();
  res.json({ success: true });
});

export { router as sessionRouter };
