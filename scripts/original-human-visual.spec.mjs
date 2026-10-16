import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

test('original Mira geometric human renders in isolated 3D lab across two camera views',async({browser},testInfo)=>{
 const context=await browser.newContext({
  viewport:{width:1366,height:768},deviceScaleFactor:1,
  reducedMotion:'no-preference',colorScheme:'dark',
 });
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(String(error.message).slice(0,180)));
 await page.goto('/?visual-test=1&room3d=1&scene=home-evening&originalHumanLab=1',
  {waitUntil:'domcontentloaded'});
 const supported=await page.evaluate(()=>{
  const el=document.createElement('canvas');
  return Boolean(el.getContext('webgl2')||el.getContext('webgl'));
 });
 if(!supported){
  await context.close();
  test.skip(true,'WebGL unsupported on this QA host; local device review still required');
 }
 const hero=page.locator('.photo-mira');
 await expect(hero).toHaveAttribute('data-room3d-active','true',{timeout:25_000});
 await expect(hero).toHaveAttribute('data-room3d-ready','true',{timeout:25_000});
 const stage=page.locator('.pm-room3d-stage');
 await expect(stage).toHaveAttribute('data-avatar-status','review',{timeout:20_000});
 const canvas=stage.locator('canvas');
 await expect(canvas).toBeVisible();
 await mkdir(join(process.cwd(),'artifacts','visual-qa'),{recursive:true});
 const distinct=[];
 for(const [key,num] of [
  ['front','1'],['left45','2'],['profile','3'],['right45','4'],
  ['rear','5'],['faceclose','6']
 ]){
  await hero.focus();
  await page.keyboard.press(num);
  await page.waitForTimeout(350);
  await expect(stage).toHaveAttribute('data-avatar-status','review');
  const image=join(process.cwd(),'artifacts','visual-qa','mira-original-human-'+key+'.png');
  const capture=await canvas.screenshot({path:image});
  distinct.push(capture.toString('base64'));
  await testInfo.attach('original-human-'+key,{path:image,contentType:'image/png'});
 }
 expect(new Set(distinct).size).toBeGreaterThanOrEqual(3);
 await expect(page.locator('.voice-footer')).toBeVisible();
 expect(errors.filter(x=>/WebGL|THREE|Cannot read properties|useFrame/.test(x))).toEqual([]);
 await context.close();
});
