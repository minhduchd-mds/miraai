import { cameraConstraintsForProfile, selectCameraProfile, type VisionCameraProfile } from './camera-profile';

// Shared camera lifecycle for Mira vision sensors.
// Multiple consumers (face, gesture, later pose/object detection) reuse one MediaStream
// so enabling a second sensor does not tear down or reopen the webcam.

export type VisionCameraConsumer = 'holistic' | 'face' | 'gesture' | 'pose' | 'rppg' | 'object';

const consumers = new Set<VisionCameraConsumer>();
let stream: MediaStream | null = null;
let video: HTMLVideoElement | null = null;
let startPromise: Promise<HTMLVideoElement> | null = null;
let activeProfile: VisionCameraProfile | null = null;

function streamIsLive(): boolean {
  return !!stream?.getVideoTracks().some((track) => track.readyState === 'live');
}

async function openCamera(): Promise<HTMLVideoElement> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera API is not available in this browser.');
  }

  const profile = selectCameraProfile();
  const constraints = cameraConstraintsForProfile(profile);
  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      ...constraints,
    },
    audio: false,
  });
  activeProfile = profile;

  const v = document.createElement('video');
  v.playsInline = true;
  v.muted = true;
  v.autoplay = true;
  v.srcObject = stream;
  await v.play();
  video = v;
  return v;
}

function closeCamera(): void {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  activeProfile = null;

  if (video) {
    video.pause();
    video.srcObject = null;
    video = null;
  }
}

export async function acquireVisionCamera(consumer: VisionCameraConsumer): Promise<HTMLVideoElement> {
  consumers.add(consumer);

  try {
    if (video && streamIsLive()) return video;

    if (!startPromise) startPromise = openCamera();
    const sharedVideo = await startPromise;
    return sharedVideo;
  } catch (error) {
    consumers.delete(consumer);
    if (!consumers.size) closeCamera();
    throw error;
  } finally {
    startPromise = null;
  }
}

export function releaseVisionCamera(consumer: VisionCameraConsumer): void {
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
