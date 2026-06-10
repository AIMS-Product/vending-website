import fs from 'fs';
const d = JSON.parse(fs.readFileSync('reports/ux-persona-review/exploration-data.json', 'utf8'));
let totalShots = 0, totalInter = 0, totalSkips = 0;
let out = `# Exploration Log — Page Builder

Base URL: http://localhost:3000
Date: 2026-06-04
Scope: SEO Page Builder (\`/admin/pages/*\`)
Auth: explored with ADMIN_DEV_AUTH_BYPASS=1 (super_admin)
Pages explored: ${d.length}

> Screenshots live in \`screenshots/\`. Each page has \`load\` (full-page desktop),
> \`mobile\` (375px), \`tablet\` (768px), plus interaction shots. Read the images with
> the Read tool — visual assessment is required.

---
`;

for (const r of d) {
  const path = r.url.replace('http://localhost:3000', '');
  totalShots += (r.shots || []).length + (r.interactions || []).length;
  totalInter += (r.interactions || []).length;
  totalSkips += (r.skips || []).length;
  out += `\n## Page: ${path} (${r.name})\n\n`;
  out += `### Load\n`;
  out += `- HTTP status: ${r.httpStatus} (${r.status})\n`;
  out += `- Load screenshot: screenshots/${(r.shots || []).find(s => s.includes('-load')) || '(none)'}\n`;
  out += `- Console errors: ${r.console && r.console.length ? r.console.join(' | ') : 'none'}\n`;
  out += `- Failed network requests: ${r.network && r.network.length ? r.network.join(' | ') : 'none'}\n`;
  if (r.notes && r.notes.length) out += `- Notes: ${r.notes.join(' ')}\n`;

  const inv = r.inventory || { counts: {}, headings: [], buttons: [], links: [], inputs: [] };
  out += `\n### Page structure\n`;
  out += `- Headings: ${(inv.headings || []).map(h => `${h.level}:"${h.text}"`).join(', ') || 'none'}\n`;
  out += `- Element counts: ${inv.counts.buttons || 0} buttons, ${inv.counts.links || 0} links, ${inv.counts.inputs || 0} inputs\n`;

  if ((inv.buttons || []).length) {
    out += `\n### Buttons (visible)\n`;
    out += `| Label | Disabled |\n|---|---|\n`;
    for (const b of inv.buttons.slice(0, 60)) out += `| ${b.text || '(unlabeled)'} | ${b.disabled ? 'yes' : ''} |\n`;
    if (inv.buttons.length > 60) out += `| …and ${inv.buttons.length - 60} more | |\n`;
  }
  if ((inv.inputs || []).length) {
    out += `\n### Inputs / form fields\n`;
    out += `| Type | Name | Label/Placeholder | Required |\n|---|---|---|---|\n`;
    for (const i of inv.inputs.slice(0, 60)) out += `| ${i.type} | ${i.name || ''} | ${(i.label || i.placeholder || '').slice(0, 50)} | ${i.required ? 'yes' : ''} |\n`;
    if (inv.inputs.length > 60) out += `| …and ${inv.inputs.length - 60} more | | | |\n`;
  }
  if ((inv.links || []).length) {
    out += `\n### Links\n`;
    out += `| Text | Href |\n|---|---|\n`;
    for (const l of inv.links.slice(0, 40)) out += `| ${l.text || '(no text)'} | ${l.href} |\n`;
  }

  out += `\n### Interactions performed (safe)\n`;
  if ((r.interactions || []).length) {
    out += `| Element clicked | Result | Screenshot |\n|---|---|---|\n`;
    for (const i of r.interactions) out += `| ${i.element} | ${i.result} | screenshots/${i.shot} |\n`;
  } else {
    out += `_No safe click interactions recorded (page is view/selection-oriented or interactions navigated away)._\n`;
  }

  if ((r.skips || []).length) {
    out += `\n### Skipped (destructive / external)\n`;
    out += `| Element | Reason |\n|---|---|\n`;
    for (const s of r.skips) out += `| ${s.element} | ${s.reason} |\n`;
  }

  out += `\n### Responsive\n`;
  const mob = (r.shots || []).find(s => s.includes('-mobile'));
  const tab = (r.shots || []).find(s => s.includes('-tablet'));
  out += `| Viewport | Screenshot |\n|---|---|\n`;
  out += `| Mobile (375px) | screenshots/${mob || '(none)'} |\n`;
  out += `| Tablet (768px) | screenshots/${tab || '(none)'} |\n`;
  out += `\n---\n`;
}

out += `\n## Summary\n`;
out += `- Pages explored: ${d.length}\n`;
out += `- Total screenshots: ${totalShots}\n`;
out += `- Safe interactions performed: ${totalInter}\n`;
out += `- Destructive/external actions skipped: ${totalSkips}\n`;
out += `- Console errors across all pages: ${d.reduce((a, r) => a + (r.console || []).length, 0)}\n`;
out += `- Failed network requests across all pages: ${d.reduce((a, r) => a + (r.network || []).length, 0)}\n`;
out += `\n## Skipped destructive actions (all pages)\n`;
out += `| Page | Element | Reason |\n|---|---|---|\n`;
for (const r of d) for (const s of (r.skips || [])) out += `| ${r.url.replace('http://localhost:3000', '')} | ${s.element} | ${s.reason} |\n`;
out += `\n_Note: the page editor was opened on a pre-existing sample page (\`f7eb8024…\`). Publish/Unpublish/Delete on that page were screenshotted but not executed (destructive on pre-existing data). The "new page" creation flow was filled/reviewed visually but not submitted to avoid orphan records._\n`;

fs.writeFileSync('reports/ux-persona-review/exploration-log.md', out);
console.log('Wrote exploration-log.md — ' + out.length + ' chars');
