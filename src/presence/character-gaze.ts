import type { MiraState } from '../core/types';

/**
 * Mira-original, camera-relative gaze drift. Operates only on an existing
 * approved VRM lookAt rig; does not sample camera/video or request permissions.
 * All offsets are bounded metres in the viewer's local XY plane.
 */
export type GazeOffset = Readonly<{x:number;y:number}>;
const clamp=(value:number,min:number,max:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):min;
const lerp=(a:number,b:number,k:number)=>a+(b-a)*k;
const smooth=(v:number)=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
const hash=(index:number,seed:number):number=>{
  // Fixed analytic sequence. No Math.random, persistent identifier or user data.
  const v=Math.sin((index+1)*12.9898+seed*78.233)*43758.5453;
  return (v-Math.floor(v))*2-1;
};
function fixation(seconds:number):GazeOffset{
  const phase=seconds/3.4;
  const index=Math.floor(phase);
  const fraction=phase-index;
  const blend=smooth(fraction/0.19);
  return {
    x:lerp(hash(index-1,1),hash(index,1),blend),
    y:lerp(hash(index-1,2),hash(index,2),blend),
  };
}

export function createCharacterGaze(){
  let lastTime:number|null=null;
  let x=0,y=0;
  const reset=()=>{lastTime=null;x=0;y=0;};
  const sample=(seconds:number,state:MiraState):GazeOffset=>{
    const time=Number.isFinite(seconds)?Math.max(0,seconds):0;
    // Clamp long suspended-tab gaps: eyes cannot teleport after visibility resume.
    const dt=lastTime===null||time<lastTime?1/60:Math.min(0.08,time-lastTime);
    lastTime=time;
    const focus=fixation(time);
    const thinking=state==='thinking';
    const listening=state==='listening';
    const speaking=state==='speaking';
    // Mostly keep eye contact; thinking briefly shifts gaze, listening settles.
    const amplitude=thinking?0.040:listening?0.014:speaking?0.020:0.010;
    const targetX=(thinking?0.050:0)+amplitude*focus.x;
    const targetY=(thinking?0.022:0)+amplitude*0.55*focus.y;
    const k=1-Math.exp(-dt*3.4);
    x=clamp(x+(targetX-x)*k,-0.095,0.095);
    y=clamp(y+(targetY-y)*k,-0.060,0.060);
    return {x,y};
  };
  return {sample,reset};
}
