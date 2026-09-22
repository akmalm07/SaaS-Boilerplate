# Cloud Run Stripe webhook implementation

This implementation is intentionally outside `src/templates/`, so its Stripe configuration never becomes part of the general generator.

It validates a Stripe signature on the raw request body at `POST /create-sub`, using API version `2026-06-24.dahlia`, and handles `customer.subscription.created`.

## Run locally

Copy `.env.example` to `.env`, set the two Stripe secrets, then run:

```sh
npm install
npm run build
npm start
```

## Cloud Run hand-off

This directory is a standalone container context. Point the Cloud Run/Cloud
Build GitHub connection at `implementations/cloud-run-typescript`, build its
`Dockerfile`, and expose port `8080`. Store `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` in Secret Manager and mount them as runtime environment
variables; do not commit a `.env` file. `cloudbuild.yaml` documents the service
and secret-name substitutions for a Cloud Build-based deployment.

For a production subscription system, replace the marked log statement with a database upsert that has a unique constraint on `stripe_event_id`. A Cloud Run process-local set is not durable and is not sufficient for Stripe's at-least-once webhook delivery.

## Cloud Run

Build from this directory's `Dockerfile`. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` using Secret Manager, not repository files or Cloud Build substitutions. Configure Stripe to call your deployed URL plus `/create-sub` and subscribe to `customer.subscription.created`.
