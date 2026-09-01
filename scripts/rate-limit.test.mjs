import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COOLDOWN_MS,
  MAX_PER_IP_PER_DAY,
  GLOBAL_MAX_PER_DAY,
  emptyState,
  evaluateRateLimit,
  recordSuccess,
  resultSummary,
  parseResultStepName,
  isValidVisitorKey,
  pruneVisitors
} from './rate-limit.mjs';

describe('evaluateRateLimit', () => {
  it('allows a first visit', () => {
    const decision = evaluateRateLimit(undefined, undefined, new Date('2026-09-01T12:00:00Z'));
    assert.equal(decision.allowed, true);
    assert.equal(decision.reason, 'accepted');
    assert.equal(decision.remainingToday, MAX_PER_IP_PER_DAY - 1);
  });

  it('blocks the same visitor during the 5 minute cooldown', () => {
    const now = new Date('2026-09-01T12:00:00Z');
    const entry = { day: '2026-09-01', count: 1, lastAt: '2026-09-01T11:57:00Z' };
    const decision = evaluateRateLimit(entry, { day: '2026-09-01', count: 1 }, now);
    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'cooldown');
    assert.equal(decision.retryAfterSeconds, 120);
    assert.equal(decision.remainingToday, 4);
  });

  it('allows another deploy after the cooldown', () => {
    const now = new Date('2026-09-01T12:05:00Z');
    const entry = { day: '2026-09-01', count: 1, lastAt: '2026-09-01T12:00:00Z' };
    const decision = evaluateRateLimit(entry, { day: '2026-09-01', count: 1 }, now);
    assert.equal(decision.allowed, true);
    assert.equal(decision.remainingToday, 3);
  });

  it('blocks a 6th deploy on the same UTC day', () => {
    const now = new Date('2026-09-01T23:00:00Z');
    const entry = { day: '2026-09-01', count: 5, lastAt: '2026-09-01T22:50:00Z' };
    const decision = evaluateRateLimit(entry, { day: '2026-09-01', count: 5 }, now);
    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'daily_limit');
    assert.equal(decision.remainingToday, 0);
  });

  it('resets the daily count after UTC midnight', () => {
    const now = new Date('2026-09-02T00:00:01Z');
    const entry = { day: '2026-09-01', count: 5, lastAt: '2026-09-01T23:50:00Z' };
    const decision = evaluateRateLimit(entry, { day: '2026-09-01', count: 40 }, now);
    assert.equal(decision.allowed, true);
    assert.equal(decision.reason, 'accepted');
  });

  it('enforces a global daily circuit breaker', () => {
    const now = new Date('2026-09-01T18:00:00Z');
    const decision = evaluateRateLimit(
      undefined,
      { day: '2026-09-01', count: GLOBAL_MAX_PER_DAY },
      now
    );
    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'global_limit');
  });
});

describe('recordSuccess', () => {
  it('increments visitor and global counters', () => {
    const now = new Date('2026-09-01T12:00:00Z');
    const next = recordSuccess(emptyState(), 'abc', now);
    assert.equal(next.global.count, 1);
    assert.equal(next.global.day, '2026-09-01');
    assert.equal(next.visitors.abc.count, 1);
    assert.equal(next.visitors.abc.lastAt, now.toISOString());
  });

  it('prunes visitors from previous days', () => {
    const pruned = pruneVisitors(
      {
        old: { day: '2026-08-31', count: 2, lastAt: '2026-08-31T10:00:00Z' },
        fresh: { day: '2026-09-01', count: 1, lastAt: '2026-09-01T10:00:00Z' }
      },
      '2026-09-01'
    );
    assert.deepEqual(Object.keys(pruned), ['fresh']);
  });
});

describe('result step names', () => {
  it('round-trips accepted and cooldown summaries', () => {
    assert.equal(resultSummary({ reason: 'accepted' }), 'accepted');
    assert.deepEqual(parseResultStepName('try-it-result accepted'), {
      reason: 'accepted',
      retryAfterSeconds: 0,
      remainingToday: undefined
    });
    assert.deepEqual(parseResultStepName('try-it-result cooldown 187 4'), {
      reason: 'cooldown',
      retryAfterSeconds: 187,
      remainingToday: 4
    });
    assert.deepEqual(parseResultStepName('try-it-result daily_limit 45210'), {
      reason: 'daily_limit',
      retryAfterSeconds: 45210,
      remainingToday: undefined
    });
    assert.deepEqual(parseResultStepName('try-it-result busy 30'), {
      reason: 'busy',
      retryAfterSeconds: 30,
      remainingToday: undefined
    });
  });

  it('rejects malformed visitor keys', () => {
    assert.equal(isValidVisitorKey('manual-local'), true);
    assert.equal(isValidVisitorKey('a'.repeat(64)), true);
    assert.equal(isValidVisitorKey('not-a-hash'), false);
    assert.equal(isValidVisitorKey(''), false);
  });
});

describe('constants', () => {
  it('uses a 5 minute cooldown and 5 deploys per IP per day', () => {
    assert.equal(COOLDOWN_MS, 5 * 60 * 1000);
    assert.equal(MAX_PER_IP_PER_DAY, 5);
  });
});
