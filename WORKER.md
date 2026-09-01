# Try it proxy (secure deploy trigger)

The public GitHub Pages site **never** stores GitHub tokens, API keys, or demo passwords. Try it talks to a private [Cloudflare Worker](workers/try-it-proxy/) that:

1. Verifies a demo password (PBKDF2 hash stored as a Worker secret)
2. Issues a short-lived signed session token (JWT)
3. Enforces IP rate limits (5 minutes between deploys, 5 per UTC day)
4. Dispatches `.github/workflows/try-it.yml` using a GitHub token that exists **only** in Worker secrets

GitHub Actions still runs a second rate-limit gate on the `try-it-state` branch for defense in depth.

## Security model

| Layer | What it protects |
|-------|------------------|
| Public Pages site | No secrets in HTML/JS — only the public proxy URL |
| Password + JWT | Anonymous visitors cannot trigger deploys |
| Worker KV | Edge rate limits before Actions minutes are spent |
| Actions gate | Server-side limits persisted on `try-it-state` branch |
| CORS allowlist | Only your Pages origin can call the proxy from a browser |

## One-time setup

### 1. Cloudflare Worker

```bash
cd workers/try-it-proxy
npm install
wrangler kv namespace create RATE_LIMITS
# Paste the id into wrangler.toml → [[kv_namespaces]] → id

# Secrets (never commit):
openssl rand -base64 48 | wrangler secret put JWT_SECRET
# Fine-grained PAT: Actions Read and write on ONLY this repo
wrangler secret put GITHUB_TOKEN
node ../../scripts/hash-try-it-password.mjs "your-long-demo-password-here"
# Copy output → wrangler secret put TRY_IT_PASSWORD_HASH

# Edit wrangler.toml:
# - ALLOWED_ORIGINS (your https://USER.github.io/REPO origin)
# - GITHUB_OWNER / GITHUB_REPO / GITHUB_REF if forking

npm run deploy
```

Note the Worker URL, e.g. `https://cicd-try-it-proxy.<account>.workers.dev`.

### 2. GitHub repository variable

In the repo: **Settings → Secrets and variables → Actions → Variables**

| Name | Example | Secret? |
|------|---------|---------|
| `TRY_IT_PROXY_URL` | `https://cicd-try-it-proxy.example.workers.dev` | No — public URL only |

Re-run **Deploy to GitHub Pages** so `try-it-config.js` picks up the proxy URL.

### 3. Share the demo password privately

Give the demo password only to people who should trigger deploys (DM, 1Password share link, in-person, etc.). Rotate it by generating a new hash and updating `TRY_IT_PASSWORD_HASH`.

## Local development

```bash
# Terminal 1 — static site
python3 -m http.server 8765

# Terminal 2 — worker (after wrangler.toml + secrets configured)
cd workers/try-it-proxy && npm run dev
```

Set `TRY_IT_PROXY_URL=http://127.0.0.1:8787` in a local `try-it-config.js` or stamp script output for testing.

## What is safe to publish

- `try-it-config.js` — `{ enabled, proxyUrl }` only
- `deploy-info.json` — last deploy timestamp and public run URL
- This repository — Worker source code contains **no** secrets

## What must stay private

- `GITHUB_TOKEN` (Worker secret)
- `JWT_SECRET` (Worker secret)
- `TRY_IT_PASSWORD_HASH` (Worker secret)
- The plaintext demo password (share out-of-band only)
