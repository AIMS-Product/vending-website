import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL, KEY=env.SUPABASE_SERVICE_ROLE_KEY;
const H={apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'};
const DAY='2026-09-14';
const FILTER=`day=eq.${DAY}&leads=is.null&showed=is.null&won=is.null&booked=gt.0`;
const mode=process.argv[2];
if(mode==='backup'){
  const r=await fetch(`${URL}/rest/v1/channel_daily?select=*&${FILTER}`,{headers:H});
  const rows=await r.json();
  fs.writeFileSync('/private/tmp/claude-501/-Users-adamwolfe/7b039b12-c25d-4624-b753-7cd72914fccb/scratchpad/channel_daily-20260914-backup.json',JSON.stringify(rows,null,1));
  console.log('backed up rows:',rows.length,'booked sum:',rows.reduce((s,x)=>s+Number(x.booked??0),0));
} else if(mode==='delete'){
  const r=await fetch(`${URL}/rest/v1/channel_daily?${FILTER}`,{method:'DELETE',headers:{...H,Prefer:'return=representation'}});
  const rows=await r.json();
  console.log('deleted rows:',Array.isArray(rows)?rows.length:rows);
} else if(mode==='verify'){
  const r=await fetch(`${URL}/rest/v1/channel_daily?select=day,channel,booked&day=gte.2026-05-01&booked=gt.0&order=day`,{headers:{...H,Range:'0-99999','Range-Unit':'items'}});
  const rows=await r.json();
  const m={}; for(const x of rows){const k=x.day.slice(0,7); m[k]=(m[k]??0)+Number(x.booked);}
  console.log('booked by month:',JSON.stringify(m));
  const d={}; for(const x of rows){ if(x.day>= '2026-09-08') d[x.day]=(d[x.day]??0)+Number(x.booked);} 
  console.log('last days:',JSON.stringify(d));
}
