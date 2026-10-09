/**
 * Conservative, visual-only companion response to already-running face tracking.
 * This reads neither landmarks nor images and must never start a camera.
 * Face emotions are uncertain classifier outputs, not diagnoses.
 */
export type ObservedFace=Readonly<{
 active:boolean;present:boolean;emotion:string;emotionConfidence:number;
 smile:number;
}>;
export type CompanionReaction=Readonly<{smile:number;headTilt:number}>;

const clamp=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
const NEUTRAL:CompanionReaction=Object.freeze({smile:0,headTilt:0});

/** Small, bounded gestures require a visible and confidently detected face. */
export function companionReaction(face:ObservedFace|null):CompanionReaction{
 if(!face?.active||!face.present)return NEUTRAL;
 const confidence=clamp(face.emotionConfidence);
 if(confidence<.5)return NEUTRAL;
 switch(face.emotion){
  case 'happy':
   return {smile:Math.min(.22,.06+.16*clamp(face.smile)),headTilt:-.024};
  case 'surprised':
   return {smile:.035,headTilt:.021};
  case 'sad':
  case 'tired':
   return {smile:0,headTilt:.035};
  default:
   return NEUTRAL;
 }
}
