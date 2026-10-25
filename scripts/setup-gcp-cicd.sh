#!/usr/bin/env bash
# One-time setup: keyless GitHub Actions -> Cloud Run deploys for Kova.
# Run from the repo root in Git Bash, after `gcloud auth login` and `gh auth login`:
#   bash scripts/setup-gcp-cicd.sh
# Safe to re-run: existing resources are reused.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-kova-98d67}"
REGION="${REGION:-us-central1}"          # match the region of your existing Cloud Run service if you want
SERVICE="${SERVICE:-kova}"               # Cloud Run service name the pipeline owns
GH_REPO="${GH_REPO:-Kova-Finance/Kova}"
GH_OWNER="${GH_REPO%%/*}"

RUNTIME_SA="kova-run@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOY_SA="kova-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
POOL="github"
PROVIDER="github-actions"

echo "== Project: $PROJECT_ID | Region: $REGION | Service: $SERVICE | Repo: $GH_REPO"
gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

echo "== Enabling APIs"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com iam.googleapis.com \
  secretmanager.googleapis.com cloudresourcemanager.googleapis.com \
  aiplatform.googleapis.com

echo "== Artifact Registry repo"
gcloud artifacts repositories describe kova --location "$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create kova --repository-format=docker --location "$REGION" \
    --description="Kova container images"

echo "== Service accounts"
gcloud iam service-accounts describe "$RUNTIME_SA" >/dev/null 2>&1 || \
  gcloud iam service-accounts create kova-run --display-name="Kova Cloud Run runtime"
gcloud iam service-accounts describe "$DEPLOY_SA" >/dev/null 2>&1 || \
  gcloud iam service-accounts create kova-deployer --display-name="Kova GitHub Actions deployer"

echo "== Runtime SA roles (Firestore via Admin SDK, Gemini via Vertex AI)"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$RUNTIME_SA" \
  --role=roles/datastore.user --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$RUNTIME_SA" \
  --role=roles/aiplatform.user --condition=None >/dev/null

echo "== Deployer SA roles (least privilege)"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOY_SA" \
  --role=roles/run.developer --condition=None >/dev/null
gcloud artifacts repositories add-iam-policy-binding kova --location "$REGION" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/artifactregistry.writer >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/iam.serviceAccountUser >/dev/null

echo "== Workload Identity Federation (only $GH_REPO can authenticate)"
gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers describe "$PROVIDER" --location=global \
  --workload-identity-pool="$POOL" >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --location=global \
    --workload-identity-pool="$POOL" --display-name="GitHub Actions OIDC" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='${GH_REPO}' && assertion.repository_owner=='${GH_OWNER}'"

WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GH_REPO}" >/dev/null

echo "== Secrets (values are typed hidden, never echoed or stored on disk)"
create_secret () {
  local name="$1" prompt="$2"
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    echo "   $name already exists - keeping it"
  else
    read -r -s -p "   $prompt: " val; echo
    printf '%s' "$val" | gcloud secrets create "$name" --replication-policy=automatic --data-file=- >/dev/null
    unset val
  fi
  gcloud secrets add-iam-policy-binding "$name" --member="serviceAccount:$RUNTIME_SA" \
    --role=roles/secretmanager.secretAccessor >/dev/null
}
create_secret gemini-api-key "Paste the NEW production Gemini API key"
if ! gcloud secrets describe cron-secret >/dev/null 2>&1; then
  openssl rand -hex 32 | tr -d '\n' | gcloud secrets create cron-secret --replication-policy=automatic --data-file=- >/dev/null
  echo "   cron-secret generated randomly"
fi
gcloud secrets add-iam-policy-binding cron-secret --member="serviceAccount:$RUNTIME_SA" \
  --role=roles/secretmanager.secretAccessor >/dev/null

echo "== GitHub repo variables (not secrets - none of these are sensitive)"
gh variable set GCP_PROJECT_ID    --repo "$GH_REPO" --body "$PROJECT_ID"
gh variable set GCP_REGION        --repo "$GH_REPO" --body "$REGION"
gh variable set CLOUD_RUN_SERVICE --repo "$GH_REPO" --body "$SERVICE"
gh variable set RUNTIME_SA        --repo "$GH_REPO" --body "$RUNTIME_SA"
gh variable set DEPLOY_SA         --repo "$GH_REPO" --body "$DEPLOY_SA"
gh variable set PAYPAL_MODE       --repo "$GH_REPO" --body "mock"
gh variable set WIF_PROVIDER      --repo "$GH_REPO" --body "$WIF_PROVIDER"

echo
echo "Done. Next: create the 'production' environment in GitHub (Settings -> Environments),"
echo "then run the Deploy workflow (Actions -> Deploy -> Run workflow)."
