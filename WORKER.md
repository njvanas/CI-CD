# Try it proxy (rate-limited deploy trigger)

The public GitHub Pages site **never** stores GitHub tokens or API keys. Anyone can click Try it. The browser talks to a private [Cloudflare Worker](workers/try-it-proxy/) that:

1. Allows only your Pages origin (CORS)
2. Enforces IP rate limits (5 minutes between deploys, 5 per UTC day)
3. Dispatches `.github/workflows/try-it.yml` using a GitHub token that exists **only** in Worker secrets

GitHub Actions still runs a second rate-limit gate on the `try-it-state` branch for defense in depth.

## Security model

| Layer | What it protects |
|-------|------------------|
| Public Pages site | No secrets in HTML/JS — only the public proxy URL |
| CORS allowlist | Only your Pages origin can call the proxy from a browser |
| Worker KV | Edge rate limits before Actions minutes are spent |
| Actions gate | Server-side limits persisted on `try-it-state` branch |

## One-time setup

### 1. Cloudflare Worker

```bash
cd workers/try-it-proxy
npm install
npx wrangler kv namespace create RATE_LIMITS
# Paste the id into wrangler.toml → [[kv_namespaces]] → id

# Fine-grained PAT: Actions Read and write on ONLY this repo
npx wrangler secret put GITHUB_TOKEN

# Edit wrangler.toml:
# - ALLOWED_ORIGINS (your https://USER.github.io origin)
# - GITHUB_OWNER / GITHUB_REPO / GITHUB_REF if forking

npm run deploy
```

Note the Worker URL, e.g. `https://cicd-try-it-proxy.<account>.workers.dev`.

### 2. GitHub repository variable

In the repo: **Settings → Secrets and variables → Actions → Variables**

| Name | Example | Secret? |
|------|---------|---------|
| `TRY_IT_PROXY_URL` | `https://cicd-try-it-proxy.example.workers.dev` | No — public URL only |

Re-run **Deploy to GitHub Pages** so `pages-config.js` picks up the proxy URL.

## Local development

```bash
# Terminal 1 — static site
python3 -m http.server 8765

# Terminal 2 — worker
cd workers/try-it-proxy && npm run dev
```

Set `TRY_IT_PROXY_URL=http://127.0.0.1:8787` when stamping `pages-config.js`.

## What is safe to publish

- `pages-config.js` — `{ enabled, proxyUrl }` only
- `pages-deploy.json` — last deploy timestamp and public run URL
- This repository — Worker source code contains **no** secrets

## What must stay private

- `GITHUB_TOKEN` (Worker secret)
