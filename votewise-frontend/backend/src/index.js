import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import sessionRouter from './routes/session.js';
import geminiRouter from './routes/gemini.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/session', sessionRouter);
app.use('/api/gemini', geminiRouter);

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'votewise-backend' }));

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🗳️  VoteWise backend running on http://localhost:${PORT}`);
});
