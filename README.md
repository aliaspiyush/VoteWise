# 🗳️ VoteWise

**Your AI-powered Indian election guide — built with Gemini AI.**

VoteWise helps every Indian voter navigate the election process with confidence. Ask questions, explore the 7-phase election timeline, take a civic quiz, and get a personalised voter checklist — all powered by Google's Gemini AI.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Chat** | Real-time streaming chat with Gemini — ask anything about elections, voter rights, or ECI procedures |
| 🗓️ **Election Timeline** | Interactive 7-phase election timeline personalised to your state |
| ✅ **Voter Checklist** | Smart checklist based on your state and voter type (first-time, regular, senior) |
| 🎯 **Civic Quiz** | Test your election knowledge with Gemini-generated questions on EVM, NOTA, MCC and more |
| 🌙 **Dark Mode** | Auto-detects system preference, fully themed |
| 🎙️ **Voice Input** | Speak your questions in `en-IN` using Web Speech API |
| 📱 **Responsive** | Fully mobile-friendly with a tab-based layout |

---

## 🏗️ Architecture

```
votewise/
├── votewise-frontend/      # Vite + React + TypeScript
│   ├── src/
│   │   ├── pages/          # LandingPage, OnboardingFlow, Dashboard, QuizMode
│   │   ├── components/     # ChatPanel, ElectionTimeline, VoterChecklist, Header
│   │   ├── api.ts          # All API calls (fetch + SSE streaming)
│   │   ├── context.tsx     # App-wide state (session, dark mode, chat history)
│   │   └── types.ts        # Shared TypeScript types
│   ├── firebase.json       # Firebase Hosting config
│   └── .firebaserc
│
├── votewise-backend/       # Node.js + Express
│   ├── src/
│   │   ├── index.js        # Express server + CORS + health check
│   │   └── routes/
│   │       ├── gemini.js   # /api/gemini/chat, /timeline, /checklist, /quiz
│   │       └── session.js  # /api/session/create
│   └── Dockerfile
│
├── cloudbuild.yaml         # Cloud Build CI/CD pipeline
├── deploy.sh               # One-shot GCP deployment script
└── firestore.rules         # Firestore security rules
```

**Deployment targets:**
- 🖥️ Frontend → **Firebase Hosting** (`https://h2s-promptwars-virtual.web.app`)
- ⚙️ Backend → **Google Cloud Run** (containerised, auto-scaling)
- 🔑 Secrets → **Google Secret Manager** (Gemini API key)

---

## 🚀 Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A [Gemini API key](https://aistudio.google.com/app/apikey) (free)

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd votewise
```

### 2. Set up the backend

```bash
cd votewise-backend
cp .env.example .env
# Edit .env and add your Gemini API key
```

`.env` file:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
FRONTEND_URL=http://localhost:5173
FIREBASE_PROJECT_ID=h2s-promptwars-virtual
GCP_PROJECT_NUMBER=118356874277
GCP_REGION=us-central1
```

Start the backend:
```bash
# npm run dev   (if PowerShell scripts are enabled)
node src/index.js
```

Backend runs on **http://localhost:3001**. Test it:
```bash
# Should return: {"status":"ok","service":"VoteWise API"}
node -e "fetch('http://localhost:3001/health').then(r=>r.json()).then(console.log)"
```

### 3. Set up the frontend

```bash
cd votewise-frontend
# npm install   (already done if node_modules exists)
```

`.env` file:
```env
VITE_API_BASE_URL=http://localhost:3001
VITE_GCP_PROJECT_ID=h2s-promptwars-virtual
VITE_GCP_PROJECT_NUMBER=118356874277
```

Start the frontend:
```bash
node node_modules/vite/bin/vite.js
```

Frontend runs on **http://localhost:5173**

---

## 🔌 API Reference

All endpoints are on the backend at `http://localhost:3001`.

### `GET /health`
Returns server status.

### `POST /api/session/create`
Creates a new user session.
```json
{ "userState": "Manipur", "isFirstTime": true, "confusionTopic": "EVM voting" }
```

### `POST /api/gemini/chat` _(SSE stream)_
Streams an AI response. Sends `text/event-stream` events:
```json
{ "type": "text_chunk", "text": "..." }
{ "type": "done", "fullText": "..." }
{ "type": "error", "message": "..." }
```

### `POST /api/gemini/timeline`
Returns the 7-phase election timeline for a state.
```json
{ "state": "Maharashtra" }
```

### `POST /api/gemini/checklist`
Returns a personalised voter checklist.
```json
{ "state": "Delhi", "voter_type": "first-time" }
```

### `POST /api/gemini/quiz`
Generates a quiz question using Gemini.
```json
{ "topic": "NOTA", "difficulty": "medium", "usedIds": [] }
```

---

## ☁️ GCP Deployment

> Detailed step-by-step guide is in the deployment guide artifact. Summary below.

### Prerequisites
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Firebase CLI: `npm install -g firebase-tools`

### One-time setup
```bash
gcloud auth login
gcloud config set project h2s-promptwars-virtual
gcloud auth configure-docker
firebase login

# Enable GCP APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  secretmanager.googleapis.com containerregistry.googleapis.com \
  firebasehosting.googleapis.com

# Store Gemini key in Secret Manager
echo -n "YOUR_GEMINI_KEY" | gcloud secrets create GEMINI_API_KEY \
  --data-file=- --replication-policy=automatic
```

### Deploy backend (Cloud Run)
```bash
docker build -t gcr.io/h2s-promptwars-virtual/votewise-backend:latest ./votewise-backend
docker push gcr.io/h2s-promptwars-virtual/votewise-backend:latest

gcloud run deploy votewise-backend \
  --image=gcr.io/h2s-promptwars-virtual/votewise-backend:latest \
  --region=us-central1 --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

### Deploy frontend (Firebase Hosting)
```bash
cd votewise-frontend
VITE_API_BASE_URL=<your-cloud-run-url> node node_modules/vite/bin/vite.js build
firebase deploy --only hosting --project=h2s-promptwars-virtual
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 19 + TypeScript + Vite 8 |
| Styling | Vanilla CSS (design tokens, dark mode) |
| Animations | Framer Motion |
| Icons | Lucide React |
| Routing | React Router v7 |
| Backend | Node.js + Express 5 |
| AI | Google Gemini 1.5 Flash (`@google/generative-ai`) |
| Streaming | Server-Sent Events (SSE) |
| Hosting | Firebase Hosting |
| Compute | Google Cloud Run |
| Secrets | Google Secret Manager |
| CI/CD | Google Cloud Build |

---

## 📋 Environment Variables

### Backend (`votewise-backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Your Google AI Studio API key |
| `PORT` | Optional | Server port (default: `3001`) |
| `FRONTEND_URL` | Optional | CORS allowed origin |
| `FIREBASE_PROJECT_ID` | Optional | GCP project ID |

### Frontend (`votewise-frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | ✅ | Backend URL (e.g. `http://localhost:3001`) |
| `VITE_GCP_PROJECT_ID` | Optional | GCP project ID |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push and open a Pull Request

---

## 📄 License

MIT — feel free to use and adapt for civic tech projects.

---

> Built with ❤️ for Indian voters · Powered by [Google Gemini AI](https://ai.google.dev/)
