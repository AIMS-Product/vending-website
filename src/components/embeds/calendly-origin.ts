/**
 * Calendly's embed posts from calendly.com and its subdomains (assets.,
 * widget. etc). Exact https origin only: rejects lookalikes such as
 * evilcalendly.com, calendly.com.evil.io and plain http.
 */
const CALENDLY_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*calendly\.com$/;

export function isCalendlyOrigin(origin: string): boolean {
  return CALENDLY_ORIGIN.test(origin);
}
