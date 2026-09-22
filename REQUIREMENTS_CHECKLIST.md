# Generated skeleton checklist

This generator creates SaaS starter projects, not configured cloud deployments. Each selected provider contributes placeholders in `.env.example`, dependency metadata where applicable, and a `backend/provider-guides/` setup note. No API key is generated or embedded.

| Area                                    | Skeleton status               | What is generated                                                                                                                                                                             |
| --------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript backend                      | COMPLETE                      | Fastify starter with layered config/domain/repository/service/provider/route folders, PostgreSQL starter repository, JWT/cookie auth, local file route, migration, Dockerfile, and tests.     |
| Python backend                          | COMPLETE                      | FastAPI/SQLAlchemy project layout with settings, models, schemas, auth helpers, routers, Dockerfile, and deployment starter.                                                                  |
| Go backend                              | COMPLETE                      | Idiomatic `cmd`/`internal` layout with config, domain, repository, storage boundary, session code, routes, and Dockerfile.                                                                    |
| Java backend                            | COMPLETE                      | Spring Boot starter with Maven, JPA domain/repository, JWT service, controller, configuration, and Dockerfile.                                                                                |
| PostgreSQL / Neon / MongoDB / Firestore | COMPLETE as skeletons         | Selected database variables and setup notes. Neon additionally includes pool/direct URL placeholders and `neon.ts` starter metadata; run migrations with the direct URL.                      |
| Local / S3 / GCS / Firebase Storage     | COMPLETE as skeletons         | Local upload implementation plus selected cloud SDK dependency/configuration and provider guide. Cloud credentials are supplied by the user.                                                  |
| SMTP / Twilio Email / Resend / SendGrid | COMPLETE as skeletons         | Correct environment placeholders and selected provider documentation. The `twilio` selection uses Twilio's first-party Email API credentials, not SendGrid.                                   |
| Stripe                                  | COMPLETE as skeleton          | Stripe SDK dependency, secret/webhook placeholders, and Checkout/webhook documentation note.                                                                                                  |
| Organizations                           | COMPLETE as skeleton          | Feature marker and service-layer design note. Persistence/invitation behavior is intentionally left for the SaaS author.                                                                      |
| React                                   | COMPLETE                      | Minimal Tailwind web client with typed API client and client tests.                                                                                                                           |
| Angular                                 | COMPLETE                      | Minimal standalone Angular client, Tailwind v4/PostCSS configuration, and cookie-based API service.                                                                                           |
| React Native                            | COMPLETE                      | Minimal Expo/React Native app using `expo-secure-store`; only `EXPO_PUBLIC_API_URL` is safe for the mobile bundle.                                                                            |
| CI                                      | COMPLETE for build validation | CI builds generator, then compiles one representative generated backend for each language and one representative generated frontend for each framework. It does not call external cloud APIs. |

## Build verification performed locally

```powershell
npm run build
npm test

# Generated Go backend
go mod tidy; go build ./cmd/api

# Generated Python backend
python -m pip install .; python -m compileall -q app

# Generated Angular frontend
npm install --no-audit --no-fund; npm run build

# Generated Expo frontend
npm install --no-audit --no-fund; npm run typecheck
```

The Java starter was also packaged successfully with Maven 3.9 / Temurin 21 in an isolated Docker container. Provider calls, real cloud credentials, native mobile builds, and end-to-end deployment are intentionally outside skeleton build validation.
