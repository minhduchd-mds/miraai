# Mira — Feature Matrix

> Snapshot theo `main`. Maturity phản ánh mức triển khai thực tế, không chỉ việc code đã tồn tại.

| Capability | Maturity | Score | Hiện có | Còn thiếu chính |
|---|---:|---:|---|---|
| Voice conversation | Stable | 9/10 | VAD, turn-taking, barge-in, speech queue | latency telemetry dài hạn |
| ElevenLabs voice | Stable | 9/10 | server-side gateway, smoke test, fallback | voice tuning/presets |
| Brain gateway | Beta+ | 8/10 | Gemini/OpenAI/Anthropic fallback | routing eval sâu hơn |
| Structured memory | Beta+ | 8/10 | fact/preference/event/relationship/emotion/thread | UI inspect/edit |
| Memory Graph | Beta | 7.5/10 | co-occurrence + semantic-temporal links | local embeddings/graph pruning |
| Privacy memory | Beta+ | 8.5/10 | disable/export/clear + session-only opt-out | per-memory retention |
| Affect engine | Beta | 7.5/10 | face/voice/posture/micro-expression fusion | dataset/eval rộng hơn |
| Proactive companion | Beta | 7.5/10 | silence/resume/affect prompts | long-horizon behavior eval |
| Local music | Beta | 7.5/10 | opt-in folder index, search, history | metadata parser + playlists |
| Contextual music | Beta | 7/10 | context-linked playback history | richer context ranking |
| Desktop Windows | Beta+ | 8/10 | Tauri + local frontend + NSIS | Authenticode signing |
| Desktop macOS | Beta | 7.5/10 | Tauri + local frontend + DMG | Apple signing + notarization |
| Permission gate | Beta+ | 8.5/10 | native Rust checks | richer consent UI |
| Vision | Beta | 8/10 | face/gaze/hand/pose | hardware eval matrix |
| Spatial interaction | Experimental | 6.5/10 | webcam spatial + XR stack | device calibration/validation |
| Presence | Beta | 8/10 | 2D scenes, expressions, optional VRM | adaptive scene QA |
| Host integration | Beta+ | 8/10 | HostBridge + write/sensitive auth | production adapters |
| Web/PWA | Stable/Beta | 8.5/10 | Pages/PWA/wake recovery | OS background limits |
| CI/CD | Strong | 9/10 | Node 24 baseline + Node 26 compatibility | signed native releases |

## Maturity

- **Stable** — primary path, automated checks, phù hợp dùng thường xuyên.
- **Beta+** — triển khai mạnh, còn release/security hardening.
- **Beta** — dùng được, cần thêm real-device/eval coverage.
- **Experimental** — hướng nghiên cứu, chưa coi là production-grade.

## Ưu tiên tiếp theo

1. Signed/notarized desktop releases.
2. Local semantic embeddings cho memory retrieval.
3. Structured-memory inspect/edit UI.
4. Affect/camera evaluation trên nhiều thiết bị thật.
5. Music metadata/playlists + contextual ranking.
