/**
 * v21 session-only numeric diagnostics. Never stores camera frames,
 * landmarks, identity, target names or network payloads.
 */
class RollingLatency {
  private values: number[] = [];
  private cursor = 0;
  add(value: number) {
    if (!Number.isFinite(value) || value < 0) return;
    if (this.values.length < 128) this.values.push(value);
    else { this.values[this.cursor] = value; this.cursor = (this.cursor + 1) % 128; }
  }
  summary() {
    const sorted = [...this.values].sort((a,b)=>a-b);
    const percentile = (p:number) => sorted.length ? sorted[Math.ceil((sorted.length-1)*p)] : 0;
    const round = (v:number) => Math.round(v*10)/10;
    return { count:sorted.length, p50Ms:round(percentile(.5)), p95Ms:round(percentile(.95)),
      maxMs:round(sorted[sorted.length - 1] || 0) };
  }
  reset() { this.values = []; this.cursor = 0; }
}
export class SpatialPerformanceProfiler {
  private lastFrameAt = 0;
  private uniqueHandFrames = 0;
  private repeatedUiPolls = 0;
  private noHandPolls = 0;
  private readonly firstUi = new RollingLatency();
  private readonly actionUi = new RollingLatency();
  private readonly uiWork = new RollingLatency();
  notePoll(frameAt: number, now: number, handSeen: boolean) {
    if (!handSeen || !Number.isFinite(frameAt) || frameAt<=0 || !Number.isFinite(now) ||
        now<frameAt || now-frameAt>350) {this.noHandPolls++;return;}
    if (frameAt === this.lastFrameAt) {this.repeatedUiPolls++;return;}
    if (frameAt < this.lastFrameAt) return;
    this.lastFrameAt=frameAt;this.uniqueHandFrames++;this.firstUi.add(now-frameAt);
  }
  noteHandAction(frameAt: number, now: number) {
    if (!Number.isFinite(frameAt) || frameAt<=0 || !Number.isFinite(now))return;
    const elapsed=now-frameAt;if (elapsed>=0 && elapsed<=350)this.actionUi.add(elapsed);
  }
  noteUiWork(ms: number) {this.uiWork.add(ms);}
  snapshot(heapBytes?: number) {
    return {schema:'mira.spatial-performance.v21' as const,
      uniqueHandFrames:this.uniqueHandFrames, repeatedUiPolls:this.repeatedUiPolls,
      noHandPolls:this.noHandPolls,
      inferenceToUi:this.firstUi.summary(), inferenceToHandAction:this.actionUi.summary(),
      uiHandlerDuration:this.uiWork.summary(),
      jsHeapMiB:typeof heapBytes==='number' && Number.isFinite(heapBytes) && heapBytes>=0
        ? Math.round(heapBytes/1048576*10)/10 : null};
  }
  reset() {
    this.lastFrameAt=0;this.uniqueHandFrames=0;this.repeatedUiPolls=0;this.noHandPolls=0;
    this.firstUi.reset();this.actionUi.reset();this.uiWork.reset();
  }
}
export const spatialPerformanceProfiler = new SpatialPerformanceProfiler();
