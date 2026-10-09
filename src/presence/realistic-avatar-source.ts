/** Realistic Mira avatar activation is controlled by a reviewed local manifest.
 * A VRM file alone does not prove photorealism; QA and human visual approval are required.
 * Unreviewed/external URLs can never be injected into the 3D renderer. */
export interface RealisticAvatarManifest {
  status: 'pending' | 'approved';
  asset: string;
  license: string;
  // "vrm" is a 1.0 humanoid package; GLB can preserve high fidelity PBR/Mixamo rigs.
  format?: 'vrm' | 'glb';
  sourceUrl: string;
  visualApproval: string;
  scale: number;
  position: [number, number, number];
  rotationY: number;
  /** Authored pose is preferred. Mixamo-standard skeletons can be seated explicitly. */
  poseMode?: 'authored' | 'mixamo-seated';
}
export type AvatarAssetSource =
  | {mode:'realistic';path:string;format:'vrm'|'glb';scale:number;position:[number,number,number];rotationY:number;poseMode:'authored'|'mixamo-seated'}
  | {mode:'preview';path:string;scale:number;position:[number,number,number];rotationY:number};
export const PREVIEW_ASSET:AvatarAssetSource = {
  mode:'preview',
  path:'avatars/female/mira_female_04_soft_rose.vrm',
  scale:1.55,
  position:[0,.17,2.28],
  rotationY:Math.PI,
};
const fileNamePattern=/^[a-z0-9][a-z0-9_-]{1,70}\.(?:vrm|glb)$/;

export function chooseRealisticAvatar(manifest: unknown): AvatarAssetSource {
  if (!manifest || typeof manifest!=='object')return PREVIEW_ASSET;
  const m=manifest as Partial<RealisticAvatarManifest>;
  if(m.status!=='approved'||typeof m.asset!=='string'||!fileNamePattern.test(m.asset))
    return PREVIEW_ASSET;
  // The asset's provenance, license and visual review must all be explicit.
  if(typeof m.license!=='string'||m.license.trim().length<3||
     typeof m.sourceUrl!=='string'||!/^https:\/\//.test(m.sourceUrl)||
     typeof m.visualApproval!=='string'||m.visualApproval.trim()!=='approved')
    return PREVIEW_ASSET;
  const scale=m.scale;
  if(typeof scale!=='number'||!Number.isFinite(scale)||scale<.25||scale>3)
    return PREVIEW_ASSET;
  if(!Array.isArray(m.position)||m.position.length!==3||
    !m.position.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=10))
    return PREVIEW_ASSET;
  if(typeof m.rotationY!=='number'||!Number.isFinite(m.rotationY)||
    Math.abs(m.rotationY)>Math.PI*2)return PREVIEW_ASSET;
  if(m.poseMode!==undefined && m.poseMode!=='authored' && m.poseMode!=='mixamo-seated')return PREVIEW_ASSET;
  if(m.poseMode==='mixamo-seated' && !m.asset.endsWith('.glb'))return PREVIEW_ASSET;
  return {
    mode:'realistic',
    path:'avatars/realistic/'+m.asset,
    format:m.asset.endsWith('.vrm')?'vrm':'glb',
    scale,position:m.position as [number,number,number],
    rotationY:m.rotationY,poseMode:m.poseMode||'authored',
  };
}

/**
 * An unapproved anime VRM is never the default Mira embodiment.
 * ?avatarPreview=1 is a developer-only opt-in for legacy stylized test assets.
 */
export function chooseRoomAvatar(manifest: unknown,{allowStylizedPreview=false}={}):AvatarAssetSource|null {
  const result=chooseRealisticAvatar(manifest);
  return result.mode==='realistic' ? result : allowStylizedPreview ? PREVIEW_ASSET : null;
}
