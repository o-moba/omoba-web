// Disposable fixture only: Account API :40556, portal :3010, synthetic seed7.
import { chromium } from '@playwright/test';
import { createPrivateKey, createPublicKey, sign, generateKeyPairSync, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin = 'http://127.0.0.1:3010', apiOrigin = 'http://127.0.0.1:40556';
const out = '.agent/tasks/SUPPORTER-2026-09-16'; await mkdir(out, { recursive: true });
const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.alloc(32, 7)]), format: 'der', type: 'pkcs8' });
const pub = k => createPublicKey(k).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
async function native(path, body) { const r = await fetch(apiOrigin + '/v1/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const v = await r.json(); assert.equal(r.status, 200, JSON.stringify(v)); return v; }
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
page.on('dialog', dialog => dialog.accept());
const deviceLabel = 'Synthetic iPhone ' + randomBytes(4).toString('hex');
async function call(path, method = 'GET', body) { return page.evaluate(async ({path,method,body}) => { const headers = {}; if (method !== 'GET') { headers['Content-Type'] = 'application/json'; headers['X-CSRF-Token'] = (await (await fetch('/api/csrf')).json()).token; } const r = await fetch('/api/' + path, {method,headers,body:body === undefined ? undefined : JSON.stringify(body)}); return {status:r.status,data:await r.json()}; }, {path,method,body}); }
const deviceKey = generateKeyPairSync('ed25519').privateKey;
const enrollment = { enrollment_id: randomBytes(32).toString('hex'), public_key: pub(deviceKey), origin, label: deviceLabel, expires_at: String(Math.floor(Date.now()/1000)+300) };
function deviceProof(action, target = null, recovery = null) { const bytes = JSON.stringify(['omoba.device.enroll.v1',origin,enrollment.enrollment_id,enrollment.public_key,enrollment.label,enrollment.expires_at,action,target,recovery]); return {enrollment,action,target_profile:target,recovery_code:recovery,signature:sign(null,Buffer.from(bytes),deviceKey).toString('hex')}; }
try {
  await page.goto(origin + '/login'); await page.getByRole('button', {name:'Получить код'}).click();
  const code = (await page.locator('.pair-code').innerText()).replace(/[^A-Z0-9]/g,'');
  const {challenge:c} = await native('auth/pairings/lookup', {code, public_key:pub(key)});
  const bytes = JSON.stringify(['omoba.web.pair.v1',c.origin,c.pair_id,c.nonce,c.public_key,c.browser_binding,'approve',c.scopes,c.expires_at]);
  await native('auth/pairings/approve', {challenge:c,decision:'approve',signature:sign(null,Buffer.from(bytes),key).toString('hex')});
  await page.waitForURL('**/me');
  await page.goto(origin + '/supporter'); await page.getByText('Supporter активен', {exact:true}).waitFor();
  await page.getByRole('button',{name:'Луна',exact:true}).click(); await page.getByRole('button',{name:'Применить в игре'}).click();
  await page.getByRole('status').filter({hasText:'Аура выбрана'}).waitFor();
  assert.equal((await call('me/supporter')).data.supporter.equipped_aura,'lunar');
  await page.screenshot({path:out+'/supporter-desktop.png',fullPage:true});
  for (const width of [360,390,430,768]) { await page.setViewportSize({width,height:844}); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'Supporter overflow '+width); }
  await page.setViewportSize({width:390,height:844}); await page.screenshot({path:out+'/supporter-phone.png',fullPage:true});
  const created = await native('auth/devices/create',deviceProof('create'));
  await page.goto(origin+'/devices'); await page.getByLabel('Код с нового устройства').fill(created.code); await page.getByRole('button',{name:'Проверить устройство'}).click();
  await page.getByRole('heading',{name:'Подтвердите привязку'}).waitFor();
  assert.ok((await page.locator('.device-confirm').innerText()).includes(enrollment.public_key.slice(0,8)+'…'+enrollment.public_key.slice(-8)));
  await page.screenshot({path:out+'/device-confirm-phone.png',fullPage:true});
  await page.getByRole('button',{name:'Разрешить доступ',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Привязка разрешена'}).waitFor();
  const status = await native('auth/devices/status',deviceProof('status')); assert.equal(status.profile_id,'7'.repeat(64));
  const complete = await native('auth/devices/complete',deviceProof('complete',status.profile_id)); assert.equal(complete.profile_id,status.profile_id);
  await page.reload(); await page.getByText(deviceLabel,{exact:true}).waitFor();
  await page.getByRole('button',{name:'Создать резервные коды'}).click(); await page.locator('.recovery-codes textarea').waitFor();
  const recovery = (await page.locator('.recovery-codes textarea').inputValue()).split('\n'); assert.equal(recovery.length,8); assert.ok(recovery.every(c=>/^[a-f0-9]{64}$/.test(c)));
  assert.equal(await page.evaluate(()=>localStorage.length),0);
  await page.getByRole('button',{name:'Я сохранил коды — скрыть'}).click(); assert.equal(await page.locator('.recovery-codes textarea').count(),0);
  await page.screenshot({path:out+'/devices-phone.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('.friend-row').filter({hasText:deviceLabel}).getByRole('button',{name:'Отключить'}).click();
  await page.waitForURL('**/login'); assert.equal((await call('me')).status,401);
  assert.deepEqual(errors,[]);
  await writeFile(out+'/browser-evidence.json',JSON.stringify({passed:true,checks:['real signed pairing','server aura preference mutation','360/390/430/768px layout','native proof + portal enrollment approval','same immutable profile on new key','one-time recovery code display without localStorage','revoke device ends browser session'],limitations:['Synthetic native proofs; physical iPhone UI not exercised.','External payments disabled; no funds moved.']},null,2));
  console.log('PASS Supporter and devices real browser/API/PostgreSQL flow');
} finally { await browser.close(); }
