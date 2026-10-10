import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

// Run against a production build. LANDING_URL optionally checks the companion site.
const portal = process.env.PORTAL_URL || 'http://127.0.0.1:3014';
const sites = [['portal', portal + '/workshop']];
if (process.env.LANDING_URL) sites.push(['landing', process.env.LANDING_URL + '/']);
const checks = [];
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-proxy-server', '--disable-quic'] });
async function navigate(page, url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); }
    catch (error) { if (attempt === 2 || !/ERR_CONNECTION_(CLOSED|RESET)|ERR_NETWORK_CHANGED|ERR_TIMED_OUT/.test(error.message)) throw error; }
  }
}
try {
  for (const [name, url] of sites) {
    const context = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1535, height: 1000 } });
    const page = await context.newPage();
    let cssRequests = 0;
    // Neither CSS downloads nor hydration may be required to style the initial HTML.
    await page.route(/\.css(?:\?|$)/, route => { cssRequests++; return route.abort(); });
    await page.route(/\.js(?:\?|$)/, route => route.abort());
    await page.route(/\.(?:woff2?|ttf)(?:\?|$)/, async route => {
      await new Promise(resolve => setTimeout(resolve, 2200));
      await route.continue().catch(() => {});
    });
    await page.addInitScript(() => {
      window.firstPaintSamples = [];
      const started = performance.now();
      function sample() {
        const body = document.body;
        const heading = document.querySelector('h1');
        if (body && heading) {
          const style = getComputedStyle(body);
          const brand = document.querySelector('header a, .omoba-brand');
          window.firstPaintSamples.push({ time: performance.now(), background: style.backgroundColor, opacity: style.opacity, visibility: style.visibility, heading: heading.getBoundingClientRect().toJSON(), brandWidth: brand?.getBoundingClientRect().width });
        }
        if (performance.now() - started < 6500) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    for (const load of ['cold', 'reload']) {
      if (load === 'cold') await navigate(page, url);
      else await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('h1').waitFor();
      await page.waitForTimeout(200);
      const first = await page.evaluate(() => {
        const heading = document.querySelector('h1');
        const style = getComputedStyle(document.body);
        return { heading: heading.getBoundingClientRect().toJSON(), background: style.backgroundColor, opacity: style.opacity, visibility: style.visibility, fontSize: parseFloat(getComputedStyle(heading).fontSize), brandWidth: document.querySelector('header a, .omoba-brand')?.getBoundingClientRect().width };
      });
      assert.equal(first.background, 'rgb(8, 14, 26)', name + ' branded background without CSS/JS downloads');
      assert.equal(first.opacity, '1', name + ' content is not hidden behind a loading gate');
      assert.equal(first.visibility, 'visible');
      assert.ok(first.fontSize >= 32, name + ' heading has its real presentation');
      assert.equal(await page.locator('link[rel="stylesheet"]').count(), 0, name + ' initial CSS is inline');
      assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
      if (name === 'landing') {
        assert.equal(await page.locator('header').evaluate(el => getComputedStyle(el).position), 'fixed');
        assert.equal((await page.locator('header').boundingBox()).height, 73);
      } else {
        assert.equal(await page.locator('.workshop-layout').evaluate(el => getComputedStyle(el).display), 'grid');
      }
      if (process.env.EVIDENCE_DIR) await page.screenshot({ path: process.env.EVIDENCE_DIR + '/' + name + '-' + load + '-early.png' });
      await page.waitForTimeout(3000);
      const samples = await page.evaluate(() => window.firstPaintSamples);
      assert.ok(samples.length > 5, 'Early render frames were sampled');
      for (const sample of samples) assert.equal(sample.background, first.background, name + ' unstyled paint sample');
      const late = samples.filter(sample => sample.time >= samples[0].time + 250).at(-1);
      assert.ok(late, 'Late font sample exists');
      assert.ok(Math.abs(late.heading.height - first.heading.height) < 1, name + ' no late heading reflow');
      assert.ok(Math.abs(late.heading.y - first.heading.y) < 1, name + ' no late heading jump');
      assert.ok(Math.abs(late.brandWidth - first.brandWidth) < 1, name + ' no late logo text jump');
      checks.push({ name, url, load, passed: true, cssRequests, samples: samples.length, background: first.background, headingHeight: first.heading.height });
      console.log(name + ' ' + load + ': styled without CSS/JS downloads; no late font jump');
    }
    await context.close();
  }
  // Normal hydration and navigation still work with the changed CSS delivery.
  const context = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1535, height: 1000 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const [name, origin, paths] of [['portal', portal, ['/workshop', '/creators', '/me']], ...(process.env.LANDING_URL ? [['landing', process.env.LANDING_URL, ['/', '/donate', '/privacy']]] : [])]) {
    for (const path of paths) {
      await navigate(page, origin + path);
      await page.waitForLoadState('networkidle');
      assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(8, 14, 26)');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
      checks.push({ name, path, normalHydration: true, passed: true });
    }
  }
  assert.deepEqual(errors, [], 'No normal hydration errors');
  await context.close();
  if (process.env.RESULT_FILE) await fs.writeFile(process.env.RESULT_FILE, JSON.stringify({ passed: true, browser: 'Chrome', locale: 'ru-RU', viewport: '1535×1000', checks, limitations: ['Desktop viewport; physical mobile devices and Safari were not verified.'] }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks: checks.length }));
} finally { await browser.close(); }
