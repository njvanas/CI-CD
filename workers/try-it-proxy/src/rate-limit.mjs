/** Per-IP Try It limits: 5 minutes between deploys, 5 deploys per UTC day. */
export const COOLDOWN_MS = 5 * 60 * 1000;
export const MAX_PER_IP_PER_DAY = 5;
export const GLOBAL_MAX_PER_DAY = 100;
export const STATE_BRANCH = 'try-it-state';
export const STATE_PATH = 'rate-limits.json';

export function utcDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function emptyState() {
  return { global: { day: '', count: 0 }, visitors: {} };
}

/**
 * @param {{ day?: string, count?: number, lastAt?: string } | undefined} entry
 * @param {{ day?: string, count?: number } | undefined} global
 * @param {Date} [now]
 */
export function evaluateRateLimit(entry, global, now = new Date()) {
  const nowMs = now.getTime();
  const day = utcDay(now);

  const globalCount = global && global.day === day ? Number(global.count) || 0 : 0;
  if (globalCount >= GLOBAL_MAX_PER_DAY) {
    const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return {
      allowed: false,
      reason: 'global_limit',
      remainingToday: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((tomorrow - nowMs) / 1000))
    };
  }

  const count = entry && entry.day === day ? Number(entry.count) || 0 : 0;
  if (count >= MAX_PER_IP_PER_DAY) {
    const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return {
      allowed: false,
      reason: 'daily_limit',
      remainingToday: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((tomorrow - nowMs) / 1000))
    };
  }

  if (entry?.lastAt) {
    const elapsed = nowMs - Date.parse(entry.lastAt);
    if (Number.isFinite(elapsed) && elapsed < COOLDOWN_MS) {
      return {
        allowed: false,
        reason: 'cooldown',
        remainingToday: MAX_PER_IP_PER_DAY - count,
        retryAfterSeconds: Math.max(1, Math.ceil((COOLDOWN_MS - elapsed) / 1000))
      };
    }
  }

  return {
    allowed: true,
    reason: 'accepted',
    remainingToday: MAX_PER_IP_PER_DAY - count - 1,
    retryAfterSeconds: 0
  };
}

export function recordSuccess(state, visitorKey, now = new Date()) {
  const day = utcDay(now);
  const iso = now.toISOString();
  const next = {
    global: {
      day,
      count: (state.global?.day === day ? Number(state.global.count) || 0 : 0) + 1
    },
    visitors: { ...(state.visitors || {}) }
  };
  const prev = next.visitors[visitorKey];
  next.visitors[visitorKey] = {
    day,
    count: (prev && prev.day === day ? Number(prev.count) || 0 : 0) + 1,
    lastAt: iso
  };
  next.visitors = pruneVisitors(next.visitors, day);
  return next;
}

export function pruneVisitors(visitors, today) {
  const kept = {};
  for (const [key, value] of Object.entries(visitors || {})) {
    if (value?.day === today) kept[key] = value;
  }
  return kept;
}

/** Compact step name so the public site can parse gate results via the Actions Jobs API. */
export function resultSummary(decision) {
  if (decision.reason === 'accepted') return 'accepted';
  if (decision.reason === 'cooldown') {
    return `cooldown ${decision.retryAfterSeconds} ${decision.remainingToday}`;
  }
  if (decision.reason === 'busy') {
    return `busy ${decision.retryAfterSeconds || 30}`;
  }
  return `${decision.reason} ${decision.retryAfterSeconds}`;
}

export function parseResultStepName(name) {
  const m = String(name || '').match(
    /^try-it-result\s+(\w+)(?:\s+(\d+))?(?:\s+(\d+))?$/
  );
  if (!m) return null;
  return {
    reason: m[1],
    retryAfterSeconds: m[2] ? Number(m[2]) : 0,
    remainingToday: m[3] != null ? Number(m[3]) : undefined
  };
}

export function isValidVisitorKey(key) {
  if (key === 'manual-local') return true;
  return /^[a-f0-9]{64}$/i.test(String(key || ''));
}
