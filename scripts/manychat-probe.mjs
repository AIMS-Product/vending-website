/**
 * Read-only ManyChat probe, one pass per account (Mike, Anthony).
 *
 * Calls page/getInfo, page/getCustomFields and page/getTags with each
 * account's key and prints what the account holds. Raw responses are written
 * to tmp/manychat-probe/<account>-<endpoint>.json before parsing: ManyChat
 * bodies carry raw control characters that terminal filters truncate.
 *
 *   node scripts/manychat-probe.mjs
 */
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const ACCOUNTS = { mike: "MANYCHAT_API_KEY_MIKE", anthony: "MANYCHAT_API_KEY_ANTHONY" };
const OUT = "tmp/manychat-probe";
fs.mkdirSync(OUT, { recursive: true });

async function get(account, key, path) {
  const response = await fetch(`https://api.manychat.com/fb/${path}`, {
    headers: { authorization: `Bearer ${key}`, accept: "application/json" },
  });
  const text = await response.text();
  fs.writeFileSync(`${OUT}/${account}-${path.replace(/\W+/g, "_")}.json`, text);
  if (!response.ok) throw new Error(`${account} ${path} answered ${response.status}: ${text.slice(0, 200)}`);
  // Strip control characters JSON forbids inside strings before parsing.
  const json = JSON.parse(text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""));
  if (json.status !== "success") throw new Error(`${account} ${path} status ${json.status}`);
  return json.data;
}

let failed = false;
for (const [account, envName] of Object.entries(ACCOUNTS)) {
  const key = env[envName];
  if (!key) {
    console.error(`${account}: ${envName} missing from .env.local`);
    failed = true;
    continue;
  }
  try {
    const page = await get(account, key, "page/getInfo");
    const fields = await get(account, key, "page/getCustomFields");
    const tags = await get(account, key, "page/getTags");
    console.log(`\n== ${account}: ${page.name} (page ${page.id}, pro=${page.is_pro})`);
    console.log(`custom fields (${fields.length}): ${fields.map((f) => `${f.name}[${f.type}]#${f.id}`).join(", ")}`);
    console.log(`tags (${tags.length}): ${tags.map((t) => t.name).join(" | ")}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
