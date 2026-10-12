// Shared by tests/vercel-dev.test.mjs and tests/vercel-cli.e2e.mjs: a throwaway
// bare origin with main and dev, and a plain clone of it for scripts/vercel-dev.sh.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const SCRIPT = new URL('../scripts/vercel-dev.sh', import.meta.url).pathname;
export const PROD_ID = 'prj_9pxN1QpGTWA2ZvuSOL13F4AWTrdL'; // omoba-app; only ever a value to refuse
export const SCOPE = 'wotoris-projects-c784733b';

export function sh(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', ...options });
  if (options.check !== false && result.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${result.stderr}`);
  return result;
}

/** A temp root holding origin.git (main + dev) and repo, a clone of it. */
export function devOrigin(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
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
  const devSha = sh('git', ['-C', repo, 'rev-parse', 'origin/dev']).stdout.trim();
  return { root, repo, devSha };
}
