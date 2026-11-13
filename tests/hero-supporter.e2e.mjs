// Self-contained browser/BFF states. Synthetic upstream; never a payment proof.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const out = process.env.HERO_WEB_EVIDENCE || '.agent/tasks/hero-supporter/web';
await mkdir(out, { recursive: true });
const activeUntil = Math.floor(Date.now() / 1000) + 3600;
const records = Array.from({ length: 26 }, (_, i) => ({
  profile_id: (i + 1).toString(16).padStart(64, '0'), nickname: `Synthetic${i + 1}#1234`,
  months_supported: i === 0 ? 105 : i + 1, hero_active: i === 0, hero_until: i === 0 ? activeUntil : null,
}));
let mode = 'ready', releaseLoading, notifyLoading, upstreamCalls = 0;
const loadingStarted = new Promise(resolve => { notifyLoading = resolve; });
const upstream = createServer(async (req, res) => {
  upstreamCalls++;
  const url = new URL(req.url, 'http://fixture.invalid');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname === '/v1/supporters') {
    if (mode === 'loading') await new Promise(resolve => { releaseLoading = resolve; notifyLoading(); });
    if (mode === 'error') { res.writeHead(503); res.end(JSON.stringify({ code: 'unavailable' })); return; }
    const start = url.searchParams.has('cursor') ? records.findIndex(r => r.profile_id === url.searchParams.get('cursor')) + 1 : 0;
    const rows = mode === 'empty' ? [] : records.slice(start, start + 24);
    res.end(JSON.stringify({ supporters: rows, next_cursor: start + 24 < records.length && rows.length ? rows.at(-1).profile_id : null, data_as_of: String(Date.now()) }));
  } else if (url.pathname === '/v1/players/' + records[0].profile_id) {
    const { profile_id, nickname, ...supporter } = records[0];
    // Public name/recognition, independently private statistics.
    res.end(JSON.stringify({ profile: { profile_id, nickname, supporter }, access: 'public' }));
  } else { res.writeHead(404); res.end(JSON.stringify({ code: 'not_found' })); }
});
await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
const apiOrigin = 'http://127.0.0.1:' + upstream.address().port;
const servers = [];
async function start(port, disabled) {
  const origin = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, ['scripts/start.mjs'], {
    env: { ...process.env, OMOBA_CONTOUR: 'production', PORT: String(port), OMOBA_PORTAL_ORIGIN: origin,
      OMOBA_ACCOUNT_API_URL: apiOrigin, OMOBA_ALLOW_INSECURE_LOCAL: '1', OMOBA_ACCOUNT_MODE: disabled ? 'disabled' : 'enabled' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const instance = { child, log: '', origin }; servers.push(instance);
  child.stdout.on('data', chunk => instance.log += chunk);
  child.stderr.on('data', chunk => instance.log += chunk);
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw new Error(instance.log);
    try { if ((await fetch(origin + '/supporters')).ok) return origin; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Server failed to start: ' + instance.log);
}
let browser;
try {
  const origin = await start(3035, false);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 720 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  mode = 'loading';
  await page.goto(origin + '/supporters');
  await page.getByRole('heading', { name: 'Supporters', exact: true }).waitFor();
  await page.getByRole('status').filter({ hasText: 'Loading supporters' }).waitFor();
  await loadingStarted;
  mode = 'ready'; releaseLoading();
  await page.getByRole('link', { name: /Synthetic1#1234/ }).waitFor();
  assert.equal(await page.locator('.supporter-row').count(), 24);
  assert.match(await page.locator('.supporter-row').first().innerText(), /105 Months supported/);
  assert.match(await page.locator('.supporter-row').nth(1).innerText(), /Supporter/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('link', { name: /Synthetic25#1234/ }).waitFor();
  assert.equal(await page.locator('.supporter-row').count(), 2);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('link', { name: /Synthetic1#1234/ }).click();
  await page.getByRole('heading', { name: 'Synthetic1#1234' }).waitFor();
  await page.getByText('This player has not published their statistics.').waitFor();
  assert.equal(await page.locator('.metrics').count(), 0);
  assert.match(await page.locator('.hero-recognition').innerText(), /105 Months supported/);
  await page.goto(origin + '/supporters');
  await page.getByRole('link', { name: /Synthetic1#1234/ }).waitFor();
  mode = 'error';
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'could not be loaded' }).waitFor();
  assert.equal(await page.locator('.supporter-row').count(), 0, 'do not retain stale public rows after an error');
  await page.screenshot({ path: out + '/directory-error.png' });
  mode = 'empty';
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'No public supporters yet' }).waitFor();
  await page.screenshot({ path: out + '/directory-empty.png' });
  // A stale server snapshot must stop displaying active Hero at known expiry.
  mode = 'ready'; records[0].hero_until = Math.floor(Date.now() / 1000) - 1;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('link', { name: /Synthetic1#1234/ }).waitFor();
  assert.match(await page.locator('.supporter-row').first().innerText(), /Supporter/);
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/me/supporter/recognition', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"visible":true}' });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(result.status, 403); assert.equal(result.body.code, 'csrf_rejected');
  const directory = await fetch(origin + '/api/supporters');
  assert.match(directory.headers.get('cache-control'), /no-store/);
  assert.equal(directory.status, 200);
  assert.equal((await fetch(origin + '/api/supporters', { method: 'POST' })).status, 404);
  const disabledOrigin = await start(3036, true);
  const callsBefore = upstreamCalls;
  const disabledContext = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 720 } });
  await disabledContext.addCookies([{ name: 'omoba-session', value: 'f'.repeat(64), url: disabledOrigin, httpOnly: true }]);
  const guest = await disabledContext.newPage();
  await guest.goto(disabledOrigin + '/supporters');
  await guest.getByRole('heading', { name: 'Supporters', exact: true }).waitFor();
  await guest.getByRole('status').filter({ hasText: 'Accounts and payments are not enabled here' }).waitFor();
  assert.equal((await fetch(disabledOrigin + '/api/supporters')).status, 503);
  assert.equal(upstreamCalls, callsBefore, 'disabled mode must never contact the Account API');
  assert.ok(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await guest.screenshot({ path: out + '/directory-disabled.png' });
  assert.deepEqual(errors, []);
  await writeFile(out + '/browser-states.json', JSON.stringify({ passed: true, locale: 'en-US', viewport: '1280x720', checks: ['guest directory', 'loading', 'pagination/back', '105 server-owned months', 'expired acknowledgement', 'private statistics', 'error/retry', 'empty', 'local expiry', 'CSRF', 'no-store', 'disabled without upstream'], limitations: ['Synthetic HTTP upstream; no database, real entitlement or payment verification.'] }, null, 2));
  console.log('PASS Hero supporter browser/BFF states (synthetic HTTP upstream)');
} finally {
  releaseLoading?.();
  await browser?.close();
  for (const server of servers) {
    server.child.kill('SIGTERM');
    await writeFile(out + '/server-' + new URL(server.origin).port + '.log', server.log);
  }
  upstream.closeAllConnections(); await new Promise(resolve => upstream.close(resolve));
}
