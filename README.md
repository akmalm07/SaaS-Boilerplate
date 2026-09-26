# SaaS Boilerplate Generator

[![Continuous integration](https://github.com/akmalm07/SaaS-Boilerplate/actions/workflows/ci.yml/badge.svg)](https://github.com/akmalm07/SaaS-Boilerplate/actions/workflows/ci.yml)
[![Provider preflight](https://github.com/akmalm07/SaaS-Boilerplate/actions/workflows/provider-preflight.yml/badge.svg)](https://github.com/akmalm07/SaaS-Boilerplate/actions/workflows/provider-preflight.yml)

A portfolio-quality command-line generator for starting a SaaS application with a deliberate technology stack. It produces a clean project skeleton with a backend, frontend, API contract, provider setup guides, and an `.env.example` containing only the variables selected for that project.

The generator does **not** put API keys in source code or attempt to provision cloud accounts. It gives a developer a buildable foundation; they connect their own credentials and complete the product-specific behavior.

## What it generates

| Area             | Choices                                                  |
| ---------------- | -------------------------------------------------------- |
| Backend          | TypeScript/Fastify, Python/FastAPI, Go, Java/Spring Boot |
| Frontend         | React, Angular, React Native/Expo                        |
| Database         | PostgreSQL, Neon, MongoDB, Firestore                     |
| File storage     | Local, AWS S3, Google Cloud Storage, Firebase Storage    |
| Email            | SMTP, Twilio Email API, Resend, SendGrid                 |
| Optional modules | Stripe billing, organizations/teams, Docker support      |

Every selection has a typed module descriptor. Modules contribute only the files, package dependencies, environment variables, and documentation relevant to that choice. The OpenAPI file in `shared/openapi.yaml` is the generated project’s shared API contract.

## Quick start

```sh
npm ci
npm run build
node dist/cli.js my-app --backend typescript --frontend react --database postgres --storage local --email smtp --docker
```

For interactive use, omit the options:

```sh
npm run dev -- my-app
```

After generation, copy the generated `.env.example` to `.env`, provide only the credentials required by the selected integrations, and install the generated backend and frontend dependencies.

## Verification and beta labels

The interactive wizard marks an option as **(beta)** when its generated project builds in CI but its live provider or full product behavior has not yet been tested with a real service account. A beta label is transparency, not a claim that the option is absent.

| Verified now                                                                                                                                                        | Marked beta in the wizard                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| All backend and frontend skeleton builds; PostgreSQL/Neon, MongoDB, Firestore, Firebase Storage, and Twilio Email credential preflight; Stripe credential preflight | AWS S3, Google Cloud Storage, SMTP, Resend, SendGrid; organizations/teams flow; generated Docker deployment |

The CI workflow compiles a representative generated project for each backend and frontend, and it runs generator unit tests. On pushes to `main`, it also runs read-only credentialed checks for configured providers—including Stripe, Firestore, and Firebase Storage. The separate **Provider preflight** workflow remains available for an on-demand run. Neither workflow runs provider checks on pull requests. See [the requirements and verification checklist](REQUIREMENTS_CHECKLIST.md) for the current coverage details.

## CI/CD learning journey

This project was built as a practical CI/CD learning path, not just a code generator.

1. I started by making generation deterministic: configuration is validated up front and files are written transactionally, so failed generation does not leave a half-created app behind.
2. I added fast local feedback with TypeScript compilation and Vitest tests for validation and generator output.
3. I moved that feedback into GitHub Actions. Every pull request and push to `main` now builds the generator, runs its tests, creates representative projects, and compiles each supported backend and frontend family.
4. I separated credentialed integration checks from pull-request CI. Main-branch CI and the manual provider-preflight workflow use GitHub Secrets, perform read-only checks, and never log a credential or send email, create a customer, or charge a card.
5. Go projects generated with Stripe billing include a raw-body, signature-verified webhook starter at `POST /api/v1/billing/webhook`. It deliberately leaves event persistence and entitlement updates as marked TODOs, because Stripe delivery is at-least-once and production handling needs an application-specific idempotency store. The Cloud Run example under `implementations/cloud-run-typescript` remains available as a deployment reference.

The next learning step is continuous deployment: connect GitHub to Cloud Run, map runtime secrets from Secret Manager, and promote only a passing build. The included container already exposes `/health` on port `8080` and has been built and health-checked locally.

## Repository map

```text
src/
  cli.ts                 Interactive and non-interactive entry point
  core/                  Types, validation, module registry, writer, generator
  templates/             Backend and frontend template contributions
tests/                   Generator and validation tests
scripts/                 Local read-only provider preflight
.github/workflows/       CI and manual provider-preflight workflows
implementations/         Deployment-specific reference implementations
```

## Commands

| Command                  | Purpose                                                 |
| ------------------------ | ------------------------------------------------------- |
| `npm run build`          | Compile the generator                                   |
| `npm test`               | Run local unit and integration tests                    |
| `npm run test:providers` | Run read-only checks against values in the local `.env` |
| `npm run dev -- my-app`  | Start the interactive generator                         |

## GitHub provider preflight setup

The manual workflow at [`.github/workflows/provider-preflight.yml`](.github/workflows/provider-preflight.yml) expects these GitHub Secrets when you want the matching check to run: `DATABASE_URL`, `MONGODB_URI`, `MONGODB_DATABASE`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_STORAGE_BUCKET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `STRIPE_SECRET_KEY`.

Set `FRONTEND_URL` as a GitHub repository Variable, not a secret. For GitHub Actions, `FIREBASE_SERVICE_ACCOUNT_JSON` must contain the service-account JSON itself; a local file path works only for local preflight runs.

## Contributing a provider

Add a `GeneratorModule` in `src/core/modules.ts`, then add template contributions, selected-only environment placeholders, an official provider guide, and coverage that proves the generated project builds. Keep credentials and deployment-specific values out of generator templates.
