import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { gameDirectoryResponse, MAX_DIRECTORY_BYTES } from '../src/lib/game-directory-server.mjs';

const env = { OMOBA_MARKET: 'ru', OMOBA_PORTAL_ORIGIN: 'https://omoba.ru', OMOBA_ACCOUNT_API_URL: 'http://127.0.0.1:40550', OMOBA_TRUST_LOOPBACK_PROXY: '1' };
function signed(overrides = {}) {
  const now = Date.now();
  const payload = JSON.stringify({version:1,region:'ru',contour:'production',sequence:'18446744073709551615',issued_at_ms:now,expires_at_ms:now+60000,policy:{min_release:'0.45.0',maintenance:true,update_url:null,message:'Проверка каталога'},lobbies:[],...overrides})
    .replace('"sequence":"18446744073709551615"','"sequence":18446744073709551615');
  // Publicly known fixture identity; never a production trust pin.
  const key = crypto.createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,7)]),format:'der',type:'pkcs8'});
  const message = Buffer.concat([Buffer.from('omoba.game-directory.v1\0'),Buffer.from([7]),Buffer.from('fixture'),Buffer.from(payload)]);
  return JSON.stringify({key_id:'fixture',payload,signature:crypto.sign(null,message,key).toString('hex')},null,2);
}
const request = (path='/api/game/directory', init={}) => new Request('https://omoba.ru'+path,init);
const response = body => new Response(body,{headers:{'Content-Type':'application/json'}});

test('anonymous delivery preserves exact signed bytes, closes cookies and ignores browser forwarding/authentication',async()=>{
  const raw=signed();let calls=0;
  const fetcher=async(url,options)=>{calls++;assert.equal(url,env.OMOBA_ACCOUNT_API_URL+'/v1/game-directory');assert.deepEqual(options.headers,{Accept:'application/json'});assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert(options.signal instanceof AbortSignal);return response(raw);};
  const out=await gameDirectoryResponse(request(undefined,{headers:{Cookie:'session=private',Authorization:'Bearer private','X-Forwarded-Host':'evil.example','X-Omoba-Portal-Key':'browser-key'}}),env,fetcher);
  assert.equal(out.status,200);assert.equal(await out.text(),raw);assert.equal(out.headers.get('set-cookie'),null);assert.equal(out.headers.get('cache-control'),'no-store');assert.equal(calls,1);
  const head=await gameDirectoryResponse(request(undefined,{method:'HEAD'}),env,fetcher);assert.equal(head.status,200);assert.equal(await head.text(),'');
});

test('hosted upstream gets only the configured ingress key, never the player token',async()=>{
  const hosted={...env,OMOBA_ACCOUNT_API_URL:'https://account.omoba.ru',OMOBA_ACCOUNT_INGRESS_KEY:'a'.repeat(64)};
  const out=await gameDirectoryResponse(request(undefined,{headers:{Authorization:'Bearer private'}}),hosted,async(url,options)=>{assert.equal(url,'https://account.omoba.ru/v1/game-directory');assert.deepEqual(options.headers,{Accept:'application/json','X-Omoba-Portal-Key':'a'.repeat(64)});return response(signed());});assert.equal(out.status,200);
});

test('wrong host, method and request-selected authority never reach the API',async()=>{
  let calls=0;const fetcher=async()=>{calls++;return response(signed());};
  for(const [r,status] of [[request(undefined,{method:'POST'}),405],[request('/api/game/directory?region=global'),400],[request('/api/other'),404],[request(undefined,{headers:{Host:'evil.example','X-Forwarded-Host':'omoba.ru'}}),404]]) assert.equal((await gameDirectoryResponse(r,env,fetcher)).status,status);
  assert.equal(calls,0);
});

test('foreign scope, expiry, future clock and malformed wire are unavailable without reflecting content',async()=>{
  for(const raw of [signed({region:'global'}),signed({contour:'dev'}),signed({expires_at_ms:Date.now()-1}),signed({issued_at_ms:Date.now()+31000,expires_at_ms:Date.now()+60000}),signed({expires_at_ms:Date.now()+8*86400000}),'{private details',JSON.stringify({key_id:'fixture',payload:'{}',signature:'x'.repeat(128)}),'[]']) {
    const out=await gameDirectoryResponse(request(),env,async()=>response(raw));assert.equal(out.status,503);assert.deepEqual(await out.json(),{code:'game_directory_unavailable'});
  }
});

test('bounded streamed bodies cancel excess bytes, including a missing or dishonest Content-Length',async()=>{
  for(const length of [undefined,'1',String(MAX_DIRECTORY_BYTES+1)]) {
    let cancelled=false;
    const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_DIRECTORY_BYTES));c.enqueue(new Uint8Array(1));},cancel(){cancelled=true;}});
    const headers={'Content-Type':'application/json'};if(length!==undefined)headers['Content-Length']=length;
    const out=await gameDirectoryResponse(request(),env,async()=>new Response(body,{headers}));assert.equal(out.status,503);assert(cancelled);
  }
});

test('upstream outage, redirects, invalid UTF-8 and HTML cannot become usable documents',async()=>{
  for(const fetcher of [async()=>{throw new Error('private URL/token');},async()=>new Response('private',{status:302,headers:{Location:'https://evil.example'}}),async()=>new Response('private',{status:500}),async()=>new Response(signed(),{headers:{'Content-Type':'text/html'}}),async()=>response(Uint8Array.of(0xff))]) {
    const out=await gameDirectoryResponse(request(),env,fetcher);assert.equal(out.status,503);assert.deepEqual(await out.json(),{code:'game_directory_unavailable'});
  }
});

test('disabled or unsupported regions do not make an upstream request',async()=>{
  let calls=0;const fetcher=async()=>{calls++;return response(signed());};
  for(const settings of [{...env,OMOBA_ACCOUNT_MODE:'disabled'},{...env,OMOBA_MARKET:'cn'}])assert.equal((await gameDirectoryResponse(request(),settings,fetcher)).status,503);
  assert.equal(calls,0);
});
