#!/usr/bin/env node
/**
 * Fire one sample lead at a partner's GoHighLevel inbound webhook.
 *
 * GHL's Inbound Webhook trigger builds its field mapping from a request it has
 * actually received: their ops team clicks "Test Trigger", picks our sample
 * from the list, and maps from there. So this is a required setup step for
 * them, not just a check for us.
 *
 *   node scripts/ghl-forward-test.mjs <webhook-url> [--application]
 *
 * The sample is a real-shaped booking submission with obviously fake contact
 * details. Pass --application to send the longer application form instead.
 */

const [url, ...flags] = process.argv.slice(2);

if (!url) {
  console.error(
    "Usage: node scripts/ghl-forward-test.mjs <webhook-url> [--application]",
  );
  process.exit(1);
}

const application = flags.includes("--application");

const payload = {
  first_name: "Sample",
  last_name: "Lead (test)",
  email: `wescale-test-${Date.now()}@vendingpreneurs-test.com`,
  phone: "+15415550123",
  submitted_at: new Date().toISOString(),
  form_type: application ? "application" : "booking",
  source_page: application ? "/" : "/booking-youtube",
  utm_source: "youtube",
  utm_medium: "video",
  utm_campaign: "buy-first-machine",
  utm_term: null,
  utm_content: "desc-link-1",
  gclid: null,
  fbclid: null,
  city: application ? "Phoenix" : null,
  state: application ? "Arizona" : null,
  business_stage: application ? "Researching vending" : null,
  budget: application ? "$5k-$10k" : null,
  timeline: application ? "Immediately" : null,
  message: null,
};

const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const body = await response.text().catch(() => "");
console.log(`${response.status} ${response.statusText}`);
if (body) console.log(body.slice(0, 500));
console.log("\nSent:");
console.log(JSON.stringify(payload, null, 2));

process.exit(response.ok ? 0 : 1);
