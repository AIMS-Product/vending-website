export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_AFTER_LOGIN_PATH = "/admin/pages";
export const ADMIN_FORGOT_PASSWORD_PATH = "/admin/forgot-password";
export const ADMIN_RESET_PASSWORD_PATH = "/admin/reset-password";
export const AUTH_CALLBACK_PATH = "/auth/callback";

const safeAdminPathPattern = /^\/admin(\/|$)/;

export function buildPasswordResetRedirectUrl(origin: string) {
  const callback = new URL(AUTH_CALLBACK_PATH, origin.replace(/\/$/, ""));
  callback.searchParams.set("next", ADMIN_RESET_PASSWORD_PATH);
  return callback.toString();
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
