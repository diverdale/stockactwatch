# Stock Tracker — Deployment Guide

## Hosting Options

| Option | Cost/month | Complexity | Best for |
|--------|-----------|------------|----------|
| **Vercel + Railway** | ~$13–15 | Low | Launching, early traffic |
| Fly.io | ~$15–20 | Medium | Docker-native, more control |
| GCP (Cloud Run) | ~$35–115 | High | Scale, enterprise, GCP ecosystem |

**Recommended starting point: Vercel (frontend) + Railway (backend + Postgres + Redis)**

---

## Option 1: Vercel + Railway (Recommended)

### Architecture

```
Browser
  │
  ▼
Vercel (Next.js — managed, ISR, CDN)
  │  server-side API calls
  ▼
Railway (FastAPI + APScheduler + Uvicorn)
  ├──▶ Railway Postgres (PostgreSQL 16)
  └──▶ Railway Redis
```

---

### Step 1: Deploy the Backend on Railway

1. Go to [railway.app](https://railway.app) and create a new project.

2. **Add a PostgreSQL service** — Railway provisions it instantly. Copy the `DATABASE_URL` from the service's "Variables" tab. The URL uses the `postgresql://` scheme; update it for asyncpg:
   ```
   # Railway gives you:
   postgresql://postgres:<pass>@<host>:<port>/<db>

   # Change to asyncpg:
   postgresql+asyncpg://postgres:<pass>@<host>:<port>/<db>
   ```

3. **Add a Redis service** — same process; copy the `REDIS_URL`.

4. **Add a Python service** from your GitHub repo. Railway auto-detects Python. Set the root directory to `backend/`.

   Create a `backend/railway.toml` to configure the deploy:
   ```toml
   [build]
   builder = "nixpacks"

   [deploy]
   startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
   restartPolicyType = "always"
   ```

5. **Set environment variables** on the backend service (Railway dashboard → Variables):
   ```
   DATABASE_URL=postgresql+asyncpg://...
   REDIS_URL=redis://...
   QUIVER_API_KEY=<your key>
   ENVIRONMENT=production
   ```

6. **Run Alembic migrations** — once the service is deployed, open a Railway shell or use the one-off command runner:
   ```bash
   railway run --service=<backend-service> alembic upgrade head
   ```
   Or add it as a deploy hook in `railway.toml`:
   ```toml
   [deploy]
   startCommand = "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"
   ```

7. Note the backend **public URL** Railway assigns (e.g. `https://stock-tracker-backend.up.railway.app`).

---

### Step 2: Deploy the Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and import your GitHub repo.

2. Set the **root directory** to `frontend/`.

3. Vercel auto-detects Next.js. No special build config needed — `output: standalone` is disabled automatically (only activates for Docker via `NEXT_OUTPUT=standalone`).

4. **Set environment variables** in the Vercel dashboard:
   ```
   API_URL=https://stock-tracker-backend.up.railway.app
   ```

5. Deploy. Vercel handles ISR, CDN, custom domains, and preview deployments automatically.

---

### APScheduler on Railway

Railway keeps your process running persistently (unlike serverless), so APScheduler works fine in-process with one service instance.

**Important:** Keep the backend scaled to exactly **1 replica** to avoid duplicate scheduled job runs. In Railway, set max replicas to 1 in the service settings.

For a cleaner setup later, Railway supports **cron jobs** natively — you can move the data ingestion out of the FastAPI process entirely:

1. Create a separate Railway service for the cron job
2. Set a cron schedule (e.g. `0 */6 * * *` for every 6 hours)
3. Run the ingestion script directly

---

### Custom Domain (Vercel)

In the Vercel dashboard → Domains, add your domain and update your DNS records. Vercel provisions TLS automatically.

---

### Estimated Railway + Vercel Costs

| Service | Config | Cost/month |
|---------|--------|------------|
| Vercel frontend | Hobby plan | Free |
| Railway — FastAPI | 512 MB, 1 vCPU | ~$5 |
| Railway — PostgreSQL | 1 GB | ~$5 |
| Railway — Redis | 512 MB | ~$3 |
| **Total** | | **~$13–15** |

---

---

## Option 2: GCP Cloud Run

Suitable if you're already in the GCP ecosystem or need more control, SLAs, or scale.

### Architecture

```
Internet
  │
  ▼
Cloud Run (Frontend — Next.js standalone)
  │  server-side API calls
  ▼
Cloud Run (Backend — FastAPI + APScheduler)
  ├──▶ Cloud SQL (PostgreSQL 16) via Unix socket
  └──▶ Memorystore for Redis (or Upstash)
```

### Prerequisites

```bash
gcloud auth login
gcloud auth configure-docker <REGION>-docker.pkg.dev

export PROJECT_ID=your-gcp-project-id
export REGION=us-central1
export REPO=stock-tracker

gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION

gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  vpcaccess.googleapis.com
```

### Service Account

```bash
gcloud iam service-accounts create stock-tracker-sa \
  --display-name="Stock Tracker Cloud Run SA"

SA_EMAIL=stock-tracker-sa@${PROJECT_ID}.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"
```

### Cloud SQL

```bash
gcloud sql instances create stock-tracker-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-type=SSD \
  --storage-size=10GB \
  --no-assign-ip \
  --enable-google-private-path

gcloud sql databases create stocktracker --instance=stock-tracker-db

gcloud sql users create appuser \
  --instance=stock-tracker-db \
  --password=<STRONG_PASSWORD>
```

Connection string (asyncpg + Unix socket):
```
postgresql+asyncpg://appuser:<PASSWORD>@/stocktracker?host=/cloudsql/<PROJECT_ID>:<REGION>:stock-tracker-db
```

### Redis

**Option A: Memorystore (VPC-internal, requires VPC connector)**
```bash
gcloud redis instances create stock-tracker-redis \
  --size=1 \
  --region=$REGION \
  --redis-version=redis_7_0 \
  --tier=BASIC

gcloud compute networks vpc-access connectors create stock-tracker-connector \
  --region=$REGION \
  --range=10.8.0.0/28
```

**Option B: Upstash Redis (no VPC, ~$0–5/mo)**
Sign up at [upstash.com](https://upstash.com), create a database, copy the `rediss://` URL.

### Secret Manager

```bash
echo -n "postgresql+asyncpg://..." | gcloud secrets create DATABASE_URL --data-file=-
echo -n "redis://..."              | gcloud secrets create REDIS_URL --data-file=-
echo -n "<QUIVER_API_KEY>"         | gcloud secrets create QUIVER_API_KEY --data-file=-

for SECRET in DATABASE_URL REDIS_URL QUIVER_API_KEY; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor"
done
```

### Build & Push Docker Images

```bash
IMAGE_BASE=${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}

# Backend
docker build -t ${IMAGE_BASE}/stock-tracker-backend:latest -f backend/Dockerfile backend/
docker push ${IMAGE_BASE}/stock-tracker-backend:latest

# Frontend (NEXT_OUTPUT=standalone is set inside the Dockerfile)
docker build -t ${IMAGE_BASE}/stock-tracker-frontend:latest -f frontend/Dockerfile frontend/
docker push ${IMAGE_BASE}/stock-tracker-frontend:latest
```

### Run Alembic Migrations (Cloud Run Job)

```bash
gcloud run jobs create alembic-migrate \
  --image=${IMAGE_BASE}/stock-tracker-backend:latest \
  --region=$REGION \
  --service-account=$SA_EMAIL \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
  --add-cloudsql-instances=${PROJECT_ID}:${REGION}:stock-tracker-db \
  --command="uv" \
  --args="run,alembic,upgrade,head"

gcloud run jobs execute alembic-migrate --region=$REGION --wait
```

### Deploy Backend

```bash
gcloud run deploy stock-tracker-backend \
  --image=${IMAGE_BASE}/stock-tracker-backend:latest \
  --region=$REGION \
  --platform=managed \
  --service-account=$SA_EMAIL \
  --add-cloudsql-instances=${PROJECT_ID}:${REGION}:stock-tracker-db \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,QUIVER_API_KEY=QUIVER_API_KEY:latest" \
  --set-env-vars="ENVIRONMENT=production" \
  --min-instances=1 \
  --max-instances=1 \
  --memory=512Mi \
  --cpu=1 \
  --port=8080 \
  --no-allow-unauthenticated
```

> `--max-instances=1` is required — APScheduler runs in-process and must not run on multiple instances simultaneously.

### Deploy Frontend

```bash
BACKEND_URL=$(gcloud run services describe stock-tracker-backend \
  --region=$REGION --format="value(status.url)")

gcloud run deploy stock-tracker-frontend \
  --image=${IMAGE_BASE}/stock-tracker-frontend:latest \
  --region=$REGION \
  --platform=managed \
  --service-account=$SA_EMAIL \
  --set-env-vars="API_URL=${BACKEND_URL}" \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --port=8080 \
  --allow-unauthenticated
```

### Custom Domain

```bash
gcloud run domain-mappings create \
  --service=stock-tracker-frontend \
  --domain=yourdomain.com \
  --region=$REGION
```

### Estimated GCP Costs

| Service | Config | Cost/month |
|---------|--------|------------|
| Cloud Run — Backend | 1 instance, always-on | ~$15–25 |
| Cloud Run — Frontend | 0–10 instances, per-request | ~$0–15 |
| Cloud SQL | db-f1-micro, 10 GB | ~$10–15 |
| Memorystore Redis | 1 GB Basic | ~$35–45 |
| Upstash Redis (alt) | Pay-per-command | ~$0–5 |
| Artifact Registry | ~1 GB | ~$0.10 |
| VPC connector (if Memorystore) | e2-micro | ~$7–10 |
| **Total (Memorystore)** | | **~$70–115** |
| **Total (Upstash)** | | **~$35–65** |

---

## Environment Variables Reference

### Backend

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | asyncpg PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `QUIVER_API_KEY` | Quiver Quantitative API key |
| `ENVIRONMENT` | `production` / `development` |
| `PORT` | Set automatically by host |

### Frontend

| Variable | Description |
|----------|-------------|
| `API_URL` | Backend service URL (server-side only) |
| `NEXT_OUTPUT` | Set to `standalone` in Docker builds only |
| `PORT` | Set automatically by host |
