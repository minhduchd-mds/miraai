import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { markPrivateResponse } from '../lib/private-response.js';

function workerFixture() {
  const handlers = new Map();
  const storage = new Map();
  const origin = 'https://mira.example';
  let calls = 0;
  let failNetwork = false;
  let cacheControl = '';
  const key = (value) => typeof value === 'string' ? new URL(value, origin).href : value.url;
  const cache = {
    async add() {},
    async put(request, response) { storage.set(key(request), response.clone()); },
    async match(request) { return storage.get(key(request))?.clone(); },
    async keys() { return [...storage.keys()].map((url) => ({ url })); },
    async delete(request) { return storage.delete(key(request)); },
  };
  const environment = {
    URL, Set, Promise, Response,
    caches: {
      open: async () => cache,
      match: async (request) => cache.match(request),
      keys: async () => ['mira-shell-v5'],
      delete: async () => true,
    },
    fetch: async () => {
      calls += 1;
      if (failNetwork) throw new Error('offline');
      return new Response('network response', { headers: { 'cache-control': cacheControl } });
    },
    self: {
      location: { origin },
      addEventListener: (name, fn) => handlers.set(name, fn),
      skipWaiting: async () => {},
      clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} },
    },
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), environment, { filename: 'public/sw.js' });
  return {
    storage,
    get calls() { return calls; },
    set offline(value) { failNetwork = value; },
    set cacheControl(value) { cacheControl = value; },
    async request(path, { mode = 'cors', destination = '', method = 'GET' } = {}) {
      const request = { url: origin + path, mode, destination, method };
      let response;
      handlers.get('fetch')({ request, respondWith(promise) { response = promise; } });
      return response ? await response : null;
    },
  };
}

test('offline worker never intercepts APIs or non-static personal fetches', async () => {
  const env = workerFixture();
  assert.equal(await env.request('/api/history?device=private'), null);
  assert.equal(await env.request('/api/profile?export=1', { destination: 'script' }), null);
  assert.equal(await env.request('/profile/export'), null);
  assert.equal(env.storage.size, 0);
  assert.equal(env.calls, 0);
});
test('worker caches only allowlisted static resources', async () => {
  const env = workerFixture();
  assert.equal((await env.request('/assets/app.js', { destination: 'script' })).status, 200);
  assert.equal(env.calls, 1);
  assert.equal(env.storage.size, 1);
  assert.equal((await env.request('/assets/app.js', { destination: 'script' })).status, 200);
  assert.equal(env.calls, 1);
});
test('worker respects private/no-store response headers', async () => {
  for (const directive of ['private, max-age=0', 'no-store', 'no-cache']) {
    const env = workerFixture();
    env.cacheControl = directive;
    await env.request('/assets/main.css', { destination: 'style' });
    assert.equal(env.storage.size, 0);
  }
});
test('navigation uses network then only stored offline shell when disconnected', async () => {
  const env = workerFixture();
  assert.equal((await env.request('/', { mode: 'navigate' })).status, 200);
  assert.equal(env.storage.size, 1);
  env.offline = true;
  assert.equal((await env.request('/', { mode: 'navigate' })).status, 200);
});
test('sensitive API responses explicitly prohibit caching', () => {
  const headers = new Map();
  markPrivateResponse({ setHeader(key, value) { headers.set(key.toLowerCase(), value); } });
  assert.match(headers.get('cache-control'), /no-store/);
  assert.match(headers.get('cache-control'), /private/);
  for (const name of ['history', 'memory', 'profile', 'facts', 'identity-capsule', 'chat']) {
    const source = readFileSync(`api/${name}.js`, 'utf8');
    assert.match(source, /markPrivateResponse\(res\)/, name);
  }
});
