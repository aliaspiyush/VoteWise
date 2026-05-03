import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { geminiRouter } from './routes/gemini.js';
import { sessionRouter } from './routes/session.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS — allow Firebase Hosting domain + local dev
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    process.env.FRONTEND_URL || 'https://votewise.web.app',
  ],
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'VoteWise API' }));

// API routes
app.use('/api/gemini', geminiRouter);
app.use('/api/session', sessionRouter);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[VoteWise Error]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    hint: 'ECI servers are busy. Please try again in a moment.',
  });
});

app.listen(PORT, () => console.log(`🗳️  VoteWise API running on port ${PORT}`));
