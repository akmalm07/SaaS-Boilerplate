export const backends = ['typescript', 'python', 'go', 'java'] as const;
export const frontends = ['react', 'react-native', 'angular'] as const;
export const databases = ['postgres', 'neon', 'mongodb', 'firestore'] as const;
export const storages = ['local', 'aws-s3', 'gcs', 'firebase-storage'] as const;
export const emails = ['smtp', 'twilio', 'resend', 'sendgrid'] as const;

export type Backend = (typeof backends)[number];
export type Frontend = (typeof frontends)[number];
export type Database = (typeof databases)[number];
export type Storage = (typeof storages)[number];
export type Email = (typeof emails)[number];
export type SelectionKind = 'backend' | 'frontend' | 'database' | 'storage' | 'email';

/**
 * Options whose generated code builds in CI but whose live-provider behavior
 * has not been exercised by this repository's credentialed preflight.
 */
export const betaSelections: Record<SelectionKind, readonly string[]> = {
  backend: [],
  frontend: [],
  database: [],
  storage: ['aws-s3', 'gcs'],
  email: ['smtp', 'resend', 'sendgrid'],
};

export function isBetaSelection(kind: SelectionKind, value: string): boolean {
  return betaSelections[kind].includes(value);
}

export interface GeneratorConfig {
  projectName: string;
  backend: Backend;
  frontend: Frontend;
  database: Database;
  storage: Storage;
  email: Email;
  billing: boolean;
  organizations: boolean;
  docker: boolean;
}

export interface EnvironmentVariable {
  key: string;
  description: string;
  required: boolean;
  value?: string;
}

export interface TemplateContribution {
  files?: Record<string, string>;
  dependencies?: Record<string, string>;
  env?: EnvironmentVariable[];
  readmeSections?: string[];
}

export interface GeneratorModule {
  id: string;
  kind: 'frontend' | 'backend' | 'database' | 'storage' | 'email' | 'feature' | 'deployment';
  contribute: (config: GeneratorConfig) => TemplateContribution;
}

export const defaults: GeneratorConfig = {
  projectName: 'my-saas',
  backend: 'typescript',
  frontend: 'react',
  database: 'postgres',
  storage: 'local',
  email: 'smtp',
  billing: false,
  organizations: false,
  docker: false,
};
