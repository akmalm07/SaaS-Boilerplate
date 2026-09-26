import type { GeneratorConfig, GeneratorModule, TemplateContribution } from './types.js';
import { reactFrontend, typescriptBackend } from '../templates/vertical-slice.js';
import { goBackend } from '../templates/go-backend.js';
import { pythonBackend } from '../templates/python-backend.js';
import { javaBackend } from '../templates/java-backend.js';
import { angularFrontend, reactNativeFrontend } from '../templates/additional-frontends.js';

function provider(
  id: string,
  kind: GeneratorModule['kind'],
  env: TemplateContribution['env'],
  docs: string,
  dependencies: Record<string, string> = {},
): GeneratorModule {
  const filename = id.replace(':', '-');
  return {
    id,
    kind,
    contribute: () => ({
      env,
      dependencies,
      files: {
        [`backend/provider-guides/${filename}.md`]: `# ${id} starter\n\n${docs}\n\nThis generator intentionally writes placeholders only. Copy \.env.example to \.env and provide your own credentials at runtime. Keep provider-specific calls behind the generated repository/provider boundary so replacing this integration does not change routes or domain services.\n`,
      },
      readmeSections: [`## ${id}\n\n${docs}`],
    }),
  };
}

const modules: Record<string, GeneratorModule> = {
  'backend:typescript': {
    id: 'backend:typescript',
    kind: 'backend',
    contribute: (c) => typescriptBackend(c),
  },
  'backend:python': { id: 'backend:python', kind: 'backend', contribute: (c) => pythonBackend(c) },
  'backend:go': { id: 'backend:go', kind: 'backend', contribute: (c) => goBackend(c) },
  'backend:java': { id: 'backend:java', kind: 'backend', contribute: (c) => javaBackend(c) },
  'frontend:react': { id: 'frontend:react', kind: 'frontend', contribute: (c) => reactFrontend(c) },
  'frontend:react-native': {
    id: 'frontend:react-native',
    kind: 'frontend',
    contribute: reactNativeFrontend,
  },
  'frontend:angular': { id: 'frontend:angular', kind: 'frontend', contribute: angularFrontend },
  'database:postgres': provider(
    'database:postgres',
    'database',
    [
      {
        key: 'DATABASE_URL',
        required: true,
        description: 'PostgreSQL connection string',
      },
    ],
    'Set `DATABASE_URL` to your PostgreSQL connection string, then apply the generated SQL migration before starting the API.',
  ),
  'database:neon': provider(
    'database:neon',
    'database',
    [
      {
        key: 'DATABASE_URL',
        required: true,
        description: 'Neon pooled PostgreSQL connection string',
      },
      {
        key: 'DATABASE_URL_UNPOOLED',
        required: true,
        description: 'Neon direct connection string for migrations',
      },
    ],
    'Use the pooled `DATABASE_URL` for application traffic and `DATABASE_URL_UNPOOLED` for migrations. Official guidance: https://neon.com/docs/connect/connection-pooling.',
  ),
  'database:mongodb': provider(
    'database:mongodb',
    'database',
    [
      { key: 'MONGODB_URI', required: true, description: 'MongoDB connection URI' },
      { key: 'MONGODB_DATABASE', required: true, description: 'Database name' },
    ],
    'Use the official MongoDB driver and keep the generated repository interface as the application boundary. Official guide: https://www.mongodb.com/docs/drivers/node/current/quick-start/ .',
    { mongodb: '^6.0.0' },
  ),
  'database:firestore': {
    id: 'database:firestore',
    kind: 'database',
    contribute: () => ({
      env: [
        { key: 'FIREBASE_PROJECT_ID', required: true, description: 'Firebase project ID' },
        {
          key: 'FIREBASE_CLIENT_EMAIL',
          required: false,
          description: 'Optional Firebase service account email; ADC is preferred',
        },
        {
          key: 'FIREBASE_PRIVATE_KEY',
          required: false,
          description: 'Optional Firebase service account private key; ADC is preferred',
        },
      ],
      dependencies: { 'firebase-admin': '^13.0.0' },
      files: {
        'scripts/provision-firestore.ps1':
          'param([Parameter(Mandatory=$true)][string]$ProjectId, [string]$Location="us-central")\n$ErrorActionPreference = "Stop"\ngcloud auth application-default login\ngcloud config set project $ProjectId\ngcloud firestore databases create --location=$Location\nWrite-Host "Firestore provisioned. Configure FIREBASE_PROJECT_ID in .env."\n',
        'scripts/provision-firestore.sh':
          '#!/usr/bin/env bash\nset -euo pipefail\nPROJECT_ID="${1:?usage: provision-firestore.sh PROJECT_ID [location]}"\nLOCATION="${2:-us-central}"\ngcloud auth application-default login\ngcloud config set project "$PROJECT_ID"\ngcloud firestore databases create --location="$LOCATION"\nprintf "Firestore provisioned. Configure FIREBASE_PROJECT_ID in .env.\\n"\n',
      },
      readmeSections: [
        '## Firestore provisioning\n\nRun `scripts/provision-firestore.ps1 -ProjectId YOUR_PROJECT` on PowerShell, or `bash scripts/provision-firestore.sh YOUR_PROJECT`. The generated Go API uses Application Default Credentials.',
      ],
    }),
  },
  'storage:local': provider(
    'storage:local',
    'storage',
    [
      {
        key: 'LOCAL_STORAGE_PATH',
        required: false,
        value: './uploads',
        description: 'Development-only local upload directory',
      },
    ],
    'Local storage is for development/testing only.',
  ),
  'storage:aws-s3': provider(
    'storage:aws-s3',
    'storage',
    [
      { key: 'AWS_REGION', required: true, description: 'S3 region' },
      { key: 'AWS_S3_BUCKET', required: true, description: 'S3 bucket name' },
      {
        key: 'AWS_ACCESS_KEY_ID',
        required: false,
        description: 'Optional AWS key; prefer IAM roles',
      },
      {
        key: 'AWS_SECRET_ACCESS_KEY',
        required: false,
        description: 'Optional AWS secret; prefer IAM roles',
      },
    ],
    'Use AWS SDK for JavaScript v3 `S3Client` and `PutObjectCommand`; use `@aws-sdk/s3-request-presigner` for browser uploads. Official guide: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html .',
    { '@aws-sdk/client-s3': '^3.0.0', '@aws-sdk/s3-request-presigner': '^3.0.0' },
  ),
  'storage:gcs': {
    id: 'storage:gcs',
    kind: 'storage',
    contribute: () => ({
      env: [
        { key: 'GCP_PROJECT_ID', required: true, description: 'Google Cloud project ID' },
        { key: 'GCP_STORAGE_BUCKET', required: true, description: 'Cloud Storage bucket' },
      ],
      dependencies: { '@google-cloud/storage': '^7.0.0' },
      files: {
        'scripts/provision-gcs.ps1':
          'param([Parameter(Mandatory=$true)][string]$ProjectId, [Parameter(Mandatory=$true)][string]$Bucket, [string]$Location="us-central1")\n$ErrorActionPreference = "Stop"\ngcloud auth application-default login\ngcloud config set project $ProjectId\ngcloud storage buckets create "gs://$Bucket" --location=$Location --uniform-bucket-level-access\nWrite-Host "Bucket provisioned. Configure GCP_PROJECT_ID and GCP_STORAGE_BUCKET in .env."\n',
        'scripts/provision-gcs.sh':
          '#!/usr/bin/env bash\nset -euo pipefail\nPROJECT_ID="${1:?usage: provision-gcs.sh PROJECT_ID BUCKET [location]}"\nBUCKET="${2:?usage: provision-gcs.sh PROJECT_ID BUCKET [location]}"\nLOCATION="${3:-us-central1}"\ngcloud auth application-default login\ngcloud config set project "$PROJECT_ID"\ngcloud storage buckets create "gs://$BUCKET" --location="$LOCATION" --uniform-bucket-level-access\nprintf "Bucket provisioned. Configure GCP_PROJECT_ID and GCP_STORAGE_BUCKET in .env.\\n"\n',
      },
      readmeSections: [
        '## Google Cloud Storage provisioning\n\nRun `scripts/provision-gcs.ps1 -ProjectId YOUR_PROJECT -Bucket YOUR_BUCKET`, or `bash scripts/provision-gcs.sh YOUR_PROJECT YOUR_BUCKET`. The scripts use the `gcloud` CLI and Application Default Credentials.',
      ],
    }),
  },
  'storage:firebase-storage': provider(
    'storage:firebase-storage',
    'storage',
    [{ key: 'FIREBASE_STORAGE_BUCKET', required: true, description: 'Firebase Storage bucket' }],
    'Use the Firebase Admin SDK on the server; prefer Application Default Credentials in Google-hosted environments. Official guide: https://firebase.google.com/docs/admin/setup .',
    { 'firebase-admin': '^13.0.0' },
  ),
  'email:smtp': provider(
    'email:smtp',
    'email',
    [
      { key: 'SMTP_HOST', required: true, description: 'SMTP host' },
      { key: 'SMTP_PORT', required: true, value: '587', description: 'SMTP port' },
      { key: 'SMTP_USER', required: false, description: 'SMTP account' },
      { key: 'SMTP_PASSWORD', required: false, description: 'SMTP password' },
      { key: 'EMAIL_FROM', required: true, description: 'Sender address' },
    ],
    'Use Nodemailer `createTransport` with STARTTLS on port 587 or implicit TLS on port 465. Official guide: https://nodemailer.com/smtp .',
  ),
  'email:twilio': provider(
    'email:twilio',
    'email',
    [
      {
        key: 'TWILIO_ACCOUNT_SID',
        required: true,
        description: 'Twilio Account SID for the Twilio Email API',
      },
      {
        key: 'TWILIO_AUTH_TOKEN',
        required: true,
        description: 'Twilio Auth Token for the Twilio Email API',
      },
      {
        key: 'TWILIO_EMAIL_FROM',
        required: true,
        description: 'Authorized Twilio Email sender address',
      },
      {
        key: 'TWILIO_EMAIL_FROM_NAME',
        required: true,
        description: 'Display name for the Twilio Email sender',
      },
    ],
    'Use Twilio Email—not SendGrid—at `POST https://comms.twilio.com/v1/Emails`. It is asynchronous and returns an operation ID; use the operation location to track delivery. Official guide: https://www.twilio.com/docs/email/api/overview .',
  ),
  'email:resend': provider(
    'email:resend',
    'email',
    [
      { key: 'RESEND_API_KEY', required: true, description: 'Resend API key' },
      { key: 'EMAIL_FROM', required: true, description: 'Verified sender address' },
    ],
    'Use the Resend Node SDK `emails.send` API with a verified sender. Official guide: https://resend.com/nodejs .',
    { resend: '^4.0.0' },
  ),
  'email:sendgrid': provider(
    'email:sendgrid',
    'email',
    [
      { key: 'SENDGRID_API_KEY', required: true, description: 'SendGrid API key' },
      { key: 'EMAIL_FROM', required: true, description: 'Verified sender address' },
    ],
    'Use the SendGrid Node mail helper with a verified sender. Official guide: https://docs.sendgrid.com/for-developers/sending-email/quickstart-nodejs .',
    { '@sendgrid/mail': '^8.0.0' },
  ),
  stripe: provider(
    'stripe',
    'feature',
    [
      { key: 'STRIPE_SECRET_KEY', required: true, description: 'Stripe secret key' },
      {
        key: 'STRIPE_WEBHOOK_SECRET',
        required: true,
        description: 'Stripe webhook signing secret',
      },
    ],
    'Create Checkout Sessions server-side and verify webhook signatures against the raw request body. Official reference: https://docs.stripe.com/api/checkout/sessions/create .',
    { stripe: '^18.0.0' },
  ),
  organizations: provider(
    'organizations',
    'feature',
    [],
    'Starter domain boundaries for organizations, invitations, and role checks belong in the service layer. Add selected persistence operations behind repository interfaces.',
  ),
  docker: {
    id: 'docker',
    kind: 'deployment',
    contribute: () => ({
      files: {
        'compose.yaml':
          "services:\n  postgres:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_USER: app\n      POSTGRES_PASSWORD: app\n      POSTGRES_DB: app\n    ports: ['5432:5432']\n    healthcheck:\n      test: ['CMD-SHELL', 'pg_isready -U app']\n      interval: 5s\n      timeout: 3s\n      retries: 10\n",
      },
      readmeSections: [
        '## Docker\n\n`docker compose up postgres` starts the local PostgreSQL dependency with a health check.',
      ],
    }),
  },
};

export function resolveModules(config: GeneratorConfig): GeneratorModule[] {
  const keys = [
    `backend:${config.backend}`,
    `frontend:${config.frontend}`,
    `database:${config.database}`,
    `storage:${config.storage}`,
    `email:${config.email}`,
    ...(config.billing ? ['stripe'] : []),
    ...(config.organizations ? ['organizations'] : []),
    ...(config.docker ? ['docker'] : []),
  ];
  return keys.map((key) => {
    const item = modules[key];
    if (!item) throw new Error(`Module not registered: ${key}`);
    return item;
  });
}
