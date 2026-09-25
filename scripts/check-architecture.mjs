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
  'src/core/vision/vision-worker-protocol.ts',
  'src/core/vision/vision-postprocess-worker.ts',
  'src/core/vision/vision-worker-client.ts',
  'src/core/vision/gesture-intent.ts',
  'src/intelligence/social/gaze-head-calibration.ts',
  'src/core/vision/environment-model.ts',
  'src/core/vision/object-awareness.ts',
  'src/presence/ObjectAwarenessOverlay.tsx',
  'src/core/vision/rppg-signal.ts',
  'src/core/vision/rppg-monitor.ts',
  'src/presence/PoseSkeletonOverlay.tsx',
  'src/presence/RealPresenceOverlay.tsx',
  'src/presence/real-presence-overlay.css',
  'src/intelligence/affect/mood-engine.ts',
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
  'api/tts.js',
];

for (const path of mustExist) {
  if (!existsSync(path)) failures.push(`missing required file: ${path}`);
}

const entry = readFileSync('src/main.tsx', 'utf8');
if (!entry.includes("./app/AppV2")) failures.push('production entry does not import AppV2');
if (!entry.includes('lazy(() => import(\'./App\'))') && !entry.includes('lazy(() => import("./App"))')) {
  failures.push('Legacy/Labs shell must stay lazy-loaded');
}

const v2 = readFileSync('src/app/AppV2.tsx', 'utf8');
for (const token of ['SplatViewer', 'face-tracker', 'gesture-tracker', 'DevConsole', "../ui/MiraStage", 'PresenceStage', 'Composer', 'VoiceOrb']) {
  if (v2.includes(token)) failures.push(`AppV2 primary surface imports removed/heavy capability: ${token}`);
}
for (const token of ['PhotorealMira', 'SettingsPanel', 'mira.history.slice(-6)', 'contextText={constellationContext}', 'FaceMeshOverlay', 'PoseSkeletonOverlay', 'ObjectAwarenessOverlay', 'RealPresenceOverlay', 'realPresencePose', 'microTelemetry', 'postureTelemetry', 'pulseTelemetry', 'visionPerformanceTelemetry', 'environmentTelemetry', 'environmentPrompt', 'v2-environment-awareness', 'visionPostprocessLabel', 'calibrationTelemetry', 'gestureIntentTelemetry', 'GazeHeadCalibrator', 'GestureIntentTracker', 'HOLISTIC · 553', 'v2-vision-engine', 'v2-social-calibration', 'InteractionTracker', 'BehaviorTimeline', 'interactionTelemetry', 'v2-social-awareness', 'v2-behavior-timeline', 'micProsodySnapshot', 'v2-affect-vector', 'v2-sensor-strip', 'observeAffect', 'enableBackgroundCompanion']) {
  if (!v2.includes(token)) failures.push(`AppV2 missing production surface: ${token}`);
}
if (v2.includes('sendText')) failures.push('voice-only production surface must not expose text composer flow');

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
for (const token of ['audioLevel', 'requestAnimationFrame', '--pm-level', 'MIRA_BEDROOM', 'SCENE_BY_STATE', 'mira-bedroom.webp', 'bedroom-presence', 'pm-wave', 'pm-state-orb']) {
  if (!photoreal.includes(token)) failures.push(`PhotorealMira missing approved bedroom visual/voice behavior: ${token}`);
}
if (photoreal.includes('pm-runtime')) failures.push('PhotorealMira must not render the legacy Mira Core popup');
if (photoreal.includes('pm-character')) failures.push('PhotorealMira must not overlay the old standing character on the bedroom scene');

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
if (!localMemoryStore.includes('navigator.storage.persist')) failures.push('local memory should request persistent browser storage');
if (localMemoryStore.includes('bpmTrend') || localMemoryStore.includes('pulseTrace')) failures.push('experimental physiological estimates must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('BehaviorEvent') || localMemoryStore.includes('behaviorTimeline')) failures.push('social behavior timeline must remain ephemeral, not long-term memory');
if (localMemoryStore.includes('TrackedObject') || localMemoryStore.includes('objectAwareness') || localMemoryStore.includes('EnvironmentContext')) failures.push('environment object tracks must remain ephemeral, not long-term memory');
const realPresence = readFileSync('src/core/vision/real-presence.ts', 'utf8');
for (const token of ['estimateRealPresencePose', 'estimateFaceDistanceM', 'sceneOffsetX', 'sceneScale', 'privacy-preserving']) {
  if (!realPresence.includes(token)) failures.push(`real presence spatial estimator missing: ${token}`);
}
const realPresenceView = readFileSync('src/presence/RealPresenceOverlay.tsx', 'utf8');
for (const token of ['ImageSegmenter', 'selfie_segmenter_landscape', 'segmentForVideo', 'getAsFloat32Array', 'REAL SEAT · LOCKED']) {
  if (!realPresenceView.includes(token)) failures.push(`real presence compositor missing: ${token}`);
}
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
const holisticTracker = readFileSync('src/core/vision/holistic-tracker.ts', 'utf8');
for (const token of ['HolisticLandmarker', 'holistic_landmarker.task', "acquireVisionCamera('holistic')", 'outputFaceBlendshapes', 'updateFace', 'submitPostprocess', 'VisionPostprocessWorkerClient', 'VisionPerformanceGovernor']) {
  if (!holisticTracker.includes(token)) failures.push(`holistic vision runtime missing: ${token}`);
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
for (const token of ['TrackedObject', 'v2-object-overlay', 'v2-object-box', 'object.stable']) {
  if (!objectOverlay.includes(token)) failures.push(`object awareness overlay missing: ${token}`);
}
const postureTracker = readFileSync('src/core/vision/posture-tracker.ts', 'utf8');
for (const token of ['PoseLandmarker', 'pose_landmarker_lite', "acquireVisionCamera('pose')", 'motionEma']) {
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
for (const token of ['faceLandmarks', 'emotionConfidence', 'headGesture', 'faceGesture', 'faceGestureConfidence', 'actionUnits', 'microExpression', 'MicroExpressionTracker', 'facsProxyFromBlendshapes', 'muscles', 'gazeX']) {
  if (!faceTracker.includes(token)) failures.push(`face landmark/affect runtime missing: ${token}`);
}
const interactionEngine = readFileSync('src/intelligence/social/interaction-engine.ts', 'utf8');
for (const token of ['InteractionTracker', 'Joint-attention proxy', 'looking_away', 'returning', 'eyeContact', 'headAlignment', 'interactionPrompt']) {
  if (!interactionEngine.includes(token)) failures.push(`social interaction engine missing: ${token}`);
}
const behaviorTimeline = readFileSync('src/intelligence/social/behavior-timeline.ts', 'utf8');
for (const token of ['BehaviorTimeline', 'attention', 'micro', 'posture', 'gesture', 'proximity', 'environment', 'environmentConfidence', 'promptSummary', '90_000']) {
  if (!behaviorTimeline.includes(token)) failures.push(`behavior timeline missing: ${token}`);
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
for (const token of ["interaction?.state === 'absent'", "interaction?.state === 'looking_away'", 'lastAwayMs >= 15_000']) {
  if (!proactiveEngine.includes(token)) failures.push(`social-aware proactive policy missing: ${token}`);
}
const visionRuntime = readFileSync('src/presence/vision-runtime.ts', 'utf8');
for (const token of ['startHolisticTracking', 'holisticTrackerActive', 'startObjectAwareness', 'stopObjectAwareness', 'objectAwarenessSnapshot', 'Backward-compatible fallback', 'visionPerformance', 'visionEngine']) {
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
