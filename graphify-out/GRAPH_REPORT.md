# Graph Report - miraai  (2026-10-24)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3690 nodes · 8270 edges · 171 communities (152 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 119 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bd183dfc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- check-architecture.mjs
- ref_node_assert
- tts-policy.mjs
- check-avatar-release.mjs
- object-awareness.ts
- AppV2.tsx
- holistic-tracker.ts
- vision-runtime.ts
- useMira.ts
- memory.rs
- PhotorealRoom3D.tsx
- vi-speech-director.ts
- face-tracker.ts
- media.rs
- ref_node_fs
- spatial-object-manipulation.ts
- brain-gateway.js
- useSpatialLayoutLifecycle.ts
- DevConsole.tsx
- RoomMiraVRM.tsx
- isDesktopRuntime
- BrainTurn
- causal-action-graph.ts
- spatial-world.ts
- avatar-config.ts
- gesture-tracker.ts
- SettingsPanel.tsx
- markPrivateResponse
- PhotorealMira.tsx
- useVisionWorldContext.ts
- functional-benchmark.mjs
- spatial-webxr-session.ts
- spatial-xr-rigid-body.ts
- spatial-xr-bimanual.ts
- face-social-control.ts
- spatial-ui-control.ts
- ServerTTS
- action-sequence.ts
- spatial-physics.ts
- spatial-ui-helpers.ts
- host/index.ts
- device-lab.ts
- VitruvianLabAvatar.tsx
- world-model.ts
- hand-gesture-lite.ts
- useVisionHandInput.ts
- SpatialCalibrationPanel.tsx
- PhotorealSceneCanvas.tsx
- live-avatar.test.mjs
- mood-engine.ts
- local-memory-portability.ts
- OriginalMiraLabAvatar.tsx
- presence-scene.ts
- registry.ts
- audio-level.ts
- spatial-hand-kinematics.ts
- spatial-scene-graph.ts
- live-session.ts
- identity-capsule.js
- LiveAvatarPresence.tsx
- real-presence.ts
- spatial-v19-freshness.test.mjs
- hologram.ts
- core/types.ts
- rppg-monitor.ts
- deictic-vision.ts
- local-memory-store.ts
- spatial-hand-contact.ts
- spatial-object.ts
- Connection
- perception-runtime.ts
- readFrame
- spatial-xr-surface.ts
- profile-client.ts
- Mira — Local-first AI Companion
- check-media.mjs
- spatial-ray.ts
- skills/types.ts
- PhotorealSpatial3D.tsx
- mira_human_preflight.py
- check-bundle.mjs
- memory-service.ts
- tts/index.ts
- photoreal-environment.ts
- spatial-anchor.ts
- memory-graph.ts
- finance.js
- WebSpeechSTT
- camera-manager.ts
- spatial-xr-projection.ts
- character-gaze.ts
- runtime.test.mjs
- object-interaction.ts
- FeedbackPanel.tsx
- RoomLuxuryInterior.tsx
- finance-intent.ts
- gaze-head-calibration.ts
- resolveMemoryScope
- main.tsx
- device-lab-matrix.mjs
- VisionCameraRecoveryPolicy
- object-identity-hypothesis.ts
- spatial-room3d.test.mjs
- photoreal-camera-depth.ts
- app-preferences.ts
- useVoiceSessionLifecycle.ts
- SpatialObjectPose
- spatialPerformanceProfiler
- spatial-room-gesture.ts
- SpatialXRMetricManipulationRuntime
- desktop-music-skill.ts
- brain-auto-router.test.mjs
- check-deploy-artifact.mjs
- finance-calculator-skill.ts
- response-latency.ts
- skills/types.ts
- audit-asset-rights.mjs
- device-lab-capture.mjs
- prune-desktop-assets.mjs
- PhotorealSceneSegments.tsx
- product-feedback.test.mjs
- service-worker.test.mjs
- live-companion-benchmark.mjs
- macos-desktop-connectivity.test.mjs
- prune-pages-assets.mjs
- companion-dialogue.ts
- product-v15-2.test.mjs
- prune-runtime-assets.mjs
- chat.js
- brain/index.ts
- recorded-benchmark.ts
- live-token.js
- VRMAvatar.tsx
- photoreal-depth.ts
- runtime-safety.test.mjs
- spatial-bimanual-safety.test.mjs
- spatial-interaction-safety.test.mjs
- spatial-v18-temporal.test.mjs
- spatial-v25-v27-batch.test.mjs
- App.tsx
- device-diagnostics.ts
- speech-queue.ts
- PoseSkeletonOverlay.tsx
- res
- SpatialXRBimanualRuntime
- clear_memory_data
- AirControlOverlay.tsx
- gaussian-splats.d.ts
- mira-desktop
- sourceTree
- DESIGN.md — Hợp đồng trải nghiệm Mira V2
- registry.ts
- server-tts.ts
- release-gates.test.mjs
- FaceMeshOverlay.tsx
- runtime-audit.ts
- ContentPanel.tsx
- vi-normalize.ts
- character-director.ts
- finance-live-skill.ts
- r
- Working agreement for coding agents — Mira AI
- crisis-safety.d.ts
- realistic-human-motion.test.mjs
- realistic-human-renderer.test.mjs
- IconMic

## God Nodes (most connected - your core abstractions)
1. `AppV2()` - 60 edges
2. `UseMira` - 40 edges
3. `MiraState` - 38 edges
4. `BrainTurn` - 34 edges
5. `SettingsPanel()` - 34 edges
6. `SpatialWorldRuntime` - 27 edges
7. `isDesktopRuntime()` - 27 edges
8. `DevConsole()` - 26 edges
9. `Svg()` - 25 edges
10. `SpatialSceneGraph` - 23 edges

## Surprising Connections (you probably didn't know these)
- `5. Presence Layer` --references--> `App()`  [INFERRED]
  DESIGN.md → src/App.tsx
- `Host actions` --references--> `HostBridge`  [INFERRED]
  SECURITY.md → src/host/types.ts
- `Crisis safety` --references--> `UseMira`  [INFERRED]
  SECURITY.md → src/core/useMira.ts
- `Crisis safety` --references--> `detectCrisis()`  [INFERRED]
  SECURITY.md → lib/crisis-safety.js
- `Host actions` --references--> `write()`  [INFERRED]
  SECURITY.md → scripts/tts-security.test.mjs

## Import Cycles
- 1-file cycle: `src-tauri/src/memory.rs -> src-tauri/src/memory.rs`

## Communities (171 total, 19 thin omitted)

### Community 0 - "check-architecture.mjs"
Cohesion: 0.01
Nodes (197): acceleratorLab, acceleratorSelection, actionSequence, affectControl, affectEngine, apiHealth, appPreferences, appPresentationState (+189 more)

### Community 1 - "ref_node_assert"
Cohesion: 0.03
Nodes (22): keys, code, src, keys, source, states, fields, silent (+14 more)

### Community 2 - "tts-policy.mjs"
Cohesion: 0.06
Nodes (73): handler(), handler(), parseBody(), handler(), apiKey(), boundedAudioResponseStream(), buckets, clientKey() (+65 more)

### Community 3 - "check-avatar-release.mjs"
Cohesion: 0.06
Nodes (41): auditHumanAssetRig(), auditStagedHumanAsset(), bytes, manifest, rights(), desktopEnv, auditAvatarRelease(), date() (+33 more)

### Community 4 - "object-awareness.ts"
Cohesion: 0.06
Nodes (63): AcceleratorBenchmarkSample, AcceleratorBenchmarkSummary, acceleratorCandidates(), AcceleratorProvider, chooseMeasuredAccelerator(), percentile(), summarizeAcceleratorBenchmark(), clamp01() (+55 more)

### Community 5 - "AppV2.tsx"
Cohesion: 0.05
Nodes (60): AppV2(), ContentPanel, CrisisBanner, EMPTY_SPATIAL_CONTROL_FRAME, FaceMeshOverlay, HandSkeletonOverlay, LiveAvatarPresence, PhotorealMira (+52 more)

### Community 6 - "holistic-tracker.ts"
Cohesion: 0.07
Nodes (42): applyHands(), applyPosture(), applyWorkerResult(), avg(), cancelReadFrame(), clamp01(), clearAllSignals(), clearFace() (+34 more)

### Community 7 - "vision-runtime.ts"
Cohesion: 0.07
Nodes (36): faceTrackerError(), gestureTrackerError(), stopGestureTracking(), releaseVisionCamera(), holisticFaceHealthSnapshot(), holisticTrackerActive(), holisticTrackerError(), startHolisticTracking() (+28 more)

### Community 8 - "useMira.ts"
Cohesion: 0.07
Nodes (41): micProsody, primeAudio(), startMicLevel(), stopMicLevel(), brainFailureMessage(), classifyEnd(), computeEndpointDelay(), computeStableFinalEndpointDelay() (+33 more)

### Community 9 - "memory.rs"
Cohesion: 0.08
Nodes (38): clip(), desktop_info(), desktop_memory_count(), desktop_memory_export(), desktop_memory_graph(), desktop_memory_import_turns(), desktop_memory_recent(), desktop_memory_save_affect() (+30 more)

### Community 10 - "PhotorealRoom3D.tsx"
Cohesion: 0.09
Nodes (22): candidate3DFromSearch(), CandidateAsset, CandidateId, MODELS, CandidateInspection, inspectLocalCandidateGLB(), CandidateMiraAvatar(), disposeCandidate() (+14 more)

### Community 11 - "vi-speech-director.ts"
Cohesion: 0.14
Nodes (24): buildInstructions(), buildSegmentInstructions(), classifyRole(), detectPerformance(), DirectedVietnameseSpeech, DirectedVietnameseTurn, directVietnameseSpeech(), extractEmphasis() (+16 more)

### Community 12 - "face-tracker.ts"
Cohesion: 0.07
Nodes (38): avg(), clamp01(), createFaceLandmarker(), _e, faceData, FaceLandmark, FaceMuscles, fallbackFaceToCpu() (+30 more)

### Community 13 - "media.rs"
Cohesion: 0.09
Nodes (31): audio_extension(), AUDIO_EXTENSIONS, choose_music_folder(), clip(), collect_audio_files(), context_similarity(), context_tokens(), contextual_local_track() (+23 more)

### Community 14 - "ref_node_fs"
Cohesion: 0.06
Nodes (22): auditDependencyLicenses(), LOW_RISK, dir, failures, files, types, models, original (+14 more)

### Community 15 - "spatial-object-manipulation.ts"
Cohesion: 0.15
Nodes (19): handleSpatialObjectManipulation(), MutableBox, ObjectManipulationInput, MutableBox, SpatialObjectWorldStepInput, stepSpatialObjectWorld(), applySpatialSelectionGesture(), BimanualCandidate (+11 more)

### Community 16 - "brain-gateway.js"
Cohesion: 0.12
Nodes (32): handler(), configured(), generateAnthropic(), generateBrainChat(), generateGemini(), generateOpenAI(), normalizeMessages(), openAIText() (+24 more)

### Community 17 - "useSpatialLayoutLifecycle.ts"
Cohesion: 0.08
Nodes (21): SpatialSelectionFocus, SpatialSelectionGestureInput, SpatialLayoutLifecycleOptions, useSpatialLayoutLifecycle(), clamp(), clonePose(), normalizeJoint(), normalizeRotation() (+13 more)

### Community 18 - "DevConsole.tsx"
Cohesion: 0.13
Nodes (34): defaultModelFor(), PERSONAS, SPEEDS, DevConsole(), Dropdown(), loadNotify(), MODELS, NotifyCfg (+26 more)

### Community 19 - "RoomMiraVRM.tsx"
Cohesion: 0.11
Nodes (23): stabilizePreviewHairPhysics(), crownTuft(), hidePreviewHairTufts(), trimPreviewOuterwear(), dressPreviewForIndoors(), AvatarAssetSource, chooseRealisticAvatar(), chooseRoomAvatar() (+15 more)

### Community 20 - "isDesktopRuntime"
Cohesion: 0.11
Nodes (16): desktopInvoke(), DesktopInvokeApi, chooseDesktopMusicFolder(), DEFAULTS, DesktopInfo, DesktopMusicLibraryStatus, DesktopPermissionKey, DesktopPrivacyState (+8 more)

### Community 21 - "BrainTurn"
Cohesion: 0.15
Nodes (26): BrainFailure, classifyBrainFailure(), CannedBrain, RULES, truncate(), isGitHubPagesRuntime(), LLMBrain, loadEngine() (+18 more)

### Community 22 - "causal-action-graph.ts"
Cohesion: 0.13
Nodes (22): ActionSequenceState, boxArea(), boxIoU(), CausalActionGraphTracker, CausalEdge, CausalEvidence, CausalEvidenceKind, CausalHypothesis (+14 more)

### Community 23 - "spatial-world.ts"
Cohesion: 0.12
Nodes (17): clamp(), clonePose(), composePose(), distance3(), inverseComposePose(), magneticStrength(), nearestConstrainedPoint(), normalizePose() (+9 more)

### Community 24 - "avatar-config.ts"
Cohesion: 0.12
Nodes (18): AvatarSel, DEFAULT, FALLBACK_LOOK, Gender, GENDERS, KNOWN_3D, loadAvatarSel(), lookImage() (+10 more)

### Community 25 - "gesture-tracker.ts"
Cohesion: 0.19
Nodes (19): createGestureRecognizer(), detectWave(), fallbackGestureToCpu(), handData, inferenceIntervalMs(), normalizedPinchRatio(), readFrame(), startGestureTracking() (+11 more)

### Community 26 - "SettingsPanel.tsx"
Cohesion: 0.14
Nodes (31): loadSmartTurn(), saveSmartTurn(), loadVadEnabled(), saveVadEnabled(), intimateScenesEnabled(), isAdultConfirmed(), isResponseLength(), loadVoicePrefs() (+23 more)

### Community 27 - "markPrivateResponse"
Cohesion: 0.19
Nodes (23): handler(), handler(), parseBody(), RATINGS, REASONS, validateFeedback(), handler(), handler() (+15 more)

### Community 28 - "PhotorealMira.tsx"
Cohesion: 0.14
Nodes (22): FemalePresentation, PhotorealPerformanceTier, asset(), PhotorealMira(), PhotorealRoom3D, PhotorealSceneCanvas, PhotorealSceneSegments, PhotorealSpatial3D (+14 more)

### Community 29 - "useVisionWorldContext.ts"
Cohesion: 0.15
Nodes (15): useVisionWorldContext(), VisionWorldContextSample, actionSequencePrompt(), causalActionGraphPrompt(), environmentPrompt(), objectInteractionPrompt(), worldModelPrompt(), BehaviorEvent (+7 more)

### Community 30 - "functional-benchmark.mjs"
Cohesion: 0.07
Nodes (23): actionChecks, actionGraph(), actionNode(), benchmarkActionSequence(), benchmarkWorldModel(), conversation, gestureCases, gestureMetrics (+15 more)

### Community 31 - "spatial-webxr-session.ts"
Cohesion: 0.09
Nodes (23): cloneSnapshot(), DEPTH_GRID, distance3(), EMPTY, finite(), InternalXRAnchor, PendingAnchorRequest, poseToJoint() (+15 more)

### Community 32 - "spatial-xr-rigid-body.ts"
Cohesion: 0.14
Nodes (22): XRBimanualTransform, angularSpeed(), clamp(), cloneAngular(), cloneLinear(), cloneTransform(), CollisionHistory, fingerVelocity() (+14 more)

### Community 33 - "spatial-xr-bimanual.ts"
Cohesion: 0.21
Nodes (20): add(), BimanualFrame, BimanualSession, clamp(), cross(), dot(), finitePoint(), frameFromHands() (+12 more)

### Community 34 - "face-social-control.ts"
Cohesion: 0.11
Nodes (20): FaceSocialLifecycleSample, actionFor(), clamp01(), EMPTY_EVENT, FaceGestureSocialSample, FaceSocialAction, FaceSocialControlTracker, FaceSocialCue (+12 more)

### Community 35 - "spatial-ui-control.ts"
Cohesion: 0.11
Nodes (27): VisionHandInteractionInput, GestureIntentState, SpatialDirectTouchState, SpatialRay3D, SpatialRayHit, chooseTarget(), clamp(), clamp01() (+19 more)

### Community 36 - "ServerTTS"
Cohesion: 0.28
Nodes (3): attachAnalyser(), ServerTTS, TTSSpeakOptions

### Community 37 - "action-sequence.ts"
Cohesion: 0.13
Nodes (19): ActionSequenceStage, ActionSequenceTracker, boxArea(), boxIoU(), centerDistance(), centerOf(), clamp01(), copyBox() (+11 more)

### Community 38 - "spatial-physics.ts"
Cohesion: 0.19
Nodes (15): SpatialObjectPoint, applySpatialSpringConstraint(), axisSoftForce(), Body, BOUNDS, clamp(), clampPose(), cloneVelocity() (+7 more)

### Community 39 - "spatial-ui-helpers.ts"
Cohesion: 0.11
Nodes (37): BimanualHand, MutableBox, SpatialGroupTransformState, SpatialObjectBimanualInput, TwoHandObjectSession, updateSpatialObjectBimanual(), clampSpatial(), collectSpatialTargets() (+29 more)

### Community 40 - "host/index.ts"
Cohesion: 0.11
Nodes (22): DEFAULT_CONTEXT, StandaloneHostBridge, Window, HostActionAuthorization, HostActionDescriptor, HostActionResult, HostActionRisk, HostBridge (+14 more)

### Community 41 - "device-lab.ts"
Cohesion: 0.18
Nodes (16): MiraDeviceReport, assessDeviceLabResult(), boolOrUndefined(), boundedLabel(), buildDeviceLabResult(), DeviceLabAssessment, DeviceLabObservation, DeviceLabStatus (+8 more)

### Community 42 - "VitruvianLabAvatar.tsx"
Cohesion: 0.13
Nodes (22): manifest, clamp(), companionReaction, NEUTRAL, ObservedFace, applyHumanHairPresentation(), HUMAN_HAIR_PRESENTATION, FemaleLabLook (+14 more)

### Community 43 - "world-model.ts"
Cohesion: 0.16
Nodes (16): CausalActionGraphState, SpatialNode, causalSupportsLabel(), center(), centerDistance(), clamp01(), copyBox(), EMPTY_WORLD_STATE (+8 more)

### Community 44 - "hand-gesture-lite.ts"
Cohesion: 0.13
Nodes (26): clamp01(), distance(), extension(), HandPoint, inferLiteGesture(), LiteGesture, LiteGestureResult, patternScore() (+18 more)

### Community 45 - "useVisionHandInput.ts"
Cohesion: 0.08
Nodes (23): label(), PrimaryHandSelection, PrimarySpatialHand, StablePrimaryHandRuntime, valid(), clamp(), useVisionHandInput(), VisionRuntimeModule (+15 more)

### Community 46 - "SpatialCalibrationPanel.tsx"
Cohesion: 0.12
Nodes (15): ActiveTrial, CALIBRATION_TESTS, CalibrationFrame, CalibrationHand, CalibrationKind, CalibrationResult, clamp(), matched() (+7 more)

### Community 47 - "PhotorealSceneCanvas.tsx"
Cohesion: 0.15
Nodes (19): clamp(), computePhotorealDepthWarpControl(), computePhotorealViewRefinementControl(), computePhotorealWarpSafetyEnvelope(), PHOTOREAL_DEPTH_FIELD_GLSL, PhotorealDepthWarpControl, PhotorealViewRefinementControl, PhotorealWarpSafetyInput (+11 more)

### Community 48 - "live-avatar.test.mjs"
Cohesion: 0.15
Nodes (15): flippedTriangles(), out, prep, rig, signedArea(), AvatarMotion, AvatarState, MotionInput (+7 more)

### Community 49 - "mood-engine.ts"
Cohesion: 0.14
Nodes (20): AffectDimensions, AffectTracker, au(), BASELINE_FEATURES, baselineFeatures(), BaselineState, blendDimensions(), clamp01() (+12 more)

### Community 50 - "local-memory-portability.ts"
Cohesion: 0.14
Nodes (15): AffectState, DesktopAffectRow, AffectRow, EpisodeRow, exportLocalSnapshot(), getAll(), ImportCandidate, importLocalTurns() (+7 more)

### Community 51 - "OriginalMiraLabAvatar.tsx"
Cohesion: 0.14
Nodes (22): ttsLevel, createOriginalHeadGeometry(), originalHeadPosition(), AVATAR_ORIGIN, CHAIR_ARM, contactGapForChairArm(), Point3, seatedArm() (+14 more)

### Community 52 - "presence-scene.ts"
Cohesion: 0.17
Nodes (20): appendPresenceReturnSample(), clampMinute(), EXPRESSION_ASSET, INTIMATE_PRESENCE_SCENES, isPresenceWorkday(), learnedPresenceReturnMinute(), median(), MiraExpression (+12 more)

### Community 53 - "registry.ts"
Cohesion: 0.18
Nodes (11): detectContent(), fetchWeather(), pollinationsImage(), VisualResult, VN_CITIES, WMO, imageSkill, ResultCardData (+3 more)

### Community 54 - "audio-level.ts"
Cohesion: 0.14
Nodes (15): GRAVITY_PARTICLES, HolographicMira(), Props, ConstellationDefinition, ConstellationId, ConstellationPoint, CONSTELLATIONS, ConstellationScore (+7 more)

### Community 55 - "spatial-hand-kinematics.ts"
Cohesion: 0.19
Nodes (19): add(), clamp(), clamp01(), cross(), distance(), fingerExtension(), HandSample, History (+11 more)

### Community 56 - "spatial-scene-graph.ts"
Cohesion: 0.17
Nodes (18): boxArea(), boxIoU(), center(), clamp01(), displayBox(), EMPTY_SPATIAL_SCENE, nodeLabel(), pointBoxDistance() (+10 more)

### Community 57 - "live-session.ts"
Cohesion: 0.08
Nodes (36): LiveTalkView, Props, VoiceDock(), appendTranscript(), base64ToBytes(), buildAudioMessage(), buildSetupMessage(), buildTextMessage() (+28 more)

### Community 58 - "identity-capsule.js"
Cohesion: 0.16
Nodes (22): buildCapsule(), handler(), parseBody(), payloadDigest(), persistCapsule(), safeDate(), sanitizePreferences(), shortString() (+14 more)

### Community 59 - "LiveAvatarPresence.tsx"
Cohesion: 0.13
Nodes (10): Harness(), Window, compile(), LiveAvatarRenderer, program(), asset(), LiveAvatarPresence(), Props (+2 more)

### Community 60 - "real-presence.ts"
Cohesion: 0.14
Nodes (16): VisionRuntimeModule, VisionSnapshot, EMPTY_ENVIRONMENT, clamp(), EMPTY_REAL_PRESENCE_POSE, estimateFaceDistanceM(), estimateRealPresencePose(), FaceSpatialPoint (+8 more)

### Community 61 - "spatial-v19-freshness.test.mjs"
Cohesion: 0.16
Nodes (5): dataset, eventMetrics, reports, face, targets

### Community 62 - "hologram.ts"
Cohesion: 0.27
Nodes (11): applyHologram(), asTexture(), beautifyFace(), brightenBody(), copyCanvas(), eachMat(), liftTexture(), LIP (+3 more)

### Community 63 - "core/types.ts"
Cohesion: 0.20
Nodes (15): AvatarBoundary, CameraRig(), MiraAvatar(), Props, THEME_ACCENT, Props, MiraState, Mood (+7 more)

### Community 64 - "rppg-monitor.ts"
Cohesion: 0.18
Nodes (17): clamp01(), faceBox(), intervalMs(), lastFaceCenter, readFrame(), resetWindow(), rppgData, RppgStatus (+9 more)

### Community 65 - "deictic-vision.ts"
Cohesion: 0.43
Nodes (6): deicticVisualReply(), extractVisualTarget(), isDeicticObjectQuestion(), LABEL_VI, normalize(), VisualTargetContext

### Community 66 - "local-memory-store.ts"
Cohesion: 0.19
Nodes (10): EpisodeRow, LocalMemoryStore, normalize(), openDb(), readRecent(), requestPersistentStorage(), requestResult(), similarity() (+2 more)

### Community 67 - "spatial-hand-contact.ts"
Cohesion: 0.16
Nodes (16): clamp(), clamp01(), dominantPhase(), EMPTY_HAND_CONTACT, FingerHistory, fingerPoint(), fingerVelocity(), outsideDistance() (+8 more)

### Community 68 - "spatial-object.ts"
Cohesion: 0.22
Nodes (8): clamp(), clonePose(), DEFAULT_POSE, GrabSession, normalizeDefinition(), normalizeRotation(), SpatialObjectDefinition, SpatialObjectRuntime

### Community 69 - "Connection"
Cohesion: 0.18
Nodes (18): contains_any(), database(), desktop_memory_import_structured(), desktop_memory_recall(), distill_structured_memories(), ImportStructuredMemory, ImportStructuredMemoryLink, link_recent_related_memories() (+10 more)

### Community 70 - "perception-runtime.ts"
Cohesion: 0.14
Nodes (12): buildPerceptionRuntimePlan(), candidate(), currentPerceptionRuntimePlan(), detectPerceptionCapabilities(), EMPTY_HEALTH, PerceptionCapabilities, PerceptionProviderCandidate, PerceptionProviderHealthRegistry (+4 more)

### Community 71 - "readFrame"
Cohesion: 0.15
Nodes (11): createLandmarker(), fallbackHolisticToCpu(), readFrame(), scheduleReadFrame(), startHolisticAttempt(), VisionVideoFrameGate, baseIntervalForTier(), clamp() (+3 more)

### Community 72 - "spatial-xr-surface.ts"
Cohesion: 0.16
Nodes (14): clamp(), clamp01(), cloneDepth(), EMPTY_DEPTH, finiteDepth(), nearestXRDepth(), probeXRSurface(), reconstructXRSurfacePatches() (+6 more)

### Community 73 - "profile-client.ts"
Cohesion: 0.13
Nodes (24): isDesktopRuntime(), isLocalFrontendOrigin(), nativeInvoker(), Window, miraApiUrl(), desktopProfileFacts(), DesktopProfileNode, PROFILE_KINDS (+16 more)

### Community 74 - "Mira — Local-first AI Companion"
Cohesion: 0.07
Nodes (27): Asset Licensing / Media Provenance, Brain & Voice, Build Desktop, Chạy local, Desktop Local, Docs, Kiến trúc, Licensing and media provenance (+19 more)

### Community 75 - "check-media.mjs"
Cohesion: 0.11
Nodes (16): budgets, failures, largestExpression, largestScene, liveFace, records, ROOT, runtimeExpressionBytes (+8 more)

### Community 76 - "spatial-ray.ts"
Cohesion: 0.22
Nodes (12): clamp(), clamp01(), handRayFromLandmarks(), hitTestSpatialRay(), intersectRayWithZPlane(), magnitude(), normalize(), SpatialDepthAnchorTracker (+4 more)

### Community 77 - "skills/types.ts"
Cohesion: 0.25
Nodes (4): SkillRegistry, MiraSkill, SkillContext, SkillResult

### Community 78 - "PhotorealSpatial3D.tsx"
Cohesion: 0.20
Nodes (13): Room3DProps, BasRelief(), CameraRig(), PhotorealSpatial3D(), Props, SpatialErrorBoundary, View, MiraPresenceScene (+5 more)

### Community 79 - "mira_human_preflight.py"
Cohesion: 0.12
Nodes (8): audit(), main(), material_data(), normalize(), role(), main(), convert_folder(), main()

### Community 80 - "check-bundle.mjs"
Cohesion: 0.14
Nodes (16): appV2Files, appV2Pair, cssBytes, deferredAppV2Bytes, deferredAppV2Files, entries, failures, forbidden (+8 more)

### Community 81 - "memory-service.ts"
Cohesion: 0.23
Nodes (10): distillFacts(), loadHistory(), recallMemory(), saveTurn(), boundedRecall(), memoryOptOut(), MemoryService, serverMemoryAvailable() (+2 more)

### Community 82 - "tts/index.ts"
Cohesion: 0.15
Nodes (7): CloudTTS, BUILD_TTS_URL, createTTS(), isGitHubPagesRuntime(), isTauriRuntime(), MiraTTS, TTSAdapter

### Community 83 - "photoreal-environment.ts"
Cohesion: 0.16
Nodes (14): EnvironmentLabel, PhotorealCameraControllerInput, PhotorealCameraPoseInput, PhotorealVisualQuality, clamp(), clamp01(), computePhotorealEnvironmentFrame(), ENVIRONMENT_TONE (+6 more)

### Community 84 - "spatial-anchor.ts"
Cohesion: 0.18
Nodes (12): axisDistance(), clamp(), clamp01(), EMPTY_SPATIAL_TOUCH, hitTestSpatialPoint(), SpatialAnchorKind, SpatialAnchorVolume, SpatialCollisionHit (+4 more)

### Community 85 - "memory-graph.ts"
Cohesion: 0.24
Nodes (15): deleteDesktopStructuredMemory(), desktopMemoryKindLabel(), desktopMemoryRelationLabel(), DesktopStructuredMemoryGraph, DesktopStructuredMemoryKind, DesktopStructuredMemoryLink, DesktopStructuredMemoryNode, DesktopStructuredMemoryPatch (+7 more)

### Community 86 - "finance.js"
Cohesion: 0.23
Nodes (15): applyCors(), buckets, clientKey(), code(), DESKTOP_ORIGINS, fx(), handler(), originAllowed() (+7 more)

### Community 87 - "WebSpeechSTT"
Cohesion: 0.19
Nodes (4): AnyRecognition, WebSpeechSTT, STTAdapter, STTStartOptions

### Community 88 - "camera-manager.ts"
Cohesion: 0.22
Nodes (16): acquireVisionCamera(), cameraCancelledError(), closeCamera(), consumerLeases, consumers, disposeActiveCamera(), getVisionCameraStream(), openCamera() (+8 more)

### Community 89 - "spatial-xr-projection.ts"
Cohesion: 0.19
Nodes (10): clamp(), DEFAULT_CALIBRATION, mulMat4Vec4(), projectMetricPointAcrossViews(), projectMetricPointToView(), SpatialXRProjectionRuntime, XRMetricPoint, XRProjectedPoint (+2 more)

### Community 90 - "character-gaze.ts"
Cohesion: 0.23
Nodes (13): clamp(), createCharacterGaze(), fixation(), GazeOffset, lerp(), smooth(), clamp(), createOriginalFaceController() (+5 more)

### Community 91 - "runtime.test.mjs"
Cohesion: 0.15
Nodes (6): centerActionTarget, importTypeScript(), pinchedSyntheticHand(), syntheticHand(), transpileTypeScript(), ../ui/vision-v2.css

### Community 92 - "object-interaction.ts"
Cohesion: 0.21
Nodes (9): clamp01(), EMPTY_OBJECT_INTERACTION, nearestHandObject(), NearMemory, ObjectInteractionStage, ObjectInteractionState, ObjectInteractionTracker, PendingDeparture (+1 more)

### Community 93 - "FeedbackPanel.tsx"
Cohesion: 0.30
Nodes (13): deleteFeedback(), FeedbackRating, FeedbackReason, FeedbackRow, FeedbackSubmission, listFeedback(), query(), submitFeedback() (+5 more)

### Community 94 - "RoomLuxuryInterior.tsx"
Cohesion: 0.29
Nodes (14): BedSet(), CityWindow(), MiraChairSet(), Plant(), RoomLighting(), RoomLuxuryInterior(), Rounded(), RoundedInstance (+6 more)

### Community 95 - "finance-intent.ts"
Cohesion: 0.23
Nodes (12): classifyFinanceIntent(), COMPANY_SYMBOLS, CURRENCY_ALIASES, currencyMentions(), explicitSymbol(), extractAmount(), FinanceIntent, FinanceIntentKind (+4 more)

### Community 96 - "gaze-head-calibration.ts"
Cohesion: 0.25
Nodes (9): CalibratedGazeHead, clamp(), emptyCalibration(), GazeHeadCalibration, GazeHeadCalibrator, GazeHeadSample, loadCalibration(), persistCalibration() (+1 more)

### Community 97 - "resolveMemoryScope"
Cohesion: 0.32
Nodes (9): cookieName(), mac(), MEMORY_SESSION_POLICY, newToken(), parseCookies(), parseSignedSession(), resolveMemoryScope(), rotateMemoryScope() (+1 more)

### Community 98 - "main.tsx"
Cohesion: 0.21
Nodes (8): AppV2, legacy, MiraProductPerformanceSnapshot, productPerformanceSnapshot(), resetProductPerformanceMonitoring(), startProductPerformanceMonitoring(), state, stopProductPerformanceMonitoring()

### Community 99 - "device-lab-matrix.mjs"
Cohesion: 0.17
Nodes (9): candidates, counts, dir, failures, markdown, markdownStatus(), matrix, options (+1 more)

### Community 100 - "VisionCameraRecoveryPolicy"
Cohesion: 0.21
Nodes (3): useVisionTransport(), VisionRuntimeModule, VisionCameraRecoveryPolicy

### Community 101 - "object-identity-hypothesis.ts"
Cohesion: 0.29
Nodes (11): TargetMemory, ObjectBox, area(), center(), clamp01(), evaluateObjectIdentityHypothesis(), identityBoxIoU(), identityCenterDistance() (+3 more)

### Community 102 - "spatial-room3d.test.mjs"
Cohesion: 0.14
Nodes (15): css, integration, luxury, pkg, room, vrm, CAMERA_CLEARANCE, Footprint (+7 more)

### Community 103 - "photoreal-camera-depth.ts"
Cohesion: 0.29
Nodes (6): clamp(), clamp01(), computeCameraSpatialFrame(), PhotorealBaseDepthFrame, PhotorealCameraDepthController, PhotorealCameraSpatialFrame

### Community 104 - "app-preferences.ts"
Cohesion: 0.30
Nodes (12): loadAffectFollowing(), loadFemalePresentation(), loadPresenceReturnSamples(), loadTheme(), saveAffectFollowing(), saveFemalePresentation(), savePresenceReturnSamples(), saveTheme() (+4 more)

### Community 105 - "useVoiceSessionLifecycle.ts"
Cohesion: 0.32
Nodes (9): useVoiceSessionLifecycle(), VoiceSessionLifecycleOptions, disableBackgroundCompanion(), enableBackgroundCompanion(), onFocus(), onVisibility(), registerWorker(), releaseWakeLock() (+1 more)

### Community 106 - "SpatialObjectPose"
Cohesion: 0.16
Nodes (17): clamp(), clonePose(), magnitude(), resolveSpatialObjectCollisions(), SpatialCollisionBody, SpatialCollisionContact, SpatialCollisionResolution, zero() (+9 more)

### Community 108 - "spatial-room-gesture.ts"
Cohesion: 0.24
Nodes (9): clamp(), distance(), Point, quiet(), RoomGestureHand, RoomGestureInput, RoomGestureMotion, RoomGestureOrbit (+1 more)

### Community 109 - "SpatialXRMetricManipulationRuntime"
Cohesion: 0.29
Nodes (6): clamp(), clonePose(), finiteDepth(), GrabSession, SpatialXRMetricManipulationRuntime, XRMetricManipulationPose

### Community 110 - "desktop-music-skill.ts"
Cohesion: 0.29
Nodes (8): contextualTrackQuery(), DesktopMediaAction, DesktopMediaActionResult, desktopMusicRequest, desktopMusicSkill, namedTrackQuery(), normalize(), wantsRecentTrack()

### Community 111 - "brain-auto-router.test.mjs"
Cohesion: 0.23
Nodes (12): discoverFreeTextModels(), FREE_CATALOG_URL, freeRouterSnapshot(), getCatalog(), isVerifiedFreeTextModel(), known, nonnegativeZero(), rankFreeTextModels() (+4 more)

### Community 112 - "check-deploy-artifact.mjs"
Cohesion: 0.18
Nodes (8): desktopMode, failures, files, heavy, pagesMode, runtimeForbidden, totalBytes, walk()

### Community 113 - "finance-calculator-skill.ts"
Cohesion: 0.36
Nodes (8): amountAfter(), calculateFinance(), FinanceCalculation, months(), normalize(), parseHumanNumber(), rate(), financeCalculatorSkill

### Community 114 - "response-latency.ts"
Cohesion: 0.20
Nodes (6): LatencyPercentiles, ResponseLatencySample, ResponseLatencySnapshot, ResponseLatencyWindow, ResponseSource, TurnTimings

### Community 115 - "skills/types.ts"
Cohesion: 0.23
Nodes (11): MiraCapability, RuntimeCapabilityPolicy, SkillExecutionMode, SkillPolicyAuditEvent, SkillRisk, APPROVAL_GATED, CapabilityDecision, evaluateSkillCapabilityPolicy() (+3 more)

### Community 116 - "audit-asset-rights.mjs"
Cohesion: 0.47
Nodes (7): fixture(), auditAssetRights(), gitBlobHash(), isTrackedMedia(), listTrackedMedia(), safePath(), slash()

### Community 117 - "device-lab-capture.mjs"
Cohesion: 0.25
Nodes (7): args, assessment, outputPath, parseArgs(), parseBool(), reportPath, result

### Community 118 - "prune-desktop-assets.mjs"
Cohesion: 0.22
Nodes (7): after, before, findHeavy(), heavyRemain, removed, removeMatching(), sizeOf()

### Community 119 - "PhotorealSceneSegments.tsx"
Cohesion: 0.31
Nodes (6): MIRA_BEDROOM_SEGMENTS, PhotorealSceneSegment, PhotorealSceneSegmentId, sceneSegmentPolygon(), PhotorealSceneSegments(), Props

### Community 120 - "product-feedback.test.mjs"
Cohesion: 0.36
Nodes (6): clean(), FEEDBACK_REASONS, ratingValues, reasons, validateProductFeedback(), rating

### Community 122 - "live-companion-benchmark.mjs"
Cohesion: 0.39
Nodes (7): json(), main(), paid, percentile(), report, request(), voicePaid

### Community 124 - "prune-pages-assets.mjs"
Cohesion: 0.25
Nodes (6): after, before, findHeavy(), heavyRemain, removeMatching(), sizeOf()

### Community 125 - "companion-dialogue.ts"
Cohesion: 0.68
Nodes (7): CompanionIntent, companionTurnGuidance(), detectCompanionIntent(), isExplicitCompanionRoleplayRequest(), plain(), recentRomanticBoundary(), rejectsRomanticRoleplay()

### Community 127 - "prune-runtime-assets.mjs"
Cohesion: 0.33
Nodes (5): after, before, removeMatching(), removeTree(), sizeOf()

### Community 128 - "chat.js"
Cohesion: 0.13
Nodes (22): applyCors(), composeSystem(), DESKTOP_ORIGINS, handleLiveToken(), handler(), normalizeMessages(), normalizeResponseLength(), originAllowed() (+14 more)

### Community 129 - "brain/index.ts"
Cohesion: 0.52
Nodes (6): GeminiBrain, browserBYOKAllowed(), createBrain(), DEFAULT_MODEL, loadLLMConfig(), saveLLMConfig()

### Community 130 - "recorded-benchmark.ts"
Cohesion: 0.38
Nodes (6): BenchmarkConfusion, BenchmarkLatencySummary, compareEventSets(), percentile(), summarizeConfusion(), summarizeLatency()

### Community 131 - "live-token.js"
Cohesion: 0.12
Nodes (17): BASE_PERSONA, buildAuthTokenRequest(), buildLiveSystemInstruction(), issueLiveToken(), LIVE_DEFAULT_MODEL, LIVE_MAX_CONTEXT_CHARS, LIVE_NEW_SESSION_WINDOW_MS, LIVE_PERSONAS (+9 more)

### Community 132 - "VRMAvatar.tsx"
Cohesion: 0.23
Nodes (8): LipSync, VISEMES, applyMood(), FACE, relaxPose(), VRMAvatar(), audioLevel, FALLBACK_AVATAR

### Community 133 - "photoreal-depth.ts"
Cohesion: 0.33
Nodes (9): clamp(), clamp01(), clarityProfile(), computePhotorealDepthFrame(), PhotorealClarityProfile, PhotorealDepthFrame, PhotorealDepthInput, PhotorealVisualCapability (+1 more)

### Community 136 - "spatial-interaction-safety.test.mjs"
Cohesion: 0.40
Nodes (4): advance(), frame(), geometry, noFace

### Community 137 - "spatial-v18-temporal.test.mjs"
Cohesion: 0.47
Nodes (4): left(), pairLeft(), pairRight(), right()

### Community 138 - "spatial-v25-v27-batch.test.mjs"
Cohesion: 0.40
Nodes (3): geometryStub, objectFixture(), pair()

### Community 139 - "App.tsx"
Cohesion: 0.21
Nodes (14): App(), SplatViewer(), has3D(), key(), resolveAvatarUrl(), saveAvatarSel(), startFaceTracking(), stopFaceTracking() (+6 more)

### Community 140 - "device-diagnostics.ts"
Cohesion: 0.29
Nodes (9): MiraProductMode, boundedLabel(), buildDeviceDiagnosticsReport(), DevicePermissionState, MiraDeviceDiagnostics, MiraDeviceReportVoice, permissionState(), runDeviceDiagnostics() (+1 more)

### Community 141 - "speech-queue.ts"
Cohesion: 0.22
Nodes (9): DirectedSpeechSegment, semanticPauseMs(), turnSegmentPauseMs(), PlannedChunk, SpeechQueue, SpeechQueueCueOptions, SpeechQueuePlayOptions, chunkSpeech() (+1 more)

### Community 142 - "PoseSkeletonOverlay.tsx"
Cohesion: 0.40
Nodes (3): CONNECTIONS, PoseSkeletonPoint, Props

### Community 144 - "SpatialXRBimanualRuntime"
Cohesion: 0.36
Nodes (3): cloneTransform(), defaultTransform(), SpatialXRBimanualRuntime

### Community 145 - "clear_memory_data"
Cohesion: 0.50
Nodes (4): clear_memory_data(), desktop_memory_clear(), fixture(), full_wipe_removes_private_activity_and_keeps_user_preferences()

### Community 155 - "DESIGN.md — Hợp đồng trải nghiệm Mira V2"
Cohesion: 0.14
Nodes (13): 10. Privacy & an toàn, 11. Accessibility, 12. Không làm, 1. Bản sắc, 2. Tính cách & giọng văn, 3. Màu & theme, 4. Typography, 5. Presence Layer (+5 more)

### Community 156 - "registry.ts"
Cohesion: 0.36
Nodes (3): financeCalculatorSkill, financeLiveSkill, financePolicySkill

### Community 157 - "server-tts.ts"
Cohesion: 0.24
Nodes (5): TTSDiagnostics, ProgressiveMp3, ServerTTSOptions, VoiceOption, Props

### Community 158 - "release-gates.test.mjs"
Cohesion: 0.38
Nodes (5): matrix(), privacy, run(), sha, temp()

### Community 159 - "FaceMeshOverlay.tsx"
Cohesion: 0.31
Nodes (8): clamp(), faceBounds(), FaceLandmarkPoint, FaceMeshOverlay(), FaceMuscleActivation, MUSCLE_POINTS, PATHS, Props

### Community 160 - "runtime-audit.ts"
Cohesion: 0.20
Nodes (4): RuntimeAuditEvent, RuntimeAuditKind, RuntimeAuditOutcome, runtimeAuditTrail

### Community 161 - "ContentPanel.tsx"
Cohesion: 0.43
Nodes (5): downloadImage(), ResultView, ContentPanel(), Props, IconClose()

### Community 162 - "vi-normalize.ts"
Cohesion: 0.42
Nodes (8): DIGITS, GROUPS, normalizeVietnameseSpeech(), numToWords(), readIntVi(), readMonthVi(), readTriple(), readTwo()

### Community 163 - "character-director.ts"
Cohesion: 0.38
Nodes (6): CharacterMotionCues, clamp01(), createCharacterDirector(), finiteSeconds(), Weights, ZERO_CUES

### Community 164 - "finance-live-skill.ts"
Cohesion: 0.40
Nodes (4): miraCloudApiUrl(), FinanceApiResponse, financeLiveSkill, financeRequest()

### Community 168 - "realistic-human-motion.test.mjs"
Cohesion: 0.40
Nodes (4): observed, raw, rawVisemes, reactionSource

### Community 169 - "realistic-human-renderer.test.mjs"
Cohesion: 0.60
Nodes (4): material(), realisticFixture(), scene(), source

### Community 170 - "IconMic"
Cohesion: 0.67
Nodes (3): IconMic(), Props, VoiceDock()

## Knowledge Gaps
- **2 isolated node(s):** `./ui/styles.css`, `mira-desktop`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1235 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `resolvePresenceScene()` connect `presence-scene.ts` to `live-session.ts`, `AppV2.tsx`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `AppV2()` (e.g. with `readPresenceStyle()` and `intimateScenesEnabled()`) actually correct?**
  _`AppV2()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `./ui/styles.css`, `mira-desktop` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `check-architecture.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.009345794392523364 - nodes in this community are weakly interconnected._
- **Why does `UseMira` connect `useMira.ts` to `brain/index.ts`, `AppV2.tsx`, `host/index.ts`, `useVoiceSessionLifecycle.ts`, `Mira — Local-first AI Companion`, `App.tsx`, `speech-queue.ts`, `mood-engine.ts`, `tts/index.ts`, `memory-service.ts`, `local-memory-portability.ts`, `response-latency.ts`, `WebSpeechSTT`, `live-session.ts`, `SettingsPanel.tsx`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `ref_node_assert` be split into smaller, more focused modules?**
  _Cohesion score 0.032475247524752476 - nodes in this community are weakly interconnected._
- **Why does `BrainTurn` connect `BrainTurn` to `local-memory-store.ts`, `useMira.ts`, `host/index.ts`, `memory-service.ts`, `local-memory-portability.ts`, `isDesktopRuntime`, `FeedbackPanel.tsx`, `server-tts.ts`, `SettingsPanel.tsx`, `companion-dialogue.ts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._