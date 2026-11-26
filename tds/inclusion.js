// US Plast — Solid Polycarbonate Sheet black speck (inclusion) specification, GP vs OP.
// Usage: node tds/inclusion.js  -> tds/pdf/QS-PC-S-Inclusion-Specification.pdf
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, 'pdf');
const LOGO = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, 'assets', 'usplast-logo.jpg')).toString('base64');
const CODE = 'QS-PC-S-01';
const TITLE = 'Solid Polycarbonate Sheet — Black Speck (Inclusion) Specification';

const rows = [
  // [speck size, GP, OP]
  ['Under 0.032"', 'Not counted', 'Not counted'],
  ['0.032" – 0.0625"', '2', '1'],
  ['Over 0.0625"', 'None allowed', 'None allowed'],
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: Letter; margin: 0.6in 0.7in 0.75in 0.7in; }
:root { --ink:#1d2430; --muted:#5b6575; --line:#c9d0da; --accent:#0b4f8a; --head:#e7eef7; --fill:#f3f7fc; }
body { font-family:'Inter','DejaVu Sans',sans-serif; color:var(--ink); font-size:9.5pt; line-height:1.45; margin:0; }
.hdr { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid var(--accent); padding-bottom:12px; margin-bottom:22px; }
.logo img { max-width:1.2in; max-height:0.62in; }
.titlebox { flex:1; padding:0 18px; }
.fam { font-size:7.5pt; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); font-weight:600; }
h1 { font-size:15pt; margin:3px 0 0; letter-spacing:-.01em; }
.meta { font-size:7.5pt; border-collapse:collapse; width:2.1in; }
.meta td { padding:2px 6px; border:1px solid var(--line); }
.meta td:first-child { color:var(--muted); background:var(--head); white-space:nowrap; }
h2 { font-size:10pt; color:var(--accent); text-transform:uppercase; letter-spacing:.06em; margin:22px 0 8px; padding-bottom:3px; border-bottom:1px solid var(--line); }
p { margin:6px 0; }
table.spec { width:100%; border-collapse:collapse; margin-top:6px; }
table.spec th { background:var(--head); font-weight:600; font-size:8.8pt; padding:7px 10px; border:1px solid var(--line); text-align:center; }
table.spec th:first-child { text-align:left; }
table.spec td { padding:8px 10px; border:1px solid var(--line); text-align:center; font-size:9.5pt; }
table.spec td:first-child { text-align:left; font-weight:600; }
table.spec td.v { background:var(--fill); font-weight:500; }
.note { color:var(--muted); font-size:8pt; margin-top:6px; }
.grades { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.grade { border:1px solid var(--line); border-left:3px solid var(--accent); padding:8px 12px; background:#fafcfe; }
.grade b { color:var(--accent); }
.disc { margin-top:30px; padding:8px 10px; border-left:3px solid var(--accent); background:#f6f8fb; font-size:7.4pt; color:var(--muted); }
</style></head><body>
<div class="hdr">
  <div class="logo"><img src="${LOGO}" alt="US Plast"></div>
  <div class="titlebox"><div class="fam">Quality Specification</div><h1>${TITLE}</h1></div>
  <table class="meta"><tr><td>Doc. No.</td><td>${CODE}</td></tr><tr><td>Revision</td><td>00</td></tr><tr><td>Issue Date</td><td>11/2026</td></tr></table>
</div>

<h2>Scope</h2>
<p>This specification defines the maximum allowable number of internal black specks (inclusions) in US Plast clear solid polycarbonate sheet. It applies to both product grades:</p>
<div class="grades">
  <div class="grade"><b>GP — General Purpose</b><br>For general glazing, guarding, signage and fabrication applications.</div>
  <div class="grade"><b>OP — Optical Grade</b><br>For applications where improved optical quality is required.</div>
</div>

<h2>Allowable Black Specks (Inclusions)</h2>
<table class="spec">
  <thead><tr><th>Speck Size (diameter)</th><th>GP — General Purpose<br><span style="font-weight:400">max. per ft²</span></th><th>OP — Optical Grade<br><span style="font-weight:400">max. per ft²</span></th></tr></thead>
  <tbody>${rows.map(([s, gp, op]) => `<tr><td>${s}</td><td class="v">${gp}</td><td class="v">${op}</td></tr>`).join('')}</tbody>
</table>
<p class="note">Speck size is measured as the largest diameter of the speck.</p>

<div class="disc"><b>Disclaimer.</b> This specification applies to inclusion black specks only. Other appearance and dimensional requirements are given in the product Technical Data Sheet (TDS-PC-S-01).<br><br>
<b>US Plast</b> · 1128 Roosevelt Avenue, York, PA 17404, USA · +1 (717) 356-2448 · info@usplast.com · www.usplast.com</div>
</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const pg = await browser.newPage();
  await pg.setContent(html, { waitUntil: 'load' });
  const file = path.join(OUT, 'QS-PC-S-Inclusion-Specification.pdf');
  await pg.pdf({ path: file, format: 'Letter', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: `<div style="font-family:Inter,sans-serif;font-size:7px;color:#5b6575;width:100%;padding:0 0.7in;display:flex;justify-content:space-between"><span>US Plast · ${CODE} · Rev. 00</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>` });
  await browser.close();
  console.log('wrote', file);
})();
