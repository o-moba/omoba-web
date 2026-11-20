// Real local Web BFF -> Registry/PostgreSQL -> Studio consent/review -> manifest.
// Uses tools/check_map_placement_http.py --serve-port in sponsor-registry.
// Model publication, identity verification and object storage remain fixtures.
// Leaves the browser-created approved placement active for the native game check.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

assert.equal(process.env.SPONSOR_CONNECTED_FIXTURE, '1', 'Explicit disposable fixture opt-in required');
const registry = process.env.SPONSOR_CONNECTED_API || 'http://127.0.0.1:8773';
const studioPort = Number(process.env.SPONSOR_CONNECTED_STUDIO_PORT || 5203);
const webPort = Number(process.env.SPONSOR_CONNECTED_WEB_PORT || 3038);
const studio = `http://127.0.0.1:${studioPort}`, origin = `http://127.0.0.1:${webPort}`;
for (const value of [registry, studio, origin]) {
  const url = new URL(value);
  assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash, 'Loopback fixture origins only');
}
const studioRoot = resolve(process.env.SPONSOR_CONNECTED_STUDIO_ROOT || '../sponsor-registry/web');
const output = resolve(process.env.SPONSOR_CONNECTED_EVIDENCE || '.agent/tasks/community-sculptures/raw/connected');
await mkdir(output, { recursive: true });
const owner = 'local-studio-owner-identity-token';
const checks = [], errors = [], servers = [];
async function api(path, { method = 'GET', token, body, expected = 200 } = {}) {
  const response = await fetch(registry + path, { method, redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json();
  assert.equal(response.status, expected, path + ': ' + (value.error?.code || 'unexpected response'));
  return value;
}
function start(name, cwd, env) {
  const child = spawn(process.execPath, ['scripts/start.mjs'], { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const server = { name, child, log: '' }; servers.push(server);
  child.stdout.on('data', data => server.log += data); child.stderr.on('data', data => server.log += data);
  return server;
}
async function ready(server, url) {
  for (let i = 0; i < 100; i++) {
    if (server.child.exitCode !== null) throw new Error(server.log);
    try { if ((await fetch(url)).ok) return; } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(server.name + ' startup timeout: ' + server.log);
}
const cookie = role => ({ name: 'ekza_studio_session', value: `local-studio-${role}-identity-token`, domain: '127.0.0.1', path: '/api/studio', httpOnly: true, sameSite: 'Lax' });
let browser, page, adminPage;
try {
  // Confirm the explicit synthetic identity and project authority before mutations.
  assert.equal((await api('/v1/studio/session', { token: owner })).user.username, 'local-fixture');
  assert.ok((await api('/v1/studio/projects', { token: owner })).items.some(item => item.projectId === 'omoba' && item.owner));
  const queue = (await api('/v1/studio/projects/omoba/placements', { token: owner })).items;
  const model = queue.find(item => Array.from(item.description ?? '').length === 1000);
  assert.ok(model, 'The real-HTTP seed with complete native-card description must exist');
  for (const item of queue.filter(item => ['pending', 'active'].includes(item.status))) {
    await api(`/v1/studio/projects/omoba/placements/${item.id}/${item.status === 'active' ? 'revoke' : 'decision'}`, {
      method: 'POST', token: owner, body: { ...(item.status === 'pending' ? { decision: 'reject' } : {}), reason: 'Clear this disposable fixture for connected browser acceptance.' } });
  }
  assert.deepEqual((await api('/v1/projects/omoba/placements/active')).placements, []);
  const studioServer = start('studio', studioRoot, { HOST: '127.0.0.1', PORT: String(studioPort), EKZA_STUDIO_API_URL: registry + '/v1/studio', EKZA_STUDIO_PUBLIC_API_URL: registry + '/v1/studio', EKZA_STUDIO_WEB_ORIGIN: '' });
  const webServer = start('web', process.cwd(), { PORT: String(webPort), OMOBA_CONTOUR: process.env.OMOBA_CONTOUR || 'production', OMOBA_ACCOUNT_MODE: 'disabled', OMOBA_PORTAL_ORIGIN: origin, OMOBA_ALLOW_INSECURE_LOCAL: '1', OMOBA_REGISTRY_URL: registry, OMOBA_STUDIO_URL: studio });
  await Promise.all([ready(studioServer, studio + '/studio?view=new'), ready(webServer, origin + '/sponsor')]);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en' });
  await context.addCookies([cookie('creator')]);
  context.on('page', tab => tab.on('pageerror', error => errors.push(error.message)));
  page = await context.newPage(); await page.goto(origin + '/sponsor');
  await page.getByRole('heading', { name: 'Leave a little luck on the map.', exact: true }).waitFor();
  const contribution = page.getByRole('link', { name: 'Create a sculpture in Ekza Studio ↗', exact: true });
  assert.equal(await contribution.getAttribute('href'), studio + '/studio?view=new&kind=map_prop&project=omoba&requirement=community.map.sculpture');
  const uploadPromise = context.waitForEvent('page'); await contribution.click();
  const upload = await uploadPromise;
  await upload.getByRole('combobox', { name: /^Model type/ }).waitFor();
  assert.equal(await upload.getByRole('combobox', { name: /^Model type/ }).inputValue(), 'map_prop');
  await upload.locator('[data-requirement="community.map.sculpture"]').waitFor();
  assert.ok(await upload.locator('input[type="file"]').count());
  await upload.screenshot({ path: output + '/studio-contribution-entry.png' }); await upload.close();
  checks.push('OMOBA contribution link reaches real Studio Map sculpture upload form with the OMOBA requirement; no raw upload performed');
  await page.getByRole('button', { name: 'View in 3D', exact: true }).click();
  await page.locator('[data-asset-render-state="ready"]').waitFor({ timeout: 30000 });
  await page.screenshot({ path: output + '/web-exact-model.png' }); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Connect for sculpture placement', exact: true }).click();
  const consentLink = page.getByRole('link', { name: 'Open Ekza Studio ↗', exact: true }); await consentLink.waitFor();
  const consentPromise = context.waitForEvent('page'); await consentLink.click();
  const consent = await consentPromise;
  await consent.getByText('Permission: Requests and cancels free map sculpture placements', { exact: true }).waitFor();
  await consent.getByRole('button', { name: /^Connect Omoba$/i }).scrollIntoViewIfNeeded();
  await consent.screenshot({ path: output + '/studio-placement-consent.png' });
  const [consentResponse] = await Promise.all([
    consent.waitForResponse(response => response.url().includes('/api/studio/devices/') && response.url().endsWith('/approve') && response.request().method() === 'POST'),
    consent.getByRole('button', { name: /^Connect Omoba$/i }).click(),
  ]);
  assert.equal(consentResponse.status(), 200);
  assert.deepEqual(consentResponse.request().postDataJSON(), { scope: 'map-placement', consent: 'map-placement.v1' });
  await page.getByRole('heading', { name: 'Ready to submit', exact: true }).waitFor(); await consent.close();
  const placementCookie = (await context.cookies()).find(item => item.name === 'omoba-ekza-placement');
  assert.equal(placementCookie?.httpOnly, true); assert.equal(placementCookie?.sameSite, 'Lax');
  checks.push('Real Studio browser consent approves map-placement.v1; Registry issues scoped token and OMOBA BFF stores an HttpOnly placement cookie');
  await page.getByLabel('Placement title', { exact: true }).fill('Jade Fortune');
  await page.getByLabel('Credit', { exact: true }).fill(model.credit);
  await page.getByLabel('Description (optional)', { exact: true }).fill(model.description);
  await page.getByRole('checkbox').check();
  await page.getByLabel('Description (optional)', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: output + '/web-description-form.png' });
  const createPromise = page.waitForResponse(response => response.url() === origin + '/api/sponsor/placements' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Submit free placement', exact: true }).click();
  const createResponse = await createPromise; assert.equal(createResponse.status(), 200);
  const sent = createResponse.request().postDataJSON(), pending = await createResponse.json();
  assert.equal(pending.status, 'pending'); assert.equal(pending.description, model.description);
  assert.equal(pending.renditionSha256, model.renditionSha256); assert.equal(sent.description, model.description);
  await page.getByText('Waiting for review', { exact: true }).waitFor();
  const pendingCard = page.locator('.sponsor-request').filter({ has: page.getByText('Waiting for review', { exact: true }) });
  assert.equal(await pendingCard.locator('.sponsor-description').textContent(), model.description);
  assert.equal(await pendingCard.locator('.sponsor-description a,.sponsor-description b').count(), 0);
  await pendingCard.evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 24, behavior: 'instant' }));
  await page.screenshot({ path: output + '/web-pending.png' });
  const pendingQueue = (await api('/v1/studio/projects/omoba/placements', { token: owner })).items.find(item => item.id === pending.id);
  assert.equal(pendingQueue.description, model.description); assert.equal(pendingQueue.renditionSha256, model.renditionSha256);
  assert.deepEqual((await api('/v1/projects/omoba/placements/active')).placements, []);
  const csrf = (await (await context.request.get(origin + '/api/sponsor/csrf')).json()).token;
  const retry = await context.request.post(origin + '/api/sponsor/placements', { data: sent, headers: { Origin: origin, 'X-CSRF-Token': csrf } });
  assert.equal(retry.status(), 200); assert.equal((await retry.json()).id, pending.id);
  checks.push('Browser form creates real SQL pending placement through OMOBA BFF; exact 1000-scalar description/hash reach Studio queue; identical BFF retry returns same ID; not public before approval');
  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en' });
  await adminContext.addCookies([cookie('owner')]);
  adminPage = await adminContext.newPage(); adminPage.on('pageerror', error => errors.push(error.message));
  await adminPage.goto(studio + '/studio?view=games');
  const card = adminPage.locator('.ui-card').filter({ has: adminPage.getByRole('heading', { name: pending.title, exact: true }) }).filter({ has: adminPage.getByRole('button', { name: 'Approve for 24 hours', exact: true }) });
  await card.waitFor();
  const description = card.getByRole('region', { name: 'Public description', exact: true }).locator('p');
  assert.equal(await description.textContent(), model.description); assert.equal(await description.locator('a,b,script').count(), 0);
  assert.equal(await description.evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap');
  assert.equal(await description.evaluate(el => el.scrollHeight <= el.clientHeight + 1), true);
  await description.evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: 'instant' }));
  await adminPage.screenshot({ path: output + '/studio-description-start.png' });
  await description.evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 24, behavior: 'instant' }));
  await adminPage.screenshot({ path: output + '/studio-description-end.png' });
  assert.equal(await card.getByRole('button', { name: 'Approve for 24 hours', exact: true }).isDisabled(), true);
  await card.getByRole('button', { name: 'Inspect exact 3D sculpture', exact: true }).click();
  await card.locator('canvas').waitFor();
  await card.getByRole('checkbox').check({ timeout: 30000 });
  await card.getByLabel('Moderation reason').fill('Connected local acceptance: inspected exact animated cat, title, credit and complete literal description submitted through OMOBA.');
  await card.locator('canvas').scrollIntoViewIfNeeded();
  await adminPage.screenshot({ path: output + '/studio-inspected-model.png' });
  const decisionPromise = adminPage.waitForResponse(response => response.url().endsWith(`/placements/${pending.id}/decision`) && response.request().method() === 'POST');
  await card.getByRole('button', { name: 'Approve for 24 hours', exact: true }).click();
  assert.equal((await decisionPromise).status(), 200);
  const manifest = await api('/v1/projects/omoba/placements/active');
  assert.equal(manifest.placements.length, 1); const active = manifest.placements[0];
  for (const key of ['id', 'assetId', 'revisionId', 'renditionSha256', 'renditionBytes', 'title', 'credit', 'description']) assert.equal(active[key], pending[key], key);
  assert.equal(Date.parse(active.expiresAt) - Date.parse(active.startsAt), 86400000);
  const modelResponse = await fetch(active.renditionUrl, { redirect: 'error' }); assert.equal(modelResponse.status, 200);
  const bytes = Buffer.from(await modelResponse.arrayBuffer());
  assert.equal(bytes.length, active.renditionBytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), active.renditionSha256);
  checks.push('Studio browser inspection/approval activates SAME placement ID/model/hash/text for exactly 86400 seconds; downloaded manifest GLB matches exact SHA/bytes');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByText('Active on the map', { exact: true }).waitFor();
  const own = await (await context.request.get(origin + '/api/sponsor/placements')).json();
  assert.equal(own.items.find(item => item.id === pending.id).status, 'active');
  await page.locator('.sponsor-request').filter({ has: page.getByText('Active on the map', { exact: true }) })
    .evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 24, behavior: 'instant' }));
  await page.screenshot({ path: output + '/web-active.png' });
  assert.deepEqual(errors, []);
  await writeFile(output + '/submitted-request.json', JSON.stringify(sent, null, 2));
  await writeFile(output + '/active-manifest.json', JSON.stringify(manifest, null, 2));
  await writeFile(output + '/verification.json', JSON.stringify({ status: 'PASS', checks, errors, viewport: '1280x720', locale: 'en',
    placementId: active.id, modelSha256: active.renditionSha256, modelBytes: active.renditionBytes, descriptionScalars: Array.from(active.description).length,
    descriptionLines: active.description.split('\n').length, registry, nativeManifestUrl: registry + '/v1/projects/omoba/placements/active',
    webBuildId: (await readFile('.next/BUILD_ID', 'utf8')).trim(),
    scope: 'Compiled OMOBA Web + Studio with real local FastAPI/PostgreSQL placement API/RPCs. Synthetic login identities; model preseeded with real SQL publication/project approval; local GLB substitutes object storage. Raw upload, worker execution, hosted authentication/storage/deployment and native game not tested here. Approved placement left active for separate native proof.' }, null, 2));
  console.log(JSON.stringify({ status: 'PASS', placementId: active.id, modelSha256: active.renditionSha256, checks }, null, 2));
} catch (error) {
  for (const [name, tab] of [['web', page], ['studio', adminPage]]) if (tab) {
    await tab.screenshot({ path: output + '/' + name + '-failure.png' }).catch(() => {});
    await writeFile(output + '/' + name + '-failure.txt', await tab.locator('body').innerText().catch(() => ''));
  }
  throw error;
} finally {
  await browser?.close();
  for (const server of servers) { server.child.kill('SIGTERM'); await writeFile(output + '/' + server.name + '-server.log', server.log); }
}
