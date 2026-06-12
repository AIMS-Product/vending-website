import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = fs.readFileSync(".env.local","utf8").split("\n").reduce((a,l)=>{const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)a[m[1]]=m[2].replace(/^["']|["']$/g,"").replace(/\\n$/,"");return a;},{});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const probe = "e01448f7-1424-4f6a-8c7f-d076bde35efd";
const { data: revs } = await sb.from("page_revisions").select("revision_type, label").eq("page_id", probe);
const { data: page } = await sb.from("seo_pages").select("slug,status,title").eq("id", probe).maybeSingle();
console.log("probe page:", JSON.stringify(page), "remaining revisions:", JSON.stringify(revs));
// list any other n9-* test pages left behind
const { data: leftover } = await sb.from("seo_pages").select("id,slug").like("slug","n9-%");
console.log("leftover n9-* pages:", JSON.stringify(leftover));
