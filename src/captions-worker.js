// Legendas automáticas no aparelho: Whisper (OpenAI, open-weights) convertido para ONNX,
// rodando com transformers.js (onnxruntime-web em WASM). Carregado só quando pedido.
import { pipeline, env } from '@huggingface/transformers';
env.allowLocalModels = false;
let asr, cur;
self.onmessage = async ({ data }) => {
  try {
    if (!asr || cur !== data.model) {
      asr = await pipeline('automatic-speech-recognition', data.model, {
        dtype: 'q8', device: 'wasm',
        progress_callback: p => self.postMessage({ type: 'progress', p }),
      });
      cur = data.model;
    }
    self.postMessage({ type: 'status', msg: 'Transcrevendo…' });
    const out = await asr(data.audio, { language: 'portuguese', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
    self.postMessage({ type: 'done', chunks: out.chunks || [{ text: out.text, timestamp: [0, data.audio.length / 16000] }] });
  } catch (e) { self.postMessage({ type: 'error', msg: String(e && e.message || e) }); }
};
