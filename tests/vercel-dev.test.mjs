// scripts/vercel-dev.sh against a fake Vercel CLI and a throwaway git origin. No
// network, no Vercel account: the fake records every call and answers like the
// CLI would for a project that does not exist yet. tests/vercel-cli.e2e.mjs runs
// the same script through the real pinned CLI against a loopback fake API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { PROD_ID, SCRIPT, devOrigin, sh } from './vercel-rig.mjs';

const DEV_ID = 'prj_dev123';
const DEPLOY_URL = 'https://omoba-app-dev-abc.vercel.app';

/**
 * A bare origin with main and dev, a plain clone of it, and a fake `vercel`.
 * linkId: what `link` writes; apiProject: GET /v9/projects/<name>;
 * deployOut: stdout of `deploy`; deployedProjectId: GET /v13/deployments/<x>.
 */
function rig({
  linkId = DEV_ID, domains = '[]',
  apiProject = `{"id":"${DEV_ID}","name":"omoba-app-dev","accountId":"team_x"}`,
  deployOut = DEPLOY_URL, deployedProjectId = DEV_ID,
} = {}) {
  const { root, repo } = devOrigin('vercel-dev-test-');
  const log = join(root, 'calls.log');
  const leaks = join(root, 'leaked-env.log');
  const stdins = join(root, 'env-stdin.log');
  const fake = join(root, 'vercel');
  writeFileSync(fake, `#!/usr/bin/env bash
printf '%s\\n' "$*" >> ${JSON.stringify(log)}
# Project overrides must never reach the CLI, not even empty ones.
env | grep -E '^(VERCEL|NOW)_(PROJECT|ORG)_ID=' >> ${JSON.stringify(leaks)}
case "$1 $2" in
  "project inspect") exit 1;;
  # Like the real CLI: a non-TTY stdin is read as the value, even with --value.
  "env add") value=$(cat); printf '%s %s %s\\n' "$3" "$4" "$value" >> ${JSON.stringify(stdins)}; [ "$3" = OMOBA_ACCOUNT_INGRESS_KEY ] && printf '%s\\n' "$value";;
  "api /v9/projects/"*/domains) echo '{"domains":${domains}}';;
  "api /v9/projects/"*/env) echo '{"envs":[]}';;
  "api /v9/projects/"*) echo '${apiProject}';;
  "api /v13/deployments/"*) echo '{"id":"dpl_test1","projectId":"${deployedProjectId}"}';;
  "link --yes")
    while [ $# -gt 0 ]; do [ "$1" = --cwd ] && dir=$2; shift; done
    mkdir -p "$dir/.vercel"
    echo '{"projectId":"${linkId}","orgId":"team_x","projectName":"omoba-app-dev"}' > "$dir/.vercel/project.json";;
  "deploy --prod") echo '${deployOut}';;
esac
exit 0
`);
  chmodSync(fake, 0o755);
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: root, VC: fake, REPO: repo, GATE: '0' };
  const calls = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : []);
  const leaked = () => (existsSync(leaks) ? readFileSync(leaks, 'utf8').trim() : '');
  const envStdin = () => (existsSync(stdins) ? readFileSync(stdins, 'utf8').trim().split('\n').filter(Boolean) : []);
  return { root, repo, env, calls, leaked, envStdin, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const run = (env, ...args) => spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', env });

test('vercel-dev.sh parses and a dry run calls nothing', () => {
  sh('bash', ['-n', SCRIPT]);
  const r = rig();
  try {
    for (const args of [['plan'], ['setup'], ['deploy'], ['check'], ['--dry-run', 'setup'], ['plan', '--apply']]) {
      const result = run(r.env, ...args);
      assert.equal(result.status, 0, args.join(' ') + result.stderr);
      assert.match(result.stdout, /dry run: nothing is executed/, args.join(' '));
      assert.deepEqual(r.calls(), [], args.join(' '));
    }
    const plan = run(r.env, 'plan').stdout;
    for (const line of plan.split('\n').filter((l) => l.includes(' project ') || l.includes(' env add ') || l.includes(' domains ') || l.includes(' link ') || l.includes(' deploy ')))
      assert.match(line, /omoba-app-dev|<fresh mktemp -d>/, line);
    assert.doesNotMatch(plan, /omoba-app(?!-dev)/);
    assert.ok(!existsSync(join(r.repo, '.vercel')));
  } finally { r.cleanup(); }
});

test('vercel-dev.sh refuses production identifiers, a non-dev ref and CLI overrides', () => {
  const r = rig();
  try {
    for (const [extra, pattern] of [
      [{ DEV_PROJECT: 'omoba-app' }, /omoba-app is a production project/],
      [{ DEV_PROJECT: 'landing-v2-omoba' }, /production project/],
      [{ DEV_PROJECT: 'landing-v2-ekza' }, /production project/],
      [{ DEV_PROJECT: 'omoba-app-staging' }, /must end in -dev/],
      [{ DEV_REF: 'origin/main' }, /dev branch only/],
      [{ DEV_REF: 'main' }, /dev branch only/],
      [{ DEV_ACCOUNT_MODE: 'bad' }, /DEV_ACCOUNT_MODE must be/],
      [{ VERCEL_PROJECT_ID: PROD_ID }, /VERCEL_PROJECT_ID is set/],
      [{ VERCEL_ORG_ID: 'team_x' }, /VERCEL_ORG_ID is set/],
      // The CLI falls back to the legacy NOW_* names (@vercel/build-utils getPlatformEnv).
      [{ NOW_PROJECT_ID: PROD_ID }, /NOW_PROJECT_ID is set/],
      [{ NOW_ORG_ID: 'team_x' }, /NOW_ORG_ID is set/],
      [{ NOW_PROJECT_ID: PROD_ID, NOW_ORG_ID: 'team_x' }, /NOW_PROJECT_ID is set/],
      [{ VERCEL_SCOPE: 'vds-eternal' }, /production identifier/],
      [{ VC: 'ssh 77.246.105.57 vercel' }, /production identifier/],
      [{ REPO: '/tmp/snrjxwutqxokeujuiepn' }, /production identifier/],
    ]) {
      for (const mode of [[], ['--apply']]) {
        const result = run({ ...r.env, ...extra }, ...mode, 'setup');
        assert.equal(result.status, 2, JSON.stringify(extra) + mode);
        assert.match(result.stderr, pattern, JSON.stringify(extra));
      }
    }
    assert.deepEqual(r.calls(), []);
  } finally { r.cleanup(); }
});

test('setup writes only to omoba-app-dev and never moves a domain', () => {
  const r = rig();
  try {
    const result = run(r.env, '--apply', 'setup');
    assert.equal(result.status, 0, result.stderr);
    const calls = r.calls();
    assert.equal(calls[0], 'project inspect omoba-app-dev --scope wotoris-projects-c784733b');
    assert.equal(calls[1], 'project create omoba-app-dev --scope wotoris-projects-c784733b');
    assert.match(calls[2], /^project update omoba-app-dev --framework nextjs --node-version 24\.x .* --yes --scope wotoris-projects-c784733b$/);
    const envAdds = calls.filter((c) => c.startsWith('env add '));
    assert.equal(envAdds.length, 12);
    for (const target of ['production', 'preview'])
      for (const kv of ['OMOBA_CONTOUR dev', 'OMOBA_PORTAL_ORIGIN https://app.dev.omoba.io', 'OMOBA_ACCOUNT_MODE disabled',
        'OMOBA_REGISTRY_URL https://registry.dev.ekza.io', 'OMOBA_STUDIO_URL https://hub.dev.ekza.io', 'OMOBA_SITE_URL https://dev.omoba.io']) {
        const [key, value] = kv.split(' ');
        assert.ok(envAdds.includes(`env add ${key} ${target} --value ${value} --no-sensitive --force --yes --project omoba-app-dev --scope wotoris-projects-c784733b`), kv + target);
        // What the CLI reads on stdin is exactly the value, never the rest of the list.
        assert.ok(r.envStdin().includes(`${key} ${target} ${value}`), 'stdin of ' + kv + target);
      }
    assert.equal(r.envStdin().length, 12);
    assert.ok(!calls.some((c) => /OMOBA_ALLOW_INSECURE_LOCAL|OMOBA_TRUST_LOOPBACK_PROXY|OMOBA_ACCOUNT_API_URL/.test(c)));
    assert.ok(calls.includes('api /v9/projects/omoba-app-dev/domains -X GET --scope wotoris-projects-c784733b'));
    assert.equal(calls.at(-1), 'domains add app.dev.omoba.io omoba-app-dev --scope wotoris-projects-c784733b');
    for (const call of calls) {
      // --force on `domains add` would move the domain away from another project.
      if (call.startsWith('domains')) assert.doesNotMatch(call, /--force/, call);
      assert.doesNotMatch(call, /\bomoba-app\b(?!-dev)/, call);
    }
  } finally { r.cleanup(); }
  // Idempotent: a second run against a project that has the domain adds nothing.
  const again = rig({ domains: '[{"name":"app.dev.omoba.io"}]' });
  try {
    const result = run(again.env, '--apply', 'setup');
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!again.calls().some((c) => c.startsWith('domains add')));
    assert.match(result.stdout, /already on omoba-app-dev/);
  } finally { again.cleanup(); }
});

test('deploy resolves the dev project, links only a fresh export of dev and confirms the deployment', () => {
  const r = rig();
  try {
    const result = run(r.env, '--apply', 'deploy');
    assert.equal(result.status, 0, result.stderr);
    const calls = r.calls();
    assert.equal(calls.length, 4, calls.join('\n'));
    assert.equal(calls[0], 'api /v9/projects/omoba-app-dev -X GET --scope wotoris-projects-c784733b');
    const link = /^link --yes --project omoba-app-dev --scope wotoris-projects-c784733b --cwd (\S+)$/.exec(calls[1]);
    assert.ok(link, calls[1]);
    const work = link[1];
    assert.ok(work.startsWith(r.root) && !work.startsWith(r.repo), work);
    // The export is the dev commit, without repository metadata.
    assert.ok(existsSync(join(work, 'DEV')) && !existsSync(join(work, '.git')));
    const sha = sh('git', ['-C', r.repo, 'rev-parse', 'origin/dev']).stdout.trim();
    // --project: an explicit project wins over VERCEL_*/NOW_* IDs in the CLI.
    assert.equal(calls[2], `deploy --prod --yes --project omoba-app-dev --cwd ${work} --scope wotoris-projects-c784733b -m contour=dev -m gitRef=dev -m gitSha=${sha}`);
    assert.equal(calls[3], 'api /v13/deployments/omoba-app-dev-abc.vercel.app -X GET --scope wotoris-projects-c784733b');
    assert.match(result.stdout, /omoba-app-dev is prj_dev123 in team_x/);
    assert.match(result.stdout, /deployment dpl_test1 belongs to omoba-app-dev \(prj_dev123\)/);
    assert.ok(!existsSync(join(r.repo, '.vercel')), 'a link landed in the checkout');
    assert.equal(r.leaked(), '');
  } finally { r.cleanup(); }
  // Non-interactive CLIs (agents, --non-interactive) print JSON instead of the URL.
  for (const deployOut of [
    `{"status":"ok","deployment":{"id":"dpl_test1","url":"${DEPLOY_URL}"}}`,
    `{"id":"dpl_test1","url":"${DEPLOY_URL}","readyState":"READY"}`,
  ]) {
    const json = rig({ deployOut });
    try {
      const result = run(json.env, '--apply', 'deploy');
      assert.equal(result.status, 0, result.stderr);
      assert.equal(json.calls().at(-1), 'api /v13/deployments/dpl_test1 -X GET --scope wotoris-projects-c784733b');
    } finally { json.cleanup(); }
  }
});

test('NOW_* project IDs are refused like VERCEL_* (the reported bypass), empty ones are dropped', () => {
  const r = rig();
  try {
    for (const args of [['plan'], ['--apply', 'deploy'], ['--apply', 'check']]) {
      const result = run({ ...r.env, NOW_PROJECT_ID: PROD_ID, NOW_ORG_ID: 'team_x' }, ...args);
      assert.equal(result.status, 2, args.join(' '));
      assert.match(result.stderr, /REFUSED: NOW_PROJECT_ID is set in the environment/, args.join(' '));
    }
    assert.deepEqual(r.calls(), []);
    // Empty values do not select a project; the script unsets them before any CLI call.
    const empty = { VERCEL_PROJECT_ID: '', VERCEL_ORG_ID: '', NOW_PROJECT_ID: '', NOW_ORG_ID: '' };
    const result = run({ ...r.env, ...empty }, '--apply', 'deploy');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(r.calls().length, 4);
    assert.equal(r.leaked(), '', 'a project override reached the CLI');
  } finally { r.cleanup(); }
});

test('deploy refuses when the API, the link or the deployment is not the dev project', () => {
  for (const [options, pattern, deployed] of [
    [{ apiProject: `{"id":"${PROD_ID}","name":"omoba-app-dev"}` }, /resolves to the PRODUCTION project id/, false],
    [{ apiProject: `{"id":"prj_other","name":"omoba-app"}` }, /names project prj_other "omoba-app", not omoba-app-dev/, false],
    [{ apiProject: '{"error":{"code":"not_found"}}' }, /has no project id/, false],
    [{ apiProject: 'not json' }, /not JSON/, false],
    [{ linkId: 'prj_other' }, /linked to prj_other, not omoba-app-dev \(prj_dev123\)/, false],
    [{ deployedProjectId: PROD_ID }, /deployment omoba-app-dev-abc\.vercel\.app is NOT on omoba-app-dev[\s\S]*Instant Rollback/, true],
    [{ deployOut: 'Error: something went sideways' }, /cannot tell which deployment the CLI made/, true],
    [{ deployOut: 'Error: see https://vercel.link/project-not-found' }, /cannot tell which deployment the CLI made/, true],
  ]) {
    const r = rig(options);
    const label = JSON.stringify(options);
    try {
      const result = run(r.env, '--apply', 'deploy');
      assert.equal(result.status, 2, label + result.stderr);
      assert.match(result.stderr, pattern, label);
      const calls = r.calls();
      assert.equal(calls.some((c) => c.startsWith('deploy')), deployed, label + calls.join('\n'));
      // A wrong API answer stops before the export is even linked.
      if (options.apiProject) assert.ok(!calls.some((c) => c.startsWith('link')), label);
      if (!deployed) assert.match(result.stderr, /nothing was deployed/, label);
    } finally { r.cleanup(); }
  }
});

test('deploy refuses a checkout link and an export linked to production', () => {
  const linked = rig();
  try {
    mkdirSync(join(linked.repo, '.vercel'));
    const result = run(linked.env, '--apply', 'deploy');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /\.vercel exists: a Vercel link in the checkout/);
    assert.deepEqual(linked.calls(), []);
  } finally { linked.cleanup(); }
  const prod = rig({ linkId: PROD_ID });
  try {
    const result = run(prod.env, '--apply', 'deploy');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /linked to the PRODUCTION project omoba-app/);
    assert.match(result.stderr, /not linked to omoba-app-dev; nothing was deployed/);
    assert.ok(!prod.calls().some((c) => c.startsWith('deploy')), 'deployed after a production link');
  } finally { prod.cleanup(); }
});

test('enabled account setup pins dev API and sends the ingress key only through secret stdin', () => {
  const r = rig(), key = 'b'.repeat(64), keyFile = join(r.root, 'ingress.key');
  try {
    writeFileSync(keyFile, key + '\n', { mode: 0o600 });
    const env = { ...r.env, DEV_ACCOUNT_MODE: 'enabled', DEV_ACCOUNT_INGRESS_KEY_FILE: keyFile };
    const result = run(env, '--apply', 'setup');
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!result.stdout.includes(key) && !result.stderr.includes(key));
    assert.ok(r.calls().every(call => !call.includes(key)));
    for (const target of ['production', 'preview']) {
      assert.ok(r.calls().includes(`env add OMOBA_ACCOUNT_INGRESS_KEY ${target} --sensitive --force --yes --project omoba-app-dev --scope wotoris-projects-c784733b`));
      assert.ok(r.envStdin().includes(`OMOBA_ACCOUNT_INGRESS_KEY ${target} ${key}`));
      assert.ok(r.envStdin().includes(`OMOBA_ACCOUNT_API_URL ${target} https://account.dev.omoba.io`));
      assert.ok(r.envStdin().includes(`OMOBA_ACCOUNT_MODE ${target} enabled`));
    }
  } finally { r.cleanup(); }
});

test('enabled account setup refuses missing or readable ingress files before touching Vercel', () => {
  for (const kind of ['missing', 'public', 'invalid']) {
    const r = rig(), keyFile = join(r.root, 'ingress.key');
    try {
      if (kind !== 'missing') writeFileSync(keyFile, kind === 'invalid' ? 'invalid' : 'b'.repeat(64), { mode: kind === 'public' ? 0o644 : 0o600 });
      const result = run({ ...r.env, DEV_ACCOUNT_MODE: 'enabled', DEV_ACCOUNT_INGRESS_KEY_FILE: keyFile }, '--apply', 'setup');
      assert.equal(result.status, 2);
      assert.deepEqual(r.calls(), []);
    } finally { r.cleanup(); }
  }
});
