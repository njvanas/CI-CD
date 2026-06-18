# Pi homelab deployment for the interactive CI/CD demo
# Target host: epstein (192.168.10.30) · frikkie · dolfieshome.org

## What you get

| URL | Purpose |
|-----|---------|
| `https://cicd.dolfieshome.org/` | Public demo site (built from `content/site.json`) |
| `https://cicd.dolfieshome.org/admin/` | Editor — change text/theme and deploy |
| GitHub Actions | Real CI pipeline triggered on every deploy |

Flow: **Editor → git push → GitHub Actions (self-hosted runner on Pi) → `npm run build` → live site**

---

## 1. DNS & Cloudflare

```bash
cloudflared tunnel route dns homelab cicd.dolfieshome.org
```

Add a Cloudflare Access app for `cicd.dolfieshome.org/admin` (and optionally the whole subdomain).

---

## 2. Clone repo on the Pi

```bash
mkdir -p ~/docker/cicd/{repo,www}
git clone https://github.com/njvanas/CI-CD.git ~/docker/cicd/repo
cd ~/docker/cicd/repo
```

You need the **revamped repo** (with `content/site.json` and `scripts/build.mjs`). If those paths are missing after clone, pull the latest from GitHub first.

### Build the site (pick one)

**Option A — Docker (recommended; no npm on the Pi host)**

```bash
cd ~/docker/cicd/repo
docker run --rm -v "$PWD:/app" -w /app node:22-bookworm-slim node scripts/build.mjs
rsync -a dist/ ~/docker/cicd/www/
```

**Option B — install Node on the Pi**

```bash
sudo apt update
sudo apt install -y nodejs npm
cd ~/docker/cicd/repo
npm run build
rsync -a dist/ ~/docker/cicd/www/
```

**Option C — old repo layout only (temporary)**

If GitHub still has the legacy flat site (`index.html` at repo root, no `dist/`), serve it directly:

```bash
cd ~/docker/cicd/repo
rsync -a --exclude .git --exclude .github ./ ~/docker/cicd/www/
```

Verify:

```bash
ls ~/docker/cicd/www/index.html
```

---

## 3. GitHub deploy key (push from editor)

On the Pi:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/cicd_deploy -N ""
cat ~/.ssh/cicd_deploy.pub
```

Add the public key in GitHub → **njvanas/CI-CD** → Settings → Deploy keys → **Allow write access**.

Configure the repo clone to push via that key:

```bash
cd ~/docker/cicd/repo
git remote set-url origin git@github.com:njvanas/CI-CD.git
GIT_SSH_COMMAND='ssh -i ~/.ssh/cicd_deploy -o IdentitiesOnly=yes' git push
```

---

## 4. GitHub fine-grained PAT (poll Actions from editor)

Create a token with **Contents: Read** and **Actions: Read** on `njvanas/CI-CD`.

On the Pi:

```bash
nano ~/docker/cicd/.env
```

```env
GITHUB_TOKEN=ghp_xxxxxxxx
```

---

## 5. Self-hosted Actions runner (runs ON the Pi)

This is what makes the demo honest — the workflow executes on your homelab, not in GitHub’s cloud.

```bash
mkdir -p ~/docker/cicd/actions-runner && cd ~/docker/cicd/actions-runner
curl -o actions-runner-linux-arm64-2.322.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.322.0/actions-runner-linux-arm64-2.322.0.tar.gz
tar xzf ./actions-runner-linux-arm64-*.tar.gz
./config.sh --url https://github.com/njvanas/CI-CD --token RUNNER_TOKEN_FROM_GITHUB
sudo ./svc.sh install frikkie
sudo ./svc.sh start
```

Set runner env so deploy knows where to publish:

```bash
# In ~/docker/cicd/actions-runner/.env or svc environment
WEB_ROOT=/home/frikkie/docker/cicd/www
```

Re-register instructions: GitHub → repo → Settings → Actions → Runners → New self-hosted runner.

---

## 6. Start the stack

```bash
cd ~/docker/cicd/repo
docker compose -f deploy/pi/compose.yaml --env-file ~/docker/cicd/.env up -d --build
```

Traefik + tunnel must already be running (see homelab handoff).

---

## 7. Try the demo

1. Open `https://cicd.dolfieshome.org/admin/`
2. Change the hero title or pick the **Ocean** theme
3. Watch the preview update
4. Click **Deploy changes**
5. Follow the pipeline panel — push → Actions → build → publish
6. Open the live site and confirm the change

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Push fails from container | Mount deploy key; verify deploy key has write access |
| Actions never start | Self-hosted runner offline — `sudo ~/docker/cicd/actions-runner/svc.sh status` |
| Editor shows Actions error | Set `GITHUB_TOKEN` in `~/docker/cicd/.env` |
| Site 404 | Check `~/docker/cicd/www/index.html` exists; re-run `npm run build` |
| Stale content | Hard refresh or check workflow succeeded in GitHub Actions |

---

## Data you can wipe and recreate

- `~/docker/cicd/www/` — rebuilt by Actions
- `content/site.json` — source of truth in Git
- Runner + container — reinstall from this doc

No irreplaceable user data — fits the homelab utility pattern.
