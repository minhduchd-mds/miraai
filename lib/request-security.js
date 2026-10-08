/**
 * Same-origin write gate for browser-facing personal-memory endpoints.
 * This is CSRF defense in depth, NOT identity-based authorization.
 * Fail closed for explicit foreign Origins and Fetch Metadata cross-site writes.
 * Requests without Origin remain supported for non-browser/legacy clients.
 */
export function trustedWriteOrigin(req) {
  const headers = req?.headers || {};
  const site = String(headers['sec-fetch-site'] || '').toLowerCase();
  if (site === 'cross-site') return false;
  const origin = String(headers.origin || '').trim();
  if (!origin) return true;
  const host = String(headers.host || '').trim().toLowerCase();
  if (!host || /[\s/@]/.test(host)) return false;
  const expected = new Set([`https://${host}`]);
  if (!process.env.VERCEL && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
    expected.add(`http://${host}`);
  }
  return expected.has(origin);
}

export function requireTrustedWrite(req, res) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req?.method)) return true;
  if (trustedWriteOrigin(req)) return true;
  res.status(403).json({ error: 'origin_not_allowed' });
  return false;
}
