export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_AFTER_LOGIN_PATH = "/admin/pages";
export const ADMIN_FORGOT_PASSWORD_PATH = "/admin/forgot-password";
export const ADMIN_RESET_PASSWORD_PATH = "/admin/reset-password";
export const AUTH_CALLBACK_PATH = "/auth/callback";

const safeAdminPathPattern = /^\/admin(\/|$)/;
const emailParamPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const expiredLinkErrorMessagePattern = /\b(invalid|expired)\b/;

export function normalizeAdminEmailParam(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  if (!email || email.length > 254 || !emailParamPattern.test(email)) {
    return "";
  }

  return email;
}

export function adminPathWithEmail(
  path: string,
  email: string | null | undefined,
) {
  const normalizedEmail = normalizeAdminEmailParam(email);
  if (!normalizedEmail) return path;

  const url = new URL(path, "https://admin.local");
  url.searchParams.set("email", normalizedEmail);
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Resolve the origin that goes into a Supabase auth email (password reset,
 * user invite, resend setup).
 *
 * The request `Host` / `X-Forwarded-Host` headers are attacker-controlled: a
 * POST to the forgot-password action carrying `X-Forwarded-Host: evil.tld`
 * would otherwise generate a recovery email pointing at the attacker, and an
 * admin clicking it hands over a one-time code that exchanges for a session.
 *
 * So the header is treated as a *claim* to be checked, never as the answer.
 * Only the configured site host, the platform-injected deployment host, and
 * localhost outside production are honored; anything else falls back to the
 * configured site URL, which is always safe if less convenient.
 */
export function resolveAuthEmailOrigin({
  host,
  proto,
  siteUrl,
  deploymentHost,
  isProduction,
}: {
  host?: string | null;
  proto?: string | null;
  siteUrl: string;
  deploymentHost?: string | null;
  isProduction: boolean;
}): string {
  const configured = parseOrigin(siteUrl);
  if (!configured) {
    throw new Error("Site URL is not a valid origin");
  }
  if (!host) return configured.origin;

  const candidate = parseOrigin(`${proto ?? "https"}://${host}`);
  if (!candidate) return configured.origin;

  const allowed = new Set<string>([configured.host]);
  // Set by the platform, not by the caller, so it is safe to trust.
  if (deploymentHost) {
    const deployment = parseOrigin(`https://${deploymentHost}`);
    if (deployment) allowed.add(deployment.host);
  }
  if (!isProduction) {
    allowed.add("localhost");
  }

  const hostname = candidate.hostname;
  const matches =
    allowed.has(candidate.host) ||
    (!isProduction && (hostname === "localhost" || hostname === "127.0.0.1"));

  return matches ? candidate.origin : configured.origin;
}

function parseOrigin(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

export function buildPasswordResetRedirectUrl(
  origin: string,
  email?: string | null,
) {
  const callback = new URL(AUTH_CALLBACK_PATH, origin.replace(/\/$/, ""));
  const resetPath = adminPathWithEmail(ADMIN_RESET_PASSWORD_PATH, email);
  callback.searchParams.set("next", resetPath);

  const normalizedEmail = normalizeAdminEmailParam(email);
  if (normalizedEmail) {
    callback.searchParams.set("email", normalizedEmail);
  }

  return callback.toString();
}

export function normalizeRecoveryNextPath(
  value: string | null | undefined,
  fallbackEmail?: string | null,
) {
  const candidate = value?.trim();
  let email = normalizeAdminEmailParam(fallbackEmail);

  if (candidate && candidate.startsWith("/") && !candidate.startsWith("//")) {
    try {
      const url = new URL(candidate, "https://admin.local");
      if (
        url.origin === "https://admin.local" &&
        url.pathname === ADMIN_RESET_PASSWORD_PATH
      ) {
        email =
          normalizeAdminEmailParam(url.searchParams.get("email")) || email;
      }
    } catch {
      // Ignore malformed callback next values and fall back to the reset form.
    }
  }

  return adminPathWithEmail(ADMIN_RESET_PASSWORD_PATH, email);
}

export function normalizeAdminNextPath(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate || candidate.startsWith("//") || !candidate.startsWith("/")) {
    return ADMIN_AFTER_LOGIN_PATH;
  }

  let url: URL;
  try {
    url = new URL(candidate, "http://admin.local");
  } catch {
    return ADMIN_AFTER_LOGIN_PATH;
  }

  if (
    url.origin !== "http://admin.local" ||
    !safeAdminPathPattern.test(url.pathname) ||
    url.pathname === ADMIN_LOGIN_PATH ||
    url.pathname === ADMIN_FORGOT_PASSWORD_PATH ||
    url.pathname === ADMIN_RESET_PASSWORD_PATH
  ) {
    return ADMIN_AFTER_LOGIN_PATH;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function supabaseAuthErrorRedirectPath(params: URLSearchParams) {
  const error = params.get("error")?.toLowerCase() ?? "";
  const errorCode = params.get("error_code")?.toLowerCase() ?? "";
  const description = params.get("error_description")?.toLowerCase() ?? "";

  if (
    errorCode === "otp_expired" ||
    (error === "access_denied" &&
      description.includes("email link") &&
      expiredLinkErrorMessagePattern.test(description))
  ) {
    return `${ADMIN_FORGOT_PASSWORD_PATH}?error=exchange_failed`;
  }

  return null;
}

export function supabaseAuthErrorRedirectPathFromUrlParts(
  search: string,
  hash = "",
) {
  const queryRedirect = supabaseAuthErrorRedirectPath(
    new URLSearchParams(search.startsWith("?") ? search.slice(1) : search),
  );
  if (queryRedirect) return queryRedirect;

  return supabaseAuthErrorRedirectPath(
    new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash),
  );
}

export function authErrorMessage(errorCode: string | null | undefined) {
  switch (errorCode) {
    case "missing_code":
      return "That reset link could not be used. Request a new password reset.";
    case "exchange_failed":
      return "That reset link expired or was already used. Request a new password reset.";
    default:
      return null;
  }
}
