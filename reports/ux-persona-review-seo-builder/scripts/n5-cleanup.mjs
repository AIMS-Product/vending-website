import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = fs.readFileSync(".env.local","utf8").split("\n").reduce((a,l)=>{const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)a[m[1]]=m[2].replace(/^["']|["']$/g,"").replace(/\\n$/,"");return a;},{});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from("redirects").delete().like("source_path", "/resources/n5-control-%").select("source_path");
if (error) { console.error(error); process.exit(1); }
console.log("deleted control rows:", JSON.stringify(data));
const { data: rest } = await sb.from("redirects").select("source_path");
console.log("remaining redirects:", JSON.stringify(rest));
