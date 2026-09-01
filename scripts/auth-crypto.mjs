/** Password hashing + signed JWT helpers (Node 18+ and Cloudflare Workers). */

export const PBKDF2_ITERATIONS = 100_000;
export const JWT_TTL_SECONDS = 30 * 60;

function te() {
  return new TextEncoder();
}

function td() {
  return new TextDecoder();
}

function b64UrlEncode(bytes) {
  let binary = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const byte of arr) binary += String.fromCharCode(byte);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? padded : padded + '='.repeat(4 - (padded.length % 4));
  const binary = atob(pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function b64StandardEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64StandardDecode(str) {
  const binary = atob(str);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function encodePasswordHash(saltBytes, hashBytes) {
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${b64StandardEncode(saltBytes)}$${b64StandardEncode(hashBytes)}`;
}

export async function hashPassword(password, saltBytes = crypto.getRandomValues(new Uint8Array(16))) {
  const hashBytes = await derivePasswordBytes(password, saltBytes);
  return encodePasswordHash(saltBytes, hashBytes);
}

async function derivePasswordBytes(password, saltBytes) {
  const baseKey = await crypto.subtle.importKey('raw', te().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password, encodedHash) {
  if (!encodedHash || typeof encodedHash !== 'string') return false;
  const parts = encodedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const iterations = Number(parts[1]);
  if (iterations !== PBKDF2_ITERATIONS) return false;
  let saltBytes;
  let expected;
  try {
    saltBytes = b64StandardDecode(parts[2]);
    expected = b64StandardDecode(parts[3]);
  } catch {
    return false;
  }
  const actual = await derivePasswordBytes(password, saltBytes);
  return timingSafeEqual(actual, expected);
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', te().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify'
  ]);
}

export async function signJwt(payload, secret, ttlSec = JWT_TTL_SECONDS) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSec };
  const headSeg = b64UrlEncode(te().encode(JSON.stringify(header)));
  const bodySeg = b64UrlEncode(te().encode(JSON.stringify(body)));
  const signingInput = `${headSeg}.${bodySeg}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, te().encode(signingInput));
  return `${signingInput}.${b64UrlEncode(new Uint8Array(sig))}`;
}

export async function verifyJwt(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headSeg, bodySeg, sigSeg] = parts;
  const signingInput = `${headSeg}.${bodySeg}`;
  const key = await hmacKey(secret);
  const sig = b64UrlDecode(sigSeg);
  const ok = await crypto.subtle.verify('HMAC', key, sig, te().encode(signingInput));
  if (!ok) return null;
  let payload;
  try {
    payload = JSON.parse(td().decode(b64UrlDecode(bodySeg)));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) return null;
  return payload;
}
