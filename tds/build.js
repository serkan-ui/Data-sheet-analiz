// Generates fill-in Technical Data Sheet (TDS) templates as PDF (US Letter).
// Usage: node tds/build.js   -> outputs tds/pdf/*.pdf
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, 'pdf');
const LOGO = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, 'assets', 'usplast-logo.jpg')).toString('base64');
fs.mkdirSync(OUT, { recursive: true });

// ---------- helpers ----------
const B = '<td class="fill"></td>'; // blank fill-in cell
const blanks = (n) => B.repeat(n);
const esc = (s) => String(s);

// Property table: rows = [property, method, usUnit, siUnit]
function propTable(title, rows) {
  return `
  <h2>${title}</h2>
  <table class="props">
    <colgroup><col style="width:36%"><col style="width:16%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:12%"></colgroup>
    <thead><tr><th>Property</th><th>Test Method</th><th>Units</th><th>Value</th><th>Units (SI)</th><th>Value (SI)</th></tr></thead>
    <tbody>
    ${rows.map(([p, m, u, si]) => `<tr><td>${p}</td><td class="m">${m}</td><td class="u">${u}</td>${B}<td class="u">${si}</td>${si === '' ? '<td class="na"></td>' : B}</tr>`).join('')}
    </tbody>
  </table>`;
}

// Simple result table: rows = [property, method]
function resultTable(title, rows) {
  return `
  <h2>${title}</h2>
  <table class="props">
    <colgroup><col style="width:36%"><col style="width:22%"><col style="width:42%"></colgroup>
    <thead><tr><th>Property</th><th>Test Method / Standard</th><th>Result</th></tr></thead>
    <tbody>${rows.map(([p, m]) => `<tr><td>${p}</td><td class="m">${m}</td>${B}</tr>`).join('')}</tbody>
  </table>`;
}

// Matrix table: header cols, row labels, all blank
function matrix(title, cols, rows, note = '') {
  return `
  <h2>${title}</h2>
  <table class="matrix">
    <thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr><td class="rl">${r}</td>${blanks(cols.length - 1)}</tr>`).join('')}</tbody>
  </table>${note ? `<p class="note">${note}</p>` : ''}`;
}

function lines(title, n, hint) {
  return `<h2>${title}</h2>${hint ? `<p class="hint">${hint}</p>` : ''}<div class="lines">${'<div class="ln"></div>'.repeat(n)}</div>`;
}

function checklist(title, items) {
  return `<h2>${title}</h2><div class="checks">${items.map((i) => `<div class="ck"><span class="box"></span>${i}</div>`).join('')}</div>`;
}

const flammability = (extra = []) =>
  resultTable('Flammability &amp; Building Code', [
    ['Flammability Rating (state thickness)', 'UL 94'],
    ['Burn Rate / Plastic Classification (CC1 / CC2)', 'ASTM D635'],
    ['Self-Ignition Temperature, °F (°C)', 'ASTM D1929'],
    ['Flame Spread Index / Smoke-Developed Index', 'ASTM E84 (UL 723)'],
    ['Smoke Density Rating', 'ASTM D2843'],
    ...extra,
    ['Code Evaluation Report', 'ICC-ES ESR / IAPMO UES No.'],
    ['UL File Number', 'UL Product iQ'],
  ]);


// Dimensional tolerance table: rows = [parameter, standard/method, condition]
function tolBlank(rows, note = '') {
  return `<div class="avoid"><h2>Dimensional Tolerances</h2>
  <table class="props">
    <colgroup><col style="width:28%"><col style="width:17%"><col style="width:21%"><col style="width:12%"><col style="width:12%"><col style="width:10%"></colgroup>
    <thead><tr><th>Parameter</th><th>Standard / Method</th><th>Condition / Range</th><th>Tolerance (US)</th><th>Tolerance (SI)</th><th>Notes</th></tr></thead>
    <tbody>${rows.map(([p, m, c]) => `<tr><td>${p}</td><td class="m">${m}</td><td class="m">${c}</td>${B}${B}${B}</tr>`).join('')}</tbody>
  </table>${note ? `<p class="note">${note}</p>` : ''}</div>`;
}
const certifications = (items) =>
  checklist('Certifications &amp; Compliance', items);

const warrantyBlock = `
  <h2>Warranty</h2>
  <p class="fillline"><span class="fl w60"></span>-year limited warranty against
  <span class="fl w240"></span>. Full warranty terms: document <span class="fl w120"></span>.</p>`;

const storage = lines('Storage, Handling &amp; Cleaning', 3,
  'Store flat, indoors, protected from sunlight and heat; remove masking / protective film (if any) within ___ months of outdoor exposure. List approved / prohibited cleaning agents.');

// ---------- document shell ----------
function page({ code, family, subtitle, body }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: Letter; margin: 0.55in 0.6in 0.75in 0.6in; }
  :root { --ink:#1d2430; --muted:#5b6575; --line:#c9d0da; --accent:#0b4f8a; --fill:#f3f7fc; --head:#e7eef7; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', 'DejaVu Sans', sans-serif; color: var(--ink); font-size: 8.6pt; line-height: 1.35; margin: 0; }
  .hdr { display:flex; justify-content:space-between; align-items:stretch; border-bottom: 3px solid var(--accent); padding-bottom: 10px; margin-bottom: 12px; }
  .logo { width: 1.3in; height: 0.62in; display:flex; align-items:center; justify-content:flex-start; flex: none; }
  .logo img { max-width: 1.2in; max-height: 0.62in; object-fit: contain; }
  .titlebox { flex:1; padding: 0 16px; }
  .fam { font-size: 7.5pt; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); font-weight: 600; }
  h1 { font-size: 17pt; margin: 2px 0 2px; font-weight: 700; letter-spacing: -.01em; }
  h1 .ph { color: var(--muted); font-weight: 500; }
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
  td.m { color: var(--muted); font-size: 7.8pt; }
  td.u { color: var(--muted); font-size: 7.8pt; }
  td.fill { background: var(--fill); }
  td.na { background: repeating-linear-gradient(45deg,#fff,#fff 3px,#eef1f5 3px,#eef1f5 6px); }
  table.matrix th { text-align: center; }
  table.matrix th:first-child { text-align: left; }
  td.rl { font-weight: 600; white-space: nowrap; background: #fff; }
  .note, .hint { color: var(--muted); font-size: 7.4pt; margin: 3px 0 0; }
  .hint { margin: 0 0 4px; font-style: italic; }
  .lines .ln { border-bottom: 1px solid var(--line); height: 18px; background: var(--fill); margin-bottom: 3px; }
  .checks { display:grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; }
  .ck { display:flex; align-items:center; gap:7px; padding: 2px 0; }
  .box { width: 10px; height: 10px; border: 1.2px solid var(--muted); display:inline-block; flex: none; }
  .ck .fl { margin-left: auto; }
  .fl { display:inline-block; border-bottom: 1px solid var(--muted); background: var(--fill); height: 13px; vertical-align: bottom; }
  .w60{width:.6in}.w120{width:1.2in}.w240{width:2.4in}
  .fillline { margin: 4px 0; line-height: 2; }
  .two { display:grid; grid-template-columns: 1fr 1fr; gap: 0 18px; }
  .disc { margin-top: 16px; padding: 8px 10px; border-left: 3px solid var(--accent); background: #f6f8fb; font-size: 7.2pt; color: var(--muted); break-inside: avoid; }
  .avoid { break-inside: avoid; }
  </style></head><body>
  <div class="hdr">
    <div class="logo"><img src="${LOGO}" alt="US Plast"></div>
    <div class="titlebox">
      <div class="fam">Technical Data Sheet · ${family}</div>
      <h1>[BRAND]™ <span class="ph">[Product Name] [Grade]</span></h1>
      <div class="sub">${subtitle}</div>
    </div>
    <table class="meta">
      <tr><td>Doc. No.</td><td>${code}</td></tr>
      <tr><td>Revision</td><td></td></tr>
      <tr><td>Issue Date</td><td></td></tr>
      <tr><td>Supersedes</td><td></td></tr>
    </table>
  </div>
  ${body}
  <div class="disc"><b>Disclaimer.</b> The information contained herein represents typical values and is not intended for specification purposes. Values may vary with thickness, color, finish and test conditions. It is the user's responsibility to determine the suitability of this product for the intended application and to comply with applicable building codes. Refer to the Safety Data Sheet (SDS) for handling information.<br><br>
  <b>US Plast</b> · [US Address] · [Phone] · [Email] · [Website]</div>
  </body></html>`;
}

const intro = (apps) => `
  <div class="two">
    <div>${lines('Product Description', 4)}</div>
    <div><h2>Typical Applications</h2><div class="checks" style="grid-template-columns:1fr">${apps.map((a) => `<div class="ck"><span class="box"></span>${a}</div>`).join('')}</div></div>
  </div>`;

// ---------- product definitions ----------
const docs = [];

// 1. SOLID POLYCARBONATE
docs.push({
  file: 'TDS-Template-Solid-Polycarbonate.pdf',
  code: 'TDS-PC-S-___',
  family: 'Solid Polycarbonate Sheet',
  subtitle: 'Extruded, UV-protected solid polycarbonate sheet',
  body: intro(['Glazing &amp; skylights', 'Machine guards &amp; protective barriers', 'Signage &amp; displays', 'Security / vandal-resistant glazing', 'Thermoformed parts', 'Other: ____________________']) +
    propTable('Physical Properties', [
      ['Specific Gravity', 'ASTM D792', '—', 'g/cm³'],
      ['Water Absorption, 24 h', 'ASTM D570', '%', ''],
    ]) +
    propTable('Optical Properties', [
      ['Light Transmission, clear (@ ____ in)', 'ASTM D1003', '%', ''],
      ['Haze', 'ASTM D1003', '%', ''],
      ['Refractive Index', 'ASTM D542', '—', ''],
      ['Yellowness Index', 'ASTM E313', '—', ''],
    ]) +
    propTable('Mechanical Properties', [
      ['Tensile Strength, Yield', 'ASTM D638', 'psi', 'MPa'],
      ['Tensile Modulus', 'ASTM D638', 'psi', 'MPa'],
      ['Elongation at Break', 'ASTM D638', '%', ''],
      ['Flexural Strength', 'ASTM D790', 'psi', 'MPa'],
      ['Flexural Modulus', 'ASTM D790', 'psi', 'MPa'],
      ['Izod Impact, Notched (1/8")', 'ASTM D256', 'ft-lb/in', 'J/m'],
      ['Instrumented Impact, Total Energy (@ ____ in)', 'ASTM D3763', 'ft-lb', 'J'],
      ['Rockwell Hardness', 'ASTM D785', 'M / R scale', ''],
    ]) +
    propTable('Thermal Properties', [
      ['Heat Deflection Temperature @ 264 psi', 'ASTM D648', '°F', '°C'],
      ['Heat Deflection Temperature @ 66 psi', 'ASTM D648', '°F', '°C'],
      ['Vicat Softening Temperature', 'ASTM D1525', '°F', '°C'],
      ['Coefficient of Linear Thermal Expansion', 'ASTM D696', 'in/in·°F', 'mm/mm·°C'],
      ['Thermal Conductivity', 'ASTM C177', 'BTU·in/h·ft²·°F', 'W/m·K'],
      ['Max. Continuous Service Temperature', '—', '°F', '°C'],
      ['Thermoforming Temperature Range', '—', '°F', '°C'],
    ]) +
    flammability([['Safety Glazing', 'ANSI Z97.1 / CPSC 16 CFR 1201'], ['Bullet Resistance (if applicable)', 'UL 752 Level']]) +
    `<div class="avoid">` + matrix('Product Availability', ['Thickness (in)', 'Thickness (mm)', 'Tolerance (±)', 'Standard Sizes (in)', 'Max Width × Length', 'Colors / Finish'], ['', '', '', '', '', '', ''], 'Masking: ☐ PE film  ☐ Paper  ☐ Laser-compatible   ·   UV protection: ☐ One side  ☐ Two sides  ☐ None   ·   Coatings: ☐ Abrasion-resistant  ☐ Matte  ☐ Light-diffusing') + `</div>` +
    tolBlank([
      ['Thickness', 'ASTM D5947', '≤ 0.118" (3 mm)'],
      ['Thickness', 'ASTM D5947', '0.118"–0.236" (3–6 mm)'],
      ['Thickness', 'ASTM D5947', '> 0.236" (6 mm)'],
      ['Thickness variation within sheet', 'ASTM D5947', 'Max – min, same sheet'],
      ['Width', 'ISO 11963', 'All sizes'],
      ['Length', 'ISO 11963', 'All sizes'],
      ['Squareness (diagonal difference)', 'ISO 11963', 'All sizes'],
      ['Flatness', 'ISO 11963 / EN 16240', 'Sheet length < 13 ft (4 m)'],
      ['Flatness', 'ISO 11963 / EN 16240', 'Sheet length ≥ 13 ft (4 m)'],
      ['Dimensional change on heating (MD / TD)', 'Internal (e.g. 30 min @ 300 °F)', 'All thicknesses'],
    ], 'Width/length measured at 73 °F (23 °C). State whether tolerances apply to mill-run or cut-to-size sheet.') +
    certifications(['ICC-ES Evaluation Report', 'UL Recognized (file no.)', 'ANSI Z97.1 / CPSC 16 CFR 1201', 'Florida Product Approval', 'FDA 21 CFR 177.1580 (resin)', 'ISO 9001 Quality System', 'California Prop 65 statement', 'REACH / RoHS']) +
    warrantyBlock + storage,
});

// 2. TWIN WALL POLYCARBONATE
docs.push({
  file: 'TDS-Template-Twin-Wall-Polycarbonate.pdf',
  code: 'TDS-PC-TW-___',
  family: 'Twin Wall / Multiwall Polycarbonate Sheet',
  subtitle: 'Extruded multiwall polycarbonate sheet with co-extruded UV protection',
  body: intro(['Greenhouses &amp; agricultural glazing', 'Skylights &amp; daylighting', 'Canopies, carports &amp; pergolas', 'Walls &amp; partitions', 'Swimming pool enclosures', 'Other: ____________________']) +
    matrix('Product Data by Thickness', ['Thickness', 'Structure', 'Weight lb/ft² (kg/m²)', 'Light Trans. % (clear)', 'U-value BTU/h·ft²·°F (W/m²K)', 'R-value h·ft²·°F/BTU', 'Min. Cold Bend Radius in (mm)', 'Rib Spacing in (mm)'],
      ['4 mm', '6 mm', '8 mm', '10 mm', '16 mm', '____ mm'],
      'U-value per EN ISO 10077-2 / ASTM C1363 (state method). R-value = 1 / U (imperial). Cold bend radius typically ≈ 175 × thickness — confirm by test.') +
    matrix('Light Transmission &amp; Solar Heat Gain by Color', ['Thickness', 'Clear LT %', 'Clear SHGC', 'Bronze LT %', 'Bronze SHGC', 'Opal LT %', 'Opal SHGC', 'Gray / Ice LT %'],
      ['4 mm', '6 mm', '8 mm', '10 mm', '16 mm'],
      'Light transmission per ASTM D1003; SHGC per NFRC 200 / EN 410 (state method).') +
    propTable('Material Properties (Polycarbonate)', [
      ['Specific Gravity', 'ASTM D792', '—', 'g/cm³'],
      ['Tensile Strength, Yield', 'ASTM D638', 'psi', 'MPa'],
      ['Elongation at Break', 'ASTM D638', '%', ''],
      ['Flexural Modulus', 'ASTM D790', 'psi', 'MPa'],
      ['Izod Impact, Notched', 'ASTM D256', 'ft-lb/in', 'J/m'],
      ['Heat Deflection Temperature @ 264 psi', 'ASTM D648', '°F', '°C'],
      ['Coefficient of Linear Thermal Expansion', 'ASTM D696', 'in/in·°F', 'mm/mm·°C'],
      ['Service Temperature Range', '—', '°F', '°C'],
      ['Hail Resistance (ice ball Ø / velocity)', 'Internal / FM 4473', 'in / mph', 'mm / m/s'],
    ]) +
    `<div class="avoid">` + matrix('Load / Span Table (Allowable Uniform Load, psf)', ['Thickness', 'Span 24 in', 'Span 32 in', 'Span 40 in', 'Span 48 in', 'Span 60 in', 'Span 72 in'],
      ['6 mm', '8 mm', '10 mm', '16 mm'], 'State support condition (two-edge / four-edge), rib direction and deflection limit (e.g. L/20).') + `</div>` +
    flammability() +
    matrix('Product Availability', ['Thickness', 'Standard Widths (in)', 'Standard Lengths (ft)', 'Colors', 'UV Side(s)', 'Coatings'], ['4 mm', '6 mm', '8 mm', '10 mm', '16 mm'],
      'Coatings: ☐ Anti-drip / condensation control  ☐ IR-reflective / solar control  ☐ Diffuser   ·   Accessories: ☐ H-profile  ☐ U-profile  ☐ Vent tape  ☐ Anti-dust tape  ☐ Fasteners') +
    tolBlank([
      ['Thickness', 'Caliper', '4–10 mm'],
      ['Thickness', 'Caliper', '16 mm and above'],
      ['Width (perpendicular to ribs)', 'Tape / EN 16153', 'All widths'],
      ['Length (parallel to ribs)', 'Tape / EN 16153', 'All lengths'],
      ['Squareness (diagonal difference)', 'EN 16153', 'All sizes'],
      ['Area weight', 'Gravimetric', 'Per thickness'],
      ['Flatness across width ("waves")', 'EN 16153', '% of width or in/ft (mm/m)'],
      ['Planar bow ("banana")', 'EN 16153', '% of nominal length'],
      ['Lateral curvature (edge straightness)', 'EN 16153 §5.1.12', 'All lengths'],
      ['Thermal expansion allowance (installation)', 'Guide value', 'Per ft (m) of length/width'],
    ], 'Length is defined parallel to the ribs; width perpendicular to the ribs.') +
    certifications(['ICC-ES Evaluation Report', 'UL Recognized (file no.)', 'Florida Product Approval', 'Miami-Dade NOA', 'ISO 9001 Quality System', 'California Prop 65 statement']) +
    warrantyBlock + storage,
});

// 3. TWIN WALL POLYPROPYLENE
docs.push({
  file: 'TDS-Template-Twin-Wall-Polypropylene.pdf',
  code: 'TDS-PP-TW-___',
  family: 'Twin Wall (Fluted) Polypropylene Sheet',
  subtitle: 'Extruded twin wall polypropylene copolymer sheet',
  body: intro(['Signage &amp; screen / digital printing', 'Returnable packaging &amp; dividers', 'Construction floor &amp; surface protection', 'Agriculture &amp; horticulture', 'Point-of-purchase displays', 'Other: ____________________']) +
    propTable('Material Properties (Resin)', [
      ['Polymer Type', '—', 'PP homo / copolymer', ''],
      ['Density', 'ASTM D792', '—', 'g/cm³'],
      ['Melt Flow Rate (230 °C / 2.16 kg)', 'ASTM D1238', 'g/10 min', ''],
      ['Tensile Strength, Yield', 'ASTM D638', 'psi', 'MPa'],
      ['Flexural Modulus', 'ASTM D790', 'psi', 'MPa'],
      ['Izod Impact, Notched', 'ASTM D256', 'ft-lb/in', 'J/m'],
      ['Heat Deflection Temperature @ 66 psi', 'ASTM D648', '°F', '°C'],
      ['Brittleness Temperature', 'ASTM D746', '°F', '°C'],
      ['Service Temperature Range', '—', '°F', '°C'],
    ]) +
    matrix('Board Performance by Thickness', ['Property / Method', '2 mm', '3 mm', '4 mm', '5 mm', '6 mm', '8 mm', '10 mm'],
      ['Board weight, g/m²', 'Board weight, g/ft² (lbs/MSF)', 'Edge Crush (ECT), lbf — TAPPI T811', 'Flat Crush / Compression, lbf', 'Corner Crush, lbf', '5-Point Bend, mm @ lb', 'Flute pitch, mm', 'Wall thickness, mm'],
      'Values for standard (natural/white) board. Flute direction for test samples: ______________.') +
    matrix('Print &amp; Surface Characteristics', ['Property', 'Method', 'Value', 'Notes'],
      ['Corona treatment level, dyne/cm', 'Surface energy', 'Treatment retention period', 'Sides treated (1 / 2)', 'Recommended inks', 'Surface resistivity (anti-static / conductive), Ω/sq']) +
    checklist('Options', ['UV-stabilized (outdoor life ____ years)', 'Flame retardant (UL 94 ____ )', 'Anti-static / conductive', 'FDA-compliant resin (21 CFR 177.1520)', 'Post-consumer recycled content ____ %', 'Custom color matching', 'Edge-sealed / ultrasonic sealed', 'Die-cutting &amp; printing service']) +
    matrix('Product Availability', ['Thickness', 'Standard Sizes (in)', 'Flute Direction', 'Colors', 'Pack Qty / Pallet', 'Min. Order'], ['2–3 mm', '4 mm', '5–6 mm', '8–10 mm']) +
    tolBlank([
      ['Thickness', 'Caliper', '2–12 mm'],
      ['Width — standard sheet', 'Tape', '2–12 mm'],
      ['Width — square-cut sheet', 'Tape', '2–12 mm'],
      ['Length — standard sheet', 'Tape', '< 36" / 36"–60" / 60"–97"'],
      ['Length — square-cut sheet', 'Tape', 'All lengths'],
      ['Squareness (diagonal difference)', 'Tape', 'Standard < 60" / ≥ 60"; square-cut'],
      ['Board weight', 'Gravimetric', 'Per thickness'],
      ['Corona treatment level (min.)', 'Dyne pens, ASTM D2578', '2–12 mm'],
      ['Warp / bow (max. height above flat surface)', 'Internal', '< 96" / > 96" / ≥ 70" × 70"'],
      ['Edge straightness', 'Straight edge, corner to corner', 'Length < 98" / ≥ 98"'],
    ], 'Specify flute direction for every size (e.g. 48" × 96", flutes running 96").') +
    certifications(['FDA resin compliance letter', 'UL 94 listing (FR grade)', '100% recyclable (#5 PP)', 'PCR content certification', 'ISO 9001 Quality System', 'California Prop 65 statement']) +
    storage,
});

// 4. EXTRUDED ACRYLIC
docs.push({
  file: 'TDS-Template-Extruded-Acrylic.pdf',
  code: 'TDS-PMMA-X-___',
  family: 'Extruded Acrylic (PMMA) Sheet',
  subtitle: 'Continuously extruded acrylic sheet',
  body: intro(['Signage &amp; letters', 'Point-of-purchase displays', 'Picture framing', 'Sneeze guards &amp; protective barriers', 'Lighting &amp; LED diffusers', 'Other: ____________________']) +
    propTable('Physical &amp; Optical Properties', [
      ['Specific Gravity', 'ASTM D792', '—', 'g/cm³'],
      ['Water Absorption, 24 h', 'ASTM D570', '%', ''],
      ['Total Light Transmission (@ ____ in)', 'ASTM D1003', '%', ''],
      ['Haze', 'ASTM D1003', '%', ''],
      ['Refractive Index', 'ASTM D542', '—', ''],
    ]) +
    propTable('Mechanical Properties', [
      ['Tensile Strength', 'ASTM D638', 'psi', 'MPa'],
      ['Tensile Modulus', 'ASTM D638', 'psi', 'MPa'],
      ['Elongation at Break', 'ASTM D638', '%', ''],
      ['Flexural Strength', 'ASTM D790', 'psi', 'MPa'],
      ['Flexural Modulus', 'ASTM D790', 'psi', 'MPa'],
      ['Izod Impact, Molded Notch', 'ASTM D256', 'ft-lb/in', 'J/m'],
      ['Izod Impact, Milled Notch', 'ASTM D256', 'ft-lb/in', 'J/m'],
      ['Rockwell Hardness', 'ASTM D785', 'M scale', ''],
    ]) +
    propTable('Thermal Properties', [
      ['Heat Deflection Temperature @ 264 psi', 'ASTM D648', '°F', '°C'],
      ['Heat Deflection Temperature @ 66 psi', 'ASTM D648', '°F', '°C'],
      ['Vicat Softening Temperature', 'ASTM D1525', '°F', '°C'],
      ['Coefficient of Linear Thermal Expansion', 'ASTM D696', 'in/in·°F', 'mm/mm·°C'],
      ['Max. Continuous Service Temperature', '—', '°F', '°C'],
      ['Thermoforming Temperature Range', '—', '°F', '°C'],
      ['Annealing Temperature', '—', '°F', '°C'],
      ['Shrinkage (after heating, MD / TD)', 'Internal', '%', ''],
    ]) +
    flammability() +
    propTable('Electrical Properties (optional)', [
      ['Dielectric Strength', 'ASTM D149', 'V/mil', 'kV/mm'],
      ['Volume Resistivity', 'ASTM D257', 'ohm·cm', ''],
    ]) +
    `<div class="avoid">` + matrix('Product Availability &amp; Thickness Tolerance', ['Nominal (in)', 'Nominal (mm)', 'Tolerance (±)', 'Standard Sizes (in)', 'Colors / Finish', 'Masking'], ['', '', '', '', '', '', '', ''],
      'Series: ☐ Clear  ☐ White / LED  ☐ Colors  ☐ Patterned  ☐ Non-glare  ☐ Abrasion-resistant  ☐ UV-filtering  ☐ Mirror  ☐ Frosted  ☐ Recycled content') + `</div>` +
    checklist('Fabrication Suitability', ['Saw / router cutting', 'Laser cutting (CO₂)', 'CNC machining', 'Solvent cementing', 'Thermoforming / line bending', 'Flame / diamond polishing', 'Screen / digital printing', 'Drilling']) +
    tolBlank([
      ['Thickness', 'ASTM D4802 / D5947', '0.060"–0.118"'],
      ['Thickness', 'ASTM D4802 / D5947', '0.177"–0.236"'],
      ['Thickness', 'ASTM D4802 / D5947', '0.375"–0.500"'],
      ['Thickness', 'ASTM D4802 / D5947', '> 0.500"'],
      ['Width', 'ASTM D4802', 'All sizes'],
      ['Length', 'ASTM D4802', 'All sizes'],
      ['Squareness (diagonal difference)', 'Internal', 'All sizes'],
      ['Overall bow warp', 'ASTM D4802 §5.6.1', 'Per 4 ft of length (sheet flat, own weight)'],
      ['Edge kink / edge "S" warp', 'ASTM D4802', 'All sheet (state: none permitted)'],
      ['Shrinkage on heating (MD / TD)', 'Internal (e.g. 30 min @ 320 °F)', 'All thicknesses'],
    ], 'Extruded sheet shrinks mainly in the extrusion (machine) direction; state test temperature and time.') +
    certifications(['UL Recognized (file no.)', 'ICC-ES Evaluation Report', 'FDA 21 CFR 177.1010 (resin)', 'NSF / ANSI 51', 'ISO 9001 Quality System', 'California Prop 65 statement']) +
    warrantyBlock + storage,
});

// ---------- render ----------
(async () => {
  const browser = await chromium.launch();
  const pg = await browser.newPage();
  for (const d of docs) {
    await pg.setContent(page(d), { waitUntil: 'load' });
    await pg.pdf({
      path: path.join(OUT, d.file), format: 'Letter', printBackground: true, preferCSSPageSize: true,
      displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-family:Inter,sans-serif;font-size:7px;color:#5b6575;width:100%;padding:0 0.6in;display:flex;justify-content:space-between"><span>${esc(d.code)} · ${esc(d.family)} · Rev. ___</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
    console.log('wrote', d.file);
  }
  await browser.close();
})();
