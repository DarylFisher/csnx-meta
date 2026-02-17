#!/usr/bin/env bash
set -euo pipefail

PROJECT=csnx-test
REGION=us-central1
REPO=csnx-meta
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}"

# Read a value from .env without shell expansion
# Converts $$ → $ to match docker-compose .env escaping
env_val() {
  grep "^${1}=" .env | head -1 | cut -d= -f2- | sed 's/\$\$/$/g'
}

INSTANCE_CONNECTION_NAME=$(env_val INSTANCE_CONNECTION_NAME)
BACKEND_DB_USER=$(env_val BACKEND_DB_USER)
BACKEND_DB_PASS=$(env_val BACKEND_DB_PASS)
BACKEND_DB_NAME=$(env_val BACKEND_DB_NAME)
DB_USER=$(env_val DB_USER)
DB_PASS=$(env_val DB_PASS)
DB_NAME=$(env_val DB_NAME)

echo "==> Creating Artifact Registry repo (if needed)..."
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT" 2>/dev/null || true

echo "==> Configuring Docker auth..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# --- Backend ---
echo "==> Building backend..."
docker build -t "${REGISTRY}/csnx-backend:latest" ./backend

echo "==> Pushing backend..."
docker push "${REGISTRY}/csnx-backend:latest"

echo "==> Deploying backend..."
gcloud run deploy csnx-backend \
  --image="${REGISTRY}/csnx-backend:latest" \
  --region="$REGION" \
  --project="$PROJECT" \
  --port=8000 \
  --memory=512Mi \
  --allow-unauthenticated \
  --set-env-vars="^||^INSTANCE_CONNECTION_NAME=${INSTANCE_CONNECTION_NAME}||DB_USER=${BACKEND_DB_USER}||DB_PASS=${BACKEND_DB_PASS}||DB_NAME=${BACKEND_DB_NAME}"

BACKEND_URL=$(gcloud run services describe csnx-backend \
  --region="$REGION" --project="$PROJECT" \
  --format='value(status.url)')
echo "    Backend URL: ${BACKEND_URL}"

# --- Dashboard API ---
echo "==> Building dashboard-api..."
docker build -t "${REGISTRY}/csnx-dashboard-api:latest" ./dashboard-api

echo "==> Pushing dashboard-api..."
docker push "${REGISTRY}/csnx-dashboard-api:latest"

echo "==> Deploying dashboard-api..."
gcloud run deploy csnx-dashboard-api \
  --image="${REGISTRY}/csnx-dashboard-api:latest" \
  --region="$REGION" \
  --project="$PROJECT" \
  --port=8001 \
  --memory=512Mi \
  --allow-unauthenticated \
  --set-env-vars="^||^INSTANCE_CONNECTION_NAME=${INSTANCE_CONNECTION_NAME}||DB_USER=${DB_USER}||DB_PASS=${DB_PASS}||DB_NAME=${DB_NAME}"

DASHBOARD_API_URL=$(gcloud run services describe csnx-dashboard-api \
  --region="$REGION" --project="$PROJECT" \
  --format='value(status.url)')
echo "    Dashboard API URL: ${DASHBOARD_API_URL}"

# --- Frontend ---
echo "==> Building frontend..."
docker build -t "${REGISTRY}/csnx-frontend:latest" \
  -f frontend/Dockerfile.cloudrun ./frontend

echo "==> Pushing frontend..."
docker push "${REGISTRY}/csnx-frontend:latest"

echo "==> Deploying frontend..."
gcloud run deploy csnx-frontend \
  --image="${REGISTRY}/csnx-frontend:latest" \
  --region="$REGION" \
  --project="$PROJECT" \
  --port=8080 \
  --memory=256Mi \
  --allow-unauthenticated \
  --set-env-vars="BACKEND_URL=${BACKEND_URL},DASHBOARD_API_URL=${DASHBOARD_API_URL}"

FRONTEND_URL=$(gcloud run services describe csnx-frontend \
  --region="$REGION" --project="$PROJECT" \
  --format='value(status.url)')

echo ""
echo "=== Deployment complete ==="
echo "  Backend:       ${BACKEND_URL}"
echo "  Dashboard API: ${DASHBOARD_API_URL}"
echo "  Frontend:      ${FRONTEND_URL}"
