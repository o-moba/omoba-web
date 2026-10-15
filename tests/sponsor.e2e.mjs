// Controlled local Registry/Studio fixtures. This verifies the browser and BFF,
// not Registry moderation correctness or a hosted deployment.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const output = process.env.SPONSOR_EVIDENCE_DIR || '.agent/tasks/community-sculptures/raw/browser';
await mkdir(output, { recursive: true });
function fixtureGlb() {
  const bin = Buffer.alloc(36); [-.6, 0, 0, .6, 0, 0, 0, 1, 0].forEach((n, i) => bin.writeFloatLE(n, i * 4));
  const doc = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }], materials: [{ doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [.9, .7, .2, 1] } }],
    buffers: [{ byteLength: bin.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-.6, 0, 0], max: [.6, 1, 0] }] };
  const raw = Buffer.from(JSON.stringify(doc));
  const json = Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4, 32)]);
  const out = Buffer.alloc(28 + json.length + bin.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(json.length, 12); out.writeUInt32LE(0x4e4f534a, 16); json.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + json.length); out.writeUInt32LE(0x004e4942, 24 + json.length); bin.copy(out, 28 + json.length);
  return out;
}
const model = process.env.OMOBA_SCULPTURE_MODEL ? await readFile(process.env.OMOBA_SCULPTURE_MODEL) : fixtureGlb();
const sha = createHash('sha256').update(model).digest('hex');
const TOKEN = randomBytes(48).toString('base64url'), DEVICE = randomBytes(32).toString('base64url');
const MARKET_TOKEN = randomBytes(48).toString('base64url');
const ASSET = 'ekza:map_prop:' + randomUUID(), REVISION = randomUUID();
const state = { approved: false, wrongScope: false, expired: false, outage: false, lostResponse: true, placement: null, creates: [], starts: [], requests: [], downloads: 0, signOuts: 0 };
let registryOrigin;
const json = (res, value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
const error = (res, code, status) => json(res, { error: { code } }, status);
const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return chunks.length ? JSON.parse(Buffer.concat(chunks)) : null; };
const live = () => state.placement?.status === 'active' ? state.placement : null;
const registry = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  state.requests.push({ method: req.method, url: req.url });
  if (req.url.startsWith('/studio?')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><h1>OMOBA requests map-placement permission</h1><p>Submit and cancel your sculpture placements.</p><button onclick="fetch(\'/approve\',{method:\'POST\'}).then(()=>this.textContent=\'Approved\')">Allow sculpture placement</button>'); return;
  }
  if (req.url === '/approve') { state.approved = true; json(res, {}); return; }
  if (state.outage) { error(res, 'unavailable', 503); return; }
  if (req.url === '/v1/projects/omoba/placements/slots') {
    json(res, { serverNow: new Date().toISOString(), slots: [{ id: 'opposite-dragon', name: 'Opposite the dragon', durationSeconds: 86400, enabled: true, current: live() }] }); return;
  }
  if (req.url === '/v2/assets?kind=map_prop&project=omoba&platform=desktop&profile=map-prop-glb-v1') {
    json(res, { schema: 'ekza.asset.catalog.v2', items: [{ id: ASSET, assetKind: 'map_prop', name: 'Lucky waving cat', description: 'Original test sculpture.', access: 'free',
      creator: { name: 'OMOBA community' }, license: { text: 'CC0-1.0', attribution: 'OMOBA\ncommunity' }, origin: { kind: 'studio', revisionId: REVISION },
      renditions: [{ platform: 'desktop', profile: 'map-prop-glb-v1', format: 'glb', sha256: sha, sizeBytes: model.length, downloadUrl: `${registryOrigin}/v1/studio/assets/${sha}/rendition` }],
      projectSupport: [{ projectId: 'omoba', platform: 'desktop', profile: 'map-prop-glb-v1', status: 'approved', requirementId: 'community.map.sculpture' }] }] }); return;
  }
  if (req.url === `/v1/studio/assets/${sha}/rendition`) { state.downloads++; res.writeHead(200, { 'Content-Type': 'model/gltf-binary' }); res.end(model); return; }
  if (req.url === '/v1/account/device') {
    const value = await body(req); state.starts.push(value); state.approved = false;
    json(res, { deviceCode: DEVICE, userCode: 'ABCD2345', expiresAt: new Date(Date.now() + 600000).toISOString(), interval: 1, verificationUrl: registryOrigin + '/studio?view=connect&code=ABCD2345' }); return;
  }
  if (req.url === '/v1/account/device/poll') {
    assert.deepEqual(await body(req), { deviceCode: DEVICE });
    json(res, state.approved ? { status: 'approved', accessToken: TOKEN, projectId: 'omoba', scope: state.wrongScope ? 'library-claim' : 'map-placement', account: { username: 'tester' }, expiresAt: new Date(Date.now() + 3600000).toISOString() } : { status: 'pending' }); return;
  }
  if (req.url === '/v1/account/session' && req.method === 'DELETE') { assert.equal(req.headers.authorization, 'Bearer ' + TOKEN); state.signOuts++; res.writeHead(204); res.end(); return; }
  if (req.url.startsWith('/v1/account/placements')) {
    if (state.expired || req.headers.authorization !== 'Bearer ' + TOKEN) { error(res, 'link_invalid', 401); return; }
    if (req.url === '/v1/account/placements' && req.method === 'GET') { json(res, { items: state.placement ? [state.placement] : [] }); return; }
    if (req.url === '/v1/account/placements' && req.method === 'POST') {
      const value = await body(req); state.creates.push(value);
      if (!state.placement) state.placement = { id: randomUUID(), project: 'omoba', slotId: value.slotId, assetId: value.assetId, revisionId: value.revisionId,
        renditionSha256: value.renditionSha256, renditionBytes: model.length, renditionUrl: `${registryOrigin}/v1/studio/assets/${sha}/rendition`, title: value.title, credit: value.credit,
        startsAt: null, expiresAt: null, status: 'pending', paymentMode: 'free', createdAt: new Date().toISOString(), reason: '' };
      if (state.lostResponse) { state.lostResponse = false; error(res, 'unavailable', 503); return; }
      json(res, state.placement); return;
    }
    if (req.url === `/v1/account/placements/${state.placement?.id}/cancel` && req.method === 'POST') { state.placement.status = 'cancelled'; json(res, state.placement); return; }
  }
  error(res, 'not_found', 404);
});
await new Promise(resolve => registry.listen(0, '127.0.0.1', resolve));
registryOrigin = 'http://127.0.0.1:' + registry.address().port;
const port = Number(process.env.SPONSOR_TEST_PORT || 3034), origin = 'http://127.0.0.1:' + port;
const server = spawn(process.execPath, ['scripts/start.mjs'], { env: { ...process.env, PORT: String(port), OMOBA_CONTOUR: process.env.OMOBA_CONTOUR || 'production', OMOBA_ACCOUNT_MODE: 'disabled',
  OMOBA_PORTAL_ORIGIN: origin, OMOBA_ALLOW_INSECURE_LOCAL: '1', OMOBA_REGISTRY_URL: registryOrigin, OMOBA_STUDIO_URL: registryOrigin }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; server.stdout.on('data', chunk => log += chunk); server.stderr.on('data', chunk => log += chunk);
let browser;
const checks = [];
try {
  for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw new Error(log); try { if ((await fetch(origin + '/sponsor')).ok) break; } catch {} if (i === 99) throw new Error('Server startup timeout: ' + log); await new Promise(resolve => setTimeout(resolve, 200)); }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, locale: 'en' });
  await context.addCookies([{ name: 'omoba-ekza-link', value: MARKET_TOKEN, url: origin, httpOnly: true }]);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', async response => { if (response.url().startsWith(origin + '/api/sponsor/') && response.status() >= 400) console.log('BFF', response.status(), response.url().split('/api/sponsor/')[1], await response.text()); });
  await page.goto(origin + '/sponsor');
  await page.getByRole('heading', { name: 'Leave a little luck on the map.' }).waitFor();
  assert.equal(await page.getByLabel('Credit', { exact: true }).inputValue(), 'OMOBA community');
  assert.equal(state.downloads, 0);
  assert.equal(await page.locator('canvas').count(), 0);
  assert.equal((await context.request.get(origin + '/api/sponsor/placements')).status(), 401);
  checks.push('Public SSR page with no eager GLB; existing market token grants no placement authority');
  await page.getByRole('button', { name: 'View in 3D', exact: true }).click();
  await page.locator('[data-asset-render-state="ready"]').waitFor({ timeout: 30000 });
  await page.screenshot({ path: output + '/sculpture-preview.png' });
  const modelJson = JSON.parse(model.subarray(20, 20 + model.readUInt32LE(12)).toString('utf8'));
  if (modelJson.animations?.length) {
    const canvas = page.getByRole('dialog').locator('canvas');
    const firstFrame = await canvas.screenshot({ path: output + '/sculpture-motion-a.png' });
    await new Promise(resolve => setTimeout(resolve, 450));
    const nextFrame = await canvas.screenshot({ path: output + '/sculpture-motion-b.png' });
    assert.equal(firstFrame.equals(nextFrame), false, 'Opted-in sculpture animation must change rendered pixels with auto-rotate off');
    checks.push('Original sculpture clip animates through the shared SDK with auto-rotate off');
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('canvas').count(), 0);
  checks.push('Shared integrity-bound SDK preview opens and releases canvas');
  await page.getByRole('button', { name: 'Connect for sculpture placement', exact: true }).click();
  await page.getByText('ABCD2345', { exact: true }).waitFor().catch(async error => { await page.screenshot({path:output + '/failure.png'}); console.log('Fixture requests', state.requests); throw error; });
  const popupPromise = context.waitForEvent('page');
  await page.getByRole('link', { name: 'Open Ekza Studio ↗', exact: true }).click();
  const popup = await popupPromise; await popup.getByRole('button', { name: 'Allow sculpture placement' }).click();
  await page.getByRole('heading', { name: 'Ready to submit', exact: true }).waitFor();
  await popup.close();
  assert.deepEqual(state.starts[0], { projectId: 'omoba', scope: 'map-placement' });
  const cookies = await context.cookies();
  assert.equal(cookies.find(cookie => cookie.name === 'omoba-ekza-placement').httpOnly, true);
  assert.equal(cookies.find(cookie => cookie.name === 'omoba-ekza-placement').sameSite, 'Lax');
  assert.equal(await page.evaluate(token => document.cookie.includes(token) || JSON.stringify(localStorage).includes(token), TOKEN), false);
  assert.equal((await page.content()).includes(TOKEN), false);
  checks.push('Dedicated map-placement consent stores a separate HttpOnly session; no browser credential exposure');
  const csrf = (await (await context.request.get(origin + '/api/sponsor/csrf')).json()).token;
  const before = state.requests.length;
  assert.equal((await context.request.post(origin + '/api/sponsor/placements', { data: {}, headers: { Origin: 'https://evil.example', 'X-CSRF-Token': csrf } })).status(), 403);
  assert.equal((await context.request.post(origin + '/api/sponsor/placements', { data: { paid: true }, headers: { Origin: origin, 'X-CSRF-Token': csrf } })).status(), 400);
  assert.equal((await context.request.post(origin + '/api/sponsor/payments', { data: { transactionHash: 'fake' }, headers: { Origin: origin, 'X-CSRF-Token': csrf } })).status(), 404);
  assert.equal((await context.request.get(origin + '/api/sponsor/placements?account=other')).status(), 400);
  assert.equal(state.requests.length, before);
  checks.push('CSRF, unknown body fields, fake payment route and queries rejected before Registry');
  await page.getByLabel('Placement title', { exact: true }).fill('A lucky day');
  await page.getByLabel('Credit', { exact: true }).fill('Community test artist');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Submit free placement', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'The sculpture service is unavailable' }).waitFor();
  await page.getByRole('button', { name: 'Submit free placement', exact: true }).click();
  await page.getByText('Waiting for review', { exact: true }).waitFor();
  assert.equal(state.creates.length, 2);
  assert.deepEqual(state.creates[0], state.creates[1]);
  assert.equal(state.creates[0].rightsAccepted, true);
  assert.equal(state.creates[0].assetId, ASSET);
  assert.equal(await page.getByRole('button', { name: 'Submit free placement', exact: true }).isDisabled(), true);
  await page.screenshot({ path: output + '/sculpture-pending.png', fullPage: true });
  checks.push('A lost create response retries the same immutable payload/idempotency key; pending quota disables another request');
  // Controlled server-side state changes model administrator decisions, never a browser approval action.
  state.placement.status = 'active'; state.placement.startsAt = new Date(Date.now() - 1000).toISOString(); state.placement.expiresAt = new Date(Date.parse(state.placement.startsAt) + 86400000).toISOString();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByText('Active on the map', { exact: true }).waitFor();
  await page.getByText('Currently on the map:', { exact: false }).waitFor();
  await page.screenshot({ path: output + '/sculpture-active.png', fullPage: true });
  await page.getByRole('button', { name: 'Cancel placement', exact: true }).click();
  await page.getByText('Cancelled', { exact: true }).waitFor();
  assert.equal(state.placement.status, 'cancelled');
  checks.push('Administrator fixture activation updates occupied slot and 24h period; own cancellation removes active status');
  state.placement.status = 'rejected'; state.placement.reason = '<script>window.reviewInjected=true</script> Please change the title.';
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByText('Declined', { exact: true }).waitFor();
  assert.ok(await page.getByText(state.placement.reason, { exact: false }).isVisible());
  assert.equal(await page.evaluate(() => window.reviewInjected), undefined);
  for (const [status, label] of [['expired', 'Placement finished'], ['revoked', 'Removed by administrator']]) {
    state.placement.status = status; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await page.getByText(label, { exact: true }).waitFor();
  }
  checks.push('Rejected review note is plain text; expired and revoked statuses cannot be cancelled or activated');
  await page.getByRole('button', { name: 'Disconnect placement permission', exact: true }).click();
  await page.getByRole('button', { name: 'Connect for sculpture placement', exact: true }).waitFor();
  assert.equal(state.signOuts, 1);
  assert.equal((await context.cookies()).some(cookie => cookie.name === 'omoba-ekza-placement'), false);
  assert.equal((await context.cookies()).find(cookie => cookie.name === 'omoba-ekza-link').value, MARKET_TOKEN);
  state.wrongScope = true;
  await page.getByRole('button', { name: 'Connect for sculpture placement', exact: true }).click();
  await page.getByText('ABCD2345', { exact: true }).waitFor(); state.approved = true;
  await page.getByRole('alert').filter({ hasText: 'Allow sculpture placement' }).waitFor();
  assert.equal((await context.cookies()).some(cookie => cookie.name === 'omoba-ekza-placement'), false);
  checks.push('Sign-out revokes only placement link; wrong returned market scope is rejected');
  assert.deepEqual(errors, []);
  assert.equal(await page.locator('a[href^="solana:"],a[href^="bitcoin:"],a[href^="ethereum:"]').count(), 0);
  await writeFile(output + '/verification.json', JSON.stringify({ checks, modelSha256: sha, modelBytes: model.length, fixture: process.env.OMOBA_SCULPTURE_MODEL ? 'Provided local sculpture GLB' : 'Generated triangle GLB', viewport: '1280x960', locale: 'en', errors }, null, 2));
  console.log(checks.join('\n'));
} finally {
  await browser?.close(); server.kill('SIGTERM'); registry.closeAllConnections(); await new Promise(resolve => registry.close(resolve));
  await writeFile(output + '/server.log', log);
}
