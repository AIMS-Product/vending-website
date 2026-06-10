import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const URL = `http://localhost:3001/admin/pages/${process.argv[2]||"e44f0fc3-0dcf-480f-9c99-f3409c690378"}`;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844}});
const page = await ctx.newPage();
await page.goto(URL,{waitUntil:"networkidle",timeout:60000});
await page.waitForTimeout(1200);
const r = await new AxeBuilder({page}).analyze();
// Tab through and confirm we can reach both bar buttons and then move past (no trap).
const bar = page.getByRole("region",{name:"Editor actions"});
const saveBtn = bar.getByRole("button",{name:/save draft|^save$/i}).first();
await saveBtn.focus();
const focusedSave = await page.evaluate(()=>document.activeElement?.textContent?.trim().slice(0,40));
await page.keyboard.press("Tab");
const afterTab = await page.evaluate(()=>document.activeElement?.textContent?.trim().slice(0,40));
await b.close();
console.log(JSON.stringify({
  violations: r.violations.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length})),
  totalViolations: r.violations.length,
  focusedSaveText: focusedSave,
  afterTabText: afterTab,
  movedFocusAway: focusedSave!==afterTab
},null,2));
