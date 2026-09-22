import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateProject } from '../src/core/generate.js';
import { defaults, type GeneratorConfig } from '../src/core/types.js';
let directory = '';
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function generate(change: Partial<GeneratorConfig> = {}) {
  directory = await mkdtemp(join(tmpdir(), 'saas-generator-'));
  return generateProject({ ...defaults, projectName: 'sample-app', ...change }, directory);
}
describe('generator integration', () => {
  it('generates the working vertical slice with contract, app clients, and selected env only', async () => {
    const path = await generate({ docker: true });
    await expect(stat(join(path, 'frontend/src/api/client.ts'))).resolves.toBeDefined();
    await expect(stat(join(path, 'backend/src/server.ts'))).resolves.toBeDefined();
    expect(await readFile(join(path, 'shared/openapi.yaml'), 'utf8')).toContain('/auth/login');
    const env = await readFile(join(path, '.env.example'), 'utf8');
    expect(env).toContain('DATABASE_URL');
    expect(env).toContain('LOCAL_STORAGE_PATH');
    expect(env).not.toContain('AWS_S3_BUCKET');
    expect(await readFile(join(path, 'compose.yaml'), 'utf8')).toContain('postgres');
  });
  it('generates selected provider skeleton docs and environment placeholders', async () => {
    const path = await generate({ storage: 'aws-s3', email: 'resend' });
    const env = await readFile(join(path, '.env.example'), 'utf8');
    expect(env).toContain('AWS_S3_BUCKET');
    expect(env).toContain('RESEND_API_KEY');
    await expect(
      stat(join(path, 'backend/provider-guides/storage-aws-s3.md')),
    ).resolves.toBeDefined();
    await expect(
      stat(join(path, 'backend/provider-guides/email-resend.md')),
    ).resolves.toBeDefined();
  });
  it('does not overwrite a destination', async () => {
    const path = await generate();
    await expect(
      generateProject({ ...defaults, projectName: 'sample-app' }, directory),
    ).rejects.toThrow('Refusing to overwrite');
    expect(path).toContain('sample-app');
  });
  it('generates Neon pooling metadata and structured backend boundaries', async () => {
    const path = await generate({ database: 'neon' });
    await expect(stat(join(path, 'backend/neon.ts'))).resolves.toBeDefined();
    const repository = await readFile(
      join(path, 'backend/src/repositories/user-repository.ts'),
      'utf8',
    );
    expect(repository).toContain('interface UserRepository');
    expect(repository).toContain('PostgresUserRepository');
  });
  it('keeps generated TypeScript routes compatible with the OpenAPI source of truth', async () => {
    const path = await generate();
    const contract = await readFile(join(path, 'shared/openapi.yaml'), 'utf8');
    const routes = await readFile(join(path, 'backend/src/routes/routes.ts'), 'utf8');
    for (const endpoint of [
      '/health',
      '/auth/register',
      '/auth/login',
      '/auth/logout',
      '/users/me',
      '/files',
    ])
      expect(contract).toContain(endpoint);
    for (const route of [
      '/api/v1/health',
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/auth/logout',
      '/api/v1/users/me',
      '/api/v1/files',
    ])
      expect(routes).toContain(route);
  });
  it('generates minimal Angular and React Native client skeletons', async () => {
    const angular = await generate({ projectName: 'angular-app', frontend: 'angular' });
    await expect(stat(join(angular, 'frontend/src/app/app.component.ts'))).resolves.toBeDefined();
    const native = await generateProject(
      { ...defaults, projectName: 'native-app', frontend: 'react-native' },
      directory,
    );
    await expect(stat(join(native, 'frontend/App.tsx'))).resolves.toBeDefined();
  });
});
