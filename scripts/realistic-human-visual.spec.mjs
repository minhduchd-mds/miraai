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


test('pending realistic human does not replace default desktop presence with an empty 3D room',async({page})=>{
  await page.setViewportSize({width:1366,height:768});
  const response=await page.request.get('/avatars/realistic/manifest.json');
  if(!response.ok())test.skip(true,'Avatar manifest is unavailable');
  const manifest=await response.json();
  if(manifest.status==='approved'&&manifest.visualApproval==='approved')
    test.skip(true,'An approved production 3D avatar is installed');
  await page.goto('/?visual-test=1&scene=home-evening',{waitUntil:'domcontentloaded'});
  const stage=page.locator('.photo-mira');
  await expect(stage).toHaveAttribute('data-room3d-active','false',{timeout:10000});
  await expect(stage.locator('.pm-scene-fallback')).toBeVisible();
  await expect(page.locator('.pm-room3d-stage canvas')).toHaveCount(0);
});


test('female live portrait uses the existing local authored photo and switches without camera access',async({page})=>{
  await page.setViewportSize({width:1366,height:768});
  await page.goto('/?visual-test=1&scene=home-evening&appearance=portrait',{waitUntil:'domcontentloaded'});
  const root=page.locator('.photo-mira');
  await expect(root).toHaveAttribute('data-room3d-active','false',{timeout:10000});
  await expect(root).toHaveAttribute('data-female-presentation','portrait');
  const scene=root.locator('.pm-scene-fallback');
  await expect(scene).toBeVisible();
  await expect.poll(()=>scene.evaluate(img=>img instanceof HTMLImageElement?img.naturalWidth:0)).toBeGreaterThan(0);
  // Default mode must not load the same image twice or allocate a WebGL
  // compositor that has nothing to do with the visible woman.
  await expect(root.locator('.pm-scene-shell img')).toHaveCount(1);
  await expect(root.locator('.pm-scene-canvas,.pm-depth-layer,.pm-live-female-portrait')).toHaveCount(0);
  const asset=await scene.getAttribute('src');
  expect(asset).toContain('/mira-assets/scenes/');
  // Framing moved from the header into Settings → Giao diện (DESIGN.md §7: header = brand, status, settings).
  await page.locator('[data-spatial-action="settings.open"]').click();
  await page.getByRole('button',{name:'Giao diện'}).click();
  const button=page.locator('.v2-setting-row',{hasText:'Khung chân dung'}).getByRole('switch');
  await expect(button).toHaveAttribute('aria-checked','true');
  await button.click();
  await expect(root).toHaveAttribute('data-female-presentation','scene');
  await expect(root.locator('.pm-live-female-portrait')).toHaveCount(0);
  await expect(button).toHaveAttribute('aria-checked','false');
  await expect(page.locator('.pm-scene-fallback')).toBeVisible();
  await expect(page.locator('.v2-camera-preview')).toHaveCount(0);
  await button.click();
  await expect(root).toHaveAttribute('data-female-presentation','portrait');
  await page.keyboard.press('Escape');
  await expect(root.locator('.pm-scene-shell img')).toHaveCount(1);
  await expect(root.locator('.pm-scene-canvas,.pm-depth-layer,.pm-live-female-portrait')).toHaveCount(0);
  await expect(page.locator('.voice-primary')).toBeVisible();
});
