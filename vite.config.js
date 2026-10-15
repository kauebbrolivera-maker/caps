import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist', target: 'es2020',
    rollupOptions: { input: { main: resolve('index.html'), comoFunciona: resolve('como-funciona.html') } },
  },
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@huggingface/transformers'] },
  worker: { format: 'es' },
});
