// scripts/vercel-dev.sh through the REAL pinned Vercel CLI, against a loopback
// fake of the Vercel API. It checks the CLI behaviour the script relies on, so
// rerun it whenever the pin (vercel@63.1.2) moves:
//
//   VERCEL_CLI=/path/to/node_modules/vercel/dist/vc.js npm run test:vercel-cli
//
// (for example the cached `npx --cache /tmp/npm-cache-vercel --yes vercel@63.1.2`
// install under /tmp/npm-cache-vercel/_npx/*/node_modules/vercel/dist/vc.js).
// Nothing leaves this machine: --api sends every CLI request to 127.0.0.1, the
// token is fake, and HOME and --global-config are throwaway directories.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PROD_ID, SCOPE, SCRIPT, devOrigin } from './vercel-rig.mjs';

const CLI = process.env.VERCEL_CLI;
if (!CLI || !existsSync(CLI)) {
  console.error('vercel-cli.e2e: set VERCEL_CLI to the vc.js of vercel@63.1.2 (see the header of this file)');
  process.exit(2);
}
const DEV_ID = 'prj_devE2E1';
const TEAM = 'team_e2e';

/** Loopback fake of the few Vercel API routes `link`, `api` and `deploy` use. */
async function fakeApi() {
  const requests = [];
  const state = { devId: DEV_ID, deployments: new Map() };
  const project = (key) => {
    if (key === PROD_ID || key === 'omoba-app') return { id: PROD_ID, name: 'omoba-app', accountId: TEAM };
    if (key === 'omoba-app-dev' || key === state.devId) return { id: state.devId, name: 'omoba-app-dev', accountId: TEAM };
    return null;
  };
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d)).on('end', () => {
      const url = new URL(req.url, 'http://fake');
      requests.push({ method: req.method, path: url.pathname, query: url.search, body: body ? JSON.parse(body) : null });
      const send = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
      const team = { id: TEAM, slug: SCOPE, name: 'e2e' };
      let m;
      if (url.pathname === '/v2/user') return send(200, { user: { id: 'u_e2e', uid: 'u_e2e', username: 'e2e', email: 'e2e@example.invalid', defaultTeamId: TEAM } });
      if (url.pathname === '/v1/teams' || url.pathname === '/v2/teams') return send(200, { teams: [team], pagination: { count: 1, next: null, prev: null } });
      if (/^\/(v[12]\/)?teams\/[^/]+$/.test(url.pathname)) return send(200, team);
      if ((m = /^\/v9\/projects\/([^/]+)$/.exec(url.pathname))) {
        const p = project(decodeURIComponent(m[1]));
        return p ? send(200, p) : send(404, { error: { code: 'not_found', message: 'Project not found' } });
      }
      if (url.pathname.startsWith('/v3/env/pull/')) return send(200, { env: {} });
      if (req.method === 'POST' && url.pathname === '/v13/deployments') {
        const b = JSON.parse(body);
        const d = { id: `dpl_e2e${state.deployments.size + 1}`, url: `${b.name}-e2e${state.deployments.size + 1}-${SCOPE}.vercel.app`, name: b.name,
          projectId: b.project, ownerId: TEAM, target: b.target, readyState: 'READY', status: 'READY', alias: [], aliasAssigned: true,
          meta: b.meta, createdAt: Date.now(), inspectorUrl: 'https://vercel.com/e2e' };
        state.deployments.set(d.id, d).set(d.url, d);
        return send(200, d);
      }
      if ((m = /^\/v1[03]\/deployments\/([^/]+)$/.exec(url.pathname)) && state.deployments.has(m[1])) return send(200, state.deployments.get(m[1]));
      if (/^\/v3\/now\/deployments\/[^/]+\/events$/.test(url.pathname)) { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(); }
      return send(404, { error: { code: 'not_found', message: `fake API: ${req.method} ${url.pathname}` } });
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { api: `http://127.0.0.1:${server.address().port}`, requests, state, close: () => new Promise((resolve) => server.close(resolve)) };
}

function runAsync(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
    child.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
  });
}

/** The CLI with every request on the fake API and a throwaway login. */
function cli(api, root, extraGlobal = []) {
  const home = join(root, 'home');
  mkdirSync(home, { recursive: true });
  const env = { PATH: process.env.PATH, HOME: home, TMPDIR: root, VERCEL_TELEMETRY_DISABLED: '1', NO_COLOR: '1' };
  const globals = ['--api', api, '--token', 'e2efaketoken0', '--global-config', home, ...extraGlobal];
  return { env, argv: [CLI, ...globals], vc: [process.execPath, CLI, ...globals].join(' ') };
}

const deploysTo = (api) => api.requests.filter((r) => r.method === 'POST' && r.path === '/v13/deployments').map((r) => r.body.project);

test('the pinned CLI lets NOW_* project IDs override the link, and --project override them', async () => {
  const api = await fakeApi();
  const root = mkdtempSync(join(tmpdir(), 'vercel-cli-e2e-'));
  try {
    const { env, argv } = cli(api.api, root);
    const work = join(root, 'work');
    mkdirSync(join(work, '.vercel'), { recursive: true });
    writeFileSync(join(work, 'package.json'), '{"name":"fixture"}\n');
    const linkDev = () => writeFileSync(join(work, '.vercel/project.json'), JSON.stringify({ projectId: DEV_ID, orgId: TEAM, projectName: 'omoba-app-dev' }));
    // Why the script refuses NOW_*: linked to the dev project, a plain deploy goes to production.
    linkDev();
    let r = await runAsync(process.execPath, [...argv, 'deploy', '--prod', '--yes', '--cwd', work, '--scope', SCOPE],
      { ...env, NOW_PROJECT_ID: PROD_ID, NOW_ORG_ID: TEAM });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(deploysTo(api), [PROD_ID], 'the CLI no longer follows NOW_* IDs: recheck the guard rationale in scripts/vercel-dev.sh');
    // ... and `link --project omoba-app-dev` links production instead of the named project.
    rmSync(join(work, '.vercel'), { recursive: true, force: true });
    r = await runAsync(process.execPath, [...argv, 'link', '--yes', '--project', 'omoba-app-dev', '--scope', SCOPE, '--cwd', work],
      { ...env, NOW_PROJECT_ID: PROD_ID, NOW_ORG_ID: TEAM });
    assert.match(r.stderr, /Linked\s+\S*\/omoba-app\b(?!-dev)/, r.stderr);
    assert.ok(api.requests.some((q) => q.path.startsWith(`/v3/env/pull/${PROD_ID}/`)), 'link under NOW_* did not read the production project');
    // An explicit --project wins over both spellings.
    for (const ids of [{ NOW_PROJECT_ID: PROD_ID, NOW_ORG_ID: TEAM }, { VERCEL_PROJECT_ID: PROD_ID, VERCEL_ORG_ID: TEAM }]) {
      api.requests.length = 0;
      mkdirSync(join(work, '.vercel'), { recursive: true });
      linkDev();
      r = await runAsync(process.execPath, [...argv, 'deploy', '--prod', '--yes', '--project', 'omoba-app-dev', '--cwd', work, '--scope', SCOPE], { ...env, ...ids });
      assert.equal(r.status, 0, r.stderr);
      assert.deepEqual(deploysTo(api), [DEV_ID], JSON.stringify(ids));
    }
  } finally {
    await api.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('vercel-dev.sh deploys only to omoba-app-dev through the real CLI, URL or JSON output', async () => {
  for (const extraGlobal of [[], ['--non-interactive']]) {
    const api = await fakeApi();
    const rig = devOrigin('vercel-cli-e2e-');
    try {
      const { env, vc } = cli(api.api, rig.root, extraGlobal);
      const r = await runAsync('bash', [SCRIPT, '--apply', 'deploy'], { ...env, VC: vc, REPO: rig.repo, GATE: '0' });
      const label = extraGlobal.join(' ') || 'default output';
      assert.equal(r.status, 0, label + r.stderr);
      assert.deepEqual(deploysTo(api), [DEV_ID], label);
      const post = api.requests.find((q) => q.method === 'POST' && q.path === '/v13/deployments');
      assert.equal(post.body.target, 'production');
      assert.deepEqual(post.body.meta, { contour: 'dev', gitRef: 'dev', gitSha: rig.devSha });
      assert.ok(api.requests.some((q) => q.method === 'GET' && /^\/v13\/deployments\/(dpl_e2e1|omoba-app-dev-e2e1-)/.test(q.path)), label + ': no post-deploy check');
      assert.match(r.stdout, new RegExp(`deployment dpl_e2e1 belongs to omoba-app-dev \\(${DEV_ID}\\)`), label);
      assert.ok(!api.requests.some((q) => (q.path + q.query).includes(PROD_ID) || q.path.endsWith('/omoba-app')), label + ': the production project was requested');
      assert.ok(!existsSync(join(rig.repo, '.vercel')), 'a link landed in the checkout');
    } finally {
      await api.close();
      rmSync(rig.root, { recursive: true, force: true });
    }
  }
});

test('vercel-dev.sh stops before the CLI runs under NOW_*, and before linking when the API answers production', async () => {
  const api = await fakeApi();
  const rig = devOrigin('vercel-cli-e2e-');
  try {
    const { env, vc } = cli(api.api, rig.root);
    const base = { ...env, VC: vc, REPO: rig.repo, GATE: '0' };
    let r = await runAsync('bash', [SCRIPT, '--apply', 'deploy'], { ...base, NOW_PROJECT_ID: PROD_ID, NOW_ORG_ID: TEAM });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /REFUSED: NOW_PROJECT_ID is set/);
    assert.deepEqual(api.requests, [], 'the CLI ran despite NOW_*');
    // A Vercel project named omoba-app-dev whose id is production's: refuse, link nothing.
    api.state.devId = PROD_ID;
    r = await runAsync('bash', [SCRIPT, '--apply', 'deploy'], base);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /resolves to the PRODUCTION project id[\s\S]*nothing was deployed/);
    assert.deepEqual(deploysTo(api), []);
    assert.ok(!api.requests.some((q) => q.path.startsWith('/v3/env/pull/')), 'linked after a production answer');
    assert.ok(!existsSync(join(rig.repo, '.vercel')), 'a link landed in the checkout');
  } finally {
    await api.close();
    rmSync(rig.root, { recursive: true, force: true });
  }
});
