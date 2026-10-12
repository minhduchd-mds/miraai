/**
 * Read-only gesture steering for the rendered Mira 3D room.
 * Never invokes application actions, OS commands, microphones or network calls.
 * Authorize only fresh, continuous camera frames after a 240ms hold.
 */
export type RoomGestureHand = {
  handedness?: string;
  gesture?: string;
  pinching?: boolean;
  score?: number;
  pointerX?: number;
  pointerY?: number;
};
export type RoomGestureInput = {
  hands: readonly RoomGestureHand[];
  now: number;
  frameAt: number;
  enabled: boolean;
};
export type RoomGestureMotion = {
  mode: 'rotate' | 'zoom';
  yawDelta: number;
  pitchDelta: number;
  zoomFactor: number;
};
type Point = { x: number; y: number };
const clamp = (v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const valid = (h:RoomGestureHand):h is RoomGestureHand & {pointerX:number;pointerY:number} =>
  Number.isFinite(h?.pointerX) && Number.isFinite(h?.pointerY) &&
  Number(h.pointerX)>=0 && Number(h.pointerX)<=1 &&
  Number(h.pointerY)>=0 && Number(h.pointerY)<=1 &&
  Number.isFinite(h.score) && Number(h.score)>=0.75;
const point=(h:RoomGestureHand):Point=>({x:Number(h.pointerX),y:Number(h.pointerY)});
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const quiet=(v:number)=>Math.abs(v)<.003?0:v;

/** One open palm rotates; two stable pinched hands change camera distance. */
export class RoomGestureOrbit {
  private mode:''|'rotate'|'zoom'='';
  private key='';
  private since=0;
  private lastFrameAt=-Infinity;
  private previous:Point[]=[];
  private smoothed:Point[]=[];
  private filteredYaw=0;
  private filteredPitch=0;
  reset():void {
    this.mode='';this.key='';this.since=0;this.lastFrameAt=-Infinity;
    this.previous=[];this.smoothed=[];this.filteredYaw=0;this.filteredPitch=0;
  }
  update({hands,now,frameAt,enabled}:RoomGestureInput):RoomGestureMotion|null {
    if (!enabled || !Number.isFinite(now) || !Number.isFinite(frameAt) ||
        frameAt<=0 || frameAt>now || now-frameAt>350 || !Array.isArray(hands)) {
      this.reset();return null;
    }
    if(frameAt===this.lastFrameAt)return null; // polling != a new camera frame
    if(frameAt<this.lastFrameAt || frameAt-this.lastFrameAt>380)this.reset();
    const reliable=hands.filter(valid);
    let mode:''|'rotate'|'zoom'='';
    let key='';
    let points:Point[]=[];
    if (hands.length===1 && reliable.length===1 &&
        !reliable[0].pinching && reliable[0].gesture==='Open_Palm') {
      mode='rotate';
      key='rotate:'+String(reliable[0].handedness||'Unknown');
      points=[point(reliable[0])];
    } else if(hands.length===2 && reliable.length===2 &&
              reliable.every(h=>h.pinching===true)) {
      const ordered=[...reliable].sort((a,b)=>
        (a.handedness==='Left'?0:1)-(b.handedness==='Left'?0:1));
      if(ordered[0].handedness==='Left' && ordered[1].handedness==='Right'){
        points=ordered.map(point);
        if(distance(points[0],points[1])>=.14){
          mode='zoom';key='zoom:Left|Right';
        }
      }
    }
    if (!mode) {this.reset();return null;}
    const jump=this.previous.length===points.length &&
      points.some((p,i)=>distance(p,this.previous[i])>.13);
    if (this.mode!==mode || this.key!==key || jump){
      this.mode=mode;this.key=key;this.since=frameAt;
      this.previous=points;this.smoothed=points;
      this.filteredYaw=0;this.filteredPitch=0;this.lastFrameAt=frameAt;
      return null;
    }
    this.lastFrameAt=frameAt;
    // Never accumulate dwell on a repeated observation. Motion starts after hold.
    if(frameAt-this.since<240){
      this.previous=points;this.smoothed=points;return null;
    }
    const prev=this.smoothed;
    const smooth=points.map((p,i)=>({x:prev[i].x+(p.x-prev[i].x)*.48,
                                    y:prev[i].y+(p.y-prev[i].y)*.48}));
    this.smoothed=smooth;this.previous=points;
    if(mode==='rotate'){
      const dx=clamp(smooth[0].x-prev[0].x,-.045,.045);
      const dy=clamp(smooth[0].y-prev[0].y,-.045,.045);
      // Low-pass inertia applies only while a fresh tracked palm is present.
      this.filteredYaw=.42*(quiet(dx)*2.3)+.58*this.filteredYaw;
      this.filteredPitch=.42*(quiet(dy)*1.55)+.58*this.filteredPitch;
      if(Math.abs(this.filteredYaw)+Math.abs(this.filteredPitch)<.0009)return null;
      return {mode,yawDelta:clamp(this.filteredYaw,-.07,.07),
        pitchDelta:clamp(this.filteredPitch,-.055,.055),zoomFactor:1};
    }
    const prevGap=distance(prev[0],prev[1]);
    const nextGap=distance(smooth[0],smooth[1]);
    if(prevGap<.14 || nextGap<.14)return null;
    const ratio=clamp(nextGap/prevGap,.92,1.08);
    if(Math.abs(ratio-1)<.007)return null;
    return {mode,yawDelta:0,pitchDelta:0,zoomFactor:ratio};
  }
}
