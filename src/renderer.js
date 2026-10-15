// Renderizador WebGL do Caps: cada camada de vídeo/imagem passa por um shader com
// transformação (zoom/posição), matriz de cor, ajustes, LUT 3D, chroma key e máscara.
// Depois um canvas 2D compõe textos, stickers e legendas por cima.
import { FILTERS, LUTS } from './looks.js';

const VS = `attribute vec2 a; varying vec2 v; void main(){ v=a*0.5+0.5; gl_Position=vec4(a,0.,1.); }`;
const FS = `precision mediump float;
varying vec2 v;
uniform sampler2D u_tex, u_lut;
uniform vec2 u_box; uniform vec2 u_t; uniform float u_s, u_alpha, u_lutN, u_lutAmt, u_amt;
uniform mat4 u_cm; uniform vec4 u_off; uniform vec3 u_adj;
uniform vec3 u_key; uniform vec2 u_keyP; uniform vec4 u_mask;
vec3 lut(vec3 c){
  float N=u_lutN; float b=c.b*(N-1.); float b0=floor(b); float b1=min(b0+1.,N-1.);
  vec2 rg=vec2(c.r*(N-1.)+.5, c.g*(N-1.)+.5);
  vec3 x0=texture2D(u_lut, vec2((b0*N+rg.x)/(N*N), rg.y/N)).rgb;
  vec3 x1=texture2D(u_lut, vec2((b1*N+rg.x)/(N*N), rg.y/N)).rgb;
  return mix(x0,x1,b-b0);
}
void main(){
  vec2 p=vec2(v.x,1.-v.y);
  vec2 uv=((p-.5-u_t)/u_s)/u_box+.5;
  if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.) discard;
  vec4 c=texture2D(u_tex,uv);
  vec3 o=c.rgb;
  vec4 m=u_cm*vec4(o,1.)+u_off; o=mix(o,m.rgb,u_amt);
  o=o+u_adj.x; o=(o-.5)*u_adj.y+.5;
  float l=dot(o,vec3(.2126,.7152,.0722)); o=mix(vec3(l),o,u_adj.z);
  o=clamp(o,0.,1.);
  if(u_lutAmt>0.) o=mix(o,lut(o),u_lutAmt);
  float a=u_alpha;
  if(u_keyP.x>0.){ // chroma key por distância em YCbCr
    vec3 k=u_key; float cb=-.169*c.r-.331*c.g+.5*c.b, cr=.5*c.r-.419*c.g-.081*c.b;
    float kb=-.169*k.r-.331*k.g+.5*k.b, kr=.5*k.r-.419*k.g-.081*k.b;
    float d=distance(vec2(cb,cr),vec2(kb,kr));
    a*=smoothstep(u_keyP.x, u_keyP.x+u_keyP.y, d);
  }
  if(u_mask.x>.5){ // 1=círculo, 2=faixa horizontal
    float r=u_mask.y, f=max(u_mask.z,.001);
    float d = u_mask.x<1.5 ? distance(uv, vec2(.5)) : abs(uv.y-.5);
    float mm=1.-smoothstep(r,r+f,d); if(u_mask.w>.5) mm=1.-mm; a*=mm;
  }
  gl_FragColor=vec4(o*a,a);
}`;

export class Renderer {
  constructor(w, h) {
    this.gl_canvas = document.createElement('canvas');
    this.out = document.createElement('canvas');
    this.ctx = this.out.getContext('2d');
    const gl = this.gl = this.gl_canvas.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true });
    if (!gl) throw new Error('WebGL indisponível');
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const pr = this.pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {}; for (const n of ['u_tex','u_lut','u_box','u_t','u_s','u_alpha','u_lutN','u_lutAmt','u_amt','u_cm','u_off','u_adj','u_key','u_keyP','u_mask']) this.u[n] = gl.getUniformLocation(pr, n);
    gl.uniform1i(this.u.u_tex, 0); gl.uniform1i(this.u.u_lut, 1);
    this.tex = gl.createTexture(); this._setupTex(this.tex);
    this.lutTex = gl.createTexture(); this._setupTex(this.lutTex, gl.LINEAR);
    this.lutCache = new WeakMap(); this.curLut = null;
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.resize(w, h);
  }
  _setupTex(t, f) { const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, f || gl.LINEAR], [gl.TEXTURE_MAG_FILTER, f || gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); }
  resize(w, h) { this.w = this.out.width = this.gl_canvas.width = w; this.h = this.out.height = this.gl_canvas.height = h; this.gl.viewport(0, 0, w, h); }
  _lut(l) {
    const gl = this.gl; if (this.curLut === l) return; this.curLut = l;
    const N = l.size, px = new Uint8Array(N * N * N * 4);
    for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
      const si = ((b * N + g) * N + r) * 3, di = (g * N * N + b * N + r) * 4;
      px[di] = l.data[si] * 255; px[di + 1] = l.data[si + 1] * 255; px[di + 2] = l.data[si + 2] * 255; px[di + 3] = 255;
    }
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N * N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.activeTexture(gl.TEXTURE0);
  }
  clear() { const gl = this.gl; gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
  // layer: {el, sw, sh, s, tx, ty, alpha, clip}
  drawLayer(L) {
    const gl = this.gl, u = this.u, c = L.clip;
    if (!L.sw || !L.sh) return;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, L.el); } catch { return; }
    const sa = L.sw / L.sh, oa = this.w / this.h;
    const fit = c.fit === 'cover' ? (sa > oa ? [sa / oa, 1] : [1, oa / sa]) : (sa > oa ? [1, oa / sa] : [sa / oa, 1]);
    gl.uniform2f(u.u_box, fit[0], fit[1]); gl.uniform2f(u.u_t, L.tx || 0, L.ty || 0); gl.uniform1f(u.u_s, L.s || 1);
    gl.uniform1f(u.u_alpha, (L.alpha ?? 1) * (c.opacity ?? 1));
    const m = (FILTERS[c.filter] || FILTERS.original).m;
    gl.uniformMatrix4fv(u.u_cm, false, new Float32Array([m[0], m[5], m[10], m[15], m[1], m[6], m[11], m[16], m[2], m[7], m[12], m[17], m[3], m[8], m[13], m[18]]));
    gl.uniform4f(u.u_off, m[4], m[9], m[14], m[19]); gl.uniform1f(u.u_amt, c.filterAmt ?? 1);
    const a = c.adj || {}; gl.uniform3f(u.u_adj, a.b || 0, a.c ?? 1, a.s ?? 1);
    const lut = c.customLut || (LUTS[c.lut] && LUTS[c.lut].lut);
    if (lut) { this._lut(lut); gl.uniform1f(u.u_lutN, lut.size); gl.uniform1f(u.u_lutAmt, c.lutAmt ?? 1); } else gl.uniform1f(u.u_lutAmt, 0);
    const k = c.key; if (k && k.on) { const h = k.color; gl.uniform3f(u.u_key, parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255); gl.uniform2f(u.u_keyP, k.tol, k.soft); } else gl.uniform2f(u.u_keyP, 0, 0);
    const mk = c.mask; if (mk && mk.type) gl.uniform4f(u.u_mask, mk.type, mk.size, mk.feather, mk.invert ? 1 : 0); else gl.uniform4f(u.u_mask, 0, 0, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  compose(bg = '#000') { const x = this.ctx; x.fillStyle = bg; x.fillRect(0, 0, this.w, this.h); x.drawImage(this.gl_canvas, 0, 0); }
}
