import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

test('opt-in room3d renders 3D geometry, rotates through drag and walks with keyboard',async({browser},testInfo)=>{
 const ctx=await browser.newContext({
   viewport:{width:1366,height:768},deviceScaleFactor:1,
   colorScheme:'dark',reducedMotion:'no-preference',
 });
 const page=await ctx.newPage();
 const warnings=[];
 page.on('pageerror',err=>warnings.push(String(err.message).slice(0,180)));
 await page.goto('/?visual-test=1&scene=home-evening&room3d=1',{waitUntil:'networkidle'});
 const stage=page.locator('.photo-mira');
 await expect(stage).toBeVisible();
 const supported=await page.evaluate(()=>{
   const c=document.createElement('canvas');
   return Boolean(c.getContext('webgl')||c.getContext('webgl2'));
 });
 if(!supported){
   await expect(page.locator('.pm-scene-fallback')).toBeVisible();
   test.skip(true,'CI runner has no WebGL; fallback remains visible');
 }
 await expect(stage).toHaveAttribute('data-room3d-active','true',{timeout:25_000});
 await expect(stage).toHaveAttribute('data-room3d-ready','true',{timeout:25_000});
 await expect(page.locator('.pm-room3d-reference')).toHaveClass(/is-visible/);
 await expect.poll(async()=>page.locator('.pm-room3d-reference img').evaluate(
   img=>img instanceof HTMLImageElement && img.naturalWidth>0
 )).toBe(true);
 const canvas=page.locator('.pm-room3d-stage canvas');
 await expect(canvas).toBeVisible();
 const box=await canvas.boundingBox();
 expect(box).not.toBeNull();
 const x=box.x+box.width*.5,y=box.y+box.height*.53;
 const before=await canvas.screenshot();
 await page.mouse.move(x,y);await page.mouse.down();
 await expect(page.locator('.pm-room3d-reference')).not.toHaveClass(/is-visible/);
 await page.mouse.move(x+190,y-26,{steps:12});await page.mouse.up();
 await page.waitForTimeout(200);
 // Regressions used to unmount the canvas when the frame governor changed.
 await expect(stage).toHaveAttribute('data-room3d-active','true');
 await expect(canvas).toBeVisible({timeout:5_000});
 const rotated=await canvas.screenshot({timeout:12_000});
 expect(Buffer.compare(before,rotated)).not.toBe(0);
 await page.keyboard.down('KeyW');await page.waitForTimeout(450);await page.keyboard.up('KeyW');
 await page.waitForTimeout(150);
 await expect(stage).toHaveAttribute('data-room3d-active','true');
 await expect(canvas).toBeVisible({timeout:5_000});
 const moved=await canvas.screenshot({timeout:12_000});
 await page.keyboard.press('2');
 await expect(page.locator('.pm-room3d-reference')).toHaveClass(/is-visible/);
 expect(Buffer.compare(rotated,moved)).not.toBe(0);
 const img=join(process.cwd(),'artifacts','visual-qa','room3d-1366x768.png');
 await mkdir(join(process.cwd(),'artifacts','visual-qa'),{recursive:true});
 await page.screenshot({path:img,fullPage:false});
 await testInfo.attach('room3d-1366x768',{path:img,contentType:'image/png'});
 expect(warnings.filter(x=>/WebGL context|Cannot read properties|three/i.test(x))).toEqual([]);
 await ctx.close();
});

test('reduced motion never starts additional 3D renderer',async({browser})=>{
 const ctx=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});
 const page=await ctx.newPage();
 await page.goto('/?room3d=1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.photo-mira')).toBeVisible();
 await expect(page.locator('.photo-mira')).toHaveAttribute('data-room3d-active','false');
 await expect(page.locator('.pm-room3d-stage canvas')).toHaveCount(0);
 await ctx.close();
});
