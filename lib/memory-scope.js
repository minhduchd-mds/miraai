import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const VERSION = 'v2';
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const MAX_FUTURE_SKEW_SECONDS = 300;
const VALID_SCOPE = /^m2_[A-Za-z0-9_-]{32}$/;
const LEGACY_COOKIE = 'mira_scope';
const PROD_COOKIE = '__Host-mira_session';
const DEV_COOKIE = 'mira_session';
const KEY_NAME = 'MIRA_MEMORY_SESSION_KEY';

function cookieName() {
  return process.env.VERCEL ? PROD_COOKIE : DEV_COOKIE;
}

function parseCookies(header) {
  const cookies = new Map();
  for (const item of String(header || '').split(';')) {
    const index = item.indexOf('=');
    if (index < 1) continue;
    const key = item.slice(0, index).trim();
    if (!key || cookies.has(key)) continue;
    try { cookies.set(key, decodeURIComponent(item.slice(index + 1).trim())); }
    catch { /* ignore malformed cookie rather than accepting an alternate value */ }
  }
  return cookies;
}

function secret() {
  const key = process.env[KEY_NAME];
  return typeof key === 'string' && Buffer.byteLength(key) >= 32 ? key : null;
}

function mac(key, payload) {
  return createHmac('sha256', key).update(payload).digest();
}

function parseSignedSession(value, key, nowSeconds) {
  if (typeof value !== 'string' || value.length > 200) return null;
  const fields = value.split('.');
  if (fields.length !== 4 || fields[0] !== VERSION) return null;
  const [, scope, issuedRaw, signature] = fields;
  if (!VALID_SCOPE.test(scope) || !/^[1-9][0-9]{8,11}$/.test(issuedRaw)) return null;
  const issued = Number(issuedRaw);
  if (!Number.isSafeInteger(issued) || issued > nowSeconds + MAX_FUTURE_SKEW_SECONDS
    || issued + MAX_AGE_SECONDS < nowSeconds) return null;
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) return null;
  const supplied = Buffer.from(signature, 'base64url');
  const expected = mac(key, `${VERSION}.${scope}.${issuedRaw}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return scope;
}

function newToken(key, nowSeconds) {
  const scope = `m2_${randomBytes(24).toString('base64url')}`;
  const issued = String(nowSeconds);
  const payload = `${VERSION}.${scope}.${issued}`;
  return { scope, value: `${payload}.${mac(key, payload).toString('base64url')}` };
}

/**
 * Signed, random, anonymous single-browser scope. Caller-provided device IDs
 * and the old unsigned mira_scope cookie NEVER authorize access.
 *
 * No automatic legacy claim is possible without proof of ownership; old rows
 * remain intact for supervised import from an existing user-held backup.
 */
export function resolveMemoryScope(req, res, _legacyDeviceId = '') {
  const key = secret();
  if (!key) return null; // Fail closed; endpoints must return 503.
  const cookies = parseCookies(req?.headers?.cookie);
  const now = Math.floor(Date.now() / 1000);
  const existing = parseSignedSession(cookies.get(cookieName()), key, now);
  if (existing) return existing;

  const session = newToken(key, now);
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${cookieName()}=${session.value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE_SECONDS}${secure}`);
  // Deliberately do not read or modify ${LEGACY_COOKIE} here.
  return session.scope;
}
export const MEMORY_SESSION_POLICY = Object.freeze({ version: VERSION, legacyCookie: LEGACY_COOKIE, productionCookie: PROD_COOKIE });
