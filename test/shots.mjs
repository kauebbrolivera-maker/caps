// Teste E2E: serve dist/, abre com viewport de iPhone, edita, gera legendas, exporta e tira screenshots.
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL_ = process.env.URL || 'http://localhost:4173/';
const OUT = '/workspace/caps-shots'; mkdirSync(OUT, { recursive: true });
const dev = devices['iPhone 15 Pro'] || devices['iPhone 13'];
const b = await chromium.launch();
const ctx = await b.newContext({ ...dev, defaultBrowserType: undefined });
const p = await ctx.newPage();
const logs = []; p.on('console', m => logs.push(m.type() + ': ' + m.text())); p.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
const res = {};
await p.goto(URL_); await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/1-inicio.png` });
await p.setInputFiles('#fileIn', ['test/fala.webm', 'test/clip1.webm', 'test/clip2.webm']);
await p.waitForFunction(() => window.__caps.P.clips.length === 3);
await p.waitForTimeout(1200);
// edições: split, speed, transição, efeito, filtro, texto, música
res.edits = await p.evaluate(async () => {
  const { P, select } = window.__caps;
  P.clips[1].transition = 'slideL'; P.clips[1].effect = 'zoomIn'; P.clips[1].speed = 1.5; P.clips[1].filter = 'brasa'; P.clips[1].lut = 'cinema';
  P.clips[2].transition = 'fade'; P.clips[2].effect = 'tremor'; P.clips[2].mask = { type: 1, size: 0.4, feather: 0.05, invert: false };
  P.texts.push({ id: 't1', kind: 'text', text: 'Caps no iPhone 🚀', start: 0.2, end: 9, anim: 'pop', y: 0.15, size: 0.06, color: '#fff', stroke: '#14121f' });
  window.__caps.t = 0; select('clip', P.clips[1].id);
  return { clips: P.clips.length };
});
// dividir via UI no meio do clipe 2
await p.evaluate(() => { const P = window.__caps.P; let st = 0; for (const c of P.clips.slice(0, 1)) st += (c.out - c.in) / c.speed; window.__caps.t = st + (P.clips[1].out - P.clips[1].in) / P.clips[1].speed / 2; }); await p.waitForTimeout(400);
await p.getByRole('button', { name: 'Dividir' }).click(); await p.waitForTimeout(300);
res.afterSplit = await p.evaluate(() => window.__caps.P.clips.length);
// música + batidas
const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => { window.__caps.select(null); }).then(() => p.getByRole('button', { name: /Música/ }).click())]);
await fc.setFiles('test/music.webm');
await p.waitForFunction(() => window.__caps.P.bpm > 0, null, { timeout: 15000 }).catch(() => {});
res.bpm = await p.evaluate(() => window.__caps.P.bpm);
await p.evaluate(() => { window.__caps.t = (window.__caps.P.clips[0].out - window.__caps.P.clips[0].in) + 0.8; window.__caps.select('clip', window.__caps.P.clips[1].id); }); await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/2-timeline-edicao.png` });
// sheet de filtros
await p.getByRole('button', { name: 'Filtros' }).click(); await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/3-filtros-lut.png` });
await p.click('#sheetClose');
// legendas Whisper (baixa o modelo tiny do Hugging Face)
await p.evaluate(() => window.__caps.select(null));
await p.getByRole('button', { name: /Legendas/ }).click();
await p.click('#go');
const t0 = Date.now();
await p.waitForFunction(() => /criados|Erro|Nenhum/.test(document.querySelector('#cmsg')?.textContent || ''), null, { timeout: 240000 }).catch(() => {});
res.captions = { msg: await p.textContent('#cmsg'), secs: (Date.now() - t0) / 1000, texts: await p.evaluate(() => window.__caps.P.texts.filter(x => x.kind === 'caption').map(x => [x.start, x.end, x.text])) };
await p.click('#sheetClose');
await p.evaluate(() => { window.__caps.t = 1.5; }); await p.waitForTimeout(600);
await p.screenshot({ path: `${OUT}/4-legendas.png` });
// exportar 9:16 e 16:9
for (const ar of ['9:16', '16:9']) {
  await p.click('#exportBtn'); await p.selectOption('#ea', ar); await p.selectOption('#er', '480');
  await p.click('#ego');
  await p.waitForFunction(() => window.__lastExport && (window.__lastExport.error || window.__lastExport.size), null, { timeout: 300000 });
  res['export_' + ar] = await p.evaluate(() => { const r = window.__lastExport; window.__lastExport = null; return r; });
  const bytes = await p.evaluate(async () => { const u = document.querySelector('#eout video').src; const a = new Uint8Array(await (await fetch(u)).arrayBuffer()); let s = ''; for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768)); return btoa(s); });
  writeFileSync(`${OUT}/export-${ar.replace(':', 'x')}.mp4`, Buffer.from(bytes, 'base64'));
  if (ar === '9:16') await p.screenshot({ path: `${OUT}/5-exportar.png` });
  await p.click('#sheetClose');
}
await p.goto(URL_ + 'como-funciona.html'); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/6-como-funciona.png` });
res.sw = await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
console.log(JSON.stringify(res, null, 1));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ res, logs: logs.slice(-40) }, null, 1));
console.log(logs.filter(l => /error|PAGEERROR/i.test(l)).slice(0, 15).join('\n'));
await b.close();
