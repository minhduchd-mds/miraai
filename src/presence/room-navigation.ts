/**
 * Planar navigation for the authored Mira room. These conservative footprints
 * match major furniture in RoomLuxuryInterior.tsx. They are NOT a physics
 * engine or a collision mesh generated from arbitrary GLB assets.
 *
 * Keep this module side-effect free so movement can be regression-tested without
 * Three.js, WebGL, a camera, or access to personal data.
 */
export type RoomPosition = Readonly<{x:number;z:number}>;
type Footprint = Readonly<{id:string;minX:number;maxX:number;minZ:number;maxZ:number}>;

export const ROOM_LIMITS = Object.freeze({
  minX:-4.45,maxX:4.45,minZ:-5.15,maxZ:5.55,
});
export const CAMERA_CLEARANCE = 0.24;
export const ROOM_OBSTACLES: readonly Footprint[] = [
  {id:'bed',minX:-0.42,maxX:3.15,minZ:-5.39,maxZ:-1.49},
  {id:'sofa',minX:-4.58,maxX:-1.7,minZ:0.20,maxZ:1.82},
  {id:'wardrobe',minX:4.03,maxX:4.98,minZ:-4.89,maxZ:-1.60},
  // Expanded soft beanbag occupies the center; no foreground marble desk.
  {id:'mira-chair',minX:-1.56,maxX:1.56,minZ:0.80,maxZ:3.18},
  {id:'plant-left',minX:-4.07,maxX:-3.17,minZ:-4.93,maxZ:-4.05},
  {id:'plant-window',minX:-4.7,maxX:-3.83,minZ:2.42,maxZ:3.32},
  {id:'plant-right',minX:3.41,maxX:4.29,minZ:-1.85,maxZ:-0.97},
] as const;

/** Camera body is treated as a horizontal circle against padded AABBs. */
export function isRoomWalkable(x:number,z:number):boolean {
  if(!Number.isFinite(x)||!Number.isFinite(z))return false;
  if(x<ROOM_LIMITS.minX||x>ROOM_LIMITS.maxX||
     z<ROOM_LIMITS.minZ||z>ROOM_LIMITS.maxZ)return false;
  return !ROOM_OBSTACLES.some(o=>
    x>=o.minX-CAMERA_CLEARANCE&&x<=o.maxX+CAMERA_CLEARANCE&&
    z>=o.minZ-CAMERA_CLEARANCE&&z<=o.maxZ+CAMERA_CLEARANCE);
}

/**
 * Small swept increments stop tunneling during frame stalls; independent
 * X/Z checks let the camera slide along furniture rather than freezing.
 * Diagonal input has the same world speed as straight movement.
 */
export function moveRoomCamera(
  at:RoomPosition,yaw:number,forward:number,strafe:number,seconds:number
):RoomPosition {
  if(!isRoomWalkable(at.x,at.z)||![yaw,forward,strafe,seconds].every(Number.isFinite))
    return at;
  const dt=Math.max(0,Math.min(seconds,0.06));
  const magnitude=Math.hypot(forward,strafe);
  if(magnitude===0||dt===0)return at;
  const distance=2.15*dt/Math.max(1,magnitude);
  const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*strafe)*distance;
  const dz=(-Math.cos(yaw)*forward+Math.sin(yaw)*strafe)*distance;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.06));
  const stepX=dx/steps,stepZ=dz/steps;
  let {x,z}=at;
  for(let i=0;i<steps;i++){
    if(isRoomWalkable(x+stepX,z))x+=stepX;
    if(isRoomWalkable(x,z+stepZ))z+=stepZ;
  }
  return {x,z};
}
