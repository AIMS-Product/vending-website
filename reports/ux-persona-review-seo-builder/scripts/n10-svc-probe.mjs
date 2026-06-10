import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = fs.readFileSync(".env.local","utf8").split("\n").reduce((a,l)=>{const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)a[m[1]]=m[2].replace(/^["']|["']$/g,"").replace(/\\n$/,"");return a;},{});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const slug = `n10-svcprobe-${Date.now()}`;
const { data: src, error } = await sb.from("seo_pages").insert({ slug, route_prefix:"/resources", route_path:`/resources/${slug}`, title:"N10 Svc Probe", status:"draft", draft_content:{version:1,sections:[]}, structured_data_settings:{breadcrumb:true,faq:true} }).select("id, slug, route_prefix, status").single();
if (error) { console.error("seed err", error); process.exit(1); }
console.log("seeded", src.slug);
// simulate the collision check the service does for the -copy candidate
const candidate = `${slug}-copy`;
const routePath = `/resources/${candidate}`;
const { data: hit, error: cErr } = await sb.from("seo_pages").select("id").eq("route_path", routePath).neq("status","archived").maybeSingle();
console.log("collision check for", routePath, "->", JSON.stringify({ hit, cErr: cErr?.message }));
// try the insert that adminCreateSeoPage would do
const { data: ins, error: iErr } = await sb.from("seo_pages").insert({ slug: candidate, route_prefix:"/resources", route_path: routePath, title:"Copy of N10 Svc Probe", status:"draft", draft_content:{version:1,sections:[]}, structured_data_settings:{breadcrumb:true,faq:true} }).select("id, slug").single();
console.log("insert copy ->", JSON.stringify({ ins, iErr: iErr?.message }));
// cleanup
for (const id of [src.id, ins?.id].filter(Boolean)) await sb.from("seo_pages").delete().eq("id", id);
console.log("cleaned up");
