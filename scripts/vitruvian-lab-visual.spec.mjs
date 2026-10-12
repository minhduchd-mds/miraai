import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

test('CC0 PBR human LAB renders actual skinned body, FACS face and 5 viewpoints',async({browser},info)=>{
 test.setTimeout(360_000); // 5 Chromium/WebGL renders exceed 180s on software GPU runners.
 const ctx=await browser.newContext({viewport:{width:1366,height:768},
   deviceScaleFactor:1,reducedMotion:'no-preference',colorScheme:'dark'});
 try{
  const page=await ctx.newPage();
  const consoleErrors=[];
  page.on('pageerror',e=>consoleErrors.push(String(e.message).slice(0,160)));
  page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text().slice(0,240))});
  const responses=await Promise.all(['head.glb','body.glb','hair.glb','vit_face_bc.webp','manifest.json']
    .map(x=>page.request.get('/avatars/realistic/vitruvian-lab/'+x)));
  expect(responses.every(x=>x.ok())).toBe(true);
  const meshoptCandidate=process.env.MIRA_MESHOPT_CANDIDATE==='1';
  if(meshoptCandidate){
    const compressed=await Promise.all(['head.glb','body.glb','hair.glb']
      .map(x=>page.request.get('/avatars/realistic/vitruvian-lab/meshopt/'+x)));
    expect(compressed.every(x=>x.ok())).toBe(true);
  }
  await page.goto('/?room3d=1&humanLab=1&visual-test=1&scene=home-evening'+
    (meshoptCandidate?'&meshopt=1':''),{waitUntil:'domcontentloaded'});
  const stage=page.locator('.photo-mira');
  await expect(stage).toHaveAttribute('data-room3d-active','true',{timeout:30000});
  const supported=await page.evaluate(()=>{
   const c=document.createElement('canvas');
   return Boolean(c.getContext('webgl2')||c.getContext('webgl'));
  });
  if(!supported)test.skip(true,'WebGL not available on this CI runner');
  const room=page.locator('.pm-room3d-stage');
  await expect.poll(async()=>{
    const current=await room.getAttribute('data-avatar-status');
    if(current==='rejected')throw new Error('Human LAB rejected: '+consoleErrors.join(' | '));
    return current;
  },{timeout:90000}).toBe('review');
  await expect(room.locator('canvas')).toBeVisible();
  await mkdir(join(process.cwd(),'artifacts','visual-qa'),{recursive:true});
  // Keyboard camera presets are active only while the room's host button is focused.
  await room.locator('canvas').click({position:{x:240,y:240}});
  await expect(room).toHaveAttribute('data-avatar-status','review');
  // A real screenshot is required: metadata alone does not certify likeness.
  const viewCaptures=[];
  for(let preset=1;preset<=5;preset++){
   await page.keyboard.press(String(preset));
   await page.waitForTimeout(350);
   await expect(room).toHaveAttribute('data-avatar-status','review');
   const path=join(process.cwd(),'artifacts','visual-qa',`vitruvian-human-lab-view-${preset}.png`);
   const png=await page.screenshot({path,fullPage:false,animations:'disabled'});
   viewCaptures.push(png);
   await info.attach('vitruvian-human-view-'+preset,{path,contentType:'image/png'});
  }
  // Guard against five cosmetically renamed identical screenshots.
  expect(new Set(viewCaptures.map(x=>x.toString('base64'))).size).toBeGreaterThanOrEqual(3);
  const metrics=await page.evaluate(()=>{
   const items=performance.getEntriesByType('resource').filter(x=>x.name.includes('/vitruvian-lab/'));
   return {count:items.length,bytes:items.reduce((a,x)=>a+Number(x.transferSize||0),0)};
  });
  // 9 active PBR maps + three GLBs + manifest. Old threshold 15 assumed
  // three unused maps were still downloaded; fail when any real asset fails.
  expect(metrics.count).toBeGreaterThanOrEqual(13);
  if(meshoptCandidate){
    const names=await page.evaluate(()=>performance.getEntriesByType('resource')
      .map(x=>x.name).filter(x=>/\\/vitruvian-lab\\/meshopt\\/(?:head|body|hair)\\.glb$/.test(x)));
    expect(names).toHaveLength(3);
  }
  expect(consoleErrors).toEqual([]);
 }finally{await ctx.close();}
});
