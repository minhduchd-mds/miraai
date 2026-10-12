/**
 * Asset URL policy for optional object-storage + CDN delivery.
 * Never store binary GLBs in SQL. Until an approved CDN origin is configured,
 * assets continue to be served by the existing same-origin Vercel CDN.
 * User input/query parameters cannot choose the model origin.
 */
const RELATIVE_LAB_PATH='avatars/realistic/vitruvian-lab/';
const ASSET_NAME=/^[a-z0-9][a-z0-9_-]*\.(?:glb|webp)$/i;

export type RoomAssetLocation={
  localRoot:string;
  cdnRoot:string|null;
  candidates:(assetName:string)=>string[];
};

/** Fail closed for insecure origins and credentials embedded in a URL. */
export function roomAssetLocation(basePath:string,cdnBase?:string|null):RoomAssetLocation{
  const base=basePath.endsWith('/')?basePath:basePath+'/';
  const localRoot=base+RELATIVE_LAB_PATH;
  let cdnRoot:string|null=null;
  if(cdnBase?.trim()){
    try{
      const url=new URL(cdnBase);
      if(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash){
        cdnRoot=url.href.endsWith('/')?url.href:url.href+'/';
      }
    }catch{
      // An invalid remote setting must never break the working local 3D mode.
    }
  }
  return {
    localRoot,cdnRoot,
    candidates:(name:string)=>{
      if(!ASSET_NAME.test(name))throw Error('Unsupported 3D asset path');
      return cdnRoot?[cdnRoot+name,localRoot+name]:[localRoot+name];
    },
  };
}

/**
 * Return the original public CDN origin when remote storage is unavailable.
 * Does not retry model parsing errors (only transport failure); the licensed
 * local model remains the trustworthy fallback.
 */
export async function loadRoomAsset<T>(
  urls:readonly string[],load:(url:string)=>Promise<T>,
):Promise<T>{
  let latest:unknown;
  for(const url of urls){
    try{return await load(url);}
    catch(e){latest=e;}
  }
  throw latest instanceof Error?latest:new Error('3D asset unavailable');
}
