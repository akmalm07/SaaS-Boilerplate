# create-composable-saas

A composable SaaS generator. It composes small module descriptors rather than maintaining one repository per technology combination.

## Quick start

```sh
npm install
npm run build
node dist/cli.js my-app --backend typescript --frontend react --database postgres --storage local --email smtp --docker
```

For interactive use, omit the options. Generated application dependencies are deliberately installed manually, so generation remains transactional and works in offline CI.

## Architecture

- `src/core`: typed configuration, validation, module registry, transactional writer, and generator engine.
- `src/templates`: composable file contributions. A provider adds only its own dependencies, environment variables, documentation, and files.
- `src/cli.ts`: Clack-powered interactive and Commander non-interactive entry point.
- `tests`: unit and integration tests including a representative provider matrix.

The generated OpenAPI document is the canonical common contract. The fully implemented vertical slice is React + TypeScript/Fastify + PostgreSQL + local storage + SMTP. Other choices are represented as provider modules with selected-only configuration and documented implementation status; see `REQUIREMENTS_CHECKLIST.md`.

## Adding a provider

Add a `GeneratorModule` in `src/core/modules.ts`, then add template contributions in `src/templates`. Do not add combination-specific folders. A new storage provider, for example, contributes its SDK dependency, environment variables, setup docs, and implementation file through the storage module hook.
"# SaaS-Boilerplate" 
