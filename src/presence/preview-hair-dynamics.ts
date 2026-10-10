import type {VRM} from '@pixiv/three-vrm';

/**
 * The committed VRM0 preview's hair springs are unstable after the model is
 * turned to face the seated camera. Their tips can flip upward after seconds.
 * Preserve the artist-authored rest hairstyle by skipping secondary motion.
 *
 * Scope: deliberately called only on the preview avatar. Approved human rigs
 * retain their own physics. Does not mutate geometry, skin, or facial tracking.
 */
export function stabilizePreviewHairPhysics(vrm:Pick<VRM,'springBoneManager'>):boolean {
 const manager=vrm.springBoneManager;
 if(!manager)return false;
 // VRM.update() still drives gaze, expressions and normalized humanoid bones.
 // Only its unstable secondary/spring-bone step is made a no-op for this rig.
 manager.update=()=>{};
 return true;
}
