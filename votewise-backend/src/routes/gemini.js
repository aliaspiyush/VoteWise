import { Router } from 'express';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const router = Router();

// ── Gemini client ──────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Safety settings — permissive for civic content
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

// ── VoteWise system prompt ─────────────────────────────────────────────────────
function buildSystemPrompt(userState, isFirstTime, currentPhase) {
  return `You are VoteWise, an intelligent civic assistant built for Indian voters.
Your purpose is to help users understand India's election process, timelines,
voting rights, and steps — clearly, accurately, and in a friendly tone.

CORE RULES:
1. Always explain in plain, simple language. Avoid legal jargon unless asked.
2. Be specific to India's Election Commission (ECI) procedures.
3. When the user provides their state, personalize all answers to that state's
   current election schedule if available.
4. Use your knowledge to fetch real, current ECI data when asked
   about dates, schedules, or recent notifications.
5. Never speculate about election outcomes, candidates, or political parties.
   Remain strictly neutral and factual.
6. For any step-based process (e.g., voter registration), always give numbered
   steps in order.
7. If unsure, say: "Let me check the latest ECI guidelines for you."

AVAILABLE FUNCTIONS:
- get_election_phases(state: string) → returns structured phase timeline JSON
- get_voter_checklist(state: string, voter_type: string) → returns checklist JSON
- generate_quiz_question(topic: string, difficulty: string) → returns question JSON
- check_voter_registration(voter_id: string) → returns status string

USER CONTEXT:
- User's state: ${userState || 'Not specified'}
- First-time voter: ${isFirstTime !== undefined ? isFirstTime : 'Not specified'}
- Current election phase: ${currentPhase || 'General Information'}

TONE: Warm, encouraging, civic-minded. Think of yourself as a knowledgeable
friend helping someone vote for the first time — patient, clear, never condescending.`;
}

// ── Function declarations for Gemini ──────────────────────────────────────────
const functionDeclarations = [
  {
    name: 'get_election_phases',
    description: 'Get the 7-phase election timeline for a given Indian state',
    parameters: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Indian state name' },
      },
      required: ['state'],
    },
  },
  {
    name: 'get_voter_checklist',
    description: 'Get a personalised voter readiness checklist',
    parameters: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Indian state name' },
        voter_type: { type: 'string', enum: ['first-time', 'regular', 'senior', 'differently-abled'] },
      },
      required: ['state', 'voter_type'],
    },
  },
  {
    name: 'generate_quiz_question',
    description: 'Generate a quiz question about Indian elections',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Election topic e.g. EVM, NOTA, MCC' },
        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
      },
      required: ['topic', 'difficulty'],
    },
  },
];

// ── Function implementations (mock enriched with real ECI data) ────────────────
function handleFunctionCall(name, args) {
  if (name === 'get_election_phases') {
    const state = args.state || 'General';
    return {
      state,
      phases: [
        { id: 1, name: 'Election Announcement', status: 'completed', duration: 'Day 0', keyActions: ['ECI releases official election schedule', 'Model Code of Conduct (MCC) comes into force immediately', 'All political advertisements must stop within 48 hours'], description: 'The Election Commission of India (ECI) announces the election schedule, activating the democratic process.' },
        { id: 2, name: 'MCC Activation', status: 'completed', duration: 'Day 0 – Voting Day', keyActions: ['Government cannot announce new welfare schemes', 'Use of government resources for campaigning banned', 'All public officials must follow ECI directions'], description: 'The Model Code of Conduct ensures a level playing field from announcement day until results.' },
        { id: 3, name: 'Nomination Filing', status: 'active', duration: '7–10 days', keyActions: ['Candidates file nomination papers with Returning Officer', 'Security deposit required (₹25,000 for general seats)', 'Affidavit declaring assets and criminal record mandatory'], description: 'Candidates formally declare their candidacy by filing nomination papers at the Returning Officer\'s office.' },
        { id: 4, name: 'Scrutiny', status: 'upcoming', duration: '1 day after deadline', keyActions: ['Returning Officer examines all nomination papers', 'Defective nominations can be corrected', 'Objections from other candidates can be raised'], description: 'The Returning Officer scrutinises all nomination papers for completeness and eligibility.' },
        { id: 5, name: 'Withdrawal of Candidature', status: 'upcoming', duration: '2 days after scrutiny', keyActions: ['Candidates may withdraw nomination by 3 PM', 'Final list of contesting candidates published', 'Symbol allotment happens after withdrawal deadline'], description: 'Candidates who do not wish to contest can formally withdraw within this window.' },
        { id: 6, name: 'Voting Day', status: 'upcoming', duration: '1 day (per phase)', keyActions: ['Polling booths open 7 AM – 6 PM', 'Bring EPIC card or approved alternate photo ID', 'No campaigning within 100 metres of polling station', 'Indelible ink applied on left index finger'], description: 'The day citizens exercise their franchise. EVMs record votes which are stored securely.' },
        { id: 7, name: 'Counting & Results', status: 'upcoming', duration: '1–2 days post voting', keyActions: ['EVMs brought to counting centres under security', 'Postal ballots counted first', 'Results announced round by round', 'Winning candidate receives election certificate'], description: 'Electronic Voting Machine votes are counted under strict observation of candidates and election agents.' },
      ],
      currentPhase: 3,
      note: `Timeline personalised for ${state}. Exact dates depend on ECI notification for the specific constituency.`,
    };
  }

  if (name === 'get_voter_checklist') {
    const { state = 'your state', voter_type = 'regular' } = args;
    const baseItems = [
      { id: 1, item: 'Verify voter registration on voters.eci.gov.in', priority: 'critical', detail: 'Check that your name appears in the electoral roll for your current address. Use the NVSP portal or Voter Helpline 1950.' },
      { id: 2, item: 'Check and note your Polling Booth location', priority: 'critical', detail: 'Your polling booth is assigned based on your registered address. Find it via the Voter Helpline app or voters.eci.gov.in.' },
      { id: 3, item: 'Carry your EPIC (Voter ID) card on polling day', priority: 'critical', detail: 'The Electoral Photo Identity Card is the primary identity document. Accepted alternatives include Aadhaar, PAN, Passport, MNREGA Job Card.' },
      { id: 4, item: 'Note polling hours: 7 AM – 6 PM', priority: 'important', detail: 'Polls typically open at 7 AM. If you are in queue by 6 PM you are entitled to vote even if the booth closes.' },
      { id: 5, item: 'Do NOT bring campaign material to polling booth', priority: 'important', detail: 'Wearing or carrying symbols, slogans, or party material within 100 metres of a polling station is prohibited.' },
      { id: 6, item: 'Download Voter Helpline app (1950)', priority: 'optional', detail: 'Track your application status, find your booth, and get real-time election updates from the official ECI app.' },
    ];

    if (voter_type === 'first-time') {
      baseItems.unshift({ id: 0, item: 'Complete Form 6 registration on NVSP if not yet enrolled', priority: 'critical', detail: 'First-time voters aged 18+ must register using Form 6 on https://www.nvsp.in before the enrollment deadline.' });
    }

    return { state, voter_type, checklist: baseItems, generated_at: new Date().toISOString() };
  }

  if (name === 'generate_quiz_question') {
    const questions = {
      EVM: {
        easy: { question: 'What does EVM stand for?', options: ['A) Electronic Voting Machine', 'B) Election Verification Module', 'C) Electronic Vote Manager', 'D) Electoral Voting Method'], correct: 'A', explanation: 'EVM stands for Electronic Voting Machine. India started using EVMs in 1982 and fully switched from paper ballots by 2004.' },
        medium: { question: 'EVMs in India are manufactured by which government undertakings?', options: ['A) DRDO and ISRO', 'B) BEL and ECIL', 'C) HAL and BHEL', 'D) NTPC and SAIL'], correct: 'B', explanation: 'Bharat Electronics Limited (BEL) and Electronics Corporation of India Limited (ECIL) manufacture EVMs under the supervision of the ECI.' },
      },
      NOTA: {
        easy: { question: 'What does NOTA stand for in Indian elections?', options: ['A) None Of The Above', 'B) No Other Ticket Allowed', 'C) National Option To Abstain', 'D) Neutral Official Tally Arrangement'], correct: 'A', explanation: 'NOTA — None Of The Above — was introduced in 2013 by the Supreme Court directive, allowing voters to reject all candidates while still exercising their franchise.' },
        medium: { question: 'In which year was NOTA first available on EVMs in Indian general elections?', options: ['A) 2009', 'B) 2014', 'C) 2019', 'D) 2004'], correct: 'B', explanation: 'NOTA appeared on EVMs for the first time in the 2013 state assembly elections and then in the 2014 Lok Sabha general elections.' },
      },
      MCC: {
        easy: { question: 'What is the Model Code of Conduct (MCC)?', options: ['A) A set of guidelines for election campaigns and government behavior during elections', 'B) A law punishing electoral fraud', 'C) A document issued by candidates', 'D) The constitution amendment on elections'], correct: 'A', explanation: 'The Model Code of Conduct is a set of guidelines issued by the ECI to regulate the conduct of political parties and candidates during elections, ensuring a free and fair process.' },
      },
    };

    const topic = args.topic || 'NOTA';
    const difficulty = args.difficulty || 'easy';
    const topicQuestions = questions[topic] || questions['NOTA'];
    const q = topicQuestions[difficulty] || topicQuestions['easy'];

    return { topic, difficulty, ...q, id: `${topic}_${difficulty}_${Date.now()}` };
  }

  return { error: 'Unknown function' };
}

// ── POST /api/gemini/chat ──────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [], userState, isFirstTime, currentPhase } = req.body;

    if (!message) return res.status(400).json({ error: 'message is required' });

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: buildSystemPrompt(userState, isFirstTime, currentPhase),
      tools: [{ functionDeclarations }],
      safetySettings,
    });

    // Set response as SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(message);

    let fullText = '';
    let functionCallResult = null;

    for await (const chunk of result.stream) {
      const candidate = chunk.candidates?.[0];

      // Handle function calls
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.functionCall) {
            const fnResult = handleFunctionCall(part.functionCall.name, part.functionCall.args);
            functionCallResult = { name: part.functionCall.name, result: fnResult };

            // Send function result back to Gemini for natural language response
            const fnResponse = await chat.sendMessage([{
              functionResponse: {
                name: part.functionCall.name,
                response: fnResult,
              },
            }]);

            const finalText = fnResponse.response.text();
            res.write(`data: ${JSON.stringify({ type: 'text', text: finalText, functionCall: functionCallResult })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
            return;
          }
          if (part.text) {
            fullText += part.text;
            res.write(`data: ${JSON.stringify({ type: 'text_chunk', text: part.text })}\n\n`);
          }
        }
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done', fullText })}\n\n`);
    res.end();
  } catch (err) {
    console.error('[Chat Error]', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'ECI servers are busy. Please try again.' })}\n\n`);
    res.end();
  }
});

// ── POST /api/gemini/quiz ──────────────────────────────────────────────────────
router.post('/quiz', async (req, res) => {
  try {
    const { topic = 'NOTA', difficulty = 'easy', usedIds = [] } = req.body;

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      safetySettings,
    });

    const prompt = `Generate a unique quiz question about Indian elections on the topic "${topic}" at "${difficulty}" difficulty.
Return ONLY valid JSON (no markdown, no explanation) in exactly this format:
{
  "question": "...",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correct": "A",
  "explanation": "2-3 sentence explanation with ECI context"
}
Do not repeat these question IDs: ${usedIds.join(', ')}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON — strip any markdown fences
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    res.json({ ...parsed, id: `${topic}_${Date.now()}`, topic, difficulty });
  } catch (err) {
    console.error('[Quiz Error]', err);
    // Fallback question
    res.json({
      id: `fallback_${Date.now()}`,
      question: 'What is the minimum age to be eligible to vote in India?',
      options: ['A) 16 years', 'B) 18 years', 'C) 21 years', 'D) 25 years'],
      correct: 'B',
      explanation: 'As per Article 326 of the Indian Constitution, every citizen aged 18 years or above is entitled to vote. The voting age was lowered from 21 to 18 by the 61st Constitutional Amendment in 1988.',
      topic: 'General',
      difficulty: 'easy',
    });
  }
});

// ── POST /api/gemini/timeline ──────────────────────────────────────────────────
router.post('/timeline', async (req, res) => {
  try {
    const { state } = req.body;
    const data = handleFunctionCall('get_election_phases', { state });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// ── POST /api/gemini/checklist ─────────────────────────────────────────────────
router.post('/checklist', async (req, res) => {
  try {
    const { state, voter_type } = req.body;
    const data = handleFunctionCall('get_voter_checklist', { state, voter_type });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate checklist' });
  }
});

export { router as geminiRouter };
