# Caps — checklist de recursos (pt-BR)

Lista de categorias de um editor mobile completo (pesquisa feita a partir da página da App Store e da central de ajuda pública de editores populares). **Nada de código, efeito, som, template, ícone, cor ou marca de terceiros foi copiado** — cada item abaixo é implementado de forma original ou com bibliotecas/modelos abertos.

Legenda: ✅ feito e testado · 🟡 parcial · 🗓️ planejado

> **Atualização 19/10/2026** — site reorganizado: **landing page** em `/caps/` e **editor** em `/caps/editor/` (o app instalado na Tela de Início abre direto o editor; `/caps/?editor` também redireciona). Testado em Chromium headless emulando **iPhone 14** (`test/e2e-mobile.mjs`): landing → abrir editor → importar MP4/WebM → dividir → aparar arrastando a alça → excluir → transição Desfocar → Ken Burns → filtro + ajustes → texto “Quicar” → legendas Whisper (editadas à mão) → exportar 9:16 **1080×1920**, 1:1 e 16:9 (todos validados com `ffprobe`: H.264 + AAC, 30 fps).

## 0. Site
| Recurso | Status | Técnica |
|---|---|---|
| Landing page (hero com “Abrir editor”, recursos com ilustrações em CSS, privacidade, como funciona, dúvidas, rodapé) | ✅ | HTML/CSS próprios, sem imagens de terceiros |
| Editor em `/caps/editor/` + redirecionamento do app instalado | ✅ | `display-mode: standalone` → `editor/`; `start_url` do manifest = `./editor/` |
| Mini App Open em `/caps/open/` | ✅ | projeto separado (não mexido); o service worker do Caps ignora `/open/` |

## 1. Edição básica
| Recurso | Status | Técnica |
|---|---|---|
| Importar vídeos e fotos | ✅ | `<input type=file>` + Object URLs (fica tudo no aparelho) |
| Linha do tempo com clipes, agulha central, zoom (botões e pinça) | ✅ | DOM + scroll horizontal (toque) |
| Aparar arrastando as alças do clipe selecionado (toque) | ✅ | Pointer Events + `touch-action:none` |
| Dividir na agulha | ✅ | novo clipe com `in/out` |
| Aparar (início/fim) / duração da foto | ✅ | sliders |
| Reordenar, duplicar, excluir | ✅ | |
| Congelar quadro | ✅ | captura do quadro em canvas → clipe-imagem de 2 s |
| Formato 9:16 → 1:1 → 16:9, caber/preencher, cor de fundo | ✅ | |
| Reverter clipe | 🗓️ | ffmpeg.wasm `-vf reverse` em trecho curto |
| Desfazer/refazer, salvar projeto | 🗓️ | snapshots do estado + IndexedDB/OPFS |
| Multitrilha (sobreposição/PiP) | 🗓️ | o renderer já compõe camadas; falta UI |

## 2. Velocidade
| Velocidade constante 0,25×–4× | ✅ | `playbackRate` na prévia; reamostragem no export |
| Curvas de velocidade (rampas) | 🗓️ | integrar curva Bézier tempo→tempo de origem; áudio com WSOLA/`rubberband-wasm` |
| Câmera lenta suave (interpolação) | 🗓️ | RIFE/FILM (ONNX) — pesado para iPhone |

## 3. Keyframes / animação
| Movimento com 2 keyframes (zoom, X, Y) + curvas de easing | ✅ | interpolação `a+(b−a)·ease(t)` no shader |
| Keyframes ilimitados em qualquer propriedade | 🗓️ | lista ordenada de keyframes por propriedade |
| Efeitos de câmera: aproximar, afastar, tremor, pulso, pisca | ✅ | fórmulas próprias (tremor = soma de senos) |
| Transições: dissolver, deslizar ←/↑, zoom +/−, **desfocar**, pelo preto; “aplicar em todos os cortes” | ✅ | duas camadas + alfa/offset/blur (13 amostras no shader) em 0,5 s |
| Ken Burns com 1 toque (aproximar/afastar lento, passear ←/→, subir, diagonal) | ✅ | predefinições que preenchem os 2 keyframes |

## 4. Máscaras, chroma key, remoção de fundo
| Máscara círculo/faixa, borda suave, inverter | ✅ | `smoothstep` no fragment shader |
| Chroma key (cor, tolerância, suavidade) | ✅ | distância em Cb/Cr (YCbCr) |
| Remover fundo automático | 🗓️ | **MediaPipe Selfie Segmentation** (tempo real) ou **RMBG-1.4 / MODNet** via transformers.js |
| Rastreamento de movimento | 🗓️ | MediaPipe Face/Object Detector ou optical flow (OpenCV.js) |
| Estabilização | 🗓️ | ffmpeg `vidstab` (não está no core wasm padrão) ou optical flow |

## 5. Filtros, cor e efeitos
| 8 filtros próprios (matriz 4×5) com intensidade | ✅ | |
| Ajustes brilho/contraste/saturação/opacidade | ✅ | |
| LUT 3D: 4 LUTs próprias + importar `.cube` | ✅ | parser `.cube`, textura 2D fatiada, interpolação entre fatias |
| Efeitos glitch, blur, RGB split, grão | 🗓️ | shaders GLSL extras |

## 6. Texto, stickers, templates
| Texto animado (pop, máquina de escrever, deslizar, quicar, zoom, surgir, subir, balanço), cor, fundo, fonte, posição, tamanho | ✅ | canvas 2D, curvas próprias (back-out, bounce-out) |
| Stickers (emoji) animados | ✅ | |
| Stickers animados Lottie / GIF | 🗓️ | `lottie-web` renderizando em canvas |
| Templates | 🗓️ | JSON de projeto com “slots” de mídia — criados pelo próprio Kaue |
| Importar fontes | 🗓️ | `FontFace` API |

## 7. Áudio e batidas
| Trilha de música com volume, início e fade-out | ✅ | Web Audio |
| Volume por clipe (0–200 %) | ✅ | |
| Detecção de BPM/batidas + marcadores | ✅ | fluxo de onset + autocorrelação (`src/audio.js`) |
| Cortar na batida (1/2/4/8 batidas) | ✅ | |
| Extrair áudio de vídeo | 🟡 | a música aceita arquivos de vídeo |
| Gravar narração | 🗓️ | `MediaRecorder` do microfone |
| Redução de ruído | 🗓️ | **RNNoise** (wasm) ou **DeepFilterNet** |
| Efeitos sonoros | 🗓️ | sons gerados/CC0 (nunca de terceiros) |

## 8. IA
| Legendas automáticas pt-BR | ✅ | **Whisper tiny/base** (OpenAI, MIT) em ONNX q8 via **transformers.js** num Web Worker (tiny testado: modelo baixa e transcreve ~7 s de fala em ~6 s) |
| Legendas editáveis (lista com texto, pular para o trecho, apagar), 5 estilos, 3 posições, trilha própria na timeline, gravadas no MP4 | ✅ | trechos viram camadas de texto renderizadas em cada quadro; marcações como `[MÚSICA]` são ignoradas |
| Texto-para-fala | 🗓️ | **Piper TTS** (vozes pt-BR, VITS) via `vits-web`/onnxruntime-web |
| Cortar silêncios / auto-cut por fala | 🗓️ | **Silero VAD** (ONNX) + timestamps do Whisper |
| Remoção de fundo | 🗓️ | ver seção 4 |
| Roteiro/títulos com IA | 🗓️ | LLM pequeno local (ex. Qwen/SmolLM via WebLLM) — opcional |

## 9. Exportação
| MP4 H.264 + AAC, 9:16 (1080×1920), 1:1 e 16:9, 480/720/1080p, 24/30/60 fps | ✅ | **WebCodecs** + `mp4-muxer`; **ffmpeg.wasm** (single-thread) para AAC/mux; fallback libx264 em ffmpeg.wasm |
| Compartilhar/Salvar no Fotos | ✅ | Web Share API com arquivo |
| 4K / HDR | 🗓️ | limitado pela memória do Safari |

## 10. Integrações futuras
| Pedidos de edição por Telegram/Discord | 🗓️ | ver README (“Bots”) |
