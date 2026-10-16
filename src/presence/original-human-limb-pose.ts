/** Original Mira mannequin anatomy and chair-relative calibration (metres).
 * An independent simple research rig, NOT a claim of photoreal production anatomy. */
export type Point3=readonly [number,number,number];
export const CHAIR_ARM={x:.69,topY:.695,z:1.68} as const;
export const AVATAR_ORIGIN:Point3=[0,0,1.78];

export function seatedArm(side:-1|1){
 return {
   shoulder:[side*.285,1.26,.01] as Point3,
   elbow:[side*.415,1.03,-.015] as Point3,
   wrist:[side*.625,.795,-.055] as Point3,
   hand:[side*.665,.760,-.07] as Point3,
   handRadiusY:.055,
 };
}
export function seatedLeg(side:-1|1){
 return {
   hip:[side*.16,.77,.085] as Point3,
   knee:[side*.17,.51,.37] as Point3,
   ankle:[side*.17,.14,.57] as Point3,
   foot:[side*.17,.078,.67] as Point3,
 };
}
export function contactGapForChairArm(side:-1|1):number {
 const a=seatedArm(side);
 return a.hand[1]-a.handRadiusY-CHAIR_ARM.topY;
}
export function validSeatedRig():boolean {
 for(const side of [-1,1] as const){
  const a=seatedArm(side),l=seatedLeg(side);
  const gap=contactGapForChairArm(side);
  if(gap<-.03||gap>.035) return false;
  if(Math.abs(a.hand[0])<.58||Math.abs(a.hand[0])>.76)return false;
  if(l.knee[1]>=l.hip[1]||l.ankle[1]>=l.knee[1])return false;
  if(l.knee[2]<=l.hip[2]||l.ankle[2]<=l.knee[2])return false;
  if(a.wrist[1]>=a.elbow[1]||a.elbow[1]>=a.shoulder[1])return false;
 }
 return true;
}
