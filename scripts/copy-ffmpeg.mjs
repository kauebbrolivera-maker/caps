// Copia o núcleo single-thread do ffmpeg.wasm para public/ (auto-hospedado, sem CDN, sem COOP/COEP)
import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('public/ffmpeg', { recursive: true });
for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm'])
  copyFileSync(`node_modules/@ffmpeg/core/dist/esm/${f}`, `public/ffmpeg/${f}`);
console.log('ffmpeg core copiado');
