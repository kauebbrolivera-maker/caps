// Modelo do projeto e cálculo do quadro em um instante t (usado na prévia e na exportação).
export const TR_DUR = 0.5;
export const clipDur = c => (c.out - c.in) / (c.kind === 'image' ? 1 : c.speed);
export function layout(p) { let t = 0; return p.clips.map(c => { const s = t; t += clipDur(c); return { c, start: s, end: t }; }); }
export const totalDur = p => p.clips.reduce((a, c) => a + clipDur(c), 0);
const ease = { linear: x => x, suave: x => x * x * (3 - 2 * x), entrada: x => x * x, saida: x => 1 - (1 - x) * (1 - x) };
const lerp = (a, b, x) => a + (b - a) * x;
function noise(t) { return Math.sin(t * 37.1) * 0.5 + Math.sin(t * 23.7 + 1.3) * 0.3 + Math.sin(t * 61.3 + 2.1) * 0.2; }

// Retorna {clip, srcT} das camadas necessárias em t (atual e, se em transição, anterior)
export function activeAt(p, t) {
  const L = layout(p); if (!L.length) return [];
  let i = L.findIndex(x => t < x.end); if (i < 0) i = L.length - 1;
  const cur = L[i], out = [];
  const local = Math.max(0, t - cur.start);
  const tr = cur.c.transition;
  if (i > 0 && tr && tr !== 'nenhuma' && local < TR_DUR) {
    const pv = L[i - 1]; out.push({ ...pv, srcT: pv.c.out - 0.05, local: clipDur(pv.c), role: 'prev', prog: local / TR_DUR, tr });
  }
  out.push({ ...cur, srcT: cur.c.in + local * (cur.c.kind === 'image' ? 1 : cur.c.speed), local, role: 'cur', prog: local / TR_DUR, tr: i > 0 ? tr : null });
  return out;
}

export function layerFor(a, t) {
  const c = a.c, d = clipDur(c), u = Math.min(1, a.local / Math.max(d, 0.01));
  let s = 1, tx = 0, ty = 0, alpha = 1;
  // "keyframes" de movimento: início → fim com curva de suavização
  const k = c.motion; if (k && k.on) { const e = (ease[k.ease] || ease.suave)(u); s = lerp(k.from.s, k.to.s, e); tx = lerp(k.from.x, k.to.x, e); ty = lerp(k.from.y, k.to.y, e); }
  switch (c.effect) {
    case 'zoomIn': s *= 1 + 0.25 * u; break;
    case 'zoomOut': s *= 1.25 - 0.25 * u; break;
    case 'tremor': s *= 1.08; tx += noise(t) * 0.025; ty += noise(t + 9) * 0.025; break;
    case 'pulso': s *= 1 + 0.06 * Math.abs(Math.sin(t * Math.PI * 2)); break;
    case 'flash': alpha *= 0.6 + 0.4 * Math.abs(Math.cos(t * Math.PI * 3)); break;
  }
  if (a.tr && a.prog < 1) {
    const x = a.prog, e = ease.suave(x);
    if (a.role === 'cur') {
      if (a.tr === 'fade') alpha *= e;
      if (a.tr === 'slideL') tx += 1 - e;
      if (a.tr === 'slideU') ty += 1 - e;
      if (a.tr === 'zoom') { s *= 1 + 0.6 * (1 - e); alpha *= e; }
      if (a.tr === 'preto') alpha *= Math.max(0, x * 2 - 1);
    } else {
      if (a.tr === 'slideL') tx -= e;
      if (a.tr === 'slideU') ty -= e;
      if (a.tr === 'preto') alpha *= Math.max(0, 1 - x * 2);
    }
  }
  const el = c.el;
  return { el, sw: el.videoWidth || el.naturalWidth, sh: el.videoHeight || el.naturalHeight, s, tx, ty, alpha, clip: c };
}

// Textos, stickers e legendas animados no canvas 2D
export function drawTexts(ctx, p, t, W, H) {
  for (const x of p.texts) {
    if (t < x.start || t > x.end) continue;
    const lt = t - x.start, rem = x.end - t;
    let sc = 1, a = 1, dy = 0, str = x.text;
    const inP = Math.min(1, lt / 0.35);
    switch (x.anim) {
      case 'pop': { const b = 1.70158; const q = inP - 1; sc = 1 + (b + 1) * q * q * q + b * q * q; break; }
      case 'fade': a = inP; break;
      case 'subir': dy = (1 - ease.saida(inP)) * 0.08 * H; a = inP; break;
      case 'digitar': str = x.text.slice(0, Math.ceil(x.text.length * Math.min(1, lt / Math.max(0.4, (x.end - x.start) * 0.5)))); break;
      case 'balanco': sc = 1 + Math.sin(lt * 6) * 0.05; break;
    }
    if (rem < 0.2) a *= rem / 0.2;
    const size = x.size * H;
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    ctx.translate(W * (x.x ?? 0.5), H * x.y + dy); ctx.scale(Math.max(0.01, sc), Math.max(0.01, sc));
    ctx.font = `${x.kind === 'sticker' ? '' : '800 '}${size}px ${x.font || 'system-ui, -apple-system, sans-serif'}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = wrap(ctx, str, W * 0.86);
    lines.forEach((ln, i) => {
      const y = (i - (lines.length - 1) / 2) * size * 1.15;
      if (x.bg) { const w = ctx.measureText(ln).width; ctx.fillStyle = x.bg; roundRect(ctx, -w / 2 - size * 0.3, y - size * 0.65, w + size * 0.6, size * 1.3, size * 0.25); }
      if (x.stroke) { ctx.lineWidth = size * 0.16; ctx.strokeStyle = x.stroke; ctx.lineJoin = 'round'; ctx.strokeText(ln, 0, y); }
      ctx.fillStyle = x.color || '#fff'; ctx.fillText(ln, 0, y);
    });
    ctx.restore();
  }
}
function wrap(ctx, s, max) {
  const out = []; for (const para of s.split('\n')) { let line = ''; for (const w of para.split(' ')) { const tt = line ? line + ' ' + w : w; if (ctx.measureText(tt).width > max && line) { out.push(line); line = w; } else line = tt; } out.push(line); } return out;
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.fill(); }

export function renderFrame(R, p, t) {
  R.clear();
  for (const a of activeAt(p, t)) R.drawLayer(layerFor(a, t));
  R.compose(p.bg || '#000');
  drawTexts(R.ctx, p, t, R.w, R.h);
}
