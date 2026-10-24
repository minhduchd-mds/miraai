// Mira LiveAvatar — WebGL1 renderer for the warped portrait mesh.
// Two passes: (1) mouth cavity (procedural teeth/tongue, only visible when the jaw opens),
// (2) skin mesh sampling the original photo at rest UVs. ~580 vertices: trivial on any GPU.
import { deformRig, type FaceParams, type PreparedRig } from './rig-deform.ts';

const VERT = `
attribute vec2 a_pos;
attribute vec2 a_uv;
uniform vec2 u_image;
uniform vec4 u_view; // scale.xy, offset.xy in clip space
varying vec2 v_uv;
varying vec2 v_pos;
void main() {
  vec2 n = a_pos / u_image;                 // 0..1 image space
  vec2 clip = vec2(n.x * 2.0 - 1.0, 1.0 - n.y * 2.0);
  gl_Position = vec4(clip * u_view.xy + u_view.zw, 0.0, 1.0);
  v_uv = a_uv;
  v_pos = a_pos;
}`;

const SKIN_FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_feather; // >0 on wide screens: soften the panel's left/right edges into the ambient fill
// The photo's closed-mouth crease (dark line between the lips) would otherwise stay on the inner
// edge of both lips when they part. While open, those texels are replaced by lip colour taken a
// little further out on the same lip. Rest-pose seam in texture space: centre, corner height,
// half width and thickness (uv units).
uniform vec2 u_seam;
uniform float u_seamCornerY;
uniform float u_seamHalfW;
uniform float u_seamT;
uniform float u_reveal;
varying vec2 v_uv;
void main() {
  vec4 c = texture2D(u_tex, v_uv);
  if (u_reveal > 0.0) {
    float dxs = (v_uv.x - u_seam.x) / u_seamHalfW;
    float seamY = u_seam.y + (u_seamCornerY - u_seam.y) * dxs * dxs;
    float d = v_uv.y - seamY;
    float band = (1.0 - smoothstep(u_seamT * 0.7, u_seamT * 1.7, abs(d))) * (1.0 - smoothstep(0.8, 1.02, abs(dxs)));
    vec4 lipFar = texture2D(u_tex, v_uv + vec2(0.0, (d < 0.0 ? -1.0 : 1.0) * u_seamT * 2.0));
    c = mix(c, lipFar, band * u_reveal);
  }
  float a = u_feather > 0.0 ? smoothstep(0.0, u_feather, v_uv.x) * smoothstep(0.0, u_feather, 1.0 - v_uv.x) : 1.0;
  gl_FragColor = vec4(c.rgb * a, a); // premultiplied
}`;

const MOUTH_FRAG = `
// Pixel-space maths (~500 px coordinates) needs highp: mediump is fp16 on many GPUs.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_tex;
uniform sampler2D u_teeth;  // mira-teeth-v1: arches unrolled along arch length (build-teeth.py)
uniform vec2 u_mouthTop;    // deformed upper inner lip centre (landmark 13), image pixels
uniform vec2 u_mouthBot;    // deformed lower inner lip centre (landmark 14)
uniform vec2 u_cornerL;     // deformed inner lip corners (78 / 308)
uniform vec2 u_cornerR;
uniform float u_open;       // jaw opening in pixels
uniform float u_mmPerPx;    // anatomical scale from the rest mouth width
varying vec2 v_uv;
varying vec2 v_pos;

const float ARCH_HALF = 42.0;   // mm per side in the texture
const float UPPER_REF = 13.25;  // mm of texture height per arch (crown 10.6 × 1.25)
const float LOWER_REF = 13.0;

// Front view of a curved arch: x = R·sin(s/R) → s = R·asin(x/R).
vec2 archSample(float xmm, float radius) {
  float k = clamp(xmm / radius, -0.995, 0.995);
  float s = radius * asin(k);
  return vec2(0.5 + s / (2.0 * ARCH_HALF), sqrt(1.0 - k * k)); // (u, facing)
}

void main() {
  vec4 lip = texture2D(u_tex, v_uv);
  float halfW = max(1.0, 0.5 * abs(u_cornerR.x - u_cornerL.x));
  float cx = 0.5 * (u_cornerR.x + u_cornerL.x);
  float cy = 0.5 * (u_cornerR.y + u_cornerL.y);
  float dx = clamp((v_pos.x - cx) / halfW, -1.0, 1.0);
  float ax = abs(dx);
  // Inner lip edges as parabolas through the corners.
  float yU = u_mouthTop.y + (cy - u_mouthTop.y) * dx * dx;
  float yL = u_mouthBot.y + (cy - u_mouthBot.y) * dx * dx;
  float h = max(1.0, yL - yU);
  float s = clamp((v_pos.y - yU) / h, 0.0, 1.0);
  float duMM = (v_pos.y - yU) * u_mmPerPx;     // below the upper lip edge
  float dlMM = (yL - v_pos.y) * u_mmPerPx;     // above the lower lip edge
  float openMM = u_open * u_mmPerPx;
  float xmm = (v_pos.x - cx) * u_mmPerPx;

  // Cavity: dark warm red, deepest towards the corners (buccal corridor) and the throat.
  vec3 cavity = mix(vec3(0.25, 0.075, 0.072), vec3(0.085, 0.024, 0.026), clamp(pow(ax, 1.6) * 0.9 + abs(s - 0.5) * 0.35, 0.0, 1.0));
  float tongueTop = 0.6 - 0.15 * smoothstep(4.0, 12.0, openMM);
  float tongue = smoothstep(tongueTop, tongueTop + 0.25, s) * (1.0 - smoothstep(0.4, 0.85, ax));
  vec3 color = mix(cavity, vec3(0.6, 0.29, 0.3) * (0.7 + 0.3 * (1.0 - ax)), tongue * 0.8);

  // Light inside the mouth grows with the opening; teeth turning away from the camera darken.
  // Warm bounce light from the lips/skin keeps the shaded enamel ivory, not grey-green.
  float light = mix(0.76, 0.97, smoothstep(2.5, 10.0, openMM));
  vec3 warm = vec3(1.0, 0.975, 0.95);
  // Buccal corridor: side teeth fall into the cheek shadow quickly.
  float corridor = 1.0 - 0.62 * smoothstep(0.34, 0.9, ax);

  // Lower teeth (behind the lower lip; only their edges show on wide vowels).
  vec2 la = archSample(xmm * 0.96, 21.0);
  float lowY = 8.1 + dlMM;          // mm from the cervical line: the lower lip hides all but the edges
  vec4 low = texture2D(u_teeth, vec2(la.x, 1.0 - 0.5 * clamp(lowY / LOWER_REF, 0.0, 1.0)));
  float lowA = low.a * step(0.0, dlMM) * step(lowY, LOWER_REF);
  float lowCorridor = 1.0 - 0.8 * smoothstep(0.22, 0.7, ax);
  color = mix(color, low.rgb * warm * light * 0.72 * lowCorridor * pow(la.y, 1.2), lowA * 0.9);

  // Upper teeth hang from under the upper lip, which covers their cervical third.
  vec2 ua = archSample(xmm, 24.0);
  float upY = 3.0 + duMM;
  vec4 up = texture2D(u_teeth, vec2(ua.x, 0.5 * clamp(upY / UPPER_REF, 0.0, 1.0)));
  float upA = up.a * step(0.0, duMM + 0.6) * step(upY, UPPER_REF);
  float lipShadow = 0.78 + 0.22 * smoothstep(0.0, 1.4, duMM);
  color = mix(color, up.rgb * warm * light * lipShadow * corridor * pow(ua.y, 1.2), upA);

  // Soft shadow along the inner edge of the lower lip.
  color *= 0.86 + 0.14 * smoothstep(0.0, 0.9, dlMM);
  float reveal = smoothstep(1.5, 6.0, u_open);
  gl_FragColor = vec4(mix(lip.rgb, color, reveal), 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('live_avatar_shader');
  return shader;
}

function program(gl: WebGLRenderingContext, frag: string) {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('live_avatar_program');
  return p;
}

export class LiveAvatarRenderer {
  private gl: WebGLRenderingContext;
  private skin: WebGLProgram;
  private mouth: WebGLProgram;
  private posBuffer: WebGLBuffer;
  private uvBuffer: WebGLBuffer;
  private skinIndex: WebGLBuffer;
  private mouthIndex: WebGLBuffer;
  private skinCount: number;
  private mouthCount: number;
  private positions: Float32Array;
  private texture: WebGLTexture;
  private feather = 0;
  private teethTexture: WebGLTexture;

  constructor(private canvas: HTMLCanvasElement, private prep: PreparedRig, image: HTMLImageElement, preserveDrawingBuffer = false, teeth: HTMLImageElement | null = null) {
    // preserveDrawingBuffer only for frame-by-frame video export (screenshots after render).
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer });
    if (!gl) throw new Error('webgl_unavailable');
    this.gl = gl;
    this.skin = program(gl, SKIN_FRAG);
    this.mouth = program(gl, MOUTH_FRAG);
    this.positions = new Float32Array(prep.count * 2);

    this.posBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions.byteLength, gl.DYNAMIC_DRAW);
    this.uvBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, prep.uv, gl.STATIC_DRAW);

    const skin = new Uint16Array(prep.rig.triangles);
    const mouth = new Uint16Array(prep.rig.mouthTriangles);
    this.skinCount = skin.length;
    this.mouthCount = mouth.length;
    this.skinIndex = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.skinIndex);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, skin, gl.STATIC_DRAW);
    this.mouthIndex = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.mouthIndex);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mouth, gl.STATIC_DRAW);

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Teeth atlas (power-of-two, mipmapped: shown heavily minified). Without it the mouth
    // shows only the cavity — never a broken texture.
    this.teethTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.teethTexture);
    if (teeth) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, teeth);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /** Wide screens: the centred "camera" panel spans up to this many screen heights. */
  static readonly PANEL_ASPECT = 1.42;

  /** Object-fit: cover, with an optional focus point (0..1) kept in view. */
  private viewTransform(focusY: number) {
    const { width: iw, height: ih } = this.prep.rig.image;
    const cw = this.canvas.width, ch = this.canvas.height;
    // Portrait/tall screens: cover the viewport. Wide screens: a wide landscape "camera" panel
    // (up to PANEL_ASPECT × height, user request 24/10: larger, wider scene) that covers its own
    // area — the portrait is zoomed so the face reads like a webcam close-up — with feathered
    // edges blending into the blurred ambient fill drawn in CSS.
    const wide = cw / ch > (iw / ih) * 1.15;
    const panelW = wide ? Math.min(cw, ch * LiveAvatarRenderer.PANEL_ASPECT) : cw;
    const scale = Math.max(panelW / iw, ch / ih);
    this.feather = wide && panelW < cw ? 0.07 : 0;
    const sx = (iw * scale) / cw, sy = (ih * scale) / ch;
    // Put the face slightly above centre (clip y = 0.12) while the photo still covers the
    // whole viewport: top edge ≥ 1 and bottom edge ≤ -1 in clip space.
    const wanted = 0.12 - (1 - 2 * focusY) * sy;
    const limit = Math.max(0, sy - 1); // 0 when the photo is height-fitted: no vertical shift
    const oy = Math.max(-limit, Math.min(limit, wanted));
    return [sx, sy, 0, oy] as const;
  }

  resize(width: number, height: number) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
  }

  render(params: FaceParams) {
    const { gl, prep } = this;
    const open = deformRig(prep, params, this.positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.positions);
    const view = this.viewTransform(prep.rig.center[1]);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    const draw = (p: WebGLProgram, index: WebGLBuffer, count: number) => {
      gl.useProgram(p);
      const aPos = gl.getAttribLocation(p, 'a_pos');
      const aUv = gl.getAttribLocation(p, 'a_uv');
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
      gl.enableVertexAttribArray(aUv);
      gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(gl.getUniformLocation(p, 'u_image'), prep.rig.image.width, prep.rig.image.height);
      gl.uniform4f(gl.getUniformLocation(p, 'u_view'), view[0], view[1], view[2], view[3]);
      gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0);
      if (p === this.skin) {
        gl.uniform1f(gl.getUniformLocation(p, 'u_feather'), this.feather);
        const { width: iw, height: ih } = prep.rig.image;
        const r = prep.rest;
        const seamY = (r[13 * 2 + 1] + r[14 * 2 + 1]) / 2 / ih;
        const cornerY = (r[78 * 2 + 1] + r[308 * 2 + 1]) / 2 / ih;
        gl.uniform2f(gl.getUniformLocation(p, 'u_seam'), prep.mouth.x / iw, seamY);
        gl.uniform1f(gl.getUniformLocation(p, 'u_seamCornerY'), cornerY);
        gl.uniform1f(gl.getUniformLocation(p, 'u_seamHalfW'), Math.max(1, Math.abs(r[308 * 2] - r[78 * 2]) / 2) / iw);
        gl.uniform1f(gl.getUniformLocation(p, 'u_seamT'), (prep.faceH * 0.011) / ih);
        gl.uniform1f(gl.getUniformLocation(p, 'u_reveal'), Math.min(1, Math.max(0, (open - 1.5) / 4.5)));
      }
      if (p === this.mouth) {
        const at = (i: number) => [this.positions[i * 2], this.positions[i * 2 + 1]] as const;
        gl.uniform2f(gl.getUniformLocation(p, 'u_mouthTop'), ...at(13));
        gl.uniform2f(gl.getUniformLocation(p, 'u_mouthBot'), ...at(14));
        gl.uniform2f(gl.getUniformLocation(p, 'u_cornerL'), ...at(78));
        gl.uniform2f(gl.getUniformLocation(p, 'u_cornerR'), ...at(308));
        gl.uniform1f(gl.getUniformLocation(p, 'u_open'), open);
        // Anatomical scale: this smiling rest pose has an inner mouth half-width of ~25 mm.
        gl.uniform1f(gl.getUniformLocation(p, 'u_mmPerPx'), 25 / Math.max(1, Math.abs(prep.rest[308 * 2] - prep.rest[78 * 2]) / 2));
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.teethTexture);
        gl.uniform1i(gl.getUniformLocation(p, 'u_teeth'), 1);
        gl.activeTexture(gl.TEXTURE0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    };
    draw(this.mouth, this.mouthIndex, this.mouthCount);
    draw(this.skin, this.skinIndex, this.skinCount);
  }

  dispose() {
    const { gl } = this;
    gl.deleteBuffer(this.posBuffer); gl.deleteBuffer(this.uvBuffer);
    gl.deleteBuffer(this.skinIndex); gl.deleteBuffer(this.mouthIndex);
    gl.deleteTexture(this.texture);
    gl.deleteTexture(this.teethTexture);
    gl.deleteProgram(this.skin); gl.deleteProgram(this.mouth);
  }
}
