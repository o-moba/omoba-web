// Isolated PostgreSQL + real Account API + BFF + browser. Explicitly seeded paid
// periods from account-api/examples/hero-supporter-fixture.rs, never real payments.
import assert from 'node:assert/strict';
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const origin = 'http://127.0.0.1:3034', apiOrigin = 'http://127.0.0.1:40558';
const out = process.env.HERO_WEB_EVIDENCE || '.agent/tasks/hero-supporter/web';
await mkdir(out, { recursive: true });
const initial = await (await fetch(apiOrigin + '/v1/supporters')).json();
assert.ok(Array.isArray(initial.supporters), 'Start the isolated hero-supporter-fixture API first');
const active = initial.supporters.find(p => p.nickname.startsWith('Aurora Hero#'));
const expired = initial.supporters.find(p => p.nickname.startsWith('Starlight Patron#'));
const quiet = initial.supporters.find(p => p.nickname.startsWith('Quiet Guardian#'));
const future = initial.supporters.find(p => p.nickname.startsWith('Future Patron#'));
assert.ok(active && expired && quiet && future, 'Reseed the dedicated Hero fixture before running');
assert.equal(initial.supporters.length, 4);
assert.equal(active.months_supported, 3); assert.equal(active.hero_active, true);
assert.equal(expired.months_supported, 2); assert.equal(expired.hero_active, false);
assert.equal(future.months_supported, 1); assert.equal(future.hero_active, false);
assert.ok(initial.supporters.every(p => !/Hidden Patron|Private Patron|Refunded Patron/.test(p.nickname)));
for (const entry of initial.supporters) assert.deepEqual(Object.keys(entry).sort(), ['hero_active', 'hero_until', 'months_supported', 'nickname', 'profile_id']);
const server = spawn(process.execPath, ['scripts/start.mjs'], {
  env: { ...process.env, PORT: '3034', OMOBA_CONTOUR: 'production', OMOBA_ACCOUNT_MODE: 'enabled',
    OMOBA_ACCOUNT_API_URL: apiOrigin, OMOBA_PORTAL_ORIGIN: origin, OMOBA_ALLOW_INSECURE_LOCAL: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '', browser, owner, originalSettings;
server.stdout.on('data', chunk => serverLog += chunk);
server.stderr.on('data', chunk => serverLog += chunk);
async function call(page, path, method = 'GET', body) {
  return page.evaluate(async ({ path, method, body }) => {
    const headers = {};
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = (await (await fetch('/api/csrf', { cache: 'no-store' })).json()).token;
      headers['Idempotency-Key'] = crypto.randomUUID();
    }
    const response = await fetch('/api/' + path, { method, headers, cache: 'no-store', body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }, { path, method, body });
}
async function settings(values) {
  const me = await call(owner, 'me'); assert.equal(me.status, 200);
  const { version, ...current } = me.data.settings;
  const result = await call(owner, 'me/settings', 'PATCH', { ...current, ...values, expected_version: version });
  assert.equal(result.status, 200, JSON.stringify(result));
}
async function native(path, body) {
  const response = await fetch(apiOrigin + '/v1/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data;
}
try {
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error(serverLog);
    try { if ((await fetch(origin + '/supporters')).ok) break; } catch {}
    if (i === 79) throw new Error('Local web server did not start');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 720 } });
  const guest = await context.newPage(), errors = [];
  guest.on('pageerror', error => errors.push(error.message));
  await guest.goto(origin + '/supporters');
  await guest.getByRole('link', { name: new RegExp(active.nickname.replace('#', '\\#')) }).waitFor();
  assert.equal(await guest.locator('.supporter-row').count(), 4);
  assert.match(await guest.locator('.supporter-row').filter({ hasText: expired.nickname }).innerText(), /Supporter\s+2 Months supported/);
  assert.equal(await guest.locator('.supporter-row').filter({ hasText: future.nickname }).locator('.is-active').count(), 0);
  await guest.screenshot({ path: out + '/connected-directory.png' });
  await guest.getByRole('link', { name: new RegExp(active.nickname.replace('#', '\\#')) }).click();
  await guest.getByRole('heading', { name: active.nickname, exact: true }).waitFor();
  await guest.locator('.metrics').waitFor();
  assert.match(await guest.locator('.hero-recognition').innerText(), /Hero active/);
  await guest.screenshot({ path: out + '/connected-profile-stats.png' });
  await guest.goto(origin + '/players/' + quiet.profile_id);
  await guest.getByText('This player has not published their statistics.').waitFor();
  assert.equal(await guest.locator('.metrics').count(), 0);
  assert.match(await guest.locator('.hero-recognition').innerText(), /1 Months supported/);
  await guest.screenshot({ path: out + '/connected-profile-private-stats.png' });
  const ownerContext = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 720 } });
  owner = await ownerContext.newPage(); owner.on('pageerror', error => errors.push(error.message));
  await owner.goto(origin + '/login?returnTo=%2Fsupporter');
  await owner.getByRole('button', { name: 'Get a code', exact: true }).click();
  const code = (await owner.locator('.pair-code').innerText()).replace(/[^A-Z0-9]/g, '');
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.alloc(32, 7)]), format: 'der', type: 'pkcs8' });
  const publicKey = createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
  const { challenge: c } = await native('auth/pairings/lookup', { code, public_key: publicKey });
  const bytes = JSON.stringify(['omoba.web.pair.v1', c.origin, c.pair_id, c.nonce, c.public_key, c.browser_binding, 'approve', c.scopes, c.expires_at]);
  await native('auth/pairings/approve', { challenge: c, decision: 'approve', signature: sign(null, Buffer.from(bytes), key).toString('hex') });
  await owner.waitForURL('**/supporter');
  const toggle = owner.getByRole('checkbox', { name: 'Show my name and supported months in the public directory' });
  await toggle.waitFor(); assert.equal(await toggle.isChecked(), true);
  const dashboard = await call(owner, 'me/supporter');
  assert.equal(dashboard.data.recognition.months_supported, 3);
  assert.equal(dashboard.data.solana.available, false);
  assert.equal(dashboard.data.apple.available, false);
  originalSettings = (await call(owner, 'me')).data.settings;
  const duplicate = await owner.evaluate(async () => {
    const csrf = (await (await fetch('/api/csrf')).json()).token;
    const response = await fetch('/api/me/supporter/recognition', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: '{"visible":true,"visible":false}',
    });
    return { status: response.status, data: await response.json() };
  });
  assert.equal(duplicate.status, 400, 'Duplicate recognition fields must reach the strict API parser: ' + JSON.stringify(duplicate));
  assert.equal((await call(owner, 'me/supporter')).data.recognition.visible, true);
  assert.equal(await owner.getByRole('button', { name: 'Pay with Solana', exact: true }).count(), 0);
  await owner.locator('.recognition-settings').scrollIntoViewIfNeeded();
  await owner.screenshot({ path: out + '/connected-recognition.png' });
  await toggle.click();
  await owner.getByRole('status').filter({ hasText: 'Recognition preference saved.' }).waitFor();
  assert.equal((await call(owner, 'me/supporter')).data.recognition.visible, false);
  await guest.goto(origin + '/supporters');
  await guest.getByRole('link', { name: new RegExp(expired.nickname) }).waitFor();
  assert.equal(await guest.locator('.supporter-row').filter({ hasText: active.nickname }).count(), 0);
  const optedOutProfile = await call(guest, 'players/' + active.profile_id);
  assert.equal(optedOutProfile.status, 200); assert.equal(optedOutProfile.data.profile.supporter, undefined);
  assert.equal(typeof optedOutProfile.data.profile.rating, 'number');
  await toggle.click();
  await owner.getByRole('status').filter({ hasText: 'Recognition preference saved.' }).waitFor();
  await settings({ public_profile_enabled: false, public_stats_enabled: false, discoverable: false });
  await owner.reload();
  await owner.getByText('Your profile is private, so you are not listed. You can review profile visibility in Settings.').waitFor();
  await owner.locator('.recognition-settings').scrollIntoViewIfNeeded();
  await owner.screenshot({ path: out + '/connected-private-profile-guidance.png' });
  assert.equal((await call(guest, 'players/' + active.profile_id)).status, 404);
  assert.ok(!(await call(guest, 'supporters')).data.supporters.some(p => p.profile_id === active.profile_id));
  await settings({ public_profile_enabled: true, public_stats_enabled: false });
  const published = await call(guest, 'players/' + active.profile_id);
  assert.equal(published.status, 200); assert.equal(published.data.profile.rating, undefined);
  assert.equal(published.data.profile.supporter.months_supported, 3);
  assert.ok((await call(guest, 'supporters')).data.supporters.some(p => p.profile_id === active.profile_id));
  assert.deepEqual(errors, []);
  await writeFile(out + '/connected-browser.json', JSON.stringify({ passed: true, locale: 'en-US', viewport: '1280x720', fixture: 'Explicitly seeded paid periods in dedicated hero_supporter database', checks: ['real API guest directory', 'active/expired/future periods', 'default/private/refunded exclusions', 'public and private-stat profiles', 'signed Ed25519 pairing', 'recognition opt-out/in', 'immediate private-profile exclusion', 'independent stats privacy', 'payment providers disabled'], limitations: ['No real wallet or Apple purchase; no native UI or deployed dev verification.'] }, null, 2));
  console.log('PASS connected Hero supporter browser/API/PostgreSQL fixture');
} finally {
  try {
    if (owner && originalSettings) {
      const { version, ...values } = originalSettings;
      await settings(values);
      await call(owner, 'me/supporter/recognition', 'PATCH', { visible: true });
      await call(owner, 'auth/logout', 'POST', {});
    }
  } finally {
    await browser?.close(); server.kill('SIGTERM');
    await writeFile(out + '/connected-server.log', serverLog);
  }
}
