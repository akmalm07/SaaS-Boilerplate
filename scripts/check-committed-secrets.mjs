import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const secretAssignment = /(api[_-]?key|secret|password)\s*[:=]\s*['"]([^'"]{12,})['"]/gi;
const ignoredFiles = new Set(['package-lock.json']);
const knownTestFixtures = new Set(['not-a-plaintext-password']);

const { stdout } = await execFileAsync('git', ['ls-files']);
const trackedFiles = stdout
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((path) => !ignoredFiles.has(path) && !path.endsWith('.md'));

const findings = [];
for (const path of trackedFiles) {
  const contents = await readFile(path, 'utf8').catch(() => undefined);
  if (!contents) continue;

  for (const match of contents.matchAll(secretAssignment)) {
    if (!knownTestFixtures.has(match[2])) findings.push({ path, field: match[1] });
  }
}

if (findings.length > 0) {
  console.error('Potential credential-like values found in tracked source files:');
  for (const finding of findings) console.error(`- ${finding.path} (${finding.field})`);
  process.exitCode = 1;
}
