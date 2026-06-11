import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1366, height: 1000 } });
await p.goto("http://localhost:3000/admin/pages", { waitUntil: "networkidle" });
const kpiCard = await p.locator('[data-kpi="schedule-failed"]').count();
const needAttention = await p.locator("text=/need attention/i").count();
console.log(
  "RESULT " +
    JSON.stringify({ kpiCardPresent: kpiCard, needAttentionText: needAttention }),
);
await b.close();
