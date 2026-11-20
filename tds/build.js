// Generates US Plast Technical Data Sheet (TDS) PDFs (US Letter) in two modes:
//   - blank templates  -> tds/pdf/TDS-Template-*.pdf
//   - filled drafts    -> tds/pdf/TDS-Draft-*.pdf  (competitor reference values with source tags)
// Usage: node tds/build.js
//
// Draft values come from competitors' published literature (see ABD-Rakip-Analizi.md and
// tds/pdf/benchmark). Source tags: competitor/product name, standard name, or "typ." for a
// typical industry value that has NOT been verified. Replace all values with US Plast test data
// before release, then set SHOW_DRAFT_MARKS = false for a clean final build.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, 'pdf');
const LOGO = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, 'assets', 'usplast-logo.jpg')).toString('base64');
fs.mkdirSync(OUT, { recursive: true });

const SHOW_DRAFT_MARKS = true; // ribbon + source tags on filled drafts
let DRAFT = false;             // set per build pass
let FINAL = false;             // clean release build: values shown, no ribbon/tags/highlights

// ---------- helpers ----------
const B = '<td class="fill"></td>';
const esc = (s) => String(s);
const tag = (src) => (DRAFT && SHOW_DRAFT_MARKS && !FINAL && src ? `<span class="src">${src}</span>` : '');
// value cell: v = [value, source] or undefined
function vc(v, cls = '') {
  if (!DRAFT || !v || v[0] === '' || v[0] == null) return `<td class="fill ${cls}"></td>`;
  return `<td class="fill val ${cls}">${v[0]}${tag(v[1])}</td>`;
}
// inline value for text spans
const iv = (val, src) => (DRAFT ? `${val}${tag(src)}` : '');

// Property table: rows = [property, method, usUnit, siUnit, [us, src]?, [si, src]?]
function propTable(title, rows, note = '') {
  return `
  <h2>${title}</h2>
  <table class="props">
    <colgroup><col style="width:32%"><col style="width:14%"><col style="width:12%"><col style="width:15%"><col style="width:12%"><col style="width:15%"></colgroup>
    <thead><tr><th>Property</th><th>Test Method</th><th>Units</th><th>Value</th><th>Units (SI)</th><th>Value (SI)</th></tr></thead>
    <tbody>
    ${rows.map(([p, m, u, si, us, siv]) => `<tr><td>${p}</td><td class="m">${m}</td><td class="u">${u}</td>${vc(us)}<td class="u">${si}</td>${si === '' ? '<td class="na"></td>' : vc(siv)}</tr>`).join('')}
    </tbody>
  </table>${note ? `<p class="note">${note}</p>` : ''}`;
}

// Result table: rows = [property, method, [result, src]?]
function resultTable(title, rows) {
  return `
  <h2>${title}</h2>
  <table class="props">
    <colgroup><col style="width:36%"><col style="width:22%"><col style="width:42%"></colgroup>
    <thead><tr><th>Property</th><th>Test Method / Standard</th><th>Result</th></tr></thead>
    <tbody>${rows.map(([p, m, r]) => `<tr><td>${p}</td><td class="m">${m}</td>${vc(r)}</tr>`).join('')}</tbody>
  </table>`;
}

// Matrix: rows = [label, ...cells] where each cell = [value, src] or undefined
function matrix(title, cols, rows, note = '') {
  const has = (c) => c && c[0] !== '' && c[0] != null;
  const keepRow = (cells) => cells.some(has);
  const norm = rows.map((r) => (Array.isArray(r) ? r.slice(1) : []));
  const keepCol = cols.slice(1).map((_, i) => norm.some((cells) => has(cells[i])));
  const nCells = cols.length - 1;
  if (FINAL) cols = [cols[0], ...cols.slice(1).filter((_, i) => keepCol[i])];
  return `
  <h2>${title}</h2>
  <table class="matrix">
    <thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => {
      const [label, ...cells] = Array.isArray(r) ? r : [r];
      if (FINAL && !keepRow(cells)) return '';
      const tds = [];
      for (let i = 0; i < nCells; i++) if (!FINAL || keepCol[i]) tds.push(vc(cells[i]));
      return `<tr><td class="rl">${label}</td>${tds.join('')}</tr>`;
    }).join('')}</tbody>
  </table>${note ? `<p class="note">${note}</p>` : ''}`;
}

function lines(title, n, hint) {
  return `<h2>${title}</h2>${hint ? `<p class="hint">${hint}</p>` : ''}<div class="lines">${'<div class="ln"></div>'.repeat(n)}</div>`;
}

function checklist(title, items) {
  return `<h2>${title}</h2><div class="checks">${items.map((i) => `<div class="ck"><span class="box"></span>${i}</div>`).join('')}</div>`;
}

// flammability rows: values object keyed by short key
const flammability = (v = {}, extra = []) =>
  resultTable('Flammability &amp; Building Code', [
    ['Flammability Rating (state thickness)', 'UL 94', v.ul94],
    ['Burn Rate / Plastic Classification (CC1 / CC2)', 'ASTM D635', v.d635],
    ['Self-Ignition Temperature, °F (°C)', 'ASTM D1929', v.d1929],
    ['Flame Spread Index / Smoke-Developed Index', 'ASTM E84 (UL 723)', v.e84],
    ['Smoke Density Rating', 'ASTM D2843', v.d2843],
    ...extra,
    ['Code Evaluation Report', 'ICC-ES ESR / IAPMO UES No.'],
    ['UL File Number', 'UL Product iQ'],
  ]);

// Tolerance table: rows = [parameter, standard, condition, [us, src]?, [si]?, [note]?]
function tolTable(rows, note = '') {
  const notes = !FINAL || rows.some((r) => r[5] && r[5][0]);
  return `<div class="avoid"><h2>Dimensional Tolerances</h2>
  <table class="props">
    <colgroup><col style="width:24%"><col style="width:15%"><col style="width:18%"><col style="width:${notes ? 17 : 22}%"><col style="width:${notes ? 15 : 21}%">${notes ? '<col style="width:11%">' : ''}</colgroup>
    <thead><tr><th>Parameter</th><th>Standard / Method</th><th>Condition / Range</th><th>Tolerance (US)</th><th>Tolerance (SI)</th>${notes ? '<th>Notes</th>' : ''}</tr></thead>
    <tbody>${rows.map(([p, m, c, us, si, n]) => `<tr><td>${p}</td><td class="m">${m}</td><td class="m">${c}</td>${vc(us)}${vc(si)}${notes ? vc(n, 'sm') : ''}</tr>`).join('')}</tbody>
  </table>${note ? `<p class="note">${note}</p>` : ''}</div>`;
}

const certifications = (items) => checklist('Certifications &amp; Compliance', items);

const warrantyBlock = (years, scope, src) => DRAFT && years
  ? `<h2>Warranty</h2><p class="fillline"><span class="val">${years}</span>-year limited warranty against <span class="val">${scope}</span>${tag(src)}. Full warranty terms: document <span class="fl w120"></span>.</p>`
  : `<h2>Warranty</h2><p class="fillline"><span class="fl w60"></span>-year limited warranty against
  <span class="fl w240"></span>. Full warranty terms: document <span class="fl w120"></span>.</p>`;

const storage = (text) => DRAFT && text
  ? `<h2>Storage, Handling &amp; Cleaning</h2><p class="desc">${text}${tag('typ.')}</p>`
  : lines('Storage, Handling &amp; Cleaning', 3,
    'Store flat, indoors, protected from sunlight and heat; remove masking / protective film (if any) within ___ months of outdoor exposure. List approved / prohibited cleaning agents.');

// feature value highlight: in blank mode show [placeholder], in draft show value
const fv = (val) => (FINAL ? val : DRAFT ? `<span class="vf">${val}</span>` : `<span class="vf">[${val}]</span>`);

// ---------- document shell ----------
function page({ code, family, subtitle, body }) {
  if (FINAL) body = body.replace(/ \(state method\)/g, '');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: Letter; margin: 0.55in 0.6in 0.75in 0.6in; }
  :root { --ink:#1d2430; --muted:#5b6575; --line:#c9d0da; --accent:#0b4f8a; --fill:#f3f7fc; --head:#e7eef7; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', 'DejaVu Sans', sans-serif; color: var(--ink); font-size: 8.6pt; line-height: 1.35; margin: 0; }
  .ribbon { background:#b45309; color:#fff; font-weight:700; letter-spacing:.08em; text-transform:uppercase; font-size:7.2pt; padding:5px 10px; text-align:center; margin-bottom:8px; }
  .hdr { display:flex; justify-content:space-between; align-items:stretch; border-bottom: 3px solid var(--accent); padding-bottom: 10px; margin-bottom: 12px; }
  .logo { width: 1.3in; height: 0.62in; display:flex; align-items:center; justify-content:flex-start; flex: none; }
  .logo img { max-width: 1.2in; max-height: 0.62in; object-fit: contain; }
  .titlebox { flex:1; padding: 0 16px; }
  .fam { font-size: 7.5pt; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); font-weight: 600; }
  h1 { font-size: 17pt; margin: 2px 0 2px; font-weight: 700; letter-spacing: -.01em; }
  .sub { color: var(--muted); font-size: 8.5pt; }
  .meta { font-size: 7.5pt; border-collapse: collapse; align-self:flex-start; width: 2.1in; flex: none; }
  .meta td { padding: 2px 6px; border: 1px solid var(--line); }
  .meta td:first-child { color: var(--muted); background: var(--head); white-space: nowrap; }
  .meta td:last-child { width: 1.05in; background: var(--fill); }
  h2 { font-size: 9.6pt; color: var(--accent); text-transform: uppercase; letter-spacing: .06em; margin: 13px 0 5px; padding-bottom: 2px; border-bottom: 1px solid var(--line); break-after: avoid; }
  table { width: 100%; border-collapse: collapse; break-inside: auto; }
  tr { break-inside: avoid; }
  th { background: var(--head); text-align: left; font-weight: 600; font-size: 7.8pt; padding: 4px 6px; border: 1px solid var(--line); }
  td { padding: 4px 6px; border: 1px solid var(--line); height: 19px; vertical-align: middle; }
  td.m, td.u { color: var(--muted); font-size: 7.8pt; }
  td.fill { background: var(--fill); }
  td.val { font-weight: 500; font-size: 8pt; }
  td.sm { font-size: 7pt; }
  td.na { background: repeating-linear-gradient(45deg,#fff,#fff 3px,#eef1f5 3px,#eef1f5 6px); }
  table.matrix th { text-align: center; }
  table.matrix th:first-child { text-align: left; }
  table.matrix td.val { text-align: center; font-size: 7.6pt; }
  td.rl { font-weight: 600; white-space: nowrap; background: #fff; }
  .src { display:inline-block; margin-left:3px; padding:0 3px; border-radius:2px; background:#fde7c8; color:#8a4b00; font-size:5.8pt; font-weight:600; vertical-align: 1px; white-space: nowrap; }
  .note, .hint { color: var(--muted); font-size: 7.4pt; margin: 3px 0 0; }
  .hint { margin: 0 0 4px; font-style: italic; }
  .lines .ln { border-bottom: 1px solid var(--line); height: 18px; background: var(--fill); margin-bottom: 3px; }
  .checks { display:grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; }
  .ck { display:flex; align-items:center; gap:7px; padding: 2px 0; }
  .box { width: 10px; height: 10px; border: 1.2px solid var(--muted); display:inline-block; flex: none; }
  .fl { display:inline-block; border-bottom: 1px solid var(--muted); background: var(--fill); height: 13px; vertical-align: bottom; }
  .w60{width:.6in}.w120{width:1.2in}.w240{width:2.4in}
  span.val { background: var(--fill); padding: 0 3px; font-weight: 500; }
  .desc { margin: 2px 0 5px; text-align: justify; }
  .feat { margin: 0; padding-left: 14px; } .feat li { margin: 1px 0; }
  .vf { background: #fff4d6; padding: 0 2px; border-radius: 2px; }
  .fillline { margin: 4px 0; line-height: 2; }
  .two { display:grid; grid-template-columns: 1fr 1fr; gap: 0 18px; }
  .disc { margin-top: 16px; padding: 8px 10px; border-left: 3px solid var(--accent); background: #f6f8fb; font-size: 7.2pt; color: var(--muted); break-inside: avoid; }
  .avoid { break-inside: avoid; }
  </style></head><body>
  ${DRAFT && SHOW_DRAFT_MARKS && !FINAL ? '<div class="ribbon">Draft — values are competitor reference data (see source tags) — replace with US Plast test data before release</div>' : ''}
  <div class="hdr">
    <div class="logo"><img src="${LOGO}" alt="US Plast"></div>
    <div class="titlebox">
      <div class="fam">Technical Data Sheet</div>
      <h1>${family}</h1>
      <div class="sub">${subtitle}</div>
    </div>
    <table class="meta">
      <tr><td>Doc. No.</td><td>${FINAL ? code.replace('___', '01') : code}</td></tr>
      <tr><td>Revision</td><td>${FINAL ? '00' : ''}</td></tr>
      <tr><td>Issue Date</td><td>${FINAL ? '11/2026' : ''}</td></tr>
      ${FINAL ? '' : '<tr><td>Supersedes</td><td></td></tr>'}
    </table>
  </div>
  ${body}
  <div class="disc"><b>Disclaimer.</b> The information contained herein represents typical values and is not intended for specification purposes. Values may vary with thickness, color, finish and test conditions. It is the user's responsibility to determine the suitability of this product for the intended application and to comply with applicable building codes. Refer to the Safety Data Sheet (SDS) for handling information.<br><br>
  <b>US Plast</b> · 1128 Roosevelt Avenue, York, PA 17404, USA · +1 (717) 356-2448 · info@usplast.com · www.usplast.com</div>
  </body></html>`;
}

const intro = (apps, desc) => `
  <div class="two">
    <div><h2>Product Description</h2><p class="desc">${desc.text}</p><ul class="feat">${desc.features.map((f) => `<li>${f}</li>`).join('')}</ul></div>
    <div><h2>Typical Applications</h2>${FINAL
      ? `<ul class="feat">${apps.filter((a) => !a.startsWith('Other')).map((a) => `<li>${a}</li>`).join('')}</ul>`
      : `<div class="checks" style="grid-template-columns:1fr">${apps.map((a) => `<div class="ck"><span class="box"></span>${a}</div>`).join('')}</div>`}</div>
  </div>`;

// shorthand for [value, source]
const V = (val, src) => [val, src];

// ---------- product definitions ----------
function buildDocs() {
  const docs = [];

  // ===================== 1. SOLID POLYCARBONATE =====================
  // Draft sources: Plaskolite TUFFAK first; LEXAN / PALSUN where TUFFAK value not found; typ. = industry typical.
  const thkPC = ['0.060', '0.093', '0.118', '0.177', '0.236', '0.375', '0.500'];
  const mmPC = ['1.5', '2.4', '3.0', '4.5', '6.0', '9.5', '12.7'];
  docs.push({
    slug: 'Solid-Polycarbonate',
    code: 'TDS-PC-S-___',
    family: 'Solid Polycarbonate Sheet',
    subtitle: 'Extruded, UV-protected solid polycarbonate sheet',
    body: intro(['Glazing &amp; skylights', 'Machine guards &amp; protective barriers', 'Signage &amp; displays', 'Security / vandal-resistant glazing', 'Thermoformed parts', 'Other: ____________________'], {
      text: 'US Plast solid polycarbonate sheet is a transparent, UV-protected thermoplastic glazing material that combines glass-like clarity with exceptional toughness. Virtually unbreakable and roughly half the weight of glass, it provides lasting performance in demanding indoor and outdoor applications where safety, durability and design freedom matter.',
      features: [`Impact strength up to ${fv('250')} times that of glass`, `High light transmission — up to ${fv('86')} % (clear, 0.118")`, 'Co-extruded UV protection against yellowing and loss of clarity', 'Can be cold-formed, thermoformed, drilled, cut and machined with standard tools', `Wide service temperature range: ${fv('−40 °F to 250 °F')}`],
    }) +
      propTable('Physical Properties', [
        ['Specific Gravity', 'ASTM D792', '—', 'g/cm³', V('1.20', 'TUFFAK'), V('1.20', 'TUFFAK')],
        ['Water Absorption, 24 h', 'ASTM D570', '%', '', V('0.15', 'PALSUN')],
      ]) +
      propTable('Optical Properties', [
        ['Light Transmission, clear (@ 0.118 in)', 'ASTM D1003', '%', '', V('86', 'TUFFAK')],
        ['Haze', 'ASTM D1003', '%', '', V('< 1', 'typ.')],
        ['Refractive Index', 'ASTM D542', '—', '', V('1.586', 'TUFFAK')],
        ['Yellowness Index', 'ASTM E313', '—', ''],
      ]) +
      propTable('Mechanical Properties', [
        ['Tensile Strength, Yield', 'ASTM D638', 'psi', 'MPa', V('9,000', 'LEXAN'), V('62', 'LEXAN')],
        ['Tensile Modulus', 'ASTM D638', 'psi', 'MPa', V('345,000', 'typ.'), V('2,380', 'typ.')],
        ['Elongation at Break', 'ASTM D638', '%', '', V('110', 'typ.')],
        ['Flexural Strength', 'ASTM D790', 'psi', 'MPa', V('13,500', 'typ.'), V('93', 'typ.')],
        ['Flexural Modulus', 'ASTM D790', 'psi', 'MPa', V('345,000', 'LEXAN'), V('2,380', 'LEXAN')],
        ['Izod Impact, Notched (1/8")', 'ASTM D256', 'ft-lb/in', 'J/m', V('12–16', 'LEXAN'), V('640–850', 'LEXAN')],
        ['Instrumented Impact, Total Energy (@ 0.125 in)', 'ASTM D3763', 'ft-lb', 'J', V('≈ 45', 'typ.'), V('≈ 60', 'typ.')],
        ['Rockwell Hardness', 'ASTM D785', 'M / R scale', '', V('M70 / R118', 'typ.')],
      ]) +
      propTable('Thermal Properties', [
        ['Heat Deflection Temperature @ 264 psi', 'ASTM D648', '°F', '°C', V('270', 'typ.'), V('132', 'typ.')],
        ['Heat Deflection Temperature @ 66 psi', 'ASTM D648', '°F', '°C', V('280', 'typ.'), V('138', 'typ.')],
        ['Vicat Softening Temperature', 'ASTM D1525', '°F', '°C', V('300', 'typ.'), V('149', 'typ.')],
        ['Coefficient of Linear Thermal Expansion', 'ASTM D696', 'in/in·°F', 'mm/mm·°C', V('3.75 × 10⁻⁵', 'typ.'), V('6.75 × 10⁻⁵', 'typ.')],
        ['Thermal Conductivity', 'ASTM C177', 'BTU·in/h·ft²·°F', 'W/m·K', V('1.35', 'typ.'), V('0.19', 'typ.')],
        ['Max. Continuous Service Temperature', '—', '°F', '°C', V('250', 'typ.'), V('121', 'typ.')],
        ['Thermoforming Temperature Range', '—', '°F', '°C', V('340–400', 'typ.'), V('170–205', 'typ.')],
      ]) +
      flammability({
        ul94: V('HB @ 0.060 in; V-0 @ 0.394 in', 'TUFFAK'),
        d635: V('CC1', 'PALSUN · ESR-1893'),
        d1929: V('≈ 1,080 °F (580 °C)', 'typ.'),
        e84: V('Smoke-developed index ≤ 450', 'Palram · ESR-1893'),
      }, [['Safety Glazing', 'ANSI Z97.1 / CPSC 16 CFR 1201'], ['Bullet Resistance (if applicable)', 'UL 752 Level']]) +
      `<div class="avoid">` + matrix('Product Availability*', ['Thickness (in)', 'Thickness (mm)', 'Tolerance (±)', 'Standard Sizes (in)', 'Max Width × Length', 'Colors / Finish'],
        thkPC.map((t, i) => [DRAFT ? t + '"' : '', V(mmPC[i]), V('10 %', 'distributor std.'), V('48×96, 60×96, 72×96', 'typ.'), undefined, V('Clear, bronze, gray', 'typ.')]).concat(DRAFT ? [] : ['', '', '', '', '', '', ''].slice(7)),
        '<b>* For other colors and sizes, please contact our sales team.</b>') + `</div>` +
      tolTable([
        ['Thickness', 'ASTM D5947', '< 1.5 mm / 1.5–2.0 mm', V('± 8 % / ± 4 %', 'TUFFAK EU*'), V('± 8 % / ± 4 %')],
        ['Thickness', 'ASTM D5947', '2–6 mm', V('± 3 %', 'TUFFAK EU*'), V('± 3 %')],
        ['Thickness', 'ASTM D5947', '> 6 mm (to 12 mm)', V('± 3 %', 'TUFFAK EU*'), V('± 3 %')],
        ['Thickness variation within sheet', 'ASTM D5947', 'Max – min, same sheet'],
        ['Width', 'ISO 11963', 'All sizes', V('≤ 0.06 in/ft', 'TUFFAK EU'), V('≤ 5 mm/m')],
        ['Length', 'ISO 11963', 'All sizes', V('≤ 0.06 in/ft', 'TUFFAK EU'), V('≤ 5 mm/m')],
        ['Squareness (diagonal difference)', 'ISO 11963', 'All sizes', V('≤ 0.0035 × width', 'ISO 11963'), V('≤ 3.5×10⁻³ × width, min. 2 mm')],
        ['Flatness', 'ISO 11963 / EN 16240', 'Sheet length < 13 ft (4 m)', V('≤ 0.024 in/ft', 'TUFFAK EU'), V('≤ 2 mm/m')],
        ['Flatness', 'ISO 11963 / EN 16240', 'Sheet length ≥ 13 ft (4 m)', V('≤ 0.048 in/ft', 'TUFFAK EU'), V('≤ 4 mm/m')],
        ['Dimensional change on heating (MD / TD)', 'Internal (e.g. 30 min @ 300 °F)', 'All thicknesses'],
      ], 'Width/length measured at 73 °F (23 °C). State whether tolerances apply to mill-run or cut-to-size sheet.' + (DRAFT ? ' *TUFFAK EU table partly illegible in source — units/pairing to be verified.' : '')) +
      storage('Store sheets flat on a smooth, full-size pallet, indoors, away from direct sunlight and heat sources; do not store outdoors with masking in place. Remove masking promptly after installation. Clean with mild soap and lukewarm water using a soft cloth or sponge, rinse and dry. Do not use abrasive cleaners, ammonia, acetone, benzene, MEK or chlorinated solvents.'),
  });

  // ===================== 2. TWIN WALL POLYCARBONATE =====================
  // Draft sources: Plaskolite POLYGAL first; Palram SUNLITE / LEXAN THERMOCLEAR / IMPEX / EN 16153 where POLYGAL value not found.
  docs.push({
    slug: 'Twin-Wall-Polycarbonate',
    final: true, // approved for release by US Plast (values: resin / competitor reference + US Plast data)
    code: 'TDS-PC-TW-___',
    family: 'Twin Wall / Multiwall Polycarbonate Sheet',
    subtitle: 'Extruded multiwall polycarbonate sheet with co-extruded UV protection',
    body: intro(['Greenhouses &amp; agricultural glazing', 'Skylights &amp; daylighting', 'Canopies, carports &amp; pergolas', 'Walls &amp; partitions', 'Swimming pool enclosures', 'Other: ____________________'], {
      text: 'US Plast multiwall polycarbonate sheet is a lightweight, high-strength structured panel engineered for glazing and roofing. Its hollow-rib construction traps air for thermal insulation while transmitting abundant, evenly diffused daylight. A co-extruded UV layer protects the sheet against weathering, making it a durable and economical alternative to glass.',
      features: [`Excellent thermal insulation — U-value down to ${fv('0.41')} BTU/h·ft²·°F (16 mm)`, 'High light transmission with diffused, glare-reduced daylight', `Lightweight — approx. ${fv('1/6')} the weight of glass; easy to handle and install`, 'High impact and hail resistance', 'Can be cold-curved on site; available in clear, bronze, opal and special tints'],
    }) +
      matrix('Product Data by Thickness', ['Thickness', 'Structure', 'Weight lb/ft² (kg/m²)', 'Light Trans. % (clear)', 'U-value BTU/h·ft²·°F (W/m²K)', 'R-value h·ft²·°F/BTU', 'Min. Cold Bend Radius in (mm)', 'Rib Spacing in (mm)'],
        [
          ['4 mm', V('Twin wall'), V('0.16 (0.8)', 'typ.'), V('82', 'typ.'), V('0.67 (3.8)', 'Palram'), V('1.5', 'Palram'), V('≈ 28 (700)', 'typ.')],
          ['6 mm', V('Twin wall'), V('0.27 (1.3)', 'POLYGAL'), V('80', 'SUNLITE'), V('0.63 (3.6)', 'POLYGAL'), V('1.59', 'POLYGAL'), V('34 (865)', 'THERMOCLEAR')],
          ['8 mm', V('Twin wall'), V('0.31 (1.5)', 'POLYGAL'), V('80', 'SUNLITE'), V('0.60 (3.4)', 'POLYGAL'), V('1.67', 'POLYGAL'), V('55 (1,400)', 'THERMOCLEAR')],
          ['8 mm', V('Quad wall'), V('0.33 (1.6)', 'UVPlastic'), V('71', 'UVPlastic'), V('0.45 (2.56)', 'UVPlastic'), V('2.22', 'UVPlastic'), V('≈ 55 (1,400)', 'typ.')],
          ['10 mm', V('Twin wall'), V('0.35 (1.7)', 'POLYGAL'), V('79', 'SUNLITE'), V('0.53 (3.0)', 'POLYGAL'), V('1.89', 'POLYGAL'), V('69 (1,750)', 'THERMOCLEAR')],
          ['10 mm', V('Quad wall'), V('0.39 (1.9)', 'UVPlastic'), V('71', 'UVPlastic'), V('0.42 (2.39)', 'UVPlastic'), V('2.38', 'UVPlastic'), V('≈ 69 (1,750)', 'typ.')],
          ['16 mm', V('Triple wall'), V('0.55 (2.7)', 'POLYGAL'), V('73', 'IMPEX'), V('0.41 (2.3)', 'POLYGAL'), V('2.44', 'POLYGAL'), V('110 (2,800)', 'THERMOCLEAR')],
          ['____ mm'],
        ],
        'U-value per EN ISO 10077-2 / ASTM C1363 (state method). R-value = 1 / U (imperial). Cold bend radius typically ≈ 175 × thickness' + (FINAL ? '.' : ' — confirm by test.')) +
      `<div class="avoid">` + matrix('Light Transmission &amp; Solar Heat Gain by Color', ['Thickness', 'Clear LT %', 'Clear SHGC', 'Bronze LT %', 'Bronze SHGC', 'Opal LT %', 'Opal SHGC', 'Gray / Ice LT %'],
        [
          ['4 mm', V('82', 'SUNLITE'), undefined, V('35', 'SUNLITE'), undefined, V('30', 'SUNLITE*')],
          ['6 mm', V('80', 'SUNLITE'), V('0.82', 'SUNLITE'), V('35', 'SUNLITE'), V('0.66', 'Gothic Arch'), V('30', 'Gothic Arch'), V('0.66', 'Gothic Arch')],
          ['8 mm', V('80', 'SUNLITE'), V('0.81', 'SUNLITE 10 mm'), V('35', 'SUNLITE 10 mm'), undefined, V('30', 'SUNLITE 10 mm'), undefined, V('20', 'SUNLITE 10 mm')],
          ['10 mm', V('79', 'SUNLITE'), V('0.80', 'SUNLITE AU'), V('35', 'SUNLITE AU'), V('0.55', 'SUNLITE AU'), V('30', 'SUNLITE AU'), V('0.54', 'SUNLITE AU'), V('20', 'SUNLITE')],
          ['16 mm', V('73', 'IMPEX'), V('0.75', 'Gothic Arch'), V('37', 'Gothic Arch'), V('0.57', 'Gothic Arch'), V('30', 'Gothic Arch'), V('0.44', 'Gothic Arch')],
        ],
        'Light transmission per ASTM D1003; SHGC per NFRC 200 / EN 410 (state method).' + (DRAFT && !FINAL ? ' *Opal column assignment unclear in source (OCR) — verify.' : '')) + `</div>` +
      propTable('Material Properties (Polycarbonate)', [
        ['Specific Gravity', 'ASTM D792', '—', 'g/cm³', V('1.20', 'Palram'), V('1.20', 'Palram')],
        ['Tensile Strength, Yield', 'ASTM D638', 'psi', 'MPa', V('9,000', 'typ.'), V('62', 'typ.')],
        ['Elongation at Break', 'ASTM D638', '%', '', V('110', 'typ.')],
        ['Flexural Modulus', 'ASTM D790', 'psi', 'MPa', V('345,000', 'typ.'), V('2,380', 'typ.')],
        ['Izod Impact, Notched', 'ASTM D256', 'ft-lb/in', 'J/m', V('12–16', 'typ.'), V('640–850', 'typ.')],
        ['Heat Deflection Temperature @ 264 psi', 'ASTM D648', '°F', '°C', V('270', 'typ.'), V('132', 'typ.')],
        ['Coefficient of Linear Thermal Expansion', 'ASTM D696', 'in/in·°F', 'mm/mm·°C', V('3.75 × 10⁻⁵', 'typ.'), V('6.75 × 10⁻⁵', 'typ.')],
        ['Service Temperature Range', '—', '°F', '°C', V('−40 to 250', 'typ.'), V('−40 to 121', 'typ.')],
        ['Hail Resistance (ice ball Ø / velocity)', 'Internal / FM 4473', 'in / mph', 'mm / m/s', V('PASS*', 'US Plast'), V('PASS*', 'US Plast')],
      ], DRAFT ? '* Above 8 mm.' : '') +
      resultTable('Flammability &amp; Building Code', [
        ['Surface Burning Characteristics', 'ASTM E84-01', V('Class A (NFPA); Class I (UBC)', 'US Plast')],
        ['Burn Rate / Plastic Classification', 'ASTM D635-74', V('Class CC1', 'US Plast')],
        ['Smoke Density', 'ASTM D2843-93', V('Low smoke density (UBC Standard No. 26.5)', 'US Plast')],
        ['Self-Ignition Temperature', 'ASTM D1929-68', V('Greater than 650 °F (343 °C)', 'US Plast')],
      ]) +
      matrix('Product Availability*', ['Thickness', 'Standard Widths (in)', 'Standard Lengths (ft)', 'Colors', 'UV Side(s)', 'Coatings'],
        ['4 mm', '6 mm', '8 mm', '10 mm', '16 mm'].map((t) => [t, V('48, 72', 'typ.'), V('8, 12, 24', 'typ.'), V('Clear, bronze, opal', 'SUNLITE'), V('1 (marked)', 'typ.'), V('Anti-drip (opt.)', 'typ.')]),
        '<b>* For other colors and sizes, please contact our sales team.</b>') +
      tolTable([
        ['Thickness', 'Caliper', 'All thicknesses', V('± 5 %', 'US Plast'), V('± 5 %')],
        ['Width (perpendicular to ribs)', 'Tape / EN 16153', 'All widths', V('− 0.08 / + 0.24 in', 'EN 16153'), V('− 2 / + 6 mm')],
        ['Length (parallel to ribs)', 'Tape / EN 16153', '≤ 10 ft (3 m) / > 10 ft', V('0 / + 0.47 in; 0 / + 0.40 %', 'EN 16153'), V('0 / + 12 mm; 0 / + 0.40 %')],
        ['Squareness (diagonal difference)', 'EN 16153', 'All sizes', V('Max. 0.20 in', 'US Plast'), V('Max. 5 mm')],
        ['Area weight', 'Gravimetric', 'Per thickness', V('± 5 %', 'US Plast'), V('± 5 %')],
        ['Flatness across width ("waves")', 'EN 16153', '% of width', V('≤ 0.5 % of width', 'Plaskolite'), V('≤ 0.5 % (≤ 5 mm/m)')],
        ['Planar bow ("banana")', 'EN 16153', '% of nominal length', V('≤ 0.3 % of length', 'Plaskolite'), V('≤ 0.3 %')],
      ], 'Length is defined parallel to the ribs; width perpendicular to the ribs.') +
      storage('Store sheets flat on a pallet, indoors or under an opaque cover, away from direct sunlight and heat; never store under clear plastic. Keep protective film on until installation, then remove immediately. Seal top edges with anti-dust tape and bottom edges with vented tape. Clean with mild soap and lukewarm water; do not use abrasive cleaners, ammonia or solvents.'),
  });

  // ===================== 3. TWIN WALL POLYPROPYLENE =====================
  // Draft sources: Coroplast first; Primex COR-X where Coroplast value not found.
  docs.push({
    slug: 'Twin-Wall-Polypropylene',
    code: 'TDS-PP-TW-___',
    family: 'Twin Wall (Fluted) Polypropylene Sheet',
    subtitle: 'Extruded twin wall polypropylene copolymer sheet',
    body: intro(['Signage &amp; screen / digital printing', 'Returnable packaging &amp; dividers', 'Construction floor &amp; surface protection', 'Agriculture &amp; horticulture', 'Point-of-purchase displays', 'Other: ____________________'], {
      text: 'US Plast twin wall polypropylene sheet is a lightweight, rigid fluted board made from high-impact polypropylene copolymer. It is waterproof, chemical- and stain-resistant and will not rot, warp or delaminate when wet. Corona-treated surfaces accept screen and digital printing inks, making it an economical, reusable choice for signage, packaging and protection applications.',
      features: [`Corona-treated on both sides for excellent ink adhesion (min. ${fv('46')} dyne/cm)`, 'Waterproof, moisture- and chemical-resistant; non-toxic', 'Lightweight yet rigid — easy to cut, score, fold, die-cut and fasten', 'Available UV-stabilized, flame-retardant, anti-static and in custom colors', '100 % recyclable (#5 PP)'],
    }) +
      propTable('Material Properties (Resin)', [
        ['Polymer Type', '—', 'PP homo / copolymer', '', V('Impact copolymer', 'Coroplast')],
        ['Density', 'ASTM D792', '—', 'g/cm³', V('0.90', 'Coroplast'), V('0.90', 'Coroplast')],
        ['Melt Flow Rate (230 °C / 2.16 kg)', 'ASTM D1238', 'g/10 min', ''],
        ['Tensile Strength, Yield', 'ASTM D638', 'psi', 'MPa', V('4,000', 'Coroplast'), V('27.6', 'Coroplast')],
        ['Flexural Modulus', 'ASTM D790', 'psi', 'MPa', V('150,000–200,000', 'typ.'), V('1,000–1,400', 'typ.')],
        ['Izod Impact, Notched', 'ASTM D256', 'ft-lb/in', 'J/m'],
        ['Heat Deflection Temperature @ 66 psi', 'ASTM D648', '°F', '°C', V('194', 'Coroplast'), V('90', 'Coroplast')],
        ['Brittleness Temperature', 'ASTM D746', '°F', '°C'],
        ['Service Temperature Range', '—', '°F', '°C', V('0 to 180', 'typ.'), V('−18 to 82', 'typ.')],
      ]) +
      matrix('Board Performance by Thickness', ['Property / Method', '2 mm', '3 mm', '4 mm', '5 mm', '6 mm', '8 mm', '10 mm'],
        [
          ['Board weight, g/m²', V('350–400', 'typ.'), V('500–550', 'typ.'), V('750', 'Coroplast'), V('900–1,000', 'typ.'), V('1,100–1,300', 'typ.'), undefined, V('2,130', 'COR-X')],
          ['Board weight, g/ft² (lbs/MSF)', undefined, undefined, V('70 (150)', 'Coroplast'), undefined, undefined, undefined, V('198', 'COR-X')],
          ['Edge Crush (ECT), lbf — TAPPI T811', undefined, undefined, V('> 200', 'COR-X')],
          ['Flat Crush / Compression, lbf', undefined, undefined, V('108', 'COR-X')],
          ['Corner Crush, lbf', undefined, undefined, V('195', 'COR-X')],
          ['5-Point Bend, mm @ lb', undefined, undefined, V('23.3 @ 7.5', 'COR-X')],
          ['Flute pitch, mm'],
          ['Wall thickness, mm'],
        ],
        'Values for standard (natural/white) board. Flute direction for test samples: ______________.') +
      matrix('Print &amp; Surface Characteristics', ['Property', 'Method', 'Value', 'Notes'],
        [
          ['Corona treatment level, dyne/cm', V('Dyne pens'), V('≥ 46', 'Coroplast'), V('2–12 mm')],
          ['Surface energy'],
          ['Treatment retention period'],
          ['Sides treated (1 / 2)', undefined, V('2', 'Coroplast')],
          ['Recommended inks', undefined, V('Screen &amp; digital', 'Coroplast'), V('UV print not rec. < 4 mm', 'Coroplast')],
          ['Surface resistivity (anti-static / conductive), Ω/sq', undefined, V('≤ 10⁵ (conductive)', 'COR-X')],
        ]) +
      checklist('Options', ['UV-stabilized (outdoor life ____ years)', 'Flame retardant (UL 94 ____ )', 'Anti-static / conductive', 'FDA-compliant resin (21 CFR 177.1520)', 'Post-consumer recycled content ____ %', 'Custom color matching', 'Edge-sealed / ultrasonic sealed', 'Die-cutting &amp; printing service']) +
      matrix('Product Availability*', ['Thickness', 'Standard Sizes (in)', 'Flute Direction', 'Colors', 'Pack Qty / Pallet', 'Min. Order'],
        [
          ['2–3 mm', V('48×96', 'typ.'), V('96 in', 'typ.'), V('White, natural, colors', 'Coroplast')],
          ['4 mm', V('48×96; 18×24, 24×18', 'typ.'), V('96 in / 24 in', 'typ.'), V('White, natural, colors', 'Coroplast')],
          ['5–6 mm', V('48×96', 'typ.'), V('96 in', 'typ.'), V('White, natural, colors', 'Coroplast')],
          ['8–10 mm', V('48×96', 'typ.'), V('96 in', 'typ.'), V('White, natural, black', 'typ.')],
        ], '<b>* For other colors and sizes, please contact our sales team.</b>') +
      tolTable([
        ['Thickness', 'Caliper', '2–12 mm', V('± 5 %', 'Coroplast'), V('± 5 %')],
        ['Width — standard sheet', 'Tape', '2–12 mm', V('± 1/8 in', 'Coroplast'), V('± 3 mm')],
        ['Width — square-cut sheet', 'Tape', '2–12 mm', V('± 1/8 in', 'Coroplast'), V('± 3 mm')],
        ['Length — standard sheet', 'Tape', '< 36" / 36"–60" / 60"–97"', V('0/+3/8; 0/+1/2; 0/+1 in', 'Coroplast'), V('0/+10; 0/+13; 0/+25 mm')],
        ['Length — square-cut sheet', 'Tape', 'All lengths', V('0 / + 1/8 in', 'Coroplast'), V('0 / + 3 mm')],
        ['Squareness (diagonal difference)', 'Tape', 'Standard < 60" / ≥ 60"; square-cut', V('1/4; 5/8; 1/8 in', 'Coroplast'), V('6; 16; 3 mm')],
        ['Board weight', 'Gravimetric', 'Per thickness', V('± 5 %', 'Coroplast'), V('± 5 %')],
        ['Corona treatment level (min.)', 'Dyne pens, ASTM D2578', '2–12 mm', V('46 dyne/cm', 'Coroplast'), V('46 mN/m')],
        ['Warp / bow (max. height above flat surface)', 'Internal', '< 96" / > 96" / ≥ 70" × 70"', V('1/4; 1; 2 in', 'Coroplast'), V('6; 25; 51 mm')],
        ['Edge straightness', 'Straight edge, corner to corner', 'Length < 98" / ≥ 98"', V('1/8 in (< 98")', 'Coroplast'), V('3 mm')],
      ], 'Specify flute direction for every size (e.g. 48" × 96", flutes running 96").' + (DRAFT ? ' Coroplast warp table: a 48"×96" sheet sits on the < / > 96" boundary — define our own limit.' : '')) +
      storage('Store sheets flat on a full-size pallet, indoors, away from direct sunlight and heat sources; standard (non-UV) grades are intended for short-term outdoor use only. Keep printing surfaces clean and dry; handle with clean gloves to preserve corona treatment. Clean with mild detergent and water.'),
  });

  // ===================== 4. EXTRUDED ACRYLIC =====================
  // Draft sources: Röhm ACRYLITE first; PLEXIGLAS / ASTM D4802; OPTIX (Plaskolite) where ACRYLITE value not found.
  const thkA = ['0.060', '0.093', '0.118', '0.177', '0.236', '0.375', '0.500', '1.000'];
  const mmA = ['1.5', '2.4', '3.0', '4.5', '6.0', '9.5', '12.7', '25.4'];
  docs.push({
    slug: 'Extruded-Acrylic',
    code: 'TDS-PMMA-X-___',
    family: 'Extruded Acrylic (PMMA) Sheet',
    subtitle: 'Continuously extruded acrylic sheet',
    body: intro(['Signage &amp; letters', 'Point-of-purchase displays', 'Picture framing', 'Sneeze guards &amp; protective barriers', 'Lighting &amp; LED diffusers', 'Other: ____________________'], {
      text: 'US Plast extruded acrylic sheet is a crystal-clear, continuously manufactured PMMA sheet offering outstanding optical quality, weatherability and consistent thickness. Lighter and more impact-resistant than glass, it is easy to cut, bond, thermoform and polish, making it the material of choice for signage, displays, glazing and fabricated parts.',
      features: [`Light transmission of ${fv('92')} % — optically clear with low haze`, `Approx. half the weight of glass, with up to ${fv('10–17')} times its impact strength`, 'Excellent outdoor weathering and UV stability', 'Tight thickness tolerance and low internal stress for consistent fabrication', 'Easy to laser-cut, router, solvent-bond and thermoform'],
    }) +
      propTable('Physical &amp; Optical Properties', [
        ['Specific Gravity', 'ASTM D792', '—', 'g/cm³', V('1.19', 'ACRYLITE'), V('1.19', 'ACRYLITE')],
        ['Water Absorption, 24 h', 'ASTM D570', '%', '', V('0.2', 'ACRYLITE')],
        ['Total Light Transmission (@ ____ in)', 'ASTM D1003', '%', '', V('92', 'OPTIX')],
        ['Haze', 'ASTM D1003', '%', '', V('< 1', 'typ.')],
        ['Refractive Index', 'ASTM D542', '—', '', V('1.49', 'typ.')],
      ]) +
      propTable('Mechanical Properties', [
        ['Tensile Strength', 'ASTM D638', 'psi', 'MPa', V('10,000', 'ACRYLITE'), V('69', 'ACRYLITE')],
        ['Tensile Modulus', 'ASTM D638', 'psi', 'MPa', V('450,000', 'typ.'), V('3,100', 'typ.')],
        ['Elongation at Break', 'ASTM D638', '%', '', V('4–5', 'typ.')],
        ['Flexural Strength', 'ASTM D790', 'psi', 'MPa', V('15,000–17,000', 'typ.'), V('105–117', 'typ.')],
        ['Flexural Modulus', 'ASTM D790', 'psi', 'MPa', V('400,000–480,000', 'typ.'), V('2,750–3,300', 'typ.')],
        ['Izod Impact, Molded Notch', 'ASTM D256', 'ft-lb/in', 'J/m', V('0.4', 'OPTIX'), V('21', 'OPTIX')],
        ['Izod Impact, Milled Notch', 'ASTM D256', 'ft-lb/in', 'J/m', V('0.28', 'OPTIX'), V('15', 'OPTIX')],
        ['Rockwell Hardness', 'ASTM D785', 'M scale', '', V('M-95', 'OPTIX')],
      ]) +
      propTable('Thermal Properties', [
        ['Heat Deflection Temperature @ 264 psi', 'ASTM D648', '°F', '°C', V('203', 'OPTIX'), V('95', 'OPTIX')],
        ['Heat Deflection Temperature @ 66 psi', 'ASTM D648', '°F', '°C', V('207', 'OPTIX'), V('97', 'OPTIX')],
        ['Vicat Softening Temperature', 'ASTM D1525', '°F', '°C', V('220', 'typ.'), V('105', 'typ.')],
        ['Coefficient of Linear Thermal Expansion', 'ASTM D696', 'in/in·°F', 'mm/mm·°C', V('4.0 × 10⁻⁵', 'typ.'), V('7.2 × 10⁻⁵', 'typ.')],
        ['Max. Continuous Service Temperature', '—', '°F', '°C', V('160 (190 intermittent)', 'ACRYLITE'), V('71 (88)', 'ACRYLITE')],
        ['Thermoforming Temperature Range', '—', '°F', '°C', V('290–340', 'typ.'), V('145–170', 'typ.')],
        ['Annealing Temperature', '—', '°F', '°C', V('180', 'ACRYLITE'), V('82', 'ACRYLITE')],
        ['Shrinkage (after heating, MD / TD)', 'Internal', '%', ''],
      ]) +
      flammability({
        ul94: V('HB', 'OPTIX'),
        d635: V('≈ 1.0 in/min — CC2', 'OPTIX'),
        d1929: V('≈ 850 °F (455 °C)', 'typ.'),
        e84: V('Flame spread index 115', 'OPTIX'),
      }) +
      propTable('Electrical Properties (optional)', [
        ['Dielectric Strength', 'ASTM D149', 'V/mil', 'kV/mm', V('400–500', 'typ.'), V('16–20', 'typ.')],
        ['Volume Resistivity', 'ASTM D257', 'ohm·cm', '', V('> 10¹⁵', 'typ.')],
      ]) +
      `<div class="avoid">` + matrix('Product Availability &amp; Thickness Tolerance*', ['Nominal (in)', 'Nominal (mm)', 'Tolerance (±)', 'Standard Sizes (in)', 'Colors / Finish', 'Masking'],
        thkA.map((t, i) => [DRAFT ? t + '"' : '', V(mmA[i]), V('10 %', 'typ.'), V(i === 7 ? '48×96' : '48×96, 60×96, 72×96', i === 7 ? 'OPTIX' : 'typ.'), V(i === 7 ? 'Clear' : 'Clear, white, colors', 'typ.'), V('PE film / paper', 'typ.')]),
        '<b>* For other colors and sizes, please contact our sales team.</b>') + `</div>` +
      checklist('Fabrication Suitability', ['Saw / router cutting', 'Laser cutting (CO₂)', 'CNC machining', 'Solvent cementing', 'Thermoforming / line bending', 'Flame / diamond polishing', 'Screen / digital printing', 'Drilling']) +
      tolTable([
        ['Thickness', 'ASTM D4802 / D5947', '0.060"–0.118"', V('≈ ± 10 %', 'typ.'), V('≈ ± 10 %'), V('≤ 0.125": may not meet D4802', 'A&amp;C')],
        ['Thickness', 'ASTM D4802 / D5947', '0.177"–0.236"', V('≈ ± 10 %', 'typ.'), V('≈ ± 10 %')],
        ['Thickness', 'ASTM D4802 / D5947', '0.375"–0.500"', V('≈ ± 10 %', 'typ.'), V('≈ ± 10 %')],
        ['Thickness', 'ASTM D4802 / D5947', '> 0.500"', V('≈ ± 10 %', 'typ.'), V('≈ ± 10 %')],
        ['Width', 'ASTM D4802', 'All sizes', V('+ 1/4 / − 0 in', 'ASTM D4802'), V('+ 6 / − 0 mm')],
        ['Length', 'ASTM D4802', 'All sizes', V('+ 1/4 / − 0 in', 'ASTM D4802'), V('+ 6 / − 0 mm')],
        ['Squareness (diagonal difference)', 'Internal', 'All sizes'],
        ['Overall bow warp', 'ASTM D4802 §5.6.1', 'Per 4 ft of length (sheet flat, own weight)', V('≤ 0.250 in', 'ASTM D4802'), V('≤ 6.3 mm')],
        ['Edge kink / edge "S" warp', 'ASTM D4802', 'All sheet (state: none permitted)', V('None permitted', 'ASTM D4802'), V('None permitted')],
        ['Shrinkage on heating (MD / TD)', 'Internal (e.g. 30 min @ 320 °F)', 'All thicknesses'],
      ], 'Extruded sheet shrinks mainly in the extrusion (machine) direction; state test temperature and time.') +
      storage('Store sheets flat or on A-frame racks inclined ≈ 10°, indoors, away from heat sources and direct sunlight. Keep masking on during fabrication. Clean with mild soap and lukewarm water or a plastic cleaner using a soft cloth; do not use ammonia-based glass cleaners, alcohol, acetone, gasoline or abrasive cleaners.'),
  });

  return docs;
}

// ---------- render ----------
(async () => {
  const browser = await chromium.launch();
  const pg = await browser.newPage();
  for (const mode of ['Template', 'Draft', 'Final']) {
    DRAFT = mode !== 'Template';
    FINAL = mode === 'Final';
    for (const d of buildDocs()) {
      if (FINAL && !d.final) continue;
      const file = `TDS-${mode}-${d.slug}.pdf`;
      await pg.setContent(page(d), { waitUntil: 'load' });
      await pg.pdf({
        path: path.join(OUT, file), format: 'Letter', printBackground: true, preferCSSPageSize: true,
        displayHeaderFooter: true, headerTemplate: '<span></span>',
        footerTemplate: `<div style="font-family:Inter,sans-serif;font-size:7px;color:#5b6575;width:100%;padding:0 0.6in;display:flex;justify-content:space-between"><span>US Plast · ${esc(FINAL ? d.code.replace('___', '01') : d.code)} · ${esc(d.family)} · Rev. ${FINAL ? '00' : '___'}${DRAFT && SHOW_DRAFT_MARKS && !FINAL ? ' · DRAFT' : ''}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
      });
      console.log('wrote', file);
    }
  }
  await browser.close();
})();
