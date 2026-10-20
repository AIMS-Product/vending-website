// Idempotent Stripe setup for the $5 First Location Playbook.
//   STRIPE_SECRET_KEY=... node scripts/playbook-guide/stripe-setup.mjs <webhook-url> [out-file]
// Finds or creates the product + $5 one-time price (tagged metadata.ltf=v2-pdf)
// and a webhook endpoint for <webhook-url> with exactly the events the app
// handles. Writes STRIPE_PLAYBOOK_PRICE_ID and, when it creates the endpoint,
// STRIPE_WEBHOOK_SECRET to [out-file] (mode 600). Never prints secrets.
import { writeFile } from "node:fs/promises";
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
const webhookUrl = process.argv[2];
const outFile = process.argv[3] ?? "/tmp/ltf-stripe.env";
if (!key || !webhookUrl) {
  console.error(
    "usage: STRIPE_SECRET_KEY=... node stripe-setup.mjs <webhook-url> [out-file]",
  );
  process.exit(1);
}
const stripe = new Stripe(key);
const TAG = { ltf: "v2-pdf" };
const EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "payment_intent.payment_failed",
  "charge.refunded",
];

const account = await stripe.accounts.retrieve();
console.log(
  `account ${account.id} (${account.settings?.dashboard?.display_name}) mode=${key.startsWith("sk_live") ? "LIVE" : "test"}`,
);

const found = await stripe.products.search({
  query: "metadata['ltf']:'v2-pdf' AND active:'true'",
});
const product =
  found.data[0] ??
  (await stripe.products.create({
    name: "The First Location Playbook",
    description:
      "Mike Hoffmann's eight-play PDF to find, pitch, sign and stock your first vending location.",
    metadata: TAG,
  }));
console.log(`product ${product.id}`);

const prices = await stripe.prices.list({
  product: product.id,
  active: true,
  limit: 10,
});
const price =
  prices.data.find(
    (p) =>
      p.unit_amount === 500 && p.currency === "usd" && p.type === "one_time",
  ) ??
  (await stripe.prices.create({
    product: product.id,
    unit_amount: 500,
    currency: "usd",
    metadata: TAG,
  }));
console.log(
  `price ${price.id} ($${price.unit_amount / 100} ${price.currency})`,
);

const lines = [`STRIPE_PLAYBOOK_PRICE_ID=${price.id}`];
const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
const existing = endpoints.data.find((e) => e.url === webhookUrl);
if (existing) {
  await stripe.webhookEndpoints.update(existing.id, {
    enabled_events: EVENTS,
    disabled: false,
  });
  console.log(
    `webhook ${existing.id} exists; events updated. Its secret was only shown at creation.`,
  );
} else {
  const created = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: EVENTS,
    description: "Vendingpreneurs $5 First Location Playbook",
    metadata: TAG,
  });
  lines.push(`STRIPE_WEBHOOK_SECRET=${created.secret}`);
  console.log(
    `webhook ${created.id} created for ${new URL(webhookUrl).host}${new URL(webhookUrl).pathname}`,
  );
}
await writeFile(outFile, `${lines.join("\n")}\n`, { mode: 0o600 });
console.log(
  `wrote ${lines.map((l) => l.split("=")[0]).join(", ")} to ${outFile}`,
);
