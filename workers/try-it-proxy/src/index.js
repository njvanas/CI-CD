import {
  evaluateRateLimit,
  resultSummary
} from './rate-limit.mjs';
import { signJwt, verifyJwt, verifyPassword } from './auth-crypto.mjs';

const AUTH_MAX_ATTEMPTS = 10;
const AUTH_WINDOW_MS = 15 * 60 * 1000;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

function corsHeaders(origin, env) {
  const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  if (!origin || !allowed.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function parseAllowedOrigins(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
  );
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || '0.0.0.0';
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function kvGetJson(kv, key) {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function kvPutJson(kv, key, value, ttlSec) {
  await kv.put(key, JSON.stringify(value), ttlSec ? { expirationTtl: ttlSec } : undefined);
}

async function loadRateState(kv) {
  const global = (await kvGetJson(kv, 'rl:global')) || { day: '', count: 0 };
  return { global, visitors: {} };
}

async function loadVisitorEntry(kv, visitorKey, day) {
  return (await kvGetJson(kv, `rl:ip:${visitorKey}:${day}`)) || null;
}

async function persistRateSuccess(kv, visitorKey, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const global = (await kvGetJson(kv, 'rl:global')) || { day: '', count: 0 };
  const globalCount = global.day === day ? Number(global.count) || 0 : 0;
  await kvPutJson(kv, 'rl:global', { day, count: globalCount + 1 }, 86_400);

  const prev = (await kvGetJson(kv, `rl:ip:${visitorKey}:${day}`)) || { count: 0 };
  const count = Number(prev.count) || 0;
  await kvPutJson(
    kv,
    `rl:ip:${visitorKey}:${day}`,
    { day, count: count + 1, lastAt: now.toISOString() },
    86_400
  );
  await kvPutJson(kv, `rl:ip:${visitorKey}:last`, { lastAt: now.toISOString() }, 86_400);
}

async function evaluateVisitorLimit(kv, visitorKey, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const global = (await kvGetJson(kv, 'rl:global')) || { day: '', count: 0 };
  const entry = await loadVisitorEntry(kv, visitorKey, day);
  const lastWrap = await kvGetJson(kv, `rl:ip:${visitorKey}:last`);
  const merged = entry
    ? { ...entry, lastAt: entry.lastAt || lastWrap?.lastAt }
    : lastWrap?.lastAt
      ? { day, count: 0, lastAt: lastWrap.lastAt }
      : undefined;
  return evaluateRateLimit(merged, global, now);
}

async function authAttemptAllowed(kv, ipHash) {
  const key = `auth:${ipHash}`;
  const state = (await kvGetJson(kv, key)) || { count: 0, windowStart: Date.now() };
  const now = Date.now();
  if (now - state.windowStart > AUTH_WINDOW_MS) {
    await kvPutJson(kv, key, { count: 1, windowStart: now }, Math.ceil(AUTH_WINDOW_MS / 1000));
    return true;
  }
  if (state.count >= AUTH_MAX_ATTEMPTS) return false;
  await kvPutJson(
    kv,
    key,
    { count: state.count + 1, windowStart: state.windowStart },
    Math.ceil((AUTH_WINDOW_MS - (now - state.windowStart)) / 1000)
  );
  return true;
}

async function bearerPayload(request, env) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifyJwt(match[1].trim(), env.JWT_SECRET);
}

async function githubFetch(env, path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data, text };
}

function repoConfig(env) {
  return {
    owner: env.GITHUB_OWNER || 'njvanas',
    repo: env.GITHUB_REPO || 'CI-CD',
    ref: env.GITHUB_REF || 'master',
    workflow: env.GITHUB_WORKFLOW || 'try-it.yml'
  };
}

async function isDeployBusy(env) {
  const { owner, repo } = repoConfig(env);
  const res = await githubFetch(env, `/repos/${owner}/${repo}/actions/runs?status=in_progress&per_page=25`);
  if (!res.ok) return false;
  for (const run of res.data?.workflow_runs || []) {
    const path = run.path || '';
    if (path.endsWith('deploy.yml') || path.endsWith('try-it.yml')) return true;
  }
  return false;
}

async function dispatchTryIt(env, requestId, visitorKey) {
  const { owner, repo, ref, workflow } = repoConfig(env);
  const res = await githubFetch(env, `/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({
      ref,
      inputs: { request_id: requestId, visitor_key: visitorKey }
    })
  });
  if (res.status === 204 || res.status === 200) return { ok: true };
  return { ok: false, status: res.status, message: res.data?.message || res.text || 'dispatch failed' };
}

async function findRunByRequestId(env, requestId) {
  const { owner, repo, workflow } = repoConfig(env);
  const res = await githubFetch(
    env,
    `/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?event=workflow_dispatch&per_page=20`
  );
  if (!res.ok) return null;
  const needle = `try-it ${requestId}`;
  return (res.data?.workflow_runs || []).find((run) => {
    const title = `${run.name || ''} ${run.display_title || ''}`;
    return title.includes(needle) || title.includes(requestId);
  });
}

function parseResultStepName(name) {
  const m = String(name || '').match(/^try-it-result\s+(\w+)(?:\s+(\d+))?(?:\s+(\d+))?$/);
  if (!m) return null;
  return {
    reason: m[1],
    retryAfterSeconds: m[2] ? Number(m[2]) : 0,
    remainingToday: m[3] != null ? Number(m[3]) : undefined
  };
}

async function gateStatusForRun(env, runId) {
  const { owner, repo } = repoConfig(env);
  const jobsRes = await githubFetch(env, `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`);
  const jobs = jobsRes.data?.jobs || [];
  const gateJob = jobs.find((job) => (job.name || '').toLowerCase().includes('gate'));
  if (!gateJob) return { phase: 'starting' };
  const resultStep = (gateJob.steps || []).map((step) => parseResultStepName(step.name)).find(Boolean);
  if (gateJob.status !== 'completed') return { phase: 'gate', status: gateJob.status };
  if (!resultStep) return { phase: 'gate', status: 'completed', reason: 'unknown' };
  return {
    phase: resultStep.reason === 'accepted' ? 'deploying' : 'rejected',
    reason: resultStep.reason,
    retryAfterSeconds: resultStep.retryAfterSeconds,
    remainingToday: resultStep.remainingToday,
    summary: resultSummary(resultStep)
  };
}

async function handleAuth(request, env, ipHash) {
  if (!(await authAttemptAllowed(env.RATE_LIMITS, ipHash))) {
    return json({ error: 'too_many_attempts', message: 'Too many login attempts. Try again later.' }, 429);
  }
  const body = await readJson(request);
  const password = String(body?.password || '');
  if (!password) return json({ error: 'invalid_request', message: 'Password required.' }, 400);
  const ok = await verifyPassword(password, env.TRY_IT_PASSWORD_HASH);
  if (!ok) {
    return json({ error: 'unauthorized', message: 'Invalid credentials.' }, 401);
  }
  const token = await signJwt({ sub: 'try-it', ip: ipHash }, env.JWT_SECRET);
  return json({ token, expiresIn: 30 * 60 });
}

async function handleDeploy(request, env, ipHash) {
  const payload = await bearerPayload(request, env);
  if (!payload) return json({ error: 'unauthorized', message: 'Session expired. Sign in again.' }, 401);
  if (payload.ip && payload.ip !== ipHash) {
    return json({ error: 'unauthorized', message: 'Session is not valid for this network.' }, 401);
  }

  const repo = `${repoConfig(env).owner}/${repoConfig(env).repo}`;
  const visitorKey = await sha256Hex(`${ipHash}|${repo}`);

  if (await isDeployBusy(env)) {
    return json(
      {
        allowed: false,
        reason: 'busy',
        retryAfterSeconds: 30,
        message: 'A deploy is already running.'
      },
      429
    );
  }

  const decision = await evaluateVisitorLimit(env.RATE_LIMITS, visitorKey);
  if (!decision.allowed) {
    return json(
      {
        allowed: false,
        reason: decision.reason,
        retryAfterSeconds: decision.retryAfterSeconds,
        remainingToday: decision.remainingToday,
        message: resultSummary(decision)
      },
      429
    );
  }

  const requestId = crypto.randomUUID();
  const dispatched = await dispatchTryIt(env, requestId, visitorKey);
  if (!dispatched.ok) {
    return json(
      { error: 'dispatch_failed', message: 'Could not start the deploy workflow.', detail: dispatched.message },
      502
    );
  }

  await persistRateSuccess(env.RATE_LIMITS, visitorKey);
  return json({ allowed: true, requestId, reason: 'accepted', phase: 'queued' });
}

async function handleStatus(request, env, requestId) {
  const payload = await bearerPayload(request, env);
  if (!payload) return json({ error: 'unauthorized', message: 'Session expired. Sign in again.' }, 401);

  const run = await findRunByRequestId(env, requestId);
  if (!run) return json({ requestId, phase: 'queued' });

  const gate = await gateStatusForRun(env, run.id);
  const { owner, repo } = repoConfig(env);
  return json({
    requestId,
    runId: run.id,
    runUrl: run.html_url,
    runStatus: run.status,
    runConclusion: run.conclusion,
    ...gate
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') {
      if (!cors) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const ip = clientIp(request);
    const ipHash = await sha256Hex(ip);

    let response;
    if (url.pathname === '/api/health' && request.method === 'GET') {
      response = json({ ok: true });
    } else if (url.pathname === '/api/auth' && request.method === 'POST') {
      response = await handleAuth(request, env, ipHash);
    } else if (url.pathname === '/api/deploy' && request.method === 'POST') {
      response = await handleDeploy(request, env, ipHash);
    } else if (url.pathname.startsWith('/api/deploy/') && url.pathname.endsWith('/status') && request.method === 'GET') {
      const requestId = url.pathname.split('/')[3];
      response = await handleStatus(request, env, requestId);
    } else {
      response = json({ error: 'not_found' }, 404);
    }

    if (cors) {
      for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
    }
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    return response;
  }
};
