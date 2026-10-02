export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness probe for an uptime monitor. It answers 200 as long as the app can
 * serve a request. It deliberately touches no database, third-party service or
 * secret, so it is free to poll every minute and cannot be used to probe
 * anything. A passing probe says "the deployment is up", not "leads are
 * flowing"; docs/RUNBOOK.md section 5 lists the signals for that.
 *
 * `sha` is the short git commit of the running deployment (public in the repo)
 * so an incident can be matched to a release at a glance.
 */
function body() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return {
    ok: true,
    sha: sha ? sha.slice(0, 7) : null,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
  };
}

const headers = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex",
};

export function GET() {
  return Response.json(body(), { headers });
}

export function HEAD() {
  return new Response(null, { status: 200, headers });
}
