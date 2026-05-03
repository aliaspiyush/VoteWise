import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// In-memory session store (swap for Firestore in production)
const sessions = new Map();

/**
 * POST /api/session/create
 * Body: { userState, isFirstTime, confusionTopic }
 */
router.post('/create', (req, res) => {
  const { userState, isFirstTime, confusionTopic } = req.body;

  if (!userState) {
    return res.status(400).json({ error: 'userState is required' });
  }

  const sessionId = uuidv4();
  const session = {
    sessionId,
    userState,
    isFirstTime: Boolean(isFirstTime),
    confusionTopic: confusionTopic || '',
    createdAt: new Date().toISOString(),
  };

  sessions.set(sessionId, session);

  return res.json(session);
});

/**
 * GET /api/session/:sessionId
 */
router.get('/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  return res.json(session);
});

export default router;
