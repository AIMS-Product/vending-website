import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
const env = fs.readFileSync(".env.local","utf8").split("\n").reduce((a,l)=>{const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)a[m[1]]=m[2].replace(/^["']|["']$/g,"").replace(/\\n$/,"");return a;},{});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const SHOTS = path.resolve("plans/seo-builder-ux-fixes/agent-runs/n10-screens");
const slug = `n10-probe-${Date.now()}`;
const { data: src } = await sb.from("seo_pages").insert({ slug, route_prefix:"/resources", route_path:`/resources/${slug}`, title:"N10 Probe List", status:"draft", draft_content:{version:1,sections:[]}, structured_data_settings:{breadcrumb:true,faq:true} }).select("id").single();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
const page = await ctx.newPage();
await page.goto("http://localhost:3002/admin/pages", { waitUntil:"networkidle", timeout:60000 });
const menus = page.locator(`details:has(form:has(input[name="id"][value="${src.id}"]):has(button:has-text("Duplicate page")))`);
const n = await menus.count();
console.log("menu count:", n);
for (let i=0;i<n;i++){ const s = menus.nth(i).locator("summary").first(); console.log(`menu ${i}: summary visible=${await s.isVisible()}, boundingBox=${JSON.stringify(await s.boundingBox())}`); }
// is the row even on this page?
const rowLink = page.locator(`a[href="/admin/pages/${src.id}"]`);
console.log("row link count:", await rowLink.count(), "visible:", await rowLink.first().isVisible().catch(()=>false));
await page.screenshot({ path: path.join(SHOTS,"probe-list.png"), fullPage:true });
await browser.close();
await sb.from("seo_pages").delete().eq("id", src.id);
console.log("done; cleaned", slug);
