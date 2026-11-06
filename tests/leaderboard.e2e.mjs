// Leaderboard page and the opt-out toggle against a local portal + Account API
// (LR-47). Public synthetic fixture key 7 (seed-local-portal); local test
// services only, never production. Expects fixture 7 to have rated_matches >= 20.
import {chromium} from '@playwright/test';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.OMOBA_E2E_PORTAL_ORIGIN||'http://127.0.0.1:3010',api=process.env.OMOBA_E2E_ACCOUNT_API_URL||'http://127.0.0.1:40550';
for(const value of [origin,api]){const url=new URL(value);assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash,'synthetic fixture tests require loopback HTTP origins');}
const browser=await chromium.launch({channel:'chrome',headless:true});
async function call(page,path,method='GET',body){return page.evaluate(async({path,method,body})=>{const headers={};if(method!=='GET'){headers['Content-Type']='application/json';headers['X-CSRF-Token']=(await(await fetch('/api/csrf')).json()).token;headers['Idempotency-Key']=crypto.randomUUID();}const r=await fetch('/api/'+path,{method,headers,body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};},{path,method,body});}
async function login(seed){const c=await browser.newContext({locale:'ru-RU',viewport:{width:390,height:844}}),p=await c.newPage();await p.goto(origin+'/login');await p.getByRole('button',{name:'Получить код'}).click();const code=(await p.locator('.pair-code').innerText()).replace(/[^A-Z0-9]/g,'');const k=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,seed)]),format:'der',type:'pkcs8'});const pub=createPublicKey(k).export({format:'der',type:'spki'}).subarray(-32).toString('hex');const q=async(path,body)=>{const r=await fetch(api+'/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json()};const {challenge:x}=await q('auth/pairings/lookup',{code,public_key:pub});await q('auth/pairings/approve',{challenge:x,decision:'approve',signature:sign(null,Buffer.from(JSON.stringify(['omoba.web.pair.v1',x.origin,x.pair_id,x.nonce,x.public_key,x.browser_binding,'approve',x.scopes,x.expires_at])),k).toString('hex')});await p.waitForURL('**/me');return p;}
async function settings(page,values){const m=(await call(page,'me')).data;const {version,...current}=m.settings;const result=await call(page,'me/settings','PATCH',{...current,...values,expected_version:version});assert.equal(result.status,200,JSON.stringify(result.data));}

let a;
const out='.agent/browser/leaderboard';
try {
 a=await login(7);
 const me=(await call(a,'me')).data;
 assert.equal(typeof me.settings.leaderboard_listed,'boolean');
 await settings(a,{leaderboard_listed:true});
 const board=(await call(a,'leaderboard')).data;
 assert.equal(board.min_rated_matches,20);
 assert.ok(board.entries.length>=1);
 assert.ok(board.entries.every((e,i)=>e.rank===i+1&&typeof e.nickname==='string'&&Number.isInteger(e.rating)));
 assert.ok(board.entries.every((e,i,all)=>i===0||all[i-1].rating>=e.rating),'ordered by rating');
 assert.ok(Number.isInteger(board.me.rank),'the fixture is ranked');
 assert.equal(board.me.listed,true);

 await mkdir(out,{recursive:true});
 await a.goto(origin+'/leaderboard');
 await a.locator('[data-leaderboard]').waitFor();
 const rows=await a.locator('[data-leaderboard] tbody tr').count();
 assert.equal(rows,board.entries.length);
 const text=await a.locator('main').innerText();
 assert.ok(text.includes(me.profile.nickname),'own nickname on the ladder');
 assert.ok(!/MMR/.test(text),'no MMR jargon');
 assert.ok(!/_/.test(text.replace(me.profile.nickname,'')),'no raw codes');
 await a.screenshot({path:out+'/mobile.png',fullPage:true});
 assert.ok(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll at 390px');

 // Opt out through Settings: hidden from the ladder, told so on the page.
 await a.goto(origin+'/settings');
 const toggle=a.locator('[data-leaderboard-listed]');
 await toggle.waitFor();
 assert.equal(await toggle.isChecked(),true);
 await toggle.uncheck();
 await toggle.locator('xpath=ancestor::form').getByRole('button',{name:/Сохранить|Save/}).click();
 await a.getByRole('status').filter({hasText:/Сохранено|Saved/}).waitFor();
 const hidden=(await call(a,'leaderboard')).data;
 assert.equal(hidden.me.listed,false);
 assert.equal(hidden.me.rank,null);
 assert.ok(!hidden.entries.some(e=>e.profile_id===me.profile.profile_id));
 await a.goto(origin+'/leaderboard');
 await a.locator('main').filter({hasText:/скрыт|hidden/i}).waitFor();
 await a.screenshot({path:out+'/hidden.png',fullPage:true});

 // Newcomer progress line on the overview for the second fixture.
 const b=await login(8);
 const mb=(await call(b,'me')).data;
 if(mb.profile.rated_matches<20){await b.goto(origin+'/me');await b.locator('main').filter({hasText:/Новичок · \d+\/20/}).waitFor();}
 await b.close();
 await writeFile(out+'/result.json',JSON.stringify({passed:true,entries:board.entries.length,me:board.me,checks:['ladder ordered, ranked, own row','no MMR/raw codes','390px no horizontal scroll','settings opt-out hides and explains','newcomer progress line'],limitations:['Loopback fixture database; not the RU production API.']},null,2));
 console.log('PASS leaderboard page, opt-out and newcomer line',JSON.stringify(board.me));
} finally {
 if(a){try{await settings(a,{leaderboard_listed:true});}catch{} await call(a,'auth/logout','POST',{});}
 await browser.close();
}
