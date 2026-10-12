import {mkdirSync,statSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const directory='public/avatars/realistic/vitruvian-lab';
const output='artifacts/meshopt-research';
const models=['head.glb','body.glb','hair.glb'];
mkdirSync(output,{recursive:true});
const executable='./node_modules/.bin/gltf-transform';
if(!existsSync(executable))
  throw Error('glTF Transform CLI not installed: install pinned CLI in research workflow');

for(const file of models){
  const input=join(directory,file),destination=join(output,file);
  if(!existsSync(input)||statSync(input).size<100_000)
    throw Error('Missing source CC0 GLB: '+file);
  // Meshopt medium preserves the source scene topology, skin and morph targets.
  // No simplification, texture resizing, animation strip, mesh join or decimation.
  const child=spawnSync(executable,['meshopt',input,destination,'--level','medium'],
    {stdio:'inherit',timeout:240_000});
  if(child.error)throw child.error;
  if(child.status!==0)throw Error('Meshopt failed for '+file+': '+child.status);
  if(!existsSync(destination))throw Error('Missing compressed output '+file);
  console.log('[Mira candidate]',file,'original=',statSync(input).size,
    'meshopt=',statSync(destination).size);
}
console.log('Candidate-only: originals are unchanged. Run verify-vitruvian-meshopt.mjs.');
