// scripts/vercel-dev.sh against a fake Vercel CLI and a throwaway git origin. No
// network, no Vercel account: the fake records every call and answers like the
// CLI would for a project that does not exist yet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = new URL('../scripts/vercel-dev.sh', import.meta.url).pathname;
const PROD_ID = 'prj_9pxN1QpGTWA2ZvuSOL13F4AWTrdL';

function sh(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', ...options });
  if (options.check !== false && result.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${result.stderr}`);
  return result;
}

/** A bare origin with main and dev, a plain clone of it, and a fake `vercel`. */
function rig({ linkId = 'prj_dev123', domains = '[]' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vercel-dev-test-'));
  const git = (cwd, ...args) => sh('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args]);
  const seed = join(root, 'seed');
  mkdirSync(seed);
  git(seed, 'init', '-q', '-b', 'main');
  writeFileSync(join(seed, 'package.json'), '{"name":"fixture"}\n');
  git(seed, 'add', '.');
  git(seed, 'commit', '-qm', 'main');
  git(seed, 'checkout', '-qb', 'dev');
  writeFileSync(join(seed, 'DEV'), 'dev\n');
  git(seed, 'add', '.');
  git(seed, 'commit', '-qm', 'dev');
  sh('git', ['clone', '-q', '--bare', seed, join(root, 'origin.git')]);
  const repo = join(root, 'repo');
  sh('git', ['clone', '-q', join(root, 'origin.git'), repo]);
  const log = join(root, 'calls.log');
  const fake = join(root, 'vercel');
  writeFileSync(fake, `#!/usr/bin/env bash
printf '%s\\n' "$*" >> ${JSON.stringify(log)}
case "$1 $2" in
  "project inspect") exit 1;;
  "api /v9/projects/"*) echo '{"domains":${domains}}';;
  "link --yes")
    while [ $# -gt 0 ]; do [ "$1" = --cwd ] && dir=$2; shift; done
    mkdir -p "$dir/.vercel"
    echo '{"projectId":"${linkId}","orgId":"team_x","projectName":"omoba-app-dev"}' > "$dir/.vercel/project.json";;
  "deploy --prod") echo https://omoba-app-dev-abc.vercel.app;;
esac
exit 0
`);
  chmodSync(fake, 0o755);
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: root, VC: fake, REPO: repo, GATE: '0' };
  const calls = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : []);
  return { root, repo, env, calls, cleanup: () => rmSync(root, { recursive: true, force: true }) };
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
      [{ VERCEL_PROJECT_ID: PROD_ID }, /VERCEL_PROJECT_ID is set/],
      [{ VERCEL_ORG_ID: 'team_x' }, /VERCEL_ORG_ID is set/],
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
    assert.match(calls[2], /^project update omoba-app-dev --framework nextjs --node-version 24\.x /);
    const envAdds = calls.filter((c) => c.startsWith('env add '));
    assert.equal(envAdds.length, 12);
    for (const target of ['production', 'preview'])
      for (const kv of ['OMOBA_CONTOUR dev', 'OMOBA_PORTAL_ORIGIN https://app.dev.omoba.io', 'OMOBA_ACCOUNT_MODE disabled',
        'OMOBA_REGISTRY_URL https://registry.dev.ekza.io', 'OMOBA_STUDIO_URL https://studio.dev.ekza.io', 'OMOBA_SITE_URL https://dev.omoba.io']) {
        const [key, value] = kv.split(' ');
        assert.ok(envAdds.includes(`env add ${key} ${target} --value ${value} --no-sensitive --force --yes --project omoba-app-dev --scope wotoris-projects-c784733b`), kv + target);
      }
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

test('deploy links only a fresh export of dev and deploys it to omoba-app-dev', () => {
  const r = rig();
  try {
    const result = run(r.env, '--apply', 'deploy');
    assert.equal(result.status, 0, result.stderr);
    const calls = r.calls();
    assert.equal(calls.length, 2, calls.join('\n'));
    const link = /^link --yes --project omoba-app-dev --scope wotoris-projects-c784733b --cwd (\S+)$/.exec(calls[0]);
    assert.ok(link, calls[0]);
    const work = link[1];
    assert.ok(work.startsWith(r.root) && !work.startsWith(r.repo), work);
    // The export is the dev commit, without repository metadata.
    assert.ok(existsSync(join(work, 'DEV')) && !existsSync(join(work, '.git')));
    const sha = sh('git', ['-C', r.repo, 'rev-parse', 'origin/dev']).stdout.trim();
    assert.equal(calls[1], `deploy --prod --yes --cwd ${work} --scope wotoris-projects-c784733b -m contour=dev -m gitRef=dev -m gitSha=${sha}`);
    assert.ok(!existsSync(join(r.repo, '.vercel')), 'a link landed in the checkout');
  } finally { r.cleanup(); }
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
