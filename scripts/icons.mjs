// Gera ícones PNG originais a partir de um SVG próprio (usa o Chromium do Playwright)
import { existsSync, writeFileSync } from 'node:fs';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="#ff5e7e"/></linearGradient></defs>
<rect width="512" height="512" rx="112" fill="#14121f"/>
<rect x="96" y="150" width="320" height="212" rx="40" fill="url(#g)"/>
<rect x="136" y="200" width="70" height="112" rx="14" fill="#14121f" opacity=".9"/>
<rect x="221" y="200" width="70" height="112" rx="14" fill="#14121f" opacity=".6"/>
<rect x="306" y="200" width="70" height="112" rx="14" fill="#14121f" opacity=".3"/>
</svg>`;
writeFileSync('public/icons/icon.svg', svg);
if (existsSync('public/icons/icon-512.png')) process.exit(0);
const { chromium } = await import('playwright');
const b = await chromium.launch();
const p = await b.newPage();
for (const s of [180, 192, 512]) {
  await p.setViewportSize({ width: s, height: s });
  await p.setContent(`<style>*{margin:0}</style>${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}`);
  await p.screenshot({ path: `public/icons/icon-${s}.png`, omitBackground: true });
}
await b.close(); console.log('ícones gerados');
