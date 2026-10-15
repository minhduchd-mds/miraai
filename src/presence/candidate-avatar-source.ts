/** Unreviewed research-only, same-origin GLB models. Never use as live Mira identity. */
export type CandidateId='sample'|'white';
export type CandidateAsset={id:CandidateId;path:string;scale:number};
const MODELS:Record<CandidateId,CandidateAsset>={
 sample:{id:'sample',path:'avatars/realistic/candidates/nightdress-sample.glb',scale:1.75},
 white:{id:'white',path:'avatars/realistic/candidates/nightdress-white-mesh.glb',scale:.88},
};
/** Both the lab flag and a whitelist match are mandatory. Ignore arbitrary URLs. */
export function candidate3DFromSearch(search:string):CandidateAsset|null{
 const params=new URLSearchParams(search);
 if(params.get('humanLab')!=='1')return null;
 const choice=params.get('candidate3d');
 return choice==='sample'||choice==='white'?MODELS[choice]:null;
}
