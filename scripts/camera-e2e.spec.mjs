import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// E8 + camera pipeline, end to end in CI (which has internet at build time):
// the public MediaPipe CDNs are BLOCKED for the page, a real face video (the LiveAvatar portrait
// rendered to y4m) feeds Chromium's fake camera, and Mira must still detect the face.
const BLOCKED = ['cdn.jsdelivr.net', 'storage.googleapis.com'];

test.use({
  permissions: ['camera', 'microphone'],
  viewport: { width: 1280, height: 800 },
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${process.env.FACE_Y4M || 'face.y4m'}`,
    ],
  },
});

test('E8: face is detected from self-hosted MediaPipe with the CDNs blocked', async ({ page }) => {
  const blocked = [];
  const local = [];
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (BLOCKED.includes(url.host)) { blocked.push(url.pathname.split('/').pop()); return route.abort(); }
    if (url.pathname.includes('/mediapipe/')) local.push(url.pathname.split('/mediapipe/')[1]);
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { error: 'offline in CI' } });
    return route.continue();
  });
  const manifest = await (await page.request.get('/mediapipe/manifest.json')).json();
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('button[title="Cài đặt"]').click();
  await page.getByRole('button', { name: 'Giao diện' }).click();
  const t0 = Date.now();
  await page.locator('.v2-setting-row', { hasText: 'Camera nhận diện' }).getByRole('switch').click();
  await page.keyboard.press('Escape');
  const cameraStatus = () => page.evaluate(() => [...document.querySelectorAll('.v2-session-panel dd')][1]?.textContent || '');
  await expect.poll(cameraStatus, { timeout: 90_000, intervals: [500] }).toBe('Đang nhận diện');
  const detectMs = Date.now() - t0;
  await page.waitForTimeout(6000);
  const moodClass = await page.evaluate(() => (document.querySelector('.mira-v2')?.className.match(/user-mood-(\w+)/) || [])[1]);
  const toast = await page.evaluate(() => document.querySelector('.v2-error span')?.textContent || '');
  mkdirSync('artifacts/experiments', { recursive: true });
  await page.screenshot({ path: 'artifacts/experiments/e8-face-detected.png' });
  const result = { manifestModels: Object.keys(manifest.models), detectMs, moodClass, blockedRequests: [...new Set(blocked)], localAssets: [...new Set(local)], toast };
  writeFileSync('artifacts/experiments/e8.json', JSON.stringify(result, null, 1));
  console.log('E8_RESULT ' + JSON.stringify(result));
  expect(toast).toBe('');
  expect(['happy', 'sad', 'tired', 'angry', 'surprised', 'neutral']).toContain(moodClass);
});
