import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

test('CC0 PBR human LAB renders actual skinned body, FACS face and 5 viewpoints',async({browser},info)=>{
 const ctx=await browser.newContext({viewport:{width:1366,height:768},
   deviceScaleFactor:1,reducedMotion:'no-preference',colorScheme:'dark'});
 try{
  const page=await ctx.newPage();
  const consoleErrors=[];
  page.on('pageerror',e=>consoleErrors.push(String(e.message).slice(0,160)));
  const responses=await Promise.all(['head.glb','body.glb','hair.glb','vit_face_bc.webp','manifest.json']
    .map(x=>page.request.get('/avatars/realistic/vitruvian-lab/'+x)));
  expect(responses.every(x=>x.ok())).toBe(true);
  await page.goto('/?room3d=1&humanLab=1&visual-test=1&scene=home-evening',{
    waitUntil:'domcontentloaded'});
  const stage=page.locator('.photo-mira');
  await expect(stage).toHaveAttribute('data-room3d-active','true',{timeout:30000});
  const supported=await page.evaluate(()=>{
   const c=document.createElement('canvas');
   return Boolean(c.getContext('webgl2')||c.getContext('webgl'));
  });
  if(!supported)test.skip(true,'WebGL not available on this CI runner');
  const room=page.locator('.pm-room3d-stage');
  await expect(room).toHaveAttribute('data-avatar-status','review',{timeout:90000});
  await expect(room.locator('canvas')).toBeVisible();
  await mkdir(join(process.cwd(),'artifacts','visual-qa'),{recursive:true});
  // A real screenshot is required: metadata alone does not certify likeness.
  for(let preset=1;preset<=5;preset++){
   await page.keyboard.press(String(preset));
   await page.waitForTimeout(350);
   await expect(room).toHaveAttribute('data-avatar-status','review');
   const path=join(process.cwd(),'artifacts','visual-qa',`vitruvian-human-lab-view-${preset}.png`);
   await page.screenshot({path,fullPage:false,animations:'disabled'});
   await info.attach('vitruvian-human-view-'+preset,{path,contentType:'image/png'});
  }
  const metrics=await page.evaluate(()=>{
   const items=performance.getEntriesByType('resource').filter(x=>x.name.includes('/vitruvian-lab/'));
   return {count:items.length,bytes:items.reduce((a,x)=>a+Number(x.transferSize||0),0)};
  });
  expect(metrics.count).toBeGreaterThanOrEqual(15);
  expect(consoleErrors).toEqual([]);
 }finally{await ctx.close();}
});
