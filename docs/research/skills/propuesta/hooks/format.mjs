// PostToolUse hook (Edit|Write): format the file just edited with the Prettier
// that owns it. Package-agnostic: it walks up from the edited file to the repo
// root looking for the nearest package that has both a Prettier config and a
// Prettier binary, so it works in a single package, a monorepo, or neither.
//
// Never blocks: every failure path exits 0, so a formatter problem cannot stop
// work. Formatting rewrites the file, which invalidates Edit anchors — re-read a
// file before editing it again.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.json',
  '.md',
  '.yml',
  '.yaml',
]);

const CONFIG_FILES = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
];

// One quoted command string: .cmd launchers need a shell on Windows and Node
// refuses to spawn them directly; quoting keeps paths with spaces safe.
function run(cmd, args, cwd) {
  const q = (s) => (/[\s"]/.test(String(s)) ? `"${String(s).replace(/"/g, '\\"')}"` : String(s));
  execSync([q(cmd), ...args.map(q)].join(' '), { cwd, stdio: 'ignore', timeout: 20000 });
}

function hasPrettierConfig(dir) {
  if (CONFIG_FILES.some((f) => existsSync(path.join(dir, f)))) return true;
  const pkg = path.join(dir, 'package.json');
  if (!existsSync(pkg)) return false;
  try {
    return 'prettier' in JSON.parse(readFileSync(pkg, 'utf8'));
  } catch {
    return false;
  }
}

function prettierBin(dir) {
  const bin = path.join(
    dir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'prettier.cmd' : 'prettier',
  );
  return existsSync(bin) ? bin : null;
}

// Nearest ancestor of `file` (up to `root`) that both configures Prettier and
// has it installed. Config and binary may live in different packages in a
// workspace, so they are resolved independently.
function resolveTarget(file, root) {
  let dir = path.dirname(file);
  let configDir = null;
  let binDir = null;
  for (;;) {
    if (!configDir && hasPrettierConfig(dir)) configDir = dir;
    if (!binDir && prettierBin(dir)) binDir = dir;
    if (dir === root || path.dirname(dir) === dir) break;
    dir = path.dirname(dir);
  }
  if (!configDir || !binDir) return null;
  return { bin: prettierBin(binDir), cwd: configDir };
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw || '{}');
    const file = input?.tool_input?.file_path;
    if (!file) return;

    const abs = path.resolve(file);
    if (!EXTENSIONS.has(path.extname(abs))) return;

    const root = process.env.CLAUDE_PROJECT_DIR
      ? path.resolve(process.env.CLAUDE_PROJECT_DIR)
      : process.cwd();

    const rel = path.relative(root, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return; // outside the project
    if (rel.split(path.sep).includes('node_modules')) return;

    const target = resolveTarget(abs, root);
    if (!target) return; // no Prettier here: do nothing, silently

    run(target.bin, ['--write', '--log-level', 'silent', abs], target.cwd);
  } catch {
    // intentionally silent
  }
});
