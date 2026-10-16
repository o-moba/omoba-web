import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { MAX_POLL_BACKOFF_SECONDS, WILDSPARK_SET_REQUIREMENT, devicePollRetry, isWildsparkHandheld, marketGroups, parseMarket, studioDraftUrl, studioLibraryUrl } from '../src/lib/market.mjs';
import { ekzaConfig, ekzaCookieNames, ekzaRoute, parseDeviceStart, parseLibrary, parsePoll, safeVerificationUrl, studioOrigin, upstreamFailure } from '../src/lib/ekza-link.mjs';
import { SIGN_OUT_TIMEOUT_MS, loadMarket, readLibrary, registryRequest, revokeLink } from '../src/lib/market-server.mjs';
import { mutationAllowed } from '../src/lib/security.mjs';

const REGISTRY = 'https://registry.ekza.io';
const sha = n => n.repeat(64).slice(0, 64);
const uuid = n => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n.repeat(12)}`;
function item(n, overrides = {}) {
  const kind = overrides.assetKind || 'weapon';
  const profile = kind === 'avatar' ? 'humanoid-glb-v1' : 'handheld-glb-v1';
  const digest = sha(n);
  return {
    id: `ekza:${kind}:${uuid(n)}`, assetKind: kind, name: 'Item ' + n, description: 'A test item.',
    thumbnailUrl: `${REGISTRY}/v1/studio/assets/${sha('f')}/rendition-thumbnail`,
    license: { text: 'CC-BY-4.0', attribution: 'Test artist' }, creator: { name: 'artist-' + n },
    origin: { kind: 'studio', revisionId: uuid('e') }, access: 'free',
    renditions: [{ platform: 'desktop', profile, profileVersion: 1, format: 'glb', mediaType: 'model/gltf-binary',
      sha256: digest, sizeBytes: 2048, downloadUrl: `${REGISTRY}/v1/studio/assets/${digest}/rendition` }],
    projectSupport: [{ projectId: 'omoba', platform: 'desktop', profile, status: 'approved', requirementId: null }],
    ...overrides,
  };
}
const catalogue = items => ({ schema: 'ekza.asset.catalog.v2', count: items.length, items });

test('market parser keeps approved free OMOBA items and groups Wildspark sets by requirement', () => {
  const set = item('a', { name: 'Candy Neon set', projectSupport: [{ projectId: 'omoba', platform: 'desktop', profile: 'handheld-glb-v1', status: 'approved', requirementId: WILDSPARK_SET_REQUIREMENT }] });
  const hammer = item('b', { name: 'Hammer', projectSupport: [{ projectId: 'omoba', platform: 'desktop', profile: 'handheld-glb-v1', status: 'approved' }] });
  const avatar = item('c', { assetKind: 'avatar', name: 'Wizard', license: { text: 'CC0', attribution: '' } });
  const { items, skipped } = parseMarket(catalogue([hammer, avatar, set]), REGISTRY);
  assert.equal(skipped, 0);
  assert.deepEqual(items.map(i => i.name), ['Candy Neon set', 'Hammer', 'Wizard']);
  const groups = marketGroups(items);
  assert.deepEqual(groups.wildspark.map(i => i.assetId), [uuid('a')]);
  assert.deepEqual(groups.weapons.map(i => i.assetId), [uuid('b')]);
  assert.deepEqual(groups.avatars.map(i => i.assetId), [uuid('c')]);
  assert.equal(items[0].wildspark, true);
  assert.equal(items[1].requirementId, null);
  assert.equal(items[2].license.attribution, '');
  assert.equal(items[2].profile, 'humanoid-glb-v1');
});

test('one hostile or unsupported item is skipped without dropping the market', () => {
  const foreign = 'https://evil.example/v1/studio/assets/' + sha('f') + '/rendition-thumbnail';
  const hostile = [
    item('1', { access: 'owned' }),
    item('2', { id: 'ekza:weapon:not-a-uuid' }),
    item('3', { assetKind: 'avatar' , renditions: item('3').renditions }),
    item('4', { projectSupport: [{ projectId: 'omoba', platform: 'desktop', profile: 'handheld-glb-v1', status: 'pending' }] }),
    item('5', { projectSupport: [{ projectId: 'ekza-mirror', platform: 'ios', profile: 'arkit-body-v1', status: 'approved' }] }),
    item('6', { origin: { kind: 'solana', provenance: {} } }),
    item('7', { name: 'x'.repeat(161) }),
    item('8', { creator: { name: 'bad\u0007name' } }),
    item('9', { renditions: [{ ...item('9').renditions[0], downloadUrl: 'https://evil.example/file.glb' }] }),
    item('0', { projectSupport: [{ projectId: 'omoba', platform: 'desktop', profile: 'handheld-glb-v1', status: 'approved', requirementId: 'Bad Requirement' }] }),
    'not an object',
  ];
  const good = item('d', { thumbnailUrl: foreign });
  const { items, skipped } = parseMarket(catalogue([...hostile, good, good]), REGISTRY);
  assert.equal(skipped, hostile.length + 1, 'duplicate IDs are skipped too');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnailUrl, null, 'foreign previews are dropped, not rendered');
  assert.equal(items[0].modelUrl, good.renditions[0].downloadUrl, '3D uses the exact validated approved rendition');
  const local = parseMarket(catalogue([item('d', { thumbnailUrl: REGISTRY + '/v1/studio/assets/' + sha('f') + '/rendition-thumbnail?x=1' })]), REGISTRY);
  assert.equal(local.items[0].thumbnailUrl, null);
  // Registry files must sit under the configured origin, not the default one.
  assert.equal(parseMarket(catalogue([item('d')]), 'http://127.0.0.1:8018').items.length, 0);
});

test('a malformed catalogue document fails instead of looking empty', () => {
  for (const value of [null, [], {}, { schema: 'ekza.avatar.catalog.v2', items: [] }, { schema: 'ekza.asset.catalog.v2' },
    { schema: 'ekza.asset.catalog.v2', items: new Array(501).fill(item('a')) }, '{not json', 'x'.repeat(2 * 1024 * 1024 + 1)])
    assert.throws(() => parseMarket(value, REGISTRY), /Invalid market catalogue/);
  for (const origin of [undefined, 'not a url', REGISTRY + '/'])
    assert.throws(() => parseMarket(catalogue([]), origin), /registry origin/);
  assert.deepEqual(parseMarket(catalogue([]), REGISTRY), { items: [], skipped: 0 });
});

test('Studio deep links carry the Wildspark set requirement only', () => {
  const wildspark = 'https://studio.ekza.io/studio?view=new&kind=weapon&project=omoba&requirement=wildspark.handheld.set';
  assert.equal(studioDraftUrl(undefined, WILDSPARK_SET_REQUIREMENT), wildspark);
  for (const id of ['wildspark.handheld.repeater', 'wildspark.handheld.launcher']) {
    assert.equal(isWildsparkHandheld(id), true);
    assert.equal(studioDraftUrl('https://studio.ekza.io', id), wildspark);
  }
  assert.equal(studioDraftUrl('https://studio.ekza.io', 'riftshot.handheld.repeater'), 'https://studio.ekza.io/studio?view=new');
  assert.equal(studioDraftUrl('http://127.0.0.1:5188', WILDSPARK_SET_REQUIREMENT), wildspark.replace('https://studio.ekza.io', 'http://127.0.0.1:5188'));
  // Created and Studio-saved items are managed in the Studio library.
  assert.equal(studioLibraryUrl(), 'https://studio.ekza.io/studio?view=library');
  assert.equal(studioLibraryUrl('http://127.0.0.1:5188'), 'http://127.0.0.1:5188/studio?view=library');
});

test('Registry and Studio origins are fixed unless a loopback double is explicitly allowed', () => {
  assert.deepEqual(ekzaConfig({}), { registry: 'https://registry.ekza.io', studio: 'https://studio.ekza.io' });
  assert.deepEqual(ekzaConfig({ OMOBA_REGISTRY_URL: 'https://registry.ekza.io/' }).registry, 'https://registry.ekza.io');
  for (const url of ['http://127.0.0.1:8018', 'https://registry.example', 'http://localhost:8018'])
    assert.throws(() => ekzaConfig({ OMOBA_REGISTRY_URL: url }), /Registry URL/);
  const local = { OMOBA_ALLOW_INSECURE_LOCAL: '1', OMOBA_REGISTRY_URL: 'http://127.0.0.1:8018', OMOBA_STUDIO_URL: 'http://localhost:5188' };
  assert.deepEqual(ekzaConfig(local), { registry: 'http://127.0.0.1:8018', studio: 'http://localhost:5188' });
  for (const url of ['http://registry.example', 'https://registry.example', 'http://u:p@127.0.0.1:8018', 'http://127.0.0.1:8018/v2', 'http://127.0.0.1:8018/?x=1', 'ftp://127.0.0.1', 'not a url'])
    assert.throws(() => ekzaConfig({ OMOBA_ALLOW_INSECURE_LOCAL: '1', OMOBA_REGISTRY_URL: url }));
  assert.throws(() => ekzaConfig({ OMOBA_STUDIO_URL: 'https://studio.evil.example' }), /Studio URL/);
  // Links never point at an untrusted Studio, even when the Registry override is wrong.
  assert.equal(studioOrigin({ OMOBA_STUDIO_URL: 'https://studio.evil.example' }), 'https://studio.ekza.io');
  assert.equal(studioOrigin({ OMOBA_REGISTRY_URL: 'http://bad.example', OMOBA_ALLOW_INSECURE_LOCAL: '1', OMOBA_STUDIO_URL: 'http://127.0.0.1:5188' }), 'http://127.0.0.1:5188');
});

test('the Ekza BFF exposes a narrow route allowlist', () => {
  const id = uuid('a');
  assert.deepEqual(ekzaRoute('csrf', 'GET'), { action: 'csrf' });
  assert.deepEqual(ekzaRoute('device', 'POST'), { action: 'start' });
  assert.deepEqual(ekzaRoute('device/poll', 'POST'), { action: 'poll' });
  assert.deepEqual(ekzaRoute('library', 'GET'), { action: 'library' });
  assert.deepEqual(ekzaRoute('library/' + id, 'POST'), { action: 'claim', assetId: id });
  assert.deepEqual(ekzaRoute('library/' + id, 'DELETE'), { action: 'unclaim', assetId: id });
  assert.deepEqual(ekzaRoute('sign-out', 'POST'), { action: 'sign-out' });
  for (const [path, method] of [['csrf', 'POST'], ['device', 'GET'], ['library', 'POST'], ['library', 'DELETE'], ['sign-out', 'GET'],
    ['library/' + id, 'GET'], ['library/' + id.toUpperCase(), 'POST'], ['library/ekza:weapon:' + id, 'POST'], ['library/' + id + '/x', 'POST'],
    ['library/../device', 'POST'], ['session', 'POST'], ['account/library', 'GET'], ['https://evil.example', 'GET'], ['device/poll/', 'POST']])
    assert.equal(ekzaRoute(path, method), null, path + ' ' + method);
});

test('market mutations reuse the exact-origin CSRF rule and host-only cookies', () => {
  const token = 'c'.repeat(64);
  assert.equal(mutationAllowed('https://app.omoba.io', 'https://app.omoba.io', token, token), true);
  assert.equal(mutationAllowed('https://omoba-app.vercel.app', 'https://app.omoba.io', token, token), false);
  assert.equal(mutationAllowed('https://app.omoba.io', 'https://app.omoba.io', token, 'd'.repeat(64)), false);
  const secure = ekzaCookieNames(true), local = ekzaCookieNames(false);
  for (const name of Object.values(secure)) assert.ok(name.startsWith('__Host-'));
  assert.deepEqual(local, { link: 'omoba-ekza-link', device: 'omoba-ekza-device', csrf: 'omoba-ekza-csrf' });
  assert.notEqual(secure.csrf, '__Host-omoba-csrf', 'independent of the disabled Account API CSRF route');
});

test('device start keeps the device code server-side and trusts only the Studio approval page', () => {
  const now = Date.parse('2026-10-11T10:00:00Z');
  const response = { deviceCode: 'd'.repeat(43), userCode: 'ABCD2345', verificationUrl: 'https://studio.ekza.io/studio?view=connect&code=ABCD2345', expiresAt: '2026-10-11T10:10:00Z', interval: 3 };
  const parsed = parseDeviceStart(response, 'https://studio.ekza.io', now);
  assert.equal(parsed.maxAge, 600);
  assert.deepEqual(parsed.browser, { userCode: 'ABCD2345', verificationUrl: response.verificationUrl, expiresAt: '2026-10-11T10:10:00.000Z', interval: 3 });
  assert.equal(JSON.stringify(parsed.browser).includes(response.deviceCode), false);
  for (const url of ['https://evil.example/studio?view=connect&code=ABCD2345', 'https://studio.ekza.io/studio?view=connect&code=WXYZ2345',
    'https://studio.ekza.io/login?view=connect&code=ABCD2345', 'https://studio.ekza.io/studio?view=connect&code=ABCD2345&next=https://evil.example',
    'http://studio.ekza.io/studio?view=connect&code=ABCD2345', 'javascript:alert(1)'])
    assert.equal(safeVerificationUrl(url, 'https://studio.ekza.io', 'ABCD2345'), null, url);
  assert.equal(parseDeviceStart({ ...response, verificationUrl: 'https://evil.example/' }, 'https://studio.ekza.io', now).browser.verificationUrl, null);
  for (const bad of [{ ...response, deviceCode: 'short' }, { ...response, userCode: 'abcd2345' }, { ...response, userCode: 'ABCD1234' }, { ...response, expiresAt: '2026-10-11T09:00:00Z' }, null])
    assert.throws(() => parseDeviceStart(bad, 'https://studio.ekza.io', now));
  assert.equal(parseDeviceStart({ ...response, interval: 999 }, 'https://studio.ekza.io', now).browser.interval, 30);
});

test('poll approval requires an OMOBA link token, account name and future expiry', () => {
  const now = Date.parse('2026-10-11T10:00:00Z');
  const approved = { status: 'approved', scope: 'library-claim', accessToken: 't'.repeat(64), expiresAt: '2027-01-09T10:00:00Z', projectId: 'omoba', account: { username: 'jinx-player' } };
  assert.deepEqual(parsePoll({ status: 'pending' }, now), { status: 'pending' });
  const parsed = parsePoll(approved, now);
  assert.equal(parsed.username, 'jinx-player');
  assert.equal(parsed.maxAge, 90 * 86400);
  assert.equal(parsed.scope, 'library-claim');
  for (const bad of [{ ...approved, projectId: 'ekza-space' }, { ...approved, accessToken: 'short' }, { ...approved, accessToken: 't'.repeat(63) + '/' },
    { ...approved, account: {} }, { ...approved, expiresAt: '2020-01-01T00:00:00Z' }, { status: 'denied' }, null])
    assert.throws(() => parsePoll(bad, now));
});

test('library ownership reads additive assets and legacy avatar items, skipping malformed entries', () => {
  const library = parseLibrary({
    schema: 'ekza.account.library.v1', projectId: 'omoba', account: { username: 'jinx-player' }, expiresAt: '2027-01-09T10:00:00Z',
    items: [{ id: 'ekza:avatar:' + uuid('c') }, { id: 'ekza:weapon:' + uuid('9') }, { id: 7 }],
    assets: [{ id: 'ekza:weapon:' + uuid('a'), library: { reason: 'claimed' } }, { id: 'ekza:avatar:' + uuid('c'), library: { reason: 'saved' } },
      { id: 'ekza:weapon:' + uuid('b'), library: { reason: 'stolen' } }, { id: 'bad' }, null],
  });
  assert.equal(library.username, 'jinx-player');
  assert.deepEqual(library.owned, [
    { assetId: uuid('a'), kind: 'weapon', reason: 'claimed' },
    { assetId: uuid('c'), kind: 'avatar', reason: 'saved' },
    { assetId: uuid('b'), kind: 'weapon', reason: null },
  ]);
  const legacy = parseLibrary({ schema: 'ekza.account.library.v1', projectId: 'omoba', account: { username: 'p' }, expiresAt: 'x', items: [{ id: 'ekza:avatar:' + uuid('c') }] });
  assert.deepEqual(legacy.owned, [{ assetId: uuid('c'), kind: 'avatar', reason: null }]);
  for (const bad of [{}, { schema: 'ekza.account.library.v1', projectId: 'ekza-space', account: { username: 'p' } }, { schema: 'ekza.account.library.v1', projectId: 'omoba', account: {} }])
    assert.throws(() => parseLibrary(bad));
});

test('Registry failures map to stable, actionable codes without forwarding messages', () => {
  const error = code => ({ error: { code, message: 'internal detail' } });
  assert.deepEqual(upstreamFailure('claim', 401, error('link_invalid')), { status: 401, code: 'link_expired', clearLink: true });
  assert.deepEqual(upstreamFailure('library', 401, null), { status: 401, code: 'link_expired', clearLink: true });
  // A link that can never add items is cleared like an expired one; the player signs in again.
  for (const action of ['claim', 'unclaim', 'library'])
    assert.deepEqual(upstreamFailure(action, 403, error('link_scope')), { status: 403, code: 'link_scope', clearLink: true }, action);
  assert.deepEqual(upstreamFailure('start', 401, null), { status: 401, code: 'link_expired', clearLink: false }, 'no link is held while signing in');
  assert.equal(upstreamFailure('poll', 403, error('link_scope')).clearLink, false);
  assert.equal(upstreamFailure('claim', 403, error('forbidden')).clearLink, undefined, 'any other 403 keeps the link');
  // Remove from library: the Registry refuses created items, Studio saves and other games' claims.
  assert.deepEqual(upstreamFailure('unclaim', 409, error('claim_not_removable')), { status: 409, code: 'claim_not_removable' });
  assert.deepEqual(upstreamFailure('unclaim', 409, { detail: 'Conflict' }), { status: 502, code: 'registry_error' });
  assert.deepEqual(upstreamFailure('claim', 409, error('claim_not_removable')), { status: 502, code: 'registry_error' });
  assert.deepEqual(upstreamFailure('claim', 404, error('asset_not_available')), { status: 404, code: 'asset_not_available' });
  assert.deepEqual(upstreamFailure('claim', 404, { detail: 'Not Found' }), { status: 501, code: 'claims_unsupported' });
  assert.deepEqual(upstreamFailure('start', 422, error('validation_error')), { status: 501, code: 'claims_unsupported' });
  assert.deepEqual(upstreamFailure('poll', 410, error('link_expired')), { status: 410, code: 'device_expired', clearDevice: true });
  assert.deepEqual(upstreamFailure('claim', 429, null), { status: 429, code: 'rate_limited' });
  assert.deepEqual(upstreamFailure('start', 503, error('link_unavailable')), { status: 503, code: 'registry_unavailable' });
  assert.deepEqual(upstreamFailure('claim', 400, error('bad')), { status: 502, code: 'registry_error' });
  assert.equal(JSON.stringify(upstreamFailure('claim', 403, error('link_scope'))).includes('internal detail'), false);
});

async function fakeRegistry(handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { origin: 'http://127.0.0.1:' + server.address().port, close: () => new Promise(resolve => server.close(resolve)) };
}

test('device polling backs off on transient failures and stops on terminal ones', () => {
  // A cold start, one 5xx or a timeout must not strand a pending sign-in.
  assert.deepEqual([1, 2, 3, 4, 5, 6, 20].map(n => devicePollRetry('registry_unavailable', n, 3)), [3000, 6000, 12000, 24000, 30000, 30000, 30000]);
  assert.equal(MAX_POLL_BACKOFF_SECONDS, 30);
  assert.equal(devicePollRetry('rate_limited', 1, 1), 1000);
  assert.equal(devicePollRetry('rate_limited', 1, 1, 7), 7000, 'a longer Retry-After wins');
  assert.equal(devicePollRetry('rate_limited', 4, 3, 2), 24000, 'a shorter Retry-After does not shorten the backoff');
  assert.equal(devicePollRetry('rate_limited', 1, 3, 9999), 300000, 'Retry-After is bounded');
  for (const bad of [0, -1, 1.5, NaN, null, undefined]) assert.equal(devicePollRetry('registry_unavailable', 1, 3, bad), 3000);
  assert.equal(devicePollRetry('registry_unavailable', 0, 0), 3000, 'a malformed interval falls back to 3 s');
  for (const code of ['device_expired', 'link_scope', 'link_expired', 'claims_unsupported', 'csrf_rejected', 'invalid_service_response', 'registry_error', 'configuration_unavailable', 'not_found', ''])
    assert.equal(devicePollRetry(code, 1, 3), null, code);
});

test('market reads are bounded and an outage is unavailable, never an empty list', async () => {
  let mode = 'ok';
  const registry = await fakeRegistry((req, res) => {
    if (mode === 'hang') return; // never answers
    if (mode === 'redirect') { res.writeHead(302, { Location: 'https://evil.example/' }); return res.end(); }
    if (mode === 'down') { res.writeHead(503, { 'Content-Type': 'application/json' }); return res.end('{"error":{"code":"catalogue_unavailable"}}'); }
    if (mode === 'html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<html></html>'); }
    if (mode === 'large') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{"schema":"ekza.asset.catalog.v2","items":[],"pad":"'); res.write('x'.repeat(4096)); return res.end('"}'); }
    if (mode === 'broken') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"schema":"ekza.asset.catalog.v2","items":7}'); }
    assert.equal(req.url, '/v2/assets?project=omoba');
    const digest = sha('a');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(catalogue([item('a', {
      thumbnailUrl: null,
      renditions: [{ ...item('a').renditions[0], downloadUrl: registry.origin + '/v1/studio/assets/' + digest + '/rendition' }],
    })])));
  });
  const env = { OMOBA_ALLOW_INSECURE_LOCAL: '1', OMOBA_REGISTRY_URL: registry.origin };
  try {
    const ready = await loadMarket(env);
    assert.equal(ready.state, 'ready');
    assert.equal(ready.items.length, 1);
    for (const [next, reason] of [['down', 'status_503'], ['html', 'not_json'], ['redirect', 'network'], ['broken', 'invalid_catalogue']]) {
      mode = next;
      assert.deepEqual(await loadMarket(env), { state: 'unavailable', reason }, next);
    }
    mode = 'large';
    assert.deepEqual(await loadMarket(env, { maxBytes: 1024 }), { state: 'unavailable', reason: 'oversized' });
    mode = 'hang';
    const started = Date.now();
    assert.deepEqual(await loadMarket(env, { timeoutMs: 200 }), { state: 'unavailable', reason: 'timeout' });
    assert.ok(Date.now() - started < 2000);
    assert.deepEqual(await loadMarket({ OMOBA_REGISTRY_URL: registry.origin }), { state: 'unavailable', reason: 'configuration' });
  } finally {
    await registry.close();
  }
  assert.equal((await loadMarket(env, { timeoutMs: 500 })).state, 'unavailable', 'connection refused');
});

test('library reads send the link token only as a Bearer header to the Registry', async () => {
  const token = 'L'.repeat(64);
  let seen;
  const registry = await fakeRegistry((req, res) => {
    seen = { url: req.url, authorization: req.headers.authorization, cookie: req.headers.cookie };
    if (req.headers.authorization !== 'Bearer ' + token) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end('{"error":{"code":"link_invalid"}}'); }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ schema: 'ekza.account.library.v1', projectId: 'omoba', account: { username: 'jinx-player' }, expiresAt: '2027-01-01T00:00:00Z', items: [], assets: [{ id: 'ekza:weapon:' + uuid('a'), library: { reason: 'claimed' } }] }));
  });
  try {
    const session = await readLibrary(registry.origin, token);
    assert.deepEqual(session, { state: 'connected', username: 'jinx-player', expiresAt: '2027-01-01T00:00:00.000Z', owned: [{ assetId: uuid('a'), kind: 'weapon', reason: 'claimed' }] });
    assert.deepEqual(seen, { url: '/v1/account/library', authorization: 'Bearer ' + token, cookie: undefined });
    assert.deepEqual(await readLibrary(registry.origin, 'x'.repeat(64)), { state: 'expired' });
    const empty = await registryRequest(registry.origin, '/v1/account/library', { token });
    assert.equal(empty.status, 200);
  } finally {
    await registry.close();
  }
  assert.deepEqual(await readLibrary(registry.origin, token, { timeoutMs: 300 }), { state: 'unavailable' });
});

test('sign-out ends only the presented link in the Registry and never throws', async () => {
  const token = 'S'.repeat(64);
  let mode = 'ok';
  const seen = [];
  const registry = await fakeRegistry(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    seen.push({ method: req.method, url: req.url, authorization: req.headers.authorization, cookie: req.headers.cookie, body: Buffer.concat(chunks).length });
    if (mode === 'hang') return;
    if (mode === 'old') { res.writeHead(405, { 'Content-Type': 'application/json' }); return res.end('{"detail":"Method Not Allowed"}'); }
    if (mode === 'down') { res.writeHead(503, { 'Content-Type': 'application/json' }); return res.end('{"error":{"code":"unavailable"}}'); }
    if (mode === 'html') { res.writeHead(502, { 'Content-Type': 'text/html' }); return res.end('<html>bad gateway</html>'); }
    res.writeHead(204);
    res.end();
  });
  try {
    assert.equal(await revokeLink(registry.origin, token), true);
    assert.deepEqual(seen, [{ method: 'DELETE', url: '/v1/account/session', authorization: 'Bearer ' + token, cookie: undefined, body: 0 }]);
    // An older Registry without C7, an outage or a proxy page: not confirmed, still no throw.
    for (const next of ['old', 'down', 'html']) {
      mode = next;
      assert.equal(await revokeLink(registry.origin, token), false, next);
    }
    mode = 'hang';
    const started = Date.now();
    assert.equal(await revokeLink(registry.origin, token, { timeoutMs: 200 }), false);
    assert.ok(Date.now() - started < 2000);
    assert.ok(SIGN_OUT_TIMEOUT_MS <= 5000, 'sign-out never waits longer than a Registry read');
  } finally {
    await registry.close();
  }
  assert.equal(await revokeLink(registry.origin, token, { timeoutMs: 300 }), false, 'connection refused');
});

test('market copy has Russian and Chinese with matching placeholders', async () => {
  const load = async file => import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(await readFile(new URL(file, import.meta.url), 'utf8'))).toString('base64'));
  const { portalTranslations } = await load('../src/lib/i18n.ts');
  const { creatorTranslations } = await load('../src/lib/creator-translations.ts');
  const { marketTranslations, marketText } = await load('../src/lib/market-translations.ts');
  const parameters = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [english, translations] of Object.entries(marketTranslations))
    for (const locale of ['ru', 'zh']) {
      assert.ok(translations[locale]?.trim(), `${locale}: ${english}`);
      assert.deepEqual(parameters(translations[locale]), parameters(english), `${locale} placeholders: ${english}`);
    }
  const all = { ...portalTranslations, ...creatorTranslations, ...marketTranslations };
  const component = await readFile(new URL('../src/components/market.tsx', import.meta.url), 'utf8');
  const literals = [...component.matchAll(/\bt\("([^"\n]+)"\)/g)].map(match => match[1]);
  // Failure copy is translated at render time.
  literals.push(...[...component.matchAll(/^\s+\w+: "([^"\n]+)",$/gm)].map(match => match[1]));
  literals.push(...[...component.matchAll(/\|\| "([^"\n]+)";/g)].map(match => match[1]));
  assert.ok(literals.length > 60);
  for (const text of literals) {
    assert.ok(all[text]?.ru, `Missing Russian: ${text}`);
    assert.match(all[text]?.zh || '', /[㐀-鿿]/u, `Missing Chinese: ${text}`);
  }
  assert.equal(marketText('zh', 'by {creator}', { creator: 'jinx' }), '创作者：jinx');
  assert.equal(marketText('en', 'Market · OMOBA'), 'Market · OMOBA');
  assert.ok(portalTranslations.Market?.zh, 'portal navigation label');
});
