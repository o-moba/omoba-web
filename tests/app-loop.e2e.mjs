// Real local landing + BFF + Account API + PostgreSQL; public synthetic key only.
// Seed account-api/examples/seed-local-portal.rs in an isolated local database first.
import { chromium } from '@playwright/test';
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const landing = 'http://127.0.0.1:3102';
const portal = 'http://127.0.0.1:3010';
const accountApi = 'http://127.0.0.1:40550';
const output = process.env.OMOBA_E2E_OUTPUT || '.agent/app-loop';
await mkdir(output, { recursive: true });
const key = createPrivateKey({
  key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.alloc(32, 7)]),
  format: 'der', type: 'pkcs8',
});
const publicKey = createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
async function approve(code) {
  const post = async (path, body) => {
    const response = await fetch(accountApi + '/v1/' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json();
    assert.equal(response.status, 200, JSON.stringify(data));
    return data;
  };
  const { challenge } = await post('auth/pairings/lookup', { code: code.replace(/[^A-Z0-9]/g, ''), public_key: publicKey });
  assert.equal(challenge.origin, portal);
  const tuple = ['omoba.web.pair.v1', challenge.origin, challenge.pair_id, challenge.nonce,
    challenge.public_key, challenge.browser_binding, 'approve', challenge.scopes, challenge.expires_at];
  await post('auth/pairings/approve', { challenge, decision: 'approve', signature: sign(null, Buffer.from(JSON.stringify(tuple)), key).toString('hex') });
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ locale: "en-US", viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(landing);
  const openApp = page.locator('header').getByRole('link', { name: 'Open app ↗', exact: true });
  assert.equal(await openApp.getAttribute('href'), portal + '/me');
  await openApp.click();
  await page.waitForURL(portal + '/me');
  await page.locator('.sidebar-bottom').getByRole('link', { name: /На сайт OMOBA|OMOBA website/ }).click();
  await page.waitForURL(landing + '/');
  await page.getByRole('link', { name: 'Your match history →', exact: true }).click();
  await page.waitForURL(portal + '/me/matches');

  // Deep links and filters survive game-confirmed sign-in.
  const destination = '/me/matches?days=all';
  await page.goto(portal + destination);
  await page.locator('main').getByRole('link', { name: /Войти|Sign in/ }).click();
  await page.waitForURL(url => url.pathname === '/login' && url.searchParams.get('returnTo') === destination);
  assert.equal(new URL(page.url()).searchParams.get('returnTo'), destination);
  await page.getByRole('button', { name: /Получить код|Get a code|Create code/ }).click();
  await approve(await page.locator('.pair-code').innerText());
  await page.waitForURL(portal + destination);
  await page.locator('.match-row').first().waitFor();
  const me = await page.request.get(portal + '/api/me');
  assert.equal(me.status(), 200);
  assert.match(me.headers()['cache-control'], /no-store/);
  assert.ok((await context.cookies()).find(cookie => cookie.name === 'omoba-session')?.httpOnly);
  await page.screenshot({ path: output + '/omoba-loop-history.png', fullPage: true });

  const reportPath = await page.locator('.match-row').first().getAttribute('href');
  assert.match(reportPath, /^\/matches\/browser-fixture-/);
  const resultId = decodeURIComponent(reportPath.slice('/matches/'.length));
  const report = await page.request.get(portal + '/api/matches/' + encodeURIComponent(resultId));
  assert.equal(report.status(), 200);
  const savedReport = await report.json();
  await page.locator('.match-row').first().click();
  await page.waitForURL(portal + reportPath);
  await page.locator('.scoreboard').first().waitFor();
  await page.reload();
  await page.locator('.scoreboard').first().waitFor();
  assert.deepEqual(await (await page.request.get(portal + '/api/matches/' + encodeURIComponent(resultId))).json(), savedReport);
  await page.screenshot({ path: output + '/omoba-loop-match.png', fullPage: true });

  const guest = await browser.newContext({ locale: "en-US" });
  assert.equal((await guest.request.get(portal + '/api/matches/' + encodeURIComponent(resultId))).status(), 401);
  await guest.close();
  await page.locator('.sidebar-bottom').getByRole('link', { name: /На сайт OMOBA|OMOBA website/ }).click();
  await page.waitForURL(landing + '/');
  const workshop = page.locator('a[href="' + portal + '/workshop"]');
  assert.ok(await workshop.count());
  await workshop.first().click();
  await page.waitForURL(portal + '/workshop');
  await page.getByRole('link', { name: 'OMOBA website ↗', exact: true }).click();
  await page.waitForURL(landing + '/');
  await page.getByRole('link', { name: 'Browse creator catalogue ↗', exact: true }).click();
  await page.waitForURL(portal + '/creators');
  await page.getByRole('link', { name: 'About the game ↗', exact: true }).click();
  await page.waitForURL(landing + '/');

  await page.setViewportSize({ width: 393, height: 852 });
  await page.locator('header').getByRole('link', { name: 'Open app ↗', exact: true }).waitFor({ state: 'visible' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'landing overflows on phone');
  await page.locator('header').getByRole('link', { name: 'Open app ↗', exact: true }).click();
  await page.waitForURL(portal + '/me');
  await page.goto(portal + destination);
  await page.locator('.match-row').first().waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'history overflows on phone');
  await page.screenshot({ path: output + '/omoba-loop-history-mobile.png', fullPage: true });
  await page.getByRole('button', { name: /Выйти|Sign out|Log out/ }).click();
  await page.waitForURL(portal + '/me');
  assert.equal((await page.request.get(portal + '/api/me')).status(), 401);
  assert.equal((await context.cookies()).some(cookie => cookie.name === 'omoba-session'), false);
  assert.deepEqual(errors, []);
  await writeFile(output + '/app-loop-result.json', JSON.stringify({
    passed: true, result_id: resultId,
    checks: ['landing → player app → landing', 'landing → history → signed pairing → original history URL and filters',
      'real Account API and PostgreSQL', 'stored report survives page reload', 'guest cannot read private match',
      'landing → workshop → landing', 'landing → catalogue → landing', '393px landing and history layouts', 'HttpOnly session and no-store data', 'logout'],
    limitations: ['Synthetic seeded match and test identity; native approval UI was not driven.',
      'The real signed UDP match persistence check is separate.', 'Local test environment; production Account API remains disabled.'],
  }, null, 2));
  console.log('PASS landing/app/history/workshop round trip with real Account API and PostgreSQL');
} finally {
  await browser.close();
}
