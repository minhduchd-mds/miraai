import { test, expect } from '@playwright/test';

async function installCapabilityProfile(page, profile) {
  await page.addInitScript((value) => {
    const nav = navigator;

    Object.defineProperty(nav, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException('Synthetic smoke profile: media capture disabled', 'NotAllowedError');
        },
      },
    });

    Object.defineProperty(nav, 'permissions', {
      configurable: true,
      value: {
        query: async ({ name }) => ({
          state: name === 'camera'
            ? value.cameraPermission
            : name === 'microphone'
              ? value.microphonePermission
              : 'prompt',
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() { return true; },
        }),
      },
    });

    Object.defineProperty(nav, 'xr', {
      configurable: true,
      value: {
        isSessionSupported: async (mode) => (
          mode === 'immersive-ar' ? value.immersiveAr : false
        ),
      },
    });

    if (value.webnn) {
      Object.defineProperty(nav, 'ml', {
        configurable: true,
        value: {},
      });
    }
  }, profile);
}

test('device preflight reports denied camera without opening media capture', async ({ page }) => {
  await installCapabilityProfile(page, {
    cameraPermission: 'denied',
    microphonePermission: 'granted',
    immersiveAr: true,
    webnn: true,
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('[data-spatial-action="settings.open"]').click();

  const settings = page.locator('.v2-settings');
  await expect(settings).toBeVisible();

  await settings.getByRole('button', { name: 'Kiểm tra thiết bị' }).click();

  const deviceGrid = settings.locator('.v2-device-grid');
  await expect(deviceGrid).toBeVisible();

  const camera = deviceGrid.locator('.v2-device-item').filter({ hasText: 'Camera' });
  const microphone = deviceGrid.locator('.v2-device-item').filter({ hasText: 'Microphone' });
  const xr = deviceGrid.locator('.v2-device-item').filter({ hasText: 'WebXR AR' });

  await expect(camera).toContainText('Bị chặn');
  await expect(camera).toHaveAttribute('data-status', 'warn');
  await expect(microphone).toContainText('Đã cấp');
  await expect(xr).toContainText('Sẵn sàng');

  await expect(settings.getByText('Preflight read-only · không bật camera/mic, không xin quyền.')).toBeVisible();
  await expect(page.locator('.v2-vision-monitor')).toHaveCount(0);
});

test('XR capability exposes the production XR control without starting a session', async ({ page }) => {
  await installCapabilityProfile(page, {
    cameraPermission: 'prompt',
    microphonePermission: 'prompt',
    immersiveAr: true,
    webnn: false,
  });

  await page.goto('/', { waitUntil: 'networkidle' });

  const xrButton = page.locator('[data-spatial-action="xr.toggle"]');
  await expect(xrButton).toBeVisible();
  await expect(xrButton).toHaveAttribute('aria-pressed', 'false');

  const root = page.locator('.mira-v2');
  await expect(root).toHaveAttribute('data-xr-hands', '0');
  await expect(root).toHaveAttribute('data-xr-hit', 'false');
  await expect(root).toHaveAttribute('data-xr-depth', 'false');

  await expect(page.locator('.v2-vision-monitor')).toHaveCount(0);
});

test('1366x768 remains overflow-safe with XR capability and settings open', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  await installCapabilityProfile(page, {
    cameraPermission: 'prompt',
    microphonePermission: 'prompt',
    immersiveAr: true,
    webnn: true,
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('[data-spatial-action="xr.toggle"]')).toBeVisible();

  await page.locator('[data-spatial-action="settings.open"]').click();
  await expect(page.locator('.v2-settings')).toBeVisible();

  const geometry = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    settings: (() => {
      const rect = document.querySelector('.v2-settings')?.getBoundingClientRect();
      return rect
        ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
        : null;
    })(),
  }));

  expect(geometry.scrollWidth - geometry.viewportWidth).toBeLessThanOrEqual(1);
  expect(geometry.settings).not.toBeNull();
  expect(geometry.settings.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.settings.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.settings.top).toBeGreaterThanOrEqual(-1);

  await context.close();
});
