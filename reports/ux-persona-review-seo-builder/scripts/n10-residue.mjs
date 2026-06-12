import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = fs.readFileSync(".env.local","utf8").split("\n").reduce((a,l)=>{const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)a[m[1]]=m[2].replace(/^["']|["']$/g,"").replace(/\\n$/,"");return a;},{});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await sb.from("seo_pages").select("slug").like("slug","n10-%");
console.log("n10 residue pages:", JSON.stringify((data??[]).map(r=>r.slug)));
