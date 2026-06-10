import { chromium } from 'playwright';
const BASE='http://localhost:3000';
const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:375,height:667}});
const page=await ctx.newPage();
await page.goto(BASE+'/news/top-5-questions-vending-entrepreneurship-program',{waitUntil:'networkidle'});
await page.waitForTimeout(400);
const r=await page.evaluate(()=>{
  const vw=document.documentElement.clientWidth;
  const out=[];
  for(const el of document.querySelectorAll('*')){
    const b=el.getBoundingClientRect();
    if(b.width===0||b.height===0)continue;
    if(b.right>vw+1||b.left<-1){
      let clipped=false,p=el.parentElement;
      while(p){const cs=getComputedStyle(p);if(cs.overflowX==='hidden'||cs.overflowX==='clip'){clipped=true;break;}p=p.parentElement;}
      let sel=el.tagName.toLowerCase();
      if(el.className&&typeof el.className==='string')sel+='.'+el.className.trim().split(/\s+/).slice(0,4).join('.');
      out.push({sel,right:Math.round(b.right),left:Math.round(b.left),w:Math.round(b.width),clipped,text:(el.textContent||'').trim().slice(0,40)});
    }
  }
  return {sw:document.documentElement.scrollWidth,vw,unclipped:out.filter(o=>!o.clipped).sort((a,b)=>b.w-a.w).slice(0,8)};
});
console.log('sw=',r.sw,'vw=',r.vw);
for(const o of r.unclipped)console.log(`w=${o.w} R=${o.right} L=${o.left} | ${o.sel} | "${o.text}"`);
await browser.close();process.exit(0);
