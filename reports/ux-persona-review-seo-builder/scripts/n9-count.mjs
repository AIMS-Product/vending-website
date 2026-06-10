import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = fs.readFileSync(".env.local","utf8").split("\n").reduce((a,l)=>{const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)a[m[1]]=m[2].replace(/^["']|["']$/g,"").replace(/\\n$/,"");return a;},{});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { count: pages } = await sb.from("seo_pages").select("id",{count:"exact",head:true});
const { count: revs } = await sb.from("page_revisions").select("id",{count:"exact",head:true});
const { data: sample } = await sb.from("seo_pages").select("slug,status,title").limit(20);
console.log("seo_pages count:", pages, "page_revisions count:", revs);
console.log("sample:", JSON.stringify(sample,null,2));
