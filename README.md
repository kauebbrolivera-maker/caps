# Caps

Editor de vídeo **original**, mobile-first, que roda 100 % no navegador do iPhone (PWA). Interface em português.

- Prévia: WebGL (shader próprio: filtros, LUT 3D, ajustes, chroma key, máscara, movimento) + canvas 2D (textos/stickers/legendas)
- Exportação: WebCodecs (H.264) + mp4-muxer + **ffmpeg.wasm single-thread** (AAC e mux; fallback libx264) — sem COOP/COEP, funciona no GitHub Pages
- Legendas: **Whisper** (tiny/base) via **transformers.js**, sob demanda, em pt-BR
- Página “Como funciona” (`como-funciona.html`) explica cada técnica. Checklist completo em `FEATURES.md`.

## Rodar
```bash
npm install
npm run dev        # desenvolvimento
npm run build      # gera dist/ (estático)
npm run preview    # serve dist/ em http://localhost:4173
npm run shots      # teste E2E com Playwright (viewport iPhone) → /workspace/caps-shots
```

## Publicar no GitHub Pages
Já existe `.github/workflows/pages.yml` (build com Vite + deploy oficial do Pages). `base: './'` no Vite → funciona em `usuario.github.io/caps/`.
1. Criar o repositório `caps` (público) na conta do Kaue.
2. `git remote add origin https://github.com/<usuario>/caps.git && git push -u origin main`
3. Settings → Pages → Source: **GitHub Actions**.
4. Esperar o workflow ficar verde; abrir `https://<usuario>.github.io/caps/` no Safari → Compartilhar → **Adicionar à Tela de Início**.

## Bots (futuro)
Telegram (Bot API, webhook) ou Discord (bot com slash command) poderiam receber vídeo + instruções (“corta os silêncios, legenda e 9:16”). Como o Caps edita no aparelho, o caminho seria: (a) o bot salva um **projeto JSON** + mídia e manda um link `…/caps/#projeto=<id>` que abre pronto no iPhone; ou (b) um worker headless (Playwright + o mesmo código do Caps ou ffmpeg nativo) num servidor renderiza e devolve o MP4. O formato de projeto (`P` em `src/main.js`) já é serializável exceto os elementos de mídia.

## Licença
MIT. Bibliotecas: @ffmpeg/ffmpeg (MIT, core LGPL/GPL do FFmpeg), @huggingface/transformers (Apache-2.0), onnxruntime-web (MIT), mp4-muxer (MIT), Whisper (MIT).
