// Real RU Account API + migrated loopback PostgreSQL + production Next.
// Only the publicly known seed[7;32] fixture is used; no live key/host/config.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const apiBin = process.env.OMOBA_DIRECTORY_API_BIN, signerBin = process.env.OMOBA_DIRECTORY_SIGNER_BIN;
assert(apiBin && path.isAbsolute(apiBin) && signerBin && path.isAbsolute(signerBin), 'pass absolute prebuilt API and signer binaries in OMOBA_DIRECTORY_API_BIN/OMOBA_DIRECTORY_SIGNER_BIN');
const database = process.env.OMOBA_TEST_DATABASE_URL;
const db = new URL(database);
assert(['postgres:', 'postgresql:'].includes(db.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(db.hostname) && db.pathname === '/omoba_test' && !db.search && !db.hash, 'migrated loopback omoba_test only');
const out = process.env.OMOBA_DIRECTORY_EVIDENCE_DIR || '.agent/game-directory-http';
await mkdir(out, { recursive: false });
const required = JSON.parse(await readFile('.next/required-server-files.json', 'utf8'));
assert.equal(required.config.env.OMOBA_BUILT_MARKET, 'ru (ekza off, supporter on, vk_sign_in on)', 'build RU portal first');
assert.equal(required.config.env.OMOBA_BUILT_CONTOUR, 'production');
const key = crypto.createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.alloc(32, 7)]), format: 'der', type: 'pkcs8' });
const publicHex = crypto.createPublicKey(key).export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
const publicDir = path.resolve(out, 'published'); await mkdir(publicDir);
const published = path.join(publicDir, 'directory.json');
const privateDir = await mkdtemp(path.join(os.tmpdir(), 'omoba-directory-key-proof-'));
const keyFile = path.join(privateDir, 'fixture.key');
const rawSeed = Buffer.alloc(32, 7).toString('hex');
const checks = [], children = [], logs = [], unexpected = [];
let relay;
const clean = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(OMOBA_|EKZA_|YOOKASSA_|SOLANA_|APPLE_|VERCEL)/.test(name)));
Object.assign(clean, { NO_PROXY: '127.0.0.1,localhost,::1', no_proxy: '127.0.0.1,localhost,::1' });
const command = args => {
  const result = spawnSync(signerBin, args, { encoding: 'utf8', timeout: 5000, maxBuffer: 100000, env: clean });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
  assert(!result.stdout.includes(rawSeed) && !result.stderr.includes(rawSeed), 'fixture seed must not leak');
  return result.stdout;
};
const reserve = async () => { const s = createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const port = s.address().port; await new Promise(r => s.close(r)); return port; };
const start = async (binary, args, env, name) => {
  const log = await open(path.join(out, name + '.log'), 'w'); logs.push(log);
  const child = spawn(binary, args, { env, stdio: ['ignore', log.fd, log.fd] }); children.push(child); await once(child, 'spawn'); return child;
};
const ready = async (url, child) => {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('owned service exited during startup: ' + child.exitCode);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(500) })).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('owned service startup deadline');
};
try {
  await writeFile(keyFile, rawSeed, { mode: 0o600 });
  const wires = [];
  for (const sequence of [4, 5]) {
    const now = Date.now(), input = path.resolve(out, 'input-' + sequence + '.json');
    await writeFile(input, JSON.stringify({ version: 1, region: 'ru', contour: 'production', sequence, issued_at_ms: now, expires_at_ms: now + 300000, policy: { min_release: '0.45.0', maintenance: true, update_url: null, message: 'Публикация ' + sequence }, lobbies: [] }));
    wires.push(command(['sign', input, keyFile, 'fixture', 'ru', 'production', String(now)]));
  }
  await rm(privateDir, { recursive: true });
  await writeFile(published, wires[0]);
  const apiPort = await reserve(), originPort = await reserve();
  const apiOrigin = 'http://127.0.0.1:' + apiPort, origin = 'http://127.0.0.1:' + originPort;
  const api = await start(apiBin, [], { ...clean, OMOBA_DATABASE_URL: database, OMOBA_PORTAL_ORIGIN: 'https://omoba.ru', OMOBA_PORTAL_SECRET: '1'.repeat(64), OMOBA_ACCOUNT_BIND: '127.0.0.1:' + apiPort, OMOBA_GAME_DIRECTORY_FILE: published, OMOBA_GAME_DIRECTORY_KEY_ID: 'fixture', OMOBA_GAME_DIRECTORY_PUBLIC_KEY: publicHex }, 'account');
  await ready(apiOrigin + '/health/ready', api);
  // The spy forwards only the test's public document. It proves Next never
  // sends the browser's account material, while Rust remains the real backend.
  relay = createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' || req.url !== '/v1/game-directory' || req.headers.authorization || req.headers.cookie || req.headers['x-omoba-portal-key']) {
        unexpected.push({ method: req.method, path: req.url, account_header_present: !!(req.headers.authorization || req.headers.cookie || req.headers['x-omoba-portal-key']) });
        res.writeHead(500); res.end('unexpected fixture request'); return;
      }
      const reply = await fetch(apiOrigin + '/v1/game-directory', { signal: AbortSignal.timeout(4000), redirect: 'error' });
      const bytes = Buffer.from(await reply.arrayBuffer());
      res.writeHead(reply.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(bytes);
    } catch { res.writeHead(503); res.end('{}'); }
  });
  await new Promise(r => relay.listen(0, '127.0.0.1', r));
  const next = await start(process.execPath, ['scripts/start.mjs'], { ...clean, PORT: String(originPort), OMOBA_MARKET: 'ru', OMOBA_CONTOUR: 'production', OMOBA_VKID_CLIENT_ID: '12345', OMOBA_ALLOW_INSECURE_LOCAL: '1', OMOBA_PORTAL_ORIGIN: origin, OMOBA_ACCOUNT_API_URL: 'http://127.0.0.1:' + relay.address().port }, 'next');
  await ready(origin + '/api/game/directory', next);
  const get = async (options = {}) => fetch(origin + '/api/game/directory', { redirect: 'error', signal: AbortSignal.timeout(6000), ...options });
  let reply = await get({ headers: { Cookie: 'omoba-session=private-fixture', Authorization: 'Bearer private-fixture', 'X-Forwarded-Host': 'evil.example' } });
  assert.equal(reply.status, 200); assert.equal(await reply.text(), wires[0]);
  assert.equal(reply.headers.get('set-cookie'), null); assert.equal(reply.headers.get('cache-control'), 'no-store');
  checks.push('real Rust publisher to production Next preserves exact signed bytes with no browser account headers or cookies');
  const received = path.resolve(out, 'received.json'); await writeFile(received, wires[0]);
  const verified = JSON.parse(command(['verify', received, publicHex, 'fixture', 'ru', 'production', String(Date.now()), '4']));
  assert.equal(verified.region, 'ru'); assert.equal(verified.policy.maintenance, true); checks.push('native offline verifier accepts the document delivered through the portal and preserves closed admission policy');
  reply = await get({ method: 'HEAD' }); assert.equal(reply.status, 200); assert.equal(await reply.text(), ''); checks.push('anonymous HEAD');
  reply = await get({ method: 'POST' }); assert.equal(reply.status, 405); checks.push('mutation method rejected');
  reply = await fetch(origin + '/api/game/directory?region=global'); assert.equal(reply.status, 400); checks.push('request cannot choose a foreign account region');
  const replacement = path.join(publicDir, 'replacement.json');
  await writeFile(replacement, 'corrupt'); await rename(replacement, published);
  reply = await get(); assert.equal(reply.status, 503); assert.deepEqual(await reply.json(), { code: 'game_directory_unavailable' }); checks.push('corrupted publication unavailable, never reflected or treated as an empty directory');
  await writeFile(replacement, wires[1]); await rename(replacement, published);
  reply = await get(); assert.equal(reply.status, 200); assert.equal(await reply.text(), wires[1]); checks.push('atomic new signed publication visible without restarting API or portal');
  assert.deepEqual(unexpected, []);
  await writeFile(path.join(out, 'report.json'), JSON.stringify({ status: 'PASS', scope: 'RU loopback real Account API/PostgreSQL and production Next, publicly known fixture key; no client routing, live signing key, host or deployment', checks, unexpected_requests: unexpected, private_fixture_removed: true, api_binary_sha256: crypto.createHash('sha256').update(await readFile(apiBin)).digest('hex'), signer_binary_sha256: crypto.createHash('sha256').update(await readFile(signerBin)).digest('hex') }, null, 2) + '\n');
  console.log('PASS signed directory delivery: ' + checks.length + ' checks');
} finally {
  for (const child of children.reverse()) if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await Promise.race([exited, new Promise(r => setTimeout(r, 5000))]); if (child.exitCode === null && child.signalCode === null) { const killed = once(child, 'exit'); child.kill('SIGKILL'); await killed; } }
  if (relay) await new Promise(r => relay.close(r));
  for (const log of logs) await log.close();
  await rm(privateDir, { recursive: true, force: true });
}
