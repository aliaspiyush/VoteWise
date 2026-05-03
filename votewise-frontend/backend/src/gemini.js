import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  console.error('❌  GEMINI_API_KEY is not set. Create backend/.env from backend/.env.example');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Returns a Gemini 2.0 Flash model instance (fast, capable, free-tier friendly).
 */
export function getModel() {
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
}

/**
 * Returns a Gemini 2.0 Flash model instance for richer reasoning tasks (chat).
 */
export function getProModel() {
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
}
