import type { GeneratorConfig, TemplateContribution } from '../core/types.js';
import { json } from '../core/serialize.js';

function backendPackage(config: GeneratorConfig): string {
  return json({
    name: `${config.projectName}-backend`,
    private: true,
    type: 'module',
    scripts: {
      dev: 'tsx watch src/server.ts',
      start: 'tsx src/server.ts',
      build: 'tsc --noEmit',
      test: 'vitest run',
    },
    dependencies: {
      '@fastify/cookie': '^11.0.0',
      '@fastify/cors': '^11.0.0',
      '@fastify/helmet': '^13.0.0',
      '@fastify/jwt': '^9.0.0',
      '@fastify/rate-limit': '^10.0.0',
      bcryptjs: '^2.4.3',
      dotenv: '^16.5.0',
      fastify: '^5.3.0',
      pg: '^8.16.0',
    },
    devDependencies: {
      '@types/bcryptjs': '^2.4.6',
      '@types/node': '^24.0.0',
      '@types/pg': '^8.15.4',
      tsx: '^4.20.0',
      typescript: '^5.8.0',
      vitest: '^3.2.0',
    },
  });
}

const configSource = `import 'dotenv/config';
const required = ['DATABASE_URL', 'SESSION_SECRET', 'JWT_ISSUER', 'JWT_AUDIENCE', 'SMTP_HOST', 'EMAIL_FROM'] as const;
for (const key of required) if (!process.env[key]) throw new Error('Missing required environment variable: ' + key);
export const settings = { databaseUrl: process.env.DATABASE_URL!, sessionSecret: process.env.SESSION_SECRET!, jwtIssuer: process.env.JWT_ISSUER!, jwtAudience: process.env.JWT_AUDIENCE!, frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173', storagePath: process.env.LOCAL_STORAGE_PATH ?? './uploads', port: Number(process.env.PORT ?? 3000), production: process.env.NODE_ENV === 'production' };
`;

const domain = `export type Role = 'owner' | 'admin' | 'member';
export type User = { id: string; email: string; name: string; passwordHash: string };
export type PublicUser = Pick<User, 'id' | 'email' | 'name'>;
export type StoredFile = { id: string; userId: string; name: string; size: number; createdAt: string; path: string };
`;

const repositories = `import { Pool } from 'pg';
import type { StoredFile, User } from '../domain/models.js';
export interface UserRepository { findById(id: string): Promise<User | undefined>; findByEmail(email: string): Promise<User | undefined>; create(user: User): Promise<void>; delete(id: string): Promise<void>; }
export interface FileRepository { list(userId: string): Promise<StoredFile[]>; create(file: StoredFile): Promise<void>; }
export class PostgresUserRepository implements UserRepository { constructor(private readonly pool: Pool) {} private map(row: Record<string, string>): User { return { id: row.id, email: row.email, name: row.name, passwordHash: row.password_hash }; } async findById(id: string) { const r = await this.pool.query('SELECT id,email,name,password_hash FROM users WHERE id=$1', [id]); return r.rows[0] ? this.map(r.rows[0]) : undefined; } async findByEmail(email: string) { const r = await this.pool.query('SELECT id,email,name,password_hash FROM users WHERE email=$1', [email]); return r.rows[0] ? this.map(r.rows[0]) : undefined; } async create(user: User) { await this.pool.query('INSERT INTO users (id,email,name,password_hash) VALUES ($1,$2,$3,$4)', [user.id, user.email, user.name, user.passwordHash]); } async delete(id: string) { await this.pool.query('DELETE FROM users WHERE id=$1', [id]); } }
export class PostgresFileRepository implements FileRepository { constructor(private readonly pool: Pool) {} async list(userId: string) { const r = await this.pool.query('SELECT id,user_id,name,size,created_at,path FROM files WHERE user_id=$1 ORDER BY created_at DESC', [userId]); return r.rows.map(row => ({ id: row.id, userId: row.user_id, name: row.name, size: Number(row.size), createdAt: new Date(row.created_at).toISOString(), path: row.path })); } async create(file: StoredFile) { await this.pool.query('INSERT INTO files (id,user_id,name,size,created_at,path) VALUES ($1,$2,$3,$4,$5,$6)', [file.id,file.userId,file.name,file.size,file.createdAt,file.path]); } }
`;

const storage = `import { mkdir, writeFile } from 'node:fs/promises'; import { basename, join } from 'node:path';
export interface Storage { put(userId: string, fileId: string, name: string, content: Buffer): Promise<string>; }
export class LocalStorage implements Storage { constructor(private readonly root: string) {} async put(userId: string, fileId: string, name: string, content: Buffer) { const folder = join(this.root, userId); await mkdir(folder, { recursive: true }); const path = join(folder, fileId + '-' + basename(name)); await writeFile(path, content, { flag: 'wx' }); return path; } }
`;

const authService = `import { randomUUID } from 'node:crypto'; import bcrypt from 'bcryptjs'; import type { PublicUser, User } from '../domain/models.js'; import type { UserRepository } from '../repositories/user-repository.js';
export class AppError extends Error { constructor(public readonly status: number, public readonly code: string, message: string) { super(message); } }
export class AuthService { constructor(private readonly users: UserRepository) {} async register(input: { email?: string; password?: string; name?: string }): Promise<PublicUser> { const email = input.email?.trim().toLowerCase() ?? ''; if (!/^\\S+@\\S+\\.\\S+$/.test(email) || !input.password || input.password.length < 12) throw new AppError(400, 'VALIDATION_ERROR', 'A valid email and a 12-character password are required.'); if (await this.users.findByEmail(email)) throw new AppError(409, 'EMAIL_TAKEN', 'Email already registered.'); const user: User = { id: randomUUID(), email, name: input.name?.trim() ?? '', passwordHash: await bcrypt.hash(input.password, 12) }; await this.users.create(user); return { id: user.id, email: user.email, name: user.name }; } async login(input: { email?: string; password?: string }): Promise<PublicUser> { const user = await this.users.findByEmail(input.email?.trim().toLowerCase() ?? ''); if (!user || !input.password || !await bcrypt.compare(input.password, user.passwordHash)) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials.'); return { id: user.id, email: user.email, name: user.name }; } async current(id: string) { const user = await this.users.findById(id); if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.'); return { id: user.id, email: user.email, name: user.name }; } async delete(id: string) { await this.users.delete(id); } }
`;

const authMiddleware = `import type { FastifyReply, FastifyRequest } from 'fastify'; import { AppError } from '../services/auth-service.js';
export const subject = (request: FastifyRequest) => (request.user as { sub?: string }).sub!;
export async function requireUser(request: FastifyRequest, _reply: FastifyReply) { try { await request.jwtVerify(); if (!subject(request)) throw new Error('missing subject'); } catch { throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.'); } }
`;

const routes = `import type { FastifyInstance } from 'fastify'; import { randomUUID } from 'node:crypto'; import type { FileRepository } from '../repositories/user-repository.js'; import type { Storage } from '../providers/storage.js'; import type { AuthService } from '../services/auth-service.js'; import { requireUser, subject } from '../middleware/auth.js'; import { AppError } from '../services/auth-service.js';
const session = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' };
function issue(app: FastifyInstance, reply: any, id: string) { const token = (app.jwt as any).sign({ sub: id }, { expiresIn: '24h' }); reply.setCookie('session', token, { ...session, maxAge: 86400 }); }
export function registerRoutes(app: FastifyInstance, auth: AuthService, files: FileRepository, storage: Storage) { app.get('/api/v1/health', async () => ({ status: 'ok' })); app.post('/api/v1/auth/register', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => { const user = await auth.register(request.body as any); issue(app, reply, user.id); return reply.code(201).send({ user }); }); app.post('/api/v1/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => { const user = await auth.login(request.body as any); issue(app, reply, user.id); return { user }; }); app.post('/api/v1/auth/logout', async (_request, reply) => reply.clearCookie('session', { path: '/' }).code(204).send()); app.get('/api/v1/users/me', { preHandler: requireUser }, async request => auth.current(subject(request))); app.delete('/api/v1/users/me', { preHandler: requireUser }, async (request, reply) => { await auth.delete(subject(request)); return reply.clearCookie('session', { path: '/' }).code(204).send(); }); app.get('/api/v1/files', { preHandler: requireUser }, async request => ({ files: (await files.list(subject(request))).map(({ path: _path, userId: _userId, ...file }) => file) })); app.post('/api/v1/files', { preHandler: requireUser }, async (request, reply) => { const body = request.body as { name?: string; content?: string }; if (!body.name || !body.content) throw new AppError(400, 'VALIDATION_ERROR', 'name and base64 content are required.'); const content = Buffer.from(body.content, 'base64'); if (!content.length || content.length > 5 * 1024 * 1024) throw new AppError(400, 'VALIDATION_ERROR', 'File must be between 1 byte and 5 MB.'); const id = randomUUID(); const createdAt = new Date().toISOString(); const path = await storage.put(subject(request), id, body.name, content); await files.create({ id, userId: subject(request), name: body.name, size: content.length, createdAt, path }); return reply.code(201).send({ id, name: body.name, size: content.length, createdAt }); }); }
`;

const server = `import Fastify from 'fastify'; import cors from '@fastify/cors'; import cookie from '@fastify/cookie'; import helmet from '@fastify/helmet'; import jwt from '@fastify/jwt'; import rateLimit from '@fastify/rate-limit'; import { Pool } from 'pg'; import { settings } from './config/settings.js'; import { PostgresFileRepository, PostgresUserRepository } from './repositories/user-repository.js'; import { LocalStorage } from './providers/storage.js'; import { AuthService, AppError } from './services/auth-service.js'; import { registerRoutes } from './routes/routes.js';
const app = Fastify({ logger: true }); const pool = new Pool({ connectionString: settings.databaseUrl, max: 10, idleTimeoutMillis: 30000 }); await app.register(cors, { origin: settings.frontendUrl, credentials: true }); await app.register(cookie); await app.register(helmet, { contentSecurityPolicy: false }); await app.register(rateLimit, { max: 100, timeWindow: '1 minute' }); await app.register(jwt, { secret: settings.sessionSecret, sign: { iss: settings.jwtIssuer, aud: settings.jwtAudience, algorithm: 'HS256' }, verify: { allowedIss: settings.jwtIssuer, allowedAud: settings.jwtAudience, algorithms: ['HS256'] } }); app.setErrorHandler((error, _request, reply) => { const known = error instanceof AppError ? error : undefined; reply.code(known?.status ?? 500).send({ error: known?.message ?? 'Internal server error.', code: known?.code ?? 'INTERNAL_ERROR' }); }); registerRoutes(app, new AuthService(new PostgresUserRepository(pool)), new PostgresFileRepository(pool), new LocalStorage(settings.storagePath)); await app.listen({ host: '0.0.0.0', port: settings.port });
`;

const migration = `CREATE TABLE users (id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE files (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, size INTEGER NOT NULL CHECK (size >= 0), created_at TIMESTAMPTZ NOT NULL, path TEXT NOT NULL);
CREATE INDEX files_user_id_created_at_idx ON files(user_id, created_at DESC);
`;

const backendTest = `import { describe, expect, it } from 'vitest'; import { AuthService } from '../src/services/auth-service.js';
const users = new Map<string, any>(); const repo = { findById: async (id: string) => users.get(id), findByEmail: async (email: string) => [...users.values()].find(user => user.email === email), create: async (user: any) => { users.set(user.id, user); }, delete: async (id: string) => { users.delete(id); } };
describe('auth service', () => { it('hashes a password and persists a user', async () => { const service = new AuthService(repo); const user = await service.register({ email: 'person@example.test', password: 'not-a-plaintext-password', name: 'Person' }); expect(user.email).toBe('person@example.test'); expect((await repo.findById(user.id)).passwordHash).not.toBe('not-a-plaintext-password'); await expect(service.login({ email: user.email, password: 'not-a-plaintext-password' })).resolves.toMatchObject({ id: user.id }); }); });
`;

const frontendPackage = (config: GeneratorConfig) =>
  json({
    name: `${config.projectName}-frontend`,
    private: true,
    type: 'module',
    scripts: { dev: 'vite', build: 'tsc -b && vite build', test: 'vitest run' },
    dependencies: {
      '@vitejs/plugin-react': '^4.5.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      typescript: '^5.8.0',
      vite: '^6.0.0',
    },
    devDependencies: {
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
      autoprefixer: '^10.4.0',
      postcss: '^8.5.0',
      tailwindcss: '^3.4.0',
      vitest: '^3.2.0',
    },
  });
const client = `export type User = { id: string; email: string; name: string }; export type FileRecord = { id: string; name: string; size: number; createdAt: string }; const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'; async function request<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(baseUrl + path, { ...init, credentials: 'include', headers: { 'content-type': 'application/json', ...init?.headers } }); if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.error ?? 'Request failed'); } return response.status === 204 ? undefined as T : response.json(); } export const api = { register: (body: { email: string; password: string; name?: string }) => request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }), login: (email: string, password: string) => request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }), logout: () => request<void>('/auth/logout', { method: 'POST' }), me: () => request<User>('/users/me'), deleteAccount: () => request<void>('/users/me', { method: 'DELETE' }), files: () => request<{ files: FileRecord[] }>('/files') };
`;
const app = `import { FormEvent, useEffect, useState } from 'react'; import { api, type FileRecord, type User } from './api/client'; export default function App() { const [user, setUser] = useState<User | null>(null); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [files, setFiles] = useState<FileRecord[]>([]); useEffect(() => { api.me().then(u => { setUser(u); return api.files(); }).then(result => setFiles(result.files)).catch(() => undefined); }, []); async function submit(event: FormEvent) { event.preventDefault(); setError(''); try { const result = await api.login(email, password); setUser(result.user); setFiles((await api.files()).files); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); } } if (!user) return <main className="page"><section className="card"><h1>Sign in</h1><form onSubmit={submit}><label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password<input required minLength={12} type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <p role="alert">{error}</p>}<button>Sign in</button></form></section></main>; return <main className="page"><nav><strong>My SaaS</strong><button onClick={() => api.logout().then(() => setUser(null))}>Logout</button></nav><section className="card"><h1>Dashboard</h1><p>Welcome, {user.email}</p><h2>Files</h2><ul>{files.map(file => <li key={file.id}>{file.name} ({file.size} bytes)</li>)}</ul></section></main>; }
`;
const frontendTest = `import { afterEach, describe, expect, it, vi } from 'vitest'; import { api } from './client'; afterEach(() => vi.unstubAllGlobals()); describe('API client', () => { it('uses cookie credentials for protected requests', async () => { const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'u1', email: 'person@example.test', name: 'Person' }), { status: 200 })); vi.stubGlobal('fetch', fetch); await expect(api.me()).resolves.toMatchObject({ id: 'u1' }); expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'include' }); }); it('surfaces API error messages', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401 }))); await expect(api.me()).rejects.toThrow('Authentication required.'); }); });\n`;

function typescriptBackendFiles(config: GeneratorConfig): Record<string, string> {
  const neon = config.database === 'neon';
  return {
    'backend/package.json': backendPackage(config),
    'backend/tsconfig.json': json({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: true,
      },
      include: ['src', 'test'],
    }),
    'backend/src/config/settings.ts': configSource,
    'backend/src/domain/models.ts': domain,
    'backend/src/repositories/user-repository.ts': repositories,
    'backend/src/providers/storage.ts': storage,
    'backend/src/services/auth-service.ts': authService,
    'backend/src/middleware/auth.ts': authMiddleware,
    'backend/src/routes/routes.ts': routes,
    'backend/src/server.ts': server,
    'backend/migrations/001_initial.sql': migration,
    'backend/test/auth-service.test.ts': backendTest,
    'backend/Dockerfile':
      'FROM node:22-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nENV NODE_ENV=production\nCMD ["npm", "run", "start"]\n',
    ...(neon
      ? {
          'backend/neon.ts':
            "// Neon uses the pooled DATABASE_URL supplied by managed secrets. The pg Pool is created once per process and reused across requests.\nexport const neonDeployment = { connection: 'pooled DATABASE_URL', migrations: 'migrations/001_initial.sql' } as const;\n",
          'backend/neon-function.json': '{ "runtime": "nodejs22" }\n',
        }
      : {}),
  };
}

function reactFrontendFiles(config: GeneratorConfig): Record<string, string> {
  return {
    'frontend/package.json': frontendPackage(config),
    'frontend/tsconfig.json': json({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        strict: true,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        jsx: 'react-jsx',
        skipLibCheck: true,
      },
      include: ['src'],
    }),
    'frontend/index.html':
      '<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n',
    'frontend/src/main.tsx':
      "import { createRoot } from 'react-dom/client'; import App from './App'; import './styles.css'; createRoot(document.getElementById('root')!).render(<App />);\n",
    'frontend/src/App.tsx': app,
    'frontend/src/api/client.ts': client,
    'frontend/src/api/client.test.ts': frontendTest,
    'frontend/src/vite-env.d.ts': '/// <reference types="vite/client" />\n',
    'frontend/src/styles.css':
      '@tailwind base; @tailwind components; @tailwind utilities;\n@layer components { .page { @apply mx-auto mt-16 max-w-2xl p-4; } .card { @apply rounded-lg border border-slate-200 bg-white p-8 shadow-sm; } form { @apply grid gap-4; } label { @apply grid gap-1; } input { @apply rounded border border-slate-300 p-2; } button { @apply rounded bg-slate-900 px-3 py-2 text-white; } }\n',
    'frontend/tailwind.config.js':
      "export default { content: ['./index.html', './src/**/*.{ts,tsx}'], theme: { extend: {} }, plugins: [] };\n",
    'frontend/postcss.config.js':
      'export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n',
  };
}

export function typescriptBackend(config: GeneratorConfig): TemplateContribution {
  return {
    files: typescriptBackendFiles(config),
    readmeSections: [
      `## Local development\n\nCopy \.env.example to \.env. Apply \`backend/migrations/001_initial.sql\` to PostgreSQL, then run \`npm install && npm run dev\` in \`backend\` and \`npm install && npm run dev\` in \`frontend\`. Local storage is development-only; it must be replaced by a cloud storage provider before serverless production deployment.`,
      ...(config.database === 'neon'
        ? [
            "## Neon\n\nUse Neon's pooled \`DATABASE_URL\` as a managed secret. Apply the included PostgreSQL migration with your migration runner; the generated API creates one reusable pool per process and reused across requests.",
          ]
        : []),
    ],
  };
}
export function reactFrontend(config: GeneratorConfig): TemplateContribution {
  return { files: reactFrontendFiles(config) };
}
