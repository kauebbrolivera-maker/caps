// E2E (iPhone 14): landing → editor → importar → cortar/aparar/excluir → transição → Ken Burns → texto → filtro → legendas → exportar.
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE = process.env.URL || 'http://localhost:4180/caps/';
const OUT = process.env.OUT || '/workspace/caps-shots2'; mkdirSync(OUT, { recursive: true });
const VID = process.env.VID || '/workspace/caps-test.mp4';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 14'] });
const p = await ctx.newPage();
const logs = []; p.on('console', m => logs.push(m.type() + ': ' + m.text())); p.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
const res = {}; const shot = n => p.screenshot({ path: `${OUT}/${n}.png` });
const step = async (name, fn) => { try { res[name] = (await fn()) ?? 'ok'; } catch (e) { res[name] = 'FALHOU: ' + e.message.split('\n')[0]; } console.log(name, JSON.stringify(res[name])); };
const tool = n => p.locator('#tools .tool', { hasText: n }).first();
const opt = n => p.locator('#sheetBody .opt', { hasText: n }).first();
const clipEls = () => p.locator('#trackV .clip');
const scrollTo = async s => { await p.evaluate(s => { const tl = document.querySelector('#tl'); tl.scrollLeft = s * 60; tl.dispatchEvent(new Event('scroll')); }, s); await p.waitForTimeout(250); };

await step('landing', async () => {
  const r = await p.goto(BASE); await p.waitForTimeout(800);
  await shot('01-landing-hero'); await p.screenshot({ path: `${OUT}/02-landing-pagina-inteira.png`, fullPage: true });
  return { status: r.status(), h1: await p.textContent('h1'), secoes: await p.locator('section').count(), faq: await p.locator('details').count() };
});
await step('abrirEditor', async () => {
  await p.locator('a.cta', { hasText: 'Abrir editor' }).first().click(); await p.waitForURL(/\/editor\/$/); await p.waitForTimeout(600);
  await shot('03-editor-vazio'); return p.url();
});
await step('importar', async () => {
  await p.setInputFiles('#fileIn', [VID, 'test/fala.webm', 'test/clip1.webm']);
  await p.waitForFunction(() => window.__caps.P.clips.length === 3, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  return await p.evaluate(() => window.__caps.P.clips.map(c => [c.file.name, +c.srcDur.toFixed(2)]));
});
await step('dividir', async () => {
  await clipEls().nth(0).tap(); await scrollTo(3); await tool('Dividir').tap(); await p.waitForTimeout(300);
  return await p.evaluate(() => window.__caps.P.clips.map(c => [+c.in.toFixed(2), +c.out.toFixed(2)]));
});
await step('aparar_por_toque', async () => {
  await clipEls().nth(0).tap(); await p.waitForTimeout(200);
  const h = p.locator('#trackV .clip.sel .h.r'); const bb = await h.boundingBox();
  const before = await p.evaluate(() => window.__caps.P.clips[0].out);
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down();
  await p.mouse.move(bb.x - 30, bb.y + bb.height / 2, { steps: 6 }); await shot('04-timeline-aparando'); await p.mouse.up(); await p.waitForTimeout(200);
  const after = await p.evaluate(() => window.__caps.P.clips[0].out);
  return { antes: +before.toFixed(2), depois: +after.toFixed(2) };
});
await step('excluir', async () => {
  await clipEls().nth(1).tap(); await tool('Excluir').tap(); await p.waitForTimeout(200);
  return await p.evaluate(() => window.__caps.P.clips.map(c => c.file.name));
});
await step('transicao_desfocar', async () => {
  await clipEls().nth(1).tap(); await tool('Transição').tap(); await opt('Desfocar').tap(); await p.waitForTimeout(300);
  await shot('05-transicoes'); await p.click('#sheetClose');
  await p.evaluate(() => { window.__caps.t = (window.__caps.P.clips[0].out - window.__caps.P.clips[0].in) + 0.15; }); await p.waitForTimeout(400);
  await shot('06-transicao-em-andamento');
  return await p.evaluate(() => window.__caps.P.clips[1].transition);
});
await step('ken_burns', async () => {
  await clipEls().nth(1).tap(); await tool('Movimento').tap(); await opt('Aproximar lento').tap(); await p.waitForTimeout(300);
  await shot('07-ken-burns'); await p.click('#sheetClose');
  return await p.evaluate(() => window.__caps.P.clips[1].motion);
});
await step('filtro_ajustes', async () => {
  await clipEls().nth(0).tap(); await tool('Filtros').tap(); await p.locator('#g1 .opt').nth(3).tap(); await p.waitForTimeout(300);
  await shot('08-filtros'); await p.click('#sheetClose');
  await tool('Ajustes').tap(); await p.locator('#as').fill('1.6'); await p.locator('#as').dispatchEvent('input'); await p.locator('#ab').fill('0.08'); await p.locator('#ab').dispatchEvent('input');
  await shot('09-ajustes'); await p.click('#sheetClose');
  return await p.evaluate(() => ({ filtro: window.__caps.P.clips[0].filter, adj: window.__caps.P.clips[0].adj }));
});
await step('texto_animado', async () => {
  await p.evaluate(() => window.__caps.select(null)); await p.evaluate(() => { window.__caps.t = 0.2; });
  await tool('Texto').tap(); await p.fill('#tx', 'Caps no iPhone 🚀'); await p.locator('#tx').dispatchEvent('input');
  await opt('Quicar').tap(); await p.waitForTimeout(500); await shot('10-texto-animado'); await p.click('#sheetClose');
  await p.evaluate(() => { const x = window.__caps.P.texts[0]; x.end = 20; x.y = 0.15; });
  return await p.evaluate(() => window.__caps.P.texts.map(x => [x.text, x.anim]));
});
await step('legendas_whisper', async () => {
  await p.evaluate(() => window.__caps.select(null));
  await tool('Legendas').tap(); await p.selectOption('#cst', 'd'); await p.click('#go'); const t0 = Date.now();
  await p.waitForFunction(() => /criados|Erro|Nenhum/.test(document.querySelector('#cmsg')?.textContent || ''), null, { timeout: 300000 });
  const msg = await p.textContent('#cmsg');
  const n = await p.locator('.cap-row input').count();
  const original = await p.evaluate(() => window.__caps.P.texts.filter(x => x.kind === 'caption').map(x => [+x.start.toFixed(1), x.text]));
  if (n) { await p.locator('.cap-row input').first().fill('Legenda editada à mão'); await p.locator('.cap-row input').first().dispatchEvent('input'); }
  await shot('11-legendas-editaveis'); await p.click('#sheetClose');
  const caps = await p.evaluate(() => window.__caps.P.texts.filter(x => x.kind === 'caption').map(x => [+x.start.toFixed(1), +x.end.toFixed(1), x.text]));
  if (caps[0]) { await p.evaluate(s => { window.__caps.t = s + 0.6; }, caps[0][0]); await p.waitForTimeout(500); await shot('12-legenda-na-previa'); }
  return { msg, secs: (Date.now() - t0) / 1000, original, caps };
});
await step('timeline_completa', async () => { await p.evaluate(() => window.__caps.select(null)); await scrollTo(1); await shot('13-timeline'); return await p.evaluate(() => ({ dur: window.__caps.P.clips.reduce((a, c) => a + (c.out - c.in) / c.speed, 0) })); });
for (const [ar, h] of [['9:16', '1080'], ['1:1', '480'], ['16:9', '480']]) {
  await step('export_' + ar, async () => {
    await p.click('#exportBtn'); await p.selectOption('#ea', ar); await p.selectOption('#er', h); await p.click('#ego'); const t0 = Date.now();
    await p.waitForFunction(() => window.__lastExport && (window.__lastExport.error || window.__lastExport.size), null, { timeout: 900000, polling: 1000 });
    const r = await p.evaluate(() => { const r = window.__lastExport; window.__lastExport = null; return r; });
    if (r.error) throw new Error(r.error);
    const bytes = await p.evaluate(async () => { const u = document.querySelector('#eout video').src; const a = new Uint8Array(await (await fetch(u)).arrayBuffer()); let s = ''; for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768)); return btoa(s); });
    const f = `${OUT}/export-${ar.replace(':', 'x')}.mp4`; writeFileSync(f, Buffer.from(bytes, 'base64'));
    if (ar === '9:16') await shot('14-exportado-9x16');
    await p.click('#sheetClose'); return { ...r, arquivo: f, wall: (Date.now() - t0) / 1000 };
  });
}
await step('como_funciona', async () => { const r = await p.goto(BASE + 'como-funciona.html'); await shot('15-como-funciona'); return r.status(); });
await step('open_intacto', async () => { const r = await p.goto(BASE + 'open/'); return r.status(); });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ res, logs: logs.filter(l => !/GPU stall|content-length/.test(l)).slice(-60) }, null, 1));
console.log(logs.filter(l => /PAGEERROR|error/i.test(l)).slice(0, 20).join('\n'));
await b.close();
