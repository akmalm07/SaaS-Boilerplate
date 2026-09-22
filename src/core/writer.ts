import { mkdir, rename, rm, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function assertAbsent(path: string): Promise<void> {
  try {
    await access(path);
    throw new Error(`Refusing to overwrite existing path: ${path}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function writeTransaction(
  destination: string,
  files: Record<string, string>,
): Promise<void> {
  const staging = `${destination}.creating-${process.pid}-${Date.now()}`;
  await assertAbsent(destination);
  await mkdir(staging, { recursive: true });
  try {
    for (const [relative, contents] of Object.entries(files)) {
      const target = join(staging, relative);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, contents, 'utf8');
    }
    await rename(staging, destination);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
