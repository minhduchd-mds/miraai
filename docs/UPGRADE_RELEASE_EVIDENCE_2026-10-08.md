# MiraAI v17 — Upgrade and Release Evidence (2026-10-08)

## Implemented in source

- Spatial Interaction v17: confidence-gated pinch, source-switch dwell reset, tracking-loss cancellation, masked/hidden targets, finite rays, stable hand-pair ordering, bimanual spacing and settings-modal cancellation.
- Camera-only lazy runtime; no increase to the AppV2 JS budget.
- Production environment `MIRA_AI_QUOTA_MODE=require-neon` configured in Vercel **for the next deployment**. This fails closed if shared quota storage is unavailable.
- Separate opt-in production Brain smoke CLI and manually triggered workflow. The default step checks GET readiness only; paid POST requires explicit operator consent.
- Visual QA now includes spatial controls and Settings modifications.

## Not yet proven or blocked

- Running inference through Production gateway: requires one opt-in paid smoke call and measured latency.
- Authenticated cross-device ownership/merge: not implemented; signed anonymous cookies are NOT verified user accounts.
- Vercel Firewall / WAF: active firewall config could not be read (HTTP 404); no verified edge rate-limit rule.
- Native signed and notarized distribution: depends on Apple Developer ID / Windows Authenticode, real-device evidence and publication gates.
- Empirical spatial false-positive rate, camera occlusion, illumination and gesture precision: needs at least three physical device lab results. Synthetics do not qualify.
- Desktop CSP hardening: intentionally not enabled until tested against WebView, WebGPU/WASM and local asset pipeline.

## Minimum acceptance protocol

1. `npm run check`: Node 24/26, >=400 unit tests, zero failures, AppV2 <=300 KiB.
2. Playwright Visual QA on 1440/1366/768/390/360 viewports.
3. Three empirical Device Lab runs at same release SHA; cover camera occlusion during pinch, two-hand drag/rotate, dark light, switch face-to-hand, modal opens during grab, interruption and memory export/import.
4. Production `/api/brain-health` reports gateway; then one opt-in synthetic inference via `node scripts/production-brain-smoke.mjs --allow-paid-call` and quota-mode header observation.
5. Release only a signed/validated Desktop package. No silent migration of legacy user memories.
