import { chromium } from 'playwright';
const BASE='http://localhost:3000';
const browser=await chromium.launch();
// Mobile after-shots
const m=await browser.newContext({viewport:{width:375,height:667},deviceScaleFactor:2});
const mp=await m.newPage();
const mobileTargets=[
  ['/','n9-home-mobile-after'],
  ['/case-studies','n9-casestudies-mobile-after'],
  ['/news/top-5-questions-vending-entrepreneurship-program','n9-article-mobile-after'],
];
for(const [path,name] of mobileTargets){
  await mp.goto(BASE+path,{waitUntil:'networkidle'});await mp.waitForTimeout(500);
  await mp.screenshot({path:`plans/ux-review-fixes/agent-runs/shots/${name}.png`,fullPage:false});
}
// Desktop 1280 after-shots (prove unchanged)
const d=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1});
const dp=await d.newPage();
const desktopTargets=[
  ['/','n9-home-desktop-after'],
  ['/case-studies','n9-casestudies-desktop-after'],
  ['/news/top-5-questions-vending-entrepreneurship-program','n9-article-desktop-after'],
];
for(const [path,name] of desktopTargets){
  await dp.goto(BASE+path,{waitUntil:'networkidle'});await dp.waitForTimeout(500);
  await dp.screenshot({path:`plans/ux-review-fixes/agent-runs/shots/${name}.png`,fullPage:false});
}
await browser.close();console.log('shots done');process.exit(0);
