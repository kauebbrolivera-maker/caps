import { Renderer } from './renderer.js';
import { FILTERS, LUTS, parseCube } from './looks.js';
import { layout, totalDur, clipDur, activeAt, renderFrame } from './scene.js';
import { decode, mix, detectBeats } from './audio.js';

const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const P = window.P = { aspect: '9:16', clips: [], texts: [], music: null, beats: [], bpm: 0 };
let t = 0, playing = false, PPS = 60, sel = null, lastTick = 0, syncingScroll = false;
let R;

// ---------- prévia ----------
function setupStage() {
  const portrait = P.aspect === '9:16';
  const w = portrait ? 540 : 960, h = portrait ? 960 : 540;
  if (!R) { R = new Renderer(w, h); $('#stage').appendChild(R.out); } else R.resize(w, h);
  $('#aspectBtn').textContent = P.aspect;
}
function toast(m, ms = 1800) { const e = $('#toast'); e.textContent = m; e.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => (e.hidden = true), ms); }

function syncMedia() {
  const act = activeAt(P, t), cur = act[act.length - 1];
  for (const c of P.clips) {
    if (c.kind !== 'video') continue;
    const a = act.find(x => x.c === c);
    if (!a) { if (!c.el.paused) c.el.pause(); continue; }
    if (playing && a.role === 'cur') {
      c.el.playbackRate = c.speed; c.el.volume = Math.min(1, c.volume ?? 1); c.el.muted = (c.volume ?? 1) === 0;
      if (Math.abs(c.el.currentTime - a.srcT) > 0.3) c.el.currentTime = a.srcT;
      if (c.el.paused) c.el.play().catch(() => {});
    } else {
      if (!c.el.paused) c.el.pause();
      if (Math.abs(c.el.currentTime - a.srcT) > 0.04 && !c.el.seeking) c.el.currentTime = a.srcT;
    }
  }
  const m = P.music;
  if (m) {
    m.el.volume = m.volume;
    const mt = ((m.offset || 0) + t) % (m.el.duration || 1e9);
    if (playing) { if (Math.abs(m.el.currentTime - mt) > 0.3) m.el.currentTime = mt; if (m.el.paused) m.el.play().catch(() => {}); }
    else if (!m.el.paused) m.el.pause();
  }
  return cur;
}
function tick(now) {
  const dt = Math.min(0.1, (now - lastTick) / 1000); lastTick = now;
  const total = totalDur(P);
  if (playing) { t += dt; if (t >= total) { t = total; setPlaying(false); } followScroll(); }
  if (P.clips.length) { syncMedia(); renderFrame(R, P, Math.min(t, Math.max(0, total - 0.001))); }
  $('#time').textContent = `${fmt(t)} / ${fmt(total)}`;
  requestAnimationFrame(tick);
}
function setPlaying(v) { playing = v; $('#playBtn').textContent = v ? '❚❚' : '▶'; if (!v) syncMedia(); }
function followScroll() { syncingScroll = true; $('#tl').scrollLeft = t * PPS; requestAnimationFrame(() => (syncingScroll = false)); }

// ---------- importação ----------
function loadEl(file) {
  const url = URL.createObjectURL(file);
  if (file.type.startsWith('image')) return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok({ el: i, url, kind: 'image', dur: 3 }); i.onerror = no; i.src = url; });
  return new Promise((ok, no) => {
    const v = document.createElement('video'); v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous'; v.setAttribute('playsinline', '');
    v.onloadeddata = () => ok({ el: v, url, kind: 'video', dur: v.duration }); v.onerror = () => no(new Error('Formato não suportado: ' + file.name)); v.src = url;
  });
}
function newClip(file, m, extra = {}) {
  return { id: uid(), file, url: m.url, el: m.el, kind: m.kind, srcDur: m.dur, in: 0, out: m.dur, speed: 1, volume: 1, filter: 'original', filterAmt: 1, lut: 'nenhuma', lutAmt: 1, adj: { b: 0, c: 1, s: 1 }, effect: 'nenhum', transition: 'nenhuma', fit: 'contain', opacity: 1, key: { on: false, color: '#00ff00', tol: 0.12, soft: 0.08 }, mask: { type: 0, size: 0.35, feather: 0.05, invert: false }, motion: { on: false, ease: 'suave', from: { s: 1, x: 0, y: 0 }, to: { s: 1.2, x: 0, y: 0 } }, ...extra };
}
async function thumb(c) {
  const cv = document.createElement('canvas'); cv.height = 58; cv.width = Math.round(58 * ((c.el.videoWidth || c.el.naturalWidth) / (c.el.videoHeight || c.el.naturalHeight) || 1));
  try { cv.getContext('2d').drawImage(c.el, 0, 0, cv.width, cv.height); c.thumb = cv.toDataURL('image/jpeg', 0.6); } catch {}
}
async function importFiles(files) {
  for (const f of files) {
    try { const m = await loadEl(f); const c = newClip(f, m); P.clips.push(c); setTimeout(() => thumb(c).then(drawTimeline), 300); }
    catch (e) { toast(e.message); }
  }
  refresh();
}
async function demoClips() {
  const cols = [['#ffb347', '#ff5e7e'], ['#5ee6c1', '#7aa8ff'], ['#c4b5ff', '#ff6b6b']];
  const files = [];
  for (let i = 0; i < 3; i++) {
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920; const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 1080, 1920); g.addColorStop(0, cols[i][0]); g.addColorStop(1, cols[i][1]); x.fillStyle = g; x.fillRect(0, 0, 1080, 1920);
    x.fillStyle = '#ffffff33'; for (let k = 0; k < 14; k++) { x.beginPath(); x.arc((k * 397) % 1080, (k * 571) % 1920, 60 + (k * 37) % 140, 0, 7); x.fill(); }
    x.fillStyle = '#14121f'; x.font = '900 220px system-ui'; x.textAlign = 'center'; x.fillText(`Cena ${i + 1}`, 540, 1000);
    const b = await new Promise(r => cv.toBlob(r, 'image/png')); files.push(new File([b], `demo${i + 1}.png`, { type: 'image/png' }));
  }
  await importFiles(files);
  P.clips[1] && (P.clips[1].transition = 'slideL', P.clips[1].effect = 'zoomIn');
  P.clips[2] && (P.clips[2].transition = 'fade', P.clips[2].filter = 'neon');
  P.texts.push({ id: uid(), kind: 'text', text: 'Feito no Caps ✨', start: 0.3, end: 4, anim: 'pop', y: 0.2, size: 0.06, color: '#fff', stroke: '#14121f', bg: null });
  refresh();
}

// ---------- linha do tempo ----------
function drawTimeline() {
  const total = totalDur(P), vw = $('#tl').clientWidth;
  const inner = $('#tlInner'); inner.style.width = (total * PPS + vw) + 'px';
  const off = vw / 2;
  const ruler = $('#ruler'); ruler.innerHTML = '';
  const step = PPS > 80 ? 1 : PPS > 30 ? 2 : 5;
  for (let s = 0; s <= total + 0.01; s += step) ruler.insertAdjacentHTML('beforeend', `<span style="left:${off + s * PPS}px">${s}s</span>`);
  const tv = $('#trackV'); tv.innerHTML = '';
  for (const { c, start, end } of layout(P)) {
    const d = document.createElement('div'); d.className = 'clip' + (sel?.id === c.id ? ' sel' : '');
    d.style.left = off + start * PPS + 'px'; d.style.width = Math.max(8, (end - start) * PPS - 2) + 'px';
    if (c.thumb) d.style.backgroundImage = `url(${c.thumb})`;
    d.innerHTML = `<span class="tag">${(end - start).toFixed(1)}s${c.speed !== 1 ? ' · ' + c.speed + 'x' : ''}</span>` + (c.transition !== 'nenhuma' ? '<span class="tr">⇄</span>' : '');
    d.onclick = () => select('clip', c.id); tv.appendChild(d);
  }
  const tt = $('#trackT'); tt.innerHTML = '';
  for (const x of P.texts) {
    const d = document.createElement('div'); d.className = `chip ${x.kind}` + (sel?.id === x.id ? ' sel' : '');
    d.style.left = off + x.start * PPS + 'px'; d.style.width = Math.max(10, (x.end - x.start) * PPS - 2) + 'px'; d.textContent = x.text;
    d.onclick = () => select('text', x.id); tt.appendChild(d);
  }
  const tm = $('#trackM'); tm.innerHTML = '';
  if (P.music) {
    const d = document.createElement('div'); d.className = 'chip music' + (sel?.type === 'music' ? ' sel' : '');
    d.style.left = off + 'px'; d.style.width = Math.max(30, total * PPS) + 'px'; d.textContent = '♪ ' + P.music.file.name + (P.bpm ? ` · ${P.bpm} BPM` : '');
    for (const b of P.beats) if (b < total) d.insertAdjacentHTML('beforeend', `<i class="beat" style="left:${b * PPS}px"></i>`);
    d.onclick = () => select('music'); tm.appendChild(d);
  }
}
function refresh() { $('#empty').hidden = P.clips.length > 0; t = Math.min(t, totalDur(P)); drawTimeline(); drawTools(); }
function select(type, id) { sel = type ? { type, id } : null; setPlaying(false); refresh(); }
const selClip = () => sel?.type === 'clip' && P.clips.find(c => c.id === sel.id);
const selText = () => sel?.type === 'text' && P.texts.find(x => x.id === sel.id);

// ---------- ferramentas ----------
const TOOLS = {
  main: [['＋', 'Mídia', () => $('#fileIn').click()], ['Aa', 'Texto', addText], ['☺', 'Stickers', stickerSheet], ['♪', 'Música', addMusic], ['CC', 'Legendas', captionSheet], ['▦', 'Formato', toggleAspect], ['◐', 'Fundo', bgSheet], ['⚡', 'Na batida', beatSync]],
  clip: [['‹', 'Voltar', () => select(null), 'back'], ['✂', 'Dividir', split], ['⇤⇥', 'Aparar', trimSheet], ['⏱', 'Velocidade', speedSheet], ['⇄', 'Transição', trSheet], ['✦', 'Efeitos', fxSheet], ['◑', 'Filtros', filterSheet], ['☰', 'Ajustes', adjSheet], ['◆', 'Movimento', motionSheet], ['▣', 'Chroma', keySheet], ['◯', 'Máscara', maskSheet], ['❄', 'Congelar', freeze], ['🔊', 'Volume', volSheet], ['←', 'Mover', () => move(-1)], ['→', 'Mover', () => move(1)], ['⧉', 'Duplicar', dup], ['🗑', 'Excluir', delSel]],
  text: [['‹', 'Voltar', () => select(null), 'back'], ['✎', 'Editar', textSheet], ['⇤⇥', 'Tempo', textTimeSheet], ['🗑', 'Excluir', delSel]],
  music: [['‹', 'Voltar', () => select(null), 'back'], ['🔊', 'Volume', musicSheet], ['⚡', 'Batidas', beatSync], ['🗑', 'Remover', () => { P.music.el.pause(); P.music = null; P.beats = []; select(null); }]],
};
function drawTools() {
  const set = sel ? TOOLS[sel.type] : TOOLS.main, nav = $('#tools'); nav.innerHTML = '';
  for (const [i, l, fn, cls] of set) { const b = document.createElement('button'); b.className = 'tool ' + (cls || ''); b.innerHTML = `<i>${i}</i>${l}`; b.onclick = fn; nav.appendChild(b); }
}

// ---------- bottom sheet ----------
function sheet(title, html, bind) {
  setPlaying(false); $('#sheetTitle').textContent = title; $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; bind && bind($('#sheetBody'));
}
function closeSheet() { $('#sheet').hidden = true; refresh(); }
$('#sheetClose').onclick = closeSheet; $('#sheet').onclick = e => { if (e.target.id === 'sheet') closeSheet(); };
const range = (id, label, min, max, step, val, unit = '') => `<div class="row"><label>${label}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><output id="${id}o">${(+val).toFixed(step < 1 ? 2 : 0)}${unit}</output></div>`;
function onRange(root, id, fn, unit = '') { const r = root.querySelector('#' + id); r.oninput = () => { root.querySelector('#' + id + 'o').textContent = (+r.value).toFixed(r.step < 1 ? 2 : 0) + unit; fn(+r.value); drawTimeline(); }; }
function grid(root, items, cur, fn) { const g = root.querySelector('.grid'); for (const [k, n, sw] of items) { const b = document.createElement('button'); b.className = 'opt' + (k === cur ? ' on' : ''); b.innerHTML = (sw ? `<span class="sw" style="${sw}"></span>` : '') + n; b.onclick = () => { g.querySelectorAll('.opt').forEach(o => o.classList.remove('on')); b.classList.add('on'); fn(k); drawTimeline(); }; g.appendChild(b); } }

function split() {
  const c = selClip(); if (!c) return;
  const L = layout(P).find(x => x.c === c), local = t - L.start;
  if (local < 0.1 || L.end - t < 0.1) return toast('Mova a agulha para dentro do clipe');
  const at = c.in + local * (c.kind === 'image' ? 1 : c.speed);
  const el2 = c.kind === 'image' ? c.el : Object.assign(document.createElement('video'), { src: c.url, playsInline: true, preload: 'auto', muted: false });
  const c2 = { ...structuredClone({ ...c, el: null, file: null, thumb: null }), id: uid(), el: el2, file: c.file, thumb: c.thumb, in: at, transition: 'nenhuma' };
  c.out = at; P.clips.splice(P.clips.indexOf(c) + 1, 0, c2); toast('Clipe dividido'); refresh();
}
function dup() { const c = selClip(); const el2 = c.kind === 'image' ? c.el : Object.assign(document.createElement('video'), { src: c.url, playsInline: true, preload: 'auto' }); P.clips.splice(P.clips.indexOf(c) + 1, 0, { ...structuredClone({ ...c, el: null, file: null, thumb: null }), id: uid(), el: el2, file: c.file, thumb: c.thumb }); refresh(); }
async function freeze() {
  const c = selClip(); if (!c || c.kind !== 'video') return toast('Congelar funciona em vídeos');
  const cv = document.createElement('canvas'); cv.width = c.el.videoWidth; cv.height = c.el.videoHeight; cv.getContext('2d').drawImage(c.el, 0, 0);
  const f = new File([await new Promise(r => cv.toBlob(r, 'image/png'))], 'quadro.png', { type: 'image/png' });
  const m = await loadEl(f), nc = newClip(f, m, { filter: c.filter, lut: c.lut, adj: { ...c.adj } }); nc.out = 2; await thumb(nc);
  split(); P.clips.splice(P.clips.indexOf(c) + 1, 0, nc); toast('Quadro congelado (2s)'); refresh();
}
function move(d) { const c = selClip(), i = P.clips.indexOf(c), j = i + d; if (j < 0 || j >= P.clips.length) return; P.clips.splice(i, 1); P.clips.splice(j, 0, c); refresh(); }
function delSel() { if (sel.type === 'clip') P.clips = P.clips.filter(c => c.id !== sel.id); else P.texts = P.texts.filter(x => x.id !== sel.id); select(null); }

function trimSheet() {
  const c = selClip(), max = c.kind === 'image' ? 30 : c.srcDur;
  sheet(c.kind === 'image' ? 'Duração da foto' : 'Aparar', (c.kind === 'video' ? range('tin', 'Início', 0, max, 0.05, c.in, 's') : '') + range('tout', c.kind === 'image' ? 'Duração' : 'Fim', 0.1, max, 0.05, c.out, 's'), r => {
    if (c.kind === 'video') onRange(r, 'tin', v => { c.in = Math.min(v, c.out - 0.1); t = layout(P).find(x => x.c === c).start; }, 's');
    onRange(r, 'tout', v => { c.out = Math.max(v, c.in + 0.1); t = layout(P).find(x => x.c === c).end - 0.05; }, 's');
  });
}
function speedSheet() {
  const c = selClip(); if (c.kind === 'image') return toast('Velocidade vale para vídeos');
  sheet('Velocidade', `<div class="grid"></div>` + range('spd', 'Ajuste fino', 0.25, 4, 0.05, c.speed, 'x') + '<p class="note">O áudio acompanha a velocidade (muda o tom). Curvas de velocidade estão planejadas.</p>', r => {
    grid(r, [[0.25, '0.25x'], [0.5, '0.5x'], [1, '1x'], [1.5, '1.5x'], [2, '2x'], [3, '3x'], [4, '4x']], c.speed, v => (c.speed = v));
    onRange(r, 'spd', v => (c.speed = v), 'x');
  });
}
function trSheet() {
  const c = selClip(); if (P.clips.indexOf(c) === 0) return toast('A transição entra no começo do clipe — escolha o 2º em diante');
  sheet('Transição de entrada', '<div class="grid"></div>', r => grid(r, [['nenhuma', 'Nenhuma'], ['fade', 'Dissolver'], ['slideL', 'Deslizar ←'], ['slideU', 'Deslizar ↑'], ['zoom', 'Zoom'], ['preto', 'Pelo preto']], c.transition, v => (c.transition = v)));
}
function fxSheet() { const c = selClip(); sheet('Efeitos', '<div class="grid"></div>', r => grid(r, [['nenhum', 'Nenhum'], ['zoomIn', 'Aproximar'], ['zoomOut', 'Afastar'], ['tremor', 'Tremor'], ['pulso', 'Pulso'], ['flash', 'Pisca']], c.effect, v => (c.effect = v))); }
function filterSheet() {
  const c = selClip();
  const ap = (m, c) => { const [r, g, b] = c.map(v => v / 255); return [0, 5, 10].map(o => Math.round(255 * Math.min(1, Math.max(0, m[o] * r + m[o + 1] * g + m[o + 2] * b + m[o + 4])))).join(','); };
  const sw = k => { const m = FILTERS[k].m; return `background:linear-gradient(135deg,rgb(${ap(m, [255, 179, 71])}),rgb(${ap(m, [94, 160, 230])}) 60%,rgb(${ap(m, [40, 37, 64])}))`; };
  sheet('Filtros e LUTs', `<div class="grid" id="g1"></div>${range('famt', 'Intensidade', 0, 1, 0.01, c.filterAmt)}<b>LUT 3D</b><div class="grid" id="g2" style="margin-top:8px"></div>${range('lamt', 'Força LUT', 0, 1, 0.01, c.lutAmt)}<label class="btn">Importar .cube<input type="file" id="cube" accept=".cube" hidden></label><button class="btn" id="all">Aplicar a todos os clipes</button>`, r => {
    const g1 = r.querySelector('#g1'), g2 = r.querySelector('#g2');
    g1.classList.add('grid'); r.querySelector('#g2').className = '';
    const mk = (g, items, cur, fn) => { g.className = 'grid'; for (const [k, n, s] of items) { const b = document.createElement('button'); b.className = 'opt' + (k === cur ? ' on' : ''); b.innerHTML = (s ? `<span class="sw" style="${s}"></span>` : '') + n; b.onclick = () => { g.querySelectorAll('.opt').forEach(o => o.classList.remove('on')); b.classList.add('on'); fn(k); }; g.appendChild(b); } };
    mk(g1, Object.entries(FILTERS).map(([k, v]) => [k, v.nome, sw(k)]), c.filter, v => (c.filter = v));
    mk(g2, Object.entries(LUTS).map(([k, v]) => [k, v.nome]).concat(c.customLut ? [['custom', 'Minha .cube']] : []), c.customLut ? 'custom' : c.lut, v => { if (v !== 'custom') { c.customLut = null; c.lut = v; } });
    onRange(r, 'famt', v => (c.filterAmt = v)); onRange(r, 'lamt', v => (c.lutAmt = v));
    r.querySelector('#cube').onchange = async e => { try { c.customLut = parseCube(await e.target.files[0].text()); toast(`LUT ${c.customLut.size}³ carregada`); } catch (er) { toast(er.message); } };
    r.querySelector('#all').onclick = () => { for (const o of P.clips) Object.assign(o, { filter: c.filter, filterAmt: c.filterAmt, lut: c.lut, lutAmt: c.lutAmt, customLut: c.customLut }); toast('Aplicado a todos'); };
  });
}
function adjSheet() { const c = selClip(); sheet('Ajustes', range('ab', 'Brilho', -0.3, 0.3, 0.01, c.adj.b) + range('ac', 'Contraste', 0.5, 1.6, 0.01, c.adj.c) + range('as', 'Saturação', 0, 2, 0.01, c.adj.s) + range('op', 'Opacidade', 0, 1, 0.01, c.opacity) + '<div class="row"><label>Enquadrar</label><select id="fit"><option value="contain">Caber (barras)</option><option value="cover">Preencher (corta)</option></select></div>', r => { onRange(r, 'ab', v => (c.adj.b = v)); onRange(r, 'ac', v => (c.adj.c = v)); onRange(r, 'as', v => (c.adj.s = v)); onRange(r, 'op', v => (c.opacity = v)); const f = r.querySelector('#fit'); f.value = c.fit; f.onchange = () => (c.fit = f.value); }); }
function motionSheet() {
  const c = selClip(), m = c.motion;
  sheet('Movimento (keyframes)', `<p class="note">Dois quadros-chave: início e fim do clipe. O Caps interpola zoom e posição com a curva escolhida.</p><div class="row"><label>Ativo</label><input type="checkbox" id="mon" ${m.on ? 'checked' : ''}></div><div class="row"><label>Curva</label><select id="me"><option value="linear">Linear</option><option value="suave">Suave</option><option value="entrada">Acelera</option><option value="saida">Desacelera</option></select></div><b>Início ◆</b>${range('fs', 'Zoom', 0.5, 3, 0.01, m.from.s)}${range('fx', 'X', -0.5, 0.5, 0.01, m.from.x)}${range('fy', 'Y', -0.5, 0.5, 0.01, m.from.y)}<b>Fim ◆</b>${range('ts', 'Zoom', 0.5, 3, 0.01, m.to.s)}${range('tx', 'X', -0.5, 0.5, 0.01, m.to.x)}${range('ty', 'Y', -0.5, 0.5, 0.01, m.to.y)}`, r => {
    r.querySelector('#mon').onchange = e => (m.on = e.target.checked); const e = r.querySelector('#me'); e.value = m.ease; e.onchange = () => (m.ease = e.value);
    for (const [id, o, k] of [['fs', m.from, 's'], ['fx', m.from, 'x'], ['fy', m.from, 'y'], ['ts', m.to, 's'], ['tx', m.to, 'x'], ['ty', m.to, 'y']]) onRange(r, id, v => { o[k] = v; m.on = true; r.querySelector('#mon').checked = true; });
  });
}
function keySheet() { const c = selClip(), k = c.key; sheet('Chroma key', `<p class="note">Remove uma cor (tela verde). Coloque o clipe sobre um fundo de cor em “Fundo”. Sobreposição de várias camadas está planejada.</p><div class="row"><label>Ativo</label><input type="checkbox" id="kon" ${k.on ? 'checked' : ''}></div><div class="row"><label>Cor</label><input type="color" id="kc" value="${k.color}"></div>${range('kt', 'Tolerância', 0.01, 0.4, 0.005, k.tol)}${range('ks', 'Suavidade', 0, 0.3, 0.005, k.soft)}`, r => { r.querySelector('#kon').onchange = e => (k.on = e.target.checked); r.querySelector('#kc').oninput = e => { k.color = e.target.value; k.on = true; }; onRange(r, 'kt', v => (k.tol = v)); onRange(r, 'ks', v => (k.soft = v)); }); }
function maskSheet() { const c = selClip(), m = c.mask; sheet('Máscara', `<div class="grid"></div>${range('ms', 'Tamanho', 0.05, 0.7, 0.01, m.size)}${range('mf', 'Borda suave', 0, 0.3, 0.01, m.feather)}<div class="row"><label>Inverter</label><input type="checkbox" id="mi" ${m.invert ? 'checked' : ''}></div>`, r => { grid(r, [[0, 'Nenhuma'], [1, 'Círculo'], [2, 'Faixa']], m.type, v => (m.type = v)); onRange(r, 'ms', v => (m.size = v)); onRange(r, 'mf', v => (m.feather = v)); r.querySelector('#mi').onchange = e => (m.invert = e.target.checked); }); }
function volSheet() { const c = selClip(); sheet('Volume do clipe', range('vol', 'Volume', 0, 2, 0.01, c.volume ?? 1), r => onRange(r, 'vol', v => (c.volume = v))); }
function bgSheet() { sheet('Cor de fundo', `<div class="row"><label>Cor</label><input type="color" id="bg" value="${P.bg || '#000000'}"></div>`, r => (r.querySelector('#bg').oninput = e => (P.bg = e.target.value))); }
function toggleAspect() { P.aspect = P.aspect === '9:16' ? '16:9' : '9:16'; setupStage(); toast('Formato ' + P.aspect); }
$('#aspectBtn').onclick = toggleAspect;

// ---------- texto & stickers ----------
function addText() { const x = { id: uid(), kind: 'text', text: 'Seu texto', start: t, end: t + 3, anim: 'pop', y: 0.5, size: 0.055, color: '#ffffff', stroke: '#14121f', bg: null }; P.texts.push(x); sel = { type: 'text', id: x.id }; refresh(); textSheet(); }
function textSheet() {
  const x = selText();
  sheet('Texto', `<textarea id="tx" rows="2">${x.text}</textarea><b style="display:block;margin-top:12px">Animação</b><div class="grid" style="margin-top:8px"></div>${range('ty', 'Posição', 0.05, 0.95, 0.01, x.y)}${range('tsz', 'Tamanho', 0.02, 0.15, 0.002, x.size)}<div class="row"><label>Cor</label><input type="color" id="tc" value="${x.color}"><label>Fundo</label><input type="checkbox" id="tb" ${x.bg ? 'checked' : ''}></div><div class="row"><label>Fonte</label><select id="tf"><option value="">Sistema</option><option value="Georgia, serif">Serifa</option><option value="ui-rounded, 'Arial Rounded MT Bold', system-ui">Arredondada</option><option value="'Courier New', monospace">Máquina</option><option value="'Marker Felt', 'Comic Sans MS', cursive">Caneta</option></select></div>`, r => {
    r.querySelector('#tx').oninput = e => { x.text = e.target.value; drawTimeline(); };
    grid(r, [['pop', 'Pop'], ['fade', 'Surgir'], ['subir', 'Subir'], ['digitar', 'Digitar'], ['balanco', 'Balanço'], ['nenhuma', 'Fixo']], x.anim, v => { x.anim = v; t = x.start; });
    onRange(r, 'ty', v => (x.y = v)); onRange(r, 'tsz', v => (x.size = v));
    r.querySelector('#tc').oninput = e => (x.color = e.target.value); r.querySelector('#tb').onchange = e => (x.bg = e.target.checked ? '#14121fcc' : null);
    const f = r.querySelector('#tf'); f.value = x.font || ''; f.onchange = () => (x.font = f.value);
  });
}
function textTimeSheet() { const x = selText(), T = Math.max(totalDur(P), x.end); sheet('Tempo do texto', range('ts', 'Começa', 0, T, 0.05, x.start, 's') + range('te', 'Termina', 0, T + 5, 0.05, x.end, 's'), r => { onRange(r, 'ts', v => { x.start = Math.min(v, x.end - 0.2); t = x.start; }, 's'); onRange(r, 'te', v => (x.end = Math.max(v, x.start + 0.2)), 's'); }); }
const STK = ['🔥', '✨', '😂', '❤️', '👀', '💯', '🎉', '⭐', '😎', '👏', '🚀', '⚡', '🇧🇷', '⚽', '🍕', '🎵', '💥', '👉'];
function stickerSheet() { sheet('Stickers', `<div class="stickers">${STK.map(s => `<button>${s}</button>`).join('')}</div><p class="note">Emojis do sistema. Stickers animados (Lottie) estão planejados.</p>`, r => r.querySelectorAll('button').forEach(b => (b.onclick = () => { P.texts.push({ id: uid(), kind: 'sticker', text: b.textContent, start: t, end: t + 2.5, anim: 'balanco', y: 0.35, x: 0.5, size: 0.12, color: '#fff' }); closeSheet(); toast('Sticker adicionado'); }))); }

// ---------- música & batidas ----------
function addMusic() {
  const i = Object.assign(document.createElement('input'), { type: 'file', accept: 'audio/*,video/*' });
  i.onchange = async () => {
    const f = i.files[0]; if (!f) return;
    const el = new Audio(URL.createObjectURL(f)); el.preload = 'auto';
    P.music && P.music.el.pause(); P.music = { file: f, el, volume: 0.6, offset: 0 }; P.beats = []; refresh(); toast('Música adicionada — analisando batidas…');
    const buf = await decode(f); if (buf) { const r = detectBeats(buf); P.beats = r.beats; P.bpm = r.bpm; drawTimeline(); toast(`${r.bpm} BPM detectados`); }
  };
  i.click();
}
function musicSheet() { const m = P.music; sheet('Música', range('mv', 'Volume', 0, 1, 0.01, m.volume) + range('mo', 'Começar em', 0, Math.max(1, (m.el.duration || 60) - 1), 0.1, m.offset, 's') + '<p class="note">Fade-out automático no último segundo. Volume dos clipes: selecione o clipe → Volume.</p>', r => { onRange(r, 'mv', v => (m.volume = v)); onRange(r, 'mo', v => (m.offset = v), 's'); }); }
function beatSync() {
  if (!P.music || !P.beats.length) return toast('Adicione uma música primeiro');
  sheet('Cortar na batida', '<p class="note">Ajusta a duração de cada clipe para terminar exatamente numa batida da música.</p><div class="grid"></div>', r => grid(r, [[1, 'Toda batida'], [2, 'A cada 2'], [4, 'A cada 4'], [8, 'A cada 8']], 0, n => {
    const per = 60 / P.bpm * n, first = P.beats[0];
    P.clips.forEach((c, i) => { const want = i === 0 ? first + per : per; const max = c.kind === 'image' ? 30 : (c.srcDur - c.in) / c.speed; c.out = c.in + Math.min(want, Math.floor(max / per) * per || max) * (c.kind === 'image' ? 1 : c.speed); });
    toast('Clipes alinhados às batidas'); drawTimeline();
  }));
}

// ---------- legendas (Whisper) ----------
function captionSheet() {
  if (!P.clips.length) return toast('Importe um vídeo com fala primeiro');
  sheet('Legendas automáticas', `<p class="note">Reconhecimento de fala com <b>Whisper</b> rodando no próprio aparelho (transformers.js + ONNX/WASM). Na 1ª vez baixa o modelo (tiny ≈ 40 MB, base ≈ 80 MB) e guarda em cache.</p><div class="row"><label>Modelo</label><select id="mdl"><option value="Xenova/whisper-tiny">Whisper tiny (rápido)</option><option value="Xenova/whisper-base">Whisper base (melhor)</option></select></div><div class="row"><label>Estilo</label><select id="cst"><option value="a">Branco c/ contorno</option><option value="b">Caixa escura</option><option value="c">Amarelo</option></select></div><div class="bar"><div id="cbar"></div></div><p id="cmsg" class="note"></p><button class="btn hot" id="go">Gerar legendas em português</button>`, r => {
    r.querySelector('#go').onclick = async () => {
      const msg = m => (r.querySelector('#cmsg').textContent = m), bar = r.querySelector('#cbar');
      msg('Extraindo áudio (16 kHz mono)…');
      const ab = await mix(P, totalDur(P), { sampleRate: 16000, channels: 1, music: false });
      if (!ab) return msg('Nenhum áudio encontrado nos clipes.');
      const w = new Worker(new URL('./captions-worker.js', import.meta.url), { type: 'module' });
      const files = {};
      w.onmessage = ({ data: d }) => {
        if (d.type === 'progress' && d.p.status === 'progress') { files[d.p.file] = d.p.progress; const v = Object.values(files); bar.style.width = (v.reduce((a, b) => a + b, 0) / v.length) + '%'; msg('Baixando modelo… ' + d.p.file); }
        if (d.type === 'status') { bar.style.width = '100%'; msg(d.msg); }
        if (d.type === 'error') { msg('Erro: ' + d.msg); w.terminate(); }
        if (d.type === 'done') {
          const st = r.querySelector('#cst').value;
          P.texts = P.texts.filter(x => x.kind !== 'caption');
          for (const ch of d.chunks) { const [s, e] = ch.timestamp; if (!ch.text.trim()) continue; P.texts.push({ id: uid(), kind: 'caption', text: ch.text.trim(), start: s, end: e ?? s + 2, anim: 'fade', y: 0.8, size: 0.042, color: st === 'c' ? '#ffe14d' : '#fff', stroke: st === 'b' ? null : '#000', bg: st === 'b' ? '#000000b3' : null }); }
          msg(`${d.chunks.length} trechos de legenda criados ✔`); w.terminate(); drawTimeline();
        }
      };
      w.postMessage({ audio: ab.getChannelData(0), model: r.querySelector('#mdl').value });
    };
  });
}

// ---------- exportação ----------
$('#exportBtn').onclick = () => {
  if (!P.clips.length) return toast('Nada para exportar ainda');
  sheet('Exportar MP4', `<div class="row"><label>Formato</label><select id="ea"><option>9:16</option><option>16:9</option></select></div><div class="row"><label>Resolução</label><select id="er"><option value="720">720p (recomendado no iPhone)</option><option value="1080">1080p</option><option value="480">480p (rápido)</option></select></div><div class="row"><label>Quadros/s</label><select id="ef"><option>30</option><option>24</option><option>60</option></select></div><div class="bar"><div id="ebar"></div></div><p id="emsg" class="note">Duração: ${fmt(totalDur(P))}. Mantenha o app aberto durante a exportação.</p><button class="btn hot" id="ego">Exportar</button><div id="eout"></div>`, r => {
    r.querySelector('#ea').value = P.aspect;
    r.querySelector('#ego').onclick = async e => {
      e.target.disabled = true; P.aspect = r.querySelector('#ea').value; setupStage();
      const t0 = performance.now();
      try {
        const { exportProject } = await import('./export.js');
        const res = await exportProject(P, { height: +r.querySelector('#er').value, fps: +r.querySelector('#ef').value, onProgress: (p, m) => { r.querySelector('#ebar').style.width = p * 100 + '%'; r.querySelector('#emsg').textContent = m; } });
        const file = new File([res.blob], `caps-${Date.now()}.mp4`, { type: 'video/mp4' }), url = URL.createObjectURL(file);
        window.__lastExport = { size: res.blob.size, W: res.W, H: res.H, encoder: res.encoder, secs: (performance.now() - t0) / 1000 };
        r.querySelector('#emsg').textContent = `Pronto: ${res.W}×${res.H}, ${(res.blob.size / 1e6).toFixed(1)} MB, via ${res.encoder}, em ${window.__lastExport.secs.toFixed(1)}s`;
        r.querySelector('#eout').innerHTML = `<video src="${url}" controls playsinline style="width:100%;border-radius:12px;margin-top:10px"></video><button class="btn hot" id="share">Salvar / Compartilhar</button><a class="btn" href="${url}" download="${file.name}">Baixar arquivo</a>`;
        r.querySelector('#share').onclick = () => navigator.canShare?.({ files: [file] }) ? navigator.share({ files: [file] }).catch(() => {}) : toast('Use “Baixar arquivo”');
      } catch (er) { console.error(er); r.querySelector('#emsg').textContent = 'Erro: ' + er.message; window.__lastExport = { error: er.message }; }
      e.target.disabled = false;
    };
  });
};

// ---------- eventos ----------
$('#fileIn').onchange = e => importFiles([...e.target.files]);
$('#demoBtn').onclick = demoClips;
$('#playBtn').onclick = () => { if (!P.clips.length) return; if (t >= totalDur(P) - 0.05) t = 0; setPlaying(!playing); };
$('#tl').addEventListener('scroll', () => { if (syncingScroll) return; if (playing) setPlaying(false); t = Math.min(totalDur(P), $('#tl').scrollLeft / PPS); }, { passive: true });
$('#zIn').onclick = () => { PPS = Math.min(240, PPS * 1.5); drawTimeline(); followScroll(); };
$('#zOut').onclick = () => { PPS = Math.max(10, PPS / 1.5); drawTimeline(); followScroll(); };
window.addEventListener('resize', drawTimeline);
// pinça para zoom na timeline
let pinch = 0; $('#tl').addEventListener('touchmove', e => { if (e.touches.length === 2) { const d = Math.abs(e.touches[0].clientX - e.touches[1].clientX); if (pinch) { PPS = Math.max(10, Math.min(240, PPS * d / pinch)); drawTimeline(); followScroll(); } pinch = d; e.preventDefault(); } }, { passive: false });
$('#tl').addEventListener('touchend', () => (pinch = 0));

setupStage(); refresh(); requestAnimationFrame(t0 => { lastTick = t0; tick(t0); });
if ('serviceWorker' in navigator && location.hostname !== 'localhost-nosw') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__caps = { P, select, get t() { return t; }, set t(v) { t = v; followScroll(); }, sheet: { trSheet, filterSheet, textSheet, captionSheet, motionSheet } };
