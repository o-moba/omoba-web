// Built OMOBA market + real shared SDK + bounded local Registry fixture.
// Optional OMOBA_PREVIEW_MODEL points to an actual Wildspark set for visual evidence.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

function fixtureGlb() {
  const positions = new Float32Array([-1,-0.3,0, 1,-0.3,0, 0,0.6,0]);
  const bin = Buffer.from(positions.buffer);
  const json = { asset:{version:'2.0'}, scene:0, scenes:[{nodes:[0,1]}],
    nodes:[{name:'WildsparkSetRepeater',mesh:0},{name:'WildsparkSetLauncher',mesh:0,scale:[0,0,0],rotation:[0,0,0.3826834,0.9238795]}],
    meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],
    materials:[{doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[0.3,0.8,1,1],metallicFactor:0,roughnessFactor:0.6}}],
    buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:bin.length}],
    accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-1,-0.3,0],max:[1,0.6,0]}] };
  let jsonBytes = Buffer.from(JSON.stringify(json));
  jsonBytes = Buffer.concat([jsonBytes,Buffer.alloc((4-jsonBytes.length%4)%4,32)]);
  const out = Buffer.alloc(12+8+jsonBytes.length+8+bin.length);
  out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
  out.writeUInt32LE(jsonBytes.length,12);out.writeUInt32LE(0x4e4f534a,16);jsonBytes.copy(out,20);
  out.writeUInt32LE(bin.length,20+jsonBytes.length);out.writeUInt32LE(0x004e4942,24+jsonBytes.length);bin.copy(out,28+jsonBytes.length);
  return out;
}
const model = process.env.OMOBA_PREVIEW_MODEL ? await readFile(process.env.OMOBA_PREVIEW_MODEL) : fixtureGlb();
const avatar = process.env.OMOBA_PREVIEW_AVATAR ? await readFile(process.env.OMOBA_PREVIEW_AVATAR) : fixtureGlb();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const uuid = n => `${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
const output = process.env.PREVIEW_EVIDENCE_DIR || '.agent/tasks/MARKET-3D-20261014';
await mkdir(output,{recursive:true});
let registryOrigin, requests = 0, corrupt = false;
const registry = createServer((req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.url === '/v2/assets?project=omoba') {
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({schema:'ekza.asset.catalog.v2',items:[['weapon',model,'Astral Ivory Wildspark set','a'],['avatar',avatar,'Community avatar','b']].map(([kind,bytes,name,n])=>({
      id:`ekza:${kind}:${uuid(n)}`,assetKind:kind,name,description:'Community 3D preview acceptance fixture.',
      creator:{name:'Community artist'},license:{text:'CC-BY-4.0',attribution:'Test fixture'},origin:{kind:'studio',revisionId:uuid('e')},access:'free',
      renditions:[{platform:'desktop',profile:kind==='weapon'?'handheld-glb-v1':'humanoid-glb-v1',format:'glb',sha256:digest(bytes),sizeBytes:bytes.length,
        downloadUrl:`${registryOrigin}/v1/studio/assets/${digest(bytes)}/rendition`}],
      projectSupport:[{projectId:'omoba',platform:'desktop',profile:kind==='weapon'?'handheld-glb-v1':'humanoid-glb-v1',status:'approved',requirementId:kind==='weapon'?'wildspark.handheld.set':null}],
    }))}));return;
  }
  if(req.url.endsWith('/rendition')) {
    requests++;
    const bytes=req.url.includes(digest(model))?model:avatar;
    res.setHeader('Content-Type','model/gltf-binary');
    res.end(corrupt?Buffer.alloc(bytes.length):bytes);return;
  }
  res.writeHead(404);res.end();
});
await new Promise(r=>registry.listen(0,'127.0.0.1',r));
registryOrigin=`http://127.0.0.1:${registry.address().port}`;
const port=Number(process.env.PREVIEW_TEST_PORT||3027),origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,PORT:String(port),
  OMOBA_PORTAL_ORIGIN:origin,OMOBA_ALLOW_INSECURE_LOCAL:'1',OMOBA_ACCOUNT_MODE:'disabled',
  OMOBA_REGISTRY_URL:registryOrigin,OMOBA_STUDIO_URL:registryOrigin},stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
let browser;
const checks=[];
try {
  for(let i=0;i<100;i++){
    if(server.exitCode!==null)throw Error(log);
    try{if((await fetch(origin+'/market')).ok)break}catch{}
    if(i===99)throw Error('Server start timeout '+log);
    await new Promise(r=>setTimeout(r,200));
  }
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:950},locale:'en'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/market');
  const opener=page.getByRole('button',{name:'View Astral Ivory Wildspark set in 3D',exact:true});
  await opener.waitFor();assert.equal(requests,0);assert.equal(await page.locator('canvas').count(),0);
  checks.push('No GLB download or canvas before opening');
  await opener.click();
  const dialog=page.getByRole('dialog');
  await dialog.locator('[data-asset-render-state="ready"]').waitFor({timeout:30000});
  assert.equal(await dialog.locator('canvas').count(),1);
  await page.screenshot({path:output+'/market-repeater.png'});
  const initial=requests;
  await dialog.getByRole('button',{name:'Launcher',exact:true}).click();
  assert.equal(await dialog.getByRole('button',{name:'Launcher',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await dialog.getByRole('button',{name:'Repeater',exact:true}).getAttribute('aria-pressed'),'false');
  await page.screenshot({path:output+'/market-launcher.png'});
  await dialog.getByLabel('Lighting',{exact:true}).selectOption('dramatic');
  await dialog.getByLabel('Shading',{exact:true}).selectOption('clay');
  await page.screenshot({path:output+'/market-clay.png'});
  await dialog.getByLabel('Shading',{exact:true}).selectOption('wireframe');
  await dialog.getByLabel('Exposure',{exact:true}).fill('1.7');
  assert.equal(requests,initial);checks.push('Variants, lighting, materials and exposure do not reload model');
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'detached'});assert.equal(await page.locator('canvas').count(),0);
  assert.equal(await opener.evaluate(e=>e===document.activeElement),true);checks.push('Escape closes, frees canvas, returns focus');
  await page.getByRole('button',{name:'View Community avatar in 3D',exact:true}).click();
  await dialog.locator('[data-asset-render-state="ready"]').waitFor();
  await page.screenshot({path:output+'/market-avatar.png'});checks.push('Avatar path renders through same SDK');
  await dialog.getByRole('button',{name:'Close 3D preview'}).click();
  corrupt=true;
  await opener.click();
  await dialog.locator('[data-asset-render-state="failed"]').waitFor();
  await dialog.getByRole('alert').waitFor();assert.equal(await dialog.locator('canvas').count(),0);
  corrupt=false;
  await dialog.getByRole('button',{name:'Retry 3D preview'}).click();
  await dialog.locator('[data-asset-render-state="ready"]').waitFor();checks.push('Wrong SHA fails closed; retry recovers');
  // A lost context must release resources and show a retryable poster, not a blank canvas.
  await dialog.locator('canvas').evaluate(c=>c.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
  await dialog.locator('[data-asset-render-state="failed"]').waitFor();
  await dialog.getByRole('button',{name:'Close 3D preview'}).click();checks.push('WebGL loss has a recoverable fallback');
  await page.setViewportSize({width:390,height:844});
  await opener.click();await dialog.locator('[data-asset-render-state="ready"]').waitFor();
  assert.equal(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  await page.screenshot({path:output+'/market-mobile.png'});checks.push('390px viewport fits without horizontal overflow');
  assert.deepEqual(errors,[]);
  await writeFile(output+'/preview-verification.json',JSON.stringify({checks,modelSha:digest(model),avatarSha:digest(avatar),errors},null,2));
  console.log(checks.join('\n'));
} finally {
  await browser?.close();server.kill('SIGTERM');registry.closeAllConnections();registry.close();
  await writeFile(output+'/server.log',log);
}
