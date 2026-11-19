// Competitor benchmark versions of the TDS templates (reference only, internal use).
// Usage: node tds/benchmark.js  -> outputs tds/pdf/benchmark/*.pdf
// Status codes: K = value found in a published competitor source; T = typical industry value, NOT verified;
//               N = not retrieved / not published in sources found.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, 'pdf', 'benchmark');
fs.mkdirSync(OUT, { recursive: true });

const badge = (s) => `<span class="b b${s}">${s}</span>`;

// rows: [property, method, valueUS, valueSI, reference, status]
function props(title, rows) {
  return `<h2>${title}</h2><table class="props">
  <colgroup><col style="width:30%"><col style="width:14%"><col style="width:17%"><col style="width:15%"><col style="width:19%"><col style="width:5%"></colgroup>
  <thead><tr><th>Property</th><th>Test Method</th><th>Value (US)</th><th>Value (SI)</th><th>Reference (competitor)</th><th></th></tr></thead>
  <tbody>${rows.map(([p, m, us, si, ref, st]) => `<tr><td>${p}</td><td class="m">${m}</td><td class="v">${us}</td><td class="v">${si}</td><td class="r">${ref}</td><td class="c">${badge(st)}</td></tr>`).join('')}</tbody></table>`;
}

// cols: header labels; rows: arrays of cell strings (first = row label). Cell may end with " |K" / " |T" / " |N".
function cell(c) {
  const m = /^(.*) \|([KTN])$/.exec(c);
  return m ? `<td class="v">${m[1]} ${badge(m[2])}</td>` : `<td class="v">${c}</td>`;
}
function matrix(title, cols, rows, note = '') {
  return `<h2>${title}</h2><table class="matrix"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr><td class="rl">${r[0]}</td>${r.slice(1).map(cell).join('')}</tr>`).join('')}</tbody></table>${note ? `<p class="note">${note}</p>` : ''}`;
}

// items: [label, detail, status]
function list(title, items) {
  return `<h2>${title}</h2><table class="props"><colgroup><col style="width:36%"><col style="width:59%"><col style="width:5%"></colgroup>
  <tbody>${items.map(([l, d, s]) => `<tr><td>${l}</td><td class="r">${d}</td><td class="c">${badge(s)}</td></tr>`).join('')}</tbody></table>`;
}

const para = (title, html) => `<h2>${title}</h2><p class="para">${html}</p>`;

function page({ code, family, refs, body, sources }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: Letter; margin: 0.55in 0.6in 0.75in 0.6in; }
  :root { --ink:#1d2430; --muted:#5b6575; --line:#c9d0da; --accent:#7a3e00; --head:#f4ece3; }
  * { box-sizing:border-box; }
  body { font-family:'Inter','DejaVu Sans',sans-serif; color:var(--ink); font-size:8.3pt; line-height:1.35; margin:0; }
  .ribbon { background:#7a3e00; color:#fff; font-weight:700; letter-spacing:.12em; text-transform:uppercase; font-size:7.6pt; padding:5px 10px; text-align:center; }
  .hdr { display:flex; justify-content:space-between; gap:16px; border-bottom:3px solid var(--accent); padding:10px 0; margin-bottom:8px; }
  .fam { font-size:7.5pt; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); font-weight:600; }
  h1 { font-size:16pt; margin:2px 0; letter-spacing:-.01em; }
  .sub { color:var(--muted); font-size:8pt; }
  .meta { font-size:7.4pt; border-collapse:collapse; width:2.2in; flex:none; align-self:flex-start; }
  .meta td { padding:2px 6px; border:1px solid var(--line); }
  .meta td:first-child { color:var(--muted); background:var(--head); white-space:nowrap; }
  .legend { display:flex; gap:14px; flex-wrap:wrap; font-size:7.4pt; color:var(--muted); background:#faf7f3; border:1px solid var(--line); padding:6px 8px; margin-bottom:4px; }
  h2 { font-size:9.4pt; color:var(--accent); text-transform:uppercase; letter-spacing:.06em; margin:12px 0 5px; padding-bottom:2px; border-bottom:1px solid var(--line); break-after:avoid; }
  table { width:100%; border-collapse:collapse; }
  tr { break-inside:avoid; }
  th { background:var(--head); text-align:left; font-weight:600; font-size:7.6pt; padding:4px 6px; border:1px solid var(--line); }
  td { padding:3px 6px; border:1px solid var(--line); vertical-align:middle; }
  td.m, td.r { color:var(--muted); font-size:7.5pt; }
  td.v { font-weight:500; }
  td.c { text-align:center; }
  td.rl { font-weight:600; white-space:nowrap; }
  table.matrix th { text-align:center; } table.matrix th:first-child { text-align:left; }
  table.matrix td.v { text-align:center; font-size:7.8pt; }
  .b { display:inline-block; min-width:13px; padding:0 3px; border-radius:3px; font-size:6.6pt; font-weight:700; text-align:center; line-height:1.5; }
  .bK { background:#dcefe2; color:#1c6b3a; } .bT { background:#fbe7c6; color:#8a5300; } .bN { background:#e6e9ee; color:#5b6575; }
  .note { color:var(--muted); font-size:7.2pt; margin:3px 0 0; }
  .para { margin:3px 0; }
  .src { font-size:6.9pt; color:var(--muted); margin-top:12px; break-inside:avoid; }
  .src ol { margin:3px 0 0 14px; padding:0; } .src li { word-break:break-all; }
  .disc { margin-top:12px; padding:8px 10px; border-left:3px solid var(--accent); background:#faf7f3; font-size:7.2pt; color:var(--muted); break-inside:avoid; }
  </style></head><body>
  <div class="ribbon">Competitor Benchmark — Internal Reference Only — Not Our Product Data — Do Not Distribute</div>
  <div class="hdr"><div>
    <div class="fam">Competitor Benchmark · ${family}</div>
    <h1>US Market Typical Values</h1>
    <div class="sub">Benchmarked against: ${refs}</div></div>
    <table class="meta"><tr><td>Doc. No.</td><td>${code}</td></tr><tr><td>Compiled</td><td>11/2026</td></tr><tr><td>Purpose</td><td>TDS gap analysis</td></tr></table>
  </div>
  <div class="legend"><span>${badge('K')} Value found in a published competitor source</span><span>${badge('T')} Typical industry value — <b>verify</b> before use</span><span>${badge('N')} Not retrieved / not published in sources found</span></div>
  ${body}
  <div class="src"><b>Sources</b><ol>${sources.map((s) => `<li>${s}</li>`).join('')}</ol></div>
  <div class="disc">Values were compiled from competitors' publicly available literature and distributor copies, and from typical industry values for the material class. They are for internal comparison only, may be out of date, and are not specifications. All trademarks belong to their respective owners. Confirm every value against the competitor's current data sheet before drawing conclusions.</div>
  </body></html>`;
}

const docs = [];

// ===================== 1. SOLID POLYCARBONATE =====================
docs.push({
  file: 'Benchmark-Solid-Polycarbonate.pdf', code: 'BM-PC-S-01', family: 'Solid Polycarbonate Sheet',
  refs: 'TUFFAK® GP (Plaskolite), LEXAN™ 9034 (Polyvantis, ex-SABIC), PALSUN® (Palram), Makrolon® GP',
  body:
    props('Physical Properties', [
      ['Specific Gravity', 'ASTM D792', '1.20', '1.20 g/cm³', 'TUFFAK GP; PALSUN', 'K'],
      ['Water Absorption, 24 h', 'ASTM D570', '0.15 %', '0.15 %', 'PALSUN', 'K'],
    ]) +
    props('Optical Properties', [
      ['Light Transmission, clear @ 0.118"', 'ASTM D1003', '86 %', '86 % (3 mm)', 'TUFFAK GP', 'K'],
      ['Haze', 'ASTM D1003', '< 1 %', '< 1 %', 'Industry typical', 'T'],
      ['Refractive Index', 'ASTM D542', '1.586', '1.586', 'TUFFAK GP', 'K'],
      ['Yellowness Index', 'ASTM E313', '—', '—', 'Not published in sources found', 'N'],
    ]) +
    props('Mechanical Properties', [
      ['Tensile Strength, Yield', 'ASTM D638', '9,000 psi', '62 MPa', 'LEXAN 9034', 'K'],
      ['Tensile Strength, Ultimate', 'ASTM D638', '9,500 psi', '65 MPa', 'LEXAN 9034', 'K'],
      ['Tensile Modulus', 'ASTM D638', '≈ 345,000 psi', '≈ 2,380 MPa', 'Industry typical', 'T'],
      ['Elongation at Break', 'ASTM D638', '≈ 110 %', '≈ 110 %', 'Industry typical', 'T'],
      ['Flexural Strength', 'ASTM D790', '≈ 13,500 psi', '≈ 93 MPa', 'Industry typical', 'T'],
      ['Flexural Modulus', 'ASTM D790', '345,000 psi', '2,380 MPa', 'LEXAN 9034', 'K'],
      ['Izod Impact, Notched (1/8")', 'ASTM D256', '12–16 ft-lb/in', '640–850 J/m', 'LEXAN 9034 (GE-era sheet)', 'K'],
      ['Izod Impact, Unnotched', 'ASTM D256', '60 ft-lb/in, no break', '—', 'LEXAN 9034 (GE-era sheet)', 'K'],
      ['Instrumented Impact, Total Energy', 'ASTM D3763', '≈ 45 ft-lb @ 0.125"', '≈ 60 J', 'Industry typical', 'T'],
      ['Rockwell Hardness', 'ASTM D785', 'M70 / R118', '—', 'Industry typical', 'T'],
    ]) +
    props('Thermal Properties', [
      ['Heat Deflection Temp. @ 264 psi', 'ASTM D648', '270 °F', '132 °C', 'Industry typical', 'T'],
      ['Heat Deflection Temp. @ 66 psi', 'ASTM D648', '280 °F', '138 °C', 'Industry typical', 'T'],
      ['Vicat Softening Temperature', 'ASTM D1525', '≈ 300 °F', '≈ 149 °C', 'Industry typical', 'T'],
      ['Coeff. of Linear Thermal Expansion', 'ASTM D696', '3.75 × 10⁻⁵ in/in·°F', '6.75 × 10⁻⁵ /°C', 'Industry typical', 'T'],
      ['Thermal Conductivity', 'ASTM C177', '1.35 BTU·in/h·ft²·°F', '0.19 W/m·K', 'Industry typical', 'T'],
      ['Max. Continuous Service Temp.', '—', '240–250 °F', '115–121 °C', 'Industry typical', 'T'],
      ['Thermoforming Temperature', '—', '340–400 °F', '170–205 °C', 'Industry typical (pre-dry sheet)', 'T'],
    ]) +
    props('Flammability &amp; Building Code', [
      ['UL 94 Rating', 'UL 94', 'HB @ 0.060"; V-0 @ 0.394"', '—', 'TUFFAK GP (V-0 ≥ 0.220" on some grades)', 'K'],
      ['Plastic Classification', 'ASTM D635', 'CC1 (thickness dependent)', '—', 'PALSUN — ICC-ES ESR-1893', 'K'],
      ['Self-Ignition Temperature', 'ASTM D1929', '≈ 1,080 °F', '≈ 580 °C', 'Industry typical', 'T'],
      ['Smoke-Developed Index', 'ASTM E84', '≤ 450', '—', 'Palram — ICC-ES ESR-1893', 'K'],
      ['Smoke Density Rating', 'ASTM D2843', 'Reported in ESR', '—', 'Palram — ESR-1893 (value not retrieved)', 'K'],
      ['European Reaction to Fire', 'EN 13501-1', 'B-s1, d0', '—', 'PALSUN', 'K'],
      ['Code Evaluation Report', 'ICC-ES', 'ESR-1893', '—', 'Palram (PALSUN, SUNLITE)', 'K'],
    ]) +
    matrix('Product Availability (typical US offering)', ['Thickness (in)', 'Thickness (mm)', 'Tolerance', 'Standard Sizes (in)', 'Status'],
      [['0.060"', '1.5', '±10 %', '48×96', 'T'], ['0.093"', '2.4', '±10 %', '48×96, 60×96, 72×96', 'T'], ['0.118"', '3.0', '±10 %', '48×96, 60×96, 72×96', 'T'], ['0.177"', '4.5', '±10 %', '48×96, 60×96, 72×96', 'T'], ['0.236"', '6.0', '±10 %', '48×96, 60×96, 72×96', 'T'], ['0.375"', '9.5', '±10 %', '48×96, 60×96, 72×96', 'T'], ['0.500"', '12.7', '±10 %', '48×96, 60×96, 72×96', 'T']].map((r) => [...r.slice(0, 4), r[4] === 'T' ? '<span class="b bT">T</span>' : r[4]]),
      'Typical options: PE film masking (laser-compatible available), UV-protected one/two sides, abrasion-resistant coated (TUFFAK AR, LEXAN MARGARD), matte, light-diffusing (TUFFAK LF).') +
    list('Warranty (published)', [
      ['TUFFAK GP / Makrolon GP', '5-year limited warranty against breakage', 'K'],
      ['TUFFAK AR', '7-year limited warranty: breakage, yellowing, hazing', 'K'],
      ['TUFFAK 15', '15-year limited warranty', 'K'],
    ]) +
    list('Certifications commonly claimed', [
      ['ICC-ES Evaluation Report', 'Palram ESR-1893', 'K'],
      ['UL recognition (UL 94)', 'Plaskolite TUFFAK, LEXAN', 'K'],
      ['ANSI Z97.1 / CPSC 16 CFR 1201', 'Safety glazing grades', 'T'],
      ['UL 752 bullet resistance', 'Security grades (e.g. MARGARD, TUFFAK security)', 'T'],
    ]),
  sources: [
    'Plaskolite TUFFAK GP PDS — plaskolite.com/docs/default-source/pds/pds004_tuf_gp.pdf; A&amp;C Plastics TUFFAK GP product data',
    'Palram PALSUN physical properties — piedmontplastics.com/resources/literatures/palram-palsunR-palsunR-cs-physical-properties',
    'LEXAN 9034 data sheet — usplastic.com/catalog/files/specsheets/LExan 9034 - Sabic.pdf; boedeker.com/Product/Lexan-9034',
    'ICC-ES ESR-1893 (Palram) — icc-es.org/wp-content/uploads/report-directory/ESR-1893.pdf',
    'Makrolon GP / TUFFAK warranties — boedeker.com/Product/Makrolon-GP-Polycarbonate; plaskolite.com',
  ],
});

// ===================== 2. TWIN WALL POLYCARBONATE =====================
docs.push({
  file: 'Benchmark-Twin-Wall-Polycarbonate.pdf', code: 'BM-PC-TW-01', family: 'Twin Wall / Multiwall Polycarbonate Sheet',
  refs: 'SUNLITE® (Palram), POLYGAL® (Plaskolite), LEXAN™ THERMOCLEAR™ (Polyvantis), MACROLUX®, IMPEX',
  body:
    matrix('Product Data by Thickness', ['Thickness', 'Structure', 'Weight lb/ft² (kg/m²)', 'Light Trans. % (clear)', 'U-value BTU/h·ft²·°F (W/m²K)', 'R-value', 'Min. Cold Bend Radius'],
      [
        ['4 mm', 'Twin wall', '0.16 (0.8) |T', '82 |T', '0.67 (3.8) |K', '1.5 |K', '≈ 28" (700 mm) |T'],
        ['6 mm', 'Twin wall', '0.27 (1.3) |K', '80 |K', '0.63 (3.5) |K', '1.59 |K', '34" (865 mm) |K'],
        ['8 mm', 'Twin wall', '0.31 (1.5) |K', '80 |K', '0.60 (3.0–3.3) |K', '1.67 |K', '55" (1,400 mm) |K'],
        ['8 mm', 'Triple wall', '—  |N', '—  |N', '0.50 (2.8) |K', '2.00 |K', '—  |N'],
        ['10 mm', 'Twin wall', '0.35 (1.7) |K', '79 |K', '0.53 (2.9–3.0) |K', '1.89 |K', '69" (1,750 mm) |K'],
        ['16 mm', 'Triple / multi', '0.57 (2.8) |K', '72–76 (IMPEX 16/3: 73) |K', '0.41 (2.3) |K', '2.44 |K', '110" (2,800 mm) |K'],
      ],
      'Sources by column — Weight: Palram SUNLITE leaflet (kg/m²), LEXAN THERMOCLEAR guide (lb/ft²). Light transmission: Palram SUNLITE. U/R imperial: Plaskolite POLYGAL/TOPGAL guide; U metric: Palram. Bend radius: LEXAN THERMOCLEAR guide (≈ 175 × thickness). Rib spacing: not retrieved.') +
    matrix('Light Transmission &amp; Solar Heat Gain by Color', ['Thickness', 'Clear LT %', 'Clear SHGC', 'Bronze LT %', 'Opal LT %', 'Gray LT %'],
      [
        ['6 mm', '80 |K', '0.82 |K', '— |N', '— |N', '— |N'],
        ['10 mm', '79–80 |K', '0.81 |K', '35 |K', '30 |K', '20 |K'],
      ],
      'Palram SUNLITE (US and AU literature). Other thickness/color combinations not retrieved — request competitor color charts.') +
    props('Material Properties (Polycarbonate)', [
      ['Specific Gravity', 'ASTM D792', '1.20', '1.20 g/cm³', 'Polycarbonate (Palram, Plaskolite)', 'K'],
      ['Tensile Strength, Yield', 'ASTM D638', '≈ 9,000 psi', '≈ 62 MPa', 'PC resin typical', 'T'],
      ['Elongation at Break', 'ASTM D638', '≈ 110 %', '≈ 110 %', 'PC resin typical', 'T'],
      ['Flexural Modulus', 'ASTM D790', '≈ 345,000 psi', '≈ 2,380 MPa', 'PC resin typical', 'T'],
      ['Heat Deflection Temp. @ 264 psi', 'ASTM D648', '≈ 270 °F', '≈ 132 °C', 'PC resin typical', 'T'],
      ['Coeff. of Linear Thermal Expansion', 'ASTM D696', '3.75 × 10⁻⁵ in/in·°F', '6.75 × 10⁻⁵ /°C', 'PC resin typical', 'T'],
      ['Service Temperature Range', '—', '−40 to 250 °F', '−40 to 120 °C', 'Industry typical', 'T'],
      ['Hail Resistance', 'Internal', 'Hail warranty offered', '—', 'LEXAN THERMOCLEAR (values not published)', 'T'],
    ]) +
    para('Load / Span Table', `${badge('N')} Competitor load-span tables (allowable psf vs. support spacing) exist in Palram and Plaskolite installation guides but were not retrieved. Request: SUNLITE Technical Guide, POLYGAL Multiwall Guide (bro101).`) +
    props('Flammability &amp; Building Code', [
      ['Plastic Classification', 'ASTM D635', 'CC2 (SUNLITE twin/triple wall)', '—', 'Palram — ICC-ES ESR-1893', 'K'],
      ['Smoke-Developed Index', 'ASTM E84', '≤ 450', '—', 'Palram — ICC-ES ESR-1893', 'K'],
      ['Self-Ignition Temperature', 'ASTM D1929', 'Reported in ESR', '—', 'Palram — ESR-1893 (value not retrieved)', 'K'],
      ['Smoke Density Rating', 'ASTM D2843', 'Reported in ESR', '—', 'Palram — ESR-1893 (value not retrieved)', 'K'],
      ['UL 94 Rating', 'UL 94', '—', '—', 'Not retrieved', 'N'],
      ['Code Evaluation Report', 'ICC-ES', 'ESR-1893 (SUNLITE)', '—', 'Comparable: ESR-4745 (Kilon, CC1)', 'K'],
    ]) +
    list('Product Availability &amp; Options (typical US offering)', [
      ['Widths', '48", 72" (some widths "USA only" per Palram US)', 'T'],
      ['Lengths', '8, 12, 24 ft standard; custom lengths', 'T'],
      ['Colors', 'Clear, bronze, opal / white, gray, ice', 'K'],
      ['UV protection', 'Co-extruded UV layer, one side (marked), two sides optional', 'T'],
      ['Coatings', 'Anti-drip / condensation control; IR-reflective (solar control)', 'T'],
      ['Accessories', 'H- and U-profiles (PC / aluminum), vent tape, anti-dust tape, fasteners', 'T'],
      ['Retail channel', 'Home Depot / Lowe\'s (SUNLITE DIY, Tuftex)', 'K'],
    ]) +
    list('Warranty', [
      ['SUNLITE / POLYGAL / THERMOCLEAR', '≈ 10-year limited warranty: yellowing, loss of light transmission; hail (THERMOCLEAR)', 'T'],
    ]),
  sources: [
    'Palram SUNLITE (US) — palram.com/us/product/sunlite/; SUNLITE leaflet & technical guide — specifiedby.com/palram/…',
    'Palram SUNLITE (AU) — palram.com/au/product/sunlite-polycarbonate-multi-wall/',
    'Plaskolite POLYGAL / TOPGAL guides — plaskolite.com/docs/default-source/fab/fab010_pgl_top_eu.pdf; bro101_pgl_multiwall_guide.pdf',
    'LEXAN THERMOCLEAR / Verolite guide (weights, bend radius) — via search result summary',
    'IMPEX Multiwall product guide (16 mm) — cdn.shopify.com/…/EN_IMPEX-MULTIWALL_ProductGuide_08-2022.pdf',
    'ICC-ES ESR-1893, ESR-4745 — icc-es.org/wp-content/uploads/report-directory/',
  ],
});

// ===================== 3. TWIN WALL POLYPROPYLENE =====================
docs.push({
  file: 'Benchmark-Twin-Wall-Polypropylene.pdf', code: 'BM-PP-TW-01', family: 'Twin Wall (Fluted) Polypropylene Sheet',
  refs: 'Coroplast® (Inteplast Group), Prime COR-X® (Primex)',
  body:
    props('Material Properties (Resin)', [
      ['Polymer Type', '—', 'High-impact PP copolymer', '—', 'Coroplast', 'K'],
      ['Density', 'ASTM D792', '0.90', '0.90 g/cm³', 'Coroplast; Interstate', 'K'],
      ['Melt Flow Rate (230 °C / 2.16 kg)', 'ASTM D1238', '—', '—', 'Not retrieved', 'N'],
      ['Tensile Strength, Yield', 'ASTM D638', '4,000 psi', '27.6 MPa', 'Coroplast resin spec', 'K'],
      ['Flexural Modulus', 'ASTM D790', '≈ 150,000–200,000 psi', '≈ 1,000–1,400 MPa', 'PP copolymer typical', 'T'],
      ['Heat Deflection Temp. @ 66 psi', 'ASTM D648', '194 °F', '90 °C', 'Coroplast resin spec', 'K'],
      ['Melting Point', '—', '≈ 330 °F', '≈ 165 °C', 'Coroplast', 'K'],
      ['Service Temperature Range', '—', '≈ 0 to 180 °F', '≈ −18 to 82 °C', 'PP copolymer typical', 'T'],
    ]) +
    matrix('Board Performance by Thickness', ['Property', '2 mm', '3 mm', '4 mm', '5 mm', '6 mm', '10 mm'],
      [
        ['Board weight, g/m²', '≈ 350–400 |T', '≈ 500–550 |T', '700 (Cor-X) / 750 (Coroplast) |K', '≈ 900–1,000 |T', '≈ 1,100–1,300 |T', '≈ 2,130 (Cor-X) |K'],
        ['Board weight, g/ft²', '—', '—', '65 |K', '—', '—', '198 |K'],
        ['Board weight, lbs/MSF', '—', '—', '143 (Cor-X) / 150 (Coroplast) |K', '—', '—', '—'],
        ['Edge Crush (TAPPI T811), lbf', '—', '—', '> 200 |K', '— |N', '— |N', '— |N'],
        ['Compression, lbf', '—', '—', '108 |K', '— |N', '— |N', '— |N'],
        ['Corner Crush, lbf', '—', '—', '195 |K', '— |N', '— |N', '— |N'],
        ['5-Point Bend', '—', '—', '23.3 mm @ 7.5 lb |K', '— |N', '— |N', '— |N'],
      ],
      'Cor-X publishes 4/5/6/10 mm columns; only 4 mm and 10 mm weight values were retrieved. Thickness tolerance (Coroplast): ±5 %, range 2–12 mm. Weight tolerance (Coroplast 4 mm): ±5 %.') +
    props('Print &amp; Surface Characteristics', [
      ['Corona Treatment (min.)', 'Dyne test', '46 dyne/cm', '46 mN/m', 'Coroplast tolerance sheet', 'K'],
      ['Sides Treated', '—', 'Both sides (2–12 mm)', '—', 'Coroplast Print', 'K'],
      ['UV-cured printing', '—', 'Not recommended < 4 mm', '—', 'Coroplast Print', 'K'],
      ['Treatment Retention Period', '—', '—', '—', 'Not retrieved', 'N'],
      ['Surface Resistivity (conductive grade)', '—', '≤ 10⁵ Ω/sq', '—', 'Primex (tested on 3 mm)', 'K'],
    ]) +
    list('Options offered by competitors', [
      ['FDA / UL compliant materials', 'Available on request (Primex)', 'K'],
      ['Conductive / anti-static', 'Primex conductive COR-X', 'K'],
      ['Post-consumer recycled', 'Primex Recycle PCR COR-X', 'K'],
      ['UV-stabilized, flame retardant, custom colors', 'Common across suppliers; specifics not retrieved', 'T'],
      ['Market segments', 'Coroplast Print (signage), Coroplast Packaging, floor protection', 'K'],
    ]) +
    list('Product Availability (typical US offering)', [
      ['Thicknesses', '2–12 mm (Coroplast); 4 mm ≈ 3/16" is the sign standard; 10 mm ≈ 3/8"', 'K'],
      ['Sheet sizes', '48"×96" (flute direction stated), 18"×24" / 24"×18" yard signs, custom', 'T'],
      ['Colors', 'Natural, white, black, colors', 'K'],
    ]),
  sources: [
    'Coroplast general properties & resin spec — coroplast.com/resources/product-properties/; coroplast.com/?p=595',
    'Coroplast Print datasheet & tolerances — coroplast.com/wp-content/uploads/Coroplast-Print-Datasheet.pdf; Coroplast-Tolerances-05-26-2021.pdf',
    'Coroplast 4 mm weight (distributor spec) — bciimage.com/wp-content/uploads/2015/07/Coroplast.pdf',
    'Primex COR-X PP data sheet — primexplastics.com/wp-content/uploads/primex-data-sheet-corxpp-1.pdf',
    'Primex PCR COR-X — primexplastics.com/wp-content/uploads/primex-data-sheet-recycle-PCR-corx-1.pdf',
    'Interstate Plastics fluted PP — interstateplastics.com/materialspecs/web-polypropylene-fluted.pdf',
  ],
});

// ===================== 4. EXTRUDED ACRYLIC =====================
docs.push({
  file: 'Benchmark-Extruded-Acrylic.pdf', code: 'BM-PMMA-X-01', family: 'Extruded Acrylic (PMMA) Sheet',
  refs: 'OPTIX® (Plaskolite), ACRYLITE® Premium FF (Röhm), PLEXIGLAS® (Trinseo / Altuglas)',
  body:
    props('Physical &amp; Optical Properties', [
      ['Specific Gravity', 'ASTM D792', '1.19', '1.19 g/cm³', 'ACRYLITE; OPTIX', 'K'],
      ['Water Absorption, 24 h', 'ASTM D570', '0.2 %', '0.2 %', 'ACRYLITE Premium', 'K'],
      ['Total Light Transmission', 'ASTM D1003', '92 %', '92 %', 'OPTIX', 'K'],
      ['Haze', 'ASTM D1003', '< 1 %', '< 1 %', 'Industry typical', 'T'],
      ['Refractive Index', 'ASTM D542', '1.49', '1.49', 'Industry typical', 'T'],
    ]) +
    props('Mechanical Properties', [
      ['Tensile Strength', 'ASTM D638', '11,030 psi', '76 MPa', 'OPTIX', 'K'],
      ['Tensile Strength', 'ASTM D638', '10,000 psi', '69 MPa', 'ACRYLITE Premium FF', 'K'],
      ['Tensile Modulus', 'ASTM D638', '≈ 450,000 psi', '≈ 3,100 MPa', 'Industry typical', 'T'],
      ['Elongation at Break', 'ASTM D638', '≈ 4–5 %', '≈ 4–5 %', 'Industry typical', 'T'],
      ['Flexural Strength', 'ASTM D790', '≈ 15,000–17,000 psi', '≈ 105–117 MPa', 'Industry typical', 'T'],
      ['Flexural Modulus', 'ASTM D790', '≈ 400,000–480,000 psi', '≈ 2,750–3,300 MPa', 'Industry typical', 'T'],
      ['Izod Impact, Molded Notch', 'ASTM D256', '0.4 ft-lb/in', '≈ 21 J/m', 'OPTIX', 'K'],
      ['Izod Impact, Milled Notch', 'ASTM D256', '0.28 ft-lb/in', '≈ 15 J/m', 'OPTIX', 'K'],
      ['Rockwell Hardness', 'ASTM D785', 'M-95', '—', 'OPTIX', 'K'],
    ]) +
    props('Thermal Properties', [
      ['Heat Deflection Temp. @ 264 psi', 'ASTM D648', '203 °F', '95 °C', 'OPTIX', 'K'],
      ['Heat Deflection Temp. @ 66 psi', 'ASTM D648', '207 °F', '97 °C', 'OPTIX', 'K'],
      ['Softening (forming onset)', '—', '> 195 °F', '> 91 °C', 'ACRYLITE Premium FF', 'K'],
      ['Vicat Softening Temperature', 'ASTM D1525', '≈ 220 °F', '≈ 105 °C', 'Industry typical', 'T'],
      ['Coeff. of Linear Thermal Expansion', 'ASTM D696', '≈ 4.0 × 10⁻⁵ in/in·°F', '≈ 7.2 × 10⁻⁵ /°C', 'Industry typical', 'T'],
      ['Max. Service Temperature', '—', '160 °F continuous; 190 °F intermittent', '71 °C / 88 °C', 'ACRYLITE Premium', 'K'],
      ['Thermoforming Temperature', '—', '≈ 290–340 °F', '≈ 145–170 °C', 'Industry typical', 'T'],
      ['Annealing Temperature', '—', '180 °F', '82 °C', 'ACRYLITE Premium FF', 'K'],
      ['Shrinkage after heating', 'Internal', '—', '—', 'Not retrieved', 'N'],
    ]) +
    props('Flammability &amp; Building Code', [
      ['UL 94 Rating', 'UL 94', 'HB', '—', 'OPTIX', 'K'],
      ['Burn Rate / Classification', 'ASTM D635', '≈ 1.0 in/min → CC2', '≈ 26 mm/min', 'OPTIX patterned (1.019 in/min)', 'K'],
      ['Self-Ignition Temperature', 'ASTM D1929', '≈ 850 °F', '≈ 455 °C', 'Industry typical', 'T'],
      ['Flame Spread Index', 'ASTM E84', '115', '—', 'OPTIX', 'K'],
      ['Smoke Density Rating', 'ASTM D2843', '—', '—', 'Not retrieved', 'N'],
    ]) +
    props('Electrical Properties', [
      ['Dielectric Strength', 'ASTM D149', '≈ 400–500 V/mil', '≈ 16–20 kV/mm', 'Industry typical', 'T'],
      ['Volume Resistivity', 'ASTM D257', '> 10¹⁵ ohm·cm', '—', 'Industry typical', 'T'],
    ]) +
    list('Product Availability (typical US offering)', [
      ['Thickness range', 'Thin gauge 0.030"–0.236"; standard 0.080"–0.500"; OPTIX Thick Gauge 0.500"–1.000" (12.7–25.4 mm)', 'K'],
      ['Thickness tolerance', 'ACRYLITE FF markets "tight thickness tolerance / low stress"; typical extruded ±10 %', 'T'],
      ['Sheet sizes', '48"×96" standard; 60"×96", 72"×96", 48"×72"; retail 18"×24", 24"×48"; roll stock', 'T'],
      ['Series', 'Clear, white/LED, colors &amp; designer colors, patterned (P95), non-glare, abrasion-resistant (DA), UV-filtering, mirror, frosted, recycled (OPTIX R)', 'K'],
      ['Masking', 'PE film or paper; laser-compatible masking', 'T'],
    ]) +
    list('Fabrication claims', [
      ['Thermoforming &amp; solvent cementing', 'Extruded is the easiest grade to thermoform and solvent bond (vs. cast)', 'K'],
      ['Saw, router, laser, CNC, drilling, polishing', 'Covered in separate fabrication guides (OPTIX FAB004, ACRYLITE)', 'K'],
    ]),
  sources: [
    'Plaskolite OPTIX Clear PDS204 — polymershapes.com/wp-content/uploads/2025/06/PDS204_OPX_Clear.pdf; pds322_opx_gp_metric.pdf',
    'OPTIX Thick Gauge — plaskolite.com/docs/default-source/pds/pds395_opx_thick_gauge_metric.pdf',
    'OPTIX patterned (D635 burn rate) — polymershapes.com/…/Polymershapes_Plaskolite_Properties-OPTIX-Patterned-Acrylic.pdf',
    'ACRYLITE Premium FF technical information — piedmontplastics.com/resources/literatures/acrylite-premium-ff-technical-information',
    'ACRYLITE Premium PDS — acplasticsinc.com/wp-content/uploads/2026/08/Acrylite-Premium-PDS.pdf',
    'Curbell Acrylic Data Sheet — curbellplastics.com/wp-content/uploads/2022/11/Curbell-Plastics-Acrylic-Data-Sheet.pdf',
  ],
});

(async () => {
  const browser = await chromium.launch();
  const pg = await browser.newPage();
  for (const d of docs) {
    await pg.setContent(page(d), { waitUntil: 'load' });
    await pg.pdf({
      path: path.join(OUT, d.file), format: 'Letter', printBackground: true, preferCSSPageSize: true,
      displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-family:Inter,sans-serif;font-size:7px;color:#5b6575;width:100%;padding:0 0.6in;display:flex;justify-content:space-between"><span>${d.code} · Competitor Benchmark · ${d.family} · INTERNAL</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
    console.log('wrote', d.file);
  }
  await browser.close();
})();
