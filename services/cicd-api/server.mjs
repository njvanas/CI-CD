import http from "node:http";
import { spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "../../scripts/build.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.REPO_PATH || join(__dirname, "..", "..");
const adminRoot = join(repoRoot, "admin");
const contentPath = join(repoRoot, "content", "site.json");
const wwwPath = process.env.WWW_PATH || join(repoRoot, "dist");
const previewPath = join(repoRoot, ".preview");
const port = Number(process.env.PORT || 3000);

const githubOwner = process.env.GITHUB_OWNER || "njvanas";
const githubRepo = process.env.GITHUB_REPO || "CI-CD";
const githubToken = process.env.GITHUB_TOKEN || "";
const defaultBranch = process.env.GITHUB_BRANCH || "master";

/** @type {{ status: string, conclusion?: string, phase?: string, runId?: number, runUrl?: string, jobs?: unknown[], logLines?: string[], updatedAt?: string }} */
let deployState = {
  status: "idle",
  logLines: [],
  updatedAt: new Date().toISOString()
};

/** @type {Set<import('node:http').ServerResponse>} */
const streamClients = new Set();

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function broadcastDeployState() {
  const payload = `data: ${JSON.stringify(deployState)}\n\n`;
  for (const client of streamClients) {
    client.write(payload);
  }
}

function setDeployState(patch) {
  deployState = {
    ...deployState,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  broadcastDeployState();
}

function appendLog(line) {
  const lines = [...(deployState.logLines || []), line].slice(-80);
  setDeployState({ logLines: lines });
}

function contentType(filePath) {
  const ext = extname(filePath);
  const map = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon"
  };
  return map[ext] || "application/octet-stream";
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || stdout.trim() || `${command} exited ${code}`));
    });
  });
}

async function githubFetch(pathname) {
  if (!githubToken) return null;
  const res = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res.json();
}

async function refreshRunState(runId) {
  if (!runId || !githubToken) return;
  const run = await githubFetch(`/repos/${githubOwner}/${githubRepo}/actions/runs/${runId}`);
  const jobsPayload = await githubFetch(`/repos/${githubOwner}/${githubRepo}/actions/runs/${runId}/jobs`);
  const jobs = jobsPayload?.jobs ?? [];
  for (const job of jobs) {
    appendLog(`[job] ${job.name}: ${job.status}${job.conclusion ? ` (${job.conclusion})` : ""}`);
  }
  setDeployState({
    status: run.status,
    conclusion: run.conclusion,
    phase: run.status === "completed" ? "done" : "watching",
    runId,
    runUrl: run.html_url,
    jobs
  });
}

async function waitForWorkflowRun(beforeRunId) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const data = await githubFetch(`/repos/${githubOwner}/${githubRepo}/actions/runs?per_page=5`);
    const run = (data?.workflow_runs ?? []).find((item) => item.id !== beforeRunId);
    if (run) return run.id;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Timed out waiting for GitHub Actions run");
}

async function pollRunUntilComplete(runId) {
  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    await refreshRunState(runId);
    if (deployState.status === "completed") return;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Timed out waiting for workflow completion");
}

async function gitPushContent(content) {
  writeJson(contentPath, content);
  appendLog("Wrote content/site.json");

  await runCommand("git", ["config", "user.name", process.env.GIT_USER_NAME || "CI/CD Demo"]);
  await runCommand("git", ["config", "user.email", process.env.GIT_USER_EMAIL || "cicd-demo@local"]);
  await runCommand("git", ["add", "content/site.json"]);
  let committed = false;
  try {
    await runCommand("git", ["diff", "--cached", "--quiet"]);
    appendLog("No file changes detected — pushing anyway if ahead");
  } catch {
    await runCommand("git", ["commit", "-m", `content: update site from editor (${new Date().toISOString()})`]);
    committed = true;
    appendLog("Created git commit");
  }
  await runCommand("git", ["push", "origin", defaultBranch]);
  appendLog(`Pushed to origin/${defaultBranch}`);
  return committed;
}

function buildPreview(content) {
  mkdirSync(previewPath, { recursive: true });
  buildSite({ site: content, quiet: true });
  rmSync(previewPath, { recursive: true, force: true });
  cpSync(join(repoRoot, "dist"), previewPath, { recursive: true });
}

function syncPreviewToWww() {
  mkdirSync(wwwPath, { recursive: true });
  cpSync(previewPath, wwwPath, { recursive: true });
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw);
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath) {
  if (!existsSync(filePath)) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  res.end(readFileSync(filePath));
}

function serveStaticTree(res, rootDir, urlPath) {
  let rel = urlPath.replace(/^\/+/, "") || "index.html";
  let filePath = join(rootDir, rel);
  if (!filePath.startsWith(rootDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }
  if (!existsSync(filePath) && !extname(rel)) {
    filePath = join(rootDir, rel, "index.html");
  }
  serveFile(res, filePath);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/content") {
      sendJson(res, 200, readJson(contentPath, {}));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/deploy/status") {
      sendJson(res, 200, deployState);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/deploy/stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      });
      res.write(`data: ${JSON.stringify(deployState)}\n\n`);
      streamClients.add(res);
      req.on("close", () => streamClients.delete(res));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/preview") {
      const content = await parseBody(req);
      buildPreview(content);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/preview/")) {
      serveStaticTree(res, previewPath, url.pathname.replace("/api/preview", ""));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/deploy") {
      const body = await parseBody(req);
      const content = body?.content;
      if (!content) {
        sendJson(res, 400, { error: "Missing content" });
        return;
      }

      setDeployState({
        status: "in_progress",
        conclusion: undefined,
        phase: "pushing",
        logLines: ["Starting deployment…"],
        jobs: []
      });

      let beforeRunId = null;
      if (githubToken) {
        const latest = await githubFetch(`/repos/${githubOwner}/${githubRepo}/actions/runs?per_page=1`);
        beforeRunId = latest?.workflow_runs?.[0]?.id ?? null;
      }

      buildPreview(content);

      try {
        await gitPushContent(content);
        setDeployState({ phase: "watching" });

        if (githubToken) {
          const runId = await waitForWorkflowRun(beforeRunId);
          appendLog(`Workflow run #${runId} started`);
          await pollRunUntilComplete(runId);
          if (deployState.conclusion === "success") {
            syncPreviewToWww();
            appendLog("Synced built files to web root");
          }
        } else {
          syncPreviewToWww();
          setDeployState({ status: "completed", conclusion: "success", phase: "done" });
          appendLog("GITHUB_TOKEN not set — deployed locally without Actions polling");
        }

        sendJson(res, 200, deployState);
      } catch (err) {
        setDeployState({ status: "completed", conclusion: "failure", phase: "done" });
        appendLog(`ERROR: ${err.message}`);
        sendJson(res, 500, { error: err.message, ...deployState });
      }
      return;
    }

    if (req.method === "GET" && (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))) {
      const adminPath = url.pathname === "/admin" ? "/admin/index.html" : url.pathname;
      serveStaticTree(res, adminRoot, adminPath.replace(/^\/admin\/?/, ""));
      return;
    }

    if (req.method === "GET") {
      serveStaticTree(res, wwwPath, url.pathname);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Server error" });
  }
});

server.listen(port, () => {
  console.log(`cicd-api listening on :${port}`);
  console.log(`repo=${repoRoot} www=${wwwPath}`);
});
