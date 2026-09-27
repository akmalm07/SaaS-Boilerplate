import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { format } from 'prettier';
import type { GeneratorConfig } from './types.js';

const run = promisify(execFile);
const runNpm = (args: string[], cwd: string) =>
  process.platform === 'win32'
    ? run('cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], { cwd })
    : run('npm', args, { cwd });
const prettierExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

/** Format text formats before they are written to the generation transaction. */
export async function formatGeneratedFiles(files: Record<string, string>): Promise<void> {
  for (const [path, source] of Object.entries(files)) {
    const extension = path.slice(path.lastIndexOf('.'));
    if (!prettierExtensions.has(extension)) continue;
    files[path] = await format(source, { filepath: path });
  }
}

/** Run language-native formatters after generated files exist on disk. */
export async function formatGeneratedProject(
  directory: string,
  config: GeneratorConfig,
  files: Record<string, string>,
): Promise<void> {
  if (config.backend === 'typescript') {
    await Promise.all(
      ['backend', 'frontend'].map((folder) =>
        runNpm(
          ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'],
          join(directory, folder),
        ),
      ),
    );
    return;
  }
  if (config.backend !== 'go') return;

  const goFiles = Object.keys(files)
    .filter((path) => path.startsWith('backend/') && path.endsWith('.go'))
    .map((path) => join(directory, path));
  if (goFiles.length) await run('gofmt', ['-w', ...goFiles]);
  // Produce the module checksum file as part of a repeatable Go starter.
  await run('go', ['mod', 'tidy'], { cwd: join(directory, 'backend') });
}
