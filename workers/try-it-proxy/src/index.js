import { evaluateRateLimit } from '../../scripts/rate-limit.mjs';

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

function parseAllowedOrigins(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
  );
}

function corsHeaders(origin, env) {
  const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  if (!origin || !allowed.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  );
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
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

async function handleDeploy(request, env, ipHash) {
  const repo = `${repoConfig(env).owner}/${repoConfig(env).repo}`;
  const visitorKey = await sha256Hex(`${ipHash}|${repo}`);

  if (await isDeployBusy(env)) {
    return json({ allowed: false, reason: 'busy', retryAfterSeconds: 30 }, 429);
  }

  const decision = await evaluateVisitorLimit(env.RATE_LIMITS, visitorKey);
  if (!decision.allowed) {
    return json(
      {
        allowed: false,
        reason: decision.reason,
        retryAfterSeconds: decision.retryAfterSeconds
      },
      429
    );
  }

  const requestId = crypto.randomUUID();
  const dispatched = await dispatchTryIt(env, requestId, visitorKey);
  if (!dispatched.ok) {
    return json({ error: 'dispatch_failed' }, 502);
  }

  await persistRateSuccess(env.RATE_LIMITS, visitorKey);
  return json({ allowed: true, requestId });
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
    if (url.pathname === '/api/health' && request.method === 'GET') {
      const response = json({ ok: true });
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }

    if (!cors) {
      return json({ error: 'forbidden' }, 403);
    }

    const ipHash = await sha256Hex(clientIp(request));
    let response;
    if (url.pathname === '/api/deploy' && request.method === 'POST') {
      response = await handleDeploy(request, env, ipHash);
    } else {
      response = json({ error: 'not_found' }, 404);
    }

    for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    return response;
  }
};
