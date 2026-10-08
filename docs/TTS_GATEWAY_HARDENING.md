# MiraAI P0/P1 Gateway Hardening — 2026-10-08

- Vercel TTS and dedicated Node gateway read provider audio as bounded streams (8 MiB max); reject invalid media content-types, inaccurate oversized content lengths, and empty responses.
- The request authority is the validated Host header, **not** a caller-controlled X-Forwarded-Host. Cross-site fetches without an Origin are denied.
- Vercel TTS burst protection reads Vercel-provided client metadata or falls back to a shared anonymous key; direct unverified X-Forwarded-For never changes a voice client identity.
- Local rate buckets fail closed at capacity rather than evicting active clients; this does **not** turn an in-memory limiter into a distributed budget.
- Cloud AI quotas are only durable when DATABASE_URL points to a verified shared Neon database. Do not advertise production multi-instance protection without it.
- Check `npm run check` and the TTS security regression tests before release.
- Outstanding: Device Lab, desktop CSP allowlist validation, distribution signatures/notarization and streaming speech benchmark.
