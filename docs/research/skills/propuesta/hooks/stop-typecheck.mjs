// Stop hook: one batched `tsc --noEmit` at the end of the response, instead of
// one per edited file.
//
// Finds the .ts/.tsx files that differ from HEAD (git working tree + index),
// groups them by the nearest tsconfig that covers them, and runs one typecheck
// per group, newest group first, inside a total time budget.
//
// REPORT ONLY. It always exits 0 and never emits `decision: "block"`, so it can
// neither stop the response nor start a loop. The root `verify` script remains
// the real gate; this is an early warning between verifications.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const TOTAL_BUDGET_MS = 150_000; // stay under the hook timeout in settings.json
const MAX_GROUPS = 4;

function finish(message) {
  // systemMessage surfaces a warning to the user without blocking the response.
  if (message) process.stdout.write(JSON.stringify({ systemMessage: message }));
  process.exit(0);
}

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 10_000 });
  } catch {
    return '';
  }
}

// Changed TypeScript files, staged and unstaged, relative to the repo root.
function changedTsFiles(root) {
  const out = [
    ...git(['diff', '--name-only', '--diff-filter=ACMR'], root).split('\n'),
    ...git(['diff', '--name-only', '--cached', '--diff-filter=ACMR'], root).split('\n'),
    ...git(['ls-files', '--others', '--exclude-standard'], root).split('\n'),
  ];
  return [...new Set(out.map((l) => l.trim()).filter(Boolean))]
    .filter((f) => /\.(ts|tsx|mts|cts)$/.test(f))
    .map((f) => path.resolve(root, f))
    .filter((f) => existsSync(f) && !f.split(path.sep).includes('node_modules'));
}

// Nearest ancestor tsconfig, preferring the one a build would actually use.
function nearestTsconfig(file, root) {
  let dir = path.dirname(file);
  for (;;) {
    for (const name of ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.build.json']) {
      const candidate = path.join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    if (dir === root || path.dirname(dir) === dir) return null;
    dir = path.dirname(dir);
  }
}

function tscBin(dir, root) {
  let current = dir;
  for (;;) {
    const bin = path.join(
      current,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
    );
    if (existsSync(bin)) return bin;
    if (current === root || path.dirname(current) === current) return null;
    current = path.dirname(current);
  }
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw || '{}');
    if (input?.stop_hook_active) finish(); // already running from a previous Stop

    const root = process.env.CLAUDE_PROJECT_DIR
      ? path.resolve(process.env.CLAUDE_PROJECT_DIR)
      : process.cwd();
    if (!existsSync(path.join(root, '.git'))) finish();

    const files = changedTsFiles(root);
    if (files.length === 0) finish();

    const groups = new Map();
    for (const file of files) {
      const config = nearestTsconfig(file, root);
      if (!config) continue;
      if (!groups.has(config)) groups.set(config, []);
      groups.get(config).push(file);
    }
    if (groups.size === 0) finish();

    // Newest edit first, so the group most likely to be broken is checked even
    // if the budget runs out.
    const ordered = [...groups.entries()]
      .map(([config, list]) => ({
        config,
        mtime: Math.max(...list.map((f) => statSync(f).mtimeMs)),
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, MAX_GROUPS);

    const perGroupMs = Math.floor(TOTAL_BUDGET_MS / ordered.length);
    const report = [];

    for (const { config } of ordered) {
      const dir = path.dirname(config);
      const bin = tscBin(dir, root);
      if (!bin) continue;
      // .cmd launchers need a shell on Windows; quote so paths with spaces or
      // parentheses are not re-split by cmd.exe.
      const useShell = process.platform === 'win32';
      const q = (s) => (useShell ? `"${s}"` : s);
      const result = spawnSync(q(bin), ['--noEmit', '-p', q(config)], {
        cwd: dir,
        encoding: 'utf8',
        timeout: perGroupMs,
        shell: useShell,
        windowsHide: true,
      });
      if (result.error || result.status === null) continue; // timeout or spawn failure: stay quiet
      if (result.status !== 0) {
        const lines = `${result.stdout || ''}${result.stderr || ''}`
          .split('\n')
          .filter((l) => /error TS\d+/.test(l));
        const label = path.relative(root, config) || config;
        report.push(`${label}: ${lines.length} type error(s)`);
        report.push(...lines.slice(0, 5).map((l) => `  ${l.trim()}`));
        if (lines.length > 5) report.push(`  ... ${lines.length - 5} more`);
      }
    }

    if (report.length === 0) finish();
    finish(`tsc --noEmit (changed files)\n${report.join('\n')}`);
  } catch {
    process.exit(0); // never block
  }
});
