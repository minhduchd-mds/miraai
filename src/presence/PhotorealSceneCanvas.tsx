import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { PhotorealVisualQuality } from './photoreal-depth';
import type { PhotorealCameraSpatialFrame } from './photoreal-camera-depth';
import {
  PHOTOREAL_DEPTH_FIELD_GLSL,
  computePhotorealDepthWarpControl,
  type PhotorealPerformanceTier,
} from './photoreal-depth-warp';

interface Props {
  src: string;
  renderDpr: number;
  sharpness: number;
  className?: string;
}

export interface PhotorealSceneCanvasHandle {
  updateDepthWarp: (
    frame: Pick<PhotorealCameraSpatialFrame, 'rotateXDeg' | 'rotateYDeg' | 'intensity'>,
    quality: PhotorealVisualQuality,
    performanceTier: PhotorealPerformanceTier,
    reducedMotion: boolean,
  ) => void;
}

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_texel;
uniform vec2 u_uv_scale;
uniform vec2 u_uv_offset;
uniform float u_sharpness;
uniform vec2 u_view;
uniform float u_depth_strength;
varying vec2 v_uv;

${PHOTOREAL_DEPTH_FIELD_GLSL}

vec3 sampleScene(vec2 uv) {
  return texture2D(u_texture, clamp(uv, vec2(0.0), vec2(1.0))).rgb;
}

void main() {
  vec2 baseUv = u_uv_offset + v_uv * u_uv_scale;
  float depth = authoredDepth(baseUv);
  float centeredDepth = depth - 0.48;
  vec2 warp = u_view * centeredDepth * 0.018 * u_depth_strength;
  vec2 uv = clamp(baseUv + warp, vec2(0.002), vec2(0.998));

  vec3 center = sampleScene(uv);
  vec3 north = sampleScene(uv + vec2(0.0, u_texel.y));
  vec3 south = sampleScene(uv - vec2(0.0, u_texel.y));
  vec3 east = sampleScene(uv + vec2(u_texel.x, 0.0));
  vec3 west = sampleScene(uv - vec2(u_texel.x, 0.0));

  float amount = clamp(u_sharpness, 0.0, 0.28);
  vec3 sharpened = center * (1.0 + amount * 4.0)
    - (north + south + east + west) * amount;

  vec3 difference = sharpened - center;
  float lumaEdge = dot(abs(difference), vec3(0.2126, 0.7152, 0.0722));
  float haloGuard = 1.0 - smoothstep(0.16, 0.42, lumaEdge);
  vec3 result = mix(center, sharpened, haloGuard);

  gl_FragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertex || !fragment) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
}

function coverUv(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { scaleX: number; scaleY: number; offsetX: number; offsetY: number } {
  const sourceAspect = sourceWidth / Math.max(1, sourceHeight);
  const targetAspect = targetWidth / Math.max(1, targetHeight);

  if (targetAspect > sourceAspect) {
    const scaleY = sourceAspect / targetAspect;
    return { scaleX: 1, scaleY, offsetX: 0, offsetY: (1 - scaleY) * 0.5 };
  }

  const scaleX = targetAspect / sourceAspect;
  return { scaleX, scaleY: 1, offsetX: (1 - scaleX) * 0.3, offsetY: 0 };
}

/**
 * GPU scene pass for high-DPI presentation.
 *
 * It performs bounded sharpening plus an optional authored continuous depth-field
 * UV warp. The warp is presentation-only: it does not claim reconstructed or
 * metric geometry and reuses this same WebGL context rather than opening another.
 */
const PhotorealSceneCanvas = forwardRef<PhotorealSceneCanvasHandle, Props>(function PhotorealSceneCanvas({
  src,
  renderDpr,
  sharpness,
  className = '',
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<((viewX: number, viewY: number, strength: number, force?: boolean) => void) | null>(null);
  const lastControlRef = useRef({ viewX: 0, viewY: 0, strength: 0, lastDrawAt: 0 });

  useImperativeHandle(ref, () => ({
    updateDepthWarp(frame, quality, performanceTier, reducedMotion) {
      const control = computePhotorealDepthWarpControl(frame, quality, performanceTier, reducedMotion);
      const now = performance.now();
      const minInterval = control.fpsCap > 0 ? 1000 / control.fpsCap : 0;
      const previous = lastControlRef.current;
      const changed = Math.abs(previous.viewX - control.viewX) > 0.002
        || Math.abs(previous.viewY - control.viewY) > 0.002
        || Math.abs(previous.strength - control.strength) > 0.002;

      if (!changed && control.active) return;
      if (control.active && now - previous.lastDrawAt < minInterval) return;

      lastControlRef.current = {
        viewX: control.viewX,
        viewY: control.viewY,
        strength: control.strength,
        lastDrawAt: now,
      };
      drawRef.current?.(control.viewX, control.viewY, control.strength);
    },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || sharpness <= 0) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return;

    const program = createProgram(gl);
    if (!program) return;

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const textureLocation = gl.getUniformLocation(program, 'u_texture');
    const texelLocation = gl.getUniformLocation(program, 'u_texel');
    const scaleLocation = gl.getUniformLocation(program, 'u_uv_scale');
    const offsetLocation = gl.getUniformLocation(program, 'u_uv_offset');
    const sharpnessLocation = gl.getUniformLocation(program, 'u_sharpness');
    const viewLocation = gl.getUniformLocation(program, 'u_view');
    const depthStrengthLocation = gl.getUniformLocation(program, 'u_depth_strength');

    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (!buffer || !texture || positionLocation < 0) {
      gl.deleteProgram(program);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    let disposed = false;
    let textureUploaded = false;
    let image: HTMLImageElement | null = new Image();
    image.decoding = 'async';
    image.src = src;

    const draw = (viewX = 0, viewY = 0, strength = 0, force = false) => {
      if (disposed || !image || !image.naturalWidth || !image.naturalHeight) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;

      const requestedDpr = Math.max(1, Math.min(2, Number(renderDpr) || 1));
      const requestedPixels = rect.width * rect.height * requestedDpr * requestedDpr;
      const maxRenderPixels = 12_000_000;
      const budgetScale = requestedPixels > maxRenderPixels
        ? Math.sqrt(maxRenderPixels / requestedPixels)
        : 1;
      const dpr = Math.max(1, requestedDpr * budgetScale);
      const width = Math.max(2, Math.round(rect.width * dpr));
      const height = Math.max(2, Math.round(rect.height * dpr));
      const resized = canvas.width !== width || canvas.height !== height;
      if (resized) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (!textureUploaded || force) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        textureUploaded = true;
      }

      const uv = coverUv(image.naturalWidth, image.naturalHeight, width, height);
      gl.uniform1i(textureLocation, 0);
      gl.uniform2f(texelLocation, 1 / image.naturalWidth, 1 / image.naturalHeight);
      gl.uniform2f(scaleLocation, uv.scaleX, uv.scaleY);
      gl.uniform2f(offsetLocation, uv.offsetX, uv.offsetY);
      gl.uniform1f(sharpnessLocation, Math.max(0, Math.min(0.28, sharpness)));
      gl.uniform2f(viewLocation, Math.max(-1, Math.min(1, viewX)), Math.max(-1, Math.min(1, viewY)));
      gl.uniform1f(depthStrengthLocation, Math.max(0, Math.min(1, strength)));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.dataset.ready = 'true';
      canvas.dataset.depthWarp = strength > 0.01 ? 'true' : 'false';
    };

    drawRef.current = draw;
    const handleLoad = () => draw(0, 0, 0, true);
    if (image.complete && image.naturalWidth) handleLoad();
    else image.addEventListener('load', handleLoad, { once: true });

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          const current = lastControlRef.current;
          draw(current.viewX, current.viewY, current.strength);
        })
      : null;
    observer?.observe(canvas);
    const handleResize = () => {
      const current = lastControlRef.current;
      draw(current.viewX, current.viewY, current.strength);
    };
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      disposed = true;
      drawRef.current = null;
      observer?.disconnect();
      window.removeEventListener('resize', handleResize);
      image?.removeEventListener('load', handleLoad);
      image = null;
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [renderDpr, sharpness, src]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
    />
  );
});

export default PhotorealSceneCanvas;