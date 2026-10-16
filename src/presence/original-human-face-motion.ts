import type {SpeechVisemes} from './tts-visemes';
import type {GazeOffset} from './character-gaze';

/**
 * Fully original procedural 3D research face controller.
 * Positions are offsets in the authored face's local metres, never camera data.
 * The output is bounded and carries no user data beyond an ephemeral TTS signal.
 */
export type OriginalFacePose=Readonly<{
  closure:number;
  irisX:number;
  irisY:number;
  eyebrowLift:number;
  mouthHeight:number;
  mouthWidth:number;
  smileLift:number;
}>;

const clamp=(v:number,min:number,max:number)=>Number.isFinite(v)?Math.min(max,Math.max(min,v)):min;
const safe01=(v:number)=>clamp(v,0,1);
const finiteTime=(seconds:number)=>Number.isFinite(seconds)?Math.max(0,seconds):0;

/** Extended natural pulse so an 8fps demand-rendered idle frame can depict a blink. */
export function originalBlinkPulse(seconds:number):number {
  const t=finiteTime(seconds);
  const phase=(t/4.16+.013*Math.sin(t*.19)+.031)%1;
  if(phase<.934)return 0;
  if(phase<.955)return safe01((phase-.934)/.021);
  if(phase<.975)return 1;
  return safe01((1-phase)/.025);
}

const INITIAL:OriginalFacePose=Object.freeze({
  closure:0,irisX:0,irisY:0,eyebrowLift:0,
  mouthHeight:.009,mouthWidth:.069,smileLift:0,
});

export function createOriginalFaceController(){
 let value:OriginalFacePose={...INITIAL};
 const reset=()=>{value={...INITIAL};};
 const sample=(input:{
   dt:number;
   seconds:number;
   gaze:GazeOffset;
   visemes:SpeechVisemes;
   smile?:number;
   speaking?:boolean;
 }):OriginalFacePose=>{
  const dt=clamp(input.dt,0,.12);
  const blink=originalBlinkPulse(input.seconds);
  const smile=safe01(input.smile??0);
  const mouth=input.visemes;
  // Sanitized visemes avoid corrupted amplitudes leaking NaNs to Three matrices.
  const aa=safe01(mouth.aa),ih=safe01(mouth.ih),ou=safe01(mouth.ou);
  const ee=safe01(mouth.ee),oh=safe01(mouth.oh);
  const active=Boolean(input.speaking);
  const target:OriginalFacePose={
   closure:blink,
   irisX:clamp(input.gaze.x,-.095,.095)*.18,
   irisY:clamp(input.gaze.y,-.060,.060)*.18,
   eyebrowLift:.009*smile,
   mouthHeight:.009+(active?Math.min(.085,aa*.105+oh*.065+ou*.035):0),
   mouthWidth:clamp(.069+(active?ee*.028+ih*.018-ou*.022-oh*.016:0)+smile*.010,.042,.108),
   smileLift:.010*smile,
  };
  const eyeAlpha=1-Math.exp(-dt/.035);
  const mouthAlpha=1-Math.exp(-dt/.070);
  const lerp=(a:number,b:number,k:number)=>a+(b-a)*k;
  value={
   closure:lerp(value.closure,target.closure,eyeAlpha),
   irisX:lerp(value.irisX,target.irisX,mouthAlpha),
   irisY:lerp(value.irisY,target.irisY,mouthAlpha),
   eyebrowLift:lerp(value.eyebrowLift,target.eyebrowLift,mouthAlpha),
   mouthHeight:lerp(value.mouthHeight,target.mouthHeight,mouthAlpha),
   mouthWidth:lerp(value.mouthWidth,target.mouthWidth,mouthAlpha),
   smileLift:lerp(value.smileLift,target.smileLift,mouthAlpha),
  };
  return {...value};
 };
 return {sample,reset};
}
