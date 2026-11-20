#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validBrowserGameManifest } from '../src/lib/browser-game.mjs';

const target = fileURLToPath(new URL('../public/game/',import.meta.url));
const LIMIT = 256 * 1024 * 1024;
export async function validateBrowserArtifact(directory) {
  const root = resolve(directory), files = [];
  let total = 0;
  async function walk(path = '') {
    const stat = await lstat(join(root,path));
    if (stat.isSymbolicLink()) throw new Error('Game artifact cannot contain symbolic links');
    if (stat.isDirectory()) {
      for(const name of await readdir(join(root,path))) await walk(path ? path+'/'+name : name);
    } else {
      if (!stat.isFile() || stat.size > LIMIT || (total+=stat.size)>LIMIT) throw new Error('Game artifact exceeds file budget');
      files.push(path);
    }
  }
  await walk();
  const raw = await readFile(join(root,'BUILD_INFO.json'));
  if (raw.length > 1024*1024) throw new Error('Game build manifest is oversized');
  const manifest = JSON.parse(raw.toString());
  if (!validBrowserGameManifest(manifest) || manifest.networked !== false || manifest.ranked !== false) throw new Error('Expected a local-practice browser artifact');
  const hashes = manifest.sha256 ?? manifest.hashes;
  if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes)) throw new Error('Game artifact hashes are missing');
  for(const file of files.filter(file=>file!=='BUILD_INFO.json')) {
    const bytes = await readFile(join(root,file));
    if (createHash('sha256').update(bytes).digest('hex') !== hashes[file]) throw new Error('Game artifact digest mismatch: '+file);
  }
  if (Object.keys(hashes).some(file=>!files.includes(file))) throw new Error('Game manifest references a missing file');
  if (!files.includes('index.html') || !files.some(file=>file.endsWith('.js')) || !files.some(file=>file.endsWith('.wasm'))) throw new Error('Game entry, JS or WASM is missing');
  for(const file of files.filter(file=>file.endsWith('.wasm'))) {
    const bytes = await readFile(join(root,file));
    if (!bytes.subarray(0,4).equals(Buffer.from([0,97,115,109]))) throw new Error('Invalid WASM file');
  }
  return {root,files,manifest,bytes:total};
}
export async function importBrowserArtifact(directory,destination=target) {
  const artifact=await validateBrowserArtifact(directory);
  let previous=null,exists=true;
  try { await lstat(destination); } catch(error) { if(error.code==='ENOENT')exists=false;else throw error; }
  if(exists)previous=await validateBrowserArtifact(destination);
  // Content first, activation metadata last. Only a previously verified game
  // distribution may be replaced; unrelated files/folders are never removed.
  for(const file of artifact.files.filter(file=>file!=='BUILD_INFO.json').concat('BUILD_INFO.json')) {
    const filePath=join(destination,file);
    await mkdir(dirname(filePath),{recursive:true});
    await writeFile(filePath,await readFile(join(artifact.root,file)));
  }
  for(const file of previous?.files??[])if(!artifact.files.includes(file))await unlink(join(destination,file));
  return artifact;
}
async function main() {
  const args=process.argv.slice(2);
  if(args.length!==1) throw new Error('Usage: node scripts/import-browser-game.mjs /path/to/builds/browser-practice | --check');
  const artifact=args[0]==='--check'?await validateBrowserArtifact(target):await importBrowserArtifact(args[0]);
  console.log(`${args[0]==='--check'?'Verified':'Imported'} OMOBA browser practice ${artifact.manifest.version} (${artifact.manifest.commit.slice(0,7)}), ${artifact.files.length} files, ${(artifact.bytes/1024/1024).toFixed(1)} MiB`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error=>{console.error(error.message);process.exitCode=1;});
