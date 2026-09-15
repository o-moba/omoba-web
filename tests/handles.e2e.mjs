// Two isolated browser contexts, public synthetic fixture keys; local test services only.
import {chromium} from '@playwright/test';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3010',api='http://127.0.0.1:40550';
const browser=await chromium.launch({channel:'chrome',headless:true});
async function call(page,path,method='GET',body){return page.evaluate(async({path,method,body})=>{const headers={};if(method!=='GET'){headers['Content-Type']='application/json';headers['X-CSRF-Token']=(await(await fetch('/api/csrf')).json()).token;headers['Idempotency-Key']=crypto.randomUUID();}const r=await fetch('/api/'+path,{method,headers,body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};},{path,method,body});}
async function login(seed){const c=await browser.newContext(),p=await c.newPage();await p.goto(origin+'/login');await p.getByRole('button',{name:'Получить код'}).click();const code=(await p.locator('.pair-code').innerText()).replace(/[^A-Z0-9]/g,'');const k=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,seed)]),format:'der',type:'pkcs8'});const pub=createPublicKey(k).export({format:'der',type:'spki'}).subarray(-32).toString('hex');const q=async(path,body)=>{const r=await fetch(api+'/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json()};const {challenge:x}=await q('auth/pairings/lookup',{code,public_key:pub});await q('auth/pairings/approve',{challenge:x,decision:'approve',signature:sign(null,Buffer.from(JSON.stringify(['omoba.web.pair.v1',x.origin,x.pair_id,x.nonce,x.public_key,x.browser_binding,'approve',x.scopes,x.expires_at])),k).toString('hex')});await p.waitForURL('**/me');return p;}

let a,b,original;
try {
 a=await login(7);b=await login(8);const ma=(await call(a,'me')).data,mb=(await call(b,'me')).data;original=ma.profile.nickname;
 const name='Лиса'+Date.now().toString().slice(-8)+'#0042';
 await a.goto(origin+'/settings');const field=a.locator('input[placeholder="Nickname#1234"]');await field.fill(name);await field.locator('xpath=ancestor::form').getByRole('button').click();await a.getByRole('status').filter({hasText:/Сохранено|Saved/}).waitFor();
 const changed=(await call(a,'me')).data;assert.equal(changed.profile.nickname,name);assert.equal(changed.profile.profile_id,ma.profile.profile_id);assert.equal(changed.profile.rating,ma.profile.rating);
 await a.goto(origin+'/me');assert.equal(await a.locator('.code').innerText(),name);assert.equal((await a.locator('body').innerText()).includes(ma.profile.profile_id),false);
 await b.goto(origin+'/friends');const search=b.locator('input[placeholder="Nickname#1234"]');await search.fill(name.toUpperCase());await b.locator('form.search').getByRole('button').click();await b.locator('.friend-row').filter({hasText:name}).first().waitFor();
 const found=(await call(b,'players?query='+encodeURIComponent(name.toUpperCase()))).data.players[0];assert.deepEqual(Object.keys(found).sort(),['nickname','profile_id']);assert.equal(found.profile_id,ma.profile.profile_id);
 const conflict=await call(b,'me/profile','PATCH',{nickname:name.toUpperCase()});assert.equal(conflict.status,409);assert.equal(conflict.data.code,'handle_taken');assert.equal((await call(b,'me')).data.profile.nickname,mb.profile.nickname);
 await mkdir('.agent/browser/handles',{recursive:true});await b.screenshot({path:'.agent/browser/handles/desktop-find.png',fullPage:true});await b.setViewportSize({width:390,height:844});await b.screenshot({path:'.agent/browser/handles/mobile-find.png',fullPage:true});assert.ok(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await writeFile('.agent/browser/handles/result.json',JSON.stringify({passed:true,checks:['settings edits full Unicode handle','identity and rating preserved','share field uses handle without internal ID','exact uppercase lookup resolves same player','lookup discloses only name and ID','conflict preserves other account','390px layout'],limitations:['Browser viewport emulation; physical phones not tested.']},null,2));console.log('PASS browser nickname/tag settings, lookup and collision');
} finally {
 if(a&&original)await call(a,'me/profile','PATCH',{nickname:original});
 if(a)await call(a,'auth/logout','POST',{});if(b)await call(b,'auth/logout','POST',{});await browser.close();
}
