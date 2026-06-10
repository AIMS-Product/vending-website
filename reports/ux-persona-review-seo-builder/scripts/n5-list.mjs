import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = fs.readFileSync(".env.local","utf8").split("\n").reduce((a,l)=>{const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)a[m[1]]=m[2].replace(/^["']|["']$/g,"").replace(/\\n$/,"");return a;},{});
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, key);
const { data, error } = await sb.from("redirects").select("id, source_path, destination_path, status_code, created_reason").order("created_at",{ascending:false});
if (error) { console.error(error); process.exit(1); }
console.log(JSON.stringify(data, null, 2));
