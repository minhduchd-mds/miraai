# Mira security and quality debt — tracked by evidence

This document lists incomplete release blockers after the October 2026 hardening commits. Do not describe these as shipped merely because CI is green.

| Priority | Gate | Acceptance criteria |
| --- | --- | --- |
| P0 | Account authentication and cross-device identity | Verified login/identity provider with server-side authorization per user, anti-CSRF and session revocation; two-user negative tests |
| P0 | Legacy cloud memory recovery | Owner-verified migration workflow or preexisting user-held exported capsule; no arbitrary device-ID takeover; verify before unblocking old records |
| P0 | Distributed paid-provider quota | Connect DATABASE_URL, enable MIRA_AI_QUOTA_MODE=require-neon, verify atomic quota and global cap under concurrent serverless requests; schedule counter TTL cleanup |
| P0 | Edge WAF rate limiting | Configure active paid-API POST rate-limit rule in Vercel Firewall, check effective deployed version; currently Firewall API returns 404 for config resource |
| P1 | Strict Desktop CSP | Test WebView2/WKWebView WASM, MediaPipe assets, GPU/WebNN, networking and local asset protocol with a tightened policy; do not disable renderer features blindly |
| P1 | Signed official releases | Apple Developer ID/notarization plus Windows Authenticode; maintain existing real-device SHA-gated publishing |
| P1 | Native/device integration | Three real-device PASS reports for current SHA, camera permissions, mic cancellation, memory deletion, upgrade/rollback; Rust unit tests alone insufficient |
| P2 | Realtime Voice streaming | Compare ElevenLabs Text-to-Dialogue v4 streaming against stable whole-file TTS with measured p50/p95 first-audio latency and speaker-interruption fidelity; release behind feature flag |
| P2 | SenseBus decision integration | Observe first, compare false activations on labeled real camera sessions, then add explicit action policy and user consent |
| P2 | Memory hybrid retrieval | Evaluate keyword/vector temporal relevance, HNSW recall under per-user filters, TTL/source metadata and removal; require Neon fixture data |
| P3 | Long-running reliability | CPU/RAM/energy profiling, several-hour soak, offline/resume and dropped-frame benchmarks on actual devices |
| P3 | Branch/deploy governance | Protected branch or deployment status checks compatible with agreed direct-main workflow; add release smoke and rollback |
