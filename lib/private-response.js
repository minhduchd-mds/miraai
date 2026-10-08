/**
 * Privacy guard for endpoints returning personal conversation, voice, or profile data.
 * Browser Cache Storage is handled separately by the service worker allowlist.
 */
export function markPrivateResponse(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Cookie, Origin');
}
