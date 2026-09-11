#!/usr/bin/env node
/**
 * One-time: obtain the YouTube Analytics refresh token as the channel owner.
 *
 *   node --env-file=.env.local scripts/youtube-oauth-token.mjs
 *
 * Needs GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET (a "Desktop app"
 * OAuth client in Google Cloud, with the YouTube Analytics API enabled). It
 * opens nothing itself: it prints a consent URL, you sign in as the channel
 * owner, Google redirects to this script's local listener, and the script
 * prints the refresh token once. Paste it into .env.local and Vercel as
 * YOUTUBE_REFRESH_TOKEN. Nothing is written to disk and nothing else is asked
 * for: the only scope is yt-analytics.readonly.
 */
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error(
    "Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env.local first.",
  );
  process.exit(1);
}

const port = Number(process.env.PORT ?? 8765);
const redirectUri = `http://localhost:${port}/callback`;
const state = randomBytes(16).toString("hex");

const consentUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
consentUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: "https://www.googleapis.com/auth/yt-analytics.readonly",
  access_type: "offline",
  prompt: "consent",
  state,
}).toString();

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", redirectUri);
  if (url.pathname !== "/callback") {
    response.writeHead(404).end();
    return;
  }
  if (url.searchParams.get("state") !== state) {
    response.writeHead(400).end("State mismatch. Start over.");
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    response
      .writeHead(400)
      .end(`Google said: ${url.searchParams.get("error") ?? "no code"}`);
    return;
  }
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const body = await tokenResponse.json();
  if (!tokenResponse.ok || !body.refresh_token) {
    response.writeHead(500).end("Token exchange failed; see the terminal.");
    console.error("Token exchange failed:", JSON.stringify(body).slice(0, 300));
    server.close();
    process.exit(1);
  }
  response.end("Done. Close this tab and return to the terminal.");
  console.log(
    "\nAdd this to .env.local and Vercel (Production), then run the connector once:\n",
  );
  console.log(`YOUTUBE_REFRESH_TOKEN=${body.refresh_token}\n`);
  server.close();
});

server.listen(port, () => {
  console.log(
    "1. Open this URL in a browser signed in as the YouTube channel owner:\n",
  );
  console.log(consentUrl.toString());
  console.log(
    `\n2. Approve read-only analytics access. Google will redirect to ${redirectUri}.`,
  );
});
