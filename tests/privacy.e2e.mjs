// Two isolated browser contexts, public synthetic fixture keys; local test services only.
import {chromium} from '@playwright/test';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3010',api='http://127.0.0.1:40550';
const browser=await chromium.launch({channel:'chrome',headless:true});
async function call(page,path,method='GET',body){return page.evaluate(async({path,method,body})=>{const headers={};if(method!=='GET'){headers['Content-Type']='application/json';headers['X-CSRF-Token']=(await(await fetch('/api/csrf')).json()).token;headers['Idempotency-Key']=crypto.randomUUID();}const r=await fetch('/api/'+path,{method,headers,body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};},{path,method,body});}
async function login(seed){const c=await browser.newContext({locale:'ru-RU'}),p=await c.newPage();await p.goto(origin+'/login');await p.getByRole('button',{name:'Получить код'}).click();const code=(await p.locator('.pair-code').innerText()).replace(/[^A-Z0-9]/g,'');const k=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,seed)]),format:'der',type:'pkcs8'});const pub=createPublicKey(k).export({format:'der',type:'spki'}).subarray(-32).toString('hex');const q=async(path,body)=>{const r=await fetch(api+'/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json()};const {challenge:x}=await q('auth/pairings/lookup',{code,public_key:pub});await q('auth/pairings/approve',{challenge:x,decision:'approve',signature:sign(null,Buffer.from(JSON.stringify(['omoba.web.pair.v1',x.origin,x.pair_id,x.nonce,x.public_key,x.browser_binding,'approve',x.scopes,x.expires_at])),k).toString('hex')});await p.waitForURL('**/me');return p;}
let a,b,baseline;
async function settings(values){const m=(await call(a,'me')).data;const {version,...current}=m.settings;const result=await call(a,'me/settings','PATCH',{...current,...values,expected_version:version});assert.equal(result.status,200);}
try{
 a=await login(7);b=await login(8);const ma=(await call(a,'me')).data,mb=(await call(b,'me')).data;baseline=ma.settings;assert.notEqual(ma.profile.profile_id,mb.profile.profile_id);
 for(let i=0;i<3;i++){assert.equal((await call(a,'me')).data.profile.profile_id,ma.profile.profile_id);assert.equal((await call(b,'me')).data.profile.profile_id,mb.profile.profile_id);}
 const guest=await browser.newContext({locale:'ru-RU'}),g=await guest.newPage();await g.goto(origin+'/');
 await settings({public_profile_enabled:false,public_stats_enabled:false,discoverable:false});assert.equal((await call(g,'players/'+ma.profile.profile_id)).status,404);
 await settings({public_profile_enabled:true,public_stats_enabled:false,discoverable:true});const publicView=await call(g,'players/'+ma.profile.profile_id);assert.equal(publicView.status,200);assert.equal(publicView.data.profile.rating,undefined);assert.equal(publicView.data.friends,undefined);
 await settings({public_profile_enabled:false,public_stats_enabled:false,discoverable:false});assert.equal((await call(g,'players/'+ma.profile.profile_id)).status,404);
 assert.equal((await call(b,'me/profile','PATCH',{nickname:'Intruder',actor:ma.profile.profile_id})).status,400);assert.equal((await call(a,'me')).data.profile.nickname,ma.profile.nickname);
 const history=(await call(a,'me/matches?days=all')).data;assert.equal((await call(g,'matches/'+history.matches[0].result_id)).status,401);
 await writeFile('.agent/browser/privacy.json',JSON.stringify({passed:true,checks:['two authenticated browser contexts retain distinct identities','opt-in public profile','public stats hidden','publication revocation is immediate','actor injection rejected','guest cannot open full match']},null,2));console.log('PASS two-browser privacy and opt-in revocation');
}finally{if(a&&baseline){const{version,...original}=baseline;await settings(original);}if(a)await call(a,'auth/logout','POST',{});if(b)await call(b,'auth/logout','POST',{});await browser.close();}
