# Mira Voice Performance: Stage Metrics + Parallel History (2026-10-13)

- The startup history flow requests local IndexedDB and remote history concurrently, retaining both, the original ordering and deduplication. Wait becomes max(local, remote) rather than local plus remote; actual impact depends on device/network.
- TurnManager captures only numeric elapsed ms for memory, host, action enumeration, prebrain skill, context-ready and provider Brain, preserving existing parallel work and full context.
- Once actual answer audio **starts playing**, useMira records the final-transcript-to-first-audio duration. Local in-memory numeric-only sliding samples of up to 64 turns expose P50/P95; fallback responses are counted but excluded from provider percentiles.
- Metrics contain no raw audio, transcript, prompt, IDs, camera data or analytics upload. Stages that run in parallel are not additive.
- This is groundwork for identifying real bottlenecks without artificial short memory timeouts, model downgrade or ElevenLabs voice change.
