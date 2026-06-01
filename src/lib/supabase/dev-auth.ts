import type { AdminContext } from "./auth";

const enabledValues = new Set(["1", "true", "yes"]);
let warnedAboutDevBypass = false;
let warnedAboutRejectedDevBypass = false;

const devAdminContext: AdminContext = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "dev-admin@dev.invalid",
  },
  role: "super_admin",
};

export function isDevAdminAuthBypassEnabled() {
  const flagEnabled = enabledValues.has(
    (process.env.ADMIN_DEV_AUTH_BYPASS ?? "").trim().toLowerCase(),
  );

  if (!flagEnabled) return false;

  if (process.env.NODE_ENV !== "development") {
    if (!warnedAboutRejectedDevBypass) {
      console.warn(
        "ADMIN_DEV_AUTH_BYPASS is set outside development and has been ignored.",
      );
      warnedAboutRejectedDevBypass = true;
    }
    return false;
  }

  if (!warnedAboutDevBypass) {
    console.warn(
      "ADMIN_DEV_AUTH_BYPASS is active. Admin auth is bypassed for local development only.",
    );
    warnedAboutDevBypass = true;
  }

  return true;
}

export function getDevAdminContext() {
  return isDevAdminAuthBypassEnabled() ? devAdminContext : null;
}
