/** Deterministic DPR ceiling for Mira's demand-rendered 3D room.
 * Idle animation cadence is intentionally NOT interpreted as GPU frame rate.
 * Preserve desktop pixel density; cap optional mobile / low-memory rendering.
 */
export type RoomRenderHints = {
  viewportWidth: number;
  deviceMemoryGb?: number;
  saveData?: boolean;
};
export function roomMaxPixelRatio({viewportWidth,deviceMemoryGb,saveData}:RoomRenderHints):number{
  if(saveData || !Number.isFinite(viewportWidth) || viewportWidth<768)return 1;
  if(viewportWidth<1024 || (Number.isFinite(deviceMemoryGb) && (deviceMemoryGb??8)<=4))
    return 1.25;
  return 1.5;
}
