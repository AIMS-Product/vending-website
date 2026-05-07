export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_AFTER_LOGIN_PATH = "/admin/pages";
export const AUTH_CALLBACK_PATH = "/auth/callback";

const safeAdminPathPattern = /^\/admin(\/|$)/;

export type MagicLinkHashTokens = {
  accessToken: string;
  refreshToken: string;
};

export function buildMagicLinkRedirectUrl(origin: string) {
  return `${origin.replace(/\/$/, "")}${ADMIN_LOGIN_PATH}`;
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
    url.pathname === ADMIN_LOGIN_PATH
  ) {
    return ADMIN_AFTER_LOGIN_PATH;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function extractMagicLinkHashTokens(
  hash: string,
): MagicLinkHashTokens | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function buildCodeExchangeUrl(currentUrl: string) {
  const url = new URL(currentUrl);
  const code = url.searchParams.get("code");
  if (!code) return null;

  const callback = new URL(AUTH_CALLBACK_PATH, url.origin);
  callback.searchParams.set("code", code);
  callback.searchParams.set(
    "next",
    normalizeAdminNextPath(url.searchParams.get("next")),
  );

  return callback.toString();
}

export function authErrorMessage(errorCode: string | null | undefined) {
  switch (errorCode) {
    case "missing_code":
      return "That sign-in link could not be used. Try requesting a new link.";
    case "exchange_failed":
      return "That sign-in link expired or was already used. Request a new link.";
    default:
      return null;
  }
}
