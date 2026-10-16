import type { SpeechVisemes } from './tts-visemes';

/**
 * Attack/release envelope for already measured TTS-driven mouth shapes.
 * Runs in memory only, uses no text/phoneme guesses, speech audio capture,
 * user attributes, networking, or animation content from other products.
 */
const KEYS=['aa','ih','ou','ee','oh'] as const;
const zero=():Record<(typeof KEYS)[number],number>=>({aa:0,ih:0,ou:0,ee:0,oh:0});
const clamp=(v:number)=>Number.isFinite(v)?Math.min(1,Math.max(0,v)):0;

export function createVisemeEnvelope(){
  const values=zero();
  const reset=()=>{for(const key of KEYS)values[key]=0;};
  const update=(target:SpeechVisemes,deltaSeconds:number):SpeechVisemes=>{
    const dt=Number.isFinite(deltaSeconds)?Math.min(0.12,Math.max(0,deltaSeconds)):0;
    for(const key of KEYS){
      const destination=clamp(target[key]);
      const current=values[key];
      // Faster silence release keeps the mouth closed in actual audio pauses.
      const tau=destination<=0.0001?0.035:destination>current?0.065:0.085;
      const alpha=1-Math.exp(-dt/tau);
      values[key]=clamp(current+(destination-current)*alpha);
      if(destination===0&&values[key]<0.0005)values[key]=0;
    }
    return {...values};
  };
  return {update,reset};
}
