import{c as e,i as t,r as n}from"./index-RD9UzXm2.js";var r=e(t(),1),i=`
float ellipseMask(vec2 uv, vec2 center, vec2 radius, float softness) {
  vec2 p = (uv - center) / max(radius, vec2(0.0001));
  float d = dot(p, p);
  return 1.0 - smoothstep(1.0 - softness, 1.0 + softness, d);
}

float authoredDepth(vec2 uv) {
  float depth = 0.22;

  float windowMask = ellipseMask(uv, vec2(0.80, 0.73), vec2(0.30, 0.30), 0.34);
  depth = mix(depth, 0.14, windowMask * 0.82);

  float pillowMask = ellipseMask(uv, vec2(0.18, 0.62), vec2(0.24, 0.25), 0.36);
  depth = max(depth, pillowMask * 0.38);

  float subjectMask = ellipseMask(uv, vec2(0.50, 0.53), vec2(0.31, 0.40), 0.30);
  depth = max(depth, subjectMask * 0.68);

  float bedDepth = smoothstep(0.38, 0.80, 1.0 - uv.y) * 0.78;
  depth = max(depth, bedDepth);

  float foregroundDepth = smoothstep(0.64, 0.98, 1.0 - uv.y) * 0.94;
  depth = max(depth, foregroundDepth);

  return clamp(depth, 0.12, 0.94);
}
`;function a(e,t,n){return Math.max(t,Math.min(n,Number.isFinite(e)?e:0))}function o(e,t,n,r){return!r&&t===`ultra`&&n===`full`&&e.intensity>=.18?{active:!0,viewX:a(e.rotateYDeg/3.1,-1,1),viewY:a(-e.rotateXDeg/1.9,-1,1),strength:a(e.intensity,0,1),fpsCap:30}:{active:!1,viewX:0,viewY:0,strength:0,fpsCap:0}}function s(e,t,n,r){let i=o(e,t,n,r);if(!(!r&&n===`full`&&(t===`high`||t===`ultra`)&&e.intensity>=.18))return{active:!1,viewX:0,viewY:0,warpStrength:0,relightStrength:0,occlusionStrength:0,fpsCap:0};let s=a(e.rotateYDeg/3.1,-1,1),c=a(-e.rotateXDeg/1.9,-1,1),l=a(e.intensity,0,1),u=t===`ultra`;return{active:!0,viewX:s,viewY:c,warpStrength:i.active?i.strength:0,relightStrength:a(l*(u?.22:.12),0,.22),occlusionStrength:a(l*(u?.18:.1),0,.18),fpsCap:u?30:24}}function c(e,t,n){return Math.max(t,Math.min(n,Number.isFinite(e)?e:0))}function l(e,t,n){return e+(t-e)*c(n,0,1)}function u(e,t,n,r){return e+c(l(e,t,n)-e,-r,r)}var d=class{constructor(){this.current={active:!1,viewX:0,viewY:0,warpStrength:0,relightStrength:0,occlusionStrength:0,fpsCap:0,stability:1,motionSpeed:0,recovering:!1},this.previousInput={viewX:0,viewY:0},this.previousVelocity={viewX:0,viewY:0},this.lastAt=0,this.initialized=!1}update(e,t=performance.now()){if(!e.active)return this.current={active:!1,viewX:0,viewY:0,warpStrength:0,relightStrength:0,occlusionStrength:0,fpsCap:0,stability:1,motionSpeed:0,recovering:!1},this.previousInput={viewX:0,viewY:0},this.previousVelocity={viewX:0,viewY:0},this.lastAt=t,this.initialized=!1,{...this.current};if(!this.initialized)return this.initialized=!0,this.lastAt=t,this.previousInput={viewX:e.viewX,viewY:e.viewY},this.current={...e,stability:1,motionSpeed:0,recovering:!1},{...this.current};let n=c((t-this.lastAt)/1e3,1/120,.12);this.lastAt=t;let r=e.viewX-this.previousInput.viewX,i=e.viewY-this.previousInput.viewY,a=Math.hypot(r,i),o=r/n,s=i/n,d=Math.hypot(o,s),f=Math.hypot(this.previousVelocity.viewX,this.previousVelocity.viewY),p=(f>.08&&d>.08?(o*this.previousVelocity.viewX+s*this.previousVelocity.viewY)/Math.max(.001,d*f):1)<-.45&&d>1.1,m=1;a>.28||d>4.2?m=.28:a>.16||d>2.6?m=.48:d>1.35&&(m=.7),p&&(m=Math.min(m,.42));let h=m<this.current.stability?.34:.075,g=l(this.current.stability,m,h),_=g<.94,v=_?.1:.18,y=_?.032:.058,b=u(this.current.viewX,e.viewX,v,y),x=u(this.current.viewY,e.viewY,v,y),S=.34+g*.66,C=.5+g*.5,w=.56+g*.44,T=_?.12:.2;return this.current={active:!0,viewX:b,viewY:x,warpStrength:l(this.current.warpStrength,e.warpStrength*S,T),relightStrength:l(this.current.relightStrength,e.relightStrength*C,T),occlusionStrength:l(this.current.occlusionStrength,e.occlusionStrength*w,T),fpsCap:e.fpsCap,stability:g,motionSpeed:c(d,0,20),recovering:_},this.previousInput={viewX:e.viewX,viewY:e.viewY},this.previousVelocity={viewX:o,viewY:s},{...this.current}}snapshot(){return this.current}reset(){this.current={active:!1,viewX:0,viewY:0,warpStrength:0,relightStrength:0,occlusionStrength:0,fpsCap:0,stability:1,motionSpeed:0,recovering:!1},this.previousInput={viewX:0,viewY:0},this.previousVelocity={viewX:0,viewY:0},this.lastAt=0,this.initialized=!1}},f=n(),p=`
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`,m=`
precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_texel;
uniform vec2 u_uv_scale;
uniform vec2 u_uv_offset;
uniform float u_sharpness;
uniform vec2 u_view;
uniform float u_depth_strength;
uniform float u_relight_strength;
uniform float u_occlusion_strength;
uniform float u_temporal_stability;
varying vec2 v_uv;

${i}

vec3 sampleScene(vec2 uv) {
  return texture2D(u_texture, clamp(uv, vec2(0.0), vec2(1.0))).rgb;
}

void main() {
  vec2 baseUv = u_uv_offset + v_uv * u_uv_scale;
  float depth = authoredDepth(baseUv);
  float centeredDepth = depth - 0.48;
  vec2 rawWarp = u_view * centeredDepth * 0.018 * u_depth_strength;

  float depthEast = authoredDepth(clamp(baseUv + vec2(u_texel.x * 5.0, 0.0), vec2(0.0), vec2(1.0)));
  float depthWest = authoredDepth(clamp(baseUv - vec2(u_texel.x * 5.0, 0.0), vec2(0.0), vec2(1.0)));
  float depthNorth = authoredDepth(clamp(baseUv + vec2(0.0, u_texel.y * 5.0), vec2(0.0), vec2(1.0)));
  float depthSouth = authoredDepth(clamp(baseUv - vec2(0.0, u_texel.y * 5.0), vec2(0.0), vec2(1.0)));
  vec2 depthGradient = vec2(depthEast - depthWest, depthNorth - depthSouth);
  float edgeStrength = smoothstep(0.006, 0.085, length(depthGradient));
  vec2 viewDirection = length(u_view) > 0.001 ? normalize(u_view) : vec2(0.0);

  vec2 candidateUv = clamp(baseUv + rawWarp, vec2(0.002), vec2(0.998));
  float candidateDepth = authoredDepth(candidateUv);
  float depthMismatch = abs(candidateDepth - depth);
  float sourceEdgeDistance = min(
    min(baseUv.x, 1.0 - baseUv.x),
    min(baseUv.y, 1.0 - baseUv.y)
  );
  float depthBoundaryGuard = 1.0 - edgeStrength * 0.52;
  float continuityGuard = 1.0 - smoothstep(0.06, 0.26, depthMismatch) * 0.72;
  float sourceEdgeGuard = smoothstep(0.004, 0.032, sourceEdgeDistance);
  float temporalGuard = 0.42 + clamp(u_temporal_stability, 0.0, 1.0) * 0.58;
  float warpConfidence = clamp(
    depthBoundaryGuard * continuityGuard * sourceEdgeGuard * temporalGuard,
    0.0,
    1.0
  );
  vec2 uv = mix(baseUv, candidateUv, warpConfidence);

  float facing = dot(depthGradient, viewDirection);
  float microLight = max(0.0, facing) * edgeStrength * u_relight_strength * warpConfidence;
  float microOcclusion = max(0.0, -facing) * edgeStrength * u_occlusion_strength;

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
  float subjectWeight = smoothstep(0.32, 0.62, depth)
    * (1.0 - smoothstep(0.9, 0.97, depth));
  result *= 1.0
    + microLight * (0.085 + subjectWeight * 0.035)
    - microOcclusion * (0.09 + subjectWeight * 0.025);

  gl_FragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
`;function h(e,t,n){let r=e.createShader(t);return r?(e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(e.deleteShader(r),null)):null}function g(e){let t=h(e,e.VERTEX_SHADER,p),n=h(e,e.FRAGMENT_SHADER,m);if(!t||!n)return t&&e.deleteShader(t),n&&e.deleteShader(n),null;let r=e.createProgram();return r?(e.attachShader(r,t),e.attachShader(r,n),e.linkProgram(r),e.deleteShader(t),e.deleteShader(n),e.getProgramParameter(r,e.LINK_STATUS)?r:(e.deleteProgram(r),null)):null}function _(e,t,n,r){let i=e/Math.max(1,t),a=n/Math.max(1,r);if(a>i){let e=i/a;return{scaleX:1,scaleY:e,offsetX:0,offsetY:(1-e)*.5}}let o=a/i;return{scaleX:o,scaleY:1,offsetX:(1-o)*.3,offsetY:0}}var v=(0,r.forwardRef)(function({src:e,renderDpr:t,sharpness:n,className:i=``},a){let o=(0,r.useRef)(null),c=(0,r.useRef)(null),l=(0,r.useRef)({viewX:0,viewY:0,warpStrength:0,relightStrength:0,occlusionStrength:0,lastDrawAt:0}),u=(0,r.useRef)(new d);return(0,r.useImperativeHandle)(a,()=>({updateDepthWarp(e,t,n,r){let i=s(e,t,n,r),a=performance.now(),d=u.current.update(i,a),f=d.fpsCap>0?1e3/d.fpsCap:0,p=l.current;if(!(Math.abs(p.viewX-d.viewX)>.002||Math.abs(p.viewY-d.viewY)>.002||Math.abs(p.warpStrength-d.warpStrength)>.002||Math.abs(p.relightStrength-d.relightStrength)>.002||Math.abs(p.occlusionStrength-d.occlusionStrength)>.002)&&d.active||d.active&&a-p.lastDrawAt<f)return;l.current={viewX:d.viewX,viewY:d.viewY,warpStrength:d.warpStrength,relightStrength:d.relightStrength,occlusionStrength:d.occlusionStrength,lastDrawAt:a};let m=o.current;m&&(m.dataset.depthStability=d.stability.toFixed(3),m.dataset.depthRecovering=d.recovering?`true`:`false`),c.current?.(d.viewX,d.viewY,d.warpStrength,d.relightStrength,d.occlusionStrength,d.stability)}}),[]),(0,r.useEffect)(()=>{let r=o.current;if(!r||n<=0)return;let i=r.getContext(`webgl`,{alpha:!1,antialias:!1,depth:!1,premultipliedAlpha:!1,preserveDrawingBuffer:!1,powerPreference:`high-performance`});if(!i)return;let a=g(i);if(!a)return;let s=i.getAttribLocation(a,`a_position`),d=i.getUniformLocation(a,`u_texture`),f=i.getUniformLocation(a,`u_texel`),p=i.getUniformLocation(a,`u_uv_scale`),m=i.getUniformLocation(a,`u_uv_offset`),h=i.getUniformLocation(a,`u_sharpness`),v=i.getUniformLocation(a,`u_view`),y=i.getUniformLocation(a,`u_depth_strength`),b=i.getUniformLocation(a,`u_relight_strength`),x=i.getUniformLocation(a,`u_occlusion_strength`),S=i.getUniformLocation(a,`u_temporal_stability`),C=i.createBuffer(),w=i.createTexture();if(!C||!w||s<0){i.deleteProgram(a);return}i.bindBuffer(i.ARRAY_BUFFER,C),i.bufferData(i.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),i.STATIC_DRAW),i.bindTexture(i.TEXTURE_2D,w),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MAG_FILTER,i.LINEAR),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,1);let T=!1,E=!1,D=new Image;D.decoding=`async`,D.src=e;let O=(e=0,o=0,c=0,l=0,u=0,g=1,O=!1)=>{if(T||!D||!D.naturalWidth||!D.naturalHeight)return;let k=r.getBoundingClientRect();if(k.width<2||k.height<2)return;let A=Math.max(1,Math.min(2,Number(t)||1)),j=k.width*k.height*A*A,M=12e6,N=j>M?Math.sqrt(M/j):1,P=Math.max(1,A*N),F=Math.max(2,Math.round(k.width*P)),I=Math.max(2,Math.round(k.height*P));(r.width!==F||r.height!==I)&&(r.width=F,r.height=I),i.viewport(0,0,F,I),i.useProgram(a),i.bindBuffer(i.ARRAY_BUFFER,C),i.enableVertexAttribArray(s),i.vertexAttribPointer(s,2,i.FLOAT,!1,0,0),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,w),(!E||O)&&(i.texImage2D(i.TEXTURE_2D,0,i.RGBA,i.RGBA,i.UNSIGNED_BYTE,D),E=!0);let L=_(D.naturalWidth,D.naturalHeight,F,I);i.uniform1i(d,0),i.uniform2f(f,1/D.naturalWidth,1/D.naturalHeight),i.uniform2f(p,L.scaleX,L.scaleY),i.uniform2f(m,L.offsetX,L.offsetY),i.uniform1f(h,Math.max(0,Math.min(.28,n))),i.uniform2f(v,Math.max(-1,Math.min(1,e)),Math.max(-1,Math.min(1,o))),i.uniform1f(y,Math.max(0,Math.min(1,c))),i.uniform1f(b,Math.max(0,Math.min(.22,l))),i.uniform1f(x,Math.max(0,Math.min(.18,u))),i.uniform1f(S,Math.max(0,Math.min(1,g))),i.drawArrays(i.TRIANGLES,0,6),r.dataset.ready=`true`,r.dataset.depthWarp=c>.01?`true`:`false`,r.dataset.viewRefinement=l>.005||u>.005?`true`:`false`};c.current=O;let k=()=>O(0,0,0,0,0,1,!0);D.complete&&D.naturalWidth?k():D.addEventListener(`load`,k,{once:!0});let A=typeof ResizeObserver<`u`?new ResizeObserver(()=>{let e=l.current;O(e.viewX,e.viewY,e.warpStrength,e.relightStrength,e.occlusionStrength,u.current.snapshot().stability)}):null;A?.observe(r);let j=()=>{let e=l.current;O(e.viewX,e.viewY,e.warpStrength,e.relightStrength,e.occlusionStrength)};return window.addEventListener(`resize`,j,{passive:!0}),()=>{T=!0,c.current=null,u.current.reset(),A?.disconnect(),window.removeEventListener(`resize`,j),D?.removeEventListener(`load`,k),D=null,i.deleteTexture(w),i.deleteBuffer(C),i.deleteProgram(a)}},[t,n,e]),(0,f.jsx)(`canvas`,{ref:o,className:i,"aria-hidden":`true`})});export{v as default};