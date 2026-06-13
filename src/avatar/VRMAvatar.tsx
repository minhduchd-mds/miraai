import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMUtils, VRMLoaderPlugin } from '@pixiv/three-vrm';
import type { MiraState, Mood } from '../core/types';
import { audioLevel } from '../core/audio-level';
import { faceData } from '../core/face/face-tracker';
import { FALLBACK_AVATAR } from '../core/avatar-config';
import { LipSync } from './lipsync';
import { applyHologram } from './hologram';

// Model quay mặt về -Z, camera ở +Z → xoay 180° để quay mặt về camera.
const FACING_Y = Math.PI;

// Lái avatar theo gương mặt webcam (chế độ "gương"). Dấu có thể cần đảo tuỳ camera/thiết bị —
// nếu Mira quay ngược hướng bạn thì đổi dấu yaw/pitch ở đây là xong.
const FACE = { yaw: -1.0, pitch: 1.0, roll: -0.6, headK: 8 };

interface Props {
  url: string;
  stateRef: MutableRefObject<MiraState>;
  moodRef: MutableRefObject<Mood>;
  accent: string;
  onLoaded?: () => void;
  onError?: () => void;
}

// Hạ tay từ T-pose về tư thế nghỉ tự nhiên (VRM không kèm animation idle sẵn).
function relaxPose(vrm: VRM) {
  const h = vrm.humanoid;
  if (!h) return;
  const set = (name: string, x: number, y: number, z: number) => {
    const n = h.getNormalizedBoneNode(name as any);
    if (n) n.rotation.set(x, y, z);
  };
  set('leftUpperArm', 0, 0, 1.2);
  set('rightUpperArm', 0, 0, -1.2);
  set('leftLowerArm', 0, -0.25, 0.1);
  set('rightLowerArm', 0, 0.25, -0.1);
}

// Trộn biểu cảm cảm xúc về mục tiêu theo mood (lerp mượt mỗi frame).
function applyMood(vrm: VRM, mood: Mood, delta: number) {
  const em = vrm.expressionManager;
  if (!em) return;
  const target: Record<string, number> = { happy: 0, relaxed: 0, sad: 0, surprised: 0, angry: 0 };
  if (mood === 'happy') target.happy = 0.6;
  else if (mood === 'curious' || mood === 'thinking') target.relaxed = 0.5;
  else if (mood === 'surprised') target.surprised = 0.6;
  const k = Math.min(1, delta * 4);
  for (const name of Object.keys(target)) {
    const cur = em.getValue(name) ?? 0;
    em.setValue(name, cur + (target[name] - cur) * k);
  }
}

export default function VRMAvatar({ url, stateRef, moodRef, accent, onLoaded, onError }: Props) {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const facingRef = useRef(FACING_Y); // VRM0 (nữ) quay π; VRM1 (nam) quay 0 để cùng hướng camera
  const vrm1Ref = useRef(false); // model VRM1 (nam) → hologram nhẹ (đặc, không tint mặt)
  const lip = useRef(new LipSync());
  const clock = useRef(0);
  const blink = useRef({ t: 0, next: 2 + Math.random() * 3, prog: -1 });
  const talk = useRef({ timer: 0, target: 0 });

  // ── Nhìn theo chuột: mắt (lookAt VRM) + đầu xoay nhẹ ──
  const lookTargetRef = useRef<THREE.Object3D | null>(null);
  if (!lookTargetRef.current) {
    lookTargetRef.current = new THREE.Object3D();
    lookTargetRef.current.position.set(0, 1.35, 2.4); // mặc định: nhìn thẳng người xem
  }
  const pointerRef = useRef({ x: 0, y: 0 });
  const headRotRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // Nạp VRM (đăng ký VRMLoaderPlugin + dọn dẹp + sửa hướng VRM0).
  useEffect(() => {
    let disposed = false;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const onSuccess = (gltf: any) => {
      const v = gltf.userData.vrm as VRM;
      VRMUtils.combineSkeletons(gltf.scene);
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      // Model VRM0 này quay mặt sẵn về +Z (đúng hướng camera) → KHÔNG gọi rotateVRM0.
      v.scene.traverse((o) => (o.frustumCulled = false));
      if (disposed) {
        VRMUtils.deepDispose(v.scene);
        return;
      }
      relaxPose(v); // hạ tay khỏi T-pose
      if (import.meta.env.DEV) (window as any).__vrm = v; // debug 3D trong dev
      // VRM1 (nam) khác VRM0 (nữ): hướng mặt ngược + tên material khác (tránh xanh mặt) → dùng hologram nhẹ.
      const isV1 = (v.meta as { metaVersion?: string } | undefined)?.metaVersion === '1';
      vrm1Ref.current = isV1;
      facingRef.current = isV1 ? 0 : Math.PI;
      applyHologram(v.scene, accent, { gentle: isV1 });
      if (v.lookAt) v.lookAt.target = lookTargetRef.current; // mắt nhìn theo target
      vrmRef.current = v;
      setVrm(v);
      onLoaded?.();
    };

    // Bộ chưa có model riêng (404/ lỗi) → tự lùi về model idol mặc định; idol cũng lỗi → fallback 2D.
    loader.load(url, onSuccess, undefined, (err) => {
      if (disposed) return;
      if (url !== FALLBACK_AVATAR) {
        console.warn('[Mira VRM] chưa có model cho bộ này → dùng idol mặc định.', url);
        loader.load(FALLBACK_AVATAR, onSuccess, undefined, (e2) => {
          console.warn('[Mira VRM] load idol mặc định cũng lỗi:', e2);
          if (!disposed) onError?.();
        });
      } else {
        console.warn('[Mira VRM] load failed:', err);
        onError?.();
      }
    });

    return () => {
      disposed = true;
      if (vrmRef.current) VRMUtils.deepDispose(vrmRef.current.scene);
      vrmRef.current = null;
      setVrm(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Đổi theme → nhuộm lại hologram (da/tóc); body + quần áo (_bright) giữ độ sáng cố định.
  useEffect(() => {
    if (vrmRef.current) applyHologram(vrmRef.current.scene, accent, { gentle: vrm1Ref.current });
  }, [accent]);

  useFrame((_, delta) => {
    const v = vrmRef.current;
    if (!v) return;
    const d = Math.min(delta, 0.05); // chặn delta nhảy vọt khi tab vừa active lại
    clock.current += d;
    const st = stateRef.current;
    const faceOn = faceData.active && faceData.present; // webcam đang lái avatar (chế độ gương)

    // Lip-sync: có audio thật (VieNeu/ElevenLabs) → khớp biên độ thật;
    // không có (Web Speech) → envelope âm tiết tổng hợp như cũ.
    talk.current.timer -= d;
    if (st === 'speaking') {
      if (audioLevel.active) {
        talk.current.target = Math.min(1, audioLevel.value * 1.25);
      } else if (talk.current.timer <= 0) {
        talk.current.target = 0.35 + Math.random() * 0.65;
        talk.current.timer = 0.08 + Math.random() * 0.12;
      }
    } else if (faceOn) {
      talk.current.target = Math.min(1, faceData.jaw * 1.3); // không nói → miệng nhép theo bạn
    } else {
      talk.current.target = 0;
    }
    lip.current.update(v, d, talk.current.target);

    // Chớp mắt định kỳ.
    const b = blink.current;
    let blinkVal = 0;
    if (faceOn) {
      blinkVal = (faceData.blinkL + faceData.blinkR) / 2; // chớp mắt theo bạn
    } else if (b.prog >= 0) {
      b.prog += d / 0.16;
      blinkVal = b.prog < 0.5 ? b.prog * 2 : Math.max(0, (1 - b.prog) * 2);
      if (b.prog >= 1) {
        b.prog = -1;
        b.t = 0;
        b.next = 2 + Math.random() * 3.5;
      }
    } else {
      b.t += d;
      if (b.t >= b.next) b.prog = 0;
    }
    v.expressionManager?.setValue('blink', Math.max(0, Math.min(1, blinkVal)));

    // Cảm xúc theo mood + thở nhẹ (bob dọc) + lắc nhẹ khi nghĩ.
    applyMood(v, moodRef.current, d);
    if (faceOn) {
      v.expressionManager?.setValue('happy', faceData.smile); // cười theo bạn
      v.expressionManager?.setValue('surprised', faceData.browUp); // nhướng mày theo bạn
    }
    const breathe = Math.sin(clock.current * 1.1) * 0.006;
    v.scene.position.y = breathe;
    v.scene.rotation.y = facingRef.current + (st === 'thinking' ? Math.sin(clock.current * 1.6) * 0.05 : 0);

    // Đầu/mắt: chế độ GƯƠNG theo webcam nếu đang bật, không thì nhìn theo chuột.
    const lt = lookTargetRef.current!;
    const k = Math.min(1, d * 6);
    const head = v.humanoid?.getNormalizedBoneNode('head' as any);
    if (faceOn) {
      lt.position.x += (0 - lt.position.x) * k; // mắt nhìn thẳng người xem
      lt.position.y += (1.35 - lt.position.y) * k;
      if (head) {
        const hr = headRotRef.current;
        const kh = Math.min(1, d * FACE.headK);
        hr.y += (faceData.yaw * FACE.yaw - hr.y) * kh;
        hr.x += (faceData.pitch * FACE.pitch - hr.x) * kh;
        head.rotation.set(hr.x, hr.y, faceData.roll * FACE.roll);
      }
    } else {
      const p = pointerRef.current;
      lt.position.x += (p.x * 1.6 - lt.position.x) * k;
      lt.position.y += (1.35 + p.y * 0.7 - lt.position.y) * k;
      if (head) {
        const hr = headRotRef.current;
        const kh = Math.min(1, d * 5);
        hr.y += (p.x * 0.3 - hr.y) * kh;
        hr.x += (p.y * 0.18 - hr.x) * kh;
        head.rotation.set(hr.x, hr.y, 0);
      }
    }

    v.update(d); // springbone + lookAt + flush expressions
  });

  return vrm ? (
    <>
      <primitive object={vrm.scene} />
      <primitive object={lookTargetRef.current} />
    </>
  ) : null;
}
