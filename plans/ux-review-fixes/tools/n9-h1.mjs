import { chromium } from 'playwright';
const BASE='http://localhost:3000';
const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:375,height:667}});
const page=await ctx.newPage();
await page.goto(BASE+'/news/top-5-questions-vending-entrepreneurship-program',{waitUntil:'networkidle'});
await page.waitForTimeout(400);
const r=await page.evaluate(()=>{
  const h1=document.querySelector('h1');
  // walk up from h1 reporting scrollWidth vs clientWidth to find overflowing container
  const chain=[];let el=h1;
  while(el){const b=el.getBoundingClientRect();const cs=getComputedStyle(el);
    let sel=el.tagName.toLowerCase();if(el.className&&typeof el.className==='string')sel+='.'+el.className.trim().split(/\s+/).slice(0,3).join('.');
    chain.push({sel,w:Math.round(b.width),sw:el.scrollWidth,cw:el.clientWidth,ox:cs.overflowX,ww:cs.overflowWrap,wb:cs.wordBreak});el=el.parentElement;}
  return {vw:document.documentElement.clientWidth,h1fs:getComputedStyle(h1).fontSize,chain};
});
console.log('vw=',r.vw,'h1 fontSize=',r.h1fs);
for(const c of r.chain)console.log(`w=${c.w} scrollW=${c.sw} clientW=${c.cw} ox=${c.ox} wrap=${c.ww} wb=${c.wb} | ${c.sel}`);
await browser.close();process.exit(0);
