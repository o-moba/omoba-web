import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateBrowserArtifact, importBrowserArtifact } from '../scripts/import-browser-game.mjs';

async function fixture(run) {
 const root=await mkdtemp(join(tmpdir(),'omoba-game-test-'));
 const files={'index.html':'<script src="game.js"></script>','game.js':'export {};','game.wasm':Buffer.from([0,97,115,109,1,0,0,0])};
 const hashes=Object.fromEntries(Object.entries(files).map(([path,bytes])=>[path,createHash('sha256').update(bytes).digest('hex')]));
 for(const [path,bytes] of Object.entries(files)) await writeFile(join(root,path),bytes);
 await writeFile(join(root,'BUILD_INFO.json'),JSON.stringify({entry:'index.html',mode:'local-practice',version:'0.45.0',commit:'7ace97c',networked:false,ranked:false,hashes}));
 try { await run(root); } finally { await rm(root,{recursive:true,force:true}); }
}
test('browser import verifies every file before preparing a playable artifact',()=>fixture(async root=>{
 const result=await validateBrowserArtifact(root);
 assert.equal(result.files.length,4);
 assert.equal(result.manifest.mode,'local-practice');
 await writeFile(join(root,'game.js'),'changed bytes');
 await assert.rejects(validateBrowserArtifact(root),/digest mismatch/);
}));
test('browser import rejects linked files and missing declared files',()=>fixture(async root=>{
 await symlink(join(root,'game.js'),join(root,'extra.js'));
 await assert.rejects(validateBrowserArtifact(root),/symbolic links/);
 await rm(join(root,'extra.js'));
 await rm(join(root,'game.wasm'));
 await assert.rejects(validateBrowserArtifact(root),/missing file/);
}));
test('a replacement removes only obsolete files from a verified previous game build',()=>fixture(async root=>{
 const parent=await mkdtemp(join(tmpdir(),'omoba-game-import-')),destination=join(parent,'game');
 try {
  await importBrowserArtifact(root,destination);
  const manifest=JSON.parse(await readFile(join(root,'BUILD_INFO.json'),'utf8'));
  const bytes=Buffer.from([0,97,115,109,1,0,0,0]);
  await writeFile(join(root,'game-new.wasm'),bytes);
  await rm(join(root,'game.wasm'));
  delete manifest.hashes['game.wasm'];manifest.hashes['game-new.wasm']=createHash('sha256').update(bytes).digest('hex');
  await writeFile(join(root,'BUILD_INFO.json'),JSON.stringify(manifest));
  await importBrowserArtifact(root,destination);
  assert.ok(!(await validateBrowserArtifact(destination)).files.includes('game.wasm'));
  await writeFile(join(destination,'personal.txt'),'do not remove');
  await assert.rejects(importBrowserArtifact(root,destination),/digest mismatch/);
 } finally { await rm(parent,{recursive:true,force:true}); }
}));
