// Run against a RU production build on an explicit loopback listener. No account
// API or VK credentials are needed; this test only reads public routes.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';

const origin = new URL(process.env.OMOBA_IOS_HTTP_ORIGIN || 'http://127.0.0.1:3022');
assert.equal(origin.hostname, '127.0.0.1');
assert.equal(origin.protocol, 'http:');
assert.ok(origin.port && origin.pathname === '/' && !origin.search && !origin.hash);
const endpoint = '/.well-known/apple-app-site-association';
const results = [];
// Node fetch normalizes Host to the listener. Use HTTP directly to exercise
// exactly the virtual-host header that Nginx sends to the standalone server.
function request(path, options) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(new URL(path, origin), options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(new Response(options.method === 'HEAD' ? null : Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(10_000, () => req.destroy(new Error('HTTP check timed out')));
    req.end();
  });
}
for (const method of ['GET', 'HEAD']) {
  const response = await request(endpoint, { method, headers: { Host: 'ios.omoba.ru' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  if (method === 'HEAD') assert.equal(await response.text(), '');
  else assert.deepEqual(await response.json(), { applinks: { details: [{ appIDs: ['QSRX2Y2RJB.space.ekza.omoba.beta'], components: [{ '/': '/auth' }] }] } });
  results.push(method + ' association: PASS');
}
for (const host of ['omoba.ru', 'evil.example', 'ios.dev.omoba.io']) {
  const response = await request(endpoint, { method: 'GET', headers: { Host: host, 'X-Forwarded-Host': 'ios.omoba.ru' } });
  assert.equal(response.status, 404, host);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(await response.json(), { error: 'not_found' });
  results.push('Refuse ' + host + ': PASS');
}
const fallback = await request('/auth', { method: 'GET', headers: { Host: 'ios.omoba.ru' } });
assert.equal(fallback.status, 200);
assert.equal(fallback.headers.get('location'), null);
assert.equal(fallback.headers.get('set-cookie'), null);
const html = await fallback.text();
assert.ok(html.includes('Вернитесь в OMOBA'));
assert.ok(html.includes('Открытие этой страницы не выполняет вход и не меняет аккаунт.'));
assert.ok(html.includes('href="https://omoba.ru/download"'));
assert.ok(html.includes('noindex'));
results.push('Informational fallback without sign-in: PASS');
console.log(results.join('\n'));
if (process.env.OMOBA_IOS_HTTP_EVIDENCE) await writeFile(process.env.OMOBA_IOS_HTTP_EVIDENCE, JSON.stringify({ checks: results.length, results }, null, 2) + '\n');
