import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const mustExist = [
  'src/app/AppV2.tsx',
  'src/presence/HolographicMira.tsx',
  'src/presence/PhotorealMira.tsx',
  'src/presence/photoreal-mira.css',
  'src/presence/MemoryConstellation.tsx',
  'src/presence/memory-constellation.ts',
  'src/presence/holographic-mira.css',
  'src/presence/holographic-mira-godmode.css',
  'src/presence/holographic-mira-life.css',
  'src/presence/holographic-mira-constellation.css',
  'public/assets/mira-holographic.webp',
  'src/core/audio-level.ts',
  'src/core/tts/vi-normalize.ts',
  'src/core/tts/vi-speech-director.ts',
  'src/core/tts/server-tts.ts',
  'src/core/tts/piper-local-tts.ts',
  'src/core/brain/local-webllm-brain.ts',
  'src/core/face/facial-gesture.ts',
  'src/core/face/facs-proxy.ts',
  'src/core/face/micro-expression.ts',
  'src/core/vision/real-presence.ts',
  'src/core/vision/posture-model.ts',
  'src/core/vision/posture-tracker.ts',
  'src/core/vision/hand-gesture-lite.ts',
  'src/core/vision/vision-performance.ts',
  'src/core/vision/holistic-tracker.ts',
  'src/core/vision/face-frame-guard.ts',
  'src/core/vision/vision-worker-protocol.ts',
  'src/core/vision/vision-postprocess-worker.ts',
  'src/core/vision/vision-worker-client.ts',
  'src/core/vision/gesture-intent.ts',
  'src/intelligence/social/gaze-head-calibration.ts',
  'src/intelligence/social/face-social-control.ts',
  'src/intelligence/social/presence-continuity.ts',
  'src/core/vision/environment-model.ts',
  'src/core/vision/object-awareness.ts',
  'src/core/vision/spatial-scene-graph.ts',
  'src/core/vision/object-interaction.ts',
  'src/core/vision/action-sequence.ts',
  'src/core/vision/causal-action-graph.ts',
  'src/core/vision/world-model.ts',
  'src/core/vision/spatial-ui-control.ts',
  'src/core/vision/spatial-ray.ts',
  'src/core/vision/spatial-anchor.ts',
  'src/core/vision/spatial-object.ts',
  'src/core/vision/spatial-world.ts',
  'src/core/vision/spatial-physics.ts',
  'src/core/vision/spatial-collision.ts',
  'src/core/vision/spatial-joint.ts',
  'src/core/vision/spatial-device-adapter.ts',
  'src/core/vision/spatial-webxr-session.ts',
  'src/core/vision/spatial-xr-projection.ts',
  'src/core/vision/spatial-xr-surface.ts',
  'src/core/vision/spatial-xr-manipulation.ts',
  'src/core/vision/spatial-xr-hand-bridge.ts',
  'src/core/vision/spatial-hand-intent.ts',
  'src/core/vision/spatial-hand-contact.ts',
  'src/core/vision/spatial-hand-kinematics.ts',
  'src/core/vision/spatial-group.ts',
  'src/core/vision/spatial-layout.ts',
  'src/intelligence/vision/deictic-vision.ts',
  'src/presence/ObjectAwarenessOverlay.tsx',
  'src/presence/SpatialSceneOverlay.tsx',
  'src/presence/SpatialControlOverlay.tsx',
  'src/core/vision/rppg-signal.ts',
  'src/core/vision/rppg-monitor.ts',
  'src/presence/PoseSkeletonOverlay.tsx',
  'src/presence/RealPresenceOverlay.tsx',
  'src/presence/real-presence-overlay.css',
  'src/intelligence/affect/mood-engine.ts',
  'src/intelligence/affect/affect-control.ts',
  'src/intelligence/social/interaction-engine.ts',
  'src/intelligence/social/behavior-timeline.ts',
  'src/intelligence/proactive/proactive-engine.ts',
  'src/intelligence/memory/local-memory-store.ts',
  'src/runtime/background-companion.ts',
  'src/presence/FaceMeshOverlay.tsx',
  'public/sw.js',
  'public/manifest.webmanifest',
  'src/settings/SettingsPanel.tsx',
  'src/runtime/conversation-machine.ts',
  'src/runtime/conversation-timing.ts',
  'src/runtime/speech-utils.ts',
  'src/runtime/speech-queue.ts',
  'src/runtime/turn-manager.ts',
  'src/intelligence/identity/owner-profile.ts',
  'src/intelligence/skills/registry.ts',
  'src/intelligence/memory/memory-service.ts',
  'src/host/index.ts',
  'src/core/useMira.ts',
  'src/ui/v2.css',
  'src/ui/vision-v2.css',
  'scripts/prune-pages-assets.mjs',
  'scripts/check-deploy-artifact.mjs',
  'api/tts.js',
];

for (const path of mustExist) {
  if (!existsSync(path)) failures.push(`missing required file: ${path}`);
}

const entry = readFileSync('src/main.tsx', 'utf8');
if (!entry.includes("./app/AppV2")) failures.push('production entry does not import AppV2');
if (!entry.includes("const LegacyApp = lazy(async () =>") || !entry.includes("import('./ui/styles.css')") || !entry.includes("return import('./App')")) {
  failures.push('Legacy/Labs shell and legacy stylesheet must stay lazy-loaded');
}
if (entry.includes("import './ui/styles.css';")) failures.push('legacy styles.css must not be in the initial AppV2 graph');
if (!entry.includes("import './ui/base-v2.css';")) failures.push('AppV2 base stylesheet missing');

const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');
if (!ciWorkflow.includes('npm run check:artifact')) failures.push('CI must run deploy artifact smoke after build');
const pagesWorkflow = readFileSync('.github/workflows/pages.yml', 'utf8');
if (!pagesWorkflow.includes('npm run prune:pages')) failures.push('Pages must prune heavy legacy assets after build');
if (!pagesWorkflow.includes('npm run check:pages')) failures.push('Pages must run deploy artifact smoke before publish');
const pagesPrune = readFileSync('scripts/prune-pages-assets.mjs', 'utf8');
for (const token of [".endsWith('.vrm')", "splat.ply", "join(DIST, 'looks')", 'Pages artifact prune']) {
  if (!pagesPrune.includes(token)) failures.push(`Pages asset prune missing: ${token}`);
}
const legacyApp = readFileSync('src/App.tsx', 'utf8');
for (const token of ['GITHUB_PAGES_LITE', "hostname.endsWith('.github.io')", '!GITHUB_PAGES_LITE && !avatar2d']) {
  if (!legacyApp.includes(token)) failures.push(`Pages Labs lightweight fallback missing: ${token}`);
}

const v2 = readFileSync('src/app/AppV2.tsx', 'utf8');
for (const token of ['SplatViewer', 'face-tracker', 'gesture-tracker', 'DevConsole', "../ui/MiraStage", 'PresenceStage', 'Composer', 'VoiceOrb']) {
  if (v2.includes(token)) failures.push(`AppV2 primary surface imports removed/heavy capability: ${token}`);
}
for (const token of ['PhotorealMira', "lazy(() => import('../settings/SettingsPanel'))", "lazy(() => import('../ui/ContentPanel'))", "import('../ui/vision-v2.css')", 'mira.history.slice(-6)', 'contextText={constellationContext}', 'FaceMeshOverlay', 'SpatialSceneGraphTracker', 'spatialScenePrompt', 'ObjectInteractionTracker', 'objectInteractionPrompt', 'ActionSequenceTracker', 'actionSequencePrompt', 'CausalActionGraphTracker', 'causalActionGraphPrompt', 'ShortTermWorldModelTracker', 'worldModelPrompt', 'SpatialUIController', 'SpatialControlOverlay', 'SpatialDirectTouchTracker', 'SpatialObjectRuntime', 'SpatialPhysicsRuntime', 'resolveSpatialObjectCollisions', 'SpatialJointRuntime', 'SpatialSelectionRuntime', 'spatialSessionLayoutRuntime', 'beginSpatialGroupTransform', 'applySpatialGroupTransform', 'SpatialDeviceAdapterRuntime', 'SpatialWebXRSessionRuntime', 'SpatialXRProjectionRuntime', 'projectMetricPointAcrossViews', 'xrProjectionRef', 'SpatialXRSurfaceRuntime', 'SpatialXRMetricManipulationRuntime', 'SpatialXRRigidBodyRuntime', 'SpatialXRHandCollisionRuntime', 'xrSurfaceRef', 'xrMetricManipulationRef', 'xrRigidBodyRef', 'xrHandCollisionRef', 'xrObjectDepthScale', 'xrWindowDepthScale', 'xrWindowBimanual', 'setXRWindowSurfaceState', 'requestAnchorAtCurrentHit', 'data-xr-depth', 'data-xr-surface', 'SpatialHandContactRuntime', 'SpatialHandIntentRuntime', 'mirrorSpatialHandKinematicsX', 'humanHandContact', 'humanHandIntent', 'HandSkeletonOverlay', 'webXRRuntimeRef', 'xr.toggle', 'useWebXRSessionFeatures', 'XR · đã căn tâm DOM', 'victory_hold', 'open_palm_hold', 'selectedClusterRoots', 'mira.node', 'stack.', 'slide.', 'clusterObjectIds', 'data-spatial-action', 'data-spatial-grab-handle', 'data-spatial-object', 'measureTwoHands', 'environmentPrompt', 'GazeHeadCalibrator', 'GestureIntentTracker', 'InteractionTracker', 'BehaviorTimeline', 'interactionTelemetry', 'headYaw={faceTelemetry.yaw}', 'cameraDistanceM={faceTelemetry.distanceM}', 'cameraPoseConfidence={faceTelemetry.confidence}', 'environmentLabel={faceTelemetry.environmentLabel}', 'environmentConfidence={faceTelemetry.environmentConfidence}', 'micProsodySnapshot', 'observeAffect', 'enableBackgroundCompanion']) {
  if (!v2.includes(token)) failures.push(`AppV2 missing production surface: ${token}`);
}
if (v2.includes('sendText')) failures.push('voice-only production surface must not expose text composer flow');
for (const token of ['resolveAirTarget', 'v2-air-layer', 'grabActive', 'spatialTransformActive', 'setGestureIntentTelemetry', 'setSpatialHands', 'setAirPoint']) {
  if (v2.includes(token)) failures.push(`dead Air Control UI leaked into AppV2: ${token}`);
}

const presence = readFileSync('src/presence/HolographicMira.tsx', 'utf8');
for (const token of [
  'audioLevel',
  'requestAnimationFrame',
  '--hm-level',
  '--hm-mouth',
  '/assets/mira-holographic.webp',
  'holographic-mira-godmode.css',
  'holographic-mira-life.css',
  'MemoryConstellation',
  'contextText',
  'hm-god-stars',
  'hm-speaking-pulse',
  'hm-activation-flash',
  'hm-voice-gravity',
  'hm-eyelid',
  'is-blinking',
  '--hm-look-x',
]) {
  if (!presence.includes(token)) failures.push(`HolographicMira missing approved visual/voice behavior: ${token}`);
}
if (presence.includes('<svg')) failures.push('HolographicMira must use approved art, not a hand-drawn SVG face');

const photoreal = readFileSync('src/presence/PhotorealMira.tsx', 'utf8');
for (const token of ['audioLevel', 'requestAnimationFrame', '--pm-level', 'MIRA_BEDROOM', 'SCENE_BY_STATE', 'mira-bedroom.webp', 'bedroom-presence', 'pm-wave', 'pm-state-orb', 'data-spatial-object']) {
  if (!photoreal.includes(token)) failures.push(`PhotorealMira missing approved bedroom visual/voice behavior: ${token}`);
}
for (const token of ['affectActive', 'affectFollowing', '--pm-affect', 'affect-follow', 'interactionState', '--pm-attention', '--pm-eye-contact', 'socialCue', 'presenceMode', 'presenceCue', '--pm-continuity']) {
  if (!photoreal.includes(token)) failures.push(`PhotorealMira observed-expression response missing: ${token}`);
}
for (const token of ["lazy(() => import('./PhotorealSceneCanvas'))", "lazy(() => import('./PhotorealSceneSegments'))", "import('./photoreal-camera-depth')", "import('./photoreal-environment')", 'PhotorealSceneCanvas', 'PhotorealSceneSegments', 'PhotorealSceneCanvasHandle', 'sceneCanvasRef', 'updateDepthWarp', 'dataset.depthWarp', 'visualProfile.sharpness > 0', 'resolvePhotorealVisualQuality', 'clarityProfile', 'computePhotorealDepthFrame', 'cameraDepthControllerRef', 'environmentControllerRef', 'environmentRef', 'cameraPoseRef', 'pm-env-window-light', 'pm-env-city-bokeh', 'pm-env-light-rays', 'pm-env-practical-light', 'pm-env-bed-bounce', 'pm-env-reflection', 'pm-env-edge-occlusion', 'pm-env-dust', 'pm-env-vignette', 'data-visual-quality', 'pm-depth-mid', 'pm-depth-near', 'pm-depth-atmosphere', 'pm-depth-relight', 'pm-depth-contact-shadow', 'pm-hero-copy', 'data-hero-state={state}', 'key={\`hero-\${state}\`}', 'STATE_LABEL[state]', 'pm-hero-capabilities', 'pm-hero-story', '--pm-depth-back-x']) {
  if (!photoreal.includes(token)) failures.push(`PhotorealMira v21/v22/v23/v24 depth-copy integration missing: ${token}`);
}
if (photoreal.includes('<span className="pm-clean-copy-scrim"')) failures.push('clean canonical scene must not reintroduce a baked-copy masking scrim');
if (photoreal.includes('pm-runtime')) failures.push('PhotorealMira must not render the legacy Mira Core popup');
if (photoreal.includes('pm-character')) failures.push('PhotorealMira must not overlay the old standing character on the bedroom scene');

const photorealDepth = readFileSync('src/presence/photoreal-depth.ts', 'utf8');
for (const token of ['resolvePhotorealVisualQuality', 'clarityProfile', 'computePhotorealDepthFrame', "'lite'", "'balanced'", "'high'", "'ultra'", 'renderDpr', 'sharpness', 'farBlurPx', 'presentation-only', 'motion sickness']) {
  if (!photorealDepth.includes(token)) failures.push(`photoreal depth runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(photorealDepth)) failures.push('photoreal depth quality state must remain session-only');

const photorealCameraDepth = readFileSync('src/presence/photoreal-camera-depth.ts', 'utf8');
for (const token of ['computeCameraSpatialFrame', 'PhotorealCameraSpatialFrame', 'PhotorealCameraDepthController', 'baselineDistanceM', 'confidence < 0.42', 'smoothing = input.reducedMotion ? 1 : 0.085', "--pm-camera-room-x", "--pm-camera-rotate-y", "--pm-atmosphere-x", "--pm-contact-shadow-x", 'presentation-only', 'lite: 0', 'balanced: 0.56', 'high: 0.8', 'ultra: 1']) {
  if (!photorealCameraDepth.includes(token)) failures.push(`camera photoreal depth runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(photorealCameraDepth)) failures.push('camera photoreal depth state must remain session-only');

const photorealEnvironment = readFileSync('src/presence/photoreal-environment.ts', 'utf8');
for (const token of ['computePhotorealEnvironmentFrame', 'PhotorealPerformanceGovernor', 'PhotorealEnvironmentController', 'ENVIRONMENT_TONE', "full: 1", "reduced: 0.66", "minimal: 0.32", 'samples.length > 45', 'p80 > 22', 'dataset.performanceTier', "--pm-env-practical", "--pm-env-window", "--pm-env-city-bokeh", "--pm-env-light-rays", "--pm-env-bed-bounce", "--pm-env-edge-occlusion", 'presentation-only']) {
  if (!photorealEnvironment.includes(token)) failures.push(`photoreal environment runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(photorealEnvironment)) failures.push('photoreal environment/performance state must remain session-only');

const photorealSceneSegmentation = readFileSync('src/presence/photoreal-scene-segmentation.ts', 'utf8');
for (const token of ['MIRA_BEDROOM_SEGMENTS', "'window'", "'pillow'", "'subject'", "'bed'", "'foreground'", 'depthRank', 'sceneSegmentPolygon', 'validateSceneSegments', 'presentation masks', 'not measured depth']) {
  if (!photorealSceneSegmentation.includes(token)) failures.push(`photoreal v26 scene segmentation missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(photorealSceneSegmentation)) failures.push('photoreal scene segmentation profile must remain static/session-only');

const photorealDepthWarp = readFileSync('src/presence/photoreal-depth-warp.ts', 'utf8');
for (const token of ['PHOTOREAL_DEPTH_FIELD_GLSL', 'computePhotorealDepthWarpControl', 'windowMask', 'pillowMask', 'subjectMask', 'bedDepth', 'foregroundDepth', "quality === 'ultra'", "performanceTier === 'full'", 'fpsCap: 30', 'not metric depth', 'not inferred geometry']) {
  if (!photorealDepthWarp.includes(token)) failures.push(`photoreal v27 continuous depth warp missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(photorealDepthWarp)) failures.push('photoreal depth warp control must remain session-only');

const photorealSceneSegments = readFileSync('src/presence/PhotorealSceneSegments.tsx', 'utf8');
for (const token of ['pm-scene-segments', 'pm-scene-segment', 'data-depth-rank', 'sceneSegmentPolygon', 'MIRA_BEDROOM_SEGMENTS']) {
  if (!photorealSceneSegments.includes(token)) failures.push(`photoreal v26 segment renderer missing: ${token}`);
}

const photorealCanvas = readFileSync('src/presence/PhotorealSceneCanvas.tsx', 'utf8');
for (const token of ['webgl', 'u_sharpness', 'u_view', 'u_depth_strength', 'PHOTOREAL_DEPTH_FIELD_GLSL', 'updateDepthWarp', 'textureUploaded', 'haloGuard', 'coverUv', 'maxRenderPixels = 12_000_000', 'same WebGL context', 'does not claim']) {
  if (!photorealCanvas.includes(token)) failures.push(`photoreal GPU clarity pass missing: ${token}`);
}

const photorealCss = readFileSync('src/presence/photoreal-mira.css', 'utf8');
for (const token of ['Spatial Visual v21', 'Spatial Visual v22', 'Spatial Visual v23', 'Spatial Visual v24', 'Spatial Visual v25', 'Spatial Visual v26', 'Spatial Visual v27', '--pm-depth-back-x', '--pm-depth-mid-x', '--pm-depth-near-x', '--pm-camera-room-x', '--pm-camera-subject-x', '--pm-camera-foreground-x', '--pm-camera-rotate-x', '--pm-camera-rotate-y', '--pm-camera-scale', '--pm-env-practical', '--pm-env-window', '--pm-env-reflection', '--pm-env-haze', '--pm-env-city-bokeh', '--pm-env-light-rays', '--pm-env-bed-bounce', '--pm-env-edge-occlusion', '.pm-env-window-light', '.pm-env-city-bokeh', '.pm-env-light-rays', '.pm-env-practical-light', '.pm-env-bed-bounce', '.pm-env-reflection', '.pm-env-edge-occlusion', '.pm-env-dust', '.pm-env-vignette', '[data-performance-tier="reduced"]', '[data-performance-tier="minimal"]', '--pm-clarity-contrast', '.pm-scene-canvas[data-ready="true"]', '.pm-depth-mid', '.pm-depth-near', '.pm-depth-atmosphere', '.pm-depth-relight', '.pm-depth-contact-shadow', '.pm-hero-copy', '[data-hero-state="listening"]', '@keyframes pmHeroLineIn', '[data-visual-quality="lite"]']) {
  if (!photorealCss.includes(token)) failures.push(`photoreal v21/v22/v23/v24 CSS missing: ${token}`);
}
if (/filter\s*:\s*blur\([^)]*--pm-camera|backdrop-filter[^;]*--pm-camera/.test(photorealCss)) failures.push('camera-driven v23 must keep per-frame motion on compositor transforms, not animated blur/backdrop-filter');
if (!photorealCss.includes('[data-performance-tier="minimal"] .pm-env-city-bokeh') || !photorealCss.includes('[data-performance-tier="reduced"] .pm-env-light-rays')) {
  failures.push('v25 environmental depth layers must degrade under frame pressure');
}
for (const token of ['.pm-scene-segments', '.pm-scene-segment-window', '.pm-scene-segment-subject', '.pm-scene-segment-bed', '.pm-scene-segment-foreground', '[data-visual-quality="high"] .pm-scene-segment-window', '[data-performance-tier="reduced"] .pm-scene-segment-bed', '[data-performance-tier="minimal"] .pm-scene-segments']) {
  if (!photorealCss.includes(token)) failures.push(`v26 segmented depth CSS missing/degrade contract: ${token}`);
}
for (const token of ['[data-depth-warp="true"] .pm-scene-canvas', '[data-depth-warp="true"] .pm-depth-mid', '[data-depth-warp="true"] .pm-scene-segment-subject', '[data-depth-warp="true"] .pm-scene-segment-foreground']) {
  if (!photorealCss.includes(token)) failures.push(`v27 GPU depth-warp blending CSS missing: ${token}`);
}

const photorealRestore = readFileSync('scripts/restore-photoreal-assets.mjs', 'utf8');
for (const token of ['PART_COUNT = 11', 'EXPECTED_SHA256', 'Buffer.from(encoded, \'base64\')', 'RIFF', 'WEBP', 'writeFileSync']) {
  if (!photorealRestore.includes(token)) failures.push(`photoreal asset restore missing: ${token}`);
}

const godMode = readFileSync('src/presence/holographic-mira-godmode.css', 'utf8');
for (const token of ['hm-luxury-glints', 'hm-light-rays', 'hm-crown-halo', 'hm-speaking-pulse-near', 'hm-activation-flash']) {
  if (!godMode.includes(token)) failures.push(`Mira cinematic god mode missing: ${token}`);
}

const lifeMode = readFileSync('src/presence/holographic-mira-life.css', 'utf8');
for (const token of ['hm-micro-expression', 'hm-eyelid', 'hm-eye-spark', 'hm-voice-gravity', 'hm-gravity-in', 'hm-gravity-out']) {
  if (!lifeMode.includes(token)) failures.push(`Mira life layer missing: ${token}`);
}

const constellationModel = readFileSync('src/presence/memory-constellation.ts', 'utf8');
for (const token of ['CONSTELLATIONS', 'scoreConstellations', "id: 'owner'", "id: 'mira'", "id: 'soi'", "id: 'design'", "id: 'voice'", "id: 'memory'"]) {
  if (!constellationModel.includes(token)) failures.push(`Mira constellation model missing: ${token}`);
}

const constellationView = readFileSync('src/presence/MemoryConstellation.tsx', 'utf8');
for (const token of ['scoreConstellations', 'hm-memory-constellation', 'hm-memory-threads', 'hm-constellation-label', 'contextText']) {
  if (!constellationView.includes(token)) failures.push(`Mira constellation view missing: ${token}`);
}

const constellationCss = readFileSync('src/presence/holographic-mira-constellation.css', 'utf8');
for (const token of ['hm-memory-constellation', 'hm-memory-thread-flow', 'state-thinking', 'state-speaking', 'prefers-reduced-motion']) {
  if (!constellationCss.includes(token)) failures.push(`Mira constellation CSS missing: ${token}`);
}

const speechQueue = readFileSync('src/runtime/speech-queue.ts', 'utf8');
for (const token of [
  'planVietnameseTurn',
  'turnSegmentPauseMs',
  'semanticPauseMs',
  'normalizeVietnameseSpeech',
  'chunk.segment.instructions',
  'segment.rateMultiplier',
  'PlannedChunk',
  'playCue',
  'backchannel',
]) {
  if (!speechQueue.includes(token)) failures.push(`Vietnamese turn-level speech queue direction missing: ${token}`);
}

const speechDirector = readFileSync('src/core/tts/vi-speech-director.ts', 'utf8');
for (const token of [
  'SpeechPerformance',
  'SpeechTurnRole',
  'DirectedSpeechSegment',
  'directVietnameseSpeech',
  'planVietnameseTurn',
  'turnSegmentPauseMs',
  'ROLE_GUIDANCE',
  "'opening'",
  "'explanation'",
  "'contrast'",
  "'emphasis'",
  "'warning'",
  "'conclusion'",
  "'question'",
  'hội thoại tự nhiên',
]) {
  if (!speechDirector.includes(token)) failures.push(`Vietnamese speech director missing: ${token}`);
}

const conversationTiming = readFileSync('src/runtime/conversation-timing.ts', 'utf8');
for (const token of [
  'planConversationTiming',
  'chooseThinkingCue',
  'previousLatencyMs',
  'recentCue',
  'resumeListeningDelayMs',
  'interruptionRecoveryDelayMs',
  'silenceRetryDelayMs',
  'SHORT_ACK_RE',
  'SENSITIVE_RE',
]) {
  if (!conversationTiming.includes(token)) failures.push(`adaptive conversation timing missing: ${token}`);
}

const viNormalize = readFileSync('src/core/tts/vi-normalize.ts', 'utf8');
for (const token of ['readIntVi', 'normalizeVietnameseSpeech', 'phần trăm', 'triệu', 'ngày']) {
  if (!viNormalize.includes(token)) failures.push(`Vietnamese pronunciation normalizer missing: ${token}`);
}

const serverTts = readFileSync('src/core/tts/server-tts.ts', 'utf8');
if (!serverTts.includes('instructions: opts.instructions')) failures.push('ServerTTS must forward dynamic speech instructions');

const runtime = readFileSync('src/core/useMira.ts', 'utf8');
for (const token of [
  'TurnManager',
  'SpeechQueue',
  'createDefaultSkillRegistry',
  'scheduleThinkingSignals',
  'lastBrainLatencyRef',
  'recentThinkingCueRef',
  'interruptedTurnRef',
  'playCue',
  'resumeListeningDelayMs',
  'interruptionRecoveryDelayMs',
  'silenceRetryDelayMs',
  'observeAffect',
  'ProactiveEngine',
  'affectRef.current.speechRate',
]) {
  if (!runtime.includes(token)) failures.push(`useMira runtime boundary missing: ${token}`);
}

const turnManager = readFileSync('src/runtime/turn-manager.ts', 'utf8');
if (!turnManager.includes('ownerIdentityReply')) failures.push('TurnManager must preserve deterministic Mira owner identity');
for (const token of ['deicticVisualReply', 'const visualReply =', 'runtimeContext']) {
  if (!turnManager.includes(token)) failures.push(`TurnManager deictic visual bridge missing: ${token}`);
}
const owner = readFileSync('src/intelligence/identity/owner-profile.ts', 'utf8');
if (!owner.includes('Đỗ Minh Đức')) failures.push('Mira owner identity is missing');

const tts = readFileSync('api/tts.js', 'utf8');
for (const token of ['gpt-4o-mini-tts', 'OPENAI_API_KEY', 'elevenlabs', 'body.instructions', 'payload.instructions', 'mergeInstructions']) {
  if (!tts.includes(token)) failures.push(`neural TTS gateway missing: ${token}`);
}

const localTts = readFileSync('src/core/tts/index.ts', 'utf8');
if (!localTts.includes('PiperLocalTTS')) failures.push('GitHub Pages must use local neural Piper TTS');
const brain = readFileSync('src/core/brain/index.ts', 'utf8');
if (!brain.includes('LocalWebLLMBrain')) failures.push('GitHub Pages must expose a real local WebLLM brain');
if (brain.includes('VITE_LLM_API_KEY')) failures.push('production brain source must not read VITE_LLM_API_KEY');
const localMemory = readFileSync('src/intelligence/memory/memory-service.ts', 'utf8');
if (!localMemory.includes('LocalMemoryStore') || !localMemory.includes('observeAffect')) failures.push('long-term local memory/affect persistence missing');
const localMemoryStore = readFileSync('src/intelligence/memory/local-memory-store.ts', 'utf8');
for (const token of ['navigator.storage.persist', 'exportSnapshot', 'importTurns', 'clearAll', 'countTurns']) {
  if (!localMemoryStore.includes(token)) failures.push(`local memory portability missing: ${token}`);
}
if (localMemoryStore.includes('bpmTrend') || localMemoryStore.includes('pulseTrace')) failures.push('experimental physiological estimates must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('BehaviorEvent') || localMemoryStore.includes('behaviorTimeline')) failures.push('social behavior timeline must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('TrackedObject') || localMemoryStore.includes('objectAwareness') || localMemoryStore.includes('EnvironmentContext')) failures.push('environment object tracks must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('SpatialSceneGraph') || localMemoryStore.includes('SpatialFocus') || localMemoryStore.includes('SpatialSceneEvent') || localMemoryStore.includes('spatialScene')) failures.push('spatial scene graph must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('ObjectInteractionState') || localMemoryStore.includes('objectInteraction')) failures.push('object interaction proxy must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('ActionSequenceState') || localMemoryStore.includes('actionSequence')) failures.push('action sequence must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('CausalActionGraphState') || localMemoryStore.includes('causalActionGraph')) failures.push('causal action graph must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('ShortTermWorldState') || localMemoryStore.includes('WorldObjectMemory') || localMemoryStore.includes('worldModel')) failures.push('world model must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('PresenceContinuityState') || localMemoryStore.includes('presenceContinuity')) failures.push('presence continuity must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('SpatialDirectTouchState') || localMemoryStore.includes('spatialTouch')) failures.push('direct spatial touch state must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('SpatialObjectState') || localMemoryStore.includes('spatialObjects')) failures.push('spatial object must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('SpatialWorldAnchor') || localMemoryStore.includes('SpatialObjectAttachment') || localMemoryStore.includes('spatialWorld')) failures.push('spatial world graph must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('SpatialPlacementPreview') || localMemoryStore.includes('placementPreview')) failures.push('placement preview must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('SpatialPhysicsState') || localMemoryStore.includes('spatialPhysics')) failures.push('spatial physics must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('SpatialCollisionContact') || localMemoryStore.includes('spatialCollision')) failures.push('spatial collision must remain ephemeral, not long-term memory');
const profileClient = readFileSync('src/intelligence/memory/profile-client.ts', 'utf8');
for (const token of ['isGitHubPagesRuntime', 'localMemory.countTurns', 'localMemory.clearAll', 'localMemory.exportSnapshot']) {
  if (!profileClient.includes(token)) failures.push(`GitHub Pages profile fallback missing: ${token}`);
}
const capsuleClient = readFileSync('src/intelligence/identity/capsule-client.ts', 'utf8');
for (const token of ['verifyLocalCapsule', 'localMemory.exportSnapshot', 'localMemory.importTurns', "crypto.subtle.digest('SHA-256'"]) {
  if (!capsuleClient.includes(token)) failures.push(`GitHub Pages Identity Capsule fallback missing: ${token}`);
}
const faceRecoveryRuntime = readFileSync('src/presence/vision-runtime.ts', 'utf8');
for (const token of ['faceRecoveryTimer', 'face.lastSeenAt > 0', 'performance.processedFrames >= 6', '!holisticTrackerError()', 'startLegacyVision(session)', '8_000', 'duplicate inference']) {
  if (!faceRecoveryRuntime.includes(token)) failures.push(`face recovery watchdog missing: ${token}`);
}
const cameraSurfaceStart = Math.max(
  v2.indexOf('className={\`v2-camera-frame'),
  v2.indexOf('className="v2-camera-frame"'),
);
const cameraSurfaceEnd = v2.indexOf('\n          <div\n            className="v2-spatial-window-bar"', cameraSurfaceStart);
const cameraSurface = cameraSurfaceStart >= 0 && cameraSurfaceEnd > cameraSurfaceStart
  ? v2.slice(cameraSurfaceStart, cameraSurfaceEnd)
  : '';
for (const token of ['PoseSkeletonOverlay', 'ObjectAwarenessOverlay', 'SpatialSceneOverlay', 'v2-gesture-overlay']) {
  if (cameraSurface.includes(token)) failures.push(`camera recognition surface includes deprecated telemetry overlay: ${token}`);
}
for (const token of ['FaceMeshOverlay', 'HandSkeletonOverlay', 'humanHandContact', 'humanHandIntent', 'v2-camera-status face-only', 'Đã nhận diện khuôn mặt', 'v2-affect-readout', 'v2-affect-follow', 'v2-gaze-readout', 'faceActionFeedback']) {
  if (!cameraSurface.includes(token)) failures.push(`camera recognition surface missing: ${token}`);
}
if (v2.includes('<RealPresenceOverlay')) failures.push('primary surface must not render the secondary Real Presence popup');
if (v2.includes('<AirControlOverlay')) failures.push('primary surface must not render hand-control telemetry over camera mode');

const realPresence = readFileSync('src/core/vision/real-presence.ts', 'utf8');
for (const token of ['estimateRealPresencePose', 'estimateFaceDistanceM', 'sceneOffsetX', 'sceneScale', 'privacy-preserving']) {
  if (!realPresence.includes(token)) failures.push(`real presence spatial estimator missing: ${token}`);
}
const realPresenceView = readFileSync('src/presence/RealPresenceOverlay.tsx', 'utf8');
for (const token of ['ImageSegmenter', 'selfie_segmenter_landscape', 'segmentForVideo', 'getAsFloat32Array', 'REAL SEAT · LOCKED', 'faceSeenRef', 'const stableFace', '[active, stream]']) {
  if (!realPresenceView.includes(token)) failures.push(`real presence compositor missing: ${token}`);
}
if (realPresenceView.includes('[active, faceSeen, stream]')) failures.push('RealPresence must not recreate ImageSegmenter on face enter/leave');
const facsProxy = readFileSync('src/core/face/facs-proxy.ts', 'utf8');
for (const token of ['FACSProxy', 'AU01', 'AU04', 'AU06', 'AU12', 'AU23', 'AU45', 'not a validated FACS detector']) {
  if (!facsProxy.includes(token)) failures.push(`FACS-like blendshape mapping missing: ${token}`);
}
const microExpression = readFileSync('src/core/face/micro-expression.ts', 'utf8');
for (const token of ['MicroExpressionTracker', 'smile_flash', 'tension_flash', 'durationMs', 'temporal visual event detector']) {
  if (!microExpression.includes(token)) failures.push(`micro-expression temporal layer missing: ${token}`);
}
const postureModel = readFileSync('src/core/vision/posture-model.ts', 'utf8');
for (const token of ['derivePosture', 'slouched', 'upright', 'shoulderSlope', 'not a health assessment']) {
  if (!postureModel.includes(token)) failures.push(`posture model missing: ${token}`);
}
const handGestureLite = readFileSync('src/core/vision/hand-gesture-lite.ts', 'utf8');
for (const token of ['inferLiteGesture', 'Open_Palm', 'Closed_Fist', 'Victory', 'Pointing_Up', 'ILoveYou']) {
  if (!handGestureLite.includes(token)) failures.push(`holistic hand gesture adapter missing: ${token}`);
}
const visionPerformance = readFileSync('src/core/vision/vision-performance.ts', 'utf8');
for (const token of ['VisionPerformanceGovernor', 'detectVisionTier', 'baseIntervalForTier', 'hidden', 'inferenceMs', 'landmarkCount', 'postprocess', 'postprocessMs', 'setPostprocess']) {
  if (!visionPerformance.includes(token)) failures.push(`vision performance governor missing: ${token}`);
}
const visionDelegateFallback = readFileSync('src/core/vision/vision-delegate-fallback.ts', 'utf8');
for (const token of ['isRecoverableGpuDelegateError', 'visionInferenceErrorMessage', 'UNIMPLEMENTED', 'GPU DELEGATE', 'DEQUANTIZE', 'STRIDED_SLICE', 'SHRINK_AXIS_MASK', 'CALCULATORGRAPH::RUN', 'INFERENCECALCULATOR']) {
  if (!visionDelegateFallback.includes(token)) failures.push(`vision GPU runtime fallback classifier missing: ${token}`);
}
const holisticTracker = readFileSync('src/core/vision/holistic-tracker.ts', 'utf8');
for (const token of ['HolisticLandmarker', 'holistic_landmarker.task', "acquireVisionCamera('holistic')", 'outputFaceBlendshapes', 'readFaceFrame', 'blendshapesReady', 'holisticFaceHealthSnapshot', 'updateFace', 'submitPostprocess', 'VisionPostprocessWorkerClient', 'VisionPerformanceGovernor', 'fallbackHolisticToCpu', 'isRecoverableGpuDelegateError', "activeDelegate === 'GPU'", "createLandmarker('CPU')", 'video.readyState < 2', 'minFaceDetectionConfidence: 0.32', 'minFacePresenceConfidence: 0.32']) {
  if (!holisticTracker.includes(token)) failures.push(`holistic vision runtime missing: ${token}`);
}
const faceFrameGuard = readFileSync('src/core/vision/face-frame-guard.ts', 'utf8');
for (const token of ['normalizeFaceLandmarks', 'blendshapeMap', 'readFaceFrame', 'Blendshapes are an optional enrichment', 'valid >= 100']) {
  if (!faceFrameGuard.includes(token)) failures.push(`face frame recovery guard missing: ${token}`);
}
const faceOverlay = readFileSync('src/presence/FaceMeshOverlay.tsx', 'utf8');
for (const token of ['faceBounds', 'v2-face-lock', 'FACE LOCK']) {
  if (!faceOverlay.includes(token)) failures.push(`face recognition overlay missing: ${token}`);
}
const v2Css = readFileSync('src/ui/v2.css', 'utf8');
const visionCss = readFileSync('src/ui/vision-v2.css', 'utf8');
const resultSurfaceCss = readFileSync('src/ui/result-surface.css', 'utf8');
for (const token of ['.v2-hand-skeleton.depth-aware', '.v2-hand-palm-surface', '.v2-hand-fingertip-halos', '.v2-hand-contact-marker', '.v2-hand-depth-field', '[data-spatial-pressed="true"]']) {
  if (!visionCss.includes(token)) failures.push(`human hand depth CSS missing: ${token}`);
}
for (const token of ['[data-xr-occluded="true"]', '[data-xr-surface="near"]', '[data-xr-surface="touch"]']) {
  if (!visionCss.includes(token)) failures.push(`XR real surface CSS missing: ${token}`);
}
for (const token of ['--xr-window-depth-scale', '--xr-window-bimanual-scale', '--xr-window-yaw', '--xr-window-pitch', '--xr-window-roll', '.v2-xr-spatial-sensor']) {
  if (!visionCss.includes(token)) failures.push(`XR 6DoF window CSS missing: ${token}`);
}
for (const token of ['--xr-window-depth-scale', '--xr-window-bimanual-scale', '--xr-window-yaw', '--xr-window-pitch', '--xr-window-roll', '[data-spatial-window="result"][data-xr-surface="touch"]', '[data-spatial-window="result"][data-xr-occluded="true"]']) {
  if (!resultSurfaceCss.includes(token)) failures.push(`XR 6DoF result surface CSS missing: ${token}`);
}
for (const token of ['.v2-actions button.xr-active', '.v2-xr-glyph']) {
  if (!v2Css.includes(token)) failures.push(`WebXR control CSS missing: ${token}`);
}
if (v2Css.includes('.v2-camera-frame') || v2Css.includes('.v2-air-layer')) failures.push('vision/air CSS leaked into initial v2.css');
if (visionCss.includes('.v2-air-layer') || visionCss.includes('.v2-gesture-overlay')) failures.push('dead Air/gesture telemetry CSS must not ship');
for (const token of ['Camera recognition mode', '.v2-face-scan-hint', '.v2-affect-readout', '.v2-affect-follow', '.v2-gaze-readout', '.v2-face-action-feedback']) {
  if (!visionCss.includes(token)) failures.push(`deferred camera recognition CSS missing: ${token}`);
}
for (const token of ['.v2-spatial-input-layer', '.v2-spatial-pointer', '.v2-spatial-window-bar', '.v2-spatial-contact', '.v2-spatial-placement', '[data-spatial-action][data-spatial-focused="true"]', '[data-spatial-contacted="true"]']) {
  if (!visionCss.includes(token)) failures.push(`spatial input CSS missing: ${token}`);
}
for (const token of ['v2-face-panel', 'v2-affect-vector', 'v2-social-awareness', 'v2-environment-awareness', 'v2-spatial-scene']) {
  if (v2.includes(token)) failures.push(`hidden telemetry DOM must not render: ${token}`);
}
const workerClient = readFileSync('src/core/vision/vision-worker-client.ts', 'utf8');
for (const token of ['VisionPostprocessWorkerClient', "new Worker(new URL('./vision-postprocess-worker.ts', import.meta.url)", "type: 'module'", 'postMessage', 'terminate']) {
  if (!workerClient.includes(token)) failures.push(`vision postprocess worker client missing: ${token}`);
}
const workerRuntime = readFileSync('src/core/vision/vision-postprocess-worker.ts', 'utf8');
for (const token of ['VisionWorkerScope', 'derivePosture', 'inferLiteGesture', 'postMessage']) {
  if (!workerRuntime.includes(token)) failures.push(`vision postprocess worker missing: ${token}`);
}
const gazeCalibration = readFileSync('src/intelligence/social/gaze-head-calibration.ts', 'utf8');
for (const token of ['GazeHeadCalibrator', 'READY_SAMPLES = 90', 'gazeXCenter', 'yawCenter', 'localStorage', 'never images or identity embeddings']) {
  if (!gazeCalibration.includes(token)) failures.push(`gaze/head personal calibration missing: ${token}`);
}
const gestureIntent = readFileSync('src/core/vision/gesture-intent.ts', 'utf8');
for (const token of ['GestureIntentTracker', 'victory_hold', 'open_palm_hold', 'pinch_down', 'pinch_up', 'stableMs', 'not human intention']) {
  if (!gestureIntent.includes(token)) failures.push(`temporal gesture intent missing: ${token}`);
}
const environmentModel = readFileSync('src/core/vision/environment-model.ts', 'utf8');
for (const token of ['ObjectTemporalTracker', 'objectIoU', 'inferEnvironment', 'environmentPrompt', "'workspace'", "'rest_area'", "'dining_area'", 'session-local']) {
  if (!environmentModel.includes(token)) failures.push(`environment context model missing: ${token}`);
}
const objectAwareness = readFileSync('src/core/vision/object-awareness.ts', 'utf8');
for (const token of ['ObjectDetector', 'efficientdet_lite0', "acquireVisionCamera('object')", 'scoreThreshold', 'cadenceFromInference', 'ObjectTemporalTracker']) {
  if (!objectAwareness.includes(token)) failures.push(`object awareness runtime missing: ${token}`);
}
const objectOverlay = readFileSync('src/presence/ObjectAwarenessOverlay.tsx', 'utf8');
for (const token of ['TrackedObject', 'v2-object-overlay', 'v2-object-box', 'object.stable', 'selectedId']) {
  if (!objectOverlay.includes(token)) failures.push(`object awareness overlay missing: ${token}`);
}
const spatialSceneGraph = readFileSync('src/core/vision/spatial-scene-graph.ts', 'utf8');
for (const token of ['SpatialSceneGraphTracker', 'left_of', 'right_of', 'near', 'focus_changed', 'people_changed', 'object_moved', 'object_returned', 'object_relocated', 'departures', 'moveCooldown', 'spatialScenePrompt', 'MIRA_VISUAL_TARGET', 'MIRA_VISUAL_POINTER', 'không suy ra ai đã cầm', '320', 'displayBox']) {
  if (!spatialSceneGraph.includes(token)) failures.push(`spatial scene graph missing: ${token}`);
}
const objectInteraction = readFileSync('src/core/vision/object-interaction.ts', 'utf8');
for (const token of ['ObjectInteractionTracker', 'hand_near', 'possible_manipulation', 'possible_reposition', 'objectInteractionPrompt', 'does not prove touch', 'MIRA_OBJECT_INTERACTION']) {
  if (!objectInteraction.includes(token)) failures.push(`object interaction proxy missing: ${token}`);
}
const actionSequence = readFileSync('src/core/vision/action-sequence.ts', 'utf8');
for (const token of ['ActionSequenceTracker', 'hand_approach', 'object_occluded', 'object_reappeared', 'possible_reposition_sequence', 'estimateGlobalMotion', 'cameraMotionGuardUntil', 'identityRebound', 'Math.pow(0.5', 'actionSequencePrompt', 'MIRA_ACTION_SEQUENCE']) {
  if (!actionSequence.includes(token)) failures.push(`action sequence v12 missing: ${token}`);
}
const causalActionGraph = readFileSync('src/core/vision/causal-action-graph.ts', 'utf8');
for (const token of ['CausalActionGraphTracker', 'competingCount', 'identity_rebind', 'detector_return', 'hand_withdraw', 'margin >= 0.08', 'Math.pow(0.5', 'causalActionGraphPrompt', 'MIRA_CAUSAL_ACTION_GRAPH', 'Temporal order']) {
  if (!causalActionGraph.includes(token)) failures.push(`causal action graph v13 missing: ${token}`);
}
const worldModel = readFileSync('src/core/vision/world-model.ts', 'utf8');
for (const token of ['ShortTermWorldModelTracker', 'version: 14', "'temporarily_missing'", 'MISSING_TTL_MS = 30_000', 'CONFIDENCE_HALF_LIFE_MS = 9_000', 'MAX_WORLD_OBJECTS = 32', 'MAX_PROCESSED_SCENE_EVENTS = 128', 'enforceMemoryBudget', 'markSceneEventProcessed', 'Math.pow(0.5', 'worldModelPrompt', 'MIRA_WORLD_MODEL', 'conservative same-label hypothesis', 'RAM-only']) {
  if (!worldModel.includes(token)) failures.push(`world model v14 missing: ${token}`);
}
const spatialUiControl = readFileSync('src/core/vision/spatial-ui-control.ts', 'utf8');
for (const token of ['SpatialUIController', 'faceSpatialPoint', 'handSpatialPoint', "'grab_start'", "'grab_move'", "'grab_end'", 'visionOS-style indirect input', 'Direct hand pointing']) {
  if (!spatialUiControl.includes(token)) failures.push(`spatial UI control missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialUiControl)) failures.push('spatial UI control state must remain session-only');
const spatialRay = readFileSync('src/core/vision/spatial-ray.ts', 'utf8');
for (const token of ['handRayFromLandmarks', 'hitTestSpatialRay', 'SpatialDepthAnchorTracker', 'DEPTH_READY_SAMPLES = 6', 'DEPTH_DEAD_ZONE', 'relative hand-z signal', 'not metric world-space tracking']) {
  if (!spatialRay.includes(token)) failures.push(`spatial ray/depth runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialRay)) failures.push('spatial ray/depth state must remain session-only');
const spatialAnchor = readFileSync('src/core/vision/spatial-anchor.ts', 'utf8');
for (const token of ['SpatialDirectTouchTracker', 'SpatialAnchorVolume', 'hitTestSpatialPoint', 'spatialAnchorFromRect', 'CONTACT_DWELL_MS = 90', 'MIN_TOUCH_CONFIDENCE = 0.58', 'not proof of physical touch', 'requires pinch']) {
  if (!spatialAnchor.includes(token)) failures.push(`spatial anchor/direct touch missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialAnchor)) failures.push('spatial anchor/direct touch state must remain session-only');
const spatialObject = readFileSync('src/core/vision/spatial-object.ts', 'utf8');
for (const token of ['SpatialObjectRuntime', 'SpatialObjectPose', 'beginGrab', 'moveGrab', 'applyTransform', 'cancelGrab', 'normalized interaction-space values', 'future WebXR/device adapter']) {
  if (!spatialObject.includes(token)) failures.push(`spatial object runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialObject)) failures.push('spatial object pose must remain session-only');
const spatialWorld = readFileSync('src/core/vision/spatial-world.ts', 'utf8');
for (const token of ['SpatialWorldRuntime', 'SpatialWorldAnchor', 'SpatialPlacementPreview', 'SpatialSurfaceConstraint', 'parentId', 'previewSnapObject', 'magneticStrength', 'snapObject', 'attachObject', 'resolveObjectPose', 'attachmentSnapshot', 'updateAttachmentLocalPose', 'parentObjectId', 'clusterRootObjectId', 'clusterObjectIds', 'wouldCreateAttachmentCycle', 'ownerObjectId', 'acceptsObjectId', 'MAX_PARENT_DEPTH = 8', 'sensor-agnostic', 'WebXR/device world poses']) {
  if (!spatialWorld.includes(token)) failures.push(`spatial world runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialWorld)) failures.push('spatial world anchors must remain session-only');
const spatialPhysics = readFileSync('src/core/vision/spatial-physics.ts', 'utf8');
for (const token of ['SpatialPhysicsRuntime', 'THROW_SPEED_MIN', 'PLACE_MAGNET_STRENGTH', 'LINEAR_DAMPING', 'BOUNDARY_STIFFNESS', 'RESTITUTION', 'applySpatialSpringConstraint', "'inertia'", 'normalized interaction-space units per second', 'not physical']) {
  if (!spatialPhysics.includes(token)) failures.push(`spatial physics runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialPhysics)) failures.push('spatial physics state must remain session-only');
const spatialCollision = readFileSync('src/core/vision/spatial-collision.ts', 'utf8');
for (const token of ['resolveSpatialObjectCollisions', 'SpatialCollisionBody', 'SpatialCollisionContact', 'clusterId', 'a.clusterId && b.clusterId', 'COLLISION_RESTITUTION', 'POSITION_CORRECTION', 'STACK_RELATIVE_SPEED_MAX', 'STACK_LATERAL_FACTOR', 'stackCandidate', 'sphere-proxy collision solver', 'not physical measurements']) {
  if (!spatialCollision.includes(token)) failures.push(`multi-object collision runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialCollision)) failures.push('spatial collision state must remain session-only');
if (localMemoryStore.includes('SpatialCollisionContact') || localMemoryStore.includes('stackCandidate')) failures.push('spatial collision state must remain ephemeral, not long-term memory');
const spatialJoint = readFileSync('src/core/vision/spatial-joint.ts', 'utf8');
for (const token of ['SpatialJointRuntime', 'SpatialJointKind', "'fixed'", "'hinge'", "'slider'", 'constrainLocalPose', 'findForChild', 'removeForChild', 'normalized interaction coordinates', 'not physical meters']) {
  if (!spatialJoint.includes(token)) failures.push(`spatial joint runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialJoint)) failures.push('spatial joint state must remain session-only');
if (localMemoryStore.includes('SpatialJointState') || localMemoryStore.includes('spatialJoint')) failures.push('spatial joint state must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('SpatialHandKinematicsState') || localMemoryStore.includes('SpatialHandContactState') || localMemoryStore.includes('SpatialHandIntentState')) failures.push('hand contact state must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('XRSurfaceProbe') || localMemoryStore.includes('XRDepthFrameSample') || localMemoryStore.includes('WebXRAnchorSample')) failures.push('XR real-world depth/anchor state must remain ephemeral, not long-term memory');
const spatialLayout = readFileSync('src/core/vision/spatial-layout.ts', 'utf8');
for (const token of ['SpatialSessionLayoutRuntime', 'SpatialSelectionRuntime', 'MAX_LAYOUT_OBJECTS = 32', 'MAX_SELECTED_CLUSTERS = 16', 'spatialSessionLayoutRuntime', 'RAM-only layout checkpoint']) {
  if (!spatialLayout.includes(token)) failures.push(`spatial session layout missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialLayout)) failures.push('spatial session layout must stay RAM-only');

const spatialGroup = readFileSync('src/core/vision/spatial-group.ts', 'utf8');
for (const token of ['beginSpatialGroupTransform', 'applySpatialGroupTransform', 'SpatialGroupTransformSession', 'group centroid', 'normalized interaction-space']) {
  if (!spatialGroup.includes(token)) failures.push(`spatial group transform missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialGroup)) failures.push('spatial group transform state must stay session-only');

const spatialDeviceAdapter = readFileSync('src/core/vision/spatial-device-adapter.ts', 'utf8');
for (const token of ['SpatialDeviceAdapterRuntime', "'webcam-relative'", "'webxr-metric'", 'detectWebXR', 'useWebXRSessionFeatures', 'webcamPoint', 'metricPoint', 'immersive-ar']) {
  if (!spatialDeviceAdapter.includes(token)) failures.push(`spatial device adapter missing: ${token}`);
}
const spatialWebXR = readFileSync('src/core/vision/spatial-webxr-session.ts', 'utf8');
for (const token of ['SpatialWebXRSessionRuntime', "requestSession('immersive-ar'", "'hand-tracking'", "'hit-test'", "'anchors'", "'depth-sensing'", 'getJointPose', 'requestHitTestSource', 'getDepthInformation', 'requestAnchorAtCurrentHit', 'createAnchor', 'trackedAnchors', 'requestPersistentHandle', "usagePreference: ['cpu-optimized']", 'PINCH_DISTANCE_M = 0.028', 'never', 'auto-opens immersive XR']) {
  if (!spatialWebXR.includes(token)) failures.push(`real WebXR session runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialWebXR)) failures.push('WebXR live sensor state must remain session-only');
const spatialXRProjection = readFileSync('src/core/vision/spatial-xr-projection.ts', 'utf8');
for (const token of ['SpatialXRProjectionRuntime', 'projectMetricPointToView', 'projectMetricPointAcrossViews', 'viewMatrix', 'projectionMatrix', 'calibrateCenter', 'authoritative perspective transform', 'never invents metric depth']) {
  if (!spatialXRProjection.includes(token)) failures.push(`XR projection runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialXRProjection)) failures.push('XR projection calibration must remain session-only');
const spatialXRSurface = readFileSync('src/core/vision/spatial-xr-surface.ts', 'utf8');
for (const token of ['SpatialXRSurfaceRuntime', 'probeXRSurface', 'nearestXRDepth', 'reconstructXRSurfacePatches', 'NEAR_SURFACE_M', 'TOUCH_SURFACE_M', 'OCCLUSION_EPSILON_M', 'not a full room mesh']) {
  if (!spatialXRSurface.includes(token)) failures.push(`XR real surface runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialXRSurface)) failures.push('XR depth surface state must remain session-only');
const spatialXRManipulation = readFileSync('src/core/vision/spatial-xr-manipulation.ts', 'utf8');
for (const token of ['SpatialXRMetricManipulationRuntime', 'normalizedDepthDelta', 'visualScaleRatio', 'constrainedToSurface', 'Metric values stay metric here', 'only the returned', 'normalizedDepthDelta crosses into SpatialObjectRuntime']) {
  if (!spatialXRManipulation.includes(token)) failures.push(`XR metric manipulation missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialXRManipulation)) failures.push('XR metric manipulation state must remain session-only');
const spatialXRBimanual = readFileSync('src/core/vision/spatial-xr-bimanual.ts', 'utf8');
for (const token of ['SpatialXRBimanualRuntime', 'XRBimanualTransform', 'metricCenterDelta', 'yawDeg', 'pitchDeg', 'rollDeg', 'MIN_PAIR_DISTANCE_M', 'commitExternal', 'Session-only two-hand metric XR transform layer', 'never writes metric coordinates into', 'SpatialObjectRuntime']) {
  if (!spatialXRBimanual.includes(token)) failures.push(`XR bimanual transform missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialXRBimanual)) failures.push('XR bimanual transform must remain session-only');
if (localMemoryStore.includes('XRBimanualTransform') || localMemoryStore.includes('metricCenterDelta')) failures.push('XR bimanual metric state must remain ephemeral, not long-term memory');
const spatialXRRigidBody = readFileSync('src/core/vision/spatial-xr-rigid-body.ts', 'utf8');
for (const token of ['SpatialXRRigidBodyRuntime', 'SpatialXRHandCollisionRuntime', 'XRRigidRelease', 'linearVelocity', 'angularVelocity', 'LINEAR_THROW_MIN', 'ANGULAR_THROW_MIN', 'ANGULAR_DAMPING', 'COLLISION_COOLDOWN_MS', 'interaction feel, not measured force', 'only a normalized interaction-space release velocity crosses into', 'SpatialPhysicsRuntime']) {
  if (!spatialXRRigidBody.includes(token)) failures.push(`XR rigid-body runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialXRRigidBody)) failures.push('XR rigid-body/contact state must remain session-only');
if (localMemoryStore.includes('XRRigidRelease') || localMemoryStore.includes('XRHandCollisionImpulse')) failures.push('XR rigid-body/contact state must remain ephemeral, not long-term memory');
const spatialHandKinematics = readFileSync('src/core/vision/spatial-hand-kinematics.ts', 'utf8');
for (const token of ['SpatialHandKinematicsTracker', 'pinchRatio', 'palmNormal', 'pointingConfidence', 'contactRadius', 'world-shape', 'mirrorSpatialHandKinematicsX']) {
  if (!spatialHandKinematics.includes(token)) failures.push(`human hand kinematics missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialHandKinematics)) failures.push('hand kinematics must remain session-only');

const spatialHandContact = readFileSync('src/core/vision/spatial-hand-contact.ts', 'utf8');
for (const token of ['SpatialHandContactRuntime', "'approach'", "'hover'", "'contact'", "'press'", "'grab'", 'pressure', 'not physical force', 'CONTACT_DWELL_MS']) {
  if (!spatialHandContact.includes(token)) failures.push(`human hand contact runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialHandContact)) failures.push('hand contact must remain session-only');

const spatialHandIntent = readFileSync('src/core/vision/spatial-hand-intent.ts', 'utf8');
for (const token of ['SpatialHandIntentRuntime', "'point'", "'touch'", "'press'", "'grab'", "'drag'", "'release'", "'push'", "'pull'", "'swipe_left'", "'rotate_cw'"]) {
  if (!spatialHandIntent.includes(token)) failures.push(`human hand intent runtime missing: ${token}`);
}
if (/localStorage|sessionStorage|indexedDB/.test(spatialHandIntent)) failures.push('hand intent must remain session-only');

const spatialXRHandBridge = readFileSync('src/core/vision/spatial-xr-hand-bridge.ts', 'utf8');
for (const token of ['bridgeXRHandTo21', 'JOINTS_21', 'metric XR', 'never re-labelled']) {
  if (!spatialXRHandBridge.includes(token)) failures.push(`XR hand bridge missing: ${token}`);
}
const spatialControlOverlay = readFileSync('src/presence/SpatialControlOverlay.tsx', 'utf8');
for (const token of ['v2-spatial-input-layer', 'source-', 'locked', 'grabbing', 'placementPreview', 'v2-spatial-placement']) {
  if (!spatialControlOverlay.includes(token)) failures.push(`spatial control overlay missing: ${token}`);
}
const spatialOverlay = readFileSync('src/presence/SpatialSceneOverlay.tsx', 'utf8');
for (const token of ['SpatialSceneGraph', 'v2-spatial-overlay', 'v2-spatial-focus-label', 'TARGET']) {
  if (!spatialOverlay.includes(token)) failures.push(`spatial scene overlay missing: ${token}`);
}
const deicticVision = readFileSync('src/intelligence/vision/deictic-vision.ts', 'utf8');
for (const token of ['isDeicticObjectQuestion', 'extractVisualTarget', 'deicticVisualReply', 'MIRA_VISUAL_TARGET', 'MIRA_VISUAL_POINTER', 'chưa khóa được']) {
  if (!deicticVision.includes(token)) failures.push(`deictic visual bridge missing: ${token}`);
}
const postureTracker = readFileSync('src/core/vision/posture-tracker.ts', 'utf8');
for (const token of ['PoseLandmarker', 'pose_landmarker_lite', "acquireVisionCamera('pose')", 'motionEma', 'fallbackPostureToCpu', 'isRecoverableGpuDelegateError', "activeDelegate === 'GPU'", "createPostureLandmarker('CPU')"]) {
  if (!postureTracker.includes(token)) failures.push(`posture runtime missing: ${token}`);
}
const rppgSignal = readFileSync('src/core/vision/rppg-signal.ts', 'utf8');
for (const token of ['estimatePulseFromSamples', 'CHROM-style', '45', '180', 'must not be used for diagnosis']) {
  if (!rppgSignal.includes(token)) failures.push(`rPPG signal estimator missing: ${token}`);
}
const rppgMonitor = readFileSync('src/core/vision/rppg-monitor.ts', 'utf8');
for (const token of ['startRppgMonitoring', "acquireVisionCamera('rppg')", 'relativeActivation', 'sampleSkin', 'baselineBpm']) {
  if (!rppgMonitor.includes(token)) failures.push(`rPPG runtime missing: ${token}`);
}
const faceTracker = readFileSync('src/core/face/face-tracker.ts', 'utf8');
for (const token of ['faceLandmarks', 'emotionConfidence', 'headGesture', 'faceGesture', 'faceGestureConfidence', 'actionUnits', 'microExpression', 'MicroExpressionTracker', 'facsProxyFromBlendshapes', 'muscles', 'gazeX', 'fallbackFaceToCpu', 'isRecoverableGpuDelegateError', "activeDelegate === 'GPU'", "createFaceLandmarker('CPU')"]) {
  if (!faceTracker.includes(token)) failures.push(`face landmark/affect runtime missing: ${token}`);
}
const gestureTracker = readFileSync('src/core/face/gesture-tracker.ts', 'utf8');
for (const token of ['GestureRecognizer', 'fallbackGestureToCpu', 'isRecoverableGpuDelegateError', "activeDelegate === 'GPU'", "createGestureRecognizer('CPU')"]) {
  if (!gestureTracker.includes(token)) failures.push(`gesture runtime fallback missing: ${token}`);
}
const presenceContinuity = readFileSync('src/intelligence/social/presence-continuity.ts', 'utf8');
for (const token of ['PresenceContinuityTracker', 'presenceContinuityPrompt', 'session-local', "'reconnect'", "'quiet'"]) {
  if (!presenceContinuity.includes(token)) failures.push(`presence continuity missing: ${token}`);
}
if (/localStorage|indexedDB|sessionStorage/.test(presenceContinuity)) failures.push('presence continuity must remain RAM-only');
const faceSocialControl = readFileSync('src/intelligence/social/face-social-control.ts', 'utf8');
for (const token of ['FaceSocialControlTracker', 'toggle_affect', 'cycle_theme', 'gazePresenceLabel', 'release and cooldown']) {
  if (!faceSocialControl.includes(token)) failures.push(`face social control missing: ${token}`);
}
const interactionEngine = readFileSync('src/intelligence/social/interaction-engine.ts', 'utf8');
for (const token of ['InteractionTracker', 'Joint-attention proxy', 'looking_away', 'returning', 'eyeContact', 'headAlignment', 'interactionPrompt']) {
  if (!interactionEngine.includes(token)) failures.push(`social interaction engine missing: ${token}`);
}
const behaviorTimeline = readFileSync('src/intelligence/social/behavior-timeline.ts', 'utf8');
for (const token of ['BehaviorTimeline', 'attention', 'micro', 'posture', 'gesture', 'proximity', 'environment', 'environmentConfidence', 'spatial', 'spatialTarget', 'object_interaction', 'objectInteractionStage', 'action_sequence', 'actionSequenceStage', 'causal_action', 'causalActionLabel', 'promptSummary', '90_000']) {
  if (!behaviorTimeline.includes(token)) failures.push(`behavior timeline missing: ${token}`);
}
const affectControl = readFileSync('src/intelligence/affect/affect-control.ts', 'utf8');
for (const token of ['describeAffectSignal', 'resolveFaceControlAction', "'listen'", "'interrupt'", 'faceConfidence']) {
  if (!affectControl.includes(token)) failures.push(`affect/face control policy missing: ${token}`);
}
const affectEngine = readFileSync('src/intelligence/affect/mood-engine.ts', 'utf8');
for (const token of ['AffectDimensions', 'InteractionAffectContext', 'interaction?: InteractionAffectContext', 'valence', 'arousal', 'engagement', 'baselineReady', 'BASELINE_KEY', 'voicePitchVar', 'PostureAffectSample', 'PhysiologyAffectSample', 'microExpression', 'physiologyQuality']) {
  if (!affectEngine.includes(token)) failures.push(`Affect Engine v2 missing: ${token}`);
}
const audioLevelSource = readFileSync('src/core/audio-level.ts', 'utf8');
for (const token of ['MicProsodySnapshot', 'micProsodySnapshot', 'estimatePitchHz', 'pitchVariability', 'silenceRatio']) {
  if (!audioLevelSource.includes(token)) failures.push(`mic prosody layer missing: ${token}`);
}
const proactiveEngine = readFileSync('src/intelligence/proactive/proactive-engine.ts', 'utf8');
for (const token of ["interaction?.state === 'absent'", "interaction?.state === 'looking_away'", 'lastAwayMs >= 90_000']) {
  if (!proactiveEngine.includes(token)) failures.push(`social-aware proactive policy missing: ${token}`);
}
const visionRuntime = readFileSync('src/presence/vision-runtime.ts', 'utf8');
for (const token of ['startHolisticTracking', 'holisticTrackerActive', 'holisticFaceHealthSnapshot', 'faceRuntime', 'startObjectAwareness', 'stopObjectAwareness', 'objectAwarenessSnapshot', 'Backward-compatible fallback', 'visionPerformance', 'visionEngine', 'pointerZ', 'pointerRay', 'handRayFromLandmarks']) {
  if (!visionRuntime.includes(token)) failures.push(`vision runtime holistic orchestration missing: ${token}`);
}
const cameraManager = readFileSync('src/core/vision/camera-manager.ts', 'utf8');
if (!cameraManager.includes("'holistic'")) failures.push('shared camera manager must support holistic consumer');
if (!cameraManager.includes("'object'")) failures.push('shared camera manager must support object-awareness consumer');
const prompt = readFileSync('src/core/brain/prompt.ts', 'utf8');
if (/trợ lý[^\n]{0,80}sản phẩm\s+Soi/i.test(prompt)) failures.push('Mira core persona must not be hardcoded to Soi');

if (existsSync('src/avatar/MiraOrb.tsx')) failures.push('unused production MiraOrb.tsx should not be present');
if (existsSync('.idea/workspace.xml')) failures.push('IDE workspace state must not be committed');

const machine = readFileSync('src/runtime/conversation-machine.ts', 'utf8');
for (const state of ['idle', 'listening', 'thinking', 'speaking', 'interrupted', 'error']) {
  if (!machine.includes(`${state}:`)) failures.push(`conversation machine missing state: ${state}`);
}

if (failures.length) {
  console.error('\nMira architecture guard failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Mira architecture guard passed.');
