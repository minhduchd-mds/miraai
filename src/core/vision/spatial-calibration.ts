/**
 * Guided, in-memory camera-controller validation. No pixels, landmarks,
 * identity data or device IDs are retained or uploaded.
 *
 * A successful trial is NOT accuracy/precision: the user explicitly selects
 * the expected gesture and the result requires sustained fresh frames.
 */
export type CalibrationKind = 'left'|'right'|'pinch'|'palm'|'zoom'|'idle';
export interface CalibrationHand {
  handedness?: string;
  gesture?: string;
  pinching?: boolean;
  score?: number;
}
export interface CalibrationFrame {
  at: number;  // timestamp of *inference* frame in performance.now clock
  now: number;
  hands: readonly CalibrationHand[];
}
export interface CalibrationResult {
  kind: CalibrationKind;
  passed: boolean;
  detectedMs: number | null;
  validFrames: number;
  rejectedFrames: number;
  unexpectedFrames: number;
}
export const CALIBRATION_TESTS: readonly {
  kind: CalibrationKind;label: string;instruction: string;durationMs: number;
}[] = [
  {kind:'left',label:'Tay trái',instruction:'Đưa riêng tay trái vào camera, giữ yên.',durationMs:6000},
  {kind:'right',label:'Tay phải',instruction:'Đưa riêng tay phải vào camera, giữ yên.',durationMs:6000},
  {kind:'pinch',label:'Pinch chọn',instruction:'Chụm ngón cái và ngón trỏ của một tay, giữ khoảng 1 giây.',durationMs:6000},
  {kind:'palm',label:'Xòe bàn tay',instruction:'Giữ một lòng bàn tay mở hướng về camera.',durationMs:6000},
  {kind:'zoom',label:'Pinch hai tay',instruction:'Đưa hai tay trái/phải vào camera và cùng chụm ngón.',durationMs:7000},
  {kind:'idle',label:'Không thao tác',instruction:'Không đưa tay vào camera trong 4 giây để phát hiện tín hiệu bất thường.',durationMs:4000},
];

const HOLD_MS = 240;
const MAX_FRAME_AGE_MS = 350;
const MAX_FRAME_GAP_MS = 350;
const clamp = (x:number,a:number,b:number) => Math.max(a,Math.min(b,x));
const valid = (hand:CalibrationHand) =>
  Number.isFinite(hand?.score) && Number(hand.score)>=.75;
function matched(kind:CalibrationKind,hands:readonly CalibrationHand[]):boolean {
  const reliable=hands.filter(valid);
  if(kind==='idle')return reliable.some(h=>h.pinching===true||h.gesture==='Open_Palm');
  if(kind==='left')return reliable.some(h=>h.handedness==='Left');
  if(kind==='right')return reliable.some(h=>h.handedness==='Right');
  if(kind==='pinch')return reliable.some(h=>h.pinching===true);
  if(kind==='palm')return reliable.some(h=>h.gesture==='Open_Palm');
  return reliable.length===2 && reliable.some(h=>h.handedness==='Left'&&h.pinching===true)
    && reliable.some(h=>h.handedness==='Right'&&h.pinching===true);
}
function percentiles(values:number[]) {
  const sorted=[...values].sort((a,b)=>a-b);
  const at=(p:number)=>sorted.length?sorted[Math.ceil(sorted.length*p)-1]:null;
  return {count:sorted.length,p50Ms:at(.5),p95Ms:at(.95)};
}
type ActiveTrial={kind:CalibrationKind;startedAt:number;lastFrameAt:number;
  candidateSince:number;matched:boolean;validFrames:number;rejectedFrames:number;
  unexpectedFrames:number;detectedMs:number|null;};
export class SpatialCalibrationSession {
  private active:ActiveTrial|null=null;
  private readonly finished:CalibrationResult[]=[];
  begin(kind:CalibrationKind,now:number) {
    const spec=CALIBRATION_TESTS.find(t=>t.kind===kind);
    if(!spec || !Number.isFinite(now)||now<0)return false;
    this.active={kind,startedAt:now,lastFrameAt:0,candidateSince:0,matched:false,
      validFrames:0,rejectedFrames:0,unexpectedFrames:0,detectedMs:null};
    return true;
  }
  sample(frame:CalibrationFrame):CalibrationResult|null {
    const t=this.active;
    if(!t || !Number.isFinite(frame.now)||frame.now<t.startedAt)return null;
    const spec=CALIBRATION_TESTS.find(x=>x.kind===t.kind)!;
    if(frame.now - t.startedAt >= spec.durationMs)return this.finish(frame.now);
    if(!Number.isFinite(frame.at)||frame.at<=0||frame.at>frame.now||
       frame.now-frame.at>MAX_FRAME_AGE_MS||frame.at<=t.lastFrameAt ||
       !Array.isArray(frame.hands)){
      t.rejectedFrames++;
      return null;
    }
    const gap=t.lastFrameAt>0?frame.at-t.lastFrameAt:0;
    t.lastFrameAt=frame.at;
    t.validFrames++;
    if(gap>MAX_FRAME_GAP_MS){t.candidateSince=0;t.matched=false;}
    const detected=matched(t.kind,frame.hands);
    if(t.kind==='idle'){
      if(detected)t.unexpectedFrames++;
      return null;
    }
    if(!detected){t.candidateSince=0;t.matched=false;return null;}
    if(!t.matched){t.matched=true;t.candidateSince=frame.at;return null;}
    if(frame.at-t.candidateSince>=HOLD_MS){
      t.detectedMs=Math.round(clamp(frame.now-t.startedAt,0,120000));
      return this.finish(frame.now);
    }
    return null;
  }
  tick(now:number):CalibrationResult|null {
    const t=this.active;
    if(!t || !Number.isFinite(now))return null;
    const spec=CALIBRATION_TESTS.find(x=>x.kind===t.kind)!;
    return now-t.startedAt>=spec.durationMs?this.finish(now):null;
  }
  private finish(_now:number):CalibrationResult {
    const t=this.active!;
    const result:CalibrationResult={kind:t.kind,
      passed:t.kind==='idle'?t.unexpectedFrames===0&&t.validFrames>=3:t.detectedMs!==null,
      detectedMs:t.detectedMs,validFrames:t.validFrames,
      rejectedFrames:t.rejectedFrames,unexpectedFrames:t.unexpectedFrames};
    this.finished.push(result);
    if(this.finished.length>60)this.finished.shift();
    this.active=null;
    return {...result};
  }
  cancel() {this.active=null;}
  reset() {this.active=null;this.finished.length=0;}
  snapshot(now?:number){
    const t=this.active;
    const spec=t?CALIBRATION_TESTS.find(x=>x.kind===t.kind):null;
    const trials=this.finished.map(x=>({...x}));
    const measured=trials.filter(x=>x.passed&&x.detectedMs!==null)
      .map(x=>x.detectedMs as number);
    return {
      active:t?{kind:t.kind,elapsedMs:Math.round(clamp((now??t.startedAt)-t.startedAt,0,120000)),
        durationMs:spec!.durationMs,validFrames:t.validFrames}:null,
      trials,completed:trials.length,passed:trials.filter(x=>x.passed).length,
      passedRatePct:trials.length?Math.round(trials.filter(x=>x.passed).length/trials.length*100):null,
      unexpectedFrames:trials.reduce((sum,x)=>sum+x.unexpectedFrames,0),
      rejectedFrames:trials.reduce((sum,x)=>sum+x.rejectedFrames,0),
      reactionAndRecognition:percentiles(measured),
    };
  }
}
