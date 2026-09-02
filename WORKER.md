# Try it (redeploy trigger)

The public site has no GitHub tokens. **Try it** calls a small [Cloudflare Worker](workers/try-it-proxy/) that holds `GITHUB_TOKEN` and starts `.github/workflows/try-it.yml`. After Pages publishes, the header date updates. That is the only change visitors see.

IP rate limits still run in the Worker and again in Actions so the token cannot be used to spam deploys.

## One-time setup (on your machine)

```bash
cd workers/try-it-proxy
npm install
npx wrangler login
npx wrangler kv namespace create RATE_LIMITS
# Paste the id into wrangler.toml → [[kv_namespaces]] → id

# Fine-grained PAT: Actions Read and write on this repo only
npx wrangler secret put GITHUB_TOKEN

npm run deploy
```

Copy the Worker URL (no trailing slash), e.g. `https://cicd-try-it-proxy.<you>.workers.dev`.

Repo **Settings → Secrets and variables → Actions → Variables**:

| Name | Value |
|------|--------|
| `TRY_IT_PROXY_URL` | the Worker URL |

Then **Actions → Deploy to GitHub Pages → Run workflow** on `master`.

The published `pages-config.js` only contains `{ enabled, proxyUrl }`.
