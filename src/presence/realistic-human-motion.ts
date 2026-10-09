import type { MiraState } from '../core/types';

export interface HumanMotionFrame {
  blink: number;
  mouthOpen: number;
  smile: number;
  breathing: number;
  headYaw: number;
  headPitch: number;
}
const clamp=(v:number)=>Math.min(1,Math.max(0,Number.isFinite(v)?v:0));

/** Deterministic, bounded natural micro-movement. No face/voice data is recorded. */
export function humanMotionFrame(seconds:number,state:MiraState):HumanMotionFrame {
  const t=Math.max(0,Number.isFinite(seconds)?seconds:0);
  // Pseudo-irregular blink (~3.6–5.1 s), with a short smooth eyelid pulse.
  const phase=t/4.1+.09*Math.sin(t*.17)+.035*Math.sin(t*.47);
  const f=phase-Math.floor(phase);
  const rise=clamp((f-.935)/.023);
  const fall=clamp((1.006-f)/.032);
  const blink=clamp(Math.min(rise,fall));
  const talking=state==='speaking';
  // Not phoneme-perfect lip sync: amplitude-only fallback while TTS is playing.
  const jaw=talking ? (.14+.23*Math.abs(Math.sin(t*10.7))+.16*Math.abs(Math.sin(t*6.1+.8))) : 0;
  const smile=state==='speaking'?.14:state==='listening'?.10:state==='error'?0:.07;
  const breathing=.0048*Math.sin(t*1.55);
  const headYaw=.018*Math.sin(t*.43+.2);
  const headPitch=.012*Math.sin(t*.61);
  return {blink,mouthOpen:clamp(jaw),smile,breathing,headYaw,headPitch};
}

export function humanMotionCadence(state:MiraState):number {
  // Lower idle GPU load; active speech gets smooth-enough ~20 FPS articulation.
  return state==='speaking'?50:state==='listening'?85:125;
}
