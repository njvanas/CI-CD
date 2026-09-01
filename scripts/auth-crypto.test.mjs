import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPassword, verifyPassword, signJwt, verifyJwt } from './auth-crypto.mjs';

describe('auth-crypto', () => {
  it('hashes and verifies passwords with constant-time compare', async () => {
    const encoded = await hashPassword('correct horse battery staple');
    assert.match(encoded, /^pbkdf2-sha256\$100000\$/);
    assert.equal(await verifyPassword('correct horse battery staple', encoded), true);
    assert.equal(await verifyPassword('wrong password', encoded), false);
  });

  it('signs and verifies JWTs with expiry', async () => {
    const secret = 'test-secret-at-least-32-characters-long';
    const token = await signJwt({ sub: 'try-it' }, secret, 60);
    const payload = await verifyJwt(token, secret);
    assert.equal(payload.sub, 'try-it');
    assert.ok(payload.exp > payload.iat);
    assert.equal(await verifyJwt(`${token}x`, secret), null);
  });
});
