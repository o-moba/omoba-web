// Real portal/BFF HTTP checks, synthetic loopback Account API (preview fixture).
// Start tests/portal-release.fixture.mjs and the portal on matching loopback ports.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { PREVIEW_SESSION, PREVIEW_ACCOUNT } from './portal-release.fixture.mjs';
const origin=process.env.PORTAL_RELEASE_ORIGIN||'http://127.0.0.1:3018';
assert.equal(new URL(origin).hostname,'127.0.0.1','Only isolated loopback fixtures');
const checks=[];
const cookieOf=response=>response.headers.getSetCookie().filter(value=>!value.includes('Max-Age=0')).map(value=>value.split(';')[0]).join('; ');
const get=(path,cookie)=>fetch(origin+path,{redirect:'manual',headers:{'Accept-Language':'en-US',...(cookie?{Cookie:cookie}:{})}});

assert.equal((await get('/api/me')).status,401);checks.push('private account data rejects a guest');
const signed='omoba-session='+PREVIEW_SESSION;
const me=await get('/api/me',signed);assert.equal(me.status,200);assert.match(me.headers.get('cache-control'),/no-store/);checks.push('private data stays no-store');
const guest=await get('/play');assert.equal(guest.status,200);const guestHtml=await guest.text();assert.match(guestHtml,/Start practice/);assert.ok(!/<iframe\b/.test(guestHtml));assert.match(guestHtml,/returnTo=%2Fplay/);assert.match(guestHtml,/local practice|local practice match/i);checks.push('browser play is lazy, truthful and preserves sign-in destination');
assert.equal(guest.headers.get('x-frame-options'),'DENY');checks.push('portal pages retain frame denial');
const signedPlay=await get('/play',signed);const signedHtml=await signedPlay.text();assert.match(signedHtml,/Preview Ranger#2048/);assert.ok(!signedHtml.includes(PREVIEW_SESSION));checks.push('play receives only a display name, no session token');

for(const [code,expected] of [['preview-linked',PREVIEW_ACCOUNT.profile.nickname],['preview-new','Preview VK']]) {
 const start=await get('/api/auth/vk/start?method=vkid&returnTo=%2Fplay');assert.equal(start.status,302);
 const auth=new URL(start.headers.get('location'));assert.equal(auth.origin,'https://id.vk.ru');assert.equal(auth.searchParams.get('code_challenge_method'),'S256');
 assert.ok(start.headers.getSetCookie().some(value=>value.includes('HttpOnly')));
 const callback='/api/auth/vk/callback?'+new URLSearchParams({state:auth.searchParams.get('state'),code,device_id:'preview-browser'});
 const result=await get(callback,cookieOf(start));assert.equal(result.status,302);assert.equal(new URL(result.headers.get('location')).pathname,'/play');
 const cookie=cookieOf(result);assert.ok(cookie);assert.ok(result.headers.getSetCookie().filter(value=>!value.includes('Max-Age=0')).every(value=>value.includes('HttpOnly')));
 const html=await (await get('/play',cookie)).text();assert.ok(html.includes(expected));assert.ok(!html.includes(PREVIEW_SESSION));
 checks.push(`VK ${code==='preview-linked'?'linked account':'new account ticket'} callback returns to /play with HttpOnly state`);
}
const start=await get('/api/auth/vk/start?method=vkid&returnTo=%2Fplay');
const rejected=await get('/api/auth/vk/callback?state=foreign-state&code=preview-linked&device_id=preview-browser',cookieOf(start));
assert.match(rejected.headers.get('location'),/\/login\?signin=failed/);assert.equal(cookieOf(rejected),'');checks.push('foreign OAuth state sets no session');

const frame=await get('/game/index.html');assert.equal(frame.headers.get('x-frame-options'),'SAMEORIGIN');assert.match(frame.headers.get('content-security-policy'),/frame-ancestors 'self'/);checks.push('only game assets permit same-origin embedding');
if(process.env.REQUIRE_BROWSER_GAME==='1') {
 const response=await get('/game/BUILD_INFO.json');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/json/);
 const manifest=await response.json();assert.equal(manifest.mode,'local-practice');assert.equal(manifest.networked,false);assert.equal(manifest.ranked,false);
 const entry=await frame.text();assert.match(entry,/\.js/);assert.match(entry,/\.wasm/);
 const wasm=Object.keys(manifest.sha256??manifest.hashes).find(path=>path.endsWith('.wasm'));
 const responseWasm=await get('/game/'+wasm);assert.equal(responseWasm.status,200);assert.match(responseWasm.headers.get('content-type'),/application\/wasm/);
 const bytes=new Uint8Array(await responseWasm.arrayBuffer());assert.deepEqual([...bytes.slice(0,4)],[0,97,115,109]);
 checks.push('real packaged WASM and JS are served with correct content types');
}
const out='.agent/tasks/PORTAL-RELEASE-20261028/raw';await mkdir(out,{recursive:true});
await writeFile(out+'/http-checks.json',JSON.stringify({passed:true,origin,checks,limitations:['Synthetic Account API and VK exchange; no real external provider or production account was contacted.','Browser gameplay input verification is recorded separately.']},null,2));
console.log('PASS portal release HTTP checks ('+checks.length+')');
