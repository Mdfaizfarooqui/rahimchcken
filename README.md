# Rahim's Chicken — Fresh Cut Raw Chicken Shop

Order farm-raised raw chicken online, track your pickup ticket in real time, and let the
shop owner manage the menu and the queue from a dashboard.

- **Frontend** — React 18 + Vite (SPA), deployed to **Vercel**
- **Backend** — Express + SQLite (`server/`), deployed to **Render**
- **CI/CD** — GitHub Actions (`.github/workflows/`)

## Project layout

```
src/                 React app (App.jsx + components/)
server/              Express API, SQLite database, multer uploads
  server.js          API entry point (exports `app` for tests)
  database.js        SQLite schema + query helpers
  test/api.test.js   API tests (node:test)
.github/workflows/   CI and CD pipelines
render.yaml          Render blueprint for the backend service
vercel.json          Vercel build settings + API proxy rules
```

## Local setup

```bash
npm run setup   # installs root + server dependencies
npm run dev:all # runs Vite on :5173 and the API on :3001
```

Vite proxies `/api` and `/uploads` to `http://localhost:3001` (see `vite.config.js`).

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run server` | Start the Express API |
| `npm run dev:all` | Run both together |
| `npm run setup` | Install root and server dependencies |
| `npm run build` | Build the frontend into `dist/` |
| `npm run lint` | Lint the whole repo (ESLint 9 flat config) |
| `npm test` | Run the API test suite |
| `npm run preview` | Preview the production build |

## Configuration

The backend reads its configuration from environment variables (all optional, with
local-friendly defaults):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | Port the API listens on |
| `DB_PATH` | `server/chicken_shop.db` | SQLite database file |
| `UPLOAD_DIR` | `server/uploads` | Where uploaded product images are written |
| `OWNER_PIN` | `1234` | PIN for the owner dashboard |
| `AUTH_TOKEN` | `fc_owner_secure_token_5819` | Owner session token |

**Set `OWNER_PIN` and `AUTH_TOKEN` to real secrets in production** — the defaults are
publicly known and must not be used on a live deployment.

## CI/CD

Two GitHub Actions workflows live in `.github/workflows/`:

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci.yml` | Push / PR to `main` | ESLint (zero warnings enforced), API tests, production build + artifact upload |
| `cd.yml` | Push to `main` (or manual dispatch) | Triggers the Render backend deploy, waits for the health check, then builds and deploys the frontend to Vercel |

CI must be green before CD runs — the build job depends on `lint` and `test`, and the
frontend deploy waits for the backend deploy.

### One-time setup

**1. Push the repository to GitHub**

```bash
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

**2. Add the repository secrets** (GitHub → *Settings* → *Secrets and variables* → *Actions*):

| Secret | Where to get it |
| --- | --- |
| `VERCEL_TOKEN` | Vercel → *Account Settings* → *Tokens* → *Create* |
| `VERCEL_ORG_ID` | Vercel → Project → *Settings* → *General* → **Team ID** |
| `VERCEL_PROJECT_ID` | Vercel → Project → *Settings* → *General* → **Project ID** |
| `RENDER_DEPLOY_HOOK_URL` | Render → Service → *Settings* → *Deploy* → *Create Deploy Hook* |

> The `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` values also live in `.vercel/project.json`
> after running `npx vercel link` locally.

**3. Add the repository variables** (*Actions* → *Variables*):

| Variable | Example | Purpose |
| --- | --- | --- |
| `BACKEND_HEALTH_URL` | `https://rahimchcken.onrender.com/api/health` | Polled after each backend deploy |
| `FRONTEND_URL` | `https://rahimchcken.vercel.app` | Polled after each frontend deploy |

**4. Create the Render service**

Render reads `render.yaml` from the repo root, so you can create the service with
*New → Blueprint* and point it at this repository. It will ask you to provide
`OWNER_PIN` and `AUTH_TOKEN` (both `sync: false`).

Alternatively, create the service manually with:

- Root directory: `server`
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/api/health`

`render.yaml` sets `autoDeployTrigger: off` on purpose — the backend is deployed **only**
by the GitHub Actions pipeline, so you keep a single source of truth for releases.

**5. Point the frontend at the backend**

`vercel.json` rewrites `/api/*` and `/uploads/*` to the Render backend URL. Update the
`destination` values if your backend is not at `rahimchcken.onrender.com`.

### What a release looks like

```
git push origin main
      │
      ├── CI: lint ─┐
      │             ├─► build (dist artifact)
      │   test ────┘
      │
      └── CD: Render deploy hook → poll /api/health → vercel build → vercel deploy → poll frontend
```

### Known limitations

- The SQLite database lives on the Render instance's filesystem. On the **free plan** the
  service is spun down and the disk is reset, so orders, users and uploaded images do not
  survive a cold start. Attach a **persistent disk** (paid plan) or migrate to a hosted
  Postgres + object storage for production-grade durability.
- The `server/uploads` directory is likewise ephemeral on the free plan.
- Server-Sent Events (the live order tracker) are dropped when the free instance idles
  out. See `DEPLOYMENT.md` for stateless alternatives.

## Deployment guide

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the manual/one-off hosting walkthroughs
(Vercel, Render, Fly.io, Alwaysdata, Oracle Cloud) and for the path to a fully
serverless, stateless deployment.
