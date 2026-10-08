import type { MiraPresenceScene } from './presence-scene';

const PROFILES: Record<MiraPresenceScene, {
  subjectX: number; subjectY: number; width: number; height: number;
  floorStart: number; nearGain: number;
}> = {
  daytime:       { subjectX: .49, subjectY: .54, width: .35, height: .49, floorStart: .54, nearGain: .45 },
  'welcome-home':{ subjectX: .52, subjectY: .50, width: .33, height: .47, floorStart: .57, nearGain: .48 },
  'home-evening':{ subjectX: .55, subjectY: .51, width: .40, height: .43, floorStart: .52, nearGain: .52 },
  bedtime:       { subjectX: .50, subjectY: .52, width: .31, height: .43, floorStart: .53, nearGain: .58 },
};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:0));
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

/**
 * Author-controlled 2.5D bas-relief for EACH currently shipped still image.
 * Geometric Z displacement yields genuine perspective when the camera moves,
 * but it cannot reveal hidden pixels or reconstruct a second camera view.
 */
export function sceneDepthAt(scene: MiraPresenceScene,u: number,v: number): number {
  const p=PROFILES[scene];
  const x=clamp(u,0,1), y=clamp(v,0,1);
  const ellipse=((x-p.subjectX)/p.width)**2 + ((y-p.subjectY)/p.height)**2;
  const subject=1-smooth(.52,1.48,ellipse);
  const foreground=smooth(p.floorStart,.97,1-y);
  const edgeFade=smooth(0,.07,x)*smooth(0,.07,1-x);
  const imageFar=scene==='bedtime' ? (1-smooth(.40,.85,x))*smooth(.55,.85,y)*.05 : 0;
  return clamp((.14+subject*.39+foreground*p.nearGain+imageFar)*(.73+edgeFade*.27),.08,.96);
}

export function spatialCameraTarget(pointerX: number,pointerY: number,headYaw=0,headPitch=0) {
  return {
    x:clamp(pointerX*.32+headYaw*.10,-.42,.42),
    y:clamp(-pointerY*.19-headPitch*.08,-.26,.26),
  };
}
