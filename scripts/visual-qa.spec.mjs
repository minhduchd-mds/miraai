import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outputDir = join(process.cwd(), 'artifacts', 'visual-qa');
const scenes = ['daytime', 'welcome-home', 'home-evening', 'bedtime'];
const profiles = [
  { name: 'desktop-1440x900', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
  { name: 'desktop-1366x768', viewport: { width: 1366, height: 768 }, isMobile: false, hasTouch: false },
  { name: 'tablet-768x1024', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
  { name: 'mobile-390x844', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'mobile-360x800', viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true },
];

test('Mira v16.3 visual scene and device-profile lab', async ({ browser }, testInfo) => {
  await mkdir(outputDir, { recursive: true });
  const report = {
    schema: 'mira.visual-qa.v1',
    generatedAt: new Date().toISOString(),
    profiles: [],
  };

  for (const profile of profiles) {
    const profileReport = { name: profile.name, viewport: profile.viewport, scenes: [] };

    for (const scene of scenes) {
      const context = await browser.newContext({
        viewport: profile.viewport,
        isMobile: profile.isMobile,
        hasTouch: profile.hasTouch,
        deviceScaleFactor: 1,
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();

      const assetFailures = [];
      page.on('requestfailed', (request) => {
        if (request.url().includes('/mira-assets/')) {
          assetFailures.push({
            url: request.url(),
            error: request.failure()?.errorText || 'request_failed',
          });
        }
      });

      await page.goto(`/?visual-test=1&scene=${scene}`, {
        waitUntil: 'networkidle',
      });

      const stage = page.locator(`.photo-mira[data-presence-scene="${scene}"]`);
      await expect(stage).toBeVisible();

      const sceneImage = page.locator('.pm-scene-fallback, .pm-scene').first();
      await expect(sceneImage).toBeVisible();
      await expect.poll(async () => sceneImage.evaluate((img) =>
        img instanceof HTMLImageElement ? img.naturalWidth : 1
      )).toBeGreaterThan(0);

      await expect(page.locator('.voice-primary')).toBeVisible();
      await expect(page.locator('.v2-presence-scenes')).toHaveCount(0);
      await expect(page.locator('.v2-vision-monitor')).toHaveCount(0);

      const metrics = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource')
          .map((entry) => ({
            name: entry.name,
            transferSize: Number(entry.transferSize || 0),
            encodedBodySize: Number(entry.encodedBodySize || 0),
            duration: Number(entry.duration || 0),
          }))
          .filter((entry) =>
            entry.name.includes('/mira-assets/scenes/') ||
            entry.name.includes('/mira-assets/expressions/')
          );

        const presenceMedia = resources.filter((entry) =>
          entry.name.includes('/mira-assets/scenes/') ||
          entry.name.includes('/mira-assets/expressions/')
        );
        const pngRuntime = presenceMedia.filter((entry) => entry.name.endsWith('.png'));
        const webpRuntime = presenceMedia.filter((entry) => entry.name.endsWith('.webp'));
        const nav = performance.getEntriesByType('navigation')[0];
        const loaf = performance.getEntriesByType('long-animation-frame');
        const root = document.documentElement;
        const mic = document.querySelector('.voice-primary')?.getBoundingClientRect();
        const stage = document.querySelector('.photo-mira')?.getBoundingClientRect();

        return {
          url: location.href,
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          scrollHeight: root.scrollHeight,
          clientHeight: root.clientHeight,
          horizontalOverflowPx: Math.max(0, root.scrollWidth - root.clientWidth),
          navigation: nav ? {
            domContentLoadedMs: nav.domContentLoadedEventEnd,
            loadEventMs: nav.loadEventEnd,
            durationMs: nav.duration,
          } : null,
          longAnimationFrames: {
            count: loaf.length,
            worstMs: loaf.reduce((max, entry) => Math.max(max, Number(entry.duration || 0)), 0),
          },
          runtimeMedia: {
            requests: presenceMedia.length,
            webpRequests: webpRuntime.length,
            pngRequests: pngRuntime.length,
            encodedBytes: presenceMedia.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
            transferBytes: presenceMedia.reduce((sum, entry) => sum + entry.transferSize, 0),
            maxRequestMs: presenceMedia.reduce((max, entry) => Math.max(max, entry.duration), 0),
            urls: presenceMedia.map((entry) => entry.name),
          },
          micRect: mic ? { x: mic.x, y: mic.y, width: mic.width, height: mic.height } : null,
          stageRect: stage ? { x: stage.x, y: stage.y, width: stage.width, height: stage.height } : null,
        };
      });

      expect(assetFailures).toEqual([]);
      expect(metrics.horizontalOverflowPx).toBeLessThanOrEqual(1);
      expect(metrics.runtimeMedia.pngRequests).toBe(0);
      expect(metrics.runtimeMedia.webpRequests).toBeGreaterThanOrEqual(1);
      expect(metrics.runtimeMedia.encodedBytes).toBeLessThanOrEqual(420 * 1024);
      expect(metrics.micRect).not.toBeNull();
      expect(metrics.stageRect).not.toBeNull();
      expect(metrics.micRect.y + metrics.micRect.height).toBeLessThanOrEqual(profile.viewport.height + 1);

      const screenshotName = `${profile.name}__${scene}.png`;
      const screenshotPath = join(outputDir, screenshotName);
      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        animations: 'disabled',
      });
      await testInfo.attach(screenshotName, {
        path: screenshotPath,
        contentType: 'image/png',
      });

      profileReport.scenes.push({
        scene,
        assetFailures,
        ...metrics,
      });

      await context.close();
    }

    report.profiles.push(profileReport);
  }

  await writeFile(
    join(outputDir, 'visual-qa-report.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  );
});
