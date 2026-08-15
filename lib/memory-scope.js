import { randomBytes } from 'node:crypto';

const COOKIE_NAME = 'mira_scope';
const MAX_AGE = 60 * 60 * 24 * 365;
const VALID_SCOPE = /^[A-Za-z0-9_-]{8,96}$/;

function cookies(header = '') {
  const out = {};
  for (const item of String(header).split(';')) {
    const i = item.indexOf('=');
    if (i <= 0) continue;
    out[item.slice(0, i).trim()] = decodeURIComponent(item.slice(i + 1).trim());
  }
  return out;
}

function valid(value) {
  return typeof value === 'string' && VALID_SCOPE.test(value);
}

function createScope() {
  return `usr_${randomBytes(18).toString('base64url')}`;
}

/**
 * Pins the legacy client device id into a HttpOnly cookie on first use, preserving existing memory.
 * After that the server trusts the cookie, not a freely supplied query/body id.
 */
export function resolveMemoryScope(req, res, requested = '') {
  const fromCookie = cookies(req?.headers?.cookie || '')[COOKIE_NAME];
  if (valid(fromCookie)) return fromCookie;

  const scope = valid(String(requested || '')) ? String(requested) : createScope();
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(scope)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`,
  );
  return scope;
}
