import { cameraConstraintsForProfile, selectCameraProfile, type VisionCameraProfile } from './camera-profile';

// Shared camera lifecycle for Mira vision sensors.
// Multiple consumers (face, gesture, later pose/object detection) reuse one MediaStream
// so enabling a second sensor does not tear down or reopen the webcam.

export type VisionCameraConsumer = 'holistic' | 'face' | 'gesture' | 'pose' | 'rppg' | 'object';

const consumers = new Set<VisionCameraConsumer>();
const consumerLeases = new Map<VisionCameraConsumer, number>();
let stream: MediaStream | null = null;
let video: HTMLVideoElement | null = null;
let startPromise: Promise<HTMLVideoElement> | null = null;
let activeProfile: VisionCameraProfile | null = null;
let lifecycleVersion = 0;

function streamIsLive(): boolean {
  return !!stream?.getVideoTracks().some((track) => track.readyState === 'live');
}

function cameraCancelledError(): Error {
  const error = new Error('Camera acquisition cancelled.');
  error.name = 'AbortError';
  return error;
}

function stopMediaStream(target: MediaStream | null): void {
  target?.getTracks().forEach((track) => {
    try { track.stop(); } catch { /* best-effort cleanup */ }
  });
}

function disposeActiveCamera(): void {
  stopMediaStream(stream);
  stream = null;
  activeProfile = null;

  if (video) {
    try { video.pause(); } catch { /* best-effort cleanup */ }
    video.srcObject = null;
    video = null;
  }
}

function closeCamera(): void {
  // getUserMedia cannot be reliably aborted once permission/opening is in flight.
  // Invalidating the generation makes a late result self-dispose instead of
  // resurrecting the camera after the last consumer has already released it.
  lifecycleVersion += 1;
  startPromise = null;
  disposeActiveCamera();
}

async function openCamera(version: number): Promise<HTMLVideoElement> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera API is not available in this browser.');
  }

  const profile = selectCameraProfile();
  const constraints = cameraConstraintsForProfile(profile);
  const nextStream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      ...constraints,
    },
    audio: false,
  });

  if (version !== lifecycleVersion || !consumers.size) {
    stopMediaStream(nextStream);
    throw cameraCancelledError();
  }

  const v = document.createElement('video');
  v.playsInline = true;
  v.muted = true;
  v.autoplay = true;
  v.srcObject = nextStream;

  try {
    await v.play();
  } catch (error) {
    v.srcObject = null;
    stopMediaStream(nextStream);
    throw error;
  }

  if (version !== lifecycleVersion || !consumers.size) {
    try { v.pause(); } catch { /* best-effort cleanup */ }
    v.srcObject = null;
    stopMediaStream(nextStream);
    throw cameraCancelledError();
  }

  stream = nextStream;
  video = v;
  activeProfile = profile;
  return v;
}

export async function acquireVisionCamera(consumer: VisionCameraConsumer): Promise<HTMLVideoElement> {
  const lease = (consumerLeases.get(consumer) || 0) + 1;
  consumerLeases.set(consumer, lease);
  consumers.add(consumer);

  let pending: Promise<HTMLVideoElement> | null = null;

  try {
    if (video && streamIsLive()) return video;

    // A dead track/video should never survive into the next acquisition.
    if (video || stream) disposeActiveCamera();

    pending = startPromise;
    if (!pending) {
      const version = lifecycleVersion;
      pending = openCamera(version);
      startPromise = pending;
    }

    const sharedVideo = await pending;

    // The same consumer may have been stopped and restarted while getUserMedia
    // was still pending. Only the newest lease is allowed to claim the result.
    if (consumerLeases.get(consumer) !== lease || !consumers.has(consumer)) {
      throw cameraCancelledError();
    }

    return sharedVideo;
  } catch (error) {
    if (consumerLeases.get(consumer) === lease) {
      consumers.delete(consumer);
    }
    if (!consumers.size) closeCamera();
    throw error;
  } finally {
    if (pending && startPromise === pending) startPromise = null;
  }
}

export function releaseVisionCamera(consumer: VisionCameraConsumer): void {
  consumerLeases.set(consumer, (consumerLeases.get(consumer) || 0) + 1);
  consumers.delete(consumer);
  if (!consumers.size) closeCamera();
}

export function getVisionCameraStream(): MediaStream | null {
  return streamIsLive() ? stream : null;
}

export function visionCameraStatus() {
  const track = stream?.getVideoTracks()[0];
  const settings = track?.getSettings?.() || {};
  return {
    active: streamIsLive(),
    consumers: [...consumers],
    profile: activeProfile,
    width: Number(settings.width || video?.videoWidth || 0),
    height: Number(settings.height || video?.videoHeight || 0),
    frameRate: Number(settings.frameRate || 0),
  };
}
