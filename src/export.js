// Exportação MP4: quadros renderizados no canvas → WebCodecs (H.264) + mp4-muxer;
// áudio mixado → ffmpeg.wasm (AAC) e multiplexado. Sem WebCodecs: ffmpeg.wasm codifica (libx264).
import { Renderer } from './renderer.js';
import { renderFrame, totalDur, activeAt } from './scene.js';
import { mix, toWav } from './audio.js';

let ff;
export async function getFFmpeg(log) {
  if (ff) return ff;
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const f = new FFmpeg();
  if (log) f.on('log', ({ message }) => log(message));
  const base = new URL('ffmpeg/', document.baseURI).href;
  await f.load({ coreURL: base + 'ffmpeg-core.js', wasmURL: base + 'ffmpeg-core.wasm' });
  return (ff = f);
}
function seek(el, t) {
  if (el.tagName !== 'VIDEO') return Promise.resolve();
  t = Math.max(0, Math.min(t, (el.duration || t) - 0.01));
  if (Math.abs(el.currentTime - t) < 0.002 && el.readyState >= 2) return Promise.resolve();
  return new Promise(r => { const done = () => { el.removeEventListener('seeked', done); clearTimeout(to); r(); }; const to = setTimeout(done, 3000); el.addEventListener('seeked', done); el.currentTime = t; });
}
export async function exportProject(p, { height = 720, fps = 30, onProgress = () => {}, log } = {}) {
  const portrait = p.aspect === '9:16';
  const short = height, long = Math.round(height * 16 / 9 / 2) * 2;
  const W = portrait ? short : long, H = portrait ? long : short;
  const R = new Renderer(W, H), total = totalDur(p), N = Math.ceil(total * fps);
  p.clips.forEach(c => c.el.pause && c.el.pause());
  const cfg = { codec: H * W > 921600 ? 'avc1.640028' : 'avc1.4d401f', width: W, height: H, bitrate: H * W > 921600 ? 8e6 : 4e6, framerate: fps };
  let useWC = false;
  try { useWC = 'VideoEncoder' in window && (await VideoEncoder.isConfigSupported(cfg)).supported; } catch {}
  onProgress(0, 'Preparando…');
  const f = await getFFmpeg(log);
  let muxer, enc, err;
  if (useWC) {
    const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
    muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H }, fastStart: 'in-memory' });
    enc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: e => (err = e) });
    enc.configure(cfg);
  }
  for (let i = 0; i < N; i++) {
    if (err) throw err;
    const t = i / fps;
    for (const a of activeAt(p, t)) await seek(a.c.el, a.srcT);
    renderFrame(R, p, t);
    if (useWC) {
      const vf = new VideoFrame(R.out, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(vf, { keyFrame: i % (fps * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 5));
    } else {
      const b = await new Promise(r => R.out.toBlob(r, 'image/jpeg', 0.9));
      await f.writeFile(`f${String(i).padStart(5, '0')}.jpg`, new Uint8Array(await b.arrayBuffer()));
    }
    onProgress((i + 1) / N * 0.8, `Quadro ${i + 1}/${N}`);
  }
  if (useWC) { await enc.flush(); muxer.finalize(); await f.writeFile('v.mp4', new Uint8Array(muxer.target.buffer)); }
  else {
    onProgress(0.82, 'Codificando H.264 (ffmpeg.wasm)…');
    await f.exec(['-framerate', String(fps), '-i', 'f%05d.jpg', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', 'v.mp4']);
    for (let i = 0; i < N; i++) await f.deleteFile(`f${String(i).padStart(5, '0')}.jpg`).catch(() => {});
  }
  onProgress(0.9, 'Mixando áudio…');
  const ab = await mix(p, total);
  if (ab) {
    await f.writeFile('a.wav', toWav(ab));
    await f.exec(['-i', 'v.mp4', '-i', 'a.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', 'out.mp4']);
  } else await f.exec(['-i', 'v.mp4', '-c', 'copy', '-movflags', '+faststart', 'out.mp4']);
  const data = await f.readFile('out.mp4');
  for (const n of ['v.mp4', 'a.wav', 'out.mp4']) await f.deleteFile(n).catch(() => {});
  onProgress(1, 'Pronto!');
  return { blob: new Blob([data.buffer], { type: 'video/mp4' }), W, H, encoder: useWC ? 'WebCodecs' : 'ffmpeg.wasm/libx264' };
}
