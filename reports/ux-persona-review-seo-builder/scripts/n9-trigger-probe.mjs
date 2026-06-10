import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = fs.readFileSync(".env.local","utf8").split("\n").reduce((a,l)=>{const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)a[m[1]]=m[2].replace(/^["']|["']$/g,"").replace(/\\n$/,"");return a;},{});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const c = { version: 1, sections: [] };
const { data: page, error: pe } = await sb.from("seo_pages").insert({ slug:`n9-probe-${Date.now()}`, route_prefix:"/resources", route_path:`/resources/n9-probe-${Date.now()}`, title:"probe", status:"draft", draft_content:c, structured_data_settings:{breadcrumb:true,faq:true} }).select("id").single();
if (pe) { console.error("page insert err", pe); process.exit(1); }
const { data: rev } = await sb.from("page_revisions").insert({ page_id: page.id, revision_type:"publish", label:"probe pub", content_snapshot:c, seo_snapshot:{} }).select("id").single();
// try delete the protected revision directly
const del = await sb.from("page_revisions").delete().eq("id", rev.id).select("id");
console.log("direct delete result:", JSON.stringify({ data: del.data, error: del.error?.message }));
// try delete page (should be FK-blocked while revision exists)
const delPage = await sb.from("seo_pages").delete().eq("id", page.id).select("id");
console.log("page delete (rev still there):", JSON.stringify({ data: delPage.data, error: delPage.error?.message }));
console.log("LEFTOVER page", page.id, "rev", rev.id);
