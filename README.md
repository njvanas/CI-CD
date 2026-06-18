# CI/CD Interactive Demo

A hands-on **CI/CD teaching demo**: edit site content in a browser, push to GitHub, watch GitHub Actions build and deploy, see the live site update on a Raspberry Pi homelab.

Previously a static GitHub Pages template with a *simulated* pipeline. It is now **content-driven**, **editor-backed**, and wired to **real automation**.

## Architecture

```text
┌─────────────────┐     git push      ┌──────────────────┐
│  /admin editor  │ ────────────────► │  GitHub repo     │
│  (Pi container) │                   │  content/site.json│
└────────┬────────┘                   └────────┬─────────┘
         │ preview build                       │ webhook
         │                                     ▼
         │                            ┌──────────────────┐
         │                            │ GitHub Actions   │
         │                            │ (self-hosted Pi) │
         │                            │ npm run build    │
         │                            └────────┬─────────┘
         │                                     │ rsync
         ▼                                     ▼
┌─────────────────────────────────────────────────────────┐
│  ~/docker/cicd/www  ←  Traefik  ←  Cloudflare Tunnel   │
│  https://cicd.dolfieshome.org                           │
└─────────────────────────────────────────────────────────┘
```

## What's in the repo

| Path | Purpose |
|------|---------|
| `content/site.json` | **Source of truth** — text + theme (editable) |
| `scripts/build.mjs` | Builds static site into `dist/` |
| `src/` | HTML template, CSS/JS bases, icons |
| `admin/` | Browser editor UI |
| `services/cicd-api/` | API: preview, git push, Actions status (SSE) |
| `deploy/pi/compose.yaml` | Pi Docker stack (Traefik labels included) |
| `.github/workflows/deploy-pi.yml` | Real CI/CD pipeline |
| `HOMELAB.md` | Step-by-step Pi setup (runner, keys, DNS) |

Legacy `.github/workflows/deploy.yml` still publishes to **GitHub Pages** if you enable it — optional. Primary target is **Pi hosting**.

## Local build

```bash
npm run build
# output in dist/
```

## Pi deployment

See **[HOMELAB.md](HOMELAB.md)** for full setup:

1. Clone repo on Pi  
2. Register **self-hosted GitHub Actions runner** (build runs on the Pi — not GitHub cloud)  
3. Deploy key for git push from editor  
4. `GITHUB_TOKEN` for live pipeline status in UI  
5. `docker compose -f deploy/pi/compose.yaml up -d`  
6. `cloudflared tunnel route dns homelab cicd.dolfieshome.org`  

## Demo flow (what students/users see)

1. Open **`/admin/`** — edit hero text or pick a theme preset  
2. Preview updates locally (instant)  
3. Click **Deploy changes**  
4. Watch: **Push → Actions → Build → Deploy → Live**  
5. Open **`/`** — see the real updated site  

## Customization without the editor

Edit `content/site.json`, run `npm run build`, commit, push — same pipeline.

## License

Open source — use for teaching, portfolio, homelab demos.
