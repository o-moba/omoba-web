// Actual standalone BFF/SSR with a synthetic Account API. The exact hosted
// origin is remapped only inside this child process; no hosted request occurs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
const out = '.agent/hosted-dev-account/browser';
await mkdir(out, { recursive: true });
const key = 'd'.repeat(64), calls = [], browserRequests = [];
let redirect = false, redirected = 0;
const upstream = createServer(async (req, res) => {
  for await (const _ of req) {}
  if (req.url === '/redirected') { redirected++; res.writeHead(200); res.end('{}'); return; }
  calls.push({ path: req.url, correctKey: req.headers['x-omoba-portal-key'] === key });
  if (redirect) { res.writeHead(302, { Location: '/redirected' }); res.end(); return; }
  res.setHeader('Content-Type', 'application/json');
  if (new URL(req.url, 'http://fixture').pathname === '/v1/supporters') res.end(JSON.stringify({ supporters: [], next_cursor: null, data_as_of: String(Date.now()) }));
  else if (req.url === '/v1/me') { res.writeHead(401); res.end('{"code":"unauthenticated"}'); }
  else if (req.url === '/v1/auth/pairings/cancel') res.end('{"status":"cancelled"}');
  else if (req.url === '/v1/auth/pairings') res.end(JSON.stringify({ pair_id: 'a'.repeat(64), poll_secret: 'b'.repeat(64), code: 'ABCD2345', expires_at: Math.floor(Date.now()/1000)+300 }));
  else { res.writeHead(404); res.end('{}'); }
});
await new Promise(r => upstream.listen(0, '127.0.0.1', r));
const api = 'http://127.0.0.1:' + upstream.address().port;
const preload = resolve(out, 'fetch-fixture.mjs');
await writeFile(preload, `const original = globalThis.fetch;globalThis.fetch = (input, init) => { const url = new URL(typeof input === 'string' ? input : input.url ?? input); if(url.origin === 'https://account.dev.omoba.io') return original(${JSON.stringify(api)} + url.pathname + url.search, init); return original(input, init); };\n`);
const port = 3045, origin = 'http://127.0.0.1:' + port;
const server = spawn(process.execPath, ['scripts/start.mjs'], { env: { ...process.env, NODE_OPTIONS: '--import=' + preload,
  PORT: String(port), OMOBA_CONTOUR: 'dev', OMOBA_PORTAL_ORIGIN: origin, OMOBA_ALLOW_INSECURE_LOCAL: '1',
  OMOBA_ACCOUNT_MODE: 'enabled', OMOBA_ACCOUNT_API_URL: 'https://account.dev.omoba.io', OMOBA_ACCOUNT_INGRESS_KEY: key
}, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '', browser;
server.stdout.on('data', b => log += b); server.stderr.on('data', b => log += b);
try {
  let ready = false;
  for(let i=0;i<100;i++) { if(server.exitCode!==null) throw new Error(log);try { if((await fetch(origin+'/supporters')).ok) {ready=true;break;} } catch {} await new Promise(r=>setTimeout(r,100)); }
  assert.ok(ready, log);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ locale: 'en-US', viewport: { width:1280,height:720 } });
  const page = await context.newPage();
  page.on('request', req => browserRequests.push({ hasKey: req.headers()['x-omoba-portal-key'] !== undefined, leaks: (req.postData() || '').includes(key) }));
  await page.goto(origin+'/supporters');
  await page.getByRole('status').filter({ hasText:'No public supporters yet' }).waitFor();
  const spoof = await page.evaluate(async () => { const r=await fetch('/api/supporters',{headers:{'X-Omoba-Portal-Key':'browser-spoof'}});return {status:r.status,text:await r.text(),headers:[...r.headers]}; });
  assert.equal(spoof.status,200); assert.ok(!JSON.stringify(spoof).includes(key));
  await context.addCookies([{name:'omoba-session',value:'c'.repeat(64),url:origin},{name:'omoba-pair',value:'a'.repeat(64)+'.'+'b'.repeat(64),url:origin}]);
  await page.goto(origin+'/me');
  const pairing = await page.evaluate(async () => { const csrf=await (await fetch('/api/csrf')).json();const r=await fetch('/api/auth/pairings',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf.token},body:'{}'});return {status:r.status,text:await r.text()}; });
  assert.equal(pairing.status,200);assert.ok(!pairing.text.includes(key));
  assert.ok(calls.some(c=>c.path==='/v1/me'), 'SSR account fetch reaches the protected ingress');
  assert.ok(calls.some(c=>c.path==='/v1/auth/pairings/cancel'), 'pair cancellation uses the same protected ingress');
  assert.ok(calls.length>=4 && calls.every(c=>c.correctKey));
  assert.ok(!(await page.content()).includes(key));
  assert.ok(!JSON.stringify(await context.cookies()).includes(key));
  redirect=true;
  const rejected=await page.evaluate(async()=>{const r=await fetch('/api/supporters');return r.status;});
  assert.equal(rejected,503);await page.goto(origin+'/me');assert.equal(redirected,0, 'BFF and SSR never follow redirects with the ingress credential');
  // The deliberately forged inbound header is the only browser request carrying it.
  assert.equal(browserRequests.filter(r=>r.hasKey).length,1);assert.ok(browserRequests.every(r=>!r.leaks));
  async function scan(dir) { for(const e of await readdir(dir,{withFileTypes:true})) {const p=join(dir,e.name);if(e.isDirectory()) await scan(p);else if(/\.(js|json)$/.test(p)) {const bytes=await readFile(p,'utf8');assert.ok(!bytes.includes(key));assert.ok(!bytes.includes('OMOBA_ACCOUNT_INGRESS_KEY'));}} }
  await scan('.next/static');
  await writeFile(out+'/verification.json',JSON.stringify({pass:true,viewport:'1280x720',locale:'en',calls,redirected,browserRequestCount:browserRequests.length,noSecretInHtmlCookiesStatic:true},null,2)+'\n');
  console.log('PASS exact dev BFF/SSR ingress, forged browser header isolation, redirects refused, no key in browser HTML/cookies/static');
} finally {
  await browser?.close();server.kill('SIGTERM');await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));await new Promise(r=>upstream.close(r));await writeFile(out+'/server.log',log.replaceAll(key,'<redacted-fixture-key>'));
}
