// Usage: node tds/assets/photos/generate-datacenter.js out.png   (then convert to tds/assets/photos/twinwall-datacenter.jpg)
// Procedural data-center corridor illustration (original artwork) -> PNG
const { chromium } = require('playwright');
const out = process.argv[2];
const W = 1200, H = 736, VX = 600, VY = 330; // vanishing point
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const lerp = (a, b, t) => a + (b - a) * t;
let svg = '';
// background gradient + ceiling glow
svg += `<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06122b"/><stop offset=".45" stop-color="#0b2a5c"/><stop offset="1" stop-color="#04101f"/></linearGradient>
<radialGradient id="glow" cx="50%" cy="45%" r="35%"><stop offset="0" stop-color="#9fd4ff" stop-opacity=".95"/><stop offset=".25" stop-color="#4aa3ff" stop-opacity=".5"/><stop offset="1" stop-color="#0b2a5c" stop-opacity="0"/></radialGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb4ff" stop-opacity=".55"/><stop offset="1" stop-color="#0a2346" stop-opacity=".95"/></linearGradient>
<filter id="blur"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="blur2"><feGaussianBlur stdDeviation="1.2"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>`;
// floor
svg += `<polygon points="${VX-30},${VY+20} ${VX+30},${VY+20} ${W+250},${H} ${-250},${H}" fill="url(#floor)"/>`;
// floor tile lines
for (let i = -6; i <= 6; i++) { const x = VX + i * 220; svg += `<line x1="${VX + i*5}" y1="${VY+20}" x2="${x}" y2="${H}" stroke="#7cc4ff" stroke-opacity=".18" stroke-width="1.5"/>`; }
for (let k = 1; k < 14; k++) { const t = Math.pow(k / 14, 2.2); const y = lerp(VY + 20, H, t); svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#7cc4ff" stroke-opacity="${.06 + .12*t}" stroke-width="1"/>`; }
// ceiling
svg += `<polygon points="${VX-30},${VY-40} ${VX+30},${VY-40} ${W+250},0 ${-250},0" fill="#071a38"/>`;
// ceiling light strips (two rows converging)
for (const side of [-1, 1]) {
  for (let k = 0; k < 16; k++) {
    const t1 = Math.pow(k / 16, 2.0), t2 = Math.pow((k + .55) / 16, 2.0);
    const p = (t) => [lerp(VX + side * 12, VX + side * 330, 1 - t), lerp(VY - 40, -20, 1 - t)];
    const [x1, y1] = p(1 - t1), [x2, y2] = p(1 - t2);
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#d8eeff" stroke-width="${lerp(1.2, 7, t2)}" stroke-linecap="round" filter="url(#blur2)"/>`;
  }
}
// rack rows: each side = sequence of rack faces in perspective
function rackSide(side) {
  const n = 18; let s = '';
  for (let k = n - 1; k >= 0; k--) {
    const tA = Math.pow(k / n, 1.9), tB = Math.pow((k + 1) / n, 1.9);
    const xA = lerp(VX + side * 40, VX + side * 640, tA), xB = lerp(VX + side * 40, VX + side * 640, tB);
    const topA = lerp(VY - 32, -60, tA), topB = lerp(VY - 32, -60, tB);
    const botA = lerp(VY + 22, H + 120, tA), botB = lerp(VY + 22, H + 120, tB);
    s += `<polygon points="${xA},${topA} ${xB},${topB} ${xB},${botB} ${xA},${botA}" fill="${k % 2 ? '#0a1f40' : '#0c2550'}" stroke="#4fa8ff" stroke-opacity="${.35 + .4*tB}" stroke-width="${lerp(.5, 2.5, tB)}"/>`;
    // blinking LEDs
    const leds = Math.floor(lerp(4, 40, tB));
    for (let j = 0; j < leds; j++) {
      const u = rnd(), v = rnd();
      const x = lerp(xA, xB, .15 + .7 * u);
      const yt = lerp(topA, topB, .15 + .7 * u), yb = lerp(botA, botB, .15 + .7 * u);
      const y = lerp(yt, yb, .08 + .8 * v);
      const c = rnd() < .8 ? '#8fd0ff' : (rnd() < .5 ? '#ffffff' : '#5cffb0');
      s += `<circle cx="${x}" cy="${y}" r="${lerp(.5, 2.2, tB)}" fill="${c}" opacity="${.6 + .4*rnd()}"/>`;
    }
    // vertical light strip at rack edge
    s += `<line x1="${xB}" y1="${botB}" x2="${xB}" y2="${botB - (botB-topB)*.02}" stroke="#9fd8ff" stroke-width="${lerp(1,3,tB)}"/>`;
  }
  // base light line along floor
  s += `<line x1="${VX + side*40}" y1="${VY+22}" x2="${VX + side*640}" y2="${H+120}" stroke="#9fd8ff" stroke-width="3" opacity=".8" filter="url(#blur2)"/>`;
  return s;
}
svg += rackSide(-1) + rackSide(1);
// central glow & floor reflection
svg += `<rect width="${W}" height="${H}" fill="url(#glow)"/>`;

const html = `<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg}</svg></body></html>`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } }); await p.setContent(html); await p.screenshot({ path: out }); await b.close(); })();
