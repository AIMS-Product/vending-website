#!/usr/bin/env node
// Renders every chatbot email template with realistic sample data and prints
// the exact Resend payload each one would send — from, to, reply-to,
// subject, body — without making a network call. Written for the 2026-08-24
// email-polish pass (see .claude/specs/2026-08-21-chatbot-v2-HANDOFF.md item
// 1) so the copy can be read and signed off before RESEND_API_KEY lands.
//
// Run: node scripts/chatbot-email-preview.mjs
//
// Same server-only shim + jiti loading as scripts/chatbot-smoke.mjs — see
// that file for why. This script never touches Supabase: every email sender
// here is a pure function of its input plus env, so a fake fetch is enough.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

ensureServerOnlyShim(root);
loadEnvLocal(root);

// Preview-only env: makes hasResendConfig() true and exercises the real
// from-address chain (LEAD_NOTIFICATION_FROM -> RESEND_FROM_EMAIL ->
// hardcoded default) without requiring a real Resend key. Never overrides a
// value already loaded from .env.local.
process.env.RESEND_API_KEY ??= "re_preview_dummy_key";
process.env.LEAD_NOTIFICATION_FROM ??=
  "Vendingpreneurs <hello@vendingpreneurs.com>";
process.env.LEAD_NOTIFICATION_TO ??= "team@vendingpreneurs.com";
process.env.NEXT_PUBLIC_SITE_URL ??= "https://www.vendingpreneurs.com";

const { createJiti } = await import("jiti");
// jsx: true — emails.ts pulls in chatbot/config.ts, which pulls in
// parse-chat-links.tsx (real JSX, for the transcript link renderer). Without
// this jiti's default TS-only parser rejects the JSX syntax outright.
const jiti = createJiti(root, {
  alias: { "@": path.join(root, "src") },
  jsx: true,
});
async function importLib(relativePath) {
  return jiti.import(path.join(root, relativePath));
}

const { sendChatbotResourceEmail, sendChatbotProfileEmail, sendChatbotDigestEmail } =
  await importLib("src/lib/chatbot/emails.ts");
const { DEFAULT_CHATBOT_CONFIG } = await importLib("src/lib/chatbot/config.ts");

const routedConfig = {
  ...DEFAULT_CHATBOT_CONFIG,
  leadRoutingEmails: "sales@vendingpreneurs.com",
};

let previewCount = 0;

/**
 * Fake Resend endpoint: captures the payload, prints it as one delimited
 * JSON block, sends nothing. JSON (not the old hand-indented text dump) so a
 * "===" heading or a blank line inside the email body can never be mistaken
 * for a script section separator — every byte of the actual subject/text/
 * html is inside quoted JSON string values. If an html part is present it's
 * also written to a small /tmp file so it can be opened in a browser.
 */
function previewFetch() {
  return async (_url, init) => {
    const body = JSON.parse(init.body);
    previewCount += 1;
    console.log("--- RESEND PAYLOAD (not email content until the closing marker) ---");
    console.log(
      JSON.stringify(
        {
          from: body.from,
          to: body.to,
          reply_to: body.reply_to ?? null,
          subject: body.subject,
          text: body.text,
          html: body.html ?? null,
        },
        null,
        2,
      ),
    );
    console.log("--- END RESEND PAYLOAD ---");
    if (body.html) {
      const htmlPath = path.join(os.tmpdir(), `chatbot-email-preview-${previewCount}.html`);
      fs.writeFileSync(htmlPath, body.html);
      console.log(`html rendered to: ${htmlPath}`);
    }
    return new Response(null, { status: 200 });
  };
}

function heading(title) {
  console.log(`\n>>> SCRIPT SECTION (not email content): ${title}`);
}

// --- 1. Lead-facing resource email, WITH a prospect profile (the common
//        shape once the digest cron has extracted one; also the best
//        showcase of the personalized opener). ---------------------------
heading("LEAD-FACING: send_resources_email — with a prospect profile");
await sendChatbotResourceEmail(
  {
    to: "jordan.rivera@example.com",
    visitorName: "Jordan",
    personaName: "Mia",
    resources: [
      {
        key: "roadmap",
        title: "The 90-Day Vending Route Roadmap",
        blurb:
          "The free 90-day plan: pick a machine, land the first location, launch and scale.",
        url: "/resources/roadmap",
      },
      {
        key: "finance_templates",
        title: "Vending Machine Profit Worksheet",
        blurb:
          "A self-calculating P&L, cash flow, and balance sheet workbook for a vending route.",
        url: "/resources/finance-templates",
      },
    ],
    bookingUrl:
      "https://calendly.com/d/cxv9-jg6-m53/vending-accelerator-call?utm_source=chatbot&utm_medium=site_chat&utm_content=conv-preview",
    profile: {
      name: "Jordan Rivera",
      email: "jordan.rivera@example.com",
      phone: null,
      current_work: "managing a retail store",
      capital_signal: "has about $15k saved",
      timeline: "wants to start in the next 60 days",
      state_or_market: "Ohio",
      motivation: "wants out of retail management",
      objections: [],
      resources_wanted: ["roadmap", "finance_templates"],
      call_intent: false,
      sentiment: "engaged",
      follow_up_needed: true,
      summary: "Retail manager in Ohio, ~$15k saved, wants to start in 60 days.",
    },
  },
  routedConfig,
  { fetchImpl: previewFetch() },
);

// --- 2. Lead-facing resource email, WITHOUT a profile yet (extraction runs
//        later on idle, so this is actually the more common real case). --
heading("LEAD-FACING: send_resources_email (case study) - no profile extracted yet");
const evanCaseStudy = {
  key: "case_study:evan-tomahong",
  title: "Evan Tomahong: 40 machines in 18 months",
  blurb: "Was a line cook before starting a route.",
  url: "/case-studies/evan-tomahong",
};
await sendChatbotResourceEmail(
  {
    to: "sam.taylor@example.com",
    visitorName: null,
    personaName: "Mia",
    resources: [evanCaseStudy],
    bookingUrl: null,
    profile: null,
  },
  routedConfig,
  { fetchImpl: previewFetch() },
);

// --- 2b. Same case-study send, WITH a profile (a teacher) — the showcase
//         for the personal connector line + Mia-voice subject (item 3 of the
//         2026-08-24 polish pass). -----------------------------------------
heading("LEAD-FACING: send_resources_email (case study) - teacher profile");
await sendChatbotResourceEmail(
  {
    to: "casey.teacher@example.com",
    visitorName: "Casey",
    personaName: "Mia",
    resources: [evanCaseStudy],
    bookingUrl:
      "https://calendly.com/d/cxv9-jg6-m53/vending-accelerator-call?utm_source=chatbot&utm_medium=site_chat&utm_content=conv-preview",
    profile: {
      name: "Casey Morgan",
      email: "casey.teacher@example.com",
      phone: null,
      current_work: "teaching high school",
      capital_signal: "has about $8k saved",
      timeline: "wants to start next summer",
      state_or_market: "Arizona",
      motivation: "wants income outside the classroom",
      objections: [],
      resources_wanted: ["case_study:evan-tomahong"],
      call_intent: false,
      sentiment: "curious",
      follow_up_needed: true,
      summary: "High school teacher in Arizona, ~$8k saved, exploring a route for next summer.",
    },
  },
  routedConfig,
  { fetchImpl: previewFetch() },
);

// --- 3. Team-facing single-conversation profile email. -------------------
heading("TEAM: profile email (single conversation)");
await sendChatbotProfileEmail(
  {
    conversationId: "11111111-1111-4111-8111-111111111111",
    capturedName: "Jordan Rivera",
    capturedEmail: "jordan.rivera@example.com",
    capturedPhone: "555-0142",
    callBooked: false,
    bookingUrl:
      "https://calendly.com/d/cxv9-jg6-m53/vending-accelerator-call?utm_source=chatbot&utm_medium=site_chat&utm_content=conv-preview",
    profile: {
      name: "Jordan Rivera",
      email: "jordan.rivera@example.com",
      phone: "555-0142",
      current_work: "managing a retail store",
      capital_signal: "has about $15k saved",
      timeline: "wants to start in the next 60 days",
      state_or_market: "Ohio",
      motivation: "wants out of retail management",
      objections: ["worried about time commitment"],
      resources_wanted: ["roadmap", "finance_templates"],
      call_intent: true,
      sentiment: "engaged",
      follow_up_needed: true,
      summary: "Retail manager in Ohio, ~$15k saved, wants to start in 60 days.",
    },
  },
  routedConfig,
  { fetchImpl: previewFetch() },
);

// --- 4. Team-facing catch-up digest, hot-to-cold with a call-now block. --
heading("TEAM: catch-up digest (call-now block + everyone else)");
await sendChatbotDigestEmail(
  {
    profiles: [
      {
        conversationId: "22222222-2222-4222-8222-222222222222",
        capturedName: "Priya Nandan",
        capturedEmail: "priya@example.com",
        capturedPhone: "555-0199",
        callBooked: false,
        bookingUrl: "https://calendly.com/d/abc/vending-accelerator-call",
        profile: {
          name: "Priya Nandan",
          email: "priya@example.com",
          phone: "555-0199",
          current_work: "software sales",
          capital_signal: "has $40k ready to deploy",
          timeline: "ready now",
          state_or_market: "Texas",
          motivation: "wants a second income stream",
          objections: [],
          resources_wanted: [],
          call_intent: true,
          sentiment: "very engaged",
          follow_up_needed: true,
          summary: "Software sales rep, $40k ready, wants to move immediately.",
        },
      },
      {
        conversationId: "11111111-1111-4111-8111-111111111111",
        capturedName: "Jordan Rivera",
        capturedEmail: "jordan.rivera@example.com",
        capturedPhone: null,
        callBooked: false,
        bookingUrl: "https://calendly.com/d/abc/vending-accelerator-call",
        profile: {
          name: "Jordan Rivera",
          email: "jordan.rivera@example.com",
          phone: null,
          current_work: "managing a retail store",
          capital_signal: "has about $15k saved",
          timeline: "60 days",
          state_or_market: "Ohio",
          motivation: "wants out of retail management",
          objections: [],
          resources_wanted: ["roadmap"],
          call_intent: false,
          sentiment: "engaged",
          follow_up_needed: false,
          summary: "Retail manager, wants to start in 60 days.",
        },
      },
    ],
  },
  routedConfig,
  { fetchImpl: previewFetch() },
);

function ensureServerOnlyShim(projectRoot) {
  const dir = path.join(projectRoot, "node_modules", "server-only");
  if (fs.existsSync(path.join(dir, "index.js"))) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "server-only", version: "0.0.1", main: "index.js" }),
  );
  fs.writeFileSync(path.join(dir, "index.js"), "module.exports = {};\n");
}

function loadEnvLocal(projectRoot) {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    console.warn("chatbot-email-preview: could not load .env.local", error.message);
  }
}
