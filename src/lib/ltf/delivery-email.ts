import "server-only";
import { sendResend } from "@/lib/chatbot/emails";
import { config } from "@/lib/config";
import type { DeliveryEmail, SendDeliveryEmail } from "@/lib/ltf/orders";
import { GUIDE, GUIDE_CLOSER_CALENDLY } from "@/lib/content/playbook-guide";

const CONSULT_URL = `${GUIDE_CLOSER_CALENDLY}?utm_source=playbook-guide&utm_medium=email&utm_campaign=ltf-v2`;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function buildDeliveryEmail(email: DeliveryEmail, recoverUrl: string) {
  const subject = `Your copy of ${GUIDE.title}`;
  const text = [
    "Thanks for grabbing the playbook.",
    `Download it here: ${email.downloadUrl}`,
    "The link is yours to keep. Each play has one of Mike's videos and an assignment. Do the assignment before you move to the next play.",
    `Serious about starting? Book a free 1-on-1 consultation with our team: ${CONSULT_URL}`,
    `Lost this email later? Get a fresh link any time: ${recoverUrl}`,
    `Questions? Reply to this email.\n\nMike Hoffmann\nVendingpreneurs`,
  ].join("\n\n");

  const link = escapeHtml(email.downloadUrl);
  const html = `<!DOCTYPE html>
<html><body style="margin:0;background:#eaf6ff;font-family:Arial,Helvetica,sans-serif;color:#111111;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eaf6ff;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:2px solid #111111;">
<tr><td style="padding:28px 28px 8px;">
<p style="margin:0;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#1f72a5;">Your download is ready</p>
<h1 style="margin:10px 0 0;font-size:28px;line-height:1.1;text-transform:uppercase;font-family:Impact,'Anton',Arial Black,sans-serif;font-weight:400;">${escapeHtml(GUIDE.title)}</h1>
<p style="margin:16px 0 0;font-size:16px;line-height:1.5;">Thanks for grabbing the playbook. Each play has one of Mike's videos and an assignment. Do the assignment before you move to the next play.</p>
</td></tr>
<tr><td style="padding:20px 28px;">
<a href="${link}" style="display:inline-block;background:#3aa5e3;color:#111111;border:2px solid #111111;padding:14px 22px;font-size:16px;font-weight:900;text-transform:uppercase;text-decoration:none;">Download the playbook (PDF)</a>
<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:#444;">Button not working? Copy this link:<br><a href="${link}" style="color:#1f72a5;word-break:break-all;">${link}</a></p>
</td></tr>
<tr><td style="padding:0 28px 24px;">
<div style="background:#eaf6ff;border:2px solid #111111;padding:16px 18px;">
<p style="margin:0;font-size:15px;font-weight:900;">Serious about starting?</p>
<p style="margin:6px 0 12px;font-size:14px;line-height:1.5;">Book a free 1-on-1 consultation and we'll map your first location together.</p>
<a href="${escapeHtml(CONSULT_URL)}" style="color:#1f72a5;font-weight:900;">Pick a time</a>
</div>
</td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;line-height:1.5;color:#444;border-top:2px solid #111111;">
<p style="margin:16px 0 0;">The link is yours to keep. Lost this email? <a href="${escapeHtml(recoverUrl)}" style="color:#1f72a5;">Get a fresh link</a>. Questions? Just reply.</p>
<p style="margin:12px 0 0;">Mike Hoffmann<br>Vendingpreneurs</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { subject, text, html };
}

/** Resend sender for the delivery and recovery emails. */
export function resendDeliverySender(siteOrigin: string): SendDeliveryEmail {
  return async (email) => {
    if (!config.RESEND_API_KEY) {
      return { ok: false, error: "RESEND_API_KEY is not set" };
    }
    const content = buildDeliveryEmail(
      email,
      `${siteOrigin}/playbook/guide-access`,
    );
    return sendResend(
      {
        ...content,
        to: [email.to],
        fromName: "Mike Hoffmann",
        replyTo: config.LTF_SUPPORT_EMAIL ? [config.LTF_SUPPORT_EMAIL] : [],
      },
      fetch,
    );
  };
}
