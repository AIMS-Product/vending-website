import { chromium } from 'playwright';
const BASE='http://localhost:3000';
const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:375,height:667}});
const page=await ctx.newPage();
// get all news slugs from /news links
await page.goto(BASE+'/news',{waitUntil:'networkidle'});
const slugs=await page.evaluate(()=>[...document.querySelectorAll('a[href^="/news/"]')].map(a=>a.getAttribute('href')).filter((v,i,arr)=>arr.indexOf(v)===i));
console.log('slugs:',slugs);
for(const s of slugs){
  await page.goto(BASE+s,{waitUntil:'networkidle'});
  await page.waitForTimeout(300);
  const r=await page.evaluate(()=>{
    const h1=document.querySelector('h1');
    const hr=h1?h1.getBoundingClientRect():null;
    return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h1text:(h1?.textContent||'').slice(0,50),h1right:hr?Math.round(hr.right):null};
  });
  const fail=r.sw-r.cw>4;
  console.log(`${fail?'FAIL':'OK  '} sw=${r.sw} h1right=${r.h1right} | ${s} | "${r.h1text}"`);
}
await browser.close();process.exit(0);
