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

## Prerequisites

- A [Cloudflare](https://dash.cloudflare.com/sign-up) account (free Workers plan is enough)
- Node.js 18+ on your machine
- A **fine-grained GitHub PAT** with **Actions: Read and write** on **this repo only**
  1. [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens)
  2. **Generate new token** → **Fine-grained**
  3. Resource owner: the repo owner (`njvanas` for this repo)
  4. Repository access: **Only select repositories** → `CI-CD`
  5. Permissions → Repository → **Actions: Read and write**
  6. Generate and copy the token (you will paste it into Wrangler, never into the site)

## One-time setup

Do this on **your machine**. Cloud agents cannot log into Cloudflare or store your PAT.

### 1. Log in to Cloudflare

```bash
cd workers/try-it-proxy
npm install
npx wrangler login
```

A browser window opens; approve Wrangler.

### 2. Create KV and paste the id

```bash
npx wrangler kv namespace create RATE_LIMITS
```

Copy the `id` from the output into `workers/try-it-proxy/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMITS"
id = "paste-the-id-here"
```

`ALLOWED_ORIGINS` is already set to `https://njvanas.github.io` (plus local dev). If you forked, change `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_REF`, and `ALLOWED_ORIGINS` to your Pages origin (scheme + host only, no path).

### 3. Store Worker secrets

```bash
# Session signing key
openssl rand -base64 48 | npx wrangler secret put JWT_SECRET

# Fine-grained PAT from above (prompted; not echoed)
npx wrangler secret put GITHUB_TOKEN

# Demo password — at least 12 characters. Pick one you will share privately.
node ../../scripts/hash-try-it-password.mjs "your-long-demo-password-here"
# Copy the printed hash, then:
npx wrangler secret put TRY_IT_PASSWORD_HASH
```

Do **not** commit these values. Do **not** put them in GitHub Actions secrets for Pages.

### 4. Deploy the Worker

```bash
npm run deploy
```

Copy the Worker URL from the output, e.g. `https://cicd-try-it-proxy.<your-subdomain>.workers.dev` (no trailing slash).

Smoke-check: `curl https://cicd-try-it-proxy.<your-subdomain>.workers.dev/api/health` should return `{"ok":true}`.

### 5. Point GitHub Pages at the Worker

In the repo: **Settings → Secrets and variables → Actions → Variables → New repository variable**

| Name | Value | Secret? |
|------|-------|---------|
| `TRY_IT_PROXY_URL` | `https://cicd-try-it-proxy.<your-subdomain>.workers.dev` | No — public URL only |

Then **Actions → Deploy to GitHub Pages → Run workflow** on `master`.

The deploy stamps `pages-config.js` with `{ enabled: true, proxyUrl: "..." }` only. No tokens.

### 6. Share the demo password privately

Give the plaintext password only to people who should trigger deploys (DM, 1Password, in person). Rotate it by hashing a new password and updating `TRY_IT_PASSWORD_HASH`.

## Verify

1. Open https://njvanas.github.io/CI-CD/
2. Click **Try it** — you should get a password modal, not a “not configured” message
3. Enter the demo password → a real Pages deploy should start
4. After the workflow finishes, the header timestamp should update

If Try it still says it is not configured, `TRY_IT_PROXY_URL` is missing or the Pages workflow has not run since you set it.

## Local development

```bash
# Terminal 1 — static site
python3 -m http.server 8765

# Terminal 2 — worker (after wrangler.toml + secrets configured)
cd workers/try-it-proxy && npm run dev
```

Stamp a local config (or temporarily set `TRY_IT_PROXY_URL=http://127.0.0.1:8787` when running `scripts/stamp-deploy.mjs`) so the site talks to the local Worker. Published filenames are `pages-config.js` and `pages-deploy.json`.

## What is safe to publish

- `pages-config.js` — `{ enabled, proxyUrl }` only
- `pages-deploy.json` — last deploy timestamp and public run URL
- This repository — Worker source code contains **no** secrets

## What must stay private

- `GITHUB_TOKEN` (Worker secret)
- `JWT_SECRET` (Worker secret)
- `TRY_IT_PASSWORD_HASH` (Worker secret)
- The plaintext demo password (share out-of-band only)
