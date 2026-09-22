import 'dotenv/config';
import Fastify from 'fastify';
import Stripe from 'stripe';

const required = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const;
for (const key of required)
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: (process.env.STRIPE_API_VERSION ?? '2026-06-24.dahlia') as Stripe.LatestApiVersion,
});
const app = Fastify({ logger: true });

// Stripe signature verification must receive the unparsed request bytes.
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) =>
  done(null, body),
);
app.get('/health', async () => ({ status: 'ok' }));
app.post(process.env.STRIPE_WEBHOOK_PATH ?? '/create-sub', async (request, reply) => {
  const signature = request.headers['stripe-signature'];
  if (!signature || !Buffer.isBuffer(request.body))
    return reply.code(400).send({ error: 'Missing Stripe signature or raw body.' });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      request.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return reply.code(400).send({ error: 'Invalid Stripe webhook signature.' });
  }

  if (event.type === 'customer.subscription.created') {
    const subscription = event.data.object as Stripe.Subscription;
    // Replace this log with a durable, idempotent database upsert keyed by event.id
    // before enabling production subscription entitlements.
    request.log.info(
      { eventId: event.id, subscriptionId: subscription.id, customerId: subscription.customer },
      'subscription created',
    );
  }
  return reply.code(200).send({ received: true });
});

await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 8080) });
