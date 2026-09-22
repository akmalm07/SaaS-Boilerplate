import {
  backends,
  databases,
  defaults,
  emails,
  frontends,
  storages,
  type GeneratorConfig,
} from './types.js';

const projectNamePattern = /^[a-z0-9][a-z0-9-]{0,62}$/;
export function validateConfig(config: GeneratorConfig): string[] {
  const errors: string[] = [];
  if (!projectNamePattern.test(config.projectName))
    errors.push('Project name must be lowercase kebab-case (1–63 characters).');
  if (!backends.includes(config.backend)) errors.push(`Unsupported backend: ${config.backend}`);
  if (!frontends.includes(config.frontend)) errors.push(`Unsupported frontend: ${config.frontend}`);
  if (!databases.includes(config.database)) errors.push(`Unsupported database: ${config.database}`);
  if (!storages.includes(config.storage)) errors.push(`Unsupported storage: ${config.storage}`);
  if (!emails.includes(config.email)) errors.push(`Unsupported email provider: ${config.email}`);
  // Credentials are intentionally not validated at generation time. Every
  // selection produces a starter project and an .env.example; applications
  // validate their selected provider credentials when they are actually run.
  return errors;
}

export function configFromOptions(
  projectName: string,
  options: Partial<GeneratorConfig>,
): GeneratorConfig {
  return { ...defaults, ...options, projectName };
}
