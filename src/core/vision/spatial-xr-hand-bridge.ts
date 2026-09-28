import type { WebXRHandSample, WebXRJointSample } from './spatial-webxr-session';

export interface XRHandBridgePoint {
  x: number;
  y: number;
  z: number;
}

export interface XRHandBridgeResult {
  handedness: string;
  worldLandmarks: XRHandBridgePoint[];
  complete: boolean;
}

const JOINTS_21: string[][] = [
  ['wrist'],
  ['thumb-metacarpal'],
  ['thumb-phalanx-proximal'],
  ['thumb-phalanx-distal'],
  ['thumb-tip'],
  ['index-finger-metacarpal', 'index-finger-phalanx-proximal'],
  ['index-finger-phalanx-proximal'],
  ['index-finger-phalanx-distal', 'index-finger-phalanx-intermediate'],
  ['index-finger-tip'],
  ['middle-finger-metacarpal', 'middle-finger-phalanx-proximal'],
  ['middle-finger-phalanx-proximal'],
  ['middle-finger-phalanx-distal', 'middle-finger-phalanx-intermediate'],
  ['middle-finger-tip'],
  ['ring-finger-metacarpal', 'ring-finger-phalanx-proximal'],
  ['ring-finger-phalanx-proximal'],
  ['ring-finger-phalanx-distal', 'ring-finger-phalanx-intermediate'],
  ['ring-finger-tip'],
  ['pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal'],
  ['pinky-finger-phalanx-proximal'],
  ['pinky-finger-phalanx-distal', 'pinky-finger-phalanx-intermediate'],
  ['pinky-finger-tip'],
];

function point(joint: WebXRJointSample | undefined): XRHandBridgePoint {
  return {
    x: Number(joint?.x || 0),
    y: Number(joint?.y || 0),
    z: Number(joint?.z || 0),
  };
}

/**
 * Maps WebXR named joints into Mira's MediaPipe-compatible 21-point topology.
 * The mapping is only a topology bridge; source coordinates remain metric XR
 * local-space coordinates and are never re-labelled as webcam world position.
 */
export function bridgeXRHandTo21(hand: WebXRHandSample): XRHandBridgeResult {
  const byName = new Map(hand.joints.map((joint) => [joint.name, joint]));
  let resolved = 0;
  let last = hand.wrist || hand.indexTip || hand.thumbTip || hand.joints[0];
  const worldLandmarks = JOINTS_21.map((candidates) => {
    const joint = candidates
      .map((name) => byName.get(name))
      .find(Boolean) || last;
    if (joint) {
      resolved += 1;
      last = joint;
    }
    return point(joint);
  });

  return {
    handedness: hand.handedness,
    worldLandmarks,
    complete: resolved >= 18,
  };
}
