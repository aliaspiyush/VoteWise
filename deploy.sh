#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  VoteWise — GCP Deployment Script
#  Project:  h2s-promptwars-virtual  (# 118356874277)
#  Run from: scratch/ root
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ID="h2s-promptwars-virtual"
REGION="us-central1"
SERVICE="votewise-backend"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}"

echo ""
echo "══════════════════════════════════════════════"
echo "  VoteWise Deployment  ·  ${PROJECT_ID}"
echo "══════════════════════════════════════════════"
echo ""

# 1. Set active GCP project
gcloud config set project "${PROJECT_ID}"

# 2. Enable required APIs
echo "▶ Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  containerregistry.googleapis.com \
  --project="${PROJECT_ID}"

# 3. Store Gemini key if not already present
echo ""
read -r -p "Enter your Gemini API key (or press Enter to skip if already stored): " GEMINI_KEY
if [ -n "${GEMINI_KEY}" ]; then
  echo -n "${GEMINI_KEY}" | gcloud secrets create GEMINI_API_KEY \
    --data-file=- \
    --replication-policy=automatic \
    --project="${PROJECT_ID}" 2>/dev/null || \
  echo -n "${GEMINI_KEY}" | gcloud secrets versions add GEMINI_API_KEY \
    --data-file=- \
    --project="${PROJECT_ID}"
  echo "✓ Gemini API key stored in Secret Manager"
fi

# 4. Build & push backend Docker image
echo ""
echo "▶ Building backend Docker image..."
docker build -t "${IMAGE}:latest" ./votewise-backend
docker push "${IMAGE}:latest"

# 5. Deploy backend to Cloud Run
echo ""
echo "▶ Deploying backend to Cloud Run (${REGION})..."
gcloud run deploy "${SERVICE}" \
  --image="${IMAGE}:latest" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --set-env-vars="FIREBASE_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION},GCP_PROJECT_NUMBER=118356874277" \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"

# 6. Grab Cloud Run URL and set in frontend env
BACKEND_URL=$(gcloud run services describe "${SERVICE}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)")

echo ""
echo "✓ Backend deployed: ${BACKEND_URL}"

# 7. Build frontend with backend URL
echo ""
echo "▶ Building frontend..."
cd votewise-frontend
VITE_API_BASE_URL="${BACKEND_URL}" \
VITE_GCP_PROJECT_ID="${PROJECT_ID}" \
VITE_GCP_PROJECT_NUMBER="118356874277" \
npm run build
cd ..

# 8. Deploy frontend to Firebase Hosting
echo ""
echo "▶ Deploying frontend to Firebase Hosting..."
cd votewise-frontend
firebase deploy --only hosting --project="${PROJECT_ID}" --non-interactive
HOSTING_URL="https://${PROJECT_ID}.web.app"
cd ..

echo ""
echo "══════════════════════════════════════════════"
echo "  ✓ Deployment complete!"
echo "  Frontend : ${HOSTING_URL}"
echo "  Backend  : ${BACKEND_URL}"
echo "  Health   : ${BACKEND_URL}/health"
echo "══════════════════════════════════════════════"
echo ""
