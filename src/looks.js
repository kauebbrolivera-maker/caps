// Filtros (matrizes de cor 4x5) e LUTs 3D geradas proceduralmente — tudo original do Caps.
// Matriz no formato [r,g,b,a,offset] por linha (como feColorMatrix), offset em 0..1.
const I = [1,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0];
function sat(s) {
  const r = 0.2126 * (1 - s), g = 0.7152 * (1 - s), b = 0.0722 * (1 - s);
  return [r + s, g, b, 0, 0, r, g + s, b, 0, 0, r, g, b + s, 0, 0, 0, 0, 0, 1, 0];
}
export const FILTERS = {
  original: { nome: 'Original', m: I },
  vivo:     { nome: 'Vivo', m: sat(1.45) },
  pb:       { nome: 'P&B', m: sat(0) },
  memoria:  { nome: 'Memória', m: [0.39,0.77,0.19,0,0.02, 0.35,0.69,0.17,0,0.01, 0.27,0.53,0.13,0,0, 0,0,0,1,0] },
  mar:      { nome: 'Mar', m: [0.9,0,0,0,0, 0,1,0.05,0,0.02, 0,0.08,1.12,0,0.04, 0,0,0,1,0] },
  brasa:    { nome: 'Brasa', m: [1.12,0.04,0,0,0.03, 0,1.02,0,0,0.01, 0,0,0.86,0,0, 0,0,0,1,0] },
  nevoa:    { nome: 'Névoa', m: [0.8,0.05,0.05,0,0.1, 0.05,0.8,0.05,0,0.1, 0.05,0.05,0.8,0,0.12, 0,0,0,1,0] },
  neon:     { nome: 'Neon', m: [1.2,0,0.15,0,-0.05, 0,0.95,0.1,0,-0.02, 0.15,0,1.3,0,0, 0,0,0,1,0] },
};

// LUT 3D (.cube) — tamanho N, dados Float32 rgb em ordem r mais rápido, depois g, depois b.
function makeLut(N, fn) {
  const d = new Float32Array(N * N * N * 3); let i = 0;
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
    const o = fn(r / (N - 1), g / (N - 1), b / (N - 1)); d[i++] = o[0]; d[i++] = o[1]; d[i++] = o[2];
  }
  return { size: N, data: d };
}
const cl = x => Math.min(1, Math.max(0, x));
const smooth = x => x * x * (3 - 2 * x);
export const LUTS = {
  nenhuma: { nome: 'Nenhuma', lut: null },
  cinema: { nome: 'Cinema', lut: makeLut(17, (r, g, b) => {
    const l = 0.3 * r + 0.59 * g + 0.11 * b; // sombras puxadas para ciano, altas para âmbar
    return [cl(smooth(r) + (l - 0.5) * 0.12), cl(smooth(g) + 0.01), cl(smooth(b) - (l - 0.5) * 0.18)];
  }) },
  pastel: { nome: 'Pastel', lut: makeLut(17, (r, g, b) => [0.15 + r * 0.78, 0.13 + g * 0.8, 0.18 + b * 0.76]) },
  noite: { nome: 'Noite', lut: makeLut(17, (r, g, b) => { const l = 0.3*r+0.59*g+0.11*b; return [cl(l*0.6+r*0.2), cl(l*0.75+g*0.2), cl(l*0.9+b*0.3+0.05)]; }) },
  ouro: { nome: 'Ouro', lut: makeLut(17, (r, g, b) => [cl(Math.pow(r, 0.85) + 0.03), cl(Math.pow(g, 0.95)), cl(Math.pow(b, 1.2) * 0.9)]) },
};

// Parser de arquivos .cube (formato aberto da Adobe/Resolve)
export function parseCube(text) {
  let size = 0; const vals = [];
  let dmin = [0, 0, 0], dmax = [1, 1, 1];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const p = line.split(/\s+/);
    if (p[0] === 'LUT_3D_SIZE') size = +p[1];
    else if (p[0] === 'DOMAIN_MIN') dmin = p.slice(1).map(Number);
    else if (p[0] === 'DOMAIN_MAX') dmax = p.slice(1).map(Number);
    else if (/^[-\d.]/.test(p[0]) && p.length >= 3) vals.push(+p[0], +p[1], +p[2]);
  }
  if (!size || vals.length < size ** 3 * 3) throw new Error('Arquivo .cube inválido (só LUT 3D é suportada)');
  const d = new Float32Array(vals.slice(0, size ** 3 * 3));
  for (let i = 0; i < d.length; i++) { const c = i % 3; d[i] = (d[i] - dmin[c]) / (dmax[c] - dmin[c]); }
  return { size, data: d };
}
