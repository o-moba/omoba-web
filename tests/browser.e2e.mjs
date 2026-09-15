// Real BFF + Account API + PostgreSQL. Synthetic test identity only, never user keys.
import {chromium} from '@playwright/test';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin='http://127.0.0.1:3010',api='http://127.0.0.1:40550';
const out='.agent/browser';await mkdir(out,{recursive:true});
const key=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,7)]),format:'der',type:'pkcs8'});
const publicKey=createPublicKey(key).export({format:'der',type:'spki'}).subarray(-32).toString('hex');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function request(path,body){const r=await fetch(api+'/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const v=await r.json();assert.equal(r.status,200,JSON.stringify(v));return v;}
try{
  await page.goto(origin+'/login');await page.getByRole('button',{name:'Получить код'}).click();
  const code=await page.locator('.pair-code').innerText();const lookup=await request('auth/pairings/lookup',{code:code.replace(/[^A-Z0-9]/g,''),public_key:publicKey});const c=lookup.challenge;
  assert.equal(c.origin,origin);const tuple=['omoba.web.pair.v1',c.origin,c.pair_id,c.nonce,c.public_key,c.browser_binding,'approve',c.scopes,c.expires_at];
  await request('auth/pairings/approve',{challenge:c,decision:'approve',signature:sign(null,Buffer.from(JSON.stringify(tuple)),key).toString('hex')});
  await page.waitForURL('**/me',{timeout:15000});await page.locator('.profile-strip').waitFor();
  const me=await page.evaluate(async()=>{const r=await fetch('/api/me');return {status:r.status,data:await r.json(),cache:r.headers.get('cache-control')};});assert.equal(me.status,200);assert.ok(me.cache.includes('no-store'));
  const cookies=await context.cookies();assert.ok(cookies.find(c=>c.name==='omoba-session')?.httpOnly);assert.equal(await page.evaluate(()=>document.cookie.includes('omoba-session')),false);
  const forbidden=await page.evaluate(async()=>({unknown:(await fetch('/api/me/rating',{method:'PATCH'})).status,csrf:(await fetch('/api/me/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{"nickname":"Intruder"}'})).status}));assert.equal(forbidden.unknown,404);assert.equal(forbidden.csrf,403);
  await page.screenshot({path:out+'/desktop-profile.png',fullPage:true});
  await page.goto(origin+'/me/matches?days=all');await page.locator('.match-row').first().waitFor();await page.screenshot({path:out+'/desktop-history.png',fullPage:true});await page.locator('.match-row').first().click();await page.locator('.scoreboard').first().waitFor();await page.screenshot({path:out+'/desktop-match.png',fullPage:true});
  await page.goto(origin+'/me/stats?days=all');await page.locator('.rating-chart').waitFor();await page.screenshot({path:out+'/desktop-statistics.png',fullPage:true});
  await page.goto(origin+'/friends');await page.getByRole('heading',{name:/Входящие|Incoming/}).waitFor();await page.screenshot({path:out+'/desktop-friends.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.goto(origin+'/me/matches?days=all');await page.locator('.match-row').first().waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+'/phone-history.png',fullPage:true});
  const stranger=await browser.newContext();const strangerPage=await stranger.newPage();await strangerPage.goto(origin+'/me');assert.equal((await strangerPage.request.get(origin+'/api/me')).status(),401);await stranger.close();
  await page.goto(origin+'/settings');await page.getByRole('heading',{name:/Настройки|Settings/}).waitFor();await page.screenshot({path:out+'/phone-settings.png',fullPage:true});
  for(const [width,height] of [[360,800],[393,852],[430,932],[768,1024],[1440,900]]){await page.setViewportSize({width,height});await page.goto(origin+'/me');await page.locator('.profile-strip').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body));}
  const contrast=await page.evaluate(()=>{const css=getComputedStyle(document.documentElement);const luminance=x=>{const rgb=x.trim().replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]};return Object.fromEntries(['--text','--muted','--mint'].map(k=>[k,(luminance(css.getPropertyValue(k))+.05)/(luminance(css.getPropertyValue('--panel'))+.05)]))});for(const value of Object.values(contrast))assert.ok(value>=4.5);
  await page.getByRole('button',{name:/Выйти|Sign out|Log out/}).click();await page.waitForURL(origin+'/');assert.equal((await page.request.get(origin+'/api/me')).status(),401);assert.equal((await context.cookies()).some(c=>c.name==='omoba-session'),false);
  assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({passed:true,profile_id:me.data.profile.profile_id,checks:['signed browser-bound login','same game account','HttpOnly cookies','private no-store','CSRF','route allowlist','profile','history','match report','real statistics','friends','isolated guest browser','390px layout','logout revokes session and clears cookie','360/393/430/768/1440 widths','keyboard focus','core text palette contrast >=4.5'],limitations:['Phone viewport emulation; physical iOS/Android not tested.','Approval signed by synthetic test identity, not a physical native-client UI.']},null,2));console.log('PASS browser BFF/API/database flow; screenshots in '+out);
}finally{await browser.close();}
