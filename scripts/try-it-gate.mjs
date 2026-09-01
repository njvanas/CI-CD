#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import {
  emptyState,
  evaluateRateLimit,
  isValidVisitorKey,
  recordSuccess,
  resultSummary,
  STATE_BRANCH,
  STATE_PATH
} from './rate-limit.mjs';

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const visitorKey = String(process.env.VISITOR_KEY || '').trim().toLowerCase();
const currentRunId = Number(process.env.GITHUB_RUN_ID || 0);

if (!repo || !token) {
  fail('Missing GITHUB_REPOSITORY or GITHUB_TOKEN');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function setOutput(name, value) {
  const line = `${name}=${value}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line);
  console.log(line.trim());
}

async function gh(method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

function emit(decision) {
  const summary = resultSummary(decision);
  setOutput('allowed', decision.allowed ? 'true' : 'false');
  setOutput('reason', decision.reason);
  setOutput('summary', summary);
  setOutput('retry_after', String(decision.retryAfterSeconds || 0));
  setOutput('remaining_today', String(decision.remainingToday ?? 0));
}

async function isDeployBusy() {
  const { ok, json } = await gh(
    'GET',
    `/repos/${repo}/actions/runs?status=in_progress&per_page=25`
  );
  if (!ok) {
    console.warn(`Could not list in-progress runs (${json?.message || 'unknown'})`);
    return false;
  }
  for (const run of json.workflow_runs || []) {
    if (run.id === currentRunId) continue;
    const path = run.path || '';
    if (path.endsWith('deploy.yml')) return true;
    if (!path.endsWith('try-it.yml')) continue;
    const jobsRes = await gh('GET', `/repos/${repo}/actions/runs/${run.id}/jobs`);
    for (const job of jobsRes.json?.jobs || []) {
      const name = (job.name || '').toLowerCase();
      if (name.includes('gate')) continue;
      const active = job.status === 'in_progress' || job.status === 'queued' || job.status === 'waiting';
      if (active && name.includes('deploy')) return true;
    }
  }
  return false;
}

async function loadState() {
  const { ok, status, json } = await gh(
    'GET',
    `/repos/${repo}/contents/${STATE_PATH}?ref=${STATE_BRANCH}`
  );
  if (status === 404) return { state: emptyState(), sha: null, exists: false };
  if (!ok) throw new Error(`Failed to read rate-limit state: ${json?.message || status}`);
  const decoded = Buffer.from(json.content.replace(/\n/g, ''), 'base64').toString('utf8');
  return { state: JSON.parse(decoded), sha: json.sha, exists: true };
}

async function createOrphanState(content) {
  const blob = await gh('POST', `/repos/${repo}/git/blobs`, {
    content: Buffer.from(content, 'utf8').toString('base64'),
    encoding: 'base64'
  });
  if (!blob.ok) throw new Error(`blob: ${blob.json?.message}`);
  const tree = await gh('POST', `/repos/${repo}/git/trees`, {
    tree: [{ path: STATE_PATH, mode: '100644', type: 'blob', sha: blob.json.sha }]
  });
  if (!tree.ok) throw new Error(`tree: ${tree.json?.message}`);
  const commit = await gh('POST', `/repos/${repo}/git/commits`, {
    message: 'chore: init try-it rate-limit state',
    tree: tree.json.sha,
    parents: []
  });
  if (!commit.ok) throw new Error(`commit: ${commit.json?.message}`);
  const ref = await gh('POST', `/repos/${repo}/git/refs`, {
    ref: `refs/heads/${STATE_BRANCH}`,
    sha: commit.json.sha
  });
  if (!ref.ok && ref.status !== 422) throw new Error(`ref: ${ref.json?.message}`);
}

async function saveState(state, sha) {
  const content = `${JSON.stringify(state, null, 2)}\n`;
  const body = {
    message: `chore: record try-it deploy ${new Date().toISOString()}`,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: STATE_BRANCH
  };
  if (sha) body.sha = sha;
  const { ok, status, json } = await gh(
    'PUT',
    `/repos/${repo}/contents/${STATE_PATH}`,
    body
  );
  if (status === 409 || status === 422) return { conflict: true };
  if (!ok) throw new Error(`Failed to write rate-limit state: ${json?.message || status}`);
  return { conflict: false };
}

async function persistSuccess(visitorKey, now) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let loaded;
    try {
      loaded = await loadState();
    } catch (err) {
      throw err;
    }
    if (!loaded.exists) {
      try {
        await createOrphanState(`${JSON.stringify(emptyState(), null, 2)}\n`);
        loaded = await loadState();
      } catch (err) {
        console.warn(`State branch init: ${err.message}`);
      }
    }
    const next = recordSuccess(loaded.state || emptyState(), visitorKey, now);
    const saved = await saveState(next, loaded.sha);
    if (!saved.conflict) return next;
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  throw new Error('Could not update rate-limit state after conflicts');
}

async function main() {
  if (!isValidVisitorKey(visitorKey)) {
    emit({
      allowed: false,
      reason: 'invalid_key',
      remainingToday: 0,
      retryAfterSeconds: 300
    });
    return;
  }

  if (await isDeployBusy()) {
    emit({
      allowed: false,
      reason: 'busy',
      remainingToday: 0,
      retryAfterSeconds: 30
    });
    return;
  }

  let loaded;
  try {
    loaded = await loadState();
  } catch {
    loaded = { state: emptyState(), sha: null, exists: false };
  }
  if (!loaded.exists) {
    try {
      await createOrphanState(`${JSON.stringify(emptyState(), null, 2)}\n`);
      loaded = await loadState();
    } catch (err) {
      console.warn(`Could not init state branch yet: ${err.message}`);
      loaded = { state: emptyState(), sha: null, exists: false };
    }
  }

  const now = new Date();
  const entry = loaded.state.visitors?.[visitorKey];
  const decision = evaluateRateLimit(entry, loaded.state.global, now);
  if (!decision.allowed) {
    emit(decision);
    return;
  }

  await persistSuccess(visitorKey, now);
  emit(decision);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
