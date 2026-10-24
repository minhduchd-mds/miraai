// Frame-by-frame video of Mira LiveAvatar talking, rendered by the app's own motion model and
// WebGL renderer (?avatar-export=1), at an exact frame rate with the reply audio muxed in sync.
//   node scripts/media/render-talking.mjs --app http://localhost:4173/ --audio reply.wav \
//        --out out/mira-talking.mp4 [--width 1280 --height 720 --fps 30 --lead 1.2 --tail 1.4]
// Needs python3 + numpy (scripts/media/envelope.py) and ffmpeg (FFMPEG env to override).
import { chromium } from 'playwright';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const APP = arg('app', 'http://localhost:4173/');
const AUDIO = resolve(arg('audio', 'reply.wav'));
const OUT = resolve(arg('out', 'out/mira-talking.mp4'));
const W = Number(arg('width', 1280)), H = Number(arg('height', 720));
const FPS = Number(arg('fps', 30)), LEAD = Number(arg('lead', 1.2)), TAIL = Number(arg('tail', 1.4));
const FF = process.env.FFMPEG || 'ffmpeg';
const here = dirname(new URL(import.meta.url).pathname);
const frames = join(dirname(OUT), `frames-${W}x${H}`);
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const env = JSON.parse(execFileSync('python3', [join(here, 'envelope.py'), AUDIO, String(FPS)], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const total = Math.round((LEAD + env.length / FPS + TAIL) * FPS);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: { error: 'offline-render' } }));
const url = new URL(APP); url.searchParams.set('avatar-export', '1');
await page.goto(url.href, { waitUntil: 'networkidle' });
const state = await page.waitForFunction(() => document.querySelector('[data-live-avatar="live"],[data-live-avatar="still"]')?.getAttribute('data-live-avatar'), null, { timeout: 60000 }).then((h) => h.jsonValue());
if (state !== 'live') throw new Error('LiveAvatar fell back to the still photo (no WebGL)');
await page.waitForFunction(() => typeof window.__miraRenderFrame === 'function');
// Only the stage: hide app chrome (header, dock, captions) for a clean talking-head video.
await page.addStyleTag({ content: 'body *{visibility:hidden!important}.live-avatar,.live-avatar *{visibility:visible!important}.live-avatar-badge{visibility:hidden!important}' });

for (let i = 0; i < total; i++) {
  const t = i / FPS;
  const k = Math.round((t - LEAD) * FPS);
  const speaking = k >= 0 && k < env.length;
  // Before speaking: Mira follows the viewer's (scripted) pointer from left to centre.
  const lookAt = t < LEAD ? { x: -0.9 + 1.6 * Math.min(1, t / Math.max(0.1, LEAD * 0.8)), y: 0.15 } : null;
  const e = speaking ? env[k] : null;
  await page.evaluate((f) => window.__miraRenderFrame(f), {
    timeMs: 1000 + t * 1000,
    state: speaking ? 'speaking' : t < LEAD ? 'listening' : 'idle',
    level: e ? e.level : 0,
    bands: e ? { low: e.low, mid: e.mid, high: e.high } : null,
    lookAt,
  });
  await page.screenshot({ path: join(frames, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
}
await browser.close();
execFileSync(FF, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, 'f%05d.jpg'),
  '-itsoffset', String(LEAD), '-i', AUDIO, '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', OUT]);
rmSync(frames, { recursive: true, force: true });
console.log(JSON.stringify({ out: OUT, frames: total, seconds: +(total / FPS).toFixed(2), bytes: statSync(OUT).size }));
