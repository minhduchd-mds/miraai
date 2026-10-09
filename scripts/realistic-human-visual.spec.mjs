import { test, expect } from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

/**
 * Five-view review evidence for the approved photoreal human.
 * A pending asset is not a successful avatar render; skip explicitly.
 */
test('approved photoreal Mira renders five 3D viewpoints without photographic overlays',async({browser},info)=>{
  const context=await browser.newContext({
    viewport:{width:1366,height:768},deviceScaleFactor:1,
    reducedMotion:'no-preference',colorScheme:'dark',
  });
  try{
    const page=await context.newPage();
    const response=await page.request.get('/avatars/realistic/manifest.json');
    if(!response.ok())test.skip(true,'Human avatar manifest unavailable');
    const manifest=await response.json();
    if(manifest.status!=='approved'||manifest.visualApproval!=='approved')
      test.skip(true,'No photoreal human has passed manual review');
    await page.goto('/?room3d=1&visual-test=1&scene=home-evening',{waitUntil:'domcontentloaded'});
    const stage=page.locator('.photo-mira');
    await expect(stage).toHaveAttribute('data-room3d-active','true',{timeout:25000});
    const avatar=page.locator('.pm-room3d-stage');
    await expect(avatar).toHaveAttribute('data-avatar-status','approved',{timeout:30000});
    await expect(avatar.locator('canvas')).toBeVisible();
    await expect(page.locator('.pm-room3d-hud,.pm-room3d-gallery,.pm-hero-copy')).toHaveCount(0);
    await expect(page.locator('.voice-footer')).toBeVisible();
    await mkdir(join(process.cwd(),'artifacts','visual-qa'),{recursive:true});
    for(let preset=1;preset<=5;preset++){
      await page.keyboard.press(String(preset));
      await page.waitForTimeout(230);
      await expect(avatar).toHaveAttribute('data-avatar-status','approved');
      const out=join(process.cwd(),'artifacts','visual-qa',`realistic-human-view-${preset}.png`);
      await page.screenshot({path:out,fullPage:false});
      await info.attach(`realistic-human-view-${preset}`,{path:out,contentType:'image/png'});
    }
  }finally{await context.close();}
});
