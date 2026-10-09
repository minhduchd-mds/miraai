/**
 * Lightweight spectrum-shaped mouth poses for a rigged 3D avatar.
 * No voice recordings or phoneme recognition. Band ratios are visual
 * heuristics, NOT evidence of Vietnamese phoneme accuracy.
 */
export type SpeechBands=Readonly<{low:number;mid:number;high:number}>;
export type SpeechVisemes=Readonly<{aa:number;ih:number;ou:number;ee:number;oh:number}>;
const clamp=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;

/** Fall back to the original single-jaw pose if no real analyser is running. */
export function visemesForSpeech(jaw:number,bands:SpeechBands|null):SpeechVisemes {
 const open=clamp(jaw);
 if(open===0)return {aa:0,ih:0,ou:0,ee:0,oh:0};
 if(!bands)return {aa:open,ih:0,ou:0,ee:0,oh:0};
 const low=clamp(bands.low),mid=clamp(bands.mid),high=clamp(bands.high);
 const sum=low+mid+high;
 if(sum<.015)return {aa:open,ih:0,ou:0,ee:0,oh:0};
 const l=low/sum,m=mid/sum,h=high/sum;
 return {
  aa:open*(.48+.32*m),
  ih:open*(.11+.25*h),
  ou:open*(.05+.23*l),
  ee:open*.15*h,
  oh:open*(.06+.18*l),
 };
}
