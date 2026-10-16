import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { PLACEMENT_SCOPE, MAX_SCULPTURE_BYTES, parsePlacementRequest, parsePlacement, parseOwnPlacements, parseSlots, parseSculptures, sculptureFile, sculptureDraftUrl, sponsorCookieNames, sponsorRoute } from '../src/lib/sponsor.mjs';
import { loadSponsor, readSponsorSession } from '../src/lib/sponsor-server.mjs';
import { ekzaCookieNames, ekzaRoute } from '../src/lib/ekza-link.mjs';
import { portalReturnTo } from '../src/lib/navigation.mjs';

const registry = 'https://registry.dev.ekza.io';
const uuid = n => `${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
const hash = 'a'.repeat(64);
const assetId = 'ekza:map_prop:' + uuid('a');
const request = () => ({ project: 'omoba', slotId: 'opposite-dragon', assetId, revisionId: uuid('b'), renditionSha256: hash,
  title: 'Lucky cat', credit: 'Community artist', rightsAccepted: true, idempotencyKey: uuid('c') });
const placement = () => ({ id: uuid('d'), slotId: 'opposite-dragon', assetId, revisionId: uuid('b'), renditionSha256: hash,
  renditionBytes: 1024, renditionUrl: `${registry}/v1/studio/assets/${hash}/rendition`, title: 'Lucky cat', credit: 'Community artist',
  startsAt: '2026-10-15T00:00:00Z', expiresAt: '2026-10-16T00:00:00Z' });
const own = () => ({ ...placement(), status: 'active', paymentMode: 'free', project: 'omoba', createdAt: '2026-10-14T23:00:00Z', reason: '' });
const catalogItem = () => ({ id: assetId, assetKind: 'map_prop', name: 'Lucky cat', description: 'An original\ncommunity sculpture.',
  access: 'free', creator: { name: 'Artist' }, license: { text: 'CC0-1.0', attribution: 'Artist' }, origin: { kind: 'studio', revisionId: uuid('b') },
  renditions: [{ platform: 'desktop', profile: 'map-prop-glb-v1', format: 'glb', sha256: hash, sizeBytes: 1024, downloadUrl: placement().renditionUrl }],
  projectSupport: [{ projectId: 'omoba', platform: 'desktop', profile: 'map-prop-glb-v1', status: 'approved' }] });
const catalog = items => ({ schema: 'ekza.asset.catalog.v2', items });

test('creation is an exact free request contract, never a payment or arbitrary map command', () => {
  assert.deepEqual(parsePlacementRequest(request()), { ...request(), description: '' });
  for (const field of ['paid', 'paymentMode', 'transactionHash', 'renditionUrl', 'startsAt', 'expiresAt', 'transform', 'approved', 'amount'])
    assert.throws(() => parsePlacementRequest({ ...request(), [field]: true }));
  for (const patch of [{ slotId: 'dragon' }, { project: 'other' }, { assetId: 'ekza:weapon:' + uuid('a') }, { renditionSha256: 'A'.repeat(64) },
    { rightsAccepted: false }, { rightsAccepted: 'true' }, { idempotencyKey: 'reuse-me' }, { title: 'x'.repeat(81) }, { credit: 'x'.repeat(121) }, { credit: '' }, { title: 'bad\nline' }])
    assert.throws(() => parsePlacementRequest({ ...request(), ...patch }));
  const missing = request(); delete missing.rightsAccepted; assert.throws(() => parsePlacementRequest(missing));
});

test('description preserves reviewed Unicode scalars and LF without trimming or executable markup', () => {
  for (const description of ['', '  First line\n第二行 🐈 <b>literal</b> https://example.test  ', '🐈'.repeat(1000), 'e\u0301']) {
    assert.equal(parsePlacementRequest({ ...request(), description }).description, description);
    assert.equal(parsePlacement({ ...placement(), description }, registry).description, description);
    assert.equal(parsePlacement({ ...own(), description }, registry, true).description, description);
  }
  assert.equal(parsePlacementRequest(request()).description, '');
  assert.equal(parsePlacement(placement(), registry).description, '');
  for (const description of [null, undefined, 3, {}, [], 'x'.repeat(1001), '🐈'.repeat(1001), '\u0000', '\t', '\r', '\u001f', '\u007f', '\u0085', '\u009f', '\ud800', '\udfff']) {
    assert.throws(() => parsePlacementRequest({ ...request(), description }));
    assert.throws(() => parsePlacement({ ...placement(), description }, registry));
  }
});

test('dedicated placement routes and cookies do not inherit market scope or credentials', () => {
  assert.equal(PLACEMENT_SCOPE, 'map-placement');
  for (const secure of [false, true]) {
    const names = sponsorCookieNames(secure), market = ekzaCookieNames(secure);
    assert.equal(Object.values(names).some(name => Object.values(market).includes(name)), false);
    assert.equal(names.link.startsWith('__Host-'), secure);
  }
  assert.deepEqual(sponsorRoute('placements', 'POST'), { action: 'create' });
  assert.deepEqual(sponsorRoute('placements/' + uuid('d') + '/cancel', 'POST'), { action: 'cancel', id: uuid('d') });
  for (const path of ['../placements', 'payments', 'admin/approve', 'placements/x/cancel', 'placements/' + uuid('d') + '/decision'])
    assert.equal(sponsorRoute(path, 'POST'), null);
  assert.equal(sponsorRoute('placements', 'DELETE'), null);
  assert.equal(ekzaRoute('placements', 'POST'), null);
  assert.equal(portalReturnTo('/sponsor'), '/sponsor');
  assert.equal(sculptureDraftUrl('https://studio.dev.ekza.io'), 'https://studio.dev.ekza.io/studio?view=new&kind=map_prop&project=omoba&requirement=community.map.sculpture');
});

test('title and credit reject C1 controls in requests and published placements', () => {
  for (const field of ['title', 'credit']) {
    for (const control of ['\u0080', '\u0085', '\u009f']) {
      const patch = { [field]: `Cat${control}test` };
      assert.throws(() => parsePlacementRequest({ ...request(), ...patch }));
      assert.throws(() => parsePlacement({ ...placement(), ...patch }, registry));
    }
  }
});

test('only exact approved free map props enter the selector or preview', () => {
  const good = catalogItem();
  const hostile = [
    { ...good, assetKind: 'weapon' }, { ...good, access: 'owned' }, { ...good, origin: { kind: 'external' } },
    { ...good, projectSupport: [] }, { ...good, renditions: [{ ...good.renditions[0], sizeBytes: MAX_SCULPTURE_BYTES + 1 }] },
    { ...good, renditions: [{ ...good.renditions[0], downloadUrl: 'https://other.example/model.glb' }] },
    { ...good, renditions: [{ ...good.renditions[0], downloadUrl: good.renditions[0].downloadUrl + '?token=x' }] },
    { ...good, renditions: [{ ...good.renditions[0], sha256: 'b'.repeat(64) }] },
    { ...good, projectSupport: [{ ...good.projectSupport[0], status: 'pending' }] },
  ];
  const result = parseSculptures(catalog([...hostile, good, good]), registry);
  assert.equal(result.items.length, 1); assert.equal(result.skipped, hostile.length + 1);
  assert.equal(result.items[0].kind, 'map_prop'); assert.equal(result.items[0].sha256, hash);
  assert.equal(parseSculptures(catalog([good]), 'https://registry.ekza.io').items.length, 0, 'no cross-contour model');
  assert.equal(sculptureFile(good.renditions[0].downloadUrl + '#x', registry, hash), null);
  assert.equal(sculptureFile('https://user@registry.dev.ekza.io/v1/studio/assets/' + hash + '/rendition', registry, hash), null);
  assert.throws(() => parseSculptures({ schema: 'wrong', items: [] }, registry));
  assert.throws(() => parseSculptures(catalog(new Array(501)), registry));
});

test('public slots have live 24-hour intervals and strict file identity', () => {
  const value = { serverNow: '2026-10-15T12:00:00Z', slots: [{ id: 'opposite-dragon', name: 'Opposite the dragon', durationSeconds: 86400, enabled: true, current: placement() }] };
  assert.equal(parseSlots(value, registry).slots[0].current.title, 'Lucky cat');
  for (const serverNow of ['2026-10-14T23:59:59Z', '2026-10-16T00:00:00Z']) assert.throws(() => parseSlots({ ...value, serverNow }, registry));
  for (const patch of [{ expiresAt: '2026-10-15T12:00:00Z' }, { startsAt: null }, { renditionBytes: MAX_SCULPTURE_BYTES + 1 }, { renditionUrl: 'https://evil.example/x' }])
    assert.throws(() => parsePlacement({ ...placement(), ...patch }, registry));
  assert.equal(parseSlots({ ...value, slots: [{ ...value.slots[0], current: null }] }, registry).slots[0].current, null);
});

test('own requests preserve lifecycle and review feedback while stripping private extras', () => {
  const pending = { ...own(), startsAt: null, expiresAt: null, status: 'pending', reason: '<script>bad()</script>\nPlease change the title.', moderatorId: 'private' };
  const [parsed] = parseOwnPlacements({ items: [pending] }, registry);
  assert.equal(parsed.reason, pending.reason); assert.equal('moderatorId' in parsed, false);
  for (const status of ['pending', 'active', 'expired', 'rejected', 'cancelled', 'revoked']) assert.equal(parsePlacement({ ...own(), status }, registry, true).status, status);
  assert.throws(() => parsePlacement({ ...pending, status: 'active' }, registry, true));
  assert.throws(() => parsePlacement({ ...own(), paymentMode: 'crypto' }, registry, true));
  assert.throws(() => parseOwnPlacements({ items: [own(), own()] }, registry));
});

test('sponsor UI copy has Russian and Chinese without translating submitted metadata', async () => {
  const load = async file => import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(await readFile(new URL(file, import.meta.url), 'utf8'))).toString('base64'));
  const all = {};
  for (const [file, key] of [['i18n', 'portalTranslations'], ['creator-translations', 'creatorTranslations'], ['market-translations', 'marketTranslations'], ['sponsor-translations', 'sponsorTranslations']])
    Object.assign(all, (await load('../src/lib/' + file + '.ts'))[key]);
  const component = await readFile(new URL('../src/components/sponsor.tsx', import.meta.url), 'utf8');
  const literals = [...component.matchAll(/\bt\('([^'\n]+)'\)/g)].map(match => match[1]);
  assert.ok(literals.length > 45);
  for (const value of literals) {
    assert.ok(all[value]?.ru, 'Russian: ' + value);
    assert.match(all[value]?.zh ?? '', /[㐀-鿿]/u, 'Chinese: ' + value);
  }
});

test('server loader distinguishes outage from empty and requests the exact catalog selector', async () => {
  const paths = [], modes = { outage: false, auth: 200 };
  let origin;
  const server = createServer((req, res) => {
    paths.push(req.url); res.setHeader('Content-Type', 'application/json');
    if (modes.outage) { res.writeHead(503); res.end('{}'); return; }
    if (req.url === '/v1/account/placements') { res.writeHead(modes.auth); res.end(JSON.stringify({ items: [] })); return; }
    res.end(JSON.stringify(req.url.includes('/slots') ? { serverNow: '2026-10-15T12:00:00Z', slots: [] } : catalog([])));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  const env = { OMOBA_CONTOUR: 'dev', OMOBA_ALLOW_INSECURE_LOCAL: '1', OMOBA_REGISTRY_URL: origin, OMOBA_STUDIO_URL: origin };
  try {
    const data = await loadSponsor(env); assert.equal(data.state, 'ready'); assert.deepEqual(data.models, []);
    assert.ok(paths.includes('/v2/assets?kind=map_prop&project=omoba&platform=desktop&profile=map-prop-glb-v1'));
    assert.equal((await readSponsorSession(origin, 'token')).state, 'connected');
    modes.auth = 403; assert.equal((await readSponsorSession(origin, 'token')).state, 'expired');
    modes.outage = true; assert.equal((await loadSponsor(env)).state, 'unavailable');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
