import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { server } = await import('../server.js');

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const base = `http://127.0.0.1:${address.port}`;

test('health endpoint identifies BYOK mode', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).mode, 'BYOK');
});
test('serves bundled app and prompt module', async () => {
  const homepage = await fetch(`${base}/`);
  assert.equal(homepage.status, 200);
  assert.match(await homepage.text(), /PageForge AI/);
  const prompts = await fetch(`${base}/prompts.js`);
  assert.equal(prompts.status, 200);
});
test('never forwards empty or invalid API credentials', async () => {
  const res = await fetch(`${base}/api/image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'not-valid', prompt: 'Detailed cinematic image', model: 'gpt-image-1.5' }) });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /API key/i);
});
test('does not expose server source as a static asset', async () => {
  const res = await fetch(`${base}/server.js`);
  assert.equal(res.status, 404);
});
test('provides basic restrictive security headers', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(res.headers.get('Content-Security-Policy'), /default-src 'self'/);
});

test('close test server', async () => { await new Promise(resolve => server.close(resolve)); });
