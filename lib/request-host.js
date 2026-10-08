/**
 * The HTTP Host header is owned by the receiving edge/router for browser
 * requests. Never take x-forwarded-host as an origin authorization authority:
 * it is request metadata and may be spoofed in downstream deployments.
 */
export function canonicalRequestHost(req) {
  const host = String(req?.headers?.host || '').trim().toLowerCase();
  if (host.length > 253 || !/^[a-z0-9.-]+(?::[0-9]{1,5})?$/.test(host)) return '';
  return host;
}
