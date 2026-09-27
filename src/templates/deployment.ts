import type { GeneratorConfig } from '../core/types.js';

/** Deployment file templates. They are selected as complete files rather than
 * assembled from provider snippets, which keeps a generated stack readable. */
export function gitignore(config: GeneratorConfig): string {
  const language = {
    typescript: 'node_modules\ndist\ncoverage\n',
    python: '__pycache__/\n*.py[cod]\n.venv/\n.pytest_cache/\n',
    go: 'backend/api\nbackend/*.exe\n',
    java: 'backend/target/\nbackend/.mvn/\n',
  }[config.backend];
  return `.env\n.env.*\n!.env.example\nsecrets/\n*.pem\n*.key\n${language}uploads/\n.DS_Store\n`;
}

export function dockerignore(config: GeneratorConfig): string {
  const language = config.backend === 'typescript' ? 'node_modules\ndist\ncoverage\n' : '';
  return `.git\n.env\n.env.*\nsecrets\n${language}uploads\n`;
}

function databaseServices(config: GeneratorConfig): {
  services: string;
  apiEnvironment: string;
  dependsOn: string;
} {
  if (config.database === 'postgres')
    return {
      services:
        "  postgres:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_USER: app\n      POSTGRES_PASSWORD: app\n      POSTGRES_DB: app\n    healthcheck:\n      test: ['CMD-SHELL', 'pg_isready -U app']\n      interval: 5s\n      timeout: 3s\n      retries: 10\n",
      apiEnvironment: '      DATABASE_URL: ${DATABASE_URL:-postgres://app:app@postgres:5432/app}\n',
      dependsOn: '    depends_on:\n      postgres:\n        condition: service_healthy\n',
    };
  if (config.database === 'mongodb')
    return {
      services: '  mongo:\n    image: mongo:8\n    volumes: [mongo-data:/data/db]\n',
      apiEnvironment:
        '      MONGODB_URI: ${MONGODB_URI:-mongodb://mongo:27017}\n      MONGODB_DATABASE: ${MONGODB_DATABASE:-app}\n',
      dependsOn: '    depends_on: [mongo]\n',
    };
  if (config.database === 'neon')
    return {
      services: '',
      apiEnvironment:
        '      DATABASE_URL: ${DATABASE_URL:?set the Neon pooled DATABASE_URL in .env}\n',
      dependsOn: '',
    };
  return {
    services: '',
    apiEnvironment:
      '      FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID:?set FIREBASE_PROJECT_ID in .env}\n',
    dependsOn: '',
  };
}

export function compose(config: GeneratorConfig): string {
  const database = databaseServices(config);
  const port = config.backend === 'typescript' ? 3000 : 8080;
  const gcs =
    config.storage === 'gcs'
      ? '      GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/gcp.json\n    volumes:\n      - ${GOOGLE_APPLICATION_CREDENTIALS_FILE:?set the service-account path in .env}:/run/secrets/gcp.json:ro\n'
      : config.storage === 'local'
        ? '    volumes: [uploads:/app/uploads]\n'
        : '';
  const api = `  api:\n    build: ./backend\n    env_file: .env\n    environment:\n      PORT: ${port}\n      FRONTEND_URL: ${config.frontend === 'react' ? 'http://localhost:8080' : `http://localhost:${port}`}\n${database.apiEnvironment}${gcs}${database.dependsOn}`;
  const frontend =
    config.frontend === 'react'
      ? `  frontend:\n    build: ./frontend\n    ports: ['8080:80']\n    depends_on: [api]\n`
      : `  api:\n    ports: ['${port}:${port}']\n`;
  const volumes = [
    config.database === 'mongodb' ? 'mongo-data: {}' : '',
    config.storage === 'local' ? 'uploads: {}' : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `services:\n${database.services}${api}${config.frontend === 'react' ? frontend : `    ports: ['${port}:${port}']\n`}${volumes ? `volumes:\n${volumes}\n` : ''}`;
}

export function deploymentFiles(config: GeneratorConfig): Record<string, string> {
  return {
    '.dockerignore': dockerignore(config),
    ...(config.docker ? { 'compose.yaml': compose(config) } : {}),
  };
}
