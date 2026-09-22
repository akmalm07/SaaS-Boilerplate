import type { GeneratorConfig, TemplateContribution } from '../core/types.js';

const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

export function angularFrontend(config: GeneratorConfig): TemplateContribution {
  return {
    files: {
      'frontend/package.json': json({
        name: `${config.projectName}-frontend`,
        private: true,
        scripts: { start: 'ng serve', build: 'ng build', test: 'ng test --watch=false' },
        dependencies: {
          '@angular/common': '^21.0.0',
          '@angular/compiler': '^21.0.0',
          '@angular/core': '^21.0.0',
          '@angular/forms': '^21.0.0',
          '@angular/platform-browser': '^21.0.0',
          rxjs: '^7.8.0',
          tslib: '^2.8.0',
          'zone.js': '^0.15.0',
        },
        devDependencies: {
          '@angular/build': '^21.0.0',
          '@angular/cli': '^21.0.0',
          '@angular/compiler-cli': '^21.0.0',
          '@tailwindcss/postcss': '^4.0.0',
          postcss: '^8.5.0',
          tailwindcss: '^4.0.0',
          typescript: '~5.9.0',
        },
      }),
      'frontend/angular.json': json({
        $schema: './node_modules/@angular/cli/lib/config/schema.json',
        version: 1,
        projects: {
          app: {
            projectType: 'application',
            root: '',
            sourceRoot: 'src',
            prefix: 'app',
            architect: {
              build: {
                builder: '@angular/build:application',
                options: {
                  browser: 'src/main.ts',
                  polyfills: ['zone.js'],
                  tsConfig: 'tsconfig.app.json',
                  assets: [],
                  styles: ['src/styles.css'],
                },
              },
              serve: {
                builder: '@angular/build:dev-server',
                configurations: { development: { buildTarget: 'app:build:development' } },
                defaultConfiguration: 'development',
              },
            },
          },
        },
        cli: { analytics: false },
      }),
      'frontend/tsconfig.json': json({
        compilerOptions: {
          strict: true,
          target: 'ES2022',
          module: 'preserve',
          moduleResolution: 'bundler',
          experimentalDecorators: true,
          skipLibCheck: true,
        },
        angularCompilerOptions: { strictTemplates: true },
        files: [],
        references: [{ path: './tsconfig.app.json' }],
      }),
      'frontend/tsconfig.app.json': json({
        extends: './tsconfig.json',
        compilerOptions: { outDir: './out-tsc/app', types: [] },
        include: ['src/**/*.ts'],
      }),
      'frontend/.postcssrc.json': json({ plugins: { '@tailwindcss/postcss': {} } }),
      'frontend/src/main.ts':
        "import { bootstrapApplication } from '@angular/platform-browser';\nimport { AppComponent } from './app/app.component';\nbootstrapApplication(AppComponent).catch(console.error);\n",
      'frontend/src/index.html':
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>My SaaS</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><app-root></app-root></body></html>\n',
      'frontend/src/app/api.service.ts':
        "import { Injectable } from '@angular/core';\nexport type User = { id: string; email: string; name: string };\n@Injectable({ providedIn: 'root' }) export class ApiService { private readonly base = (globalThis as any).__env?.API_URL ?? 'http://localhost:3000/api/v1'; async login(email: string, password: string) { return this.request<{user: User}>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); } async me() { return this.request<User>('/users/me'); } private async request<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(this.base + path, { ...init, credentials: 'include', headers: { 'content-type': 'application/json', ...init?.headers } }); if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? 'Request failed'); return response.json() as Promise<T>; } }\n",
      'frontend/src/app/app.component.ts':
        'import { Component, inject, signal } from \'@angular/core\';\nimport { FormsModule } from \'@angular/forms\';\nimport { ApiService, type User } from \'./api.service\';\n@Component({ selector: \'app-root\', standalone: true, imports: [FormsModule], template: `<main class="mx-auto mt-16 max-w-md rounded border p-6"><h1 class="text-2xl font-semibold">My SaaS</h1>@if (user()) { <p>Welcome, {{ user()?.email }}</p> } @else { <form (ngSubmit)="login()" class="grid gap-3"><input [(ngModel)]="email" name="email" type="email" placeholder="Email" required><input [(ngModel)]="password" name="password" type="password" placeholder="Password" required><button>Sign in</button></form> } @if (error()) { <p class="text-red-600">{{ error() }}</p> }</main>` }) export class AppComponent { private readonly api = inject(ApiService); readonly user = signal<User | null>(null); readonly error = signal(\'\'); email = \'\'; password = \'\'; async login() { try { this.error.set(\'\'); this.user.set((await this.api.login(this.email, this.password)).user); } catch (error) { this.error.set(error instanceof Error ? error.message : \'Request failed\'); } } }\n',
      'frontend/src/styles.css':
        '@import "tailwindcss";\ninput,button { @apply rounded border p-2; } button { @apply bg-slate-900 text-white; }\n',
      'frontend/README.md':
        '## Angular starter\n\nThis standalone Angular client uses Tailwind v4 through PostCSS and a cookie-based API client. Set the backend URL in your deployment environment; do not put secrets in Angular environment files. Run `npm install`, then `npm run build` or `npm start`.\n',
    },
    readmeSections: [
      '## Angular frontend\n\nThe generated Angular client is a minimal standalone application using Tailwind through the official PostCSS integration. Browser requests include cookies; API keys never belong in this client.',
    ],
  };
}

export function reactNativeFrontend(config: GeneratorConfig): TemplateContribution {
  return {
    files: {
      'frontend/package.json': json({
        name: `${config.projectName}-mobile`,
        private: true,
        main: 'expo/AppEntry',
        scripts: {
          start: 'expo start',
          android: 'expo start --android',
          ios: 'expo start --ios',
          web: 'expo start --web',
          typecheck: 'tsc --noEmit',
        },
        dependencies: {
          expo: '^55.0.0',
          'expo-secure-store': '^15.0.0',
          react: '^19.1.0',
          'react-native': '^0.81.0',
        },
        devDependencies: { '@types/react': '^19.0.0', typescript: '~5.9.0' },
      }),
      'frontend/app.json': json({
        expo: {
          name: config.projectName,
          slug: config.projectName,
          version: '1.0.0',
          orientation: 'portrait',
          userInterfaceStyle: 'automatic',
          plugins: ['expo-secure-store'],
        },
      }),
      'frontend/tsconfig.json': json({
        extends: 'expo/tsconfig.base',
        compilerOptions: { strict: true },
      }),
      'frontend/App.tsx':
        "import { useState } from 'react';\nimport { Button, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';\nimport * as SecureStore from 'expo-secure-store';\nconst baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';\nexport default function App() { const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [message, setMessage] = useState(''); async function login() { const response = await fetch(baseUrl + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) }); if (!response.ok) { setMessage('Sign-in failed'); return; } const token = response.headers.get('x-session-token'); if (token) await SecureStore.setItemAsync('session', token); setMessage('Signed in.'); } return <SafeAreaView style={styles.page}><View style={styles.card}><Text style={styles.title}>My SaaS</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize=\"none\" keyboardType=\"email-address\" placeholder=\"Email\" /><TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder=\"Password\" /><Button title=\"Sign in\" onPress={() => void login()} /><Text>{message}</Text></View></SafeAreaView>; } const styles = StyleSheet.create({ page: { flex: 1, justifyContent: 'center', padding: 24 }, card: { gap: 12 }, title: { fontSize: 28, fontWeight: '600' }, input: { borderWidth: 1, borderColor: '#94a3b8', borderRadius: 6, padding: 12 } });\n",
      'frontend/.env.example': 'EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1\n',
      'frontend/README.md':
        '## React Native starter\n\nThis Expo starter keeps session material in Expo SecureStore, not AsyncStorage. Set `EXPO_PUBLIC_API_URL` for a reachable API URL; only variables explicitly prefixed `EXPO_PUBLIC_` are bundled into the mobile app, so never put provider keys there. Run `npm install`, then `npm start`. Native builds require the platform toolchain or EAS Build.\n',
    },
    readmeSections: [
      '## React Native frontend\n\nThe generated Expo starter uses `expo-secure-store` for session material and only exposes the API base URL through `EXPO_PUBLIC_API_URL`.',
    ],
  };
}
