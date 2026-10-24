import{a as e}from"./rolldown-runtime-DkW27tQK.js";import{i as t,r as n}from"./index-vFxNKb0l.js";import{C as r,w as i,x as a}from"./useMira-Og1IjaMj.js";var o=e(t(),1),s=Object.freeze({jaw:0,round:0,spread:0,smile:0,blinkL:0,blinkR:0,gazeX:0,gazeY:0,brow:0,yaw:0,pitch:0,roll:0,breath:0}),c=e=>e<0?0:e>1?1:e;function l(e){if(e.schema!==`mira.live-avatar.rig.v1`)throw Error(`unsupported_rig`);let{width:t,height:n}=e.image,r=e.vertices.length/3,i=new Float32Array(r*2),a=new Float32Array(r),o=new Float32Array(r*2);for(let s=0;s<r;s+=1){let r=e.vertices[s*3],c=e.vertices[s*3+1],l=e.vertices[s*3+2];i[s*2]=r*t,i[s*2+1]=c*n,o[s*2]=r,o[s*2+1]=c,a[s]=-l}let s=e.groups,l=e.faceHeight*n,u=e=>i[e*2],d=e=>i[e*2+1],f=s.corners,p=(u(f[0])+u(f[1]))/2,m=(d(13)+d(14))/2,h=Math.abs(u(f[1])-u(f[0]))/2,g=d(152),_=e.center[0]*t,v=l*.42,y=new Float32Array(r),b=new Float32Array(r),x=new Float32Array(r),S=new Float32Array(r),C=new Float32Array(r),w=(d(145)+d(374))/2+l*.06,T=m+l*.08,E=new Set([...s.lowerInner,...s.lowerOuter]),D=new Set([...s.upperInner,...s.upperOuter]),O=new Set(s.chin),k=e=>{let t=Math.min(1,Math.abs(e-p)/Math.max(1,h));return 1-t*t*.92};for(let t=0;t<r;t+=1){let n=u(t),r=d(t);if(t<478){if(E.has(t)&&!D.has(t))y[t]=k(n);else if(r>m+1){let e=c((r-m)/Math.max(1,g-m)),i=c(1-Math.abs(n-_)/v),a=1-c(1-(r-m)/(l*.16))*c((Math.abs(n-p)-h*.6)/(h*.9))*.75;y[t]=(.5+.45*e)*(.35+.65*i)*(O.has(t)?1.08:1)*a}if(D.has(t)&&!E.has(t)&&(b[t]=(s.upperInner.includes(t)?1:.5)*k(n)),!E.has(t)&&!D.has(t)&&r>w&&r<T){let e=Math.abs(n-p)/Math.max(1,h),i=c((e-.35)/.5)*c((2.6-e)/.9),a=Math.sin(Math.PI*c((r-w)/(T-w)));S[t]=i*a,C[t]=n<p?-1:1}if(E.has(t)||D.has(t))x[t]=1;else if(Math.abs(r-m)<l*.12){let e=Math.abs(n-p)-h;e>-h*.2&&(x[t]=c(1-e/(h*.55))*.85)}}else r>m&&e.headWeight[t]>0&&(y[t]=.3*e.headWeight[t])}let A=[{upper:s.leftEyeUpper,lower:[...s.leftEyeLower,33,133],iris:s.irisLeft,side:`L`},{upper:s.rightEyeUpper,lower:[...s.rightEyeLower,263,362],iris:s.irisRight,side:`R`}].map(e=>{let t=[...e.lower].sort((e,t)=>u(e)-u(t)),n=e=>{if(e<=u(t[0]))return d(t[0]);for(let n=1;n<t.length;n+=1){let r=t[n-1],i=t[n];if(e<=u(i))return d(r)+(d(i)-d(r))*((e-u(r))/Math.max(1e-6,u(i)-u(r)))}return d(t[t.length-1])},r=[...e.upper,...e.lower].map(u),i=Math.min(...r),a=Math.max(...r),o=a-i,s=Math.max(...e.upper.map(e=>n(u(e))-d(e)),1),l=s*2.2,f=[],p=[];for(let e=0;e<478;e+=1){let t=u(e),r=n(t)-d(e);if(r<=0||r>=l)continue;let m=c(1-(t<i?i-t:t>a?t-a:0)/(o*.3));if(!m)continue;let h=r<=s?1:(l-r)/(l-s);f.push(e),p.push(r*h*m)}return{iris:e.iris,side:e.side,region:Int32Array.from(f),closeBy:Float32Array.from(p)}}),j=Math.hypot(u(s.irisLeft[1])-u(s.irisLeft[3]),d(s.irisLeft[1])-d(s.irisLeft[3]))/2||l*.03;return{rig:e,count:r,rest:i,depth:a,uv:o,jawW:y,upperLipW:b,lipW:x,cheekW:S,cheekSide:C,headW:Float32Array.from(e.headWeight),breathW:Float32Array.from(e.breathWeight),faceH:l,mouth:{x:p,y:m,halfWidth:h},pivot:{x:_,y:g+l*.35},eyes:A,brows:[...s.leftBrow,...s.rightBrow],irisRadius:j}}function u(e,t,n){let{rest:r,count:i,faceH:a,mouth:o}=e;n.set(r);let s=c(t.jaw),l=s*a*.092,u=c(t.smile),d=c(t.spread),f=c(t.round),p=1-.12*f+.08*d+.04*u-.05*s;for(let s=0;s<i;s+=1){let i=s*2,m=i+1;e.jawW[s]&&(n[m]+=l*e.jawW[s]),e.upperLipW[s]&&(n[m]-=(l*.18+d*a*.006)*e.upperLipW[s]);let h=e.cheekW[s];h&&(n[m]+=(-u*a*.016+l*.16+f*a*.002)*h,n[i]+=e.cheekSide[s]*(u*a*.006-f*a*.006)*h);let g=e.lipW[s];if(g){let e=r[i]-o.x;n[i]+=e*(p-1)*g;let s=Math.min(1,Math.abs(e)/Math.max(1,o.halfWidth));n[m]-=c(t.smile)*a*.012*s*g,n[m]+=c(t.round)*a*.004*(1-s)*g}}let m=Math.max(-1,Math.min(1,t.gazeX))*e.irisRadius*.16,h=Math.max(-1,Math.min(1,t.gazeY))*e.irisRadius*.24;for(let r of e.eyes){let e=c(r.side===`L`?t.blinkL:t.blinkR)*.95;if(e)for(let t=0;t<r.region.length;t+=1)n[r.region[t]*2+1]+=r.closeBy[t]*e;let i=(1-e)**3;for(let e=0;e<r.iris.length;e+=1){let t=(e===0?1:.6)*i,a=r.iris[e];n[a*2]+=m*t,n[a*2+1]+=h*t}}let g=-Math.max(-1,Math.min(1,t.brow))*a*.022;for(let t of e.brows)n[t*2+1]+=g;let _=-t.breath*a*.012;for(let t=0;t<i;t+=1)e.breathW[t]&&(n[t*2+1]+=_*e.breathW[t]);let v=Math.cos(t.roll),y=Math.sin(t.roll),{x:b,y:x}=e.pivot;for(let r=0;r<i;r+=1){let i=e.headW[r];if(!i)continue;let o=r*2,s=o+1,c=n[o]-b,l=n[s]-x,u=b+c*v-l*y,d=x+c*y+l*v,f=.35+1.2*Math.max(0,e.depth[r]);n[o]+=(u+t.yaw*a*f-n[o])*i,n[s]+=(d+t.pitch*a*f*.8-n[s])*i}return l}function d(e,t){let n=c(e);if(!t)return{jaw:n,round:0,spread:0};let r=t.low+t.mid+t.high+1e-6,i=t.low/r,a=t.high/r;return{jaw:c(n*(.8+.4*(t.mid/r))),round:c((i-.42)*2.2)*n,spread:c((a-.28)*2.4)*n}}var f={happy:{smile:.18,brow:.05},sad:{smile:-.14,brow:.25},tired:{smile:-.08,brow:.12},angry:{smile:-.12,brow:.1},surprised:{smile:.04,brow:.35},neutral:{smile:0,brow:0}};function p(e){let t=e>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}var m=class{constructor(e=1){this.params={...s},this.nextBlinkAt=0,this.blinkStart=-1,this.nextSaccadeAt=0,this.gazeTarget={x:0,y:0},this.envelope=0,this.lastT=0,this.syllablePhase=0,this.syllableRate=5,this.syllableShape={round:0,spread:0},this.phrasePauseUntil=0,this.nextPhrasePauseAt=0,this.fastEnv=0,this.emphasis=0,this.nodKick=0,this.userTalkMs=0,this.userQuietMs=0,this.ackPulse=0,this.rand=p(e)}ease(e,t,n,r,i){let a=t>e?r:i;return e+(t-e)*(1-Math.exp(-n/Math.max(.001,a)))}proceduralVoice(e,t){if(this.nextPhrasePauseAt||=e+1.4+this.rand()*1.6,e>=this.nextPhrasePauseAt&&(this.phrasePauseUntil=e+.18+this.rand()*.22,this.nextPhrasePauseAt=this.phrasePauseUntil+1.2+this.rand()*1.8),e<this.phrasePauseUntil)return{level:0,bands:{low:0,mid:0,high:0}};let n=this.syllablePhase;if(this.syllablePhase+=t*this.syllableRate,Math.floor(this.syllablePhase)!==Math.floor(n)){this.syllableRate=4.2+this.rand()*2.3;let e=this.rand();this.syllableShape=e<.3?{round:.7,spread:0}:e<.6?{round:0,spread:.7}:{round:.1,spread:.15}}let r=this.syllablePhase%1,i=.12+.78*Math.sin(Math.PI*Math.min(1,r*1.15))**1.4,{round:a,spread:o}=this.syllableShape;return{level:i,bands:{low:.35+a*.5,mid:.4,high:.2+o*.6}}}update(e){let t=e.timeMs/1e3,n=this.lastT?Math.min(.1,Math.max(0,t-this.lastT)):1/60;this.lastT=t;let r=this.params,i=e.reducedMotion?.25:1,a=e.state===`speaking`&&e.voiceLevel>=0,o=e.state===`speaking`&&!a&&e.voiceAudible===!0,s=a||o,c=0,l=null;if(a)c=Math.min(1,Math.max(0,e.voiceLevel)**.72*1.3),l=e.voiceBands;else if(o){let e=this.proceduralVoice(t,n);c=e.level*i,l=e.bands}let u=s?d(c,l):{jaw:0,round:0,spread:0};r.jaw=this.ease(r.jaw,u.jaw,n,.03,.055),r.round=this.ease(r.round,u.round,n,.045,.08),r.spread=this.ease(r.spread,u.spread,n,.045,.08),this.envelope=this.ease(this.envelope,s?c:0,n,.25,.6),this.fastEnv=this.ease(this.fastEnv,s?c:0,n,.04,.12),s&&this.fastEnv-this.envelope>.22&&this.emphasis<.2&&(this.emphasis=1,this.nodKick=1),this.emphasis=Math.max(0,this.emphasis-n*2.2),this.nodKick=Math.max(0,this.nodKick-n*3.5),e.state===`listening`?e.userLevel>.12?(this.userTalkMs+=n*1e3,this.userQuietMs=0):(this.userQuietMs+=n*1e3,this.userTalkMs>600&&this.userQuietMs>300&&(this.ackPulse=1,this.userTalkMs=0)):(this.userTalkMs=0,this.userQuietMs=0),this.ackPulse=Math.max(0,this.ackPulse-n*1.6);let p=f[e.userMood||`neutral`],m=Math.max(.06,(e.state===`listening`?.38:e.state===`thinking`?.12:.28)+p.smile+this.ackPulse*.15);r.smile=this.ease(r.smile,m*(1-r.jaw*.55),n,.35,.55);let h=Math.min(.75,(e.state===`thinking`?.35:s?this.envelope*.45+this.emphasis*.35:e.state===`listening`?.18+this.ackPulse*.15:0)+p.brow);r.brow=this.ease(r.brow,h,n,.1,.35),this.nextBlinkAt||=t+1.2+this.rand()*2,this.blinkStart<0&&t>=this.nextBlinkAt&&(this.blinkStart=t);let g=0;if(this.blinkStart>=0){let e=t-this.blinkStart;g=e<.12?e/.12:e<.28?1-(e-.12)/.16:0,e>=.28&&(this.blinkStart=-1,this.nextBlinkAt=t+(this.rand()<.15?.25:2.2+this.rand()*3.6))}r.blinkL=g,r.blinkR=g;let _=e.state===`thinking`;t>=this.nextSaccadeAt&&(this.gazeTarget=_?{x:(this.rand()-.5)*.9,y:-.55-this.rand()*.3}:{x:(this.rand()-.5)*.35,y:(this.rand()-.5)*.25},this.nextSaccadeAt=t+(_?.9:1.4)+this.rand()*1.8);let v=!_&&e.lookAt?e.lookAt:null,y=v?Math.max(-1,Math.min(1,v.x*.85))+this.gazeTarget.x*.2:this.gazeTarget.x,b=v?Math.max(-1,Math.min(1,v.y*.7))+this.gazeTarget.y*.2:this.gazeTarget.y;r.gazeX=this.ease(r.gazeX,y*i,n,.06,.06),r.gazeY=this.ease(r.gazeY,b*i,n,.06,.06);let x=(Math.sin(t*.37)*.6+Math.sin(t*.91+1.3)*.4)*.026,S=(Math.sin(t*.43+.7)*.6+Math.sin(t*1.17)*.4)*.018,C=Math.sin(t*.29+2.1)*.016,w=s?Math.sin(t*5.2)*this.envelope*.04+this.nodKick*.03:0,T=Math.sin((1-this.ackPulse)*Math.PI*2)*this.ackPulse*.035,E=e.state===`listening`?.035+e.userLevel*.02:0,D=v?v.x*.025:0,O=v?v.y*.015:0,k=e=>Math.max(-.08,Math.min(.08,e));return r.yaw=this.ease(r.yaw,k((x+D+(s?Math.sin(t*2.3)*this.envelope*.032:0))*i),n,.22,.25),r.pitch=this.ease(r.pitch,k((S+w+T+O)*i),n,.1,.18),r.roll=this.ease(r.roll,k((C+E+(s?Math.sin(t*.8+.4)*this.envelope*.02:0))*i),n,.45,.55),r.breath=Math.sin(t*(s?1.9:1.35))*(.55*i),r}},h=`
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
}`,g=`
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
}`,_=`
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
}`;function v(e,t,n){let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw Error(`live_avatar_shader`);return r}function y(e,t){let n=e.createProgram();if(e.attachShader(n,v(e,e.VERTEX_SHADER,h)),e.attachShader(n,v(e,e.FRAGMENT_SHADER,t)),e.linkProgram(n),!e.getProgramParameter(n,e.LINK_STATUS))throw Error(`live_avatar_program`);return n}var b=class e{constructor(e,t,n,r=!1,i=null){this.canvas=e,this.prep=t,this.feather=0;let a=e.getContext(`webgl`,{alpha:!0,antialias:!0,premultipliedAlpha:!0,preserveDrawingBuffer:r});if(!a)throw Error(`webgl_unavailable`);this.gl=a,this.skin=y(a,g),this.mouth=y(a,_),this.positions=new Float32Array(t.count*2),this.posBuffer=a.createBuffer(),a.bindBuffer(a.ARRAY_BUFFER,this.posBuffer),a.bufferData(a.ARRAY_BUFFER,this.positions.byteLength,a.DYNAMIC_DRAW),this.uvBuffer=a.createBuffer(),a.bindBuffer(a.ARRAY_BUFFER,this.uvBuffer),a.bufferData(a.ARRAY_BUFFER,t.uv,a.STATIC_DRAW);let o=new Uint16Array(t.rig.triangles),s=new Uint16Array(t.rig.mouthTriangles);this.skinCount=o.length,this.mouthCount=s.length,this.skinIndex=a.createBuffer(),a.bindBuffer(a.ELEMENT_ARRAY_BUFFER,this.skinIndex),a.bufferData(a.ELEMENT_ARRAY_BUFFER,o,a.STATIC_DRAW),this.mouthIndex=a.createBuffer(),a.bindBuffer(a.ELEMENT_ARRAY_BUFFER,this.mouthIndex),a.bufferData(a.ELEMENT_ARRAY_BUFFER,s,a.STATIC_DRAW),this.texture=a.createTexture(),a.bindTexture(a.TEXTURE_2D,this.texture),a.pixelStorei(a.UNPACK_FLIP_Y_WEBGL,!1),a.texImage2D(a.TEXTURE_2D,0,a.RGB,a.RGB,a.UNSIGNED_BYTE,n),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE),this.teethTexture=a.createTexture(),a.bindTexture(a.TEXTURE_2D,this.teethTexture),i?(a.texImage2D(a.TEXTURE_2D,0,a.RGBA,a.RGBA,a.UNSIGNED_BYTE,i),a.generateMipmap(a.TEXTURE_2D),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.LINEAR_MIPMAP_LINEAR)):(a.texImage2D(a.TEXTURE_2D,0,a.RGBA,1,1,0,a.RGBA,a.UNSIGNED_BYTE,new Uint8Array([0,0,0,0])),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.LINEAR)),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE)}static{this.PANEL_ASPECT=1.42}viewTransform(t){let{width:n,height:r}=this.prep.rig.image,i=this.canvas.width,a=this.canvas.height,o=i/a>n/r*1.15,s=o?Math.min(i,a*e.PANEL_ASPECT):i,c=Math.max(s/n,a/r);this.feather=o&&s<i?.07:0;let l=n*c/i,u=r*c/a,d=.12-(1-2*t)*u,f=Math.max(0,u-1);return[l,u,0,Math.max(-f,Math.min(f,d))]}resize(e,t){(this.canvas.width!==e||this.canvas.height!==t)&&(this.canvas.width=e,this.canvas.height=t),this.gl.viewport(0,0,e,t)}render(e){let{gl:t,prep:n}=this,r=u(n,e,this.positions);t.bindBuffer(t.ARRAY_BUFFER,this.posBuffer),t.bufferSubData(t.ARRAY_BUFFER,0,this.positions);let i=this.viewTransform(n.rig.center[1]);t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,this.texture);let a=(e,a,o)=>{t.useProgram(e);let s=t.getAttribLocation(e,`a_pos`),c=t.getAttribLocation(e,`a_uv`);if(t.bindBuffer(t.ARRAY_BUFFER,this.posBuffer),t.enableVertexAttribArray(s),t.vertexAttribPointer(s,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,this.uvBuffer),t.enableVertexAttribArray(c),t.vertexAttribPointer(c,2,t.FLOAT,!1,0,0),t.uniform2f(t.getUniformLocation(e,`u_image`),n.rig.image.width,n.rig.image.height),t.uniform4f(t.getUniformLocation(e,`u_view`),i[0],i[1],i[2],i[3]),t.uniform1i(t.getUniformLocation(e,`u_tex`),0),e===this.skin){t.uniform1f(t.getUniformLocation(e,`u_feather`),this.feather);let{width:i,height:a}=n.rig.image,o=n.rest,s=(o[27]+o[29])/2/a,c=(o[157]+o[617])/2/a;t.uniform2f(t.getUniformLocation(e,`u_seam`),n.mouth.x/i,s),t.uniform1f(t.getUniformLocation(e,`u_seamCornerY`),c),t.uniform1f(t.getUniformLocation(e,`u_seamHalfW`),Math.max(1,Math.abs(o[616]-o[156])/2)/i),t.uniform1f(t.getUniformLocation(e,`u_seamT`),n.faceH*.011/a),t.uniform1f(t.getUniformLocation(e,`u_reveal`),Math.min(1,Math.max(0,(r-1.5)/4.5)))}if(e===this.mouth){let i=e=>[this.positions[e*2],this.positions[e*2+1]];t.uniform2f(t.getUniformLocation(e,`u_mouthTop`),...i(13)),t.uniform2f(t.getUniformLocation(e,`u_mouthBot`),...i(14)),t.uniform2f(t.getUniformLocation(e,`u_cornerL`),...i(78)),t.uniform2f(t.getUniformLocation(e,`u_cornerR`),...i(308)),t.uniform1f(t.getUniformLocation(e,`u_open`),r),t.uniform1f(t.getUniformLocation(e,`u_mmPerPx`),25/Math.max(1,Math.abs(n.rest[616]-n.rest[156])/2)),t.activeTexture(t.TEXTURE1),t.bindTexture(t.TEXTURE_2D,this.teethTexture),t.uniform1i(t.getUniformLocation(e,`u_teeth`),1),t.activeTexture(t.TEXTURE0)}t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,a),t.drawElements(t.TRIANGLES,o,t.UNSIGNED_SHORT,0)};a(this.mouth,this.mouthIndex,this.mouthCount),a(this.skin,this.skinIndex,this.skinCount)}dispose(){let{gl:e}=this;e.deleteBuffer(this.posBuffer),e.deleteBuffer(this.uvBuffer),e.deleteBuffer(this.skinIndex),e.deleteBuffer(this.mouthIndex),e.deleteTexture(this.texture),e.deleteTexture(this.teethTexture),e.deleteProgram(this.skin),e.deleteProgram(this.mouth)}},x=n(),S=`mira-assets/live/mira-live-face-v1.webp`,C=`mira-assets/live/mira-live-face-v1.rig.json`,w=`mira-assets/live/mira-teeth-v1.webp`,T=e=>new Promise((t,n)=>{let r=new Image;r.decoding=`async`,r.onload=()=>t(r),r.onerror=()=>n(Error(e)),r.src=e}),E=e=>`./${e}`;function D({state:e,live:t,realtime:n,userMood:s=`neutral`}){let c=(0,o.useRef)(null),u=(0,o.useRef)(e);u.current=e;let d=(0,o.useRef)(s);d.current=s;let[f,p]=(0,o.useState)(`loading`);return(0,o.useEffect)(()=>{let e=!1,t=0,n=null,o=null,s=typeof matchMedia==`function`&&matchMedia(`(prefers-reduced-motion: reduce)`).matches,f=new m(Date.now()&65535),h=/[?&]avatar-debug=1\b/.test(window.location.search),g=/[?&]avatar-export=1\b/.test(window.location.search),_=null,v=0,y=e=>{let t=c.current;if(!t)return;let n=t.getBoundingClientRect();n.width&&n.height&&(_={x:Math.max(-1,Math.min(1,(e.clientX-(n.left+n.width/2))/(n.width/2))),y:Math.max(-1,Math.min(1,(e.clientY-(n.top+n.height*.36))/(n.height/2)))},v=performance.now()+2500)},x=()=>{_=null};return window.addEventListener(`pointermove`,y,{passive:!0}),window.addEventListener(`pointerdown`,y,{passive:!0}),document.addEventListener(`pointerleave`,x),(async()=>{try{let[m,y,x]=await Promise.all([fetch(E(C),{cache:`force-cache`}).then(e=>{if(!e.ok)throw Error(`rig`);return e.json()}),new Promise((e,t)=>{let n=new Image;n.decoding=`async`,n.onload=()=>e(n),n.onerror=()=>t(Error(`face`)),n.src=E(S)}),T(E(w)).catch(()=>null)]);if(e||!c.current)return;let D=c.current;n=new b(D,l(m),y,g,x);let O=()=>{let e=D.getBoundingClientRect(),t=Math.min(2,window.devicePixelRatio||1);n?.resize(Math.max(1,Math.round(e.width*t)),Math.max(1,Math.round(e.height*t)))};if(O(),o=new ResizeObserver(O),o.observe(D),p(`live`),g){window.__miraRenderFrame=e=>{n&&n.render(f.update({timeMs:e.timeMs,state:e.state,voiceLevel:e.state===`speaking`?e.level:-1,voiceBands:e.state===`speaking`?e.bands:null,userLevel:e.userLevel||0,reducedMotion:!1,userMood:d.current,lookAt:e.lookAt??null}))};return}let k=o=>{if(e||!n)return;let c=u.current===`speaking`&&i.active;_&&o>v&&(_=null);let l=f.update({timeMs:o,state:u.current,voiceLevel:c?i.value:-1,voiceBands:c?i.bands:null,userLevel:u.current===`listening`&&a.active?a.value:0,reducedMotion:s,userMood:d.current,voiceAudible:r.active,lookAt:_});h&&(window.__miraFace={...l,speaking:c,level:i.value,analyser:i.active,audible:r.active,state:u.current}),n.render(l),t=requestAnimationFrame(k)};t=requestAnimationFrame(k)}catch{e||p(`still`)}})(),()=>{e=!0,cancelAnimationFrame(t),window.removeEventListener(`pointermove`,y),window.removeEventListener(`pointerdown`,y),document.removeEventListener(`pointerleave`,x),o?.disconnect(),n?.dispose()}},[]),(0,x.jsxs)(`div`,{className:`live-avatar state-${e}${t?` is-live`:``}${n?` is-realtime`:``}`,"data-live-avatar":f,role:`img`,"aria-label":t?`Mira, nhân vật AI, đang trò chuyện`:`Mira, nhân vật AI`,children:[(0,x.jsx)(`img`,{className:`live-avatar-still`,src:E(S),alt:``,"aria-hidden":`true`,draggable:!1}),(0,x.jsx)(`canvas`,{ref:c,className:`live-avatar-canvas`,"aria-hidden":`true`}),(0,x.jsxs)(`span`,{className:`live-avatar-badge`,"aria-hidden":`true`,children:[(0,x.jsx)(`i`,{}),n?`LIVE`:e===`speaking`?`ĐANG NÓI`:`MIRA`]})]})}export{D as default};