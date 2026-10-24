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
varying vec2 v_uv;
void main() {
  vec4 c = texture2D(u_tex, v_uv);
  float a = u_feather > 0.0 ? smoothstep(0.0, u_feather, v_uv.x) * smoothstep(0.0, u_feather, 1.0 - v_uv.x) : 1.0;
  gl_FragColor = vec4(c.rgb * a, a); // premultiplied
}`;

const MOUTH_FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform vec2 u_mouthTop;   // pixel position of the upper inner lip centre (deformed)
uniform float u_open;      // opening in pixels
uniform float u_halfWidth; // half mouth width in pixels
varying vec2 v_uv;
varying vec2 v_pos;
void main() {
  vec4 lip = texture2D(u_tex, v_uv);
  float t = clamp((v_pos.y - u_mouthTop.y) / max(u_open, 1.0), 0.0, 1.0);
  float side = clamp(abs(v_pos.x - u_mouthTop.x) / max(u_halfWidth, 1.0), 0.0, 1.0);
  // Dark, warm cavity that gets deeper towards the corners and the throat.
  vec3 cavity = mix(vec3(0.24, 0.07, 0.08), vec3(0.06, 0.015, 0.02), clamp(side * 0.8 + (1.0 - abs(t - 0.5) * 2.0) * 0.25, 0.0, 1.0));
  // Upper teeth: a narrow, softly shaded row that only spans the centre of the mouth.
  float teethMask = (1.0 - smoothstep(0.20, 0.38, t)) * (1.0 - smoothstep(0.34, 0.74, side));
  // Individual teeth: faint gaps every ~1/4 of the half-width, lighter towards the biting edge.
  float toothPhase = (v_pos.x - u_mouthTop.x) / max(u_halfWidth * 0.26, 1.0);
  float gaps = 0.86 + 0.14 * smoothstep(0.0, 0.35, abs(fract(toothPhase + 0.5) - 0.5));
  vec3 teeth = vec3(0.84, 0.80, 0.75) * (0.80 + 0.20 * (1.0 - side)) * gaps * (0.88 + 0.12 * smoothstep(0.05, 0.3, t));
  vec3 color = mix(cavity, teeth, teethMask * 0.88);
  color *= 0.62 + 0.38 * smoothstep(0.0, 0.035, t); // shadow cast by the upper lip
  float tongue = smoothstep(0.66, 0.98, t) * (1.0 - smoothstep(0.3, 0.75, side));
  color = mix(color, vec3(0.56, 0.24, 0.27), tongue * 0.6);
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

  constructor(private canvas: HTMLCanvasElement, private prep: PreparedRig, image: HTMLImageElement, preserveDrawingBuffer = false) {
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
      if (p === this.skin) gl.uniform1f(gl.getUniformLocation(p, 'u_feather'), this.feather);
      if (p === this.mouth) {
        gl.uniform2f(gl.getUniformLocation(p, 'u_mouthTop'), this.positions[13 * 2], this.positions[13 * 2 + 1]);
        gl.uniform1f(gl.getUniformLocation(p, 'u_open'), open);
        gl.uniform1f(gl.getUniformLocation(p, 'u_halfWidth'), prep.mouth.halfWidth);
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
    gl.deleteProgram(this.skin); gl.deleteProgram(this.mouth);
  }
}
