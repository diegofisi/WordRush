// Deploys backend/ and/or frontend/ to Railway with the CLI, from a clean export of
// the last commit. Usage (from the repo root, after `railway login` and `railway link`):
//   node scripts/railway-deploy.mjs backend
//   node scripts/railway-deploy.mjs frontend
//   node scripts/railway-deploy.mjs            # both
//
// Why the export: `railway up` needs the service folder to be the upload root, and on
// Windows the CLI fails with "prefix not found" when given a subfolder of a git repo.
// Exporting the folder with `git archive` to a temp dir sidesteps both problems and
// guarantees that only committed files are uploaded (no node_modules, no .env).
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['backend', 'frontend'];

for (const service of targets) {
  if (!['backend', 'frontend'].includes(service)) throw new Error(`unknown service: ${service}`);
  const work = mkdtempSync(path.join(tmpdir(), `wordrush-${service}-`));
  const dir = path.join(work, service);
  mkdirSync(dir);
  console.log(`\n→ exporting ${service}/ from HEAD to ${dir}`);
  execSync(`git archive --format=tar HEAD:${service} | tar -x -C "${dir}"`, { cwd: root, stdio: 'inherit', shell: true });
  console.log(`→ railway up (${service})`);
  execSync(`railway up --service ${service} --detach`, { cwd: dir, stdio: 'inherit', shell: true });
  rmSync(work, { recursive: true, force: true });
}
console.log('\nDone. Check with: railway service status --service backend --json (and frontend).');
