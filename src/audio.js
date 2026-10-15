// Áudio: decodificação, mixagem offline (Web Audio), WAV e detecção de batidas.
import { layout } from './scene.js';
const cache = new Map();
export async function decode(file) {
  if (cache.has(file)) return cache.get(file);
  const pr = (async () => {
    try { const ac = new OfflineAudioContext(1, 1, 48000); return await ac.decodeAudioData(await file.arrayBuffer()); }
    catch { return null; } // arquivo sem trilha de áudio
  })();
  cache.set(file, pr); return pr;
}
// Renderiza a trilha final na linha do tempo (clipes + música)
export async function mix(p, total, { sampleRate = 48000, channels = 2, music = true } = {}) {
  const len = Math.max(1, Math.ceil(total * sampleRate));
  const ac = new OfflineAudioContext(channels, len, sampleRate);
  let any = false;
  for (const { c, start, end } of layout(p)) {
    if (c.kind !== 'video' || (c.volume ?? 1) === 0) continue;
    const buf = await decode(c.file); if (!buf) continue;
    const src = ac.createBufferSource(); src.buffer = buf; src.playbackRate.value = c.speed;
    const g = ac.createGain(); g.gain.value = c.volume ?? 1;
    src.connect(g).connect(ac.destination); src.start(start, c.in); src.stop(end); any = true;
  }
  if (music && p.music) {
    const buf = await decode(p.music.file);
    if (buf) {
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const g = ac.createGain(); const v = p.music.volume;
      g.gain.setValueAtTime(v, 0); g.gain.setValueAtTime(v, Math.max(0, total - 1.2)); g.gain.linearRampToValueAtTime(0, total);
      src.connect(g).connect(ac.destination); src.start(0, p.music.offset || 0); src.stop(total); any = true;
    }
  }
  if (!any) return null;
  return ac.startRendering();
}
export function toWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate;
  const dv = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, ch, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, i) => buf.getChannelData(i)); let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Uint8Array(dv.buffer);
}
// Detecção de batidas: fluxo de energia (onset) + autocorrelação para estimar o BPM
export function detectBeats(buf) {
  const d = buf.getChannelData(0), sr = buf.sampleRate, hop = 512, nF = Math.floor(d.length / hop);
  const env = new Float32Array(nF); let prev = 0;
  for (let f = 0; f < nF; f++) { let e = 0; for (let i = f * hop; i < (f + 1) * hop; i++) e += d[i] * d[i]; e = Math.log(1e-6 + e); env[f] = Math.max(0, e - prev); prev = e; }
  const fps = sr / hop; let best = 0, lag0 = 0;
  for (let bpm = 70; bpm <= 180; bpm++) { const lag = Math.round(fps * 60 / bpm); let s = 0; for (let i = lag; i < nF; i++) s += env[i] * env[i - lag]; if (s > best) { best = s; lag0 = lag; } }
  if (!lag0) return { bpm: 0, beats: [] };
  let ph = 0, bs = -1; for (let o = 0; o < lag0; o++) { let s = 0; for (let i = o; i < nF; i += lag0) s += env[i]; if (s > bs) { bs = s; ph = o; } }
  const beats = []; for (let i = ph; i < nF; i += lag0) beats.push(i / fps);
  return { bpm: Math.round(fps * 60 / lag0), beats };
}
