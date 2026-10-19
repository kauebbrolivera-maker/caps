import { chromium, devices } from 'playwright';
const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 14'] })).newPage();
await p.goto((process.env.URL || 'http://localhost:4180/caps/') + 'editor/');
await p.setInputFiles('#fileIn', ['test/fala.webm']); await p.waitForFunction(() => window.__caps.P.clips.length === 1);
await p.locator('#tools .tool', { hasText: 'Legendas' }).tap(); await p.click('#go');
await p.waitForFunction(() => /criados|Erro|Nenhum/.test(document.querySelector('#cmsg')?.textContent || ''), null, { timeout: 300000 });
console.log(await p.textContent('#cmsg'), JSON.stringify(await p.evaluate(() => window.__caps.P.texts.map(x => [x.start, x.end, x.text]))));
await p.click('#sheetClose'); await p.evaluate(() => { window.__caps.t = 1.5; }); await p.waitForTimeout(500); await p.screenshot({ path: '/workspace/caps-shots2/16-legenda-whisper-ptbr.png' });
await b.close();
