import{c as gt,g as ih}from"./_commonjsHelpers-Cpj98o6Y.js";function ah(L,ee){for(var ne=0;ne<ee.length;ne++){const Z=ee[ne];if(typeof Z!="string"&&!Array.isArray(Z)){for(const ue in Z)if(ue!=="default"&&!(ue in L)){const he=Object.getOwnPropertyDescriptor(Z,ue);he&&Object.defineProperty(L,ue,he.get?he:{enumerable:!0,get:()=>Z[ue]})}}}return Object.freeze(Object.defineProperty(L,Symbol.toStringTag,{value:"Module"}))}var os={},$a={};Object.defineProperty($a,"__esModule",{value:!0});$a.baseAssetPath=void 0;const nh=typeof window<"u"&&typeof window.document<"u",Fp=nh?window.document.currentScript:null;let Kp="/";Fp&&(Kp=Fp.src.replace(/#.*$/,"").replace(/\?.*$/,"").replace(/\/[^/]+$/,"/"));$a.baseAssetPath=Kp;var $i={};Object.defineProperty($i,"__esModule",{value:!0});$i.defaultModelFetcher=void 0;const sh=L=>fetch(L).then(ee=>ee.arrayBuffer());$i.defaultModelFetcher=sh;var er={},_r={};Object.defineProperty(_r,"__esModule",{value:!0});_r.log=void 0;const ss=L=>ee=>{console.log(`VAD | ${L} >`,ee)};_r.log={error:ss("error"),debug:ss("debug"),warn:ss("warn")};var ri={};Object.defineProperty(ri,"__esModule",{value:!0});ri.Message=void 0;var qp;(function(L){L.AudioFrame="AUDIO_FRAME",L.SpeechStart="SPEECH_START",L.VADMisfire="VAD_MISFIRE",L.SpeechEnd="SPEECH_END",L.SpeechStop="SPEECH_STOP",L.SpeechRealStart="SPEECH_REAL_START",L.FrameProcessed="FRAME_PROCESSED"})(qp||(ri.Message=qp={}));Object.defineProperty(er,"__esModule",{value:!0});er.FrameProcessor=er.validateOptions=er.defaultFrameProcessorOptions=void 0;const wa=_r,ti=ri;er.defaultFrameProcessorOptions={positiveSpeechThreshold:.3,negativeSpeechThreshold:.25,preSpeechPadMs:800,redemptionMs:1400,minSpeechMs:400,submitUserSpeechOnPause:!1};function oh(L){(L.positiveSpeechThreshold<0||L.positiveSpeechThreshold>1)&&wa.log.error("positiveSpeechThreshold should be a number between 0 and 1"),(L.negativeSpeechThreshold<0||L.negativeSpeechThreshold>L.positiveSpeechThreshold)&&wa.log.error("negativeSpeechThreshold should be between 0 and positiveSpeechThreshold"),L.preSpeechPadMs<0&&wa.log.error("preSpeechPadMs should be positive"),L.redemptionMs<0&&wa.log.error("redemptionMs should be positive"),L.minSpeechMs<0&&wa.log.error("minSpeechMs should be positive")}er.validateOptions=oh;const Gp=L=>{const ee=L.reduce((Z,ue)=>(Z.push(Z.at(-1)+ue.length),Z),[0]),ne=new Float32Array(ee.at(-1));return L.forEach((Z,ue)=>{const he=ee[ue];ne.set(Z,he)}),ne};function Wp(L,ee){const ne=Math.floor(L.redemptionMs/ee),Z=Math.floor(L.preSpeechPadMs/ee),ue=Math.floor(L.minSpeechMs/ee);return{redemptionFrames:ne,preSpeechPadFrames:Z,minSpeechFrames:ue}}class uh{constructor(ee,ne,Z,ue){this.modelProcessFunc=ee,this.modelResetFunc=ne,this.options=Z,this.msPerFrame=ue,this.speaking=!1,this.redemptionCounter=0,this.speechFrameCount=0,this.active=!1,this.speechRealStartFired=!1,this.setOptions=I=>{this.options={...this.options,...I};const{redemptionFrames:be,preSpeechPadFrames:Je,minSpeechFrames:Ve}=Wp(this.options,this.msPerFrame);this.redemptionFrames=be,this.preSpeechPadFrames=Je,this.minSpeechFrames=Ve},this.reset=()=>{this.speaking=!1,this.speechRealStartFired=!1,this.audioBuffer=[],this.modelResetFunc(),this.redemptionCounter=0,this.speechFrameCount=0},this.pause=I=>{this.active=!1,this.options.submitUserSpeechOnPause?this.endSegment(I):this.reset()},this.resume=()=>{this.active=!0},this.endSegment=I=>{const be=this.audioBuffer;this.audioBuffer=[];const Je=this.speaking;if(this.reset(),Je)if(be.reduce((ve,$e)=>$e.isSpeech?ve+1:ve,0)>=this.minSpeechFrames){const ve=Gp(be.map($e=>$e.frame));I({msg:ti.Message.SpeechEnd,audio:ve})}else I({msg:ti.Message.VADMisfire});return{}},this.process=async(I,be)=>{if(!this.active)return;const Je=await this.modelProcessFunc(I),Ve=Je.isSpeech>=this.options.positiveSpeechThreshold;if(be({probs:Je,msg:ti.Message.FrameProcessed,frame:I}),this.audioBuffer.push({frame:I,isSpeech:Ve}),Ve&&(this.speechFrameCount++,this.redemptionCounter=0),Ve&&!this.speaking&&(this.speaking=!0,be({msg:ti.Message.SpeechStart})),this.speaking&&this.speechFrameCount===this.minSpeechFrames&&!this.speechRealStartFired&&(this.speechRealStartFired=!0,be({msg:ti.Message.SpeechRealStart})),Je.isSpeech<this.options.negativeSpeechThreshold&&this.speaking&&++this.redemptionCounter>=this.redemptionFrames){this.redemptionCounter=0,this.speechFrameCount=0,this.speaking=!1,this.speechRealStartFired=!1;const ve=this.audioBuffer;if(this.audioBuffer=[],ve.reduce((we,Ue)=>Ue.isSpeech?we+1:we,0)>=this.minSpeechFrames){const we=Gp(ve.map(Ue=>Ue.frame));be({msg:ti.Message.SpeechEnd,audio:we})}else be({msg:ti.Message.VADMisfire})}if(!this.speaking){for(;this.audioBuffer.length>this.preSpeechPadFrames;)this.audioBuffer.shift();this.speechFrameCount=0}},this.audioBuffer=[];const{redemptionFrames:he,preSpeechPadFrames:_e,minSpeechFrames:fe}=Wp(this.options,this.msPerFrame);this.redemptionFrames=he,this.preSpeechPadFrames=_e,this.minSpeechFrames=fe,this.reset()}}er.FrameProcessor=uh;var Zp={};function Ot(L){throw new Error('Could not dynamically require "'+L+'". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.')}var Qp={exports:{}};/*!
 * ONNX Runtime Web v1.26.0
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */(function(L,ee){var ne=(()=>{var Z=Object.defineProperty,ue=Object.getOwnPropertyDescriptor,he=Object.getOwnPropertyNames,_e=Object.prototype.hasOwnProperty,fe=(e=>typeof Ot<"u"?Ot:typeof Proxy<"u"?new Proxy(e,{get:(t,r)=>(typeof Ot<"u"?Ot:t)[r]}):e)(function(e){if(typeof Ot<"u")return Ot.apply(this,arguments);throw Error('Dynamic require of "'+e+'" is not supported')}),I=(e,t)=>()=>(e&&(t=e(e=0)),t),be=(e,t)=>{for(var r in t)Z(e,r,{get:t[r],enumerable:!0})},Je=(e,t,r,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let a of he(t))!_e.call(e,a)&&a!==r&&Z(e,a,{get:()=>t[a],enumerable:!(i=ue(t,a))||i.enumerable});return e},Ve=e=>Je(Z({},"__esModule",{value:!0}),e),ve,$e,we,Ue,je,bt=I(()=>{ve=new Map,$e=[],we=(e,t,r)=>{if(t&&typeof t.init=="function"&&typeof t.createInferenceSessionHandler=="function"){let i=ve.get(e);if(i===void 0)ve.set(e,{backend:t,priority:r});else{if(i.priority>r)return;if(i.priority===r&&i.backend!==t)throw new Error(`cannot register backend "${e}" using priority ${r}`)}if(r>=0){let a=$e.indexOf(e);a!==-1&&$e.splice(a,1);for(let n=0;n<$e.length;n++)if(ve.get($e[n]).priority<=r){$e.splice(n,0,e);return}$e.push(e)}return}throw new TypeError("not a valid backend")},Ue=async e=>{let t=ve.get(e);if(!t)return"backend not found.";if(t.initialized)return t.backend;if(t.aborted)return t.error;{let r=!!t.initPromise;try{return r||(t.initPromise=t.backend.init(e)),await t.initPromise,t.initialized=!0,t.backend}catch(i){return r||(t.error=`${i}`,t.aborted=!0),t.error}finally{delete t.initPromise}}},je=async e=>{let t=e.executionProviders||[],r=t.map(u=>typeof u=="string"?u:u.name),i=r.length===0?$e:r,a,n=[],s=new Set;for(let u of i){let l=await Ue(u);typeof l=="string"?n.push({name:u,err:l}):(a||(a=l),a===l&&s.add(u))}if(!a)throw new Error(`no available backend found. ERR: ${n.map(u=>`[${u.name}] ${u.err}`).join(", ")}`);for(let{name:u,err:l}of n)r.includes(u)&&console.warn(`removing requested execution provider "${u}" from session options because it is not available: ${l}`);let o=t.filter(u=>s.has(typeof u=="string"?u:u.name));return[a,new Proxy(e,{get:(u,l)=>l==="executionProviders"?o:Reflect.get(u,l)})]}}),Rt=I(()=>{bt()}),Ee,ke=I(()=>{Ee="1.26.0"}),me,de,Le=I(()=>{ke(),me="warning",de={wasm:{},webgl:{},webgpu:{},versions:{common:Ee},set logLevel(e){if(e!==void 0){if(typeof e!="string"||["verbose","info","warning","error","fatal"].indexOf(e)===-1)throw new Error(`Unsupported logging level: ${e}`);me=e}},get logLevel(){return me}},Object.defineProperty(de,"logLevel",{enumerable:!0})}),Y,ut=I(()=>{Le(),Y=de}),We,yt,ur=I(()=>{We=(e,t)=>{let r=typeof document<"u"?document.createElement("canvas"):new OffscreenCanvas(1,1);r.width=e.dims[3],r.height=e.dims[2];let i=r.getContext("2d");if(i!=null){let a,n;(t==null?void 0:t.tensorLayout)!==void 0&&t.tensorLayout==="NHWC"?(a=e.dims[2],n=e.dims[3]):(a=e.dims[3],n=e.dims[2]);let s=(t==null?void 0:t.format)!==void 0?t.format:"RGB",o=t==null?void 0:t.norm,u,l;o===void 0||o.mean===void 0?u=[255,255,255,255]:typeof o.mean=="number"?u=[o.mean,o.mean,o.mean,o.mean]:(u=[o.mean[0],o.mean[1],o.mean[2],0],o.mean[3]!==void 0&&(u[3]=o.mean[3])),o===void 0||o.bias===void 0?l=[0,0,0,0]:typeof o.bias=="number"?l=[o.bias,o.bias,o.bias,o.bias]:(l=[o.bias[0],o.bias[1],o.bias[2],0],o.bias[3]!==void 0&&(l[3]=o.bias[3]));let d=n*a,p=0,h=d,f=d*2,m=-1;s==="RGBA"?(p=0,h=d,f=d*2,m=d*3):s==="RGB"?(p=0,h=d,f=d*2):s==="RBG"&&(p=0,f=d,h=d*2);for(let _=0;_<n;_++)for(let $=0;$<a;$++){let w=(e.data[p++]-l[0])*u[0],y=(e.data[h++]-l[1])*u[1],S=(e.data[f++]-l[2])*u[2],v=m===-1?255:(e.data[m++]-l[3])*u[3];i.fillStyle="rgba("+w+","+y+","+S+","+v+")",i.fillRect($,_,1,1)}if("toDataURL"in r)return r.toDataURL();throw new Error("toDataURL is not supported")}else throw new Error("Can not access image data")},yt=(e,t)=>{let r=typeof document<"u"?document.createElement("canvas").getContext("2d"):new OffscreenCanvas(1,1).getContext("2d"),i;if(r!=null){let a,n,s;(t==null?void 0:t.tensorLayout)!==void 0&&t.tensorLayout==="NHWC"?(a=e.dims[2],n=e.dims[1],s=e.dims[3]):(a=e.dims[3],n=e.dims[2],s=e.dims[1]);let o=t!==void 0&&t.format!==void 0?t.format:"RGB",u=t==null?void 0:t.norm,l,d;u===void 0||u.mean===void 0?l=[255,255,255,255]:typeof u.mean=="number"?l=[u.mean,u.mean,u.mean,u.mean]:(l=[u.mean[0],u.mean[1],u.mean[2],255],u.mean[3]!==void 0&&(l[3]=u.mean[3])),u===void 0||u.bias===void 0?d=[0,0,0,0]:typeof u.bias=="number"?d=[u.bias,u.bias,u.bias,u.bias]:(d=[u.bias[0],u.bias[1],u.bias[2],0],u.bias[3]!==void 0&&(d[3]=u.bias[3]));let p=n*a;if(t!==void 0&&(t.format!==void 0&&s===4&&t.format!=="RGBA"||s===3&&t.format!=="RGB"&&t.format!=="BGR"))throw new Error("Tensor format doesn't match input tensor dims");let h=4,f=0,m=1,_=2,$=3,w=0,y=p,S=p*2,v=-1;o==="RGBA"?(w=0,y=p,S=p*2,v=p*3):o==="RGB"?(w=0,y=p,S=p*2):o==="RBG"&&(w=0,S=p,y=p*2),i=r.createImageData(a,n);for(let z=0;z<n*a;f+=h,m+=h,_+=h,$+=h,z++)i.data[f]=(e.data[w++]-d[0])*l[0],i.data[m]=(e.data[y++]-d[1])*l[1],i.data[_]=(e.data[S++]-d[2])*l[2],i.data[$]=v===-1?255:(e.data[v++]-d[3])*l[3]}else throw new Error("Can not access image data");return i}}),lt,$t,wr,br,Be,zt,vi=I(()=>{vr(),lt=(e,t)=>{if(e===void 0)throw new Error("Image buffer must be defined");if(t.height===void 0||t.width===void 0)throw new Error("Image height and width must be defined");if(t.tensorLayout==="NHWC")throw new Error("NHWC Tensor layout is not supported yet");let{height:r,width:i}=t,a=t.norm??{mean:255,bias:0},n,s;typeof a.mean=="number"?n=[a.mean,a.mean,a.mean,a.mean]:n=[a.mean[0],a.mean[1],a.mean[2],a.mean[3]??255],typeof a.bias=="number"?s=[a.bias,a.bias,a.bias,a.bias]:s=[a.bias[0],a.bias[1],a.bias[2],a.bias[3]??0];let o=t.format!==void 0?t.format:"RGBA",u=t.tensorFormat!==void 0&&t.tensorFormat!==void 0?t.tensorFormat:"RGB",l=r*i,d=u==="RGBA"?new Float32Array(l*4):new Float32Array(l*3),p=4,h=0,f=1,m=2,_=3,$=0,w=l,y=l*2,S=-1;o==="RGB"&&(p=3,h=0,f=1,m=2,_=-1),u==="RGBA"?S=l*3:u==="RBG"?($=0,y=l,w=l*2):u==="BGR"&&(y=0,w=l,$=l*2);for(let v=0;v<l;v++,h+=p,m+=p,f+=p,_+=p)d[$++]=(e[h]+s[0])/n[0],d[w++]=(e[f]+s[1])/n[1],d[y++]=(e[m]+s[2])/n[2],S!==-1&&_!==-1&&(d[S++]=(e[_]+s[3])/n[3]);return u==="RGBA"?new Me("float32",d,[1,4,r,i]):new Me("float32",d,[1,3,r,i])},$t=async(e,t)=>{let r=typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement,i=typeof ImageData<"u"&&e instanceof ImageData,a=typeof ImageBitmap<"u"&&e instanceof ImageBitmap,n=typeof e=="string",s,o=t??{},u=()=>{if(typeof document<"u")return document.createElement("canvas");if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(1,1);throw new Error("Canvas is not supported")},l=d=>typeof HTMLCanvasElement<"u"&&d instanceof HTMLCanvasElement||d instanceof OffscreenCanvas?d.getContext("2d"):null;if(r){let d=u();d.width=e.width,d.height=e.height;let p=l(d);if(p!=null){let h=e.height,f=e.width;if(t!==void 0&&t.resizedHeight!==void 0&&t.resizedWidth!==void 0&&(h=t.resizedHeight,f=t.resizedWidth),t!==void 0){if(o=t,t.tensorFormat!==void 0)throw new Error("Image input config format must be RGBA for HTMLImageElement");o.tensorFormat="RGBA",o.height=h,o.width=f}else o.tensorFormat="RGBA",o.height=h,o.width=f;p.drawImage(e,0,0),s=p.getImageData(0,0,f,h).data}else throw new Error("Can not access image data")}else if(i){let d,p;if(t!==void 0&&t.resizedWidth!==void 0&&t.resizedHeight!==void 0?(d=t.resizedHeight,p=t.resizedWidth):(d=e.height,p=e.width),t!==void 0&&(o=t),o.format="RGBA",o.height=d,o.width=p,t!==void 0){let h=u();h.width=p,h.height=d;let f=l(h);if(f!=null)f.putImageData(e,0,0),s=f.getImageData(0,0,p,d).data;else throw new Error("Can not access image data")}else s=e.data}else if(a){if(t===void 0)throw new Error("Please provide image config with format for Imagebitmap");let d=u();d.width=e.width,d.height=e.height;let p=l(d);if(p!=null){let h=e.height,f=e.width;return p.drawImage(e,0,0,f,h),s=p.getImageData(0,0,f,h).data,o.height=h,o.width=f,lt(s,o)}else throw new Error("Can not access image data")}else{if(n)return new Promise((d,p)=>{let h=u(),f=l(h);if(!e||!f)return p();let m=new Image;m.crossOrigin="Anonymous",m.src=e,m.onload=()=>{h.width=m.width,h.height=m.height,f.drawImage(m,0,0,h.width,h.height);let _=f.getImageData(0,0,h.width,h.height);o.height=h.height,o.width=h.width,d(lt(_.data,o))}});throw new Error("Input data provided is not supported - aborted tensor creation")}if(s!==void 0)return lt(s,o);throw new Error("Input data provided is not supported - aborted tensor creation")},wr=(e,t)=>{let{width:r,height:i,download:a,dispose:n}=t,s=[1,i,r,4];return new Me({location:"texture",type:"float32",texture:e,dims:s,download:a,dispose:n})},br=(e,t)=>{let{dataType:r,dims:i,download:a,dispose:n}=t;return new Me({location:"gpu-buffer",type:r??"float32",gpuBuffer:e,dims:i,download:a,dispose:n})},Be=(e,t)=>{let{dataType:r,dims:i,download:a,dispose:n}=t;return new Me({location:"ml-tensor",type:r??"float32",mlTensor:e,dims:i,download:a,dispose:n})},zt=(e,t,r)=>new Me({location:"cpu-pinned",type:e,data:t,dims:r??[t.length]})}),it,Bt,$r,xi,Wa=I(()=>{it=new Map([["float32",Float32Array],["uint8",Uint8Array],["int8",Int8Array],["uint16",Uint16Array],["int16",Int16Array],["int32",Int32Array],["bool",Uint8Array],["float64",Float64Array],["uint32",Uint32Array],["int4",Uint8Array],["uint4",Uint8Array]]),Bt=new Map([[Float32Array,"float32"],[Uint8Array,"uint8"],[Int8Array,"int8"],[Uint16Array,"uint16"],[Int16Array,"int16"],[Int32Array,"int32"],[Float64Array,"float64"],[Uint32Array,"uint32"]]),$r=!1,xi=()=>{if(!$r){$r=!0;let e=typeof BigInt64Array<"u"&&BigInt64Array.from,t=typeof BigUint64Array<"u"&&BigUint64Array.from,r=globalThis.Float16Array,i=typeof r<"u"&&r.from;e&&(it.set("int64",BigInt64Array),Bt.set(BigInt64Array,"int64")),t&&(it.set("uint64",BigUint64Array),Bt.set(BigUint64Array,"uint64")),i?(it.set("float16",r),Bt.set(r,"float16")):it.set("float16",Uint16Array)}}}),Si,Ti,ja=I(()=>{vr(),Si=e=>{let t=1;for(let r=0;r<e.length;r++){let i=e[r];if(typeof i!="number"||!Number.isSafeInteger(i))throw new TypeError(`dims[${r}] must be an integer, got: ${i}`);if(i<0)throw new RangeError(`dims[${r}] must be a non-negative integer, got: ${i}`);t*=i}return t},Ti=(e,t)=>{switch(e.location){case"cpu":return new Me(e.type,e.data,t);case"cpu-pinned":return new Me({location:"cpu-pinned",data:e.data,type:e.type,dims:t});case"texture":return new Me({location:"texture",texture:e.texture,type:e.type,dims:t});case"gpu-buffer":return new Me({location:"gpu-buffer",gpuBuffer:e.gpuBuffer,type:e.type,dims:t});case"ml-tensor":return new Me({location:"ml-tensor",mlTensor:e.mlTensor,type:e.type,dims:t});default:throw new Error(`tensorReshape: tensor location ${e.location} is not supported`)}}}),Me,vr=I(()=>{ur(),vi(),Wa(),ja(),Me=class{constructor(e,t,r){xi();let i,a;if(typeof e=="object"&&"location"in e)switch(this.dataLocation=e.location,i=e.type,a=e.dims,e.location){case"cpu-pinned":{let s=it.get(i);if(!s)throw new TypeError(`unsupported type "${i}" to create tensor from pinned buffer`);if(!(e.data instanceof s))throw new TypeError(`buffer should be of type ${s.name}`);this.cpuData=e.data;break}case"texture":{if(i!=="float32")throw new TypeError(`unsupported type "${i}" to create tensor from texture`);this.gpuTextureData=e.texture,this.downloader=e.download,this.disposer=e.dispose;break}case"gpu-buffer":{if(i!=="float32"&&i!=="float16"&&i!=="int32"&&i!=="int64"&&i!=="uint32"&&i!=="uint8"&&i!=="bool"&&i!=="uint4"&&i!=="int4")throw new TypeError(`unsupported type "${i}" to create tensor from gpu buffer`);this.gpuBufferData=e.gpuBuffer,this.downloader=e.download,this.disposer=e.dispose;break}case"ml-tensor":{if(i!=="float32"&&i!=="float16"&&i!=="int32"&&i!=="int64"&&i!=="uint32"&&i!=="uint64"&&i!=="int8"&&i!=="uint8"&&i!=="bool"&&i!=="uint4"&&i!=="int4")throw new TypeError(`unsupported type "${i}" to create tensor from MLTensor`);this.mlTensorData=e.mlTensor,this.downloader=e.download,this.disposer=e.dispose;break}default:throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)}else{let s,o;if(typeof e=="string")if(i=e,o=r,e==="string"){if(!Array.isArray(t))throw new TypeError("A string tensor's data must be a string array.");s=t}else{let u=it.get(e);if(u===void 0)throw new TypeError(`Unsupported tensor type: ${e}.`);if(Array.isArray(t)){if(e==="float16"&&u===Uint16Array||e==="uint4"||e==="int4")throw new TypeError(`Creating a ${e} tensor from number array is not supported. Please use ${u.name} as data.`);e==="uint64"||e==="int64"?s=u.from(t,BigInt):s=u.from(t)}else if(t instanceof u)s=t;else if(t instanceof Uint8ClampedArray)if(e==="uint8")s=Uint8Array.from(t);else throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");else if(e==="float16"&&t instanceof Uint16Array&&u!==Uint16Array)s=new globalThis.Float16Array(t.buffer,t.byteOffset,t.length);else throw new TypeError(`A ${i} tensor's data must be type of ${u}`)}else if(o=t,Array.isArray(e)){if(e.length===0)throw new TypeError("Tensor type cannot be inferred from an empty array.");let u=typeof e[0];if(u==="string")i="string",s=e;else if(u==="boolean")i="bool",s=Uint8Array.from(e);else throw new TypeError(`Invalid element type of data array: ${u}.`)}else if(e instanceof Uint8ClampedArray)i="uint8",s=Uint8Array.from(e);else{let u=Bt.get(e.constructor);if(u===void 0)throw new TypeError(`Unsupported type for tensor data: ${e.constructor}.`);i=u,s=e}if(o===void 0)o=[s.length];else if(!Array.isArray(o))throw new TypeError("A tensor's dims must be a number array");a=o,this.cpuData=s,this.dataLocation="cpu"}let n=Si(a);if(this.cpuData&&n!==this.cpuData.length&&!((i==="uint4"||i==="int4")&&Math.ceil(n/2)===this.cpuData.length))throw new Error(`Tensor's size(${n}) does not match data length(${this.cpuData.length}).`);this.type=i,this.dims=a,this.size=n}static async fromImage(e,t){return $t(e,t)}static fromTexture(e,t){return wr(e,t)}static fromGpuBuffer(e,t){return br(e,t)}static fromMLTensor(e,t){return Be(e,t)}static fromPinnedBuffer(e,t,r){return zt(e,t,r)}toDataURL(e){return We(this,e)}toImageData(e){return yt(this,e)}get data(){if(this.ensureValid(),!this.cpuData)throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");return this.cpuData}get location(){return this.dataLocation}get texture(){if(this.ensureValid(),!this.gpuTextureData)throw new Error("The data is not stored as a WebGL texture.");return this.gpuTextureData}get gpuBuffer(){if(this.ensureValid(),!this.gpuBufferData)throw new Error("The data is not stored as a WebGPU buffer.");return this.gpuBufferData}get mlTensor(){if(this.ensureValid(),!this.mlTensorData)throw new Error("The data is not stored as a WebNN MLTensor.");return this.mlTensorData}async getData(e){switch(this.ensureValid(),this.dataLocation){case"cpu":case"cpu-pinned":return this.data;case"texture":case"gpu-buffer":case"ml-tensor":{if(!this.downloader)throw new Error("The current tensor is not created with a specified data downloader.");if(this.isDownloading)throw new Error("The current tensor is being downloaded.");try{this.isDownloading=!0;let t=await this.downloader();return this.downloader=void 0,this.dataLocation="cpu",this.cpuData=t,e&&this.disposer&&(this.disposer(),this.disposer=void 0),t}finally{this.isDownloading=!1}}default:throw new Error(`cannot get data from location: ${this.dataLocation}`)}}dispose(){if(this.isDownloading)throw new Error("The current tensor is being downloaded.");this.disposer&&(this.disposer(),this.disposer=void 0),this.cpuData=void 0,this.gpuTextureData=void 0,this.gpuBufferData=void 0,this.mlTensorData=void 0,this.downloader=void 0,this.isDownloading=void 0,this.dataLocation="none"}ensureValid(){if(this.dataLocation==="none")throw new Error("The tensor is disposed.")}reshape(e){if(this.ensureValid(),this.downloader||this.disposer)throw new Error("Cannot reshape a tensor that owns GPU resource.");return Ti(this,e)}}}),qe,Ei=I(()=>{vr(),qe=Me}),Ht,xr,et,Xe,dt,pt,ki=I(()=>{Le(),Ht=(e,t)=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||console.timeStamp(`${e}::ORT::${t}`)},xr=(e,t)=>{var a;let r=((a=new Error().stack)==null?void 0:a.split(/\r\n|\r|\n/g))||[],i=!1;for(let n=0;n<r.length;n++){if(i&&!r[n].includes("TRACE_FUNC")){let s=`FUNC_${e}::${r[n].trim().split(" ")[1]}`;t&&(s+=`::${t}`),Ht("CPU",s);return}r[n].includes("TRACE_FUNC")&&(i=!0)}},et=e=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||xr("BEGIN",e)},Xe=e=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||xr("END",e)},dt=e=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||console.time(`ORT::${e}`)},pt=e=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||console.timeEnd(`ORT::${e}`)}}),Ii,Ha=I(()=>{bt(),Ei(),ki(),Ii=class Xp{constructor(t){this.handler=t}async run(t,r,i){et(),dt("InferenceSession.run");let a={},n={};if(typeof t!="object"||t===null||t instanceof qe||Array.isArray(t))throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");let s=!0;if(typeof r=="object"){if(r===null)throw new TypeError("Unexpected argument[1]: cannot be null.");if(r instanceof qe)throw new TypeError("'fetches' cannot be a Tensor");if(Array.isArray(r)){if(r.length===0)throw new TypeError("'fetches' cannot be an empty array.");s=!1;for(let l of r){if(typeof l!="string")throw new TypeError("'fetches' must be a string array or an object.");if(this.outputNames.indexOf(l)===-1)throw new RangeError(`'fetches' contains invalid output name: ${l}.`);a[l]=null}if(typeof i=="object"&&i!==null)n=i;else if(typeof i<"u")throw new TypeError("'options' must be an object.")}else{let l=!1,d=Object.getOwnPropertyNames(r);for(let p of this.outputNames)if(d.indexOf(p)!==-1){let h=r[p];(h===null||h instanceof qe)&&(l=!0,s=!1,a[p]=h)}if(l){if(typeof i=="object"&&i!==null)n=i;else if(typeof i<"u")throw new TypeError("'options' must be an object.")}else n=r}}else if(typeof r<"u")throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");for(let l of this.inputNames)if(typeof t[l]>"u")throw new Error(`input '${l}' is missing in 'feeds'.`);if(s)for(let l of this.outputNames)a[l]=null;let o=await this.handler.run(t,a,n),u={};for(let l in o)if(Object.hasOwnProperty.call(o,l)){let d=o[l];d instanceof qe?u[l]=d:u[l]=new qe(d.type,d.data,d.dims)}return pt("InferenceSession.run"),Xe(),u}async release(){return this.handler.dispose()}static async create(t,r,i,a){et(),dt("InferenceSession.create");let n,s={};if(typeof t=="string"){if(n=t,typeof r=="object"&&r!==null)s=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(t instanceof Uint8Array){if(n=t,typeof r=="object"&&r!==null)s=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(t instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&t instanceof SharedArrayBuffer){let d=t,p=0,h=t.byteLength;if(typeof r=="object"&&r!==null)s=r;else if(typeof r=="number"){if(p=r,!Number.isSafeInteger(p))throw new RangeError("'byteOffset' must be an integer.");if(p<0||p>=d.byteLength)throw new RangeError(`'byteOffset' is out of range [0, ${d.byteLength}).`);if(h=t.byteLength-p,typeof i=="number"){if(h=i,!Number.isSafeInteger(h))throw new RangeError("'byteLength' must be an integer.");if(h<=0||p+h>d.byteLength)throw new RangeError(`'byteLength' is out of range (0, ${d.byteLength-p}].`);if(typeof a=="object"&&a!==null)s=a;else if(typeof a<"u")throw new TypeError("'options' must be an object.")}else if(typeof i<"u")throw new TypeError("'byteLength' must be a number.")}else if(typeof r<"u")throw new TypeError("'options' must be an object.");n=new Uint8Array(d,p,h)}else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");let[o,u]=await je(s),l=await o.createInferenceSessionHandler(n,u);return pt("InferenceSession.create"),Xe(),new Xp(l)}startProfiling(){this.handler.startProfiling()}endProfiling(){this.handler.endProfiling()}get inputNames(){return this.handler.inputNames}get outputNames(){return this.handler.outputNames}get inputMetadata(){return this.handler.inputMetadata}get outputMetadata(){return this.handler.outputMetadata}}}),Sr,Ka=I(()=>{Ha(),Sr=Ii}),Za=I(()=>{}),Qa=I(()=>{}),Xa=I(()=>{}),Ya=I(()=>{}),zi={};be(zi,{InferenceSession:()=>Sr,TRACE:()=>Ht,TRACE_EVENT_BEGIN:()=>dt,TRACE_EVENT_END:()=>pt,TRACE_FUNC_BEGIN:()=>et,TRACE_FUNC_END:()=>Xe,Tensor:()=>qe,env:()=>Y,registerBackend:()=>we});var Ye=I(()=>{Rt(),ut(),Ka(),Ei(),Za(),Qa(),ki(),Xa(),Ya()}),Tr=I(()=>{}),Ci={};be(Ci,{default:()=>Ai});var Er,kr,Ai,Ja=I(()=>{var e;kp(),vt(),Or(),Er="ort-wasm-proxy-worker",kr=((e=globalThis.self)==null?void 0:e.name)===Er,kr&&(self.onmessage=t=>{let{type:r,in:i}=t.data;try{switch(r){case"init-wasm":Mr(i.wasm).then(()=>{Hn(i).then(()=>{postMessage({type:r})},a=>{postMessage({type:r,err:a})})},a=>{postMessage({type:r,err:a})});break;case"init-ep":{let{epName:a,env:n}=i;Kn(n,a).then(()=>{postMessage({type:r})},s=>{postMessage({type:r,err:s})});break}case"copy-from":{let{buffer:a}=i,n=Ua(a);postMessage({type:r,out:n});break}case"create":{let{model:a,options:n}=i;Qn(a,n).then(s=>{postMessage({type:r,out:s})},s=>{postMessage({type:r,err:s})});break}case"release":Xn(i),postMessage({type:r});break;case"run":{let{sessionId:a,inputIndices:n,inputs:s,outputIndices:o,options:u}=i;Jn(a,n,s,o,new Array(o.length).fill(null),u).then(l=>{l.some(d=>d[3]!=="cpu")?postMessage({type:r,err:"Proxy does not support non-cpu tensor location."}):postMessage({type:r,out:l},ts([...s,...l]))},l=>{postMessage({type:r,err:l})});break}case"end-profiling":es(i),postMessage({type:r});break;default:}}catch(a){postMessage({type:r,err:a})}}),Ai=kr?null:t=>new Worker(t??De,{type:"classic",name:Er})}),Oi,Ri,De,Ir,tr,Bi,Mi,zr,Di,Cr,Pi,Ar,Ui,Or=I(()=>{Tr(),Oi=typeof location>"u"?void 0:location.origin,Ri=()=>{var e,t;return typeof document<"u"?(e=document.currentScript)==null?void 0:e.src:typeof self<"u"?(t=self.location)==null?void 0:t.href:void 0},De=Ri(),Ir=()=>{if(De&&!De.startsWith("blob:"))return De.substring(0,De.lastIndexOf("/")+1)},tr=(e,t)=>{try{let r=t??De;return(r?new URL(e,r):new URL(e)).origin===Oi}catch{return!1}},Bi=(e,t)=>{let r=t??De;try{return(r?new URL(e,r):new URL(e)).href}catch{return}},Mi=(e,t)=>`${t??"./"}${e}`,zr=async e=>{let t=await(await fetch(e,{credentials:"same-origin"})).blob();return URL.createObjectURL(t)},Di=async e=>(await import(e)).default,Cr=(Ja(),Ve(Ci)).default,Pi=async()=>{if(!De)throw new Error("Failed to load proxy worker: cannot determine the script source URL.");if(tr(De))return[void 0,Cr()];let e=await zr(De);return[e,Cr(e)]},Ar=void 0,Ui=async(e,t,r,i)=>{let a=Ar&&!(e||t);if(a)if(De)a=tr(De)||i&&!r;else if(i&&!r)a=!0;else throw new Error("cannot determine the script source URL.");if(a)return[void 0,Ar];{let n="ort-wasm-simd-threaded.jsep.mjs",s=e??Bi(n,t),o=r&&s&&!tr(s,t),u=o?await zr(s):s??Mi(n,t);return[o?u:void 0,await Di(u)]}}}),Rr,rr,Mt,Br,Ni,Li,Vi,Mr,pe,vt=I(()=>{Or(),rr=!1,Mt=!1,Br=!1,Ni=()=>{if(typeof SharedArrayBuffer>"u")return!1;try{return typeof MessageChannel<"u"&&new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)),WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]))}catch{return!1}},Li=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,30,1,28,0,65,0,253,15,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,186,1,26,11]))}catch{return!1}},Vi=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,19,1,17,0,65,1,253,15,65,2,253,15,65,3,253,15,253,147,2,11]))}catch{return!1}},Mr=async e=>{if(rr)return Promise.resolve();if(Mt)throw new Error("multiple calls to 'initializeWebAssembly()' detected.");if(Br)throw new Error("previous call to 'initializeWebAssembly()' failed.");Mt=!0;let t=e.initTimeout,r=e.numThreads;if(e.simd!==!1){if(e.simd==="relaxed"){if(!Vi())throw new Error("Relaxed WebAssembly SIMD is not supported in the current environment.")}else if(!Li())throw new Error("WebAssembly SIMD is not supported in the current environment.")}let i=Ni();r>1&&!i&&(typeof self<"u"&&!self.crossOriginIsolated&&console.warn("env.wasm.numThreads is set to "+r+", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."),console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."),e.numThreads=r=1);let a=e.wasmPaths,n=typeof a=="string"?a:void 0,s=a==null?void 0:a.mjs,o=(s==null?void 0:s.href)??s,u=a==null?void 0:a.wasm,l=(u==null?void 0:u.href)??u,d=e.wasmBinary,[p,h]=await Ui(o,n,r>1,!!d||!!l),f=!1,m=[];if(t>0&&m.push(new Promise(_=>{setTimeout(()=>{f=!0,_()},t)})),m.push(new Promise((_,$)=>{let w={numThreads:r};if(d)w.wasmBinary=d,w.locateFile=y=>y;else if(l||n)w.locateFile=y=>l??n+y;else if(o&&o.indexOf("blob:")!==0)w.locateFile=y=>new URL(y,o).href;else if(p){let y=Ir();y&&(w.locateFile=S=>y+S)}h(w).then(y=>{Mt=!1,rr=!0,Rr=y,_(),p&&URL.revokeObjectURL(p)},y=>{Mt=!1,Br=!0,$(y)})})),await Promise.race(m),f)throw new Error(`WebAssembly backend initializing failed due to timeout: ${t}ms`)},pe=()=>{if(rr&&Rr)return Rr;throw new Error("WebAssembly is not initialized yet.")}}),Ge,ir,se,Dr=I(()=>{vt(),Ge=(e,t)=>{let r=pe(),i=r.lengthBytesUTF8(e)+1,a=r._malloc(i);return r.stringToUTF8(e,a,i),t.push(a),a},ir=(e,t,r,i)=>{if(typeof e=="object"&&e!==null){if(r.has(e))throw new Error("Circular reference in options");r.add(e)}Object.entries(e).forEach(([a,n])=>{let s=t?t+a:a;if(typeof n=="object")ir(n,s+".",r,i);else if(typeof n=="string"||typeof n=="number")i(s,n.toString());else if(typeof n=="boolean")i(s,n?"1":"0");else throw new Error(`Can't handle extra config type: ${typeof n}`)})},se=e=>{let t=pe(),r=t.stackSave();try{let i=t.PTR_SIZE,a=t.stackAlloc(2*i);t._OrtGetLastError(a,a+i);let n=Number(t.getValue(a,i===4?"i32":"i64")),s=t.getValue(a+i,"*"),o=s?t.UTF8ToString(s):"";throw new Error(`${e} ERROR_CODE: ${n}, ERROR_MESSAGE: ${o}`)}finally{t.stackRestore(r)}}}),Fi,en=I(()=>{vt(),Dr(),Fi=e=>{let t=pe(),r=0,i=[],a=e||{};try{if((e==null?void 0:e.logSeverityLevel)===void 0)a.logSeverityLevel=2;else if(typeof e.logSeverityLevel!="number"||!Number.isInteger(e.logSeverityLevel)||e.logSeverityLevel<0||e.logSeverityLevel>4)throw new Error(`log severity level is not valid: ${e.logSeverityLevel}`);if((e==null?void 0:e.logVerbosityLevel)===void 0)a.logVerbosityLevel=0;else if(typeof e.logVerbosityLevel!="number"||!Number.isInteger(e.logVerbosityLevel))throw new Error(`log verbosity level is not valid: ${e.logVerbosityLevel}`);(e==null?void 0:e.terminate)===void 0&&(a.terminate=!1);let n=0;return(e==null?void 0:e.tag)!==void 0&&(n=Ge(e.tag,i)),r=t._OrtCreateRunOptions(a.logSeverityLevel,a.logVerbosityLevel,!!a.terminate,n),r===0&&se("Can't create run options."),(e==null?void 0:e.extra)!==void 0&&ir(e.extra,"",new WeakSet,(s,o)=>{let u=Ge(s,i),l=Ge(o,i);t._OrtAddRunConfigEntry(r,u,l)!==0&&se(`Can't set a run config entry: ${s} - ${o}.`)}),[r,i]}catch(n){throw r!==0&&t._OrtReleaseRunOptions(r),i.forEach(s=>t._free(s)),n}}}),qi,Gi,Wi,_t,ji,Hi,tn=I(()=>{vt(),Dr(),qi=e=>{switch(e){case"disabled":return 0;case"basic":return 1;case"extended":return 2;case"layout":return 3;case"all":return 99;default:throw new Error(`unsupported graph optimization level: ${e}`)}},Gi=e=>{switch(e){case"sequential":return 0;case"parallel":return 1;default:throw new Error(`unsupported execution mode: ${e}`)}},Wi=e=>{e.extra||(e.extra={}),e.extra.session||(e.extra.session={});let t=e.extra.session;t.use_ort_model_bytes_directly||(t.use_ort_model_bytes_directly="1"),e.executionProviders&&e.executionProviders.some(r=>(typeof r=="string"?r:r.name)==="webgpu")&&(e.enableMemPattern=!1)},_t=(e,t,r,i)=>{let a=Ge(t,i),n=Ge(r,i);pe()._OrtAddSessionConfigEntry(e,a,n)!==0&&se(`Can't set a session config entry: ${t} - ${r}.`)},ji=async(e,t,r)=>{let i=t.executionProviders;for(let a of i){let n=typeof a=="string"?a:a.name,s=[];switch(n){case"webnn":if(n="WEBNN",_t(e,"session.disable_quant_qdq","1",r),_t(e,"session.disable_qdq_constant_folding","1",r),typeof a!="string"){let p=a==null?void 0:a.deviceType;p&&_t(e,"deviceType",p,r)}break;case"webgpu":if(n="JS",typeof a!="string"){let p=a;if(p!=null&&p.preferredLayout){if(p.preferredLayout!=="NCHW"&&p.preferredLayout!=="NHWC")throw new Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${p.preferredLayout}`);_t(e,"preferredLayout",p.preferredLayout,r)}}break;case"wasm":case"cpu":continue;default:throw new Error(`not supported execution provider: ${n}`)}let o=Ge(n,r),u=s.length,l=0,d=0;if(u>0){l=pe()._malloc(u*pe().PTR_SIZE),r.push(l),d=pe()._malloc(u*pe().PTR_SIZE),r.push(d);for(let p=0;p<u;p++)pe().setValue(l+p*pe().PTR_SIZE,s[p][0],"*"),pe().setValue(d+p*pe().PTR_SIZE,s[p][1],"*")}await pe()._OrtAppendExecutionProvider(e,o,l,d,u)!==0&&se(`Can't append execution provider: ${n}.`)}},Hi=async e=>{let t=pe(),r=0,i=[],a=e||{};Wi(a);try{let n=qi(a.graphOptimizationLevel??"all"),s=Gi(a.executionMode??"sequential"),o=typeof a.logId=="string"?Ge(a.logId,i):0,u=a.logSeverityLevel??2;if(!Number.isInteger(u)||u<0||u>4)throw new Error(`log severity level is not valid: ${u}`);let l=a.logVerbosityLevel??0;if(!Number.isInteger(l)||l<0||l>4)throw new Error(`log verbosity level is not valid: ${l}`);let d=typeof a.optimizedModelFilePath=="string"?Ge(a.optimizedModelFilePath,i):0;if(r=t._OrtCreateSessionOptions(n,!!a.enableCpuMemArena,!!a.enableMemPattern,s,!!a.enableProfiling,0,o,u,l,d),r===0&&se("Can't create session options."),a.executionProviders&&await ji(r,a,i),a.enableGraphCapture!==void 0){if(typeof a.enableGraphCapture!="boolean")throw new Error(`enableGraphCapture must be a boolean value: ${a.enableGraphCapture}`);_t(r,"enableGraphCapture",a.enableGraphCapture.toString(),i)}if(a.freeDimensionOverrides)for(let[p,h]of Object.entries(a.freeDimensionOverrides)){if(typeof p!="string")throw new Error(`free dimension override name must be a string: ${p}`);if(typeof h!="number"||!Number.isInteger(h)||h<0)throw new Error(`free dimension override value must be a non-negative integer: ${h}`);let f=Ge(p,i);t._OrtAddFreeDimensionOverride(r,f,h)!==0&&se(`Can't set a free dimension override: ${p} - ${h}.`)}return a.extra!==void 0&&ir(a.extra,"",new WeakSet,(p,h)=>{_t(r,p,h,i)}),[r,i]}catch(n){throw r!==0&&t._OrtReleaseSessionOptions(r)!==0&&se("Can't release session options."),i.forEach(s=>t._free(s)),n}}}),xt,St,Tt,Pr,Ur,Nr,Lr,ii,le=I(()=>{xt=e=>{switch(e){case"int8":return 3;case"uint8":return 2;case"bool":return 9;case"int16":return 5;case"uint16":return 4;case"int32":return 6;case"uint32":return 12;case"float16":return 10;case"float32":return 1;case"float64":return 11;case"string":return 8;case"int64":return 7;case"uint64":return 13;case"int4":return 22;case"uint4":return 21;default:throw new Error(`unsupported data type: ${e}`)}},St=e=>{switch(e){case 3:return"int8";case 2:return"uint8";case 9:return"bool";case 5:return"int16";case 4:return"uint16";case 6:return"int32";case 12:return"uint32";case 10:return"float16";case 1:return"float32";case 11:return"float64";case 8:return"string";case 7:return"int64";case 13:return"uint64";case 22:return"int4";case 21:return"uint4";default:throw new Error(`unsupported data type: ${e}`)}},Tt=(e,t)=>{let r=[-1,4,1,1,2,2,4,8,-1,1,2,8,4,8,-1,-1,-1,-1,-1,-1,-1,.5,.5][e],i=typeof t=="number"?t:t.reduce((a,n)=>a*n,1);return r>0?Math.ceil(i*r):void 0},Pr=e=>{switch(e){case"float16":return typeof Float16Array<"u"&&Float16Array.from?Float16Array:Uint16Array;case"float32":return Float32Array;case"uint8":return Uint8Array;case"int8":return Int8Array;case"uint16":return Uint16Array;case"int16":return Int16Array;case"int32":return Int32Array;case"bool":return Uint8Array;case"float64":return Float64Array;case"uint32":return Uint32Array;case"int64":return BigInt64Array;case"uint64":return BigUint64Array;default:throw new Error(`unsupported type: ${e}`)}},Ur=e=>{switch(e){case"verbose":return 0;case"info":return 1;case"warning":return 2;case"error":return 3;case"fatal":return 4;default:throw new Error(`unsupported logging level: ${e}`)}},Nr=e=>e==="float32"||e==="float16"||e==="int32"||e==="int64"||e==="uint32"||e==="uint8"||e==="bool"||e==="uint4"||e==="int4",Lr=e=>e==="float32"||e==="float16"||e==="int32"||e==="int64"||e==="uint32"||e==="uint64"||e==="int8"||e==="uint8"||e==="bool"||e==="uint4"||e==="int4",ii=e=>{switch(e){case"none":return 0;case"cpu":return 1;case"cpu-pinned":return 2;case"texture":return 3;case"gpu-buffer":return 4;case"ml-tensor":return 5;default:throw new Error(`unsupported data location: ${e}`)}}}),Vr,Ki=I(()=>{Tr(),Vr=async e=>{if(typeof e=="string"){let t=await fetch(e);if(!t.ok)throw new Error(`failed to load external data file: ${e}`);let r=t.headers.get("Content-Length"),i=r?parseInt(r,10):0;if(i<1073741824)return new Uint8Array(await t.arrayBuffer());{if(!t.body)throw new Error(`failed to load external data file: ${e}, no response body.`);let a=t.body.getReader(),n;try{n=new ArrayBuffer(i)}catch(o){if(o instanceof RangeError){let u=Math.ceil(i/65536);n=new WebAssembly.Memory({initial:u,maximum:u}).buffer}else throw o}let s=0;for(;;){let{done:o,value:u}=await a.read();if(o)break;let l=u.byteLength;new Uint8Array(n,s,l).set(u),s+=l}return new Uint8Array(n,0,i)}}else return e instanceof Blob?new Uint8Array(await e.arrayBuffer()):e instanceof Uint8Array?e:new Uint8Array(e)}}),Zi,ai,ni,Kt,si,oi,xe,kt=I(()=>{le(),Zi=["V","I","W","E","F"],ai=(e,t)=>{console.log(`[${Zi[e]},${new Date().toISOString()}]${t}`)},si=(e,t)=>{ni=e,Kt=t},oi=(e,t)=>{let r=Ur(e),i=Ur(ni);r>=i&&ai(r,typeof t=="function"?t():t)},xe=(...e)=>{Kt&&oi(...e)}}),ui,Zt,D,lr,li,Qi,Dt,te=I(()=>{ui=class{static calcMatMulShape(e,t){return e[1]!==t[0]?void 0:[e[0],t[1]]}},Zt=class{static calcShape(e,t,r=!1){let i=e.length,a=t.length;if(i===0)return t;if(a===0)return e;let n=Math.max(e.length,t.length),s=new Array(n);if(r){if(i<2||a<2)return;let o=ui.calcMatMulShape([e[i-2],e[i-1]],[t[a-2],t[a-1]]);if(o===void 0)return;[s[n-2],s[n-1]]=o}for(let o=r?3:1;o<=n;o++){let u=i-o<0?1:e[i-o],l=a-o<0?1:t[a-o];if(u!==l&&u>1&&l>1)return;let d=Math.max(u,l);if(u&&l)s[n-o]=Math.max(u,l);else{if(d>1)return;s[n-o]=0}}return s}static isValidBroadcast(e,t){let r=e.length,i=t.length;if(r>i)return!1;for(let a=1;a<=r;a++)if(e[r-a]!==1&&e[r-a]!==t[i-a])return!1;return!0}},D=class Fa{static size(t){return Fa.getSizeFromDimensionRange(t,0,t.length)}static convertShape(t,r=4){let i=t.length;if(i===0)return[];let a=new Array(i),n=i-1;for(;n>=0;){if(t[n]%r===0){a[n]=t[n]/r;break}if(r%t[n]!==0)throw new Error("cannot convert shape");a[n]=1,r/=t[n],n--}for(n--;n>=0;n--)a[n]=t[n];return a}static sizeFromDimension(t,r){if(r<0||r>t.length)throw new Error(`invalid dimension of ${r} for sizeFromDimension as Tensor has ${t.length} dimensions.`);return Fa.getSizeFromDimensionRange(t,r,t.length)}static sizeToDimension(t,r){if(r<0||r>t.length)throw new Error(`invalid dimension of ${r} for sizeToDimension as Tensor has ${t.length} dimensions.`);return Fa.getSizeFromDimensionRange(t,0,r)}static getSizeFromDimensionRange(t,r,i){let a=1;for(let n=r;n<i;n++){if(t[n]<0)throw new Error("cannot get valid size from specified dimension range. Most likely the range contains negative values in them.");a*=Number(t[n])}return a}static computeStrides(t){let r=t.length;if(r===0)return[];if(r===1)return[1];let i=new Array(r);i[r-1]=1,i[r-2]=t[r-1];for(let a=r-3;a>=0;--a)i[a]=i[a+1]*t[a+1];return i}static normalizeAxis(t,r){if(t<-r&&t>=r)throw new Error("unsupported axis for this operation.");return t<0?t+r:t}static normalizeAxes(t,r){return t.map(i=>this.normalizeAxis(i,r??t.length))}static sortBasedOnPerm(t,r){return r?r.map(i=>t[i]):t.slice().reverse()}static padShape(t,r){let i=t.length;return t.map((a,n)=>a+r[n]+r[n+i])}static areEqual(t,r){return t.length!==r.length?!1:t.every((i,a)=>i===r[a])}},lr=class ba{static adjustPoolAttributes(t,r,i,a,n,s){if(!t&&i.length!==r.length-2)throw new Error("length of specified kernel shapes should be 2 less than length of input dimensions");if(t)for(let o=0;o<r.length-2;o++)o>=i.length?i.push(r[o+2]):i[o]=r[o+2];for(let o=0;o<i.length;o++)if(o<a.length){if(a[o]<0)throw new Error("strides should be greater than or equal to 1")}else a.push(1);for(let o=0;o<i.length;o++)if(o<n.length){if(n[o]<0)throw new Error("dilations should be greater than or equal to 1")}else n.push(1);for(let o=0;o<i.length*2;o++)if(o<s.length){if(s[o]<0)throw new Error("pad should be greater than or equal to 1")}else s.push(0);for(let o=0;o<i.length;o++){if(i[o]<=0)throw new Error("kernel shapes need to be greater than 0");if(s[o]>=i[o]||s[o+i.length]>=i[o])throw new Error("pads should be smaller than kernel")}}static adjustPadsBasedOnAutoPad(t,r,i,a,n,s,o){if(o){if(n.length!==2*(t.length-2))throw new Error("length of pads should be twice the length of data dimensions");if(r.length!==t.length-2)throw new Error("length of strides should be the length of data dimensions");if(a.length!==t.length-2)throw new Error("length of kernel shapes should be the length of data dimensions");for(let u=0;u<t.length-2;u++)ba.adjustPadAndReturnShape(t[u+(s?1:2)],r[u],i[u],a[u],n,u,u+t.length-2,o)}}static computePoolOutputShape(t,r,i,a,n,s,o){if(r.length<=0)throw new Error("input shape must be of size greater than 0");let u=[r[0],r[1]];return ba.computeShapeHelper(t,r,u,i,a,n,s,o),u}static computeConvOutputShape(t,r,i,a,n,s,o){if(t.length<=0||r.length<=0)throw new Error("invalid input tensor dims or invalid filter tensor dims");let u=[t[0],r[0]];return ba.computeShapeHelper(!1,t,u,i,a,n,s,o),u}static computeShapeHelper(t,r,i,a,n,s,o,u){if(t)for(let l=0;l<r.length-2;l++)i.push(1);else for(let l=0;l<r.length-2;l++)i.push(ba.adjustPadAndReturnShape(r[l+2],a[l],n[l],s[l],o,l,l+r.length-2,u))}static adjustPadAndReturnShape(t,r,i,a,n,s,o,u){let l=i*(a-1)+1;if(u&&u!=="NOTSET")switch(u){case"VALID":return n[s]=0,n[o]=0,Math.floor((t-l)/r+1);case"SAME_LOWER":case"SAME_UPPER":if(i!==1)throw new Error("Dilation not supported for SAME_UPPER or SAME_LOWER");{let d=((t+r-1)/r-1)*r+a-t;return n[s]=Math.floor(u==="SAME_LOWER"?(d+1)/2:d/2),n[o]=d-n[s],Math.floor((t+d-a)/r+1)}default:throw new Error("Unsupported AutoPad type")}else return Math.floor((t+n[s]+n[o]-l)/r+1)}},li=class{static getShapeOfGemmResult(e,t,r,i,a){if(e.length!==2||r.length!==2)throw new Error("shape need to be of size 2");let n,s,o;t?(n=e[1],s=e[0]):(n=e[0],s=e[1]);let u=-1;if(i?(o=r[0],u=1):(o=r[1],u=0),r[u]!==s)throw new Error("dimension mismatch");if(n<=0||o<=0||s<=0)throw new Error("invalid shape specified");if(a&&!Zt.isValidBroadcast(a,[n,o]))throw new Error("gemm: invalid bias shape for broadcast");return[n,o,s]}},Qi=-34028234663852886e22,Dt=34028234663852886e22}),Qt,dr=I(()=>{le(),Qt=(e,t)=>new(Pr(t))(e)}),ar,pr,Fr,qr,Pt,Xt,di,pi,ci,Xi,Yi,xa=I(()=>{le(),kt(),ar=new Map([["float32",32],["float16",16],["int32",32],["uint32",32],["int64",64],["uint64",64],["int8",8],["uint8",8],["int4",4],["uint4",4]]),pr=(e,t)=>{if(t==="int32")return e;let r=ar.get(t);if(!r)throw new Error(`WebNN backend does not support data type: ${t}`);let i=r/8;if(e.byteLength%i!==0)throw new Error(`Invalid Uint8Array length - must be a multiple of ${i}.`);let a=e.byteLength/i,n=new(Pr(t))(e.buffer,e.byteOffset,a);switch(t){case"int64":case"uint64":{let s=new Int32Array(a);for(let o=0;o<a;o++){let u=n[o];if(u>2147483647n||u<-2147483648n)throw new Error("Can not convert int64 data to int32 - value out of range.");s[o]=Number(u)}return new Uint8Array(s.buffer)}case"int8":case"uint8":case"uint32":{if(t==="uint32"&&n.some(o=>o>2147483647))throw new Error("Can not convert uint32 data to int32 - value out of range.");let s=Int32Array.from(n,Number);return new Uint8Array(s.buffer)}default:throw new Error(`Unsupported data conversion from ${t} to 'int32'`)}},Fr=(e,t)=>{if(t==="int32")return e;if(e.byteLength%4!==0)throw new Error("Invalid Uint8Array length - must be a multiple of 4 (int32).");let r=e.byteLength/4,i=new Int32Array(e.buffer,e.byteOffset,r);switch(t){case"int64":{let a=BigInt64Array.from(i,BigInt);return new Uint8Array(a.buffer)}case"uint64":{if(i.some(n=>n<0))throw new Error("Can not convert int32 data to uin64 - negative value found.");let a=BigUint64Array.from(i,BigInt);return new Uint8Array(a.buffer)}case"int8":{if(i.some(n=>n<-128||n>127))throw new Error("Can not convert int32 data to int8 - value out of range.");let a=Int8Array.from(i,Number);return new Uint8Array(a.buffer)}case"uint8":{if(i.some(a=>a<0||a>255))throw new Error("Can not convert int32 data to uint8 - value out of range.");return Uint8Array.from(i,Number)}case"uint32":{if(i.some(n=>n<0))throw new Error("Can not convert int32 data to uint32 - negative value found.");let a=Uint32Array.from(i,Number);return new Uint8Array(a.buffer)}default:throw new Error(`Unsupported data conversion from 'int32' to ${t}`)}},qr=1,Pt=()=>qr++,Xt=new Map([["int8","int32"],["uint8","int32"],["uint32","int32"],["int64","int32"]]),di=(e,t)=>{let r=ar.get(e);if(!r)throw new Error(`WebNN backend does not support data type: ${e}`);return t.length>0?Math.ceil(t.reduce((i,a)=>i*a)*r/8):0},pi=class{constructor(e){this.isDataConverted=!1;let{sessionId:t,context:r,tensor:i,dataType:a,shape:n,fallbackDataType:s}=e;this.sessionId=t,this.mlContext=r,this.mlTensor=i,this.dataType=a,this.tensorShape=n,this.fallbackDataType=s}get tensor(){return this.mlTensor}get type(){return this.dataType}get fallbackType(){return this.fallbackDataType}get shape(){return this.tensorShape}get byteLength(){return di(this.dataType,this.tensorShape)}destroy(){xe("verbose",()=>"[WebNN] TensorWrapper.destroy"),this.mlTensor.destroy()}write(e){this.mlContext.writeTensor(this.mlTensor,e)}async read(e){if(this.fallbackDataType){let t=await this.mlContext.readTensor(this.mlTensor),r=Fr(new Uint8Array(t),this.dataType);if(e){(e instanceof ArrayBuffer?new Uint8Array(e):new Uint8Array(e.buffer,e.byteOffset,e.byteLength)).set(r);return}else return r.buffer}else return e?this.mlContext.readTensor(this.mlTensor,e):this.mlContext.readTensor(this.mlTensor)}canReuseTensor(e,t,r){return this.mlContext===e&&this.dataType===t&&this.tensorShape.length===r.length&&this.tensorShape.every((i,a)=>i===r[a])}setIsDataConverted(e){this.isDataConverted=e}},ci=class{constructor(e,t){this.tensorManager=e,this.wrapper=t}get tensorWrapper(){return this.wrapper}releaseTensor(){this.tensorWrapper&&(this.tensorManager.releaseTensor(this.tensorWrapper),this.wrapper=void 0)}async ensureTensor(e,t,r,i){let a=this.tensorManager.getMLContext(e),n=this.tensorManager.getMLOpSupportLimits(e),s;if(!(n!=null&&n.input.dataTypes.includes(t))){if(s=Xt.get(t),!s||(n==null?void 0:n.input.dataTypes.includes(s)))throw new Error(`WebNN backend does not support data type: ${t}`);xe("verbose",()=>`[WebNN] TensorIdTracker.ensureTensor: fallback dataType from ${t} to ${s}`)}if(this.wrapper){if(this.wrapper.canReuseTensor(a,t,r))return this.wrapper.tensor;if(i){if(this.wrapper.byteLength!==di(t,r))throw new Error("Unable to copy data to tensor with different size.");this.activeUpload=new Uint8Array(await this.wrapper.read())}this.tensorManager.releaseTensor(this.wrapper)}let o=typeof MLTensorUsage>"u"?void 0:MLTensorUsage.READ|MLTensorUsage.WRITE;return this.wrapper=await this.tensorManager.getCachedTensor(e,t,r,o,!0,!0,s),i&&this.activeUpload&&(this.wrapper.write(this.activeUpload),this.activeUpload=void 0),this.wrapper.tensor}upload(e){let t=e;if(this.wrapper){if(this.wrapper.fallbackType)if(this.wrapper.fallbackType==="int32")t=pr(e,this.wrapper.type),this.wrapper.setIsDataConverted(!0);else throw new Error(`Unsupported fallback data type: ${this.wrapper.fallbackType}`);if(e.byteLength===this.wrapper.byteLength){this.wrapper.write(t);return}else xe("verbose",()=>"Data size does not match tensor size. Releasing tensor."),this.releaseTensor()}this.activeUpload?this.activeUpload.set(t):this.activeUpload=new Uint8Array(t)}async download(e){var t,r;if(this.activeUpload){let i=(t=this.wrapper)!=null&&t.isDataConverted?Fr(this.activeUpload,(r=this.wrapper)==null?void 0:r.type):this.activeUpload;if(e){e instanceof ArrayBuffer?new Uint8Array(e).set(i):new Uint8Array(e.buffer,e.byteOffset,e.byteLength).set(i);return}else return i.buffer}if(!this.wrapper)throw new Error("Tensor has not been created.");return e?this.wrapper.read(e):this.wrapper.read()}},Xi=class{constructor(e){this.backend=e,this.tensorTrackersById=new Map,this.freeTensors=[],this.externalTensors=new Set}getMLContext(e){let t=this.backend.getMLContext(e);if(!t)throw new Error("MLContext not found for session.");return t}getMLOpSupportLimits(e){return this.backend.getMLOpSupportLimits(e)}reserveTensorId(){let e=Pt();return this.tensorTrackersById.set(e,new ci(this)),e}releaseTensorId(e){let t=this.tensorTrackersById.get(e);t&&(this.tensorTrackersById.delete(e),t.tensorWrapper&&this.releaseTensor(t.tensorWrapper))}async ensureTensor(e,t,r,i,a){xe("verbose",()=>`[WebNN] TensorManager.ensureTensor {tensorId: ${t}, dataType: ${r}, shape: ${i}, copyOld: ${a}}`);let n=this.tensorTrackersById.get(t);if(!n)throw new Error("Tensor not found.");return n.ensureTensor(e,r,i,a)}upload(e,t){let r=this.tensorTrackersById.get(e);if(!r)throw new Error("Tensor not found.");r.upload(t)}async download(e,t){xe("verbose",()=>`[WebNN] TensorManager.download {tensorId: ${e}, dstBuffer: ${t==null?void 0:t.byteLength}}`);let r=this.tensorTrackersById.get(e);if(!r)throw new Error("Tensor not found.");return r.download(t)}releaseTensorsForSession(e){for(let t of this.freeTensors)t.sessionId===e&&t.destroy();this.freeTensors=this.freeTensors.filter(t=>t.sessionId!==e)}registerTensor(e,t,r,i){let a=this.getMLContext(e),n=Pt(),s=new pi({sessionId:e,context:a,tensor:t,dataType:r,shape:i});return this.tensorTrackersById.set(n,new ci(this,s)),this.externalTensors.add(s),n}async getCachedTensor(e,t,r,i,a,n,s){let o=this.getMLContext(e);for(let[l,d]of this.freeTensors.entries())if(d.canReuseTensor(o,t,r)){xe("verbose",()=>`[WebNN] Reusing tensor {dataType: ${t}, ${s?`fallbackDataType: ${s},`:""} shape: ${r}`);let p=this.freeTensors.splice(l,1)[0];return p.sessionId=e,p}xe("verbose",()=>`[WebNN] MLContext.createTensor {dataType: ${t}, ${s?`fallbackDataType: ${s},`:""} shape: ${r}}`);let u=await o.createTensor({dataType:s??t,shape:r,dimensions:r,usage:i,writable:a,readable:n});return new pi({sessionId:e,context:o,tensor:u,dataType:t,shape:r,fallbackDataType:s})}releaseTensor(e){this.externalTensors.has(e)&&this.externalTensors.delete(e),this.freeTensors.push(e)}},Yi=(...e)=>new Xi(...e)}),cr,Ji,ea,ta=I(()=>{le(),vt(),dr(),xa(),kt(),cr=new Map([[1,"float32"],[10,"float16"],[6,"int32"],[12,"uint32"],[7,"int64"],[13,"uint64"],[22,"int4"],[21,"uint4"],[3,"int8"],[2,"uint8"],[9,"uint8"]]),Ji=(e,t)=>{if(e===t)return!0;if(e===void 0||t===void 0)return!1;let r=Object.keys(e).sort(),i=Object.keys(t).sort();return r.length===i.length&&r.every((a,n)=>a===i[n]&&e[a]===t[a])},ea=class{constructor(e){this.tensorManager=Yi(this),this.mlContextBySessionId=new Map,this.sessionIdsByMLContext=new Map,this.mlContextCache=[],this.sessionGraphInputs=new Map,this.sessionGraphOutputs=new Map,this.temporaryGraphInputs=[],this.temporaryGraphOutputs=[],this.temporarySessionTensorIds=new Map,this.mlOpSupportLimitsBySessionId=new Map,si(e.logLevel,!!e.debug)}get currentSessionId(){if(this.activeSessionId===void 0)throw new Error("No active session");return this.activeSessionId}onRunStart(e){xe("verbose",()=>`[WebNN] onRunStart {sessionId: ${e}}`),this.activeSessionId=e}onRunEnd(e){xe("verbose",()=>`[WebNN] onRunEnd {sessionId: ${e}}`);let t=this.temporarySessionTensorIds.get(e);if(t){for(let r of t)xe("verbose",()=>`[WebNN] releasing temporary tensor {tensorId: ${r}}`),this.tensorManager.releaseTensorId(r);this.temporarySessionTensorIds.delete(e),this.activeSessionId=void 0}}async createMLContext(e){if(e instanceof GPUDevice){let r=this.mlContextCache.findIndex(i=>i.gpuDevice===e);if(r!==-1)return this.mlContextCache[r].mlContext;{let i=await navigator.ml.createContext(e);return this.mlContextCache.push({gpuDevice:e,mlContext:i}),i}}else if(e===void 0){let r=this.mlContextCache.findIndex(i=>i.options===void 0&&i.gpuDevice===void 0);if(r!==-1)return this.mlContextCache[r].mlContext;{let i=await navigator.ml.createContext();return this.mlContextCache.push({mlContext:i}),i}}let t=this.mlContextCache.findIndex(r=>Ji(r.options,e));if(t!==-1)return this.mlContextCache[t].mlContext;{let r=await navigator.ml.createContext(e);return this.mlContextCache.push({options:e,mlContext:r}),r}}registerMLContext(e,t){this.mlContextBySessionId.set(e,t);let r=this.sessionIdsByMLContext.get(t);r||(r=new Set,this.sessionIdsByMLContext.set(t,r)),r.add(e),this.mlOpSupportLimitsBySessionId.has(e)||this.mlOpSupportLimitsBySessionId.set(e,t.opSupportLimits()),this.temporaryGraphInputs.length>0&&(this.sessionGraphInputs.set(e,this.temporaryGraphInputs),this.temporaryGraphInputs=[]),this.temporaryGraphOutputs.length>0&&(this.sessionGraphOutputs.set(e,this.temporaryGraphOutputs),this.temporaryGraphOutputs=[])}onReleaseSession(e){this.sessionGraphInputs.delete(e),this.sessionGraphOutputs.delete(e);let t=this.mlContextBySessionId.get(e);if(!t)return;this.tensorManager.releaseTensorsForSession(e),this.mlContextBySessionId.delete(e),this.mlOpSupportLimitsBySessionId.delete(e);let r=this.sessionIdsByMLContext.get(t);if(r.delete(e),r.size===0){this.sessionIdsByMLContext.delete(t);let i=this.mlContextCache.findIndex(a=>a.mlContext===t);i!==-1&&this.mlContextCache.splice(i,1)}}getMLContext(e){return this.mlContextBySessionId.get(e)}getMLOpSupportLimits(e){return this.mlOpSupportLimitsBySessionId.get(e)}reserveTensorId(){return this.tensorManager.reserveTensorId()}releaseTensorId(e){xe("verbose",()=>`[WebNN] releaseTensorId {tensorId: ${e}}`),this.tensorManager.releaseTensorId(e)}async ensureTensor(e,t,r,i,a){let n=cr.get(r);if(!n)throw new Error(`Unsupported ONNX data type: ${r}`);return this.tensorManager.ensureTensor(e??this.currentSessionId,t,n,i,a)}async createTemporaryTensor(e,t,r){xe("verbose",()=>`[WebNN] createTemporaryTensor {onnxDataType: ${t}, shape: ${r}}`);let i=cr.get(t);if(!i)throw new Error(`Unsupported ONNX data type: ${t}`);let a=this.tensorManager.reserveTensorId();await this.tensorManager.ensureTensor(e,a,i,r,!1);let n=this.temporarySessionTensorIds.get(e);return n?n.push(a):this.temporarySessionTensorIds.set(e,[a]),a}uploadTensor(e,t){if(!pe().shouldTransferToMLTensor)throw new Error("Trying to upload to a MLTensor while shouldTransferToMLTensor is false");xe("verbose",()=>`[WebNN] uploadTensor {tensorId: ${e}, data: ${t.byteLength}}`),this.tensorManager.upload(e,t)}async downloadTensor(e,t){return this.tensorManager.download(e,t)}createMLTensorDownloader(e,t){return async()=>{let r=await this.tensorManager.download(e);return Qt(r,t)}}registerMLTensor(e,t,r,i){let a=cr.get(r);if(!a)throw new Error(`Unsupported ONNX data type: ${r}`);let n=this.tensorManager.registerTensor(e,t,a,i);return xe("verbose",()=>`[WebNN] registerMLTensor {tensor: ${t}, dataType: ${a}, dimensions: ${i}} -> {tensorId: ${n}}`),n}registerMLConstant(e,t,r,i,a,n,s=!1){if(!n)throw new Error("External mounted files are not available.");let o=e;e.startsWith("./")&&(o=e.substring(2));let u=n.get(o);if(!u)throw new Error(`File with name ${o} not found in preloaded files.`);if(t+r>u.byteLength)throw new Error("Out of bounds: data offset and length exceed the external file data size.");let l=u.slice(t,t+r).buffer,d;switch(a.dataType){case"float32":d=new Float32Array(l);break;case"float16":d=typeof Float16Array<"u"&&Float16Array.from?new Float16Array(l):new Uint16Array(l);break;case"int32":d=new Int32Array(l);break;case"uint32":d=new Uint32Array(l);break;case"int64":if(s){let p=pr(new Uint8Array(l),"int64");d=new Int32Array(p.buffer),a.dataType="int32"}else d=new BigInt64Array(l);break;case"uint64":d=new BigUint64Array(l);break;case"int8":d=new Int8Array(l);break;case"int4":case"uint4":case"uint8":d=new Uint8Array(l);break;default:throw new Error(`Unsupported data type: ${a.dataType} in creating WebNN Constant from external data.`)}return xe("verbose",()=>`[WebNN] registerMLConstant {dataType: ${a.dataType}, shape: ${a.shape}}} ${s?"(Note: it was int64 data type and registered to int32 as workaround)":""}`),i.constant(a,d)}registerGraphInput(e){this.temporaryGraphInputs.push(e)}registerGraphOutput(e){this.temporaryGraphOutputs.push(e)}isGraphInput(e,t){let r=this.sessionGraphInputs.get(e);return r?r.includes(t):!1}isGraphOutput(e,t){let r=this.sessionGraphOutputs.get(e);return r?r.includes(t):!1}isGraphInputOutputTypeSupported(e,t,r=!0){let i=cr.get(xt(t)),a=this.mlOpSupportLimitsBySessionId.get(e);return typeof i>"u"?!1:r?!!(a!=null&&a.input.dataTypes.includes(i)):!!(a!=null&&a.output.dataTypes.includes(i))}flush(){}}}),hi=I(()=>{}),fi,mi,Gr,gi,yi,_i,ra,ia,Sa,rn=I(()=>{kt(),hi(),fi=new Map([[64,250],[128,200],[256,200],[512,200],[2048,230],[4096,200],[8192,50],[16384,50],[32768,50],[65536,50],[131072,50],[262144,50],[524288,50],[1048576,50],[2097152,30],[4194304,20],[8388608,10],[12582912,10],[16777216,10],[26214400,15],[33554432,22],[44236800,2],[58982400,6],[67108864,6],[134217728,6],[167772160,6]]),mi=[],Gr=e=>Math.ceil(Number(e)/16)*16,gi=e=>{for(let t=0;t<mi.length;t++){let r=mi[t];if(e<=r)return r}return Math.ceil(e/16)*16},yi=1,_i=()=>yi++,ra=async(e,t,r,i)=>{let a=Gr(r),n=e.device.createBuffer({size:a,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{let s=e.getCommandEncoder();e.endComputePass(),s.copyBufferToBuffer(t,0,n,0,a),e.flush(),await n.mapAsync(GPUMapMode.READ);let o=n.getMappedRange();if(i){let u=i();return u.set(new Uint8Array(o,0,r)),u}else return new Uint8Array(o.slice(0,r))}finally{n.destroy()}},ia=class{constructor(e){this.backend=e,this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.buffersPending=[],this.capturedPendingBuffers=new Map;for(let[t]of fi)mi.push(t),this.freeBuffers.set(t,[]),this.freeUniformBuffers.set(t,[]);this.sessionCount=0}upload(e,t){let r=t.buffer,i=t.byteOffset,a=t.byteLength,n=Gr(a),s=this.storageCache.get(e);if(!s)throw new Error("gpu data for uploading does not exist");if(Number(s.originalSize)!==a)throw new Error(`inconsistent data size. gpu data size=${s.originalSize}, data size=${a}`);let o=this.backend.device.createBuffer({mappedAtCreation:!0,size:n,usage:GPUBufferUsage.MAP_WRITE|GPUBufferUsage.COPY_SRC}),u=o.getMappedRange();new Uint8Array(u).set(new Uint8Array(r,i,a)),o.unmap();let l=this.backend.device.createCommandEncoder();l.copyBufferToBuffer(o,0,s.gpuData.buffer,0,n),this.backend.device.queue.submit([l.finish()]),o.destroy(),xe("verbose",()=>`[WebGPU] GpuDataManager.upload(id=${e})`)}memcpy(e,t){let r=this.storageCache.get(e);if(!r)throw new Error("source gpu data for memcpy does not exist");let i=this.storageCache.get(t);if(!i)throw new Error("destination gpu data for memcpy does not exist");if(r.originalSize!==i.originalSize)throw new Error("inconsistent source and destination gpu data size");let a=Gr(r.originalSize),n=this.backend.getCommandEncoder();this.backend.endComputePass(),n.copyBufferToBuffer(r.gpuData.buffer,0,i.gpuData.buffer,0,a)}registerExternalBuffer(e,t,r){let i;if(r){if(i=r[0],e===r[1])return xe("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${i}, buffer is the same, skip.`),i;if(this.backend.capturedCommandList.has(this.backend.currentSessionId))throw new Error(`Registering a different external buffer under graph capture mode is not supported yet.
             Please use the previous external buffer!`)}else i=_i();return this.storageCache.set(i,{gpuData:{id:i,type:0,buffer:e},originalSize:t}),xe("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${i}, registered.`),i}unregisterExternalBuffer(e){e!==void 0&&(this.storageCache.delete(e),xe("verbose",()=>`[WebGPU] GpuDataManager.unregisterExternalBuffer() => id=${e}`))}create(e,t=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST){let r=gi(e),i,a=(t&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE,n=(t&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM;if(a||n){let o=(a?this.freeBuffers:this.freeUniformBuffers).get(r);o?o.length>0?i=o.pop():i=this.backend.device.createBuffer({size:r,usage:t}):i=this.backend.device.createBuffer({size:r,usage:t})}else i=this.backend.device.createBuffer({size:r,usage:t});let s={id:_i(),type:0,buffer:i};return this.storageCache.set(s.id,{gpuData:s,originalSize:Number(e)}),xe("verbose",()=>`[WebGPU] GpuDataManager.create(size=${e}) => id=${s.id}`),s}get(e){var t;return(t=this.storageCache.get(e))==null?void 0:t.gpuData}release(e){let t=typeof e=="bigint"?Number(e):e,r=this.storageCache.get(t);if(!r){if(this.storageCache.size===0)return 0;throw new Error("releasing data does not exist")}return xe("verbose",()=>`[WebGPU] GpuDataManager.release(id=${t}), gpuDataId=${r.gpuData.id}`),this.storageCache.delete(t),this.buffersPending.push(r.gpuData.buffer),r.originalSize}async download(e,t){let r=this.storageCache.get(Number(e));if(!r)throw new Error("data does not exist");await ra(this.backend,r.gpuData.buffer,r.originalSize,t)}refreshPendingBuffers(){if(this.buffersPending.length!==0)if(this.backend.sessionStatus==="default"){for(let e of this.buffersPending){let t=fi.get(e.size);if((e.usage&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE){let r=this.freeBuffers.get(e.size)||[];t===void 0||r.length>=t?e.destroy():r.push(e)}else if((e.usage&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM){let r=this.freeUniformBuffers.get(e.size)||[];t===void 0||r.length>=t?e.destroy():r.push(e)}else e.destroy()}this.buffersPending=[]}else{let e=this.capturedPendingBuffers.get(this.backend.currentSessionId);e||(e=[],this.capturedPendingBuffers.set(this.backend.currentSessionId,e));for(let t of this.buffersPending)e.push(t);this.buffersPending=[]}}dispose(){this.freeBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.freeUniformBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.storageCache.forEach(e=>{e.gpuData.buffer.destroy()}),this.capturedPendingBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.capturedPendingBuffers=new Map}onCreateSession(){this.sessionCount+=1}onReleaseSession(e){let t=this.capturedPendingBuffers.get(e);t&&(t.forEach(r=>{r.destroy()}),this.capturedPendingBuffers.delete(e)),this.sessionCount-=1,this.sessionCount===0&&(xe("warning",()=>"[WebGPU] Clearing webgpu buffer cache"),this.storageCache.forEach(r=>{r.gpuData.buffer.destroy()}),this.storageCache=new Map)}},Sa=(...e)=>new ia(...e)}),c,g,b=I(()=>{c=class{constructor(e){Object.assign(this,e)}get cacheKey(){return this.key||(this.key=Object.getOwnPropertyNames(this).sort().map(e=>`${this[e]}`).join(";")),this.key}},g=e=>new c(e)}),T,x,A,E,k,O,N,F,U,M,Q,C,q,Ne,ye,ge,Oe,J=I(()=>{le(),te(),T=64,x=(e,t)=>{if(t===3)throw new Error("vec3 has same alignment as vec4, use vec4 instead");switch(Number(e)){case 10:return t>1?`vec${t}<f16>`:"f16";case 1:return t>1?`vec${t}<f32>`:"f32";case 6:return t>1?`vec${t}<i32>`:"i32";case 12:return t>1?`vec${t}<u32>`:"u32";case 7:if(t>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","i32"];case 13:if(t>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","u32"];case 9:if(t!==4)throw new Error("bool must be vec4");return["u32","vec4<bool>"];case 22:return"i32";case 21:return"u32";default:throw new Error(`Unknown data type: ${e}`)}},A=(e,t=1)=>{let r=x(e,t);return typeof r=="string"?r:r[0]},E=(e,t=1)=>{let r=x(e,t);return typeof r=="string"?r:r[1]},k=(...e)=>{let t=[];return e.forEach(r=>{r.length!==0&&t.push({type:12,data:r},{type:12,data:D.computeStrides(r)})}),t},O=e=>e%4===0?4:e%2===0?2:1,N=(e="f32",t,r="0")=>!t||t===1?`${e}(${r})`:`vec${t}<${e}>(${r})`,F=(e,t,r)=>e==="f32"?r:t===1?`f32(${r})`:`vec${t}<f32>(${r})`,U=(e,t)=>t===4?`(${e}.x + ${e}.y + ${e}.z + ${e}.w)`:t===2?`(${e}.x + ${e}.y)`:t===3?`(${e}.x + ${e}.y + ${e}.z)`:e,M=(e,t,r,i)=>e.startsWith("uniforms.")&&r>4?typeof t=="string"?i==="f16"?`${e}[(${t}) / 8][(${t}) % 8 / 4][(${t}) % 8 % 4]`:`${e}[(${t}) / 4][(${t}) % 4]`:i==="f16"?`${e}[${Math.floor(t/8)}][${Math.floor(t%8/4)}][${t%8%4}]`:`${e}[${Math.floor(t/4)}][${t%4}]`:r>1?`${e}[${t}]`:e,Q=(e,t,r,i,a)=>{let n=typeof r=="number",s=n?r:r.length,o=[...new Array(s).keys()],u=s<2?"u32":s<=4?`vec${s}<u32>`:`array<u32, ${s}>`,l=x(t,a),d=typeof l=="string"?l:l[1],p=typeof l=="string"?l:l[0],h={indices:u,value:d,storage:p,tensor:t},f=G=>typeof G=="string"?G:`${G}u`,m={offsetToIndices:!1,indicesToOffset:!1,broadcastedIndicesToOffset:!1,set:!1,setByIndices:!1,get:!1,getByIndices:!1},_=n?"uniforms.":"",$=`${_}${e}_shape`,w=`${_}${e}_strides`,y="";for(let G=0;G<s-1;G++)y+=`
    let dim${G} = current / ${M(w,G,s)};
    let rest${G} = current % ${M(w,G,s)};
    indices[${G}] = dim${G};
    current = rest${G};
    `;y+=`indices[${s-1}] = current;`;let S=s<2?"":`
  fn o2i_${e}(offset: u32) -> ${h.indices} {
    var indices: ${h.indices};
    var current = offset;
    ${y}
    return indices;
  }`,v=G=>(m.offsetToIndices=!0,s<2?G:`o2i_${e}(${G})`),z=[];if(s>=2)for(let G=s-1;G>=0;G--)z.push(`${M(w,G,s)} * (indices[${G}])`);let B=s<2?"":`
  fn i2o_${e}(indices: ${h.indices}) -> u32 {
    return ${z.join("+")};
  }`,R=G=>(m.indicesToOffset=!0,s<2?G:`i2o_${e}(${G})`),P=(...G)=>s===0?"0u":`${h.indices}(${G.map(f).join(",")})`,V=(G,K)=>s<2?`${G}`:`${M(G,K,s)}`,W=(G,K,X)=>s<2?`${G}=${X};`:`${M(G,K,s)}=${X};`,oe={},re=(G,K)=>{m.broadcastedIndicesToOffset=!0;let X=`${K.name}broadcastedIndicesTo${e}Offset`;if(X in oe)return`${X}(${G})`;let H=[];for(let Re=s-1;Re>=0;Re--){let sr=K.indicesGet("outputIndices",Re+K.rank-s);H.push(`${V(w,Re)} * (${sr} % ${V($,Re)})`)}return oe[X]=`fn ${X}(outputIndices: ${K.type.indices}) -> u32 {
             return ${H.length>0?H.join("+"):"0u"};
           }`,`${X}(${G})`},ie=(G,K)=>(()=>{if(h.storage===h.value)return`${e}[${G}]=${K};`;if(h.storage==="vec2<u32>"&&h.value==="i32")return`${e}[${G}]=vec2<u32>(u32(${K}), select(0u, 0xFFFFFFFFu, ${K} < 0));`;if(h.storage==="vec2<u32>"&&h.value==="u32")return`${e}[${G}]=vec2<u32>(u32(${K}), 0u);`;if(h.storage==="u32"&&h.value==="vec4<bool>")return`${e}[${G}]=dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(${K}));`;throw new Error(`not supported combination of storage type ${h.storage} and value type ${h.value} yet`)})(),Te=G=>(()=>{if(h.storage===h.value)return`${e}[${G}]`;if(h.storage==="vec2<u32>"&&h.value==="i32")return`i32(${e}[${G}].x)`;if(h.storage==="vec2<u32>"&&h.value==="u32")return`u32(${e}[${G}].x)`;if(h.storage==="u32"&&h.value==="vec4<bool>")return`vec4<bool>(bool(${e}[${G}] & 0xFFu), bool(${e}[${G}] & 0xFF00u), bool(${e}[${G}] & 0xFF0000u), bool(${e}[${G}] & 0xFF000000u))`;throw new Error(`not supported combination of storage type ${h.storage} and value type ${h.value} yet`)})(),ze=s<2?"":`
  fn get_${e}ByIndices(indices: ${h.indices}) -> ${d} {
    return ${Te(`i2o_${e}(indices)`)};
  }`,ae=s<2?"":(()=>{let G=o.map(X=>`d${X}: u32`).join(", "),K=o.map(X=>`d${X}`).join(", ");return`
  fn get_${e}(${G}) -> ${d} {
    return get_${e}ByIndices(${P(K)});
  }`})(),ce=(...G)=>{if(G.length!==s)throw new Error(`indices length must be ${s}`);let K=G.map(f).join(",");return s===0?Te("0u"):s===1?Te(K[0]):(m.get=!0,m.getByIndices=!0,m.indicesToOffset=!0,`get_${e}(${K})`)},Ze=G=>s<2?Te(G):(m.getByIndices=!0,m.indicesToOffset=!0,`get_${e}ByIndices(${G})`),j=s<2?"":`
  fn set_${e}ByIndices(indices: ${h.indices}, value: ${d}) {
    ${ie(`i2o_${e}(indices)`,"value")}
  }`,Ce=s<2?"":(()=>{let G=o.map(X=>`d${X}: u32`).join(", "),K=o.map(X=>`d${X}`).join(", ");return`
  fn set_${e}(${G}, value: ${d}) {
    set_${e}ByIndices(${P(K)}, value);
  }`})();return{impl:()=>{let G=[],K=!1;return m.offsetToIndices&&(G.push(S),K=!0),m.indicesToOffset&&(G.push(B),K=!0),m.broadcastedIndicesToOffset&&(Object.values(oe).forEach(X=>G.push(X)),K=!0),m.set&&(G.push(Ce),K=!0),m.setByIndices&&(G.push(j),K=!0),m.get&&(G.push(ae),K=!0),m.getByIndices&&(G.push(ze),K=!0),!n&&K&&G.unshift(`const ${$} = ${h.indices}(${r.join(",")});`,`const ${w} = ${h.indices}(${D.computeStrides(r).join(",")});`),G.join(`
`)},type:h,offsetToIndices:v,indicesToOffset:R,broadcastedIndicesToOffset:re,indices:P,indicesGet:V,indicesSet:W,set:(...G)=>{if(G.length!==s+1)throw new Error(`indices length must be ${s}`);let K=G[s];if(typeof K!="string")throw new Error("value must be string");let X=G.slice(0,s).map(f).join(",");return s===0?ie("0u",K):s===1?ie(X[0],K):(m.set=!0,m.setByIndices=!0,m.indicesToOffset=!0,`set_${e}(${X}, ${K})`)},setByOffset:ie,setByIndices:(G,K)=>s<2?ie(G,K):(m.setByIndices=!0,m.indicesToOffset=!0,`set_${e}ByIndices(${G}, ${K});`),get:ce,getByOffset:Te,getByIndices:Ze,usage:i,name:e,strides:w,shape:$,rank:s}},C=(e,t,r,i=1)=>Q(e,t,r,"input",i),q=(e,t,r,i=1)=>Q(e,t,r,"output",i),Ne=(e,t,r)=>Q(e,t,r,"atomicOutput",1),ye=(e,t,r,i=1)=>Q(e,t,r,"internal",i),ge=class{constructor(e,t){this.normalizedDispatchGroup=e,this.limits=t,this.internalVariables=[],this.variables=[],this.uniforms=[],this.variableIndex=0}guardAgainstOutOfBoundsWorkgroupSizes(e){return`if (global_idx >= ${typeof e=="number"?`${e}u`:e}) { return; }`}mainStart(e=T){let t=typeof e=="number"?e:e[0],r=typeof e=="number"?1:e[1],i=typeof e=="number"?1:e[2];if(t>this.limits.maxComputeWorkgroupSizeX||r>this.limits.maxComputeWorkgroupSizeY||i>this.limits.maxComputeWorkgroupSizeZ)throw new Error(`workgroup size [${t}, ${r}, ${i}] exceeds the maximum workgroup size [${this.limits.maxComputeWorkgroupSizeX}, ${this.limits.maxComputeWorkgroupSizeY}, ${this.limits.maxComputeWorkgroupSizeZ}].`);if(t*r*i>this.limits.maxComputeInvocationsPerWorkgroup)throw new Error(`workgroup size [${t}, ${r}, ${i}] exceeds the maximum workgroup invocations ${this.limits.maxComputeInvocationsPerWorkgroup}.`);let a=this.normalizedDispatchGroup[1]===1&&this.normalizedDispatchGroup[2]===1,n=a?`@builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(local_invocation_id) local_id : vec3<u32>`:`@builtin(global_invocation_id) global_id : vec3<u32>,
                                             @builtin(local_invocation_id) local_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(num_workgroups) num_workgroups : vec3<u32>`,s=a?`let global_idx = global_id.x;
         let workgroup_index = workgroup_id.x;`:`let workgroup_index = workgroup_id.z * num_workgroups[0] * num_workgroups[1] +
             workgroup_id.y * num_workgroups[0] + workgroup_id.x;
         let global_idx = workgroup_index * ${t*r*i}u + local_idx;`;return`@compute @workgroup_size(${t}, ${r}, ${i})
  fn main(${n}) {
    ${s}
  `}appendVariableUniforms(e){e.rank!==0&&(e.shape.startsWith("uniforms.")&&this.uniforms.push({name:e.shape.replace("uniforms.",""),type:"u32",length:e.rank}),e.strides.startsWith("uniforms.")&&this.uniforms.push({name:e.strides.replace("uniforms.",""),type:"u32",length:e.rank}))}declareVariable(e,t){if(e.usage==="internal")throw new Error("cannot use internal variable with declareVariable(). use registerInternalVariables() instead.");this.variables.push(e),this.appendVariableUniforms(e);let r=e.usage==="input"?"read":"read_write",i=e.usage==="atomicOutput"?"atomic<i32>":e.type.storage;return`@group(0) @binding(${t}) var<storage, ${r}> ${e.name}: array<${i}>;`}declareVariables(...e){return e.map(t=>this.declareVariable(t,this.variableIndex++)).join(`
`)}registerInternalVariable(e){if(e.usage!=="internal")throw new Error("cannot use input or output variable with registerInternalVariable(). use declareVariables() instead.");this.internalVariables.push(e),this.appendVariableUniforms(e)}registerInternalVariables(...e){return e.forEach(t=>this.registerInternalVariable(t)),this}registerUniform(e,t,r=1){return this.uniforms.push({name:e,type:t,length:r}),this}registerUniforms(e){return this.uniforms=this.uniforms.concat(e),this}uniformDeclaration(){if(this.uniforms.length===0)return"";let e=[];for(let{name:t,type:r,length:i}of this.uniforms)if(i&&i>4)r==="f16"?e.push(`@align(16) ${t}:array<mat2x4<${r}>, ${Math.ceil(i/8)}>`):e.push(`${t}:array<vec4<${r}>, ${Math.ceil(i/4)}>`);else{let a=i==null||i===1?r:`vec${i}<${r}>`;e.push(`${t}:${a}`)}return`
      struct Uniforms { ${e.join(", ")} };
      @group(0) @binding(${this.variableIndex}) var<uniform> uniforms: Uniforms;`}get additionalImplementations(){return this.uniformDeclaration()+this.variables.map(e=>e.impl()).join(`
`)+this.internalVariables.map(e=>e.impl()).join(`
`)}get variablesInfo(){if(this.uniforms.length===0)return;let e=t=>[12,10,1,6][["u32","f16","f32","i32"].indexOf(t)];return this.uniforms.map(t=>[e(t.type),t.length??1])}},Oe=(e,t)=>new ge(e,t)}),Pe,Ie,tt,st,ct,Wr,ht,aa,na,rt=I(()=>{le(),te(),b(),J(),Pe=(e,t)=>{if(!e||e.length!==1)throw new Error("Transpose requires 1 input.");if(t.length!==0&&t.length!==e[0].dims.length)throw new Error(`perm size ${t.length} does not match input rank ${e[0].dims.length}`)},Ie=(e,t)=>t.length!==0?t:[...new Array(e).keys()].reverse(),tt=(e,t)=>D.sortBasedOnPerm(e,Ie(e.length,t)),st=(e,t,r,i)=>{let a=`fn perm(i: ${i.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`;for(let n=0;n<t;++n)a+=`a[${e[n]}]=i[${n}];`;return a+="return a;}"},ct=(e,t)=>{let r=[],i=[];for(let a=0;a<e.length;++a)e[a]!==1&&r.push(e[a]),e[t[a]]!==1&&i.push(t[a]);return{newShape:r,newPerm:i}},Wr=(e,t)=>{let r=0;for(let i=0;i<e.length;++i)if(t[e[i]]!==1){if(e[i]<r)return!1;r=e[i]}return!0},ht=(e,t)=>{let r=e.dataType,i=e.dims.length,a=Ie(i,t),n=tt(e.dims,a),s=e.dims,o=n,u=i<2||Wr(a,e.dims),l;if(u)return l=m=>{let _=C("input",r,s,4),$=q("output",r,o,4);return`
  ${m.registerUniform("output_size","u32").declareVariables(_,$)}
  ${m.mainStart()}
    ${m.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    output[global_idx] = input[global_idx];
  }`},{name:"TransposeCopy",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let m=D.size(n);return{outputs:[{dims:n,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(m/64/4)},programUniforms:[{type:12,data:Math.ceil(m/4)}]}},getShaderSource:l};let{newShape:d,newPerm:p}=ct(e.dims,a),h=D.areEqual(p,[2,3,1]),f=D.areEqual(p,[3,1,2]);if(d.length===2||h||f){s=h?[d[0],d[1]*d[2]]:f?[d[0]*d[1],d[2]]:d,o=[s[1],s[0]];let m=16;return l=_=>{let $=C("a",r,s.length),w=q("output",r,o.length);return`
  ${_.registerUniform("output_size","u32").declareVariables($,w)}
  var<workgroup> tile : array<array<${w.type.value}, ${m+1}>, ${m}>;
  ${_.mainStart([m,m,1])}
    let stride = (uniforms.output_shape[1] - 1) / ${m} + 1;
    let workgroup_id_x = workgroup_index % stride;
    let workgroup_id_y = workgroup_index / stride;
    let input_col = workgroup_id_y * ${m}u + local_id.x;
    let input_row = workgroup_id_x * ${m}u + local_id.y;
    if (input_row < uniforms.a_shape[0] && input_col < uniforms.a_shape[1]) {
      tile[local_id.y][local_id.x] = ${$.getByIndices(`${$.type.indices}(input_row, input_col)`)};
    }
    workgroupBarrier();

    let output_col = workgroup_id_x * ${m}u + local_id.x;
    let output_row = workgroup_id_y * ${m}u + local_id.y;
    if (output_row < uniforms.output_shape[0] && output_col < uniforms.output_shape[1]) {
      ${w.setByIndices(`${w.type.indices}(output_row, output_col)`,"tile[local_id.x][local_id.y]")}
    }
  }`},{name:"TransposeShared",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let _=D.size(n);return{outputs:[{dims:n,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(o[1]/m),y:Math.ceil(o[0]/m)},programUniforms:[{type:12,data:_},...k(s,o)]}},getShaderSource:l}}return l=m=>{let _=C("a",r,s.length),$=q("output",r,o.length);return`
  ${m.registerUniform("output_size","u32").declareVariables(_,$)}

  ${st(a,i,_,$)}

  ${m.mainStart()}
    ${m.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${$.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${$.setByOffset("global_idx",_.getByIndices("aIndices"))}
  }`},{name:"Transpose",shaderCache:{hint:`${t}`,inputDependencies:["rank"]},getRunData:()=>{let m=D.size(n);return{outputs:[{dims:n,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(m/64)},programUniforms:[{type:12,data:m},...k(s,o)]}},getShaderSource:l}},aa=(e,t)=>{Pe(e.inputs,t.perm),e.compute(ht(e.inputs[0],t.perm))},na=e=>g({perm:e.perm})}),Ct,sa,Se,It,Ta,Ut,jr,He,ft,wi,mt,oa,Ea,Nt,Lt,hr,Ke,Fe,At,ka,Ia,sc=I(()=>{le(),te(),J(),nn(),rt(),Ct={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate * candidate",logSumExp:"bestValue + exp(candidate)",l1:"bestValue + abs(candidate)",l2:"bestValue + candidate * candidate",logSum:"bestValue + candidate"},sa={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate",logSumExp:"bestValue + candidate",l1:"bestValue + candidate",l2:"bestValue + candidate",logSum:"bestValue + candidate"},Se={max:"_A[offset]",min:"_A[offset]",mean:"0",sum:"0",prod:"1",sumSquare:"0",logSumExp:"0",l1:"0",l2:"0",logSum:"0"},It={max:"bestValue",min:"bestValue",sum:"bestValue",prod:"bestValue",sumSquare:"bestValue",logSumExp:"log(bestValue)",l1:"bestValue",l2:"sqrt(bestValue)",logSum:"log(bestValue)"},Ta=(e,t)=>{let r=[];for(let i=t-e;i<t;++i)r.push(i);return r},Ut=(e,t)=>{let r=[],i=e.length;for(let n=0;n<i;n++)t.indexOf(n)===-1&&r.push(e[n]);let a=t.map(n=>e[n]);return[r,a]},jr=(e,t)=>{let r=e.length+t.length,i=[],a=0;for(let n=0;n<r;n++)t.indexOf(n)===-1?i.push(e[a++]):i.push(1);return i},He=(e,t)=>{for(let r=0;r<e.length;++r)if(e[e.length-r-1]!==t-1-r)return!1;return!0},ft=(e,t)=>{let r=[];if(!He(e,t)){for(let i=0;i<t;++i)e.indexOf(i)===-1&&r.push(i);e.forEach(i=>r.push(i))}return r},wi=(e,t,r,i,a,n,s)=>{let o=r[0].dims,u=D.size(n),l=D.size(s),d=C("_A",r[0].dataType,o),p=q("output",a,n),h=64;u===1&&(h=256);let f=`
          var<workgroup> aBestValues : array<f32, ${h}>;
       `,m=_=>`
        ${_.registerUniform("reduceSize","u32").declareVariables(d,p)}
        ${f}
        fn DIV_CEIL(a : u32, b : u32) -> u32 {
          return ((a - 1u) / b + 1u);
         }
         ${_.mainStart(h)}

          let outputIndex = global_idx / ${h};
          let offset = outputIndex * uniforms.reduceSize;

          var bestValue = f32(${Se[i]});
          let Length = uniforms.reduceSize;
          for (var k = local_idx; k < Length; k = k + ${h}) {
           let candidate = f32(${d.getByOffset("offset + k")});
           bestValue = ${Ct[i]};
          }
          aBestValues[local_idx] = bestValue;
          workgroupBarrier();

         var reduceSize = min(Length, ${h}u);
         for (var currentSize = reduceSize / 2u; reduceSize > 1u;
             currentSize = reduceSize / 2u) {
           let interval = DIV_CEIL(reduceSize, 2u);
           if (local_idx < currentSize) {
            let candidate = aBestValues[local_idx + interval];
            bestValue = ${sa[i]};
            aBestValues[local_idx] = bestValue;
           }
           reduceSize = interval;
           workgroupBarrier();
         }

         if (local_idx == 0u) {
          ${p.setByOffset("outputIndex",`${i==="mean"?`${p.type.storage}(bestValue / f32(uniforms.reduceSize))`:`${p.type.storage}(${It[i]})`}`)};
         }
        }`;return{name:e,shaderCache:{hint:`${t};${h}`,inputDependencies:["type"]},getShaderSource:m,getRunData:()=>({outputs:[{dims:n,dataType:a}],dispatchGroup:{x:u},programUniforms:[{type:12,data:l}]})}},mt=(e,t,r,i)=>{let a=e.inputs.length===1?r:an(e.inputs,r),n=a.axes;n.length===0&&!a.noopWithEmptyAxes&&(n=e.inputs[0].dims.map((f,m)=>m));let s=D.normalizeAxes(n,e.inputs[0].dims.length),o=s,u=e.inputs[0],l=ft(o,e.inputs[0].dims.length);l.length>0&&(u=e.compute(ht(e.inputs[0],l),{inputs:[0],outputs:[-1]})[0],o=Ta(o.length,u.dims.length));let[d,p]=Ut(u.dims,o),h=d;a.keepDims&&(h=jr(d,s)),e.compute(wi(t,a.cacheKey,[u],i,e.inputs[0].dataType,h,p),{inputs:[u]})},oa=(e,t)=>{mt(e,"ReduceMeanShared",t,"mean")},Ea=(e,t)=>{mt(e,"ReduceL1Shared",t,"l1")},Nt=(e,t)=>{mt(e,"ReduceL2Shared",t,"l2")},Lt=(e,t)=>{mt(e,"ReduceLogSumExpShared",t,"logSumExp")},hr=(e,t)=>{mt(e,"ReduceMaxShared",t,"max")},Ke=(e,t)=>{mt(e,"ReduceMinShared",t,"min")},Fe=(e,t)=>{mt(e,"ReduceProdShared",t,"prod")},At=(e,t)=>{mt(e,"ReduceSumShared",t,"sum")},ka=(e,t)=>{mt(e,"ReduceSumSquareShared",t,"sumSquare")},Ia=(e,t)=>{mt(e,"ReduceLogSumShared",t,"logSum")}}),Vt,ps,za,an,Ft,cs,hs,fs,ms,gs,ys,_s,ws,bs,$s,qt,vs,xs,Ss,Ts,Es,ks,Is,zs,Cs,As,nn=I(()=>{le(),te(),b(),J(),sc(),Vt=e=>{if(!e||e.length===0||e.length>2)throw new Error("Reduce op requires 1 or 2 inputs.");if(e.length===2&&e[1].dims.length!==1)throw new Error("Invalid axes input dims.")},ps=e=>["","",`var value = ${e.getByIndices("input_indices")};`,""],za=(e,t,r,i,a,n,s=!1,o=!1)=>{let u=[],l=r[0].dims,d=l.length,p=D.normalizeAxes(a,d),h=!o&&p.length===0;l.forEach((_,$)=>{h||p.indexOf($)>=0?s&&u.push(1):u.push(_)});let f=u.length,m=D.size(u);return{name:e,shaderCache:t,getShaderSource:_=>{let $=[],w=C("_A",r[0].dataType,d),y=q("output",n,f),S=i(w,y,p),v=S[2];for(let z=0,B=0;z<d;z++)h||p.indexOf(z)>=0?(s&&B++,v=`for(var j${z}: u32 = 0; j${z} < ${l[z]}; j${z}++) {
                  ${S[2].includes("last_index")?`let last_index = j${z};`:""}
                  ${w.indicesSet("input_indices",z,`j${z}`)}
                  ${v}
                }`):($.push(`${w.indicesSet("input_indices",z,y.indicesGet("output_indices",B))};`),B++);return`

        ${_.registerUniform("output_size","u32").declareVariables(w,y)}

        ${_.mainStart()}
          ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          var input_indices: ${w.type.indices};
          let output_indices = ${y.offsetToIndices("global_idx")};

          ${$.join(`
`)}
          ${S[0]}       // init ops for reduce max/min
          ${S[1]}
          ${v}
          ${S[3]}
          ${S.length===4?y.setByOffset("global_idx","value"):S.slice(4).join(`
`)}
        }`},getRunData:()=>({outputs:[{dims:u,dataType:n}],dispatchGroup:{x:Math.ceil(m/64)},programUniforms:[{type:12,data:m},...k(l,u)]})}},an=(e,t)=>{let r=[];return e[1].dims[0]>0&&e[1].getBigInt64Array().forEach(i=>r.push(Number(i))),g({axes:r,keepDims:t.keepDims,noopWithEmptyAxes:t.noopWithEmptyAxes})},Ft=(e,t,r,i)=>{let a=e.inputs,n=a.length===1?r:an(a,r);e.compute(za(t,{hint:n.cacheKey,inputDependencies:["rank"]},[a[0]],n.noopWithEmptyAxes&&n.axes.length===0?ps:i,n.axes,a[0].dataType,n.keepDims,n.noopWithEmptyAxes),{inputs:[0]})},cs=(e,t)=>{Vt(e.inputs),Ft(e,"ReduceLogSum",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += ${r.getByIndices("input_indices")};`,"value = log(value);"])},hs=(e,t)=>{Vt(e.inputs),Ft(e,"ReduceL1",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += abs(${r.getByIndices("input_indices")});`,""])},fs=(e,t)=>{Vt(e.inputs),Ft(e,"ReduceL2",t,(r,i)=>[`var t = ${i.type.value}(0); var value = ${i.type.value}(0);`,"",`t = ${r.getByIndices("input_indices")}; value += (t * t);`,"value = sqrt(value);"])},ms=(e,t)=>{Vt(e.inputs),Ft(e,"ReduceLogSumExp",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += exp(${r.getByIndices("input_indices")});`,"value = log(value);"])},gs=(e,t)=>{Vt(e.inputs),Ft(e,"ReduceMax",t,(r,i,a)=>{let n=[];for(let s=0;s<r.rank;s++)(a.indexOf(s)>=0||a.length===0)&&n.push(r.indicesSet("input_indices",s,0));return[`${n.join(`
`)}`,`var value = ${r.getByIndices("input_indices")};`,`value = max(value, ${r.getByIndices("input_indices")});`,""]})},ys=(e,t)=>{Vt(e.inputs),Ft(e,"ReduceMean",t,(r,i,a)=>{let n=1;for(let s=0;s<r.rank;s++)(a.indexOf(s)>=0||a.length===0)&&(n*=e.inputs[0].dims[s]);return["var sum = f32(0);","",`sum += f32(${r.getByIndices("input_indices")});`,`let value = ${i.type.value}(sum / ${n});`]})},_s=(e,t)=>{Vt(e.inputs),Ft(e,"ReduceMin",t,(r,i,a)=>{let n=[];for(let s=0;s<r.rank;s++)(a.indexOf(s)>=0||a.length===0)&&n.push(`input_indices[${s}] = 0;`);return[`${n.join(`
`)}`,`var value = ${r.getByIndices("input_indices")};`,`value = min(value, ${r.getByIndices("input_indices")});`,""]})},ws=(e,t)=>{Vt(e.inputs),Ft(e,"ReduceProd",t,(r,i)=>[`var value = ${i.type.storage}(1);`,"",`value *= ${r.getByIndices("input_indices")};`,""])},bs=(e,t)=>{Vt(e.inputs),Ft(e,"ReduceSum",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += ${r.getByIndices("input_indices")};`,""])},$s=(e,t)=>{Vt(e.inputs),Ft(e,"ReduceSumSquare",t,(r,i)=>[`var t = ${i.type.value}(0); var value = ${i.type.value}(0);`,"",`t = ${r.getByIndices("input_indices")}; value += t * t;`,""])},qt=(e,t,r)=>{if(t.length===0)return r;let i=1,a=1;for(let n=0;n<t.length;n++)t.indexOf(n)===-1?i*=e[n]:a*=e[n];return a<32&&i>1024},vs=(e,t)=>{qt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?ys(e,t):oa(e,t)},xs=(e,t)=>{qt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?hs(e,t):Ea(e,t)},Ss=(e,t)=>{qt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?fs(e,t):Nt(e,t)},Ts=(e,t)=>{qt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?ms(e,t):Lt(e,t)},Es=(e,t)=>{qt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?gs(e,t):hr(e,t)},ks=(e,t)=>{qt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?_s(e,t):Ke(e,t)},Is=(e,t)=>{qt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?ws(e,t):Fe(e,t)},zs=(e,t)=>{qt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?bs(e,t):At(e,t)},Cs=(e,t)=>{qt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?$s(e,t):ka(e,t)},As=(e,t)=>{qt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?cs(e,t):Ia(e,t)}}),sn,Os,Rs,on,oc=I(()=>{le(),b(),nn(),sn=e=>{if(!e||e.length===0||e.length>2)throw new Error("ArgMinMaxOp op requires 1 or 2 inputs.");if(e[0].dataType!==1)throw new Error("Invalid input type.")},Os=(e,t)=>{sn(e.inputs);let r=(i,a,n)=>{let s=[];for(let o=0;o<i.rank;o++)(n.indexOf(o)>=0||n.length===0)&&s.push(`input_indices[${o}] = 0;`);return[`${s.join(`
`)}`,`var value = ${i.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${i.getByIndices("input_indices")} ${t.selectLastIndex>0?"<=":"<"} value) {
         value = ${i.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",a.setByOffset("global_idx","best_index")]};e.compute(za("ArgMin",{hint:t.cacheKey,inputDependencies:["rank"]},[e.inputs[0]],r,[t.axis],7,t.keepDims),{inputs:[0]})},Rs=(e,t)=>{sn(e.inputs);let r=(i,a,n)=>{let s=[];for(let o=0;o<i.rank;o++)(n.indexOf(o)>=0||n.length===0)&&s.push(`input_indices[${o}] = 0;`);return[`${s.join(`
`)}`,`var value = ${i.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${i.getByIndices("input_indices")} ${t.selectLastIndex>0?">=":">"} value) {
         value = ${i.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",a.setByOffset("global_idx","best_index")]};e.compute(za("argMax",{hint:t.cacheKey,inputDependencies:["rank"]},[e.inputs[0]],r,[t.axis],7,t.keepDims),{inputs:[0]})},on=e=>g(e)}),Bs,Ca,Ms,Ds,Ps,ua,Us,Ns,un=I(()=>{le(),te(),hi(),J(),Bs=(e,t)=>{let r=e[0],i=e[1],a=e[2],n=e[3],s=e[4],o=e[5];if(s&&o)throw new Error("Attention cannot have both past and attention_bias");if(r.dims.length!==3)throw new Error('Input "input" must have 3 dimensions');let u=r.dims[0],l=r.dims[1],d=r.dims[2];if(a.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimensions');if(i.dims.length!==2)throw new Error('Input "weights" is expected to have 2 dimensions');if(i.dims[0]!==d)throw new Error("Input 1 dimension 0 should have same length as dimension 2 of input 0");if(a.dims[0]!==i.dims[1])throw new Error('Input "bias" dimension 0 should have same length as dimension 1 of input "weights"');let p=a.dims[0]/3,h=p,f=h;if(t.qkvHiddenSizes.length>0){if(t.qkvHiddenSizes.length!==3)throw new Error("qkv_hidden_sizes attribute should have 3 elements");for(let S of t.qkvHiddenSizes)if(S%t.numHeads!==0)throw new Error("qkv_hidden_sizes should be divisible by num_heads");p=t.qkvHiddenSizes[0],h=t.qkvHiddenSizes[1],f=t.qkvHiddenSizes[2]}let m=l;if(p!==h)throw new Error("qkv_hidden_sizes first element should be same as the second");if(a.dims[0]!==p+h+f)throw new Error('Input "bias" dimension 0 should have same length as sum of Q/K/V hidden sizes');let _=0;if(s){if(h!==f)throw new Error('Input "past" expect k_hidden_size == v_hidden_size');if(s.dims.length!==5)throw new Error('Input "past" must have 5 dimensions');if(s.dims[0]!==2)throw new Error('Input "past" first dimension must be 2');if(s.dims[1]!==u)throw new Error('Input "past" second dimension must be batch_size');if(s.dims[2]!==t.numHeads)throw new Error('Input "past" third dimension must be num_heads');if(s.dims[4]!==h/t.numHeads)throw new Error('Input "past" fifth dimension must be k_hidden_size / num_heads');t.pastPresentShareBuffer||(_=s.dims[3])}let $=m+_,w=-1,y=0;if(n)throw new Error("Mask not supported");if(s)throw new Error("past is not supported");if(o){if(o.dims.length!==4)throw new Error('Input "attention_bias" must have 4 dimensions');if(o.dims[0]!==u||o.dims[1]!==t.numHeads||o.dims[2]!==l||o.dims[3]!==$)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:u,sequenceLength:l,pastSequenceLength:_,kvSequenceLength:m,totalSequenceLength:$,maxSequenceLength:w,inputHiddenSize:d,hiddenSize:p,vHiddenSize:f,headSize:Math.floor(p/t.numHeads),vHeadSize:Math.floor(f/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:y,scale:t.scale,broadcastResPosBias:!1,passPastInKv:!1,qkvFormat:1}},Ca=(e,t,r)=>t&&e?`
      let total_sequence_length_input = u32(${t.getByOffset("0")});
      let present_sequence_length = max(total_sequence_length_input, uniforms.past_sequence_length);
      let is_subsequent_prompt: bool = sequence_length > 1 && sequence_length != total_sequence_length_input;
      let is_first_prompt: bool = is_subsequent_prompt == false && sequence_length == total_sequence_length_input;
      total_sequence_length = u32(${e==null?void 0:e.getByOffset("batchIdx")}) + 1;
      var past_sequence_length: u32 = 0;
      if (is_first_prompt == false) {
        past_sequence_length = total_sequence_length - sequence_length;
      }
       `:`
    ${r?"let past_sequence_length = uniforms.past_sequence_length":""};
    let present_sequence_length = total_sequence_length;
    `,Ms=(e,t,r,i,a,n,s,o)=>{let u=O(s?1:n),l=64,d=n/u;d<l&&(l=32);let p=Math.ceil(n/u/l),h=[{type:12,data:t},{type:12,data:r},{type:12,data:i},{type:12,data:a},{type:12,data:d},{type:12,data:p}],f=A(e.dataType,u),m=E(1,u),_=["type"];s&&_.push("type"),o&&_.push("type");let $=w=>{let y=q("x",e.dataType,e.dims,u),S=[y],v=s?C("seq_lens",s.dataType,s.dims):void 0;v&&S.push(v);let z=o?C("total_sequence_length_input",o.dataType,o.dims):void 0;z&&S.push(z);let B=E(e.dataType),R=[{name:"batch_size",type:"u32"},{name:"num_heads",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"sequence_length",type:"u32"},{name:"total_sequence_length",type:"u32"},{name:"elements_per_thread",type:"u32"}];return`
  var<workgroup> thread_max: array<f32, ${l}>;
  var<workgroup> thread_sum: array<f32, ${l}>;
  ${w.registerUniforms(R).declareVariables(...S)}
  ${w.mainStart([l,1,1])}
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let sequence_length = uniforms.sequence_length;
    var total_sequence_length = uniforms.total_sequence_length;
    ${Ca(v,z,!1)}
    let local_offset = local_idx * uniforms.elements_per_thread;
    let offset = (global_idx / ${l}) * uniforms.total_sequence_length + local_offset;
    let seq_causal_length = ${s?"u32(past_sequence_length + workgroup_id.y + 1)":"total_sequence_length"};
    var thread_max_vector = ${m}(-3.4028234663852886e+38f);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      thread_max_vector = max(${m}(x[offset + i]), thread_max_vector);
    }
    thread_max[local_idx] = ${(()=>{switch(u){case 1:return"thread_max_vector";case 2:return"max(thread_max_vector.x, thread_max_vector.y)";case 4:return"max(max(thread_max_vector.x, thread_max_vector.y), max(thread_max_vector.z, thread_max_vector.w))";default:throw new Error(`Unsupported components: ${u}`)}})()};
    workgroupBarrier();

    var max_value =  f32(-3.4028234663852886e+38f);
    for (var i = 0u; i < ${l}; i++) {
      max_value = max(thread_max[i], max_value);
    }

    var sum_vector = ${m}(0);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      sum_vector += exp(${m}(x[offset + i]) - max_value);
    }
    thread_sum[local_idx] = ${(()=>{switch(u){case 1:return"sum_vector";case 2:return"sum_vector.x + sum_vector.y";case 4:return"sum_vector.x + sum_vector.y + sum_vector.z + sum_vector.w";default:throw new Error(`Unsupported components: ${u}`)}})()};
    workgroupBarrier();

    var sum: f32 = 0;
    for (var i = 0u; i < ${l}; i++) {
      sum += thread_sum[i];
    }

    if (sum == 0) {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        x[offset + i] = ${y.type.value}(${B}(1.0) / ${B}(seq_causal_length));
      }
    } else {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        var f32input = ${m}(x[offset + i]);
        x[offset + i] = ${y.type.value}(exp(f32input - max_value) / sum);
      }
    }
      ${s?`
        for (var total_seq_id: u32 = seq_causal_length; total_seq_id + local_offset < uniforms.total_sequence_length; total_seq_id++) {
          x[offset + total_seq_id] = ${y.type.value}(${B}(0));
        }`:""};
  }`};return{name:"AttentionProbsSoftmax",shaderCache:{hint:`${l};${f};${u}`,inputDependencies:_},getShaderSource:$,getRunData:()=>({outputs:[],dispatchGroup:{x:1,y:a,z:t*r},programUniforms:h})}},Ds=(e,t,r,i,a,n,s,o,u)=>{let l=s+n.kvSequenceLength,d=[n.batchSize,n.numHeads,n.sequenceLength,l],p=e>1&&i,h=n.kvNumHeads?n.kvNumHeads:n.numHeads,f=p?[n.batchSize,h,l,n.headSize]:void 0,m=n.nReps?n.nReps:1,_=n.scale===0?1/Math.sqrt(n.headSize):n.scale,$=O(n.headSize),w=n.headSize/$,y=12,S={x:Math.ceil(l/y),y:Math.ceil(n.sequenceLength/y),z:n.batchSize*n.numHeads},v=[{type:12,data:n.sequenceLength},{type:12,data:w},{type:12,data:l},{type:12,data:n.numHeads},{type:12,data:n.headSize},{type:1,data:_},{type:12,data:s},{type:12,data:n.kvSequenceLength},{type:12,data:m}],z=p&&i&&D.size(i.dims)>0,B=["type","type"];z&&B.push("type"),a&&B.push("type"),o&&B.push("type"),u&&B.push("type");let R=[{dims:d,dataType:t.dataType,gpuDataType:0}];p&&R.push({dims:f,dataType:t.dataType,gpuDataType:0});let P=V=>{let W=C("q",t.dataType,t.dims,$),oe=C("key",r.dataType,r.dims,$),re=[W,oe];if(z){let j=C("past_key",i.dataType,i.dims,$);re.push(j)}a&&re.push(C("attention_bias",a.dataType,a.dims));let ie=o?C("seq_lens",o.dataType,o.dims):void 0;ie&&re.push(ie);let Te=u?C("total_sequence_length_input",u.dataType,u.dims):void 0;Te&&re.push(Te);let ze=q("output",t.dataType,d),ae=[ze];p&&ae.push(q("present_key",t.dataType,f,$));let ce=E(1,$),Ze=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"alpha",type:"f32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${y}u;

  var<workgroup> tileQ: array<${W.type.storage}, ${y*y}>;
  var<workgroup> tileK: array<${W.type.storage}, ${y*y}>;
  ${V.registerUniforms(Ze).declareVariables(...re,...ae)}
  ${V.mainStart([y,y,1])}
    // x holds the N and y holds the M
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let kvHeadIdx = ${m===1?"headIdx":"headIdx / uniforms.n_reps"};
    let kv_num_heads = ${m===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let m = workgroup_id.y * TILE_SIZE;
    let n = workgroup_id.x * TILE_SIZE;
    let sequence_length = uniforms.M;
    var total_sequence_length = uniforms.N;
    ${Ca(ie,Te,!0)}
    let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx;
    let qOffset = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
    ${z&&p?"let pastKeyOffset = absKvHeadIdx * uniforms.past_sequence_length * uniforms.K;":""};
    let kOffset = absKvHeadIdx * uniforms.kv_sequence_length * uniforms.K;
    ${p?"let presentKeyOffset = absKvHeadIdx * uniforms.N * uniforms.K;":""}
    var value = ${ce}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (global_id.y < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = q[qOffset + local_id.y * uniforms.K + w + local_id.x];
      }
      if (n + local_id.y < uniforms.N && w + local_id.x < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
      ${z&&p?`
              if (n + local_id.y < past_sequence_length) {
                tileK[idx] = past_key[pastKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
              } else if (n + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
                tileK[idx] = key[kOffset + (n + local_id.y - past_sequence_length) * uniforms.K + w + local_id.x];
              }`:`
          if (n + local_id.y < uniforms.kv_sequence_length) {
            tileK[idx] = key[kOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
          }`}
      ${p?`if (n + local_id.y < present_sequence_length) {
        present_key[presentKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x] = tileK[idx];
      }`:""}
      }
      workgroupBarrier();

      for (var k: u32 = 0u; k < TILE_SIZE && w+k < uniforms.K; k++) {
          value += ${ce}(tileQ[TILE_SIZE * local_id.y + k] * tileK[TILE_SIZE * local_id.x + k]);
      }

      workgroupBarrier();
    }

    if (global_id.y < uniforms.M && global_id.x < total_sequence_length) {
      let headOffset = workgroup_id.z * uniforms.M * uniforms.N;
      let outputIdx = headOffset + global_id.y * uniforms.N + global_id.x;
      var sum: f32 = ${(()=>{switch($){case 1:return"value";case 2:return"value.x + value.y";case 4:return"value.x + value.y + value.z + value.w";default:throw new Error(`Unsupported components: ${$}`)}})()};
        output[outputIdx] = ${ze.type.value} (sum * uniforms.alpha) + ${a?"attention_bias[outputIdx]":"0.0"};
    }
  }`};return{name:"AttentionProbs",shaderCache:{hint:`${$};${a!==void 0};${i!==void 0};${e}`,inputDependencies:B},getRunData:()=>({outputs:R,dispatchGroup:S,programUniforms:v}),getShaderSource:P}},Ps=(e,t,r,i,a,n,s=void 0,o=void 0)=>{let u=n+a.kvSequenceLength,l=a.nReps?a.nReps:1,d=a.vHiddenSize*l,p=e>1&&i,h=a.kvNumHeads?a.kvNumHeads:a.numHeads,f=p?[a.batchSize,h,u,a.headSize]:void 0,m=[a.batchSize,a.sequenceLength,d],_=12,$={x:Math.ceil(a.vHeadSize/_),y:Math.ceil(a.sequenceLength/_),z:a.batchSize*a.numHeads},w=[{type:12,data:a.sequenceLength},{type:12,data:u},{type:12,data:a.vHeadSize},{type:12,data:a.numHeads},{type:12,data:a.headSize},{type:12,data:d},{type:12,data:n},{type:12,data:a.kvSequenceLength},{type:12,data:l}],y=p&&i&&D.size(i.dims)>0,S=["type","type"];y&&S.push("type"),s&&S.push("type"),o&&S.push("type");let v=[{dims:m,dataType:t.dataType,gpuDataType:0}];p&&v.push({dims:f,dataType:t.dataType,gpuDataType:0});let z=B=>{let R=C("probs",t.dataType,t.dims),P=C("v",r.dataType,r.dims),V=[R,P];y&&V.push(C("past_value",i.dataType,i.dims));let W=s?C("seq_lens",s.dataType,s.dims):void 0;s&&V.push(W);let oe=o?C("total_sequence_length_input",o.dataType,o.dims):void 0;o&&V.push(oe);let re=[q("output",t.dataType,m)];p&&re.push(q("present_value",t.dataType,f));let ie=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"v_hidden_size",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${_}u;
  var<workgroup> tileQ: array<${R.type.value}, ${_*_}>;
  var<workgroup> tileV: array<${R.type.value}, ${_*_}>;
  ${B.registerUniforms(ie).declareVariables(...V,...re)}
  ${B.mainStart([_,_,1])}
   let headIdx = workgroup_id.z % uniforms.num_heads;
   let batchIdx = workgroup_id.z / uniforms.num_heads;
   let kvHeadIdx = ${l===1?"headIdx":"headIdx / uniforms.n_reps"};
   let kv_num_heads = ${l===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
   let m = global_id.y;
   let n = global_id.x;
   let sequence_length = uniforms.M;
   var total_sequence_length = uniforms.K;
   ${Ca(W,oe,!0)}
   let offsetA = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
   let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx; // kvHeadIdx is relative to the batch
   ${y&&p?"let pastValueOffset = absKvHeadIdx * uniforms.N * uniforms.past_sequence_length + n;":""};
   let vOffset = absKvHeadIdx * uniforms.N * uniforms.kv_sequence_length + n;
   ${p?"let presentValueOffset = absKvHeadIdx * uniforms.N * uniforms.K + n;":""}
   var value = ${R.type.storage}(0);
   for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = probs[offsetA + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
        ${y&&p?`
        if (w + local_id.y < past_sequence_length) {
          tileV[idx] = past_value[pastValueOffset + (w + local_id.y) * uniforms.N];
        } else if (w + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
          tileV[idx] = v[vOffset + (w + local_id.y - past_sequence_length) * uniforms.N];
        }
      `:`
            if (w + local_id.y < uniforms.kv_sequence_length) {
              tileV[idx] = v[vOffset + (w + local_id.y) * uniforms.N];
            }`}
        ${p?`
            if (w + local_id.y < present_sequence_length) {
          present_value[presentValueOffset + (w + local_id.y) * uniforms.N] = tileV[idx];
        }`:""}
      }
     workgroupBarrier();
     for (var k: u32 = 0u; k < TILE_SIZE && w+k < total_sequence_length; k++) {
       value += tileQ[TILE_SIZE * local_id.y + k] * tileV[TILE_SIZE * k + local_id.x];
     }
     workgroupBarrier();
   }

   // we need to transpose output from BNSH_v to BSND_v
   if (m < uniforms.M && n < uniforms.N) {
     let outputIdx = batchIdx * uniforms.M * uniforms.v_hidden_size + m * uniforms.v_hidden_size
       + headIdx * uniforms.N + n;
     output[outputIdx] = value;
   }
  }`};return{name:"AttentionScore",shaderCache:{hint:`${i!==void 0};${e}`,inputDependencies:S},getRunData:()=>({outputs:v,dispatchGroup:$,programUniforms:w}),getShaderSource:z}},ua=(e,t,r,i,a,n,s,o,u,l,d=void 0,p=void 0)=>{let h=Math.min(e.outputCount,1+(s?1:0)+(o?1:0)),f=h>1?s:void 0,m=h>1?o:void 0,_=h>1?l.pastSequenceLength:0,$=_+l.kvSequenceLength,w=u&&D.size(u.dims)>0?u:void 0,y=[t,r];f&&D.size(f.dims)>0&&y.push(f),w&&y.push(w),d&&y.push(d),p&&y.push(p);let S=e.compute(Ds(h,t,r,f,w,l,_,d,p),{inputs:y,outputs:h>1?[-1,1]:[-1]})[0];e.compute(Ms(S,l.batchSize,l.numHeads,_,l.sequenceLength,$,d,p),{inputs:d&&p?[S,d,p]:[S],outputs:[]});let v=[S,i];m&&D.size(m.dims)>0&&v.push(m),d&&v.push(d),p&&v.push(p),e.compute(Ps(h,S,i,m,l,_,d,p),{inputs:v,outputs:h>1?[0,2]:[0]})},Us=(e,t)=>{let r=[t.batchSize,t.numHeads,t.sequenceLength,t.headSize],i=t.sequenceLength,a=t.inputHiddenSize,n=t.headSize,s=12,o={x:Math.ceil(t.headSize/s),y:Math.ceil(t.sequenceLength/s),z:t.batchSize*t.numHeads},u=[e.inputs[0],e.inputs[1],e.inputs[2]],l=[{type:12,data:i},{type:12,data:a},{type:12,data:n},{type:12,data:t.numHeads},{type:12,data:t.headSize},{type:12,data:t.hiddenSize},{type:12,data:t.hiddenSize+t.hiddenSize+t.vHiddenSize}],d=p=>{let h=q("output_q",u[0].dataType,r),f=q("output_k",u[0].dataType,r),m=q("output_v",u[0].dataType,r),_=C("input",u[0].dataType,u[0].dims),$=C("weight",u[1].dataType,u[1].dims),w=C("bias",u[2].dataType,u[2].dims),y=_.type.storage,S=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"hidden_size",type:"u32"},{name:"ldb",type:"u32"}];return`
  const TILE_SIZE = ${s}u;
  var<workgroup> tileInput: array<${y}, ${s*s}>;
  var<workgroup> tileWeightQ: array<${y}, ${s*s}>;
  var<workgroup> tileWeightK: array<${y}, ${s*s}>;
  var<workgroup> tileWeightV: array<${y}, ${s*s}>;
  ${p.registerUniforms(S).declareVariables(_,$,w,h,f,m)}
  ${p.mainStart([s,s,1])}
    let batchIndex = workgroup_id.z / uniforms.num_heads;
    let headNumber = workgroup_id.z % uniforms.num_heads;
    let m = global_id.y;
    let n = global_id.x;

    let inputOffset = batchIndex * (uniforms.M * uniforms.K) + m * uniforms.K;
    let biasOffsetQ = headNumber * uniforms.head_size;
    let biasOffsetK = uniforms.hidden_size + biasOffsetQ;
    let biasOffsetV = uniforms.hidden_size + biasOffsetK;

    var valueQ = ${y}(0);
    var valueK = ${y}(0);
    var valueV = ${y}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileInput[TILE_SIZE * local_id.y + local_id.x] = input[inputOffset + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        let offset = n + (w + local_id.y) * uniforms.ldb;
        tileWeightQ[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetQ + offset];
        tileWeightK[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetK + offset];
        tileWeightV[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetV + offset];
      }
      workgroupBarrier();
      for (var k: u32 = 0u; k<TILE_SIZE && w+k < uniforms.K; k++) {
        let inputTileOffset = TILE_SIZE * local_id.y + k;
        let weightTileOffset = TILE_SIZE * k + local_id.x;
        valueQ += tileInput[inputTileOffset] * tileWeightQ[weightTileOffset];
        valueK += tileInput[inputTileOffset] * tileWeightK[weightTileOffset];
        valueV += tileInput[inputTileOffset] * tileWeightV[weightTileOffset];
      }

      workgroupBarrier();
    }

    let headOffset = (m * uniforms.N + n) % uniforms.head_size;
    valueQ += bias[headOffset + biasOffsetQ];
    valueK += bias[headOffset + biasOffsetK];
    valueV += bias[headOffset + biasOffsetV];

    let offset = workgroup_id.z * uniforms.M * uniforms.N;
    if (m < uniforms.M && n < uniforms.N) {
      let outputIdx = offset + m * uniforms.N + n;
      output_q[outputIdx] = valueQ;
      output_k[outputIdx] = valueK;
      output_v[outputIdx] = valueV;
    }
  }`};return e.compute({name:"AttentionPrepare",shaderCache:{inputDependencies:["type","type","type"]},getRunData:()=>({outputs:[{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0}],dispatchGroup:o,programUniforms:l}),getShaderSource:d},{inputs:u,outputs:[-1,-1,-1]})},Ns=(e,t)=>{let r=Bs(e.inputs,t),[i,a,n]=Us(e,r);return ua(e,i,a,n,e.inputs[4],void 0,void 0,void 0,e.inputs[5],r)}}),Ls,Vs,Fs,qs,uc=I(()=>{Ye(),le(),te(),b(),J(),Ls=(e,t)=>{if(!e||e.length!==5)throw new Error("BatchNormalization requires 5 inputs");let r=(i,a,n)=>{let s=a.length;if(s!==i.length)throw new Error(`${n}: num dimensions != ${s}`);a.forEach((o,u)=>{if(o!==i[u])throw new Error(`${n}: dim[${u}] do not match`)})};if(e[0].dims.length>1){let i=t.format==="NHWC"?t.spatial?e[0].dims.slice(-1):e[0].dims.slice(-1).concat(e[0].dims.slice(1,e[0].dims.length-1)):e[0].dims.slice(1,t.spatial?2:void 0);r(e[1].dims,i,"Invalid input scale"),r(e[2].dims,i,"Invalid input B"),r(e[3].dims,i,"Invalid input mean"),r(e[4].dims,i,"Invalid input var")}else r(e[1].dims,[1],"Invalid input scale"),r(e[2].dims,[1],"Invalid input B"),r(e[3].dims,[1],"Invalid input mean"),r(e[4].dims,[1],"Invalid input var")},Vs=(e,t)=>{let{epsilon:r,spatial:i,format:a}=t,n=e[0].dims,s=i?O(n[n.length-1]):1,o=a==="NHWC"&&n.length>1?s:1,u=D.size(n)/s,l=i,d=l?n.length:n,p=C("x",e[0].dataType,e[0].dims,s),h=C("scale",e[1].dataType,e[1].dims,o),f=C("bias",e[2].dataType,e[2].dims,o),m=C("inputMean",e[3].dataType,e[3].dims,o),_=C("inputVar",e[4].dataType,e[4].dims,o),$=q("y",e[0].dataType,d,s),w=()=>{let S="";if(i)S=`let cOffset = ${n.length===1?"0u":a==="NHWC"?`outputIndices[${n.length-1}] / ${s}`:"outputIndices[1]"};`;else if(a==="NCHW")S=`
            ${$.indicesSet("outputIndices","0","0")}
            let cOffset = ${$.indicesToOffset("outputIndices")};`;else{S=`var cIndices = ${h.type.indices}(0);
                       cIndices[0] = outputIndices[${n.length-1}];`;for(let v=1;v<h.rank;v++)S+=`cIndices[${v}] = outputIndices[${v}];`;S+=`let cOffset = ${h.indicesToOffset("cIndices")};`}return S},y=S=>`
  const epsilon = ${r};
  ${S.registerUniform("outputSize","u32").declareVariables(p,h,f,m,_,$)}
  ${S.mainStart()}
  ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
    var outputIndices = ${$.offsetToIndices(`global_idx * ${s}`)};
    ${w()}
    let scale = ${h.getByOffset("cOffset")};
    let bias = ${f.getByOffset("cOffset")};
    let inputMean = ${m.getByOffset("cOffset")};
    let inputVar = ${_.getByOffset("cOffset")};
    let x = ${p.getByOffset("global_idx")};
    let value = (x - inputMean) * inverseSqrt(inputVar + epsilon) * scale + bias;
    ${$.setByOffset("global_idx","value")}
  }`;return{name:"BatchNormalization",shaderCache:{hint:`${t.epsilon}_${t.format}_${i}_${s}`,inputDependencies:l?["rank","type","type","type","type"]:void 0},getShaderSource:y,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:l?[{type:12,data:u},...k(n)]:[{type:12,data:u}]})}},Fs=e=>g(e),qs=(e,t)=>{let{inputs:r,outputCount:i}=e,a=Fs({...t,outputCount:i});if(Y.webgpu.validateInputContent&&Ls(r,a),t.trainingMode)throw new Error("BatchNormalization trainingMode is not supported yet.");e.compute(Vs(r,a))}}),Gs,Ws,js,lc=I(()=>{te(),J(),Gs=e=>{if(e[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![320,640,1280].includes(e[0].dims[2]))throw new Error("number of channels should be 320, 640 or 1280");if(e[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(e[0].dims[2]!==e[1].dims[0])throw new Error("last dimension of input and bias are not the same")},Ws=e=>{let t=e[0].dims,r=e[0].dims[2],i=D.size(t)/4,a=e[0].dataType,n=C("input",a,t,4),s=C("bias",a,[r],4),o=C("residual",a,t,4),u=q("output",a,t,4);return{name:"BiasAdd",getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(i/64)}}),getShaderSource:l=>`
  const channels = ${r}u / 4;
  ${l.declareVariables(n,s,o,u)}

  ${l.mainStart()}
    ${l.guardAgainstOutOfBoundsWorkgroupSizes(i)}
    let value = ${n.getByOffset("global_idx")}
      + ${s.getByOffset("global_idx % channels")} + ${o.getByOffset("global_idx")};
    ${u.setByOffset("global_idx","value")}
  }`}},js=e=>{Gs(e.inputs),e.compute(Ws(e.inputs))}}),Hs,Ae,Ks,Zs,Qs,Xs,Ys,Js,eo,to,ro,io,ao,no,so,oo,la,uo,Aa,lo,po,co,ho,fo,mo,go,yo,_o,wo,bo,$o,vo,xo,So,To,ln,Eo,dn,pn,ko,Io,zo,Co,Ao,Oo,cn=I(()=>{le(),te(),b(),J(),Hs=(e,t,r,i,a,n,s)=>{let o=Math.ceil(t/4),u="";typeof a=="string"?u=`${a}(a)`:u=a("a");let l=C("inputData",r,[o],4),d=q("outputData",i,[o],4),p=[{name:"vec_size",type:"u32"}];return s&&p.push(...s),`
      ${e.registerUniforms(p).declareVariables(l,d)}

  ${n??""}

  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}

    let a = ${l.getByOffset("global_idx")};
    ${d.setByOffset("global_idx",u)}
  }`},Ae=(e,t,r,i,a,n=e.dataType,s,o)=>{let u=[{type:12,data:Math.ceil(D.size(e.dims)/4)}];return s&&u.push(...s),{name:t,shaderCache:{hint:a,inputDependencies:["type"]},getShaderSource:l=>Hs(l,D.size(e.dims),e.dataType,n,r,i,o),getRunData:l=>({outputs:[{dims:e.dims,dataType:n}],dispatchGroup:{x:Math.ceil(D.size(l[0].dims)/64/4)},programUniforms:u})}},Ks=e=>{e.compute(Ae(e.inputs[0],"Abs","abs"))},Zs=e=>{e.compute(Ae(e.inputs[0],"Acos","acos"))},Qs=e=>{e.compute(Ae(e.inputs[0],"Acosh","acosh"))},Xs=e=>{e.compute(Ae(e.inputs[0],"Asin","asin"))},Ys=e=>{e.compute(Ae(e.inputs[0],"Asinh","asinh"))},Js=e=>{e.compute(Ae(e.inputs[0],"Atan","atan"))},eo=e=>{e.compute(Ae(e.inputs[0],"Atanh","atanh"))},to=e=>g(e),ro=(e,t)=>{let r;switch(t.to){case 10:r="vec4<f16>";break;case 1:r="vec4<f32>";break;case 12:r="vec4<u32>";break;case 6:r="vec4<i32>";break;case 9:r="vec4<bool>";break;default:throw new RangeError(`not supported type (specified in attribute 'to' from 'Cast' operator): ${t.to}`)}e.compute(Ae(e.inputs[0],"Cast",r,void 0,t.cacheKey,t.to))},io=e=>{let t,r,i=e.length>=2&&e[1].data!==0,a=e.length>=3&&e[2].data!==0;switch(e[0].dataType){case 1:t=i?e[1].getFloat32Array()[0]:-34028234663852886e22,r=a?e[2].getFloat32Array()[0]:34028234663852886e22;break;case 10:t=i?e[1].getUint16Array()[0]:64511,r=a?e[2].getUint16Array()[0]:31743;break;default:throw new Error("Unsupport data type")}return g({min:t,max:r})},ao=(e,t)=>{let r=t||io(e.inputs),i=E(e.inputs[0].dataType);e.compute(Ae(e.inputs[0],"Clip",a=>`clamp(${a}, vec4<${i}>(uniforms.min), vec4<${i}>(uniforms.max))`,void 0,r.cacheKey,void 0,[{type:e.inputs[0].dataType,data:r.min},{type:e.inputs[0].dataType,data:r.max}],[{name:"min",type:i},{name:"max",type:i}]),{inputs:[0]})},no=e=>{e.compute(Ae(e.inputs[0],"Ceil","ceil"))},so=e=>{e.compute(Ae(e.inputs[0],"Cos","cos"))},oo=e=>{e.compute(Ae(e.inputs[0],"Cosh","cosh"))},la=e=>g(e),uo=(e,t)=>{let r=E(e.inputs[0].dataType);e.compute(Ae(e.inputs[0],"Elu",i=>`elu_vf32(${i})`,`
  const elu_alpha_ = ${r}(${t.alpha});

  fn elu_f32(a: ${r}) -> ${r} {
  return select((exp(a) - 1.0) * elu_alpha_, a, a >= 0.0);
  }

  fn elu_vf32(v: vec4<${r}>) -> vec4<${r}> {
  return vec4(elu_f32(v.x), elu_f32(v.y), elu_f32(v.z), elu_f32(v.w));
  }`,t.cacheKey))},Aa=(e="f32")=>`
const r0: ${e} = 0.3275911;
const r1: ${e} = 0.254829592;
const r2: ${e} = -0.284496736;
const r3: ${e} = 1.421413741;
const r4: ${e} = -1.453152027;
const r5: ${e} = 1.061405429;

fn erf_vf32(v: vec4<${e}>) -> vec4<${e}> {
  let absv = abs(v);
  let x = 1.0 / (1.0 + r0 * absv);
  return sign(v) * (1.0 - ((((r5 * x + r4) * x + r3) * x + r2) * x + r1) * x * exp(-absv * absv));
}`,lo=e=>{let t=E(e.inputs[0].dataType);e.compute(Ae(e.inputs[0],"Erf",r=>`erf_vf32(${r})`,Aa(t)))},po=e=>{e.compute(Ae(e.inputs[0],"Exp","exp"))},co=e=>{e.compute(Ae(e.inputs[0],"Floor","floor"))},ho=e=>{let t=E(e.inputs[0].dataType);e.compute(Ae(e.inputs[0],"Gelu",r=>`0.5 * ${r} * (1.0 + erf_vf32(${r} * 0.7071067811865475))`,Aa(t)))},fo=(e,t)=>{let r=E(e.inputs[0].dataType);e.compute(Ae(e.inputs[0],"LeakyRelu",i=>`select(leaky_relu_alpha_ * ${i}, ${i}, ${i} >= vec4<${r}>(0.0))`,`const leaky_relu_alpha_ = ${r}(${t.alpha});`,t.cacheKey))},mo=e=>{e.compute(Ae(e.inputs[0],"Not",t=>`!${t}`))},go=e=>{e.compute(Ae(e.inputs[0],"Neg",t=>`-${t}`))},yo=e=>{e.compute(Ae(e.inputs[0],"Reciprocal",t=>`1.0/${t}`))},_o=e=>{let t=E(e.inputs[0].dataType);e.compute(Ae(e.inputs[0],"Relu",r=>`select(vec4<${t}>(0.0), ${r}, ${r} > vec4<${t}>(0.0))`))},wo=e=>{e.compute(Ae(e.inputs[0],"Sigmoid",t=>`(1.0 / (1.0 + exp(-${t})))`))},bo=e=>g(e),$o=(e,t)=>{let r=E(e.inputs[0].dataType);e.compute(Ae(e.inputs[0],"HardSigmoid",i=>`max(vec4<${r}>(0.0), min(vec4<${r}>(1.0), ${t.alpha} * ${i} + vec4<${r}>(${t.beta})))`,void 0,t.cacheKey))},vo=e=>{e.compute(Ae(e.inputs[0],"Sin","sin"))},xo=e=>{e.compute(Ae(e.inputs[0],"Sinh","sinh"))},So=e=>{e.compute(Ae(e.inputs[0],"Sqrt","sqrt"))},To=e=>{e.compute(Ae(e.inputs[0],"Tan","tan"))},ln=e=>`sign(${e}) * (1 - exp(-2 * abs(${e}))) / (1 + exp(-2 * abs(${e})))`,Eo=e=>{e.compute(Ae(e.inputs[0],"Tanh",ln))},dn=(e="f32")=>`
const fast_gelu_a: ${e} = 0.5;
const fast_gelu_b: ${e} = 0.7978845608028654;
const fast_gelu_c: ${e} = 0.035677408136300125;

fn tanh_v(v: vec4<${e}>) -> vec4<${e}> {
  return ${ln("v")};
}
`,pn=e=>`(fast_gelu_a + fast_gelu_a * tanh_v(${e} * (fast_gelu_c * ${e} * ${e} + fast_gelu_b))) * ${e}`,ko=e=>{let t=E(e.inputs[0].dataType);e.compute(Ae(e.inputs[0],"FastGelu",pn,dn(t),void 0,e.inputs[0].dataType))},Io=(e,t)=>{let r=E(e.inputs[0].dataType);return e.compute(Ae(e.inputs[0],"ThresholdedRelu",i=>`select(vec4<${r}>(0.0), ${i}, ${i} > thresholded_relu_alpha_)`,`const thresholded_relu_alpha_ = vec4<${r}>(${t.alpha});`,t.cacheKey)),0},zo=e=>{e.compute(Ae(e.inputs[0],"Log","log"))},Co=(e,t)=>`
const alpha = vec4<${e}>(${t});
const one = ${e}(1.0);
const zero = ${e}(0.0);

fn quick_gelu_impl(x: vec4<${e}>) -> vec4<${e}> {
  let v = x *alpha;
  var x1 : vec4<${e}>;
  for (var i = 0; i < 4; i = i + 1) {
    if (v[i] >= zero) {
      x1[i] = one / (one + exp(-v[i]));
    } else {
      x1[i] = one - one / (one + exp(v[i]));
    }
  }
  return x * x1;
}
`,Ao=e=>`quick_gelu_impl(${e})`,Oo=(e,t)=>{let r=E(e.inputs[0].dataType);e.compute(Ae(e.inputs[0],"QuickGelu",Ao,Co(r,t.alpha),t.cacheKey,e.inputs[0].dataType))}}),Ro,Bo,Mo,dc=I(()=>{te(),J(),cn(),Ro=e=>{if(e[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![2560,5120,10240].includes(e[0].dims[2]))throw new Error("hidden state should be 2560, 5120 or 10240");if(e[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(e[0].dims[2]!==e[1].dims[0])throw new Error("last dimension of input and bias are not the same")},Bo=e=>{let t=e[0].dims.slice();t[2]=t[2]/2;let r=C("input",e[0].dataType,e[0].dims,4),i=C("bias",e[0].dataType,[e[0].dims[2]],4),a=q("output",e[0].dataType,t,4),n=D.size(t)/4,s=A(e[0].dataType);return{name:"BiasSplitGelu",getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(n/64)}}),getShaderSource:o=>`
  const M_SQRT2 = sqrt(2.0);
  const halfChannels = ${e[0].dims[2]/4/2}u;

  ${o.declareVariables(r,i,a)}

  ${Aa(s)}

  ${o.mainStart()}
    ${o.guardAgainstOutOfBoundsWorkgroupSizes(n)}
    let biasIdx = global_idx % halfChannels;
    let batchIndex = global_idx / halfChannels;
    let inputOffset = biasIdx + batchIndex * halfChannels * 2;
    let valueLeft = input[inputOffset] + bias[biasIdx];
    let valueRight = input[inputOffset + halfChannels] + bias[biasIdx + halfChannels];
    let geluRight = valueRight * 0.5 * (erf_vf32(valueRight / M_SQRT2) + 1);

    ${a.setByOffset("global_idx","valueLeft * geluRight")}
  }`}},Mo=e=>{Ro(e.inputs),e.compute(Bo(e.inputs))}}),Do,Po,Gt,Uo,No,Lo,Vo,Fo,qo,Go,Wo,jo,Ho,pc=I(()=>{le(),te(),J(),Do=(e,t,r,i,a,n,s,o,u,l,d,p)=>{let h,f;typeof o=="string"?h=f=(y,S)=>`${o}((${y}),(${S}))`:typeof o=="function"?h=f=o:(h=o.scalar,f=o.vector);let m=q("outputData",d,i.length,4),_=C("aData",u,t.length,4),$=C("bData",l,r.length,4),w;if(a)if(n){let y=D.size(t)===1,S=D.size(r)===1,v=t.length>0&&t[t.length-1]%4===0,z=r.length>0&&r[r.length-1]%4===0;y||S?w=m.setByOffset("global_idx",f(y?`${_.type.value}(${_.getByOffset("0")}.x)`:_.getByOffset("global_idx"),S?`${$.type.value}(${$.getByOffset("0")}.x)`:$.getByOffset("global_idx"))):w=`
            let outputIndices = ${m.offsetToIndices("global_idx * 4u")};
            let offsetA = ${_.broadcastedIndicesToOffset("outputIndices",m)};
            let offsetB = ${$.broadcastedIndicesToOffset("outputIndices",m)};
            ${m.setByOffset("global_idx",f(s||v?_.getByOffset("offsetA / 4u"):`${_.type.value}(${_.getByOffset("offsetA / 4u")}[offsetA % 4u])`,s||z?$.getByOffset("offsetB / 4u"):`${$.type.value}(${$.getByOffset("offsetB / 4u")}[offsetB % 4u])`))}
          `}else w=m.setByOffset("global_idx",f(_.getByOffset("global_idx"),$.getByOffset("global_idx")));else{if(!n)throw new Error("no necessary to use scalar implementation for element-wise binary op implementation.");let y=(S,v,z="")=>{let B=`aData[indexA${v}][componentA${v}]`,R=`bData[indexB${v}][componentB${v}]`;return`
            let outputIndices${v} = ${m.offsetToIndices(`global_idx * 4u + ${v}u`)};
            let offsetA${v} = ${_.broadcastedIndicesToOffset(`outputIndices${v}`,m)};
            let offsetB${v} = ${$.broadcastedIndicesToOffset(`outputIndices${v}`,m)};
            let indexA${v} = offsetA${v} / 4u;
            let indexB${v} = offsetB${v} / 4u;
            let componentA${v} = offsetA${v} % 4u;
            let componentB${v} = offsetB${v} % 4u;
            ${S}[${v}] = ${z}(${h(B,R)});
          `};d===9?w=`
            var data = vec4<u32>(0);
            ${y("data",0,"u32")}
            ${y("data",1,"u32")}
            ${y("data",2,"u32")}
            ${y("data",3,"u32")}
            outputData[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:w=`
            ${y("outputData[global_idx]",0)}
            ${y("outputData[global_idx]",1)}
            ${y("outputData[global_idx]",2)}
            ${y("outputData[global_idx]",3)}
          `}return`
        ${e.registerUniform("vec_size","u32").declareVariables(_,$,m)}

        ${p??""}

        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${w}
      }`},Po=(e,t,r,i,a,n,s=r.dataType)=>{let o=r.dims.map(Number),u=i.dims.map(Number),l=!D.areEqual(o,u),d=o,p=D.size(o),h=!1,f=!1,m=[l];if(l){let _=Zt.calcShape(o,u,!1);if(!_)throw new Error("Can't perform binary op on the given tensors");d=_.slice(),p=D.size(d);let $=D.size(o)===1,w=D.size(u)===1,y=o.length>0&&o[o.length-1]%4===0,S=u.length>0&&u[u.length-1]%4===0;m.push($),m.push(w),m.push(y),m.push(S);let v=1;for(let z=1;z<d.length;z++){let B=o[o.length-z],R=u[u.length-z];if(B===R)v*=B;else break}v%4===0?(f=!0,h=!0):($||w||y||S)&&(h=!0)}else h=!0;return m.push(h),{name:e,shaderCache:{hint:t+m.map(_=>_.toString()).join("_"),inputDependencies:["rank","rank"]},getShaderSource:_=>Do(_,o,u,d,h,l,f,a,r.dataType,i.dataType,s,n),getRunData:()=>({outputs:[{dims:d,dataType:s}],dispatchGroup:{x:Math.ceil(p/64/4)},programUniforms:[{type:12,data:Math.ceil(D.size(d)/4)},...k(o,u,d)]})}},Gt=(e,t,r,i,a,n)=>{e.compute(Po(t,a??"",e.inputs[0],e.inputs[1],r,i,n))},Uo=e=>{Gt(e,"Add",(t,r)=>`${t}+${r}`)},No=e=>{Gt(e,"Div",(t,r)=>`${t}/${r}`)},Lo=e=>{Gt(e,"Equal",{scalar:(t,r)=>`u32(${t}==${r})`,vector:(t,r)=>`vec4<u32>(${t}==${r})`},void 0,void 0,9)},Vo=e=>{Gt(e,"Mul",(t,r)=>`${t}*${r}`)},Fo=e=>{let t=C("input",e.inputs[0].dataType,e.inputs[0].dims).type.value;Gt(e,"Pow",{scalar:(r,i)=>`pow_custom(${r},${i})`,vector:(r,i)=>`pow_vector_custom(${r},${i})`},`
    fn pow_custom(a : ${t}, b : ${t}) -> ${t} {
      if (b == ${t}(0.0)) {
        return ${t}(1.0);
      } else if (a < ${t}(0.0) && f32(b) != floor(f32(b))) {
        return ${t}(pow(f32(a), f32(b))); // NaN
      }
      return select(sign(a), ${t}(1.0), round(f32(abs(b) % ${t}(2.0))) != 1.0) * ${t}(${t==="i32"?"round":""}(pow(f32(abs(a)), f32(b))));
    }
    fn pow_vector_custom(a : vec4<${t}>, b : vec4<${t}>) -> vec4<${t}> {
      // TODO: implement vectorized pow
      return vec4<${t}>(pow_custom(a.x, b.x), pow_custom(a.y, b.y), pow_custom(a.z, b.z), pow_custom(a.w, b.w));
    }
      `)},qo=e=>{Gt(e,"Sub",(t,r)=>`${t}-${r}`)},Go=e=>{Gt(e,"Greater",{scalar:(t,r)=>`u32(${t}>${r})`,vector:(t,r)=>`vec4<u32>(${t}>${r})`},void 0,void 0,9)},Wo=e=>{Gt(e,"Less",{scalar:(t,r)=>`u32(${t}<${r})`,vector:(t,r)=>`vec4<u32>(${t}<${r})`},void 0,void 0,9)},jo=e=>{Gt(e,"GreaterOrEqual",{scalar:(t,r)=>`u32(${t}>=${r})`,vector:(t,r)=>`vec4<u32>(${t}>=${r})`},void 0,void 0,9)},Ho=e=>{Gt(e,"LessOrEqual",{scalar:(t,r)=>`u32(${t}<=${r})`,vector:(t,r)=>`vec4<u32>(${t}<=${r})`},void 0,void 0,9)}}),Ko,Zo,Qo,Xo,Yo,Jo,cc=I(()=>{le(),te(),b(),J(),Ko=(e,t)=>{if(!e||e.length<1)throw new Error("too few inputs");let r=0,i=e[r],a=i.dataType,n=i.dims.length;e.forEach((s,o)=>{if(o!==r){if(s.dataType!==a)throw new Error("input tensors should be one type");if(s.dims.length!==n)throw new Error("input tensors should have the same shape");s.dims.forEach((u,l)=>{if(l!==t&&u!==i.dims[l])throw new Error("non concat dimensions must match")})}})},Zo=(e,t)=>`
  fn calculateInputIndex(index: u32) -> u32 {
    let sizeInConcatAxis = array<u32, ${e}u>(${t});
    for (var i: u32 = 0u; i < ${e}; i += 1u ) {
      if (index < sizeInConcatAxis[i]) {
        return i;
      }
    }
    return ${e}u;
  }`,Qo=(e,t)=>{let r=e.length,i=[];for(let a=0;a<r;++a){let n=t.setByOffset("global_idx",e[a].getByIndices("indices"));r===1?i.push(n):a===0?i.push(`if (inputIndex == ${a}u) { ${n} }`):a===r-1?i.push(`else { ${n} }`):i.push(`else if (inputIndex == ${a}) { ${n} }`)}return i.join(`
`)},Xo=(e,t,r,i)=>{let a=D.size(r),n=new Array(e.length),s=new Array(e.length),o=0,u=[],l=[],d=[{type:12,data:a}];for(let _=0;_<e.length;++_)o+=e[_].dims[t],n[_]=o,l.push(e[_].dims.length),s[_]=C(`input${_}`,i,l[_]),u.push("rank"),d.push({type:12,data:n[_]});for(let _=0;_<e.length;++_)d.push(...k(e[_].dims));d.push(...k(r));let p=q("output",i,r.length),h=p.indicesGet("indices",t),f=Array.from(Array(n.length).keys()).map(_=>`uniforms.sizeInConcatAxis${_}`).join(","),m=_=>`

  ${(()=>{_.registerUniform("outputSize","u32");for(let $=0;$<e.length;$++)_.registerUniform(`sizeInConcatAxis${$}`,"u32");return _.declareVariables(...s,p)})()}

  ${Zo(n.length,f)}

  ${_.mainStart()}
    ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

    var indices = ${p.offsetToIndices("global_idx")};

    let inputIndex = calculateInputIndex(${h});
    if (inputIndex != 0u) {
      let sizeInConcatAxis = array<u32, ${n.length}u>(${f});
      ${h} -= sizeInConcatAxis[inputIndex - 1u];
    }

    ${Qo(s,p)}
  }`;return{name:"Concat",shaderCache:{hint:`${t}`,inputDependencies:u},getRunData:()=>({outputs:[{dims:r,dataType:i}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:d}),getShaderSource:m}},Yo=(e,t)=>{let r=e.inputs,i=r[0].dims,a=D.normalizeAxis(t.axis,i.length);Ko(r,a);let n=i.slice();n[a]=r.reduce((o,u)=>o+(u.dims.length>a?u.dims[a]:0),0);let s=r.filter(o=>D.size(o.dims)>0);e.compute(Xo(s,a,n,r[0].dataType),{inputs:s})},Jo=e=>g({axis:e.axis})}),Hr,Kr,Zr,hn,Qr=I(()=>{le(),te(),Hr=(e,t,r="f32")=>{switch(e.activation){case"Relu":return`value = max(value, ${t}(0.0));`;case"Sigmoid":return`value = (${t}(1.0) / (${t}(1.0) + exp(-value)));`;case"Clip":return`value = clamp(value, ${t}(${r}(uniforms.clip_min)), ${t}(${r}(uniforms.clip_max)));`;case"HardSigmoid":return`value = max(${t}(0.0), min(${t}(1.0), ${r}(uniforms.alpha) * value + ${r}(uniforms.beta)));`;case"LeakyRelu":return`value = select(${r}(uniforms.alpha) * value, value, value >= ${t}(0.0));`;case"Tanh":return`let e2x = exp(-2.0 * abs(value));
              value = sign(value) * (1.0 - e2x) / (1.0 + e2x);
        `;case"":return"";default:throw new Error(`Unsupported activation ${e.activation}`)}},Kr=(e,t)=>{e.activation==="Clip"?t.push({type:1,data:e.clipMax},{type:1,data:e.clipMin}):e.activation==="HardSigmoid"?t.push({type:1,data:e.alpha},{type:1,data:e.beta}):e.activation==="LeakyRelu"&&t.push({type:1,data:e.alpha})},Zr=(e,t)=>{e.activation==="Clip"?t.push({name:"clip_max",type:"f32"},{name:"clip_min",type:"f32"}):e.activation==="HardSigmoid"?t.push({name:"alpha",type:"f32"},{name:"beta",type:"f32"}):e.activation==="LeakyRelu"&&t.push({name:"alpha",type:"f32"})},hn=e=>{let t=(e==null?void 0:e.activation)||"";if(t==="HardSigmoid"){let[r,i]=(e==null?void 0:e.activation_params)||[.2,.5];return{activation:t,alpha:r,beta:i}}else if(t==="Clip"){let[r,i]=(e==null?void 0:e.activation_params)||[Qi,Dt];return{activation:t,clipMax:i,clipMin:r}}else if(t==="LeakyRelu"){let[r]=(e==null?void 0:e.activation_params)||[.01];return{activation:t,alpha:r}}return{activation:t}}}),at,eu,fn=I(()=>{at=(e,t)=>{switch(e){case 1:return t;case 2:return`vec2<${t}>`;case 3:return`vec3<${t}>`;case 4:return`vec4<${t}>`;default:throw new Error(`${e}-component is not supported.`)}},eu=e=>`
      ${e?"value = value + getBiasByOutputCoords(coords);":""}
      `}),tu,hc=I(()=>{tu=e=>`
fn getIndexFromCoords4D(coords : vec4<i32>, shape : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
      shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1));
}
fn getOutputIndexFromCoords(coords : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
    i32(${e}.x), i32(${e}.y), i32(${e}.z), 1));
}
`}),da,mn,gn=I(()=>{le(),te(),J(),Qr(),da=(e,t,r,i,a)=>{let n=i-r;return`
      ${Array.from({length:r}).map((s,o)=>`
      if (${M(t.shape,o,t.rank)} != 1) {
        ${t.indicesSet(e,o,M(a,o+n,i))}
      } else {
        ${t.indicesSet(e,o,0)}
      }`).join("")}
`},mn=(e,t,r,i,a=!1,n)=>{let s=e[0].dims,o=e[1].dims,u=s[s.length-2],l=o[o.length-1],d=s[s.length-1],p=O(l),h=O(d),f=O(u),m=D.size(r)/p/f,_=e.length>2,$=i?i.slice(0,-2):r.slice(0,-2),w=[D.size($),u,l],y=[{type:12,data:m},{type:12,data:u},{type:12,data:l},{type:12,data:d}];Kr(t,y),y.push(...k($,s,o)),_&&y.push(...k(e[2].dims)),y.push(...k(w));let S=v=>{let z=ye("batch_dims",e[0].dataType,$.length),B=C("a",e[0].dataType,s.length,h),R=C("b",e[1].dataType,o.length,p),P=q("output",e[0].dataType,w.length,p),V=A(P.type.tensor),W=Hr(t,P.type.value,V),oe=[B,R],re="";if(_){let ze=a?p:1;oe.push(C("bias",e[2].dataType,e[2].dims.length,ze)),re=`${a?`value += bias[col / ${ze}];`:`value += ${P.type.value}(bias[row + i]);`}`}let ie=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"}];Zr(t,ie);let Te=()=>{let ze=`var a_data: ${B.type.value};`;for(let ae=0;ae<h;ae++)ze+=`
              let b_data${ae} = b[(b_offset + (k + ${ae}) * uniforms.N + col) / ${p}];`;for(let ae=0;ae<f;ae++){ze+=`a_data = a[(a_offset + (row + ${ae}) * uniforms.K + k) / ${h}];`;for(let ce=0;ce<h;ce++)ze+=`
            values[${ae}] = fma(${R.type.value}(a_data${h===1?"":`[${ce}]`}), b_data${ce}, values[${ae}]);
`}return ze};return`
  ${v.registerUniforms(ie).registerInternalVariables(z).declareVariables(...oe,P)}
  ${v.mainStart()}
    ${v.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let col = (global_idx % (uniforms.N / ${p})) * ${p};
    var index1 = global_idx / (uniforms.N / ${p});
    let stride1 = uniforms.M / ${f};
    let row = (index1 % stride1) * ${f};
    let batch = index1 / stride1;

    ${r.length===2?"":`let batch_indices = ${z.offsetToIndices("batch")};`}

    var a_indices: ${B.type.indices};
    ${da("a_indices",B,B.rank-2,z.rank,"batch_indices")}
    ${B.indicesSet("a_indices",B.rank-2,0)}
    ${B.indicesSet("a_indices",B.rank-1,0)}
    let a_offset = ${B.indicesToOffset("a_indices")};

    var b_indices: ${R.type.indices};
    ${da("b_indices",R,R.rank-2,z.rank,"batch_indices")}
    ${R.indicesSet("b_indices",R.rank-2,0)}
    ${R.indicesSet("b_indices",R.rank-1,0)}
    let b_offset = ${R.indicesToOffset("b_indices")};
    var values: array<${P.type.value}, ${f}>;
    for (var k: u32 = 0u; k < uniforms.K; k = k + ${h}) {
      ${Te()}
    }
    for (var i = 0u; i < ${f}u; i++) {
      var value = values[i];
      ${re}
      ${W}
      let cur_indices = ${P.type.indices}(batch, row + i, col);
      let offset = ${P.indicesToOffset("cur_indices")};
      ${P.setByOffset(`offset / ${p}`,"value")};
    }
  }
  `};return{name:"MatMulNaive",shaderCache:{hint:`${t.activation};${p};${h};${f};${a}`,inputDependencies:_?["rank","rank","rank"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:n?n(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(m/64)},programUniforms:y}),getShaderSource:S}}}),ru,iu,yn,_n,au,wn,nu,Oa,bn=I(()=>{le(),te(),J(),Qr(),gn(),fn(),ru=(e,t)=>e?`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          kStart + inputRow,
          globalRowStart / innerElementSize + inputCol${t?", batchIndices":""});
        `:`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          globalRow + innerRow,
          kStart / innerElementSize + inputCol${t?", batchIndices":""});
        `,iu=(e,t)=>e?`
        let ACached0 = mm_Asub[k * innerElementSize][localRow];
        let ACached1 = mm_Asub[k * innerElementSize + 1][localRow];
        let ACached2 = mm_Asub[k * innerElementSize + 2][localRow];
        ${t===3?"":"let ACached3 = mm_Asub[k * innerElementSize + 3][localRow];"}
        for (var i = 0; i < rowPerThread; i = i + 1) {
          acc[i] = BCached0 * ACached0[i] + acc[i];
          acc[i] = BCached1 * ACached1[i] + acc[i];
          acc[i] = BCached2 * ACached2[i] + acc[i];
          ${t===3?"":"acc[i] = BCached3 * ACached3[i] + acc[i];"}
        }`:`
        for (var i = 0; i < rowPerThread; i = i + 1) {
          let ACached = mm_Asub[tileRow + i][k];
          acc[i] = BCached0 * ACached.x + acc[i];
          acc[i] = BCached1 * ACached.y + acc[i];
          acc[i] = BCached2 * ACached.z + acc[i];
          ${t===3?"":"acc[i] = BCached3 * ACached.w + acc[i];"}
        }`,yn=(e,t,r="f32",i,a=!1,n=32,s=!1,o=32)=>{let u=t[1]*e[1],l=t[0]*e[0],d=a?u:n,p=a?n:u,h=d/t[0],f=n/t[1];if(!((a&&h===4&&e[1]===4||!a&&(h===3||h===4))&&d%t[0]===0&&n%t[1]===0&&e[0]===4))throw new Error(`If transposeA ${a} is true, innerElementSize ${h} and workPerThread[1] ${e[1]} must be 4.
      Otherwise, innerElementSize ${h} must be 3 or 4.
  tileAWidth ${d} must be divisible by workgroupSize[0]${t[0]}. tileInner ${n} must be divisible by workgroupSize[1] ${t[1]}. colPerThread ${e[0]} must be 4.`);return`
var<workgroup> mm_Asub: array<array<vec${h}<${r}>, ${d/h}>, ${p}>;
var<workgroup> mm_Bsub: array<array<vec4<${r}>, ${l/e[0]}>, ${n}>;

const rowPerThread = ${e[1]};
const colPerThread = ${e[0]};
const innerElementSize = ${h};
const tileInner = ${n};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
  let localRow = i32(localId.y);
  let tileRow = localRow * rowPerThread;
  let tileCol = i32(localId.x);

  let globalRow =i32(globalId.y) * rowPerThread;
  let globalCol = i32(globalId.x);
  let batch = ${s?"0":"i32(globalId.z)"};
  ${i?`let batchIndices = ${i.offsetToIndices("u32(batch)")};`:""}
  let globalRowStart = i32(workgroupId.y) * ${u};

  let num_tiles = ${s?`${Math.ceil(o/n)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
  var kStart = ${s?`i32(globalId.z) * ${o}`:"0"};

  var acc: array<vec4<${r}>, rowPerThread>;

  // Loop over shared dimension.
  let tileRowB = localRow * ${f};
  for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let inputRow = tileRow + innerRow;
          let inputCol = tileCol;
          ${ru(a,i)}
      }

      // Load one tile of B into local memory.
      for (var innerRow = 0; innerRow < ${f}; innerRow = innerRow + 1) {
          let inputRow = tileRowB + innerRow;
          let inputCol = tileCol;
          mm_Bsub[inputRow][inputCol] = mm_readB(batch, kStart + inputRow, globalCol${i?", batchIndices":""});
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      for (var k = 0; k < tileInner / innerElementSize; k = k + 1) {
          let BCached0 = mm_Bsub[k * innerElementSize][tileCol];
          let BCached1 = mm_Bsub[k * innerElementSize + 1][tileCol];
          let BCached2 = mm_Bsub[k * innerElementSize + 2][tileCol];
          ${h===3?"":"let BCached3 = mm_Bsub[k * innerElementSize + 3][tileCol];"}

          ${iu(a,h)}
      }

      workgroupBarrier();
  }

  for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      mm_write(batch, globalRow + innerRow, globalCol, acc[innerRow]);
  }
}`},_n=(e,t)=>e?`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              kStart + inputRow,
              globalRowStart + inputCol${t?", batchIndices":""});
            `:`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              globalRowStart + inputRow,
              kStart + inputCol${t?", batchIndices":""});
            `,au=e=>e?"let ACached = mm_Asub[k][tileRow + innerRow];":"let ACached = mm_Asub[tileRow + innerRow][k];",wn=(e,t,r="f32",i,a=!1,n=32,s=!1,o=32,u=!1)=>{let l=e[1]*t[1],d=e[0]*t[0],p=a?l:n,h=a?n:l;if(!(h%t[1]===0&&p%t[0]===0&&n%t[1]===0))throw new Error(`tileAHight ${h} must be divisible by workgroupSize[1]${t[1]}, tileAWidth ${p} must be divisible by workgroupSize[0]${t[0]}, tileInner ${n} must be divisible by workgroupSize[1]${t[1]}`);let f=h/t[1],m=p/t[0],_=n/t[1],$=u?`
    let localRow = i32(localId.y);
    let localCol = i32(localId.x);
    let globalRowStart = i32(workgroupId.y) * ${l};
    let globalColStart = i32(workgroupId.x) * ${d};

    // Loop over shared dimension.
    for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var inputRow = localRow; inputRow < ${h}; inputRow = inputRow + ${t[1]}) {
        for (var inputCol = localCol; inputCol < ${p}; inputCol = inputCol + ${t[0]}) {
          ${_n(a,i)}
        }
      }
      // Load one tile of B into local memory.
      for (var inputRow = localRow; inputRow < ${n}; inputRow = inputRow + ${t[1]}) {
            for (var inputCol = localCol; inputCol < ${d}; inputCol = inputCol + ${t[0]}) {
          mm_Bsub[inputRow][inputCol] = mm_readB(batch,
            kStart + inputRow,
            globalColStart + inputCol${i?", batchIndices":""});
        }
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      var BCached : array<${r}, colPerThread>;
      for (var k = 0; k < tileInner; k = k + 1) {
        for (var inner = 0; inner < colPerThread; inner = inner + 1) {
          BCached[inner] = mm_Bsub[k][localCol + inner * ${t[0]}];
        }
        for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let ACached = ${a?`mm_Asub[k][localRow + innerRow * ${t[1]}];`:`mm_Asub[localRow + innerRow * ${t[1]}][k];`}
          for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
            acc[innerRow][innerCol] = acc[innerRow][innerCol] +
                ACached * BCached[innerCol];
          }
        }
      }
      workgroupBarrier();
    }
    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      let gRow = globalRowStart + localRow + innerRow * ${t[1]};
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        let gCol = globalColStart + localCol + innerCol * ${t[0]};
        mm_write(batch, gRow, gCol, acc[innerRow][innerCol]);
      }
    }
    `:`
let tileRow = i32(localId.y) * rowPerThread;
let tileCol = i32(localId.x) * colPerThread;

let globalRow = i32(globalId.y) * rowPerThread;
let globalCol = i32(globalId.x) * colPerThread;
let globalRowStart = i32(workgroupId.y) * ${l};

let tileRowA = i32(localId.y) * ${f};
let tileColA = i32(localId.x) * ${m};
let tileRowB = i32(localId.y) * ${_};
// Loop over shared dimension.
for (var t = 0; t < num_tiles; t = t + 1) {
  // Load one tile of A into local memory.
  for (var innerRow = 0; innerRow < ${f}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < ${m}; innerCol = innerCol + 1) {
      let inputRow = tileRowA + innerRow;
      let inputCol = tileColA + innerCol;
      ${_n(a,i)}
    }
  }

  // Load one tile of B into local memory.
  for (var innerRow = 0; innerRow < ${_}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
      let inputRow = tileRowB + innerRow;
      let inputCol = tileCol + innerCol;
      mm_Bsub[inputRow][inputCol] = mm_readB(batch,
        kStart + inputRow,
        globalCol + innerCol${i?", batchIndices":""});
    }
  }
  kStart = kStart + tileInner;
  workgroupBarrier();

  // Compute acc values for a single thread.
  var BCached : array<${r}, colPerThread>;
  for (var k = 0; k < tileInner; k = k + 1) {
    for (var inner = 0; inner < colPerThread; inner = inner + 1) {
      BCached[inner] = mm_Bsub[k][tileCol + inner];
    }

    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      ${au(a)}
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        acc[innerRow][innerCol] = acc[innerRow][innerCol] + ACached * BCached[innerCol];
      }
    }
  }

  workgroupBarrier();
}

for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
  for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
    mm_write(batch, globalRow + innerRow, globalCol + innerCol,
        acc[innerRow][innerCol]);
  }
}
`;return`
  var<workgroup> mm_Asub : array<array<${r}, ${p}>, ${h}>;
  var<workgroup> mm_Bsub : array<array<${r}, ${d}>, ${n}>;
  const rowPerThread = ${e[1]};
  const colPerThread = ${e[0]};
  const tileInner = ${n};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
    let batch = ${s?"0":"i32(globalId.z)"};
    ${i?`let batchIndices = ${i.offsetToIndices("u32(batch)")};`:""}
    let num_tiles = ${s?`${Math.ceil(o/n)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
    var kStart = ${s?`i32(globalId.z) * ${o}`:"0"};

    var acc : array<array<${r}, colPerThread>, rowPerThread>;
    ${$}
  }
`},nu=(e,t,r,i,a=!1)=>{let[n,s,o,u]=i,l=A(i[0].type.tensor);return`
    fn mm_readA(batch: i32, row: i32, colIn: i32, batchIndices: ${n.type.indices}) -> ${at(e,l)} {
      var value = ${at(e,l)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_a_outer && col < uniforms.dim_inner)
      {
        var aIndices: ${s.type.indices};
        ${da("aIndices",s,s.rank-2,n.rank,"batchIndices")}
        ${s.indicesSet("aIndices",s.rank-2,"u32(row)")}
        ${s.indicesSet("aIndices",s.rank-1,"u32(colIn)")}
        value = ${s.getByIndices("aIndices")};
      }
      return value;
    }

    fn mm_readB(batch: i32, row: i32, colIn: i32, batchIndices: ${n.type.indices}) -> ${at(e,l)} {
      var value = ${at(e,l)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_inner && col < uniforms.dim_b_outer)
      {
        var bIndices: ${o.type.indices};
        ${da("bIndices",o,o.rank-2,n.rank,"batchIndices")}
        ${o.indicesSet("bIndices",o.rank-2,"u32(row)")}
        ${o.indicesSet("bIndices",o.rank-1,"u32(colIn)")}
        value = ${o.getByIndices("bIndices")};
      }
      return value;
    }

    fn mm_write(batch: i32, row: i32, colIn: i32, valueIn: ${at(e,l)}) {
      let col = colIn * ${e};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer) {
        var value = valueIn;
        let coords = vec3<i32>(batch, row, colIn);
        ${t?`value = value + ${a?"bias[colIn]":`${at(e,l)}(bias[row])`};`:""}
        ${r}
        ${u.setByIndices("vec3<u32>(coords)","value")}
      }
    }
    `},Oa=(e,t,r,i,a=!1,n)=>{let s=e[0].dims,o=e[1].dims,u=s.slice(0,-2),l=o.slice(0,-2),d=i?i.slice(0,-2):r.slice(0,-2),p=D.size(d),h=s[s.length-2],f=s[s.length-1],m=o[o.length-1],_=f%4===0&&m%4===0,$=h<=8?[4,1,1]:[4,4,1],w=[8,8,1],y=[Math.ceil(m/w[0]/$[0]),Math.ceil(h/w[1]/$[1]),Math.ceil(p/w[2]/$[2])],S=_?4:1,v=[...u,h,f/S],z=v.length,B=[...l,f,m/S],R=B.length,P=[p,h,m/S],V=[{type:6,data:h},{type:6,data:m},{type:6,data:f}];Kr(t,V),V.push(...k(d,v,B));let W=["rank","rank"],oe=e.length>2;oe&&(V.push(...k(e[2].dims)),W.push("rank")),V.push(...k(P));let re=ie=>{let Te=d.length,ze=ye("batchDims",e[0].dataType,Te,1),ae=A(e[0].dataType),ce=C("a",e[0].dataType,z,S),Ze=C("b",e[1].dataType,R,S),j=q("result",e[0].dataType,P.length,S),Ce=[ce,Ze];if(oe){let Re=a?S:1;Ce.push(C("bias",e[2].dataType,e[2].dims.length,Re))}let G=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"}];Zr(t,G);let K=A(j.type.tensor),X=Hr(t,j.type.value,K),H=nu(S,oe,X,[ze,ce,Ze,j],a);return`
  ${ie.registerUniforms(G).registerInternalVariables(ze).declareVariables(...Ce,j)}
  ${H}
  ${_?yn($,w,ae,ze):wn($,w,ae,ze)}
                   `};return{name:"MatMul",shaderCache:{hint:`${$};${t.activation};${_};${a}`,inputDependencies:W},getRunData:()=>({outputs:[{dims:n?n(r):r,dataType:e[0].dataType}],dispatchGroup:{x:y[0],y:y[1],z:y[2]},programUniforms:V}),getShaderSource:re}}}),su,ou,fc=I(()=>{le(),kt(),J(),Qr(),fn(),hc(),bn(),su=(e,t,r,i,a=!1,n,s=4,o=4,u=4,l="f32")=>{let d=V=>{switch(V){case 1:return"resData = x[xIndex];";case 3:return`resData = vec3<${l}>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);`;case 4:return"resData = x[xIndex / 4];";default:throw new Error(`innerElementSize ${V} is not supported.`)}},p=V=>{switch(V){case 1:return"return w[row * i32(uniforms.w_shape[3]) + colIn];";case 4:return"return w[row * i32(uniforms.w_shape[3]) / 4 + colIn];";default:throw new Error(`innerElementSize ${V} is not supported.`)}},h=e?`
    let coord = vec4<i32>(batch, xRow, xCol, xCh);
    `:`
    let coord = vec4<i32>(batch, xCh, xRow, xCol);
    `,f=e?`
    let coords = vec4<i32>(
      batch,
      row / outWidth,
      row % outWidth,
      col);
    `:`
    let coords = vec4<i32>(
      batch,
      row,
      col / outWidth,
      col % outWidth);
    `,m=e?"i32(uniforms.x_shape[1])":"i32(uniforms.x_shape[2])",_=e?"i32(uniforms.x_shape[2])":"i32(uniforms.x_shape[3])",$=e?"row":"col",w=e?"col":"row",y=`
    let inChannels = i32(uniforms.w_shape[2]);
    let outWidth = ${e?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
    let outRow = ${$} / outWidth;
    let outCol = ${$} % outWidth;

    let WRow = ${w} / (i32(uniforms.w_shape[1]) * inChannels);
    let WCol = ${w} / inChannels % i32(uniforms.w_shape[1]);
    let xRow = outRow * uniforms.stride[0] + uniforms.dilation[0] * WRow - uniforms.pad[0];
    let xCol = outCol * uniforms.stride[1] + uniforms.dilation[1] * WCol - uniforms.pad[1];
    let xCh = ${w} % inChannels;
    var resData = ${at(s,l)}(0.0);
    // The bounds checking is always needed since we use it to pad zero for
    // the 'same' padding type.
    if (xRow >= 0 && xRow < ${m} && xCol >= 0 && xCol < ${_}) {
      ${h}
      let xIndex = getIndexFromCoords4D(coord, vec4<i32>(uniforms.x_shape));
      ${d(s)}
    }
    return resData;`,S=e?t&&i?`
    let col = colIn * ${s};
    ${y}`:`
    let col = colIn * ${s};
    if (row < uniforms.dim_a_outer && col < uniforms.dim_inner) {
      ${y}
    }
    return ${at(s,l)}(0.0);`:i&&r?`
    let col = colIn * ${s};
    ${y}`:`
    let col = colIn * ${s};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${y}
    }
    return ${at(s,l)}(0.0);`,v=e?i&&r?p(o):`
    let col = colIn * ${o};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${p(o)}
    }
    return ${at(o,l)}(0.0);`:`
    let col = colIn * ${o};
    if (row < uniforms.dim_inner && col < uniforms.dim_a_outer) {
      ${p(o)}
    }
    return ${at(o,l)}(0.0);`,z=at(u,l),B=at(e?s:o,l),R=at(e?o:s,l),P=Hr(n,z,l);return`
    fn mm_readA(batch: i32, row : i32, colIn : i32) -> ${B} {
      ${e?S:v}
    }

    fn mm_readB(batch: i32, row : i32, colIn : i32) -> ${R} {
      ${e?v:S}
    }

    fn mm_write(batch: i32, row : i32, colIn : i32, valueIn : ${z}) {
      let col = colIn * ${u};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer)
      {
      var value = valueIn;
      let outWidth = ${e?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
      ${f}
      ${eu(a)}
      ${P}
      setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
      }
    }`},ou=(e,t,r,i,a,n,s,o,u)=>{let l=t.format==="NHWC",d=l?e[0].dims[3]:e[0].dims[1],p=r[0],h=l?r[2]:r[3],f=l?r[1]:r[2],m=l?r[3]:r[1],_=l&&(d%4===0||d%3===0)&&m%4===0,$=l?m:h*f,w=l?h*f:m,y=[8,8,1],S=i<=8?[4,1,1]:[4,4,1],v=[Math.ceil($/y[0]/S[0]),Math.ceil(w/y[1]/S[1]),Math.ceil(p/y[2]/S[2])];xe("verbose",()=>`[conv2d_mm_webgpu] dispatch = ${v}`);let z=_?l&&d%4!==0?3:4:1,B=y[1]*S[1],R=y[0]*S[0],P=Math.max(y[0]*z,y[1]),V=i%B===0,W=a%R===0,oe=n%P===0,re=_?[z,4,4]:[1,1,1],ie=[{type:6,data:i},{type:6,data:a},{type:6,data:n},{type:6,data:[t.pads[0],t.pads[1]]},{type:6,data:t.strides},{type:6,data:t.dilations}];Kr(t,ie),ie.push(...k(e[0].dims,e[1].dims));let Te=["rank","rank"];s&&(ie.push(...k(e[2].dims)),Te.push("rank")),ie.push(...k(r));let ze=ae=>{let ce=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"},{name:"pad",type:"i32",length:2},{name:"stride",type:"i32",length:2},{name:"dilation",type:"i32",length:2}];Zr(t,ce);let Ze=_?4:1,j=A(e[0].dataType),Ce=`
      fn setOutputAtIndex(flatIndex : i32, value : ${_?`vec4<${j}>`:j}) {
        result[flatIndex] = ${_?`vec4<${j}>`:j}(value);
      }
      fn setOutputAtCoords(d0 : i32, d1 : i32, d2 : i32, d3 : i32, value : ${_?`vec4<${j}>`:j}) {
        let flatIndex = getOutputIndexFromCoords(vec4<i32>(d0, d1, d2, d3));
        setOutputAtIndex(flatIndex ${_?"/ 4":""}, value);
      }`,G=C("x",e[0].dataType,e[0].dims.length,z===3?1:z),K=C("w",e[1].dataType,e[1].dims.length,Ze),X=[G,K],H=q("result",e[0].dataType,r.length,Ze);if(s){let Re=C("bias",e[2].dataType,e[2].dims.length,Ze);X.push(Re),Ce+=`
        fn getBiasByOutputCoords(coords : vec4<i32>) -> ${_?`vec4<${j}>`:j} {
          return bias[coords.${l?"w":"y"}${_?"/ 4":""}];
        }`}return`
        ${tu("uniforms.result_strides")}
        //struct Uniforms { xShape : vec4<i32>, wShape : vec4<i32>, outShape : vec4<i32>,
        //  outShapeStrides: vec3<i32>, filterDims : vec2<i32>, pad : vec2<i32>, stride : vec2<i32>,
        //  dilation : vec2<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32 };
        ${ae.registerUniforms(ce).declareVariables(...X,H)}
        ${Ce}
        ${su(l,V,W,oe,s,t,re[0],re[1],re[2],j)}
        ${_?yn(S,y,j,void 0,!l,P):wn(S,y,j,void 0,!l,P,!1,void 0,o)}`};return{name:"Conv2DMatMul",shaderCache:{hint:`${t.cacheKey};${z};${_};${V};${W};${oe};${B};${R};${P}`,inputDependencies:Te},getRunData:()=>({outputs:[{dims:u?u(r):r,dataType:e[0].dataType}],dispatchGroup:{x:v[0],y:v[1],z:v[2]},programUniforms:ie}),getShaderSource:ze}}}),uu,$n,pa,lu,vn,du,pu,cu,mc=I(()=>{le(),kt(),te(),J(),Qr(),fn(),uu=e=>{let t=1;for(let r=0;r<e.length;r++)t*=e[r];return t},$n=e=>typeof e=="number"?[e,e,e]:e,pa=(e,t)=>t<=1?e:e+(e-1)*(t-1),lu=(e,t,r,i=1)=>{let a=pa(t,i);return Math.floor((e[0]*(r-1)-r+a)/2)},vn=(e,t,r,i,a)=>{a==null&&(a=lu(e,t[0],i[0]));let n=[0,0,0,r];for(let s=0;s<3;s++)e[s]+2*a>=t[s]&&(n[s]=Math.trunc((e[s]-t[s]+2*a)/i[s]+1));return n},du=(e,t,r,i,a,n,s,o,u,l)=>{let d,p,h,f;if(e==="VALID"&&(e=0),typeof e=="number"){d={top:e,bottom:e,left:e,right:e,front:e,back:e};let m=vn([t,r,i,1],[o,u,l],1,[a,n,s],e);p=m[0],h=m[1],f=m[2]}else if(Array.isArray(e)){if(!e.every((_,$,w)=>_===w[0]))throw Error(`Unsupported padding parameter: ${e}`);d={top:e[0],bottom:e[1],left:e[2],right:e[3],front:e[4],back:e[5]};let m=vn([t,r,i,1],[o,u,l],1,[a,n,s],e[0]);p=m[0],h=m[1],f=m[2]}else if(e==="SAME_UPPER"){p=Math.ceil(t/a),h=Math.ceil(r/n),f=Math.ceil(i/s);let m=(p-1)*a+o-t,_=(h-1)*n+u-r,$=(f-1)*s+l-i,w=Math.floor(m/2),y=m-w,S=Math.floor(_/2),v=_-S,z=Math.floor($/2),B=$-z;d={top:S,bottom:v,left:z,right:B,front:w,back:y}}else throw Error(`Unknown padding parameter: ${e}`);return{padInfo:d,outDepth:p,outHeight:h,outWidth:f}},pu=(e,t,r,i,a,n=!1,s="channelsLast")=>{let o,u,l,d,p;if(s==="channelsLast")[o,u,l,d,p]=e;else if(s==="channelsFirst")[o,p,u,l,d]=e;else throw new Error(`Unknown dataFormat ${s}`);let[h,,f,m,_]=t,[$,w,y]=$n(r),[S,v,z]=$n(i),B=pa(f,S),R=pa(m,v),P=pa(_,z),{padInfo:V,outDepth:W,outHeight:oe,outWidth:re}=du(a,u,l,d,$,w,y,B,R,P),ie=n?h*p:h,Te=[0,0,0,0,0];return s==="channelsFirst"?Te=[o,ie,W,oe,re]:s==="channelsLast"&&(Te=[o,W,oe,re,ie]),{batchSize:o,dataFormat:s,inDepth:u,inHeight:l,inWidth:d,inChannels:p,outDepth:W,outHeight:oe,outWidth:re,outChannels:ie,padInfo:V,strideDepth:$,strideHeight:w,strideWidth:y,filterDepth:f,filterHeight:m,filterWidth:_,effectiveFilterDepth:B,effectiveFilterHeight:R,effectiveFilterWidth:P,dilationDepth:S,dilationHeight:v,dilationWidth:z,inShape:e,outShape:Te,filterShape:t}},cu=(e,t,r,i,a,n)=>{let s=n==="channelsLast";s?e[0].dims[3]:e[0].dims[1];let o=[64,1,1],u={x:r.map(($,w)=>w)},l=[Math.ceil(uu(u.x.map($=>r[$]))/o[0]),1,1];xe("verbose",()=>`[conv3d_naive_webgpu] dispatch = ${l}`);let d=1,p=D.size(r),h=[{type:12,data:p},{type:12,data:i},{type:12,data:a},{type:12,data:t.strides},{type:12,data:t.dilations}];Kr(t,h),h.push(...k(e[0].dims,e[1].dims));let f=["rank","rank"],m=e.length===3;m&&(h.push(...k(e[2].dims)),f.push("rank")),h.push(...k(r));let _=$=>{let w=[{name:"output_size",type:"u32"},{name:"filter_dims",type:"u32",length:i.length},{name:"pads",type:"u32",length:a.length},{name:"strides",type:"u32",length:t.strides.length},{name:"dilations",type:"u32",length:t.dilations.length}];Zr(t,w);let y=1,S=A(e[0].dataType),v=C("x",e[0].dataType,e[0].dims.length,d),z=C("W",e[1].dataType,e[1].dims.length,y),B=[v,z],R=q("result",e[0].dataType,r.length,y),P="";if(m){let oe=C("bias",e[2].dataType,e[2].dims.length,y);B.push(oe),P+=`
        fn getBiasByOutputCoords(coords : array<u32, 5>) -> ${S} {
          return bias[${s?M("coords",4,5):M("coords",1,5)}];
        }`}let V=at(d,S),W=Hr(t,V,S);return`
            ${P}
            fn getX(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${v.getByIndices("aIndices")};
            }
            fn getW(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${z.getByIndices("aIndices")};
            }
          ${$.registerUniforms(w).declareVariables(...B,R)}
          ${$.mainStart()}
          ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
              let coords = ${R.offsetToIndices("global_idx")};
              let batch = ${M("coords",0,v.rank)};
              let d2 = ${s?M("coords",v.rank-1,v.rank):M("coords",1,v.rank)};
              let xFRCCorner = vec3<u32>(${s?M("coords",1,v.rank):M("coords",2,v.rank)},
              ${s?M("coords",2,v.rank):M("coords",3,v.rank)},
              ${s?M("coords",3,v.rank):M("coords",4,v.rank)}) * uniforms.strides - uniforms.pads;
              let xFCorner = xFRCCorner.x;
              let xRCorner = xFRCCorner.y;
              let xCCorner = xFRCCorner.z;
              let xShapeY = ${s?M("uniforms.x_shape",1,v.rank):M("uniforms.x_shape",2,v.rank)};
              let xShapeZ = ${s?M("uniforms.x_shape",2,v.rank):M("uniforms.x_shape",3,v.rank)};
              let xShapeW = ${s?M("uniforms.x_shape",3,v.rank):M("uniforms.x_shape",4,v.rank)};
              let xShapeU = ${s?M("uniforms.x_shape",4,v.rank):M("uniforms.x_shape",1,v.rank)};
              let inputDepthNearestVec4 = (xShapeU / 4) * 4;
              let inputDepthVec4Remainder = xShapeU % 4;

              var value = 0.0;
              for (var wF = 0u; wF < uniforms.filter_dims[0]; wF++) {
                let xF = xFCorner + wF * uniforms.dilations[0];
                if (xF < 0 || xF >= xShapeY) {
                  continue;
                }

                for (var wR = 0u; wR < uniforms.filter_dims[1]; wR++) {
                  let xR = xRCorner + wR * uniforms.dilations[1];
                  if (xR < 0 || xR >= xShapeZ) {
                    continue;
                  }

                  for (var wC = 0u; wC < uniforms.filter_dims[2]; wC++) {
                    let xC = xCCorner + wC * uniforms.dilations[2];
                    if (xC < 0 || xC >= xShapeW) {
                      continue;
                    }

                    for (var d1 = 0u; d1 < inputDepthNearestVec4; d1 += 4) {
                      ${s?`let xValues = vec4<f32>(
                               getX(batch, xF, xR, xC, d1),
                               getX(batch, xF, xR, xC, d1 + 1),
                               getX(batch, xF, xR, xC, d1 + 2),
                               getX(batch, xF, xR, xC, d1 + 3));
                            `:`let xValues = vec4<f32>(
                               getX(batch, d1, xF, xR, xC),
                               getX(batch, d1 + 1, xF, xR, xC),
                               getX(batch, d1 + 2, xF, xR, xC),
                               getX(batch, d1 + 3, xF, xR, xC));
                            `}
                            let wValues = vec4<f32>(
                              getW(d2, d1, wF, wR, wC),
                              getW(d2, d1 + 1, wF, wR, wC),
                              getW(d2, d1 + 2, wF, wR, wC),
                              getW(d2, d1 + 3, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                    if (inputDepthVec4Remainder == 1) {
                        ${s?`value += getX(batch, xF, xR, xC, inputDepthNearestVec4)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`:`value += getX(batch, inputDepthNearestVec4, xF, xR, xC)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`}
                    } else if (inputDepthVec4Remainder == 2) {
                      ${s?`let xValues = vec2<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1));
                      `:`let xValues = vec2<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC));
                    `}
                    let wValues = vec2<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC));
                      value += dot(xValues, wValues);
                    } else if (inputDepthVec4Remainder == 3) {
                      ${s?`let xValues = vec3<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 2));
                      `:`let xValues = vec3<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 2, xF, xR, xC));
                    `}
                    let wValues = vec3<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 2, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                  }
                }
              }
              ${m?"value = value + getBiasByOutputCoords(coords)":""};
              ${W}
              result[global_idx] = f32(value);
          }`};return{name:"Conv3DNaive",shaderCache:{hint:`${t.cacheKey};${s};${d};${m}`,inputDependencies:f},getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:l[0],y:l[1],z:l[2]},programUniforms:h}),getShaderSource:_}}}),hu,fu,gc=I(()=>{le(),te(),J(),Qr(),hu=(e,t,r,i)=>{let a=e.length>2,n=a?"value += b[output_channel];":"",s=e[0].dims,o=e[1].dims,u=t.format==="NHWC",l=u?r[3]:r[1],d=l/t.group,p=u&&d>=4?O(l):1,h=D.size(r)/p,f=[{type:12,data:h},{type:12,data:t.dilations},{type:12,data:[t.strides[0],t.strides[1]]},{type:12,data:[t.pads[0],t.pads[1]]},{type:12,data:d}];Kr(t,f),f.push(...k(s,[o[0],o[1],o[2],o[3]/p]));let m=a?["rank","rank","rank"]:["rank","rank"];f.push(...k([r[0],r[1],r[2],r[3]/p]));let _=$=>{let w=q("output",e[0].dataType,r.length,p),y=A(w.type.tensor),S=Hr(t,w.type.value,y),v=C("x",e[0].dataType,s.length),z=C("w",e[1].dataType,o.length,p),B=[v,z];a&&B.push(C("b",e[2].dataType,e[2].dims,p));let R=[{name:"output_size",type:"u32"},{name:"dilations",type:"u32",length:t.dilations.length},{name:"strides",type:"u32",length:2},{name:"pads",type:"u32",length:2},{name:"output_channels_per_group",type:"u32"}];Zr(t,R);let P=u?`
      for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[0]; wHeight++) {
        let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

        if (xHeight < 0u || xHeight >= uniforms.x_shape[1]) {
          continue;
        }

        for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[1]; wWidth++) {
          let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
          if (xWidth < 0u || xWidth >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[2]; wInChannel++) {
            let input_channel = in_channel_offset + wInChannel;
            let xVal = ${v.get("batch","xHeight","xWidth","input_channel")};
            let wVal = ${z.get("wHeight","wWidth","wInChannel","output_channel")};
            value += xVal * wVal;
          }
        }
      }
      `:`
      for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[1]; wInChannel++) {
        let input_channel = in_channel_offset + wInChannel;
        for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[2]; wHeight++) {
          let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

          if (xHeight < 0u || xHeight >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[3]; wWidth++) {
            let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
            if (xWidth < 0u || xWidth >= uniforms.x_shape[3]) {
              continue;
            }

            let xVal = ${v.get("batch","input_channel","xHeight","xWidth")};
            let wVal = ${z.get("output_channel","wInChannel","wHeight","wWidth")};
            value += xVal * wVal;
          }
        }
      }
      `;return`
  ${$.registerUniforms(R).declareVariables(...B,w)}

  ${$.mainStart()}
    ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let outputIndices = ${w.offsetToIndices("global_idx")};
    let batch: u32 = outputIndices[0];
    let output_channel: u32 = outputIndices[${u?3:1}];
    let xRCCorner: vec2<u32> = vec2<u32>(outputIndices[${u?1:2}], outputIndices[${u?2:3}]) * uniforms.strides - uniforms.pads;
    let group_id: u32 = output_channel * ${p} / uniforms.output_channels_per_group;
    var in_channel_offset = group_id * uniforms.w_shape[${u?2:1}];

    var value: ${w.type.value} = ${w.type.value}(0);
    ${P}
    ${n}
    ${S}
    ${w.setByOffset("global_idx","value")}
  }`};return{name:"GroupedConv",shaderCache:{hint:`${t.cacheKey}_${p}`,inputDependencies:m},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:f}),getShaderSource:_}},fu=(e,t,r,i)=>{let a=e.length>2,n=O(r[3]),s=O(r[2]),o=D.size(r)/n/s,u=[e[0].dims[0],e[0].dims[1],e[0].dims[2],e[0].dims[3]/n],l=[e[1].dims[0],e[1].dims[1],e[1].dims[2],e[1].dims[3]/n],d=[r[0],r[1],r[2],r[3]/n],p=[{type:12,data:o},{type:6,data:[t.strides[0],t.strides[1]]},{type:6,data:[t.pads[0],t.pads[1]]}];Kr(t,p),p.push(...k(u,l,d));let h=(s-1)*t.strides[1]+l[1],f=m=>{let _=q("output",e[0].dataType,d.length,n),$=A(_.type.tensor),w=Hr(t,_.type.value,$),y=C("x",e[0].dataType,u.length,n),S=C("w",e[1].dataType,l.length,n),v=[y,S];a&&v.push(C("b",e[2].dataType,e[2].dims,n));let z=a?"value += b[output_channel];":"",B=[{name:"output_size",type:"u32"},{name:"strides",type:"i32",length:2},{name:"pads",type:"i32",length:2}];return Zr(t,B),`
  ${m.registerUniforms(B).declareVariables(...v,_)}
  ${m.mainStart()}
    ${m.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let width0 = uniforms.output_shape[3];
    let output_channel = global_idx % width0;
    var index1 = global_idx / width0;
    let width1 = uniforms.output_shape[2] / ${s}u;
    let col = (index1 % width1) * ${s}u;
    index1 = index1 / width1;
    let row = index1 % uniforms.output_shape[1];
    let batch = index1 / uniforms.output_shape[1];

    let x_corner = vec2<i32>(i32(row), i32(col)) * uniforms.strides - uniforms.pads;

    var x_vals: array<${y.type.value}, ${h}>;
    var values: array<${_.type.value}, ${s}>;
    let input_channel = output_channel;
    // Use constant instead of uniform can give better performance for w's height/width.
    for (var w_height: u32 = 0u; w_height < ${l[0]}; w_height++) {
      let x_height = x_corner.x + i32(w_height);
      if (x_height >= 0 && u32(x_height) < uniforms.x_shape[1]) {
        for (var i = 0; i < ${h}; i++) {
          let x_width = x_corner.y + i;
          if (x_width >= 0 && u32(x_width) < uniforms.x_shape[2]) {
            x_vals[i] = ${y.get("batch","u32(x_height)","u32(x_width)","input_channel")};
          } else {
            x_vals[i] = ${y.type.value}(0);
          }
        }
        for (var w_width: u32 = 0u; w_width < ${l[1]}; w_width++) {
          let w_val = ${S.get("w_height","w_width","0","output_channel")};
          for (var i = 0u; i < ${s}u; i++) {
            values[i] = fma(x_vals[i * u32(uniforms.strides[1]) + w_width], w_val, values[i]);
          }
        }
      }
    }

    for (var i = 0u; i < ${s}u; i++) {
      var value = values[i];
      ${z}
      ${w}
      ${_.set("batch","row","col + i","output_channel","value")};
    }
  }`};return{name:"GroupedConv-Vectorize",shaderCache:{hint:`${t.cacheKey};${n};${s};${h};${l[0]};${l[1]}`,inputDependencies:a?["rank","rank","type"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(o/64)},programUniforms:p}),getShaderSource:f}}}),mu,Ra,gu,Ba,xn,Sn,yu,_u,Tn,yc=I(()=>{te(),fc(),mc(),bn(),gc(),Qr(),gn(),rt(),mu=(e,t,r,i,a,n)=>{let s=e[0],o=e.slice(n?1:2,n?3:4),u=o.length,l=t[0],d=t.slice(2).map((h,f)=>h+(h-1)*(r[f]-1)),p=o.map((h,f)=>h+i[f]+i[f+u]).map((h,f)=>Math.floor((h-d[f]+a[f])/a[f]));return p.splice(0,0,s),p.splice(n?3:1,0,l),p},Ra=[2,3,1,0],gu=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(e[0].dims.length>5)throw new Error("greater than 5D is not supported");if(e[0].dims.length!==e[1].dims.length)throw new Error("filter does not have same dimension as input");let r=e[0].dims[t.format==="NHWC"?e[0].dims.length-1:1],i=e[1].dims[1]*t.group;if(r!==i)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");if(e.length===3&&(e[2].dims.length!==1||e[1].dims[0]!==e[2].dims[0]))throw new Error("invalid bias");let a=e[0].dims.length-2;if(t.dilations.length!==a)throw new Error(`dilations should be ${a}D`);if(t.strides.length!==a)throw new Error(`strides should be ${a}D`);if(t.pads.length!==a*2)throw new Error(`pads should be ${a*2}D`);if(t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw new Error("invalid kernel shape")},Ba=(e,t)=>{let r=e.kernelShape.slice();r.length<t[1].dims.length-2&&r.push(...Array(t[1].dims.length-2-r.length).fill(0));for(let n=2;n<t[1].dims.length;++n)r[n-2]===0&&(r[n-2]=t[1].dims[n]);let i=e.pads.slice();lr.adjustPadsBasedOnAutoPad(t[0].dims,e.strides,e.dilations,r,i,e.format==="NHWC",e.autoPad);let a=Object.assign({},e);return Object.assign(a,{kernelShape:r,pads:i}),a},xn=e=>{let t=hn(e),r=e.format,i=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][e.auto_pad],a=e.dilations,n=e.group,s=e.kernel_shape,o=e.pads,u=e.strides,l=e.w_is_const();return{autoPad:i,format:r,dilations:a,group:n,kernelShape:s,pads:o,strides:u,wIsConst:l,...t,cacheKey:`${e.format};${t.activation};`}},Sn=(e,t,r,i)=>{let a=r.format==="NHWC",n=mu(t[0].dims,t[1].dims,r.dilations,r.pads,r.strides,a);if(r.group!==1){let B=[t[0]];if(a){let R=e.kernelCustomData.wT??e.compute(ht(t[1],Ra),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=R),B.push(R)}else B.push(t[1]);t.length===3&&B.push(t[2]),!e.adapterInfo.isArchitecture("ampere")&&a&&t[1].dims[0]===r.group&&t[1].dims[1]===1&&r.dilations[0]===1&&r.dilations[1]===1?e.compute(fu(B,r,n,i),{inputs:B}):e.compute(hu(B,r,n,i),{inputs:B});return}let s=t.length===3,o=t[0].dims[a?1:2],u=t[0].dims[a?2:3],l=t[0].dims[a?3:1],d=t[1].dims[2],p=t[1].dims[3],h=n[a?1:2],f=n[a?2:3],m=n[a?3:1],_=a&&d===o&&p===u&&r.pads[0]===0&&r.pads[1]===0;if(_||d===1&&p===1&&r.dilations[0]===1&&r.dilations[1]===1&&r.strides[0]===1&&r.strides[1]===1&&r.pads[0]===0&&r.pads[1]===0){let B=n[0],R,P,V,W=[];if(a){let ie=e.kernelCustomData.wT??e.compute(ht(t[1],Ra),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];if(r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=ie),_){let Te=o*u*l;R=t[0].reshape([1,B,Te]),P=ie.reshape([1,Te,m]),V=[1,B,m]}else R=t[0].reshape([B,o*u,l]),P=ie.reshape([1,l,m]),V=[B,h*f,m];W.push(R),W.push(P)}else R=t[0].reshape([B,l,o*u]),P=t[1].reshape([1,m,l]),V=[B,m,h*f],W.push(P),W.push(R);s&&W.push(t[2]);let oe=V[2],re=W[0].dims[W[0].dims.length-1];oe<8&&re<8?e.compute(mn(W,r,n,V,a,i),{inputs:W}):e.compute(Oa(W,r,n,V,a,i),{inputs:W});return}let $=!0,w=e.kernelCustomData.wT??e.compute(ht(t[1],Ra),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=w);let y=[t[0],w];s&&y.push(t[2]);let S=a?h*f:m,v=a?m:h*f,z=d*p*l;e.compute(ou(y,r,n,S,v,z,s,$,i),{inputs:y})},yu=(e,t)=>{let r=t.format==="NHWC",i=[e.inputs[0].reshape(r?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&i.push(e.inputs[2]);let a=[0,t.pads[0],0,t.pads[1]],n=[1].concat(t.strides),s=[1].concat(t.dilations),o=[1].concat(t.kernelShape),u=Ba({...t,pads:a,strides:n,dilations:s,kernelShape:o},i);Sn(e,i,u,l=>r?[l[0],l[2],l[3]]:[l[0],l[1],l[3]])},_u=(e,t,r)=>{let i=r.format==="NHWC"?"channelsLast":"channelsFirst",a=Ba(r,t),n=r.autoPad==="NOTSET"?r.pads:r.autoPad,s=pu(t[0].dims,t[1].dims,r.strides,r.dilations,n,!1,i);e.compute(cu(t,a,s.outShape,[s.filterDepth,s.filterHeight,s.filterWidth],[s.padInfo.front,s.padInfo.top,s.padInfo.left],i))},Tn=(e,t)=>{if(gu(e.inputs,t),e.inputs[0].dims.length===3)yu(e,t);else if(e.inputs[0].dims.length===5)_u(e,e.inputs,t);else{let r=Ba(t,e.inputs);Sn(e,e.inputs,r)}}}),wu,_c=I(()=>{le(),kt(),te(),J(),wu=(e,t,r)=>{let i=e.length>2,a=t.outputShape,n=t.format==="NHWC",s=t.group,o=e[1].dims,u=o[2]/s,l=o[3],d=n?O(u):1,p=n&&l===1&&u>=4,h=p?Math.floor(u/4)*4:Math.floor(u/d)*d,f=u-h,m=n?O(l):1,_=n?l===1?d:m:1,$=D.size(a)/m,w=[Math.ceil($/64),1,1];xe("verbose",()=>`[conv2d_backprop_webgpu] dispatch = ${w}`);let y=["rank","rank"],S=[t.strides[0],t.strides[1]],v=[t.kernelShape[n?1:2],t.kernelShape[n?2:3]],z=[t.dilations[0],t.dilations[1]],B=[v[0]+(t.dilations[0]<=1?0:(t.kernelShape[n?1:2]-1)*(t.dilations[0]-1)),v[1]+(t.dilations[1]<=1?0:(t.kernelShape[n?2:3]-1)*(t.dilations[1]-1))],R=[B[0]-1-Math.floor((t.pads[0]+t.pads[2])/2),B[1]-1-Math.floor((t.pads[1]+t.pads[3])/2)],P=[{type:12,data:$},{type:12,data:S},{type:12,data:v},{type:12,data:z},{type:12,data:B},{type:6,data:R},{type:12,data:h},{type:12,data:u},{type:12,data:l},...k(e[0].dims,e[1].dims)];i&&(P.push(...k(e[2].dims)),y.push("rank")),P.push(...k(a));let V=W=>{let oe=[{name:"output_size",type:"u32"},{name:"strides",type:"u32",length:S.length},{name:"filter_dims",type:"u32",length:v.length},{name:"dilations",type:"u32",length:v.length},{name:"effective_filter_dims",type:"u32",length:B.length},{name:"pads",type:"i32",length:R.length},{name:"input_channels_per_group_int",type:"u32"},{name:"input_channels_per_group",type:"u32"},{name:"output_channels_per_group",type:"u32"}],re=A(e[0].dataType),ie=n?1:2,Te=n?2:3,ze=n?3:1,ae=C("W",e[1].dataType,e[1].dims.length,_),ce=C("Dy",e[0].dataType,e[0].dims.length,d),Ze=[ce,ae];i&&Ze.push(C("bias",e[2].dataType,[a[ze]].length,m));let j=q("result",e[0].dataType,a.length,m),Ce=()=>{let X="";if(p)d===4?X+=`
        let xValue = ${ce.getByOffset("x_offset")};
        let wValue = ${ae.getByOffset("w_offset")};
        dotProd = dotProd + dot(xValue, wValue);
        x_offset += 1u;
        w_offset += 1u;`:d===2?X+=`
          dotProd = dotProd + dot(vec4<${re}>(${ce.getByOffset("x_offset")}, ${ce.getByOffset("x_offset + 1u")}), vec4<${re}>(${ae.getByOffset("w_offset")}, ${ae.getByOffset("w_offset + 1u")}));
          x_offset += 2u;
          w_offset += 2u;`:d===1&&(X+=`
          dotProd = dotProd + dot(vec4<${re}>(${ce.getByOffset("x_offset")}, ${ce.getByOffset("x_offset + 1u")}, ${ce.getByOffset("x_offset + 2u")}, ${ce.getByOffset("x_offset + 3u")}), vec4<${re}>(${ae.getByOffset("w_offset")}, ${ae.getByOffset("w_offset + 1u")}, ${ae.getByOffset("w_offset + 2u")}, ${ae.getByOffset("w_offset + 3u")}));
          x_offset += 4u;
          w_offset += 4u;`);else if(X+=`
                  let xValue = ${n?ce.getByOffset(`${ce.indicesToOffset(`${ce.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${d}`):ce.get("batch","inputChannel","idyR","idyC")};
        `,d===1)X+=`
          let w_offset = ${ae.indicesToOffset(`${ae.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)};
          let wValue = ${ae.getByOffset(`w_offset / ${_}`)};
          dotProd = dotProd + xValue * wValue;`;else for(let H=0;H<d;H++)X+=`
            let wValue${H} = ${ae.getByOffset(`${ae.indicesToOffset(`${ae.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel + ${H}, wOutChannel)`)} / ${_}`)};
            dotProd = dotProd + xValue[${H}] * wValue${H};`;return X},G=()=>{if(f===0)return"";if(!p)throw new Error(`packInputAs4 ${p} is not true.`);let X="";if(d===1){X+="dotProd = dotProd";for(let H=0;H<f;H++)X+=`
            + ${ce.getByOffset(`x_offset + ${H}`)} * ${ae.getByOffset(`w_offset + ${H}`)}`;X+=";"}else if(d===2){if(f!==2)throw new Error(`Invalid inputChannelsRemainder ${f}.`);X+=`
          let xValue = ${ce.getByOffset("x_offset")};
          let wValue = ${ae.getByOffset("w_offset")};
          dotProd = dotProd + dot(xValue, wValue);`}return X},K=`
            let outputIndices = ${j.offsetToIndices(`global_idx * ${m}`)};
            let batch = ${j.indicesGet("outputIndices",0)};
            let d1 = ${j.indicesGet("outputIndices",ze)};
            let r = ${j.indicesGet("outputIndices",ie)};
            let c = ${j.indicesGet("outputIndices",Te)};
            let dyCorner = vec2<i32>(i32(r), i32(c)) - uniforms.pads;
            let dyRCorner = dyCorner.x;
            let dyCCorner = dyCorner.y;
            let groupId = d1 / uniforms.output_channels_per_group;
            let wOutChannel = d1 - groupId * uniforms.output_channels_per_group;
            // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
            // ? = to be determined. : = across all values in that axis.
            var dotProd = ${j.type.value}(0.0);
            var wR: u32 = 0;
            if (uniforms.dilations.x == 1) {
              // Minimum wR >= 0 that satisfies (dyRCorner + wR) % (uniforms.strides.x) == 0
              wR = u32(((dyRCorner + i32(uniforms.strides.x) - 1) / i32(uniforms.strides.x)) * i32(uniforms.strides.x) - dyRCorner);
            }
            for (; wR < uniforms.effective_filter_dims.x; wR = wR + 1) {
              if (wR % uniforms.dilations.x != 0) {
                continue;
              }
              let dyR = (${re}(dyRCorner) + ${re}(wR)) / ${re}(uniforms.strides[0]);
              let wRPerm = uniforms.filter_dims.x - 1 - wR / uniforms.dilations.x;
              if (dyR < 0.0 || dyR >= ${re}(uniforms.Dy_shape[${ie}]) || fract(dyR) > 0.0 ||
                  wRPerm < 0) {
                continue;
              }
              let idyR: u32 = u32(dyR);
              var wC: u32 = 0;
              if (uniforms.dilations.y == 1) {
                // Minimum wC >= 0 that satisfies (dyCCorner + wC) % (uniforms.strides.y) == 0
                wC = u32(((dyCCorner + i32(uniforms.strides.y) - 1) / i32(uniforms.strides.y)) * i32(uniforms.strides.y) - dyCCorner);
              }
              for (; wC < uniforms.effective_filter_dims.y; wC = wC + 1) {
                if (wC % uniforms.dilations.y != 0) {
                  continue;
                }
                let dyC = (${re}(dyCCorner) + ${re}(wC)) / ${re}(uniforms.strides.y);
                let wCPerm = uniforms.filter_dims.y - 1 - wC / uniforms.dilations.y;
                if (dyC < 0.0 || dyC >= ${re}(uniforms.Dy_shape[${Te}]) ||
                    fract(dyC) > 0.0 || wCPerm < 0) {
                  continue;
                }
                let idyC: u32 = u32(dyC);
                var inputChannel = groupId * uniforms.input_channels_per_group;
                ${p?`
                var x_offset = ${ce.indicesToOffset(`${ce.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${d};
                var w_offset = ${ae.indicesToOffset(`${ae.type.indices}(wRPerm, wCPerm, inputChannel, wOutChannel)`)} / ${_};
                  `:""}
                for (var d2: u32 = 0; d2 < uniforms.input_channels_per_group_int; d2 = d2 + ${p?4:d}) {
                  ${Ce()}
                  inputChannel = inputChannel + ${p?4:d};
                }
                ${G()}
                wC = wC + uniforms.strides.y - 1;
              }
              wR = wR + uniforms.strides[0] - 1;
            }
            let value = dotProd${i?` + bias[d1 / ${m}]`:""};
            ${j.setByOffset("global_idx","value")};
          `;return`
    ${W.registerUniforms(oe).declareVariables(...Ze,j)}
      ${W.mainStart()}
      ${W.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")};
    ${K}}`};return{name:"ConvTranspose2D",shaderCache:{hint:`${t.cacheKey};${d}${_}${m}${p}${f}`,inputDependencies:y},getRunData:()=>({dispatchGroup:{x:w[0],y:w[1],z:w[2]},outputs:[{dims:r?r(a):a,dataType:e[0].dataType}],programUniforms:P}),getShaderSource:V}}}),bu,$u,vu,En,xu,Su,kn,Tu,Eu,wc=I(()=>{_c(),Qr(),rt(),bu=(e,t,r,i,a,n)=>(e-1)*t+r+(i-1)*a+1-n,$u=(e,t,r,i,a)=>{let n=Math.floor(e/2);t==="SAME_UPPER"?(r[i]=n,r[a]=e-n):t==="SAME_LOWER"&&(r[i]=e-n,r[a]=n)},vu=(e,t,r,i,a,n,s,o,u,l)=>{let d=e.length-2,p=l.length===0;u.length<d&&u.push(...Array(d-u.length).fill(0));let h=e[0],f=t[o?3:1]*a;for(let m=0,_=e.length-d-(o?1:0);m<d;++m,++_){let $=e[_],w=p?$*s[m]:l[m],y=bu($,s[m],n[m],t[_],r[m],w);$u(y,i,n,m,m+d),p&&l.push(s[m]*($-1)+u[m]+(t[_]-1)*r[m]+1-n[m]-n[m+d])}l.splice(0,0,h),l.splice(o?3:1,0,f)},En=(e,t)=>{let r=e.kernelShape.slice();if(e.kernelShape.length===0||e.kernelShape.reduce((p,h)=>p*h,1)===0){r.length=0;for(let p=2;p<t[1].dims.length;++p)r.push(t[1].dims[p])}let i=e.format==="NHWC";r.splice(0,0,t[1].dims[0]),r.splice(i?3:1,0,t[1].dims[1]);let a=e.pads.slice(),n=e.outputShape.slice(),s=e.outputPadding.slice(),o=t[0].dims,u=e.dilations.slice();if(u.reduce((p,h)=>p+h,0)===0){let p=t[0].dims.length-2;u=new Array(p).fill(1)}let l=e.strides.slice();if(l.reduce((p,h)=>p+h,0)===0){let p=t[0].dims.length-2;l=new Array(p).fill(1)}vu(o,r,u,e.autoPad,e.group,a,l,i,s,n);let d=Object.assign({},e);return Object.assign(d,{kernelShape:r,pads:a,outputPadding:s,outputShape:n,dilations:u,strides:l}),d},xu=e=>{let t=hn(e),r=e.format,i=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][typeof e.autoPad>"u"?0:e.autoPad],a=e.dilations,n=e.group??1,s=e.kernelShape,o=e.pads,u=e.strides,l=e.wIsConst(),d=e.outputPadding,p=e.outputShape;return{autoPad:i,format:r,dilations:a,group:n,kernelShape:s,outputPadding:d,outputShape:p,pads:o,strides:u,wIsConst:l,...t,cacheKey:`${e.format};${t.activation};`}},Su=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(e[0].dims.length!==4&&e[0].dims.length!==3)throw new Error("currently only support 2-dimensional conv");if(e[0].dims.length!==e[1].dims.length)throw new Error("filter does not have same dimension as input");let r=e[0].dims[t.format==="NHWC"?e[0].dims.length-1:1],i=e[1].dims[0];if(r!==i)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");let a=e[1].dims[1]*t.group;if(e.length===3&&(e[2].dims.length!==1||e[2].dims[0]!==a))throw new Error("invalid bias");let n=e[0].dims.length-2;if(t.dilations.reduce((s,o)=>s+o,0)>0&&t.dilations.length!==n)throw new Error(`dilations should be ${n}D`);if(t.strides.reduce((s,o)=>s+o,0)>0&&t.strides.length!==n)throw new Error(`strides should be ${n}D`);if(t.pads.reduce((s,o)=>s+o,0)>0&&t.pads.length!==n*2)throw new Error(`pads should be ${n*2}D`);if(t.outputPadding.length!==n&&t.outputPadding.length!==0)throw new Error(`output_padding should be ${n}D`);if(t.kernelShape.reduce((s,o)=>s+o,0)>0&&t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw new Error("invalid kernel shape");if(t.outputShape.length!==0&&t.outputShape.length!==e[0].dims.length-2)throw new Error("invalid output shape")},kn=(e,t,r,i)=>{let a=e.kernelCustomData.wT??e.compute(ht(t[1],[2,3,0,1]),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=a);let n=[t[0],a];t.length===3&&n.push(t[2]),e.compute(wu(n,r,i),{inputs:n})},Tu=(e,t)=>{let r=t.format==="NHWC",i=[e.inputs[0].reshape(r?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&i.push(e.inputs[2]);let a=t.kernelShape;(a.length===0||a[0]===0)&&(a=[e.inputs[1].dims[2]]);let n=t.dilations;(n.length===0||n[0]===0)&&(n=[1]);let s=t.strides;(s.length===0||s[0]===0)&&(s=[1]);let o=t.pads;o.length===0&&(o=[0,0]),o=[0,o[0],0,o[1]],s=[1].concat(s),n=[1].concat(n),a=[1].concat(a);let u=t.outputPadding;u=[0].concat(u);let l=En({...t,pads:o,strides:s,dilations:n,kernelShape:a,outputPadding:u},i);kn(e,i,l,d=>r?[d[0],d[2],d[3]]:[d[0],d[1],d[3]])},Eu=(e,t)=>{if(Su(e.inputs,t),e.inputs[0].dims.length===3)Tu(e,t);else{let r=En(t,e.inputs);kn(e,e.inputs,r)}}}),ku,Iu,zu,bc=I(()=>{le(),te(),b(),J(),ku=(e,t,r,i)=>{let a=D.size(t),n=t.length,s=C("input",e,n),o=q("output",e,n),u=r.dataType===6?r.getInt32Array()[0]:Number(r.getBigInt64Array()[0]),l=D.normalizeAxis(u,n),d=p=>{let h=` i32(${s.indicesGet("inputIndices","uniforms.axis")}) `,f=M("uniforms.input_shape","uniforms.axis",n),m=i.reverse?h+(i.exclusive?" + 1":""):"0",_=i.reverse?f:h+(i.exclusive?"":" + 1");return`
                ${p.registerUniform("outputSize","u32").registerUniform("axis","u32").declareVariables(s,o)}
                ${p.mainStart()}
                  ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
                  var inputIndices = ${o.offsetToIndices("global_idx")};
                  var sum = ${o.type.value}(0);
                  let first : i32 = ${m};
                  let last : i32 = ${_};
                  for (var i : i32 = first; i < last; i++) {
                    ${s.indicesSet("inputIndices","uniforms.axis","u32(i)")};
                    sum = sum + ${s.getByIndices("inputIndices")};
                  }
                  ${o.setByOffset("global_idx","sum")};
                }`};return{name:"CumSum",shaderCache:{hint:i.cacheKey,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:t,dataType:e}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:[{type:12,data:a},{type:12,data:l},...k(t,t)]}),getShaderSource:d}},Iu=(e,t)=>{let r=e.inputs[0].dims,i=e.inputs[0].dataType,a=e.inputs[1];e.compute(ku(i,r,a,t),{inputs:[0]})},zu=e=>{let t=e.exclusive===1,r=e.reverse===1;return g({exclusive:t,reverse:r})}}),Cu,Au,Ou,Ru,Bu,$c=I(()=>{le(),te(),b(),J(),Cu=e=>{if(!e||e.length!==1)throw new Error("DepthToSpace requires 1 input.");if(e[0].dims.length!==4)throw new Error("DepthToSpace requires 4D input.")},Au=(e,t,r,i)=>{let a=[];a.push(`fn perm(i: ${i.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`);for(let n=0;n<t;++n)a.push(r.indicesSet("a",e[n],`i[${n}]`));return a.push("return a;}"),a.join(`
`)},Ou=(e,t)=>{let r,i,a,n,s,o,u=t.format==="NHWC",l=t.blocksize,d=t.mode==="DCR";u?([r,i,a,n]=e.dims,s=d?[r,i,a,l,l,n/l**2]:[r,i,a,n/l**2,l,l],o=d?[0,1,3,2,4,5]:[0,1,4,2,5,3]):([r,i,a,n]=[e.dims[0],e.dims[2],e.dims[3],e.dims[1]],s=d?[r,l,l,n/l**2,i,a]:[r,n/l**2,l,l,i,a],o=d?[0,3,4,1,5,2]:[0,1,4,2,5,3]);let p=e.reshape(s),h=p.dims.length,f=e.dataType,m=C("a",f,h),_=q("output",f,h),$=w=>`
  ${w.registerUniform("output_size","u32").declareVariables(m,_)}

  ${Au(o,h,m,_)}

  ${w.mainStart()}
    ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${_.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${_.setByOffset("global_idx",m.getByIndices("aIndices"))}
  }`;return{name:"DepthToSpace",shaderCache:{hint:`${e.dims};${t.blocksize};${t.mode}`,inputDependencies:["rank"]},getRunData:w=>{let y=u?[r,i*l,a*l,n/l**2]:[r,n/l**2,i*l,a*l],S=D.size(y),v=p.dims,z=D.sortBasedOnPerm(v,o);return{outputs:[{dims:y,dataType:w[0].dataType}],dispatchGroup:{x:Math.ceil(S/64)},programUniforms:[{type:12,data:S},...k(v,z)]}},getShaderSource:$}},Ru=(e,t)=>{Cu(e.inputs),e.compute(Ou(e.inputs[0],t))},Bu=e=>g({blocksize:e.blocksize,mode:e.mode,format:e.format})}),Ma,ca,In,Mu,Du,Pu,Uu,zn,Nu,Lu,Vu,vc=I(()=>{le(),te(),b(),J(),Ma="[a-zA-Z]|\\.\\.\\.",ca="("+Ma+")+",In="^"+ca+"$",Mu="("+ca+",)*"+ca,Du="^"+Mu+"$",Pu=class{constructor(e=-1){this.symbolToIndices=new Map,this.inputIndex=e}addSymbol(e,t){let r=this.symbolToIndices.get(e);r===void 0?r=[t]:r.push(t),this.symbolToIndices.set(e,r)}},Uu=class{constructor(e,t){var a;this.equation=t,this.hasEllipsis=!1,this.symbolToInfo=new Map,this.lhs=new Array,this.outputDims=[];let[r,i]=t.includes("->")?t.split("->",2):[t,""];if(!r.match(RegExp(Du)))throw new Error("Invalid LHS term");if(r.split(",").forEach((n,s)=>{let o=e[s].dims.slice();if(!n.match(RegExp(In)))throw new Error("Invalid LHS term");let u=this.processTerm(n,!0,o,s);this.lhs.push(u)}),i==="")i+=[...this.symbolToInfo.entries()].filter(([n,s])=>s.count===1||n==="...").map(([n])=>n).join("");else if(!i.match(RegExp(ca)))throw new Error("Invalid RHS");(a=i.match(RegExp(Ma,"g")))==null||a.forEach(n=>{if(n==="...")this.outputDims=this.outputDims.concat(this.ellipsisDims);else{let s=this.symbolToInfo.get(n);if(s===void 0)throw new Error("Invalid RHS symbol");this.outputDims.push(s.dimValue)}}),this.rhs=this.processTerm(i,!1,this.outputDims)}addSymbol(e,t,r){let i=this.symbolToInfo.get(e);if(i!==void 0){if(i.dimValue!==t&&i.count!==1)throw new Error("Dimension mismatch");i.count++,i.inputIndices.push(r)}else i={count:1,dimValue:t,inputIndices:[r]};this.symbolToInfo.set(e,i)}processTerm(e,t,r,i=-1){let a=r.length,n=!1,s=[],o=0;if(!e.match(RegExp(In))&&!t&&e!=="")throw new Error("Invalid LHS term");let u=e.match(RegExp(Ma,"g")),l=new Pu(i);return u==null||u.forEach((d,p)=>{if(d==="..."){if(n)throw new Error("Only one ellipsis is allowed per input term");n=!0;let h=a-u.length+1;if(h<0)throw new Error("Ellipsis out of bounds");if(s=r.slice(o,o+h),this.hasEllipsis){if(this.ellipsisDims.length!==s.length||this.ellipsisDims.toString()!==s.toString())throw new Error("Ellipsis dimensions mismatch")}else if(t)this.hasEllipsis=!0,this.ellipsisDims=s;else throw new Error("Ellipsis must be specified in the LHS");for(let f=0;f<s.length;f++){let m=String.fromCharCode(48+f);l.addSymbol(m,p+f),this.addSymbol(m,r[o++],i)}}else l.addSymbol(d,p+(this.hasEllipsis?this.ellipsisDims.length-1:0)),this.addSymbol(d,r[o++],i)}),l}},zn=e=>e+"_max",Nu=(e,t,r,i)=>{let a=e.map(l=>l.length).map((l,d)=>C(`input${d}`,t,l)),n=D.size(i),s=q("output",t,i.length),o=[...r.symbolToInfo.keys()].filter(l=>!r.rhs.symbolToIndices.has(l)),u=l=>{let d=[],p="var prod = 1.0;",h="var sum = 0.0;",f="sum += prod;",m=[],_=[],$=[],w=[],y=r.symbolToInfo.size===r.rhs.symbolToIndices.size;r.symbolToInfo.forEach((v,z)=>{var B;if(r.rhs.symbolToIndices.has(z)){let R=(B=r.rhs.symbolToIndices.get(z))==null?void 0:B[0];R!==void 0&&r.lhs.forEach((P,V)=>{if(v.inputIndices.includes(V)){let W=P.symbolToIndices.get(z);if(W===void 0)throw new Error("Invalid symbol error");W.forEach(oe=>{d.push(`${a[V].indicesSet(`input${V}Indices`,oe,s.indicesGet("outputIndices",R))}`)})}})}else r.lhs.forEach((R,P)=>{if(v.inputIndices.includes(P)){let V=R.symbolToIndices.get(z);if(V===void 0)throw new Error("Invalid symbol error");V.forEach(W=>{m.push(`${a[P].indicesSet(`input${P}Indices`,W,`${z}`)}`)}),w.push(`prod *= ${a[P].getByIndices(`input${P}Indices`)};`)}}),_.push(`for(var ${z}: u32 = 0; ${z} < uniforms.${zn(z)}; ${z}++) {`),$.push("}")});let S=y?[...d,`let sum = ${a.map((v,z)=>v.getByIndices(`input${z}Indices`)).join(" * ")};`]:[...d,h,..._,...m,p,...w,f,...$];return`
            ${l.registerUniforms(o.map(v=>({name:`${zn(v)}`,type:"u32"}))).registerUniform("outputSize","u32").declareVariables(...a,s)}

            ${l.mainStart()}
            ${l.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
            var outputIndices = ${s.offsetToIndices("global_idx")};
            ${a.map((v,z)=>`var input${z}Indices: ${a[z].type.indices};`).join(`
`)}
            ${S.join(`
`)};
            ${s.setByOffset("global_idx","sum")};
          }`};return{name:"Einsum",shaderCache:{hint:r.equation,inputDependencies:e.map(()=>"rank")},getRunData:()=>{let l=o.filter(p=>r.symbolToInfo.has(p)).map(p=>{var h;return{type:12,data:((h=r.symbolToInfo.get(p))==null?void 0:h.dimValue)||0}});l.push({type:12,data:n});let d=e.map((p,h)=>[...k(p)]).reduce((p,h)=>p.concat(h),l);return d.push(...k(i)),{outputs:[{dims:i,dataType:t}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:d}},getShaderSource:u}},Lu=(e,t)=>{let r=new Uu(e.inputs,t.equation),i=r.outputDims,a=e.inputs.map((n,s)=>n.dims);e.compute(Nu(a,e.inputs[0].dataType,r,i))},Vu=e=>{let t=e.equation.replace(/\s+/g,"");return g({equation:t})}}),Fu,Cn,qu,Gu,Wu,xc=I(()=>{le(),te(),J(),Fu=e=>{if(!e||e.length!==2)throw new Error("Expand requires 2 input.");let t=e[0].dims,r=Array.from(e[1].getBigInt64Array(),Number),i=r.length<t.length?0:r.length-t.length,a=t.length<r.length?0:t.length-r.length;for(;i<r.length&&a<t.length;++i,++a)if(r[i]!==t[a]&&r[i]!==1&&t[a]!==1)throw new Error("Expand requires shape to be broadcastable to input")},Cn=(e,t)=>{let r=e.length-t.length,i=[];for(let a=0;a<r;++a)i.push(e[a]);for(let a=0;a<t.length;++a)i.push(t[a]===1?e[a+r]:t[a]);return i},qu=(e,t)=>e.length>t.length?Cn(e,t):Cn(t,e),Gu=e=>{let t=e[0].dims,r=Array.from(e[1].getBigInt64Array(),Number),i=qu(t,r),a=e[0].dataType,n=a===9||D.size(t)===1,s=a===9||t.length>0&&t[t.length-1]%4===0?4:1,o=n||i.length>0&&i[i.length-1]%4===0?4:1,u=Math.ceil(D.size(i)/o),l=p=>{let h=C("input",a,t.length,s),f=q("output",a,i.length,o),m;if(a===9){let _=($,w,y="")=>`
          let outputIndices${w} = ${f.offsetToIndices(`outputOffset + ${w}u`)};
          let offset${w} = ${h.broadcastedIndicesToOffset(`outputIndices${w}`,f)};
          let index${w} = offset${w} / 4u;
          let component${w} = offset${w} % 4u;
          ${$}[${w}] = ${y}(${h.getByOffset(`index${w}`)}[component${w}]);
        `;m=`
        let outputOffset = global_idx * ${o};
        var data = vec4<u32>(0);
        ${_("data",0,"u32")}
        ${_("data",1,"u32")}
        ${_("data",2,"u32")}
        ${_("data",3,"u32")}
        ${f.setByOffset("global_idx","data")}
      }`}else m=`
        let outputIndices = ${f.offsetToIndices(`global_idx * ${o}`)};
        let inputOffset = ${h.broadcastedIndicesToOffset("outputIndices",f)};
        let data = ${f.type.value}(${h.getByOffset(`inputOffset / ${s}`)});
        ${f.setByOffset("global_idx","data")}
      }`;return`
    ${p.registerUniform("vec_size","u32").declareVariables(h,f)}
    ${p.mainStart()}
    ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
    ${m}`},d=[{type:12,data:u},...k(t,i)];return{name:"Expand",shaderCache:{hint:`${i.length};${s}${o}`,inputDependencies:["rank"]},getShaderSource:l,getRunData:()=>({outputs:[{dims:i,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:d})}},Wu=e=>{Fu(e.inputs),e.compute(Gu(e.inputs),{inputs:[0]})}}),ju,Hu,Sc=I(()=>{le(),te(),J(),cn(),ju=e=>{let t=e[0].dataType,r=D.size(e[0].dims),i=D.size(e[1].dims),a=i%4===0,n=s=>{let o=C("x",t,[1],4),u=C("bias",t,[1],4),l=q("y",t,[1],4),d=[{name:"output_vec_size",type:"u32"},{name:"bias_size",type:"u32"}],p=f=>`
      let bias${f}_offset: u32 = (global_idx * 4 + ${f}) % uniforms.bias_size;
      let bias${f} = ${u.getByOffset(`bias${f}_offset / 4`)}[bias${f}_offset % 4];`,h=a?`
      let bias = ${u.getByOffset("global_idx % (uniforms.bias_size / 4)")};`:`${p(0)}${p(1)}${p(2)}${p(3)}
      let bias = ${o.type.value}(bias0, bias1, bias2, bias3);`;return`${s.registerUniforms(d).declareVariables(o,u,l)}

    ${dn(E(t))}

    ${s.mainStart(T)}
      ${s.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_vec_size")}

      let x = ${o.getByOffset("global_idx")};
      ${h}
      let x_in = x + bias;
      ${l.setByOffset("global_idx",pn("x_in"))}
    }`};return{name:"FastGeluWithBias",shaderCache:{hint:`${a}`,inputDependencies:["type","type"]},getShaderSource:n,getRunData:s=>({outputs:[{dims:s[0].dims,dataType:s[0].dataType}],programUniforms:[{type:12,data:Math.ceil(r/4)},{type:12,data:i}],dispatchGroup:{x:Math.ceil(r/T/4)}})}},Hu=e=>{e.inputs.length<2||D.size(e.inputs[1].dims)===0?ko(e):e.compute(ju(e.inputs))}}),Ku,Zu,Qu,Xu,Tc=I(()=>{le(),te(),b(),J(),Ku=e=>{if(!e||e.length!==2)throw new Error("Gather requires 2 inputs.")},Zu=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r.length,n=D.normalizeAxis(t.axis,a),s=r.slice(0);s.splice(n,1,...i);let o=r[n],u=e[0].dataType===9?4:1,l=Math.ceil(D.size(s)/u),d=[{type:12,data:l},{type:6,data:o},{type:12,data:n},...k(e[0].dims,e[1].dims,s)],p=h=>{let f=C("data",e[0].dataType,e[0].dims.length,u),m=C("inputIndices",e[1].dataType,e[1].dims.length),_=q("output",e[0].dataType,s.length,u),$=y=>{let S=i.length,v=`var indicesIndices${y}  = ${m.type.indices}(0);`;for(let z=0;z<S;z++)v+=`${S>1?`indicesIndices${y}[${z}]`:`indicesIndices${y}`} = ${s.length>1?`outputIndices${y}[uniforms.axis + ${z}]`:`outputIndices${y}`};`;v+=`
          var idx${y} = ${m.getByIndices(`indicesIndices${y}`)};
          if (idx${y} < 0) {
            idx${y} = idx${y} + uniforms.axisDimLimit;
          }
          var dataIndices${y} : ${f.type.indices};
        `;for(let z=0,B=0;z<a;z++)z===n?(v+=`${a>1?`dataIndices${y}[${z}]`:`dataIndices${y}`} = u32(idx${y});`,B+=S):(v+=`${a>1?`dataIndices${y}[${z}]`:`dataIndices${y}`} = ${s.length>1?`outputIndices${y}[${B}]`:`outputIndices${y}`};`,B++);return v},w;if(e[0].dataType===9){let y=(S,v,z="")=>`
          let outputIndices${v} = ${_.offsetToIndices(`outputOffset + ${v}u`)};
          ${$(v)};
          let offset${v} = ${f.indicesToOffset(`dataIndices${v}`)};
          let index${v} = offset${v} / 4u;
          let component${v} = offset${v} % 4u;
          ${S}[${v}] = ${z}(${f.getByOffset(`index${v}`)}[component${v}]);
        `;w=`
        let outputOffset = global_idx * ${u};
        var value = vec4<u32>(0);
        ${y("value",0,"u32")}
        ${y("value",1,"u32")}
        ${y("value",2,"u32")}
        ${y("value",3,"u32")}
        ${_.setByOffset("global_idx","value")}
      `}else w=`
      let outputIndices = ${_.offsetToIndices("global_idx")};
      ${$("")};
      let value = ${f.getByIndices("dataIndices")};
      ${_.setByOffset("global_idx","value")};
      `;return`
      ${h.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(f,m,_)}
      ${h.mainStart()}
        ${h.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        ${w}
      }`};return{name:"Gather",shaderCache:{hint:t.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:s,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:d}),getShaderSource:p}},Qu=e=>g({axis:e.axis}),Xu=(e,t)=>{let r=e.inputs;Ku(r),e.compute(Zu(e.inputs,t))}}),Yu,Ju,el,Ec=I(()=>{le(),te(),J(),Yu=(e,t,r,i,a,n,s,o,u)=>{let l=[{type:12,data:n},{type:12,data:i},{type:12,data:a},{type:12,data:r},{type:12,data:s},{type:12,data:o},{type:12,data:u}],d=[n];l.push(...k(t.dims,d));let p=h=>{let f=C("indices_data",t.dataType,t.dims.length),m=q("input_slice_offsets_data",12,1,1),_=[f,m],$=[{name:"output_size",type:"u32"},{name:"batch_dims",type:"u32"},{name:"input_dims",type:"u32",length:a.length},{name:"sizes_from_slice_dims_data",type:"u32",length:r.length},{name:"num_slices_per_batch",type:"u32"},{name:"input_batch_stride",type:"u32"},{name:"num_slice_dims",type:"u32"}];return`
  ${h.registerUniforms($).declareVariables(..._)}
  ${h.mainStart()}
    ${h.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let batch_idx = global_idx / uniforms.num_slices_per_batch;
    let base_offset = batch_idx * uniforms.input_batch_stride;

    let slice_indices_base_offset = global_idx * uniforms.num_slice_dims;
    var relative_slice_offset = 0;
    for (var dim_idx = 0u; dim_idx < uniforms.num_slice_dims; dim_idx ++) {
      var index = i32(indices_data[dim_idx + slice_indices_base_offset].x);
      let input_dim_idx = uniforms.batch_dims + dim_idx;
      if (index < 0) {
        ${a.length===1?"index += i32(uniforms.input_dims);":"index += i32(uniforms.input_dims[input_dim_idx]);"}
      }
      ${r.length===1?"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data);":"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data[dim_idx]);"}
    }

    input_slice_offsets_data[global_idx] =  base_offset + u32(relative_slice_offset);
  }`};return e.compute({name:"computeSliceOffsets",shaderCache:{hint:`${a.length}_${r.length}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:d,dataType:e.inputs[1].dataType}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:l}),getShaderSource:p},{inputs:[t],outputs:[-1]})[0]},Ju=(e,t)=>{let r=e.inputs,i=r[0].dims,a=r[0].dataType,n=r[1].dims,s=n[n.length-1],o=D.sizeToDimension(n,n.length-1),u=D.sizeFromDimension(i,t.batchDims+s),l=D.sizeToDimension(i,t.batchDims),d=D.sizeFromDimension(i,t.batchDims),p=o/l,h=new Array(s),f=u;for(let v=0;v<s;++v)h[s-1-v]=f,f*=i[t.batchDims+s-1-v];let m=Yu(e,r[1],h,t.batchDims,i,o,p,d,s),_=t.batchDims+s;if(_>i.length)throw new Error("last dimension of indices must not be larger than rank of input tensor");let $=n.slice(0,-1).concat(i.slice(_)),w=D.size($),y=[{type:12,data:w},{type:12,data:u},...k(r[0].dims,m.dims,$)],S=v=>{let z=C("data",r[0].dataType,r[0].dims.length),B=C("slice_offsets",12,m.dims.length),R=q("output",r[0].dataType,$.length);return`
          ${v.registerUniform("output_size","u32").registerUniform("slice_size","u32").declareVariables(z,B,R)}
            ${v.mainStart()}
            ${v.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let slice_offset = slice_offsets[global_idx / uniforms.slice_size];
          output[global_idx] = data[u32(slice_offset) + global_idx % uniforms.slice_size];
        }`};e.compute({name:"GatherND",shaderCache:{hint:t.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:$,dataType:a}],dispatchGroup:{x:Math.ceil(w/64)},programUniforms:y}),getShaderSource:S},{inputs:[r[0],m]})},el=e=>({batchDims:e.batch_dims,cacheKey:""})}),tl,rl,il,al,kc=I(()=>{le(),te(),b(),J(),tl=(e,t)=>{if(e.length<3||e.length>4)throw new Error("GatherBlockQuantized requires 3 or 4 inputs.");let r=D.normalizeAxis(t.quantizeAxis,e[0].dims.length),i=t.blockSize,a=e[0],n=e[2],s=e.length===4?e[3]:void 0;if(n.dims.length!==a.dims.length||!a.dims.map((o,u)=>u===r?Math.ceil(o/i)===n.dims[u]:o===n.dims[u]).reduce((o,u)=>o&&u,!0))throw new Error("Scales must have the same rank as the input tensor and the dims should match except on gatherAxis.");if(s){if(s.dataType!==a.dataType)throw new Error("Zero point must have the same data type as the input tensor.");if(s.dims.length!==n.dims.length||!s.dims.map((o,u)=>o===n.dims[u]).reduce((o,u)=>o&&u,!0))throw new Error("Zero point must have the same rank as the input tensor and the dims should match except on quantizeAxis.")}},rl=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r.length,n=D.normalizeAxis(t.gatherAxis,a),s=D.normalizeAxis(t.quantizeAxis,a),o=r.slice(0);o.splice(n,1,...i);let u=D.size(o),l=e[2].dataType,d=e[0].dataType===22,p=[{type:12,data:u},{type:12,data:s},{type:12,data:n},{type:12,data:t.blockSize},...k(...e.map((f,m)=>f.dims),o)],h=f=>{let m=C("data",e[0].dataType,e[0].dims.length),_=C("inputIndices",e[1].dataType,e[1].dims.length),$=C("scales",e[2].dataType,e[2].dims.length),w=e.length>3?C("zeroPoint",e[3].dataType,e[3].dims.length):void 0,y=q("output",l,o.length),S=[m,_,$];w&&S.push(w);let v=[{name:"output_size",type:"u32"},{name:"quantize_axis",type:"u32"},{name:"gather_axis",type:"u32"},{name:"block_size",type:"u32"}];return`
        ${f.registerUniforms(v).declareVariables(...S,y)}
        ${f.mainStart()}
        let output_indices = ${y.offsetToIndices("global_idx")};
        var indices_indices = ${_.type.indices}(0);
        ${i.length>1?`
          for (var i: u32 = 0; i < ${i.length}; i++) {
            let index = ${y.indicesGet("output_indices","uniforms.gather_axis + i")};
            ${_.indicesSet("indices_indices","i","index")};
          }`:`indices_indices = ${y.indicesGet("output_indices","uniforms.gather_axis")};`};
        var data_indices = ${m.type.indices}(0);
        for (var i: u32 = 0; i < uniforms.gather_axis; i++) {
          let index = ${y.indicesGet("output_indices","i")};
          ${m.indicesSet("data_indices","i","index")};
        }
        var index_from_indices = ${_.getByIndices("indices_indices")};
        if (index_from_indices < 0) {
          index_from_indices += ${r[n]};
        }
        ${m.indicesSet("data_indices","uniforms.gather_axis","u32(index_from_indices)")};
        for (var i = uniforms.gather_axis + 1; i < ${o.length}; i++) {
          let index = ${y.indicesGet("output_indices",`i + ${i.length} - 1`)};
          ${m.indicesSet("data_indices","i","index")};
        }
        let data_offset = ${m.indicesToOffset("data_indices")};
        let data_index = data_offset % 8;
        // Convert 4-bit packed data to 8-bit packed data.
        let packed_4bit_quantized_data = ${m.getByOffset("data_offset / 8")};
        let packed_8bit_quantized_data = (packed_4bit_quantized_data >> (4 * (data_index % 2))) & 0x0f0f0f0f;
        let quantized_data_vec = ${d?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_quantized_data));
        let quantized_data = quantized_data_vec[data_index / 2];
        var scale_indices = data_indices;
        let quantize_axis_index = ${$.indicesGet("data_indices","uniforms.quantize_axis")} / uniforms.block_size;
        ${$.indicesSet("scale_indices","uniforms.quantize_axis","quantize_axis_index")};
        var scale = ${$.getByIndices("scale_indices")};
        ${w?`
              let zero_point_indices = scale_indices;
              let zero_point_offset = ${w.indicesToOffset("zero_point_indices")};
              let zero_point_index = zero_point_offset % 8;
              let packed_4bit_zero_points = ${w.getByOffset("zero_point_offset / 8")};
              let packed_8bit_zero_points = (packed_4bit_zero_points >> (4 * (zero_point_index % 2))) & 0x0f0f0f0f;
              let zero_point_vec = ${d?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_zero_points));
              let zero_point = zero_point_vec[zero_point_index / 2];`:"var zero_point = 0"};
        let dequantized_data = ${E(l)}(quantized_data - zero_point) * scale;
        ${y.setByOffset("global_idx","dequantized_data")};
    }`};return{name:"GatherBlockQuantized",shaderCache:{hint:`${t.cacheKey};${e.filter((f,m)=>m!==1).map(f=>f.dims.join("_")).join(";")}`,inputDependencies:Array.from({length:e.length},(f,m)=>"rank")},getRunData:()=>({outputs:[{dims:o,dataType:l}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:p}),getShaderSource:h}},il=(e,t)=>{let r=e.inputs;tl(r,t),e.compute(rl(e.inputs,t))},al=e=>g({blockSize:e.blockSize,gatherAxis:e.gatherAxis,quantizeAxis:e.quantizeAxis})}),nl,sl,ol,ul,Ic=I(()=>{le(),te(),b(),J(),nl=e=>{if(!e||e.length!==2)throw new Error("GatherElements requires 2 inputs.");if(e[0].dims.length<1)throw new Error("GatherElements requires that the data input be rank >= 1.");if(e[0].dims.length!==e[1].dims.length)throw new Error(`GatherElements requires that the data input and
                     indices input tensors be of same rank.`)},sl=(e,t)=>{let r=e[0].dims,i=e[0].dataType,a=r.length,n=e[1].dims,s=e[1].dataType,o=D.normalizeAxis(t.axis,a),u=r[o],l=n.slice(0),d=D.size(l),p=C("input",i,a),h=C("indicesInput",s,n.length),f=q("output",i,l.length),m=[{type:12,data:d},{type:6,data:u},{type:12,data:o}];return m.push(...k(r,n,l)),{name:"GatherElements",shaderCache:{inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:l,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:m}),getShaderSource:_=>`
      ${_.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(p,h,f)}
      ${_.mainStart()}
      ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

      let outputIndices = ${f.offsetToIndices("global_idx")};

      var idx = ${h.getByOffset("global_idx")};
      if (idx < 0) {
        idx = idx + uniforms.axisDimLimit;
      }
      var inputIndices = ${p.type.indices}(outputIndices);
      ${p.indicesSet("inputIndices","uniforms.axis","u32(idx)")};
      let value = ${p.getByIndices("inputIndices")};

      ${f.setByOffset("global_idx","value")};
  }`}},ol=e=>g({axis:e.axis}),ul=(e,t)=>{let r=e.inputs;nl(r),e.compute(sl(e.inputs,t))}}),ll,dl,pl,cl,zc=I(()=>{le(),te(),J(),ll=e=>{if(!e)throw new Error("Input is missing");if(e.length<2||e.length>3)throw new Error("Invaid input number.");if(e.length===3&&e[2].dims.length>2)throw new Error("Invalid input shape of C");if(e[0].dataType!==e[1].dataType||e.length===3&&e[0].dataType!==e[2].dataType)throw new Error("Input types are mismatched")},dl=(e,t)=>{let r=e[0].dims.slice(),i=e[1].dims.slice(),[a,n,s]=li.getShapeOfGemmResult(r,t.transA,i,t.transB,e.length===3?e[2].dims:void 0),o=[a,n];if(!o)throw new Error("Can't use gemm on the given tensors");let u=16,l=Math.ceil(n/u),d=Math.ceil(a/u),p=!0,h=D.size(o),f=[{type:12,data:p?l:h},{type:12,data:a},{type:12,data:n},{type:12,data:s},{type:1,data:t.alpha},{type:1,data:t.beta}],m=["type","type"];e.length===3&&(f.push(...k(e[2].dims)),m.push("rank")),f.push(...k(o));let _=w=>{let y="";t.transA&&t.transB?y="value += a[k * uniforms.M + m] * b[n * uniforms.K + k];":t.transA&&!t.transB?y="value += a[k * uniforms.M + m] * b[k * uniforms.N + n];":!t.transA&&t.transB?y="value += a[m * uniforms.K + k] * b[n * uniforms.K + k];":!t.transA&&!t.transB&&(y="value += a[m * uniforms.K + k] * b[k * uniforms.N + n];");let S=t.alpha===1?"":"value *= uniforms.alpha;",v=C("a",e[0].dataType,e[0].dims),z=C("b",e[1].dataType,e[1].dims),B=v.type.value,R=null,P=[v,z];e.length===3&&(R=C("c",e[2].dataType,e[2].dims.length),P.push(R));let V=q("output",e[0].dataType,o.length);P.push(V);let W=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}];return`
  ${w.registerUniforms(W).declareVariables(...P)}

  ${w.mainStart()}
    ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let m = global_idx / uniforms.N;
    let n = global_idx % uniforms.N;

    var value = ${B}(0);
    for (var k: u32 = 0u; k < uniforms.K; k++) {
      ${y}
    }

    ${S}
    ${R!=null?`let cOffset = ${R.broadcastedIndicesToOffset("vec2(m, n)",V)}; value += ${B}(uniforms.beta) * ${R.getByOffset("cOffset")};`:""}
    output[global_idx] = value;
  }`},$=w=>{let y=C("a",e[0].dataType,e[0].dims),S=C("b",e[1].dataType,e[1].dims),v=null,z=[y,S];e.length===3&&(v=C("c",e[2].dataType,e[2].dims.length),z.push(v));let B=q("output",e[0].dataType,o.length);z.push(B);let R=[{name:"num_tile_n",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}],P="",V="";t.transA&&t.transB?(V=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${y.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,P="value += tile_a[k][local_id.y] * tile_b[local_id.x][k];"):t.transA&&!t.transB?(V=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${y.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,P="value += tile_a[k][local_id.y] * tile_b[k][local_id.x];"):!t.transA&&t.transB?(V=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${y.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,P="value += tile_a[local_id.y][k] * tile_b[local_id.x][k];"):!t.transA&&!t.transB&&(V=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${y.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,P="value += tile_a[local_id.y][k] * tile_b[k][local_id.x];");let W=t.alpha===1?"":"value *= uniforms.alpha;";return`
  ${w.registerUniforms(R).declareVariables(...z)}
  var<workgroup> tile_a: array<array<${y.type.storage}, ${u}>, ${u}>;
  var<workgroup> tile_b: array<array<${S.type.storage}, ${u}>, ${u}>;
  ${w.mainStart([u,u,1])}
    let tile_col_start = (workgroup_index % uniforms.num_tile_n) * ${u};
    let tile_row_start = (workgroup_index / uniforms.num_tile_n) * ${u};
    let num_tiles = (uniforms.K - 1) / ${u} + 1;
    var k_start = 0u;
    var value = ${B.type.value}(0);
    for (var t: u32 = 0u; t < num_tiles; t++) {
      ${V}
      k_start = k_start + ${u};
      workgroupBarrier();

      for (var k: u32 = 0u; k < ${u}; k++) {
        ${P}
      }
      workgroupBarrier();
    }

    ${W}
    let m = tile_row_start + local_id.y;
    let n = tile_col_start + local_id.x;
    ${v!=null?`let cOffset = ${v.broadcastedIndicesToOffset("vec2(m, n)",B)}; value += ${B.type.value}(uniforms.beta) * ${v.getByOffset("cOffset")};`:""}
    if (m < uniforms.M && n < uniforms.N) {
      output[m * uniforms.N + n] = value;
    }
  }`};return p?{name:"GemmShared",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:m},getRunData:()=>({outputs:[{dims:o,dataType:e[0].dataType}],dispatchGroup:{x:l*d},programUniforms:f}),getShaderSource:$}:{name:"Gemm",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:m},getRunData:()=>({outputs:[{dims:o,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:f}),getShaderSource:_}},pl=e=>{let t=e.transA,r=e.transB,i=e.alpha,a=e.beta;return{transA:t,transB:r,alpha:i,beta:a,cacheKey:`${e.transA};${e.transB};${e.alpha===1}`}},cl=(e,t)=>{ll(e.inputs),e.compute(dl(e.inputs,t))}}),Yt,nr,Xr,Yr,hl,fl,ml,gl,yl,_l,wl,bl,$l,vl,Cc=I(()=>{le(),te(),b(),J(),[Yt,nr,Xr,Yr]=[0,1,2,3],hl=e=>{if(e[0].dims.length!==4)throw new Error("only 4-D tensor is supported.");if(e[0].dims.length!==e[1].dims.length)throw new Error("input dimensions must be equal to grid dimensions");if(e[0].dims.length-2!==e[1].dims[e[1].dims.length-1])throw new Error(`last dimension of grid must be equal to ${e[0].dims.length-2}`);if(e[0].dims[0]!==e[1].dims[0])throw new Error("grid batch size must match input batch size")},fl=`
  fn gs_get_cubic_coeffs(x: f32) -> vec4<f32> {
    let cubic_alpha = -0.75f;
    let x_abs = abs(x);
    var coeffs: vec4<f32>;
    coeffs[0] = (((cubic_alpha * (x_abs + 1) - 5 * cubic_alpha) * (x_abs + 1) + 8 * cubic_alpha) * (x_abs + 1) - 4 * cubic_alpha);
    coeffs[1] = (((cubic_alpha + 2) * x_abs - (cubic_alpha + 3)) * x_abs * x_abs + 1);
    coeffs[2] = (((cubic_alpha + 2) * (1 - x_abs) - (cubic_alpha + 3)) * (1 - x_abs) * (1 - x_abs) + 1);
    coeffs[3] = (((cubic_alpha * (2 - x_abs) - 5 * cubic_alpha) * (2 - x_abs) + 8 * cubic_alpha) * (2 - x_abs) - 4 * cubic_alpha);
    return coeffs;
  }
`,ml=e=>`
  fn gs_bicubic_interpolate(p: mat4x4<${e}>, x: f32, y: f32) -> ${e} {
    var v: vec4<f32>;
    var coeffs = gs_get_cubic_coeffs(x);
    for (var i = 0; i < 4; i++) {
      v[i] = coeffs[0] * p[i][0] + coeffs[1] * p[i][1] + coeffs[2] * p[i][2] + coeffs[3] * p[i][3];
    }
    coeffs = gs_get_cubic_coeffs(y);
    let pixel = ${e}(coeffs[0] * v[0] + coeffs[1] * v[1] + coeffs[2] * v[2] + coeffs[3] * v[3]);
    return pixel;
  }
`,gl=e=>`
  fn gs_denormalize(n: f32, length: i32) -> f32 {
    ${e.alignCorners===0?`
    // alignCorners: false => [-1, 1] to [-0.5, length - 0.5]
    return ((n + 1.0) * f32(length) - 1.0) / 2.0;
    `:`
    // alignCorners: true => [-1, 1] to [0, length - 1]
    return (n + 1.0) / 2.0 * (f32(length - 1));
    `}
  }
`,yl=e=>`
  ${e.paddingMode==="reflection"?`
      fn gs_reflect(x: i32, x_min: f32, x_max: f32) -> u32 {
        var dx = 0.0;
        var fx = f32(x);
        let range = x_max - x_min;
        if (fx < x_min) {
          dx = x_min - fx;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_min + r;
          } else {
            fx = x_max - r;
          }
        } else if (fx > x_max) {
          dx = fx - x_max;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_max - r;
          } else {
            fx = x_min + r;
          }
        }
        return u32(fx);
      }`:""}
`,_l=(e,t,r)=>`
  fn pixel_at_grid(r: i32, c: i32, H: i32, W: i32, batch: u32, channel: u32, border: vec4<f32>) -> ${t} {
     var pixel = ${t}(0);
     var indices = vec4<u32>(0);
     indices[${Yt}] = batch;
     indices[${nr}] = channel;`+(()=>{switch(r.paddingMode){case"zeros":return`
          if (r >= 0 && r < H && c >=0 && c < W) {
            indices[${Xr}] = u32(r);
            indices[${Yr}] = u32(c);
          } else {
            return ${t}(0);
          }
        `;case"border":return`
          indices[${Xr}] = u32(clamp(r, 0, H - 1));
          indices[${Yr}] = u32(clamp(c, 0, W - 1));
        `;case"reflection":return`
          indices[${Xr}] = gs_reflect(r, border[1], border[3]);
          indices[${Yr}] = gs_reflect(c, border[0], border[2]);
        `;default:throw new Error(`padding mode ${r.paddingMode} is not supported`)}})()+`
    return ${e.getByIndices("indices")};
  }
`,wl=(e,t,r)=>(()=>{switch(r.mode){case"nearest":return`
          let result = pixel_at_grid(i32(round(y)), i32(round(x)), H_in, W_in, indices[${Yt}], indices[${nr}], border);
        `;case"bilinear":return`
          let x1 = i32(floor(x));
          let y1 = i32(floor(y));
          let x2 = x1 + 1;
          let y2 = y1 + 1;

          let p11 = pixel_at_grid(y1, x1, H_in, W_in, indices[${Yt}], indices[${nr}], border);
          let p12 = pixel_at_grid(y1, x2, H_in, W_in, indices[${Yt}], indices[${nr}], border);
          let p21 = pixel_at_grid(y2, x1, H_in, W_in, indices[${Yt}], indices[${nr}], border);
          let p22 = pixel_at_grid(y2, x2, H_in, W_in, indices[${Yt}], indices[${nr}], border);

          let dx2 = ${t}(f32(x2) - x);
          let dx1 = ${t}(x - f32(x1));
          let dy2 = ${t}(f32(y2) - y);
          let dy1 = ${t}(y - f32(y1));
          let result = dy2 * (dx2 * p11 + dx1 * p12) + dy1 * (dx2 * p21 + dx1 * p22);
        `;case"bicubic":return`
          let x0 = i32(floor(x)) - 1;
          let y0 = i32(floor(y)) - 1;
          var p: mat4x4<${t}>;
          for (var h = 0; h < 4; h++) {
            for (var w = 0; w < 4; w++) {
              p[h][w] = pixel_at_grid(h + y0, w + x0, H_in, W_in, indices[${Yt}], indices[${nr}], border);
            }
          }

          let dx = x - f32(x0 + 1);
          let dy = y - f32(y0 + 1);
          let result = gs_bicubic_interpolate(p, dx, dy);
        `;default:throw new Error(`mode ${r.mode} is not supported`)}})()+`${e.setByOffset("global_idx","result")}`,bl=(e,t)=>{let r=C("x",e[0].dataType,e[0].dims.length),i=[e[1].dims[0],e[1].dims[1],e[1].dims[2]],a=C("grid",e[1].dataType,i.length,2),n=[e[0].dims[0],e[0].dims[1],e[1].dims[1],e[1].dims[2]];t.format==="NHWC"&&(n=[e[0].dims[0],e[1].dims[1],e[1].dims[2],e[0].dims[3]],[Yt,nr,Xr,Yr]=[0,3,1,2]);let s=q("output",e[0].dataType,n.length),o=r.type.value,u=D.size(n),l=[{type:12,data:u},...k(e[0].dims,i,n)],d=p=>`
  ${p.registerUniform("output_size","u32").declareVariables(r,a,s)}
  ${fl}
  ${ml(o)}
  ${gl(t)}
  ${yl(t)}
  ${_l(r,o,t)}

  ${p.mainStart()}
    ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let H_in = i32(uniforms.x_shape[${Xr}]);
      let W_in = i32(uniforms.x_shape[${Yr}]);

      ${t.alignCorners===0?`
      let x_min = -0.5;
      let x_max = f32(W_in) - 0.5;
      let y_min = -0.5;
      let y_max = f32(H_in) - 0.5;
      `:`
      let x_min = 0.0;
      let x_max = f32(W_in) - 1.0;
      let y_min = 0.0;
      let y_max = f32(H_in) - 1.0;
      `};
      let border = vec4<f32>(x_min, y_min, x_max, y_max);

      let indices = ${s.offsetToIndices("global_idx")};
      var grid_indices = vec3<u32>(indices[${Yt}], indices[${Xr}], indices[${Yr}]);
      let nxy = ${a.getByIndices("grid_indices")};
      var x = gs_denormalize(f32(nxy[0]), W_in);
      var y = gs_denormalize(f32(nxy[1]), H_in);

      ${wl(s,o,t)}
  }`;return{name:"GridSample",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:["type","type"]},getRunData:p=>{let h=D.size(n);return{outputs:[{dims:n,dataType:p[0].dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:l}},getShaderSource:d}},$l=(e,t)=>{hl(e.inputs),e.compute(bl(e.inputs,t))},vl=e=>g({alignCorners:e.align_corners,mode:e.mode,paddingMode:e.padding_mode,format:e.format})}),wt,xl,Sl,An,Tl,ha,El,kl=I(()=>{le(),te(),b(),hi(),un(),J(),rt(),wt=(e,t)=>e.length>t&&e[t].dims.length>0?e[t]:void 0,xl=(e,t)=>{let r=e[0],i=wt(e,1),a=wt(e,2),n=wt(e,3),s=wt(e,4),o=wt(e,5),u=wt(e,6),l=wt(e,7);if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let d=r.dims[0],p=r.dims[1],h=r.dims.length===3?r.dims[2]:t.numHeads*r.dims[4],f=p,m=0,_=0,$=Math.floor(h/t.numHeads);if(u&&l&&D.size(u.dims)&&D.size(l.dims)){if(u.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(u.dims[0]!==d||u.dims[1]!==t.numHeads||u.dims[3]!==$)throw new Error('Input "past_key" shape (batch_size, num_heads, past_sequence_length, head_size)');if(l.dims[0]!==d||l.dims[1]!==t.numHeads||l.dims[3]!==$)throw new Error('Input "past_value" shape (batch_size, num_heads, past_sequence_length, head_size)');if(u.dims[2]!==l.dims[2])throw new Error('Input "past_key" and "past_value" shall have same dim 2 (past_sequence_length)');if(l.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');m=u.dims[2],_=u.dims[2]}else if(u&&D.size(u.dims)||l&&D.size(l.dims))throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let w;if(i&&D.size(i.dims)>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(i.dims.length<3||i.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==i.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(i.dims.length===3){if(i.dims[2]!==r.dims[2])throw new Error('Input "query" and "key" shall have same dim 2 (hidden_size)');w=2,f=i.dims[1]}else if(i.dims.length===5){if(i.dims[2]!==t.numHeads||i.dims[3]!==2||i.dims[4]!==$)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(a)throw new Error('Expect "value" be none when "key" has packed kv format.');w=5,f=i.dims[1]}else{if(i.dims[1]!==t.numHeads||i.dims[3]!==$)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');w=0,f=i.dims[2]}}else{if(r.dims.length!==5)throw new Error('Input "query" is expected to have 5 dimensions when key is empty');if(r.dims[2]!==t.numHeads||r.dims[3]!==3)throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');w=3}if(n&&D.size(n.dims)>0){if(n.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimension');if(i&&i.dims.length===5&&i.dims[3]===2)throw new Error("bias is not allowed for packed kv.")}let y=m+f,S=0;if(s&&D.size(s.dims)>0){S=8;let R=s.dims;throw R.length===1?R[0]===d?S=1:R[0]===3*d+2&&(S=3):R.length===2&&R[0]===d&&R[1]===y&&(S=5),S===8?new Error('Input "key_padding_mask" shape shall be (batch_size) or (batch_size, total_sequence_length)'):new Error("Mask not supported")}let v=!1,z=h;if(a&&D.size(a.dims)>0){if(a.dims.length!==3&&a.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==a.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(a.dims.length===3){if(f!==a.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');z=a.dims[2]}else{if(f!==a.dims[2])throw new Error('Input "key" and "value" shall have the same dim 2 (kv_sequence_length)');z=a.dims[1]*a.dims[3],v=!0}}let B=!1;if(s&&D.size(s.dims)>0)throw new Error("Key padding mask is not supported");if(o&&D.size(o.dims)>0){if(o.dims.length!==4)throw new Error('Input "attention_bias" is expected to have 4 dimensions');if(o.dims[0]!==d||o.dims[1]!==t.numHeads||o.dims[2]!==p||o.dims[3]!==y)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:d,sequenceLength:p,pastSequenceLength:m,kvSequenceLength:f,totalSequenceLength:y,maxSequenceLength:_,inputHiddenSize:0,hiddenSize:h,vHiddenSize:z,headSize:$,vHeadSize:Math.floor(z/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:S,scale:t.scale,broadcastResPosBias:B,passPastInKv:v,qkvFormat:w}},Sl=e=>g({...e}),An=g({perm:[0,2,1,3]}),Tl=(e,t,r,i,a,n,s)=>{let o=[i,a,n],u=D.size(o),l=[{type:12,data:u},{type:12,data:s},{type:12,data:n}],d=p=>{let h=q("qkv_with_bias",t.dataType,o),f=C("qkv",t.dataType,o),m=C("bias",r.dataType,o),_=[{name:"output_size",type:"u32"},{name:"bias_offset",type:"u32"},{name:"hidden_size",type:"u32"}];return`
  ${p.registerUniforms(_).declareVariables(f,m,h)}
  ${p.mainStart()}
    ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let bias_offset_idx = (global_idx % uniforms.hidden_size) + uniforms.bias_offset;

    qkv_with_bias[global_idx] = qkv[global_idx] + bias[bias_offset_idx];
  }`};return e.compute({name:"MultiHeadAttentionAddBias",shaderCache:{inputDependencies:["type","type"]},getRunData:()=>({outputs:[{dims:o,dataType:t.dataType,gpuDataType:0}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:l}),getShaderSource:d},{inputs:[t,r],outputs:[-1]})[0]},ha=(e,t,r,i,a,n,s,o)=>{let u=n;if(s&&D.size(s.dims)>0){if(i===1)throw new Error("AddBiasReshape is not implemented. Please export your model with packed QKV or KV");return u=Tl(e,n,s,t,i,r*a,o),u=u.reshape([t,i,r,a]),r===1||i===1?u:e.compute(ht(u,An.perm),{inputs:[u],outputs:[-1]})[0]}else return n.dims.length===3&&(u=n.reshape([t,i,r,a])),r===1||i===1?u:e.compute(ht(u,An.perm),{inputs:[u],outputs:[-1]})[0]},El=(e,t)=>{let r=xl(e.inputs,t),i=e.inputs[0],a=wt(e.inputs,1),n=wt(e.inputs,2),s=wt(e.inputs,3),o=wt(e.inputs,4),u=wt(e.inputs,5),l=wt(e.inputs,6),d=wt(e.inputs,7);if(i.dims.length===5)throw new Error("Packed QKV is not implemented");if((a==null?void 0:a.dims.length)===5)throw new Error("Packed KV is not implemented");let p=a&&n&&a.dims.length===4&&n.dims.length===4,h=ha(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,i,s,0);if(p)return ua(e,h,a,n,o,void 0,l,d,u,r);if(!a||!n)throw new Error("key and value must be provided");let f=ha(e,r.batchSize,r.numHeads,r.kvSequenceLength,r.headSize,a,s,r.hiddenSize),m=ha(e,r.batchSize,r.numHeads,r.kvSequenceLength,r.vHeadSize,n,s,2*r.hiddenSize);ua(e,h,f,m,o,void 0,l,d,u,r)}}),Il,zl,Cl,Al,On,Ol,Rl,Bl=I(()=>{le(),te(),b(),J(),Il=e=>{if(!e||e.length<1)throw new Error("too few inputs")},zl=(e,t)=>{let r=[],i=t.numOutputs;return e[1].dims[0]>0&&(e[1].getBigInt64Array().forEach(a=>r.push(Number(a))),i=r.length),g({numOutputs:i,axis:t.axis,splitSizes:r})},Cl=e=>`
fn calculateOutputIndex(index: u32) -> u32 {
    for (var i: u32 = 0u; i < ${e}u; i += 1u ) {
    if (index < ${M("uniforms.size_in_split_axis","i",e)}) {
        return i;
    }
    }
    return ${e}u;
}`,Al=e=>{let t=e.length,r=[];for(let i=0;i<t;++i){let a=e[i].setByIndices("indices","input[global_idx]");t===1?r.push(a):i===0?r.push(`if (output_number == ${i}u) { ${a} }`):i===t-1?r.push(`else { ${a} }`):r.push(`else if (output_number == ${i}) { ${a} }`)}return`
      fn writeBufferData(output_number: u32, indices: ${e[0].type.indices}, global_idx: u32) {
        ${r.join(`
`)}
      }`},On=(e,t)=>{let r=e[0].dims,i=D.size(r),a=e[0].dataType,n=D.normalizeAxis(t.axis,r.length),s=new Array(t.numOutputs),o=C("input",a,r.length),u=new Array(t.numOutputs),l=[],d=[],p=0,h=[{type:12,data:i}];for(let m=0;m<t.numOutputs;m++){p+=t.splitSizes[m],u[m]=p;let _=r.slice();_[n]=t.splitSizes[m],d.push(_),s[m]=q(`output${m}`,a,_.length),l.push({dims:d[m],dataType:e[0].dataType})}h.push({type:12,data:u},...k(r,...d));let f=m=>`
  ${m.registerUniform("input_size","u32").registerUniform("size_in_split_axis","u32",u.length).declareVariables(o,...s)}
  ${Cl(u.length)}
  ${Al(s)}

  ${m.mainStart()}
    ${m.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.input_size")}

    var indices = ${o.offsetToIndices("global_idx")};
    var index = ${o.indicesGet("indices",n)};
    let output_number = calculateOutputIndex(index);
    if (output_number != 0) {
      index -= ${M("uniforms.size_in_split_axis","output_number - 1u",u.length)};
      ${o.indicesSet("indices",n,"index")};
    }
    writeBufferData(output_number, indices, global_idx);
  }`;return{name:"Split",shaderCache:{hint:t.cacheKey,inputDependencies:["rank"]},getShaderSource:f,getRunData:()=>({outputs:l,dispatchGroup:{x:Math.ceil(i/64)},programUniforms:h})}},Ol=(e,t)=>{Il(e.inputs);let r=e.inputs.length===1?t:zl(e.inputs,t);e.compute(On(e.inputs,r),{inputs:[0]})},Rl=e=>{let t=e.axis,r=e.splitSizes,i=e.numOutputs<0?r.length:e.numOutputs;if(i!==r.length)throw new Error("numOutputs and splitSizes length must be equal");return g({axis:t,numOutputs:i,splitSizes:r})}}),Ml,Da,Dl,Pl=I(()=>{le(),te(),b(),J(),Ml=(e,t)=>{let[r,i,a,n]=e,{numHeads:s,rotaryEmbeddingDim:o}=t;if(r.dims.length!==3&&r.dims.length!==4)throw new Error(`Input 'x' is expected to have 3 or 4 dimensions, got ${r.dims.length}`);if(!D.areEqual(i.dims,[])&&!D.areEqual(i.dims,[1])&&i.dims.length!==2)throw new Error(`Input 'position_ids' is expected to have 0, 1, or 2 dimensions, got ${i.dims.length}`);if(a.dims.length!==2)throw new Error(`Input 'cos_cache' is expected to have 2 dimensions, got ${a.dims.length}`);if(n.dims.length!==2)throw new Error(`Input 'sin_cache' is expected to have 2 dimensions, got ${n.dims.length}`);if(!D.areEqual(a.dims,n.dims))throw new Error("Inputs 'cos_cache' and 'sin_cache' are expected to have the same shape");if(o>0&&s===0)throw new Error("num_heads must be provided if rotary_embedding_dim is specified");let u=r.dims[0],l=r.dims[r.dims.length-2],d=a.dims[0],p=D.sizeFromDimension(r.dims,1)/l,h=o===0?a.dims[1]*2:p/s;if(o>h)throw new Error("rotary_embedding_dim must be less than or equal to head_size");if(i.dims.length===2){if(u!==i.dims[0])throw new Error(`Input 'position_ids' dimension 0 should be of size batch_size, got ${i.dims[0]}`);if(l!==i.dims[1])throw new Error(`Input 'position_ids' dimension 1 should be of size sequence_length, got ${i.dims[1]}`)}if(l>d)throw new Error("Updating cos_cache and sin_cache in RotaryEmbedding is not currently supported");if(h/2!==a.dims[1]&&o/2!==a.dims[1])throw new Error(`Input 'cos_cache' dimension 1 should be same as head_size / 2 or rotary_embedding_dim / 2, got ${a.dims[1]}`)},Da=(e,t)=>{let{interleaved:r,numHeads:i,rotaryEmbeddingDim:a,scale:n}=t,s=e[0].dims[0],o=D.sizeFromDimension(e[0].dims,1),u=e[0].dims[e[0].dims.length-2],l=o/u,d=e[2].dims[1],p=a===0?d*2:l/i,h=new Array(s,u,l/p,p-d),f=D.computeStrides(h),m=[{type:1,data:n},{type:12,data:h},{type:12,data:f},...e[0].dims.length===3?new Array({type:12,data:[o,l,p,1]}):[],...e[0].dims.length===4?new Array({type:12,data:[o,p,u*p,1]}):[],...k(e[0].dims,e[1].dims,e[2].dims,e[3].dims,e[0].dims)],_=$=>{let w=C("input",e[0].dataType,e[0].dims.length),y=C("position_ids",e[1].dataType,e[1].dims.length),S=C("cos_cache",e[2].dataType,e[2].dims.length),v=C("sin_cache",e[3].dataType,e[3].dims.length),z=q("output",e[0].dataType,e[0].dims.length);return $.registerUniforms([{name:"scale",type:"f32"},{name:"global_shape",type:"u32",length:h.length},{name:"global_strides",type:"u32",length:f.length},{name:"input_output_strides",type:"u32",length:f.length}]),`
        ${$.declareVariables(w,y,S,v,z)}

        ${$.mainStart(T)}
          let half_rotary_emb_dim = uniforms.${S.name}_shape[1];
          let bsnh = global_idx / uniforms.global_strides % uniforms.global_shape;
          let size = uniforms.global_shape[0] * uniforms.global_strides[0];
          ${$.guardAgainstOutOfBoundsWorkgroupSizes("size")}

          if (bsnh[3] < half_rotary_emb_dim) {
            let position_ids_idx =
                ${y.broadcastedIndicesToOffset("bsnh.xy",q("",y.type.tensor,2))};
            let position_id =
                u32(${y.getByOffset("position_ids_idx")}) + select(0, bsnh[1], position_ids_idx == 0);
            let i = dot(bsnh, uniforms.input_output_strides) + select(0, bsnh[3], ${r});
            let j = i + select(half_rotary_emb_dim, 1, ${r});
            let re = ${w.getByOffset("i")} * ${S.get("position_id","bsnh[3]")} -
                ${w.getByOffset("j")} * ${v.get("position_id","bsnh[3]")};
            ${z.setByOffset("i","re")}
            let im = ${w.getByOffset("i")} * ${v.get("position_id","bsnh[3]")} +
                ${w.getByOffset("j")} * ${S.get("position_id","bsnh[3]")};
            ${z.setByOffset("j","im")}
          } else {
            let k = dot(bsnh, uniforms.input_output_strides) + half_rotary_emb_dim;
            ${z.setByOffset("k",w.getByOffset("k"))}
          }
        }`};return{name:"RotaryEmbedding",shaderCache:{hint:g({interleaved:r}).cacheKey,inputDependencies:["rank","rank","rank","rank"]},getShaderSource:_,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(D.size(h)/T)},programUniforms:m})}},Dl=(e,t)=>{Ml(e.inputs,t),e.compute(Da(e.inputs,t))}}),Ul,Nl,Rn,Ll,Vl,Ac=I(()=>{b(),le(),un(),kl(),Bl(),rt(),Pl(),J(),Ul=(e,t)=>{if(t.doRotary&&e.length<=7)throw new Error("cos_cache and sin_cache inputs are required if do_rotary is specified");let r=e[0],i=e[1],a=e[2],n=e[3],s=e[4];if(t.doRotary!==0&&e.length<=7)throw new Error("cos_cast and sin_cache are expected if do_rotary attribute is non-zero");if(t.localWindowSize!==-1)throw new Error("Local attention is not supported");if(t.softcap!==0)throw new Error("Softcap is not supported");if(t.rotaryInterleaved!==0)throw new Error("Rotary interleaved is not supported");if(t.smoothSoftmax)throw new Error("Smooth softmax is not supported");if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let o=!1,u=r.dims[0],l=r.dims[1],d=r.dims.length===3?o?r.dims[2]/3:r.dims[2]:t.numHeads*r.dims[4],p=l,h=0,f=!i||i.dims.length===0,m=Math.floor(f?d/(t.numHeads+2*t.kvNumHeads):d/t.numHeads);f&&(d=m*t.numHeads);let _=n&&n.dims.length!==0,$=s&&s.dims.length!==0;if(_&&n.dims.length===4&&n.dims[0]===u&&n.dims[1]!==t.kvNumHeads&&n.dims[2]===t.kvNumHeads&&n.dims[3]===m)throw new Error("BSNH pastKey/pastValue is not supported");if(_&&$){if(n.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(s.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');h=n.dims[2]}else if(_||$)throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let w=1;if(i&&i.dims.length>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(i.dims.length<3||i.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==i.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(i.dims.length===3){if(r.dims[2]%i.dims[2]!==0)throw new Error('Dimension 2 of "query" should be a multiple of "key"');p=i.dims[1]}else if(i.dims.length===5){if(i.dims[2]!==t.numHeads||i.dims[3]!==2||i.dims[4]!==m)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(a)throw new Error('Expect "value" be none when "key" has packed kv format.');p=i.dims[1]}else{if(i.dims[1]!==t.numHeads||i.dims[3]!==m)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');p=i.dims[2]}}else{if(r.dims.length!==3&&r.dims.length!==5)throw new Error('Input "query" is expected to have 3 or 5 dimensions when key is empty');if(r.dims.length===5&&(r.dims[2]!==t.numHeads||r.dims[3]!==3))throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');w=3}let y=0,S=!1,v=t.kvNumHeads?m*t.kvNumHeads:d;if(a&&a.dims.length>0){if(a.dims.length!==3&&a.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==a.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(a.dims.length===3){if(p!==a.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');v=a.dims[2]}else{if(p!==a.dims[2])throw new Error('Input "past_key" and "past_value" shall have the same dim 2 (kv_sequence_length)');v=a.dims[1]*a.dims[3],S=!0}}let z=e.length>4?e[5]:void 0;if(z){if(z.dims.length===0)throw new Error("seqlens_k must be at least 1D, got scalar.");let B=z.dims.reduce((R,P)=>R*P,1);if(B!==u)throw new Error(`seqlens_k must have batch_size (${u}) elements, got ${B}.`);for(let R=0;R<z.dims.length;R++)if(z.dims[R]!==1&&z.dims[R]!==u)throw new Error(`seqlens_k has unexpected shape. Each dimension must be 1 or batch_size (${u}), got dims[${R}] = ${z.dims[R]}.`)}return{batchSize:u,sequenceLength:l,pastSequenceLength:h,kvSequenceLength:p,totalSequenceLength:-1,maxSequenceLength:-1,inputHiddenSize:0,hiddenSize:d,vHiddenSize:v,headSize:m,vHeadSize:Math.floor(v/t.kvNumHeads),numHeads:t.numHeads,kvNumHeads:t.kvNumHeads,nReps:t.numHeads/t.kvNumHeads,pastPresentShareBuffer:!1,maskType:y,scale:t.scale,broadcastResPosBias:!1,passPastInKv:S,qkvFormat:w}},Nl=g({perm:[0,2,1,3]}),Rn=(e,t,r)=>{let i=t,a=r.kvNumHeads;return t.dims.length===3&&r.kvSequenceLength!==0&&(i=t.reshape([r.batchSize,r.kvSequenceLength,a,r.headSize]),i=e.compute(ht(i,Nl.perm),{inputs:[i],outputs:[-1]})[0]),i},Ll=(e,t,r,i)=>{let a=7,n=["type","type"],s=[e*t],o=e*t,u=[{type:12,data:o},{type:12,data:t},{type:12,data:e}],l=d=>{let p=C("seq_lens",r.dataType,r.dims),h=C("total_seq_lens",i.dataType,i.dims),f=q("pos_ids",a,s),m=[{name:"output_size",type:"u32"},{name:"sequence_length",type:"u32"},{name:"batch_size",type:"u32"}];return`
  ${d.registerUniforms(m).declareVariables(p,h,f)}
  ${d.mainStart()}
    ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let total_sequence_length = u32(${h.getByOffset("0")});
    let is_subsequent_prompt = uniforms.sequence_length > 1 && uniforms.sequence_length != total_sequence_length;
    let is_first_prompt = !is_subsequent_prompt && uniforms.sequence_length == total_sequence_length;
    let batch_idx = global_idx / uniforms.sequence_length;
    let sequence_idx = i32(global_idx % uniforms.sequence_length);
    var pos_id: i32 = 0;
    let seqlen = ${p.getByOffset("batch_idx")};
    let total_seqlen = seqlen + 1;
    if (is_first_prompt) {
      if (sequence_idx < total_seqlen) {
        pos_id = sequence_idx;
      } else {
        pos_id = 1;
      }
      ${f.setByOffset("global_idx","pos_id")}
    } else if (is_subsequent_prompt) {
      let past_seqlen = total_seqlen - i32(uniforms.sequence_length);
      if (past_seqlen + sequence_idx < total_seqlen) {
        pos_id = past_seqlen + sequence_idx;
      } else {
        pos_id = 1;
      }
      ${f.setByOffset("global_idx","pos_id")}
    } else if (global_idx < uniforms.batch_size) {
      ${f.setByOffset("global_idx","seqlen")}
    };
  }
  `};return{name:"GeneratePositionIds",shaderCache:{hint:`${e};${t}`,inputDependencies:n},getRunData:()=>({outputs:[{dims:s,dataType:a}],dispatchGroup:{x:Math.ceil(o/64)},programUniforms:u}),getShaderSource:l}},Vl=(e,t)=>{var v;let r=Ul(e.inputs,t);if(e.inputs[0].dims.length===5)throw new Error("Packed QKV is not implemented");if(((v=e.inputs[1])==null?void 0:v.dims.length)===5)throw new Error("Packed KV is not implemented");let i=e.inputs[0],a=e.inputs[1]&&e.inputs[1].dims.length>0?e.inputs[1]:void 0,n=e.inputs[2]&&e.inputs[2].dims.length>0?e.inputs[2]:void 0,s=e.inputs[3]&&e.inputs[3].dims.length!==0?e.inputs[3]:void 0,o=e.inputs[4]&&e.inputs[4].dims.length!==0?e.inputs[4]:void 0,u=e.inputs.length>4?e.inputs[5]:void 0,l=e.inputs.length>5?e.inputs[6]:void 0,d=r.kvNumHeads?r.kvNumHeads:r.numHeads,p=g({axis:2,numOutputs:3,splitSizes:[r.numHeads*r.headSize,d*r.headSize,d*r.headSize]}),[h,f,m]=!a&&!n?e.compute(On([i],p),{inputs:[i],outputs:[-1,-1,-1]}):[i,a,n],_,$;if(t.doRotary){let z=e.compute(Ll(r.batchSize,r.sequenceLength,u,l),{inputs:[u,l],outputs:[-1]})[0],B=e.inputs[7],R=e.inputs[8],P=g({interleaved:t.rotaryInterleaved!==0,numHeads:r.numHeads,rotaryEmbeddingDim:0,scale:t.scale}),V=[h,z,B,R],W=[-1];_=e.compute(Da(V,P),{inputs:V,outputs:W})[0],V.splice(0,1,f);let oe=g({interleaved:t.rotaryInterleaved!==0,numHeads:r.kvNumHeads,rotaryEmbeddingDim:0,scale:t.scale});$=e.compute(Da(V,oe),{inputs:V,outputs:W})[0]}let w=ha(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,t.doRotary?_:h,void 0,0),y=Rn(e,t.doRotary?$:f,r),S=Rn(e,m,r);ua(e,w,y,S,void 0,void 0,s,o,void 0,r,u,l)}}),Bn,Fl,ql,Gl,Oc=I(()=>{le(),te(),rt(),J(),Bn=(e,t,r,i,a,n,s,o)=>{let u=O(n),l=u===1?"f32":`vec${u}f`,d=u===1?"vec2f":`mat2x${u}f`,p=a*s,h=64;p===1&&(h=256);let f=[a,s,n/u],m=[a,s,2],_=["rank","type","type"],$=[];$.push(...k(f,m));let w=y=>{let S=C("x",t.dataType,3,u),v=C("scale",r.dataType,r.dims),z=C("bias",i.dataType,i.dims),B=q("output",1,3,2),R=[S,v,z,B];return`
  var<workgroup> workgroup_shared : array<${d}, ${h}>;
  const workgroup_size = ${h}u;
  ${y.declareVariables(...R)}
  ${y.mainStart(h)}
    let batch = workgroup_index / uniforms.x_shape[1];
    let channel = workgroup_index % uniforms.x_shape[1];
    let hight = uniforms.x_shape[2];
    // initialize workgroup memory
    var sum = ${l}(0);
    var squared_sum = ${l}(0);
    for (var h = local_idx; h < hight; h += workgroup_size) {
      let value = ${l}(${S.get("batch","channel","h")});
      sum += value;
      squared_sum += value * value;
    }
    workgroup_shared[local_idx] = ${d}(sum, squared_sum);
    workgroupBarrier();

    for (var currSize = workgroup_size >> 1;  currSize > 0; currSize = currSize >> 1) {
      if (local_idx < currSize) {
        workgroup_shared[local_idx] = workgroup_shared[local_idx] + workgroup_shared[local_idx + currSize];
      }
      workgroupBarrier();
    }
    if (local_idx == 0) {
      let sum_final = ${U("workgroup_shared[0][0]",u)} / f32(hight * ${u});
      let squared_sum_final = ${U("workgroup_shared[0][1]",u)} / f32(hight * ${u});

      let inv_std_dev = inverseSqrt(squared_sum_final - sum_final * sum_final + f32(${o}));
      let channel_scale = inv_std_dev * f32(scale[channel]);
      let channel_shift = f32(bias[channel]) - sum_final * channel_scale;
      output[workgroup_index] = vec2f(channel_scale, channel_shift);
    }
  }`};return e.compute({name:"InstanceNormComputeChannelScaleShift",shaderCache:{hint:`${u};${o};${h}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:m,dataType:1}],dispatchGroup:{x:p},programUniforms:$}),getShaderSource:w},{inputs:[t,r,i],outputs:[-1]})[0]},Fl=(e,t,r)=>{let i=t[0].dims,a=i,n=2,s=i[0],o=i[1],u=D.sizeFromDimension(i,n),l=O(u),d=D.size(a)/l,p=Bn(e,t[0],t[1],t[2],s,u,o,r.epsilon),h=[s,o,u/l],f=[s,o],m=["type","none"],_=$=>{let w=C("x",t[0].dataType,h.length,l),y=C("scale_shift",1,f.length,2),S=q("output",t[0].dataType,h.length,l),v=[w,y,S];return`
  ${$.registerUniform("output_size","u32").declareVariables(...v)}
  ${$.mainStart()}
  ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let outputIndices = ${S.offsetToIndices("global_idx")};
      let batch = outputIndices[0];
      let channel = outputIndices[1];
      let scale_shift = ${y.getByIndices("vec2<u32>(batch, channel)")};
      let value = ${w.getByOffset("global_idx")} * ${S.type.value}(scale_shift.x) + ${S.type.value}(scale_shift.y);
      ${S.setByOffset("global_idx","value")};
  }`};e.compute({name:"InstanceNormalization",shaderCache:{hint:`${l}`,inputDependencies:m},getRunData:()=>({outputs:[{dims:a,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:[{type:12,data:d},...k(h,f,h)]}),getShaderSource:_},{inputs:[t[0],p]})},ql=(e,t,r)=>{let i=t[0].dims,a=i,n=i[0],s=i[i.length-1],o=D.sizeFromDimension(i,1)/s,u=O(s),l=D.size(a)/u,d=[{type:12,data:o},{type:12,data:Math.floor(s/u)}],p=["type","type"],h=!1,f=[0,i.length-1];for(let w=0;w<i.length-2;w++)h=h||i[w+1]!==1,f.push(w+1);h=h&&i[i.length-1]!==1;let m=h?e.compute(ht(e.inputs[0],f),{inputs:[e.inputs[0]],outputs:[-1]})[0]:e.inputs[0].reshape(Array.from({length:i.length},(w,y)=>i[f[y]])),_=Bn(e,m,t[1],t[2],n,o,s,r.epsilon),$=w=>{let y=A(t[0].dataType),S=u===1?"vec2f":`mat${u}x2f`,v=R=>{let P=R===0?"x":"y",V=u===1?"f32":`vec${u}f`;switch(u){case 1:return`${y}(${V}(scale.${P}))`;case 2:return`vec2<${y}>(${V}(scale[0].${P}, scale[1].${P}))`;case 4:return`vec4<${y}>(${V}(scale[0].${P}, scale[1].${P}, scale[2].${P}, scale[3].${P}))`;default:throw new Error(`Not supported compoents ${u}`)}},z=C("input",t[0].dataType,t[0].dims,u),B=q("output",t[0].dataType,a,u);return`
  @group(0) @binding(0) var<storage, read> input : array<${z.type.storage}>;
  @group(0) @binding(1) var<storage, read> scale_input : array<${S}>;
  @group(0) @binding(2) var<storage, read_write> output : array<${B.type.storage}>;
  struct Uniforms {H: u32, C : u32};
  @group(0) @binding(3) var<uniform> uniforms: Uniforms;

  ${w.mainStart()}
    let current_image_number = global_idx / (uniforms.C * uniforms.H);
    let current_channel_number = global_idx % uniforms.C;

    let scale_offset = current_image_number * uniforms.C + current_channel_number;
    let scale = scale_input[scale_offset];
    output[global_idx] = fma(input[global_idx], ${v(0)}, ${v(1)});
  }`};e.compute({name:"InstanceNormalizationNHWC",shaderCache:{hint:`${u}`,inputDependencies:p},getRunData:()=>({outputs:[{dims:a,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:d}),getShaderSource:$},{inputs:[t[0],_]})},Gl=(e,t)=>{t.format==="NHWC"?ql(e,e.inputs,t):Fl(e,e.inputs,t)}}),Wl,jl,Hl,Rc=I(()=>{le(),te(),J(),Wl=e=>{if(!e||e.length<2)throw new Error("layerNorm requires at least 2 inputs.")},jl=(e,t,r)=>{let i=t.simplified,a=e[0].dims,n=e[1],s=!i&&e[2],o=a,u=D.normalizeAxis(t.axis,a.length),l=D.sizeToDimension(a,u),d=D.sizeFromDimension(a,u),p=D.size(n.dims),h=s?D.size(s.dims):0;if(p!==d||s&&h!==d)throw new Error(`Size of X.shape()[axis:] == ${d}.
       Size of scale and bias (if provided) must match this.
       Got scale size of ${p} and bias size of ${h}`);let f=[];for(let z=0;z<a.length;++z)z<u?f.push(a[z]):f.push(1);let m=O(d),_=["type","type"],$=[{type:12,data:l},{type:1,data:d},{type:12,data:Math.floor(d/m)},{type:1,data:t.epsilon}];s&&_.push("type");let w=r>1,y=r>2,S=z=>{let B=A(e[0].dataType),R=[C("x",e[0].dataType,e[0].dims,m),C("scale",n.dataType,n.dims,m)];s&&R.push(C("bias",s.dataType,s.dims,m)),R.push(q("output",e[0].dataType,o,m)),w&&R.push(q("mean_data_output",1,f)),y&&R.push(q("inv_std_output",1,f));let P=[{name:"norm_count",type:"u32"},{name:"norm_size",type:"f32"},{name:"norm_size_vectorized",type:"u32"},{name:"epsilon",type:"f32"}];return`
  ${z.registerUniforms(P).declareVariables(...R)}
  ${z.mainStart()}
    ${z.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.norm_count")}
    let offset = global_idx * uniforms.norm_size_vectorized;
    var mean_vector = ${N("f32",m)};
    var mean_square_vector = ${N("f32",m)};

    for (var h: u32 = 0u; h < uniforms.norm_size_vectorized; h++) {
      let value = ${F(B,m,"x[h + offset]")};
      mean_vector += value;
      mean_square_vector += value * value;
    }
    let mean = ${U("mean_vector",m)} / uniforms.norm_size;
    let inv_std_dev = inverseSqrt(${U("mean_square_vector",m)} / uniforms.norm_size ${i?"":"- mean * mean"} + uniforms.epsilon);

    for (var j: u32 = 0; j < uniforms.norm_size_vectorized; j++) {
      let f32input = ${F(B,m,"x[j + offset]")};
      let f32scale = ${F(B,m,"scale[j]")};
      output[j + offset] = ${R[0].type.value}((f32input ${i?"":"- mean"}) * inv_std_dev * f32scale
        ${s?`+ ${F(B,m,"bias[j]")}`:""}
      );
    }

    ${w?"mean_data_output[global_idx] = mean":""};
    ${y?"inv_std_output[global_idx] = inv_std_dev":""};
  }`},v=[{dims:o,dataType:e[0].dataType}];return w&&v.push({dims:f,dataType:1}),y&&v.push({dims:f,dataType:1}),{name:"LayerNormalization",shaderCache:{hint:`${m};${r};${i}`,inputDependencies:_},getRunData:()=>({outputs:v,dispatchGroup:{x:Math.ceil(l/64)},programUniforms:$}),getShaderSource:S}},Hl=(e,t)=>{Wl(e.inputs),e.compute(jl(e.inputs,t,e.outputCount))}}),Kl,Zl,Bc=I(()=>{te(),gn(),bn(),Kl=e=>{if(!e||e.length!==2)throw new Error("MatMul requires 2 inputs.");if(e[0].dims[e[0].dims.length-1]!==e[1].dims[e[1].dims.length-2])throw new Error("shared dimension does not match.")},Zl=e=>{Kl(e.inputs);let t=Zt.calcShape(e.inputs[0].dims,e.inputs[1].dims,!0);if(!t)throw new Error("Can't use matmul on the given tensors");let r=t[t.length-1],i=e.inputs[0].dims[e.inputs[0].dims.length-1];if(r<8&&i<8)e.compute(mn(e.inputs,{activation:""},t));else{let a=t[t.length-2],n=D.size(e.inputs[0].dims.slice(0,-2)),s=D.size(e.inputs[1].dims.slice(0,-2));if(n!==1&&a===1&&s===1){let o=e.inputs[0].reshape([1,n,i]),u=e.inputs[1].reshape([1,i,r]),l=[1,n,r],d=[o,u];e.compute(Oa(d,{activation:""},t,l),{inputs:d})}else e.compute(Oa(e.inputs,{activation:""},t))}}}),Ql,Xl,Yl,Jl,ed,Mc=I(()=>{le(),te(),b(),J(),Ql=(e,t)=>{if(e.length<3||e.length>4)throw new Error("MatMulNBits requires 3 or 4 inputs");let r=e[0],i=r.dims.length;if(r.dims[i-1]!==t.k)throw new Error("The last dim of input shape does not match the k value");let a=Math.floor((t.k+t.blockSize-1)/t.blockSize),n=t.blockSize/8*t.bits,s=e[1];if(!D.areEqual(s.dims,[t.n,a,n]))throw new Error("The second inputs must be 3D tensor with shape N X nBlocksPerCol X blobSize");let o=e[2].dims;if(D.size(o)!==t.n*a)throw new Error("scales input size error.");if(e.length===4){let u=e[3].dims,l=t.n*(t.bits===8?a:Math.floor((a*t.bits+7)/8));if(D.size(u)!==l)throw new Error("zeroPoints input size error.")}},Xl=(e,t)=>{let r=e[0].dims,i=r.length,a=r[i-2],n=t.k,s=t.n,o=r.slice(0,i-2),u=D.size(o),l=e[1].dims[2]/4,d=e[0].dataType,p=O(t.k),h=O(l),f=O(s),m=o.concat([a,s]),_=a>1&&s/f%2===0?2:1,$=D.size(m)/f/_,w=64,y=[],S=[u,a,n/p],v=D.convertShape(e[1].dims).slice();v.splice(-1,1,l/h),y.push(...k(S)),y.push(...k(v)),y.push(...k(e[2].dims)),e.length===4&&y.push(...k(D.convertShape(e[3].dims)));let z=[u,a,s/f];y.push(...k(z));let B=R=>{let P=S.length,V=C("a",e[0].dataType,P,p),W=C("b",12,v.length,h),oe=C("scales",e[2].dataType,e[2].dims.length),re=[V,W,oe],ie=e.length===4?C("zero_points",12,e[3].dims.length):void 0;ie&&re.push(ie);let Te=z.length,ze=q("output",e[0].dataType,Te,f),ae=A(e[0].dataType),ce=(()=>{switch(p){case 1:return`array<${ae}, 8>`;case 2:return`mat4x2<${ae}>`;case 4:return`mat2x4<${ae}>`;default:throw new Error(`${p}-component is not supported.`)}})(),Ze=Math.floor(32/t.bits),j=Math.floor(Ze/8),Ce=()=>{let X="";for(let H=0;H<j;H++){let Re=H*t.bits*4,sr=Re+t.bits;X+=`
          // reuse a data (pass ${H})
            var input_offset${H>0?H:""} = ${H===0?V.indicesToOffset(`${V.type.indices}(batch, row, word_offset)`):"input_offset"};
            var a_data${H>0?H:""}: ${ce};
            for (var j${H>0?H:""}: u32 = 0; j${H>0?H:""} < ${8/p}; j${H>0?H:""}++) {
              a_data${H>0?H:""}[j${H>0?H:""}] = ${V.getByOffset(`input_offset${H>0?H:""}`)};
              input_offset${H>0?H:""}++;
            }
          `;for(let ot=0;ot<f*_;ot++)X+=`
            b_value = ${h===1?`b${ot}_data`:`b${ot}_data[i]`};
            ${t.bits===2?`{
              let half_word = b_value >> ${H*16}u;
              let byte_lo = half_word & 0xFFu;
              let byte_hi = (half_word >> 8u) & 0xFFu;
              let spread_word = (byte_lo & 0xFu) | ((byte_lo >> 4u) << 8u) | ((byte_hi & 0xFu) << 16u) | ((byte_hi >> 4u) << 24u);
              b_value_lower = unpack4xU8(spread_word & b_mask);
              b_value_upper = unpack4xU8((spread_word >> 2u) & b_mask);
            }`:`b_value_lower = unpack4xU8((b_value >> ${Re}u) & b_mask);
            b_value_upper = unpack4xU8((b_value >> ${sr}u) & b_mask);`}
            b_quantized_values = ${ce}(${Array.from({length:4},(Wt,jt)=>`${ae}(b_value_lower[${jt}]), ${ae}(b_value_upper[${jt}])`).join(", ")});
            b_dequantized_values = ${p===1?`${ce}(${Array.from({length:8},(Wt,jt)=>`(b_quantized_values[${jt}] - ${ie?`zero_point${ot}`:"zero_point"}) * scale${ot}`).join(", ")});`:`(b_quantized_values - ${ce}(${Array(8).fill(`${ie?`zero_point${ot}`:"zero_point"}`).join(",")})) * scale${ot};`};
            workgroup_shared[local_id.x * ${_} + ${Math.floor(ot/f)}]${f>1?`[${ot%f}]`:""} += ${Array.from({length:8/p},(Wt,jt)=>`${p===1?`a_data${H>0?H:""}[${jt}] * b_dequantized_values[${jt}]`:`dot(a_data${H>0?H:""}[${jt}], b_dequantized_values[${jt}])`}`).join(" + ")};
          `}return X},G=()=>{let X=`
            var col_index = col * ${f};
            ${ie?`
            let zero_point_values_per_byte: u32 = ${Math.floor(8/t.bits)}u;
            let zero_point_bytes_per_col = (nBlocksPerCol + zero_point_values_per_byte - 1u) / zero_point_values_per_byte;
            var zero_point_byte_count: u32;
            var zero_point_word_index: u32;
            var zero_point_byte_offset: u32;
            let zero_point_sub_offset: u32 = block % zero_point_values_per_byte;
            var zero_point_bits_offset: u32;
            var zero_point_word: u32;`:`
            // The default zero point is ${Math.pow(2,t.bits-1)} for unsigned ${t.bits}-bit quantization.
            let zero_point = ${ae}(${Math.pow(2,t.bits-1).toFixed(1)});`}
            `;for(let H=0;H<f*_;H++)X+=`
            let scale${H} = ${oe.getByOffset("col_index * nBlocksPerCol + block")};
            ${ie?`
            zero_point_byte_count = col_index * zero_point_bytes_per_col + (block / zero_point_values_per_byte);
            zero_point_word_index = zero_point_byte_count >> 0x2u;
            zero_point_byte_offset = zero_point_byte_count & 0x3u;
            zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_sub_offset * ${t.bits}u);
            zero_point_word = ${ie.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point${H} = ${ae}((zero_point_word) & ${t.bits===2?"0x3u":"0xFu"});`:""}
            col_index += 1;`;return X},K=()=>{let X=`col_index = col * ${f};`;for(let H=0;H<f*_;H++)X+=`
            let b${H}_data = ${W.getByIndices(`${W.type.indices}(col_index, block, word)`)};
            col_index += 1;`;return X+=`
            var b_value: u32;
            let b_mask: u32 = ${t.bits===2?"0x03030303u":"0x0F0F0F0Fu"};
            var b_value_lower: vec4<u32>;
            var b_value_upper: vec4<u32>;
            var b_quantized_values: ${ce};
            var b_dequantized_values: ${ce};`,X};return`
        var<workgroup> workgroup_shared: array<${ze.type.value}, ${_*w}>;
        ${R.declareVariables(...re,ze)}
        ${R.mainStart([w,1,1])}
          let output_indices = ${ze.offsetToIndices(`(global_idx / ${w}) * ${_}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let nBlocksPerCol = uniforms.b_shape[1];

          for (var block = local_id.x; block < nBlocksPerCol; block += ${w}) {
            //process one block
            var word_offset: u32 = block * ${t.blockSize/p};
            ${G()}
            for (var word: u32 = 0; word < ${l}; word += ${h}) {
              ${K()}
              for (var i: u32 = 0; i < ${h}; i++) {
                ${Ce()}
                word_offset += ${Ze/p};
              }
            }
          }
          workgroupBarrier();

          if (local_id.x < ${_}) {
            var output_value: ${ze.type.value} = ${ze.type.value}(0);
            var workgroup_shared_offset: u32 = local_id.x;
            for (var b: u32 = 0u; b < ${w}u; b++) {
              output_value += workgroup_shared[workgroup_shared_offset];
              workgroup_shared_offset += ${_};
            }
            ${ze.setByIndices(`${ze.type.indices}(batch, row, col + local_id.x)`,"output_value")};
          }
        }`};return{name:"MatMulNBits",shaderCache:{hint:`${t.blockSize};${t.bits};${p};${h};${f};${_};${w}`,inputDependencies:Array(e.length).fill("rank")},getRunData:()=>({outputs:[{dims:m,dataType:d}],dispatchGroup:{x:$},programUniforms:y}),getShaderSource:B}},Yl=(e,t)=>{let r=e[0].dims,i=r.length,a=r[i-2],n=t.k,s=t.n,o=r.slice(0,i-2),u=D.size(o),l=e[1].dims[2]/4,d=e[0].dataType,p=O(t.k),h=O(l),f=o.concat([a,s]),m=128,_=s%8===0?8:s%4===0?4:1,$=m/_,w=Math.floor(32/t.bits),y=$*h*w,S=y/p,v=y/t.blockSize,z=D.size(f)/_,B=[],R=[u,a,n/p],P=D.convertShape(e[1].dims).slice();P.splice(-1,1,l/h),B.push(...k(R)),B.push(...k(P)),B.push(...k(e[2].dims)),e.length===4&&B.push(...k(D.convertShape(e[3].dims)));let V=[u,a,s];B.push(...k(V));let W=oe=>{let re=R.length,ie=C("a",e[0].dataType,re,p),Te=C("b",12,P.length,h),ze=C("scales",e[2].dataType,e[2].dims.length),ae=[ie,Te,ze],ce=e.length===4?C("zero_points",12,e[3].dims.length):void 0;ce&&ae.push(ce);let Ze=V.length,j=q("output",e[0].dataType,Ze),Ce=A(e[0].dataType),G=()=>{switch(p){case 1:return`
          let a_data0 = vec4<${Ce}>(sub_a[word_offset], sub_a[word_offset + 1], sub_a[word_offset + 2], sub_a[word_offset + 3]);
          let a_data1 = vec4<${Ce}>(sub_a[word_offset + 4], sub_a[word_offset + 5], sub_a[word_offset + 6], sub_a[word_offset + 7]);`;case 2:return`
          let a_data0 = vec4<${Ce}>(sub_a[word_offset], sub_a[word_offset + 1]);
          let a_data1 = vec4<${Ce}>(sub_a[word_offset + 2], sub_a[word_offset + 3]);`;case 4:return`
          let a_data0 = sub_a[word_offset];
          let a_data1 = sub_a[word_offset + 1];`;default:throw new Error(`${p}-component is not supported.`)}};return`
        var<workgroup> sub_a: array<${ie.type.value}, ${S}>;
        var<workgroup> inter_results: array<array<${j.type.value}, ${$}>, ${_}>;
        ${oe.declareVariables(...ae,j)}
        ${oe.mainStart([$,_,1])}
          let output_indices = ${j.offsetToIndices(`workgroup_index * ${_}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let n_blocks_per_col = uniforms.b_shape[1];
          let num_tiles =  (n_blocks_per_col - 1) / ${v} + 1;

          // Loop over shared dimension.
          for (var tile: u32 = 0; tile < num_tiles; tile += 1) {
            let a_col_start = tile * ${S};
            // load one tile A data into shared memory.
            for (var a_offset = local_idx; a_offset < ${S}; a_offset += ${m})
            {
              let a_col = a_col_start + a_offset;
              if (a_col < uniforms.a_shape[2])
              {
                sub_a[a_offset] = ${ie.getByIndices(`${ie.type.indices}(batch, row, a_col)`)};
              } else {
                sub_a[a_offset] = ${ie.type.value}(0);
              }
            }
            workgroupBarrier();

            // each thread process one block
            let b_row = col + local_id.y;
            let block = tile * ${v} + local_id.x;
            ${ce?`
            let zero_point_values_per_byte: u32 = ${Math.floor(8/t.bits)}u;
            let zero_point_bytes_per_col = (n_blocks_per_col + zero_point_values_per_byte - 1u) / zero_point_values_per_byte;
            let zero_point_byte_count = b_row * zero_point_bytes_per_col + (block / zero_point_values_per_byte);
            let zero_point_word_index = zero_point_byte_count >> 0x2u;
            let zero_point_byte_offset = zero_point_byte_count & 0x3u;
            let zero_point_sub_offset: u32 = block % zero_point_values_per_byte;
            let zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_sub_offset * ${t.bits}u);
            let zero_point_word = ${ce.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point = ${Ce}((zero_point_word) & ${t.bits===2?"0x3u":"0xFu"});`:`
            // The default zero point is ${Math.pow(2,t.bits-1)} for unsigned ${t.bits}-bit quantization.
            let zero_point = ${Ce}(${Math.pow(2,t.bits-1).toFixed(1)});`}
            let scale = ${ze.getByOffset("b_row * n_blocks_per_col + block")};
            let b_data = ${Te.getByIndices(`${Te.type.indices}(b_row, block, 0)`)};
            var word_offset = local_id.x * ${t.blockSize/p};
            for (var i: u32 = 0; i < ${h}; i++) {
              let b_value = ${h===1?"b_data":"b_data[i]"};
              ${(()=>{let K=Math.floor(w/8),X="";for(let H=0;H<K;H++){let Re=H*t.bits*4,sr=Re+t.bits;X+=`
              ${G()}
              {${t.bits===2?`
                let half_word = b_value >> ${H*16}u;
                let byte_lo = half_word & 0xFFu;
                let byte_hi = (half_word >> 8u) & 0xFFu;
                let spread_word = (byte_lo & 0xFu) | ((byte_lo >> 4u) << 8u) | ((byte_hi & 0xFu) << 16u) | ((byte_hi >> 4u) << 24u);
                let b_value_lower = unpack4xU8(spread_word & 0x03030303u);
                let b_value_upper = unpack4xU8((spread_word >> 2u) & 0x03030303u);`:`
                let b_value_lower = unpack4xU8((b_value >> ${Re}u) & 0x0F0F0F0Fu);
                let b_value_upper = unpack4xU8((b_value >> ${sr}u) & 0x0F0F0F0Fu);`}
                let b_quantized_values = mat2x4<${Ce}>(${Array.from({length:4},(ot,Wt)=>`${Ce}(b_value_lower[${Wt}]), ${Ce}(b_value_upper[${Wt}])`).join(", ")});
                let b_dequantized_values = (b_quantized_values - mat2x4<${Ce}>(${Array(8).fill("zero_point").join(",")})) * scale;
                inter_results[local_id.y][local_id.x] += ${Array.from({length:2},(ot,Wt)=>`${`dot(a_data${Wt}, b_dequantized_values[${Wt}])`}`).join(" + ")};
              }
              word_offset += ${8/p};`}return X})()}
            }
            workgroupBarrier();
          }

          if (local_idx < ${_}) {
            var output_value: ${j.type.value} = ${j.type.value}(0);
            for (var b = 0u; b < ${$}; b++) {
              output_value += inter_results[local_idx][b];
            }
            if (col + local_idx < uniforms.output_shape[2])
            {
              ${j.setByIndices(`${j.type.indices}(batch, row, col + local_idx)`,"output_value")}
            }
          }
        }`};return{name:"BlockwiseMatMulNBits32",shaderCache:{hint:`${t.blockSize};${p};${h};${$};${_}`,inputDependencies:Array(e.length).fill("rank")},getRunData:()=>({outputs:[{dims:f,dataType:d}],dispatchGroup:{x:z},programUniforms:B}),getShaderSource:W}},Jl=(e,t)=>{Ql(e.inputs,t),t.blockSize===32&&e.adapterInfo.isVendor("intel")&&e.adapterInfo.isArchitecture("gen-12lp")?e.compute(Yl(e.inputs,t)):e.compute(Xl(e.inputs,t))},ed=e=>g(e)}),td,rd,id,ad,nd,sd,od,ud,ld,Dc=I(()=>{le(),te(),J(),td=e=>{if(!e||e.length<1)throw new Error("Too few inputs");if(e[0].dataType!==1&&e[0].dataType!==10)throw new Error("Input type must be float or float16.");if(e.length>=2){let t=e[0].dims.length*2===e[1].dims[0];if(e.length===4&&(t=e[3].dims[0]*2===e[1].dims[0]),!t)throw new Error("The pads should be a 1D tensor of shape [2 * input_rank] or [2 * num_axes].")}},rd=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
            k = i32(${e.indicesGet("indices",a)}) - ${M("uniforms.pads",a,r)};
            if (k < 0) {
              break;
            }
            if (k >= i32(${M("uniforms.x_shape",a,t)})) {
              break;
            }
            offset += k * i32(${M("uniforms.x_strides",a,t)});
        `;return`
          value = ${e.type.value}(uniforms.constant_value);
          for (var i = 0; i < 1; i++) {
            var offset = 0;
            var k = 0;
            ${i}
            value = x[offset];
          }
      `},id=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${M("uniforms.pads",a,r)};
                if (k < 0) {
                  k = -k;
                }
                {
                  let _2n_1 = 2 * (i32(${M("uniforms.x_shape",a,t)}) - 1);
                  k = k % _2n_1;
                  if(k >= i32(${M("uniforms.x_shape",a,t)})) {
                    k = _2n_1 - k;
                  }
                }
                offset += k * i32(${M("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},ad=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${M("uniforms.pads",a,r)};
                if (k < 0) {
                  k = 0;
                }
                if (k >= i32(${M("uniforms.x_shape",a,t)})) {
                  k = i32(${M("uniforms.x_shape",a,t)}) - 1;
                }
                offset += k * i32(${M("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},nd=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${M("uniforms.pads",a,r)};
                if (k < 0)  {
                  k += i32(${M("uniforms.x_shape",a,t)}]);
                }
                if (k >= i32(${M("uniforms.x_shape",a,t)})) {
                  k -= i32(${M("uniforms.x_shape",a,t)});
                }
                offset += k * i32(${M("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},sd=(e,t,r)=>{switch(r.mode){case 0:return rd(e,t,r.pads.length);case 1:return id(e,t,r.pads.length);case 2:return ad(e,t,r.pads.length);case 3:return nd(e,t,r.pads.length);default:throw new Error("Invalid mode")}},od=(e,t)=>{let r=D.padShape(e[0].dims.slice(),t.pads),i=e[0].dims,a=D.size(r),n=[{type:12,data:a},{type:6,data:t.pads}],s=e.length>=3&&e[2].data;t.mode===0&&n.push({type:s?e[2].dataType:1,data:t.value}),n.push(...k(e[0].dims,r));let o=["rank"],u=l=>{let d=q("output",e[0].dataType,r.length),p=C("x",e[0].dataType,i.length),h=p.type.value,f=sd(d,i.length,t),m=[{name:"output_size",type:"u32"},{name:"pads",type:"i32",length:t.pads.length}];return t.mode===0&&m.push({name:"constant_value",type:s?h:"f32"}),`
            ${l.registerUniforms(m).declareVariables(p,d)}
            ${l.mainStart()}
            ${l.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

            let indices = ${d.offsetToIndices("global_idx")};

            var value = ${h}(0);
            ${f}
            output[global_idx] = value;
        }`};return{name:"Pad",shaderCache:{hint:`${t.mode}${s}`,inputDependencies:o},getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(D.size(r)/64)},programUniforms:n}),getShaderSource:u}},ud=(e,t)=>{if(e.length>1){let r=e[1].getBigInt64Array(),i=e.length>=3&&e[2].data?e[2].dataType===10?e[2].getUint16Array()[0]:e[2].getFloat32Array()[0]:0,a=e[0].dims.length,n=new Int32Array(2*a).fill(0);if(e.length>=4){let o=e[3].getBigInt64Array();for(let u=0;u<o.length;u++)n[Number(o[u])]=Number(r[u]),n[Number(o[u])+a]=Number(r[u+o.length])}else r.forEach((o,u)=>n[Number(u)]=Number(o));let s=[];return n.forEach(o=>s.push(o)),{mode:t.mode,value:i,pads:s}}else return t},ld=(e,t)=>{td(e.inputs);let r=ud(e.inputs,t);e.compute(od(e.inputs,r),{inputs:[0]})}}),fa,Mn,Dn,Pn,Un,dd,pd,Nn,Ln,cd,hd,Vn,fd,md,Fn,gd,yd,_d,wd,Pc=I(()=>{Ye(),le(),te(),J(),fa=e=>{if(Y.webgpu.validateInputContent&&(!e||e.length!==1))throw new Error("Pool ops requires 1 input.")},Mn=(e,t,r)=>{let i=t.format==="NHWC",a=e.dims.slice();i&&a.splice(1,0,a.pop());let n=Object.hasOwnProperty.call(t,"dilations"),s=t.kernelShape.slice(),o=t.strides.slice(),u=n?t.dilations.slice():[],l=t.pads.slice();lr.adjustPoolAttributes(r,a,s,o,u,l);let d=lr.computePoolOutputShape(r,a,o,u,s,l,t.autoPad),p=Object.assign({},t);n?Object.assign(p,{kernelShape:s,strides:o,pads:l,dilations:u,cacheKey:t.cacheKey}):Object.assign(p,{kernelShape:s,strides:o,pads:l,cacheKey:t.cacheKey});let h=d.slice();return h.push(h.splice(1,1)[0]),[p,i?h:d]},Dn=(e,t)=>{let r=t.format==="NHWC",i=D.size(e),a=D.size(t.kernelShape),n=[{type:12,data:i},{type:12,data:a}],s=[{name:"outputSize",type:"u32"},{name:"kernelSize",type:"u32"}];if(t.kernelShape.length<=2){let o=t.kernelShape[t.kernelShape.length-1],u=t.strides[t.strides.length-1],l=t.pads[t.pads.length/2-1],d=t.pads[t.pads.length-1],p=!!(l+d);n.push({type:12,data:o},{type:12,data:u},{type:12,data:l},{type:12,data:d}),s.push({name:"kw",type:"u32"},{name:"sw",type:"u32"},{name:"pwStart",type:"u32"},{name:"pwEnd",type:"u32"});let h=!1;if(t.kernelShape.length===2){let f=t.kernelShape[t.kernelShape.length-2],m=t.strides[t.strides.length-2],_=t.pads[t.pads.length/2-2],$=t.pads[t.pads.length-2];h=!!(_+$),n.push({type:12,data:f},{type:12,data:m},{type:12,data:_},{type:12,data:$}),s.push({name:"kh",type:"u32"},{name:"sh",type:"u32"},{name:"phStart",type:"u32"},{name:"phEnd",type:"u32"})}return[n,s,!0,p,h]}else{if(r)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let o=D.computeStrides(t.kernelShape);n.push({type:12,data:o},{type:12,data:t.pads},{type:12,data:t.strides}),s.push({name:"kernelStrides",type:"u32",length:o.length},{name:"pads",type:"u32",length:t.pads.length},{name:"strides",type:"u32",length:t.strides.length});let u=t.pads.reduce((l,d)=>l+d);return[n,s,!!u,!1,!1]}},Pn=(e,t,r,i,a,n,s,o,u,l,d,p)=>{let h=a.format==="NHWC",f=t.type.value,m=q("output",t.type.tensor,i);if(a.kernelShape.length<=2){let _="",$="",w="",y=r-(h?2:1);if(d?_=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${y}] = indices[${y}] * uniforms.sw - uniforms.pwStart + i;
                  if (xIndices[${y}] < 0 || xIndices[${y}]
                      >= uniforms.x_shape[${y}]) {
                    pad++;
                    continue;
                  }
                  let x_val = x[${t.indicesToOffset("xIndices")}];
                  ${n}
                }`:_=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${y}] = indices[${y}] * uniforms.sw - uniforms.pwStart + i;
                  let x_val = x[${t.indicesToOffset("xIndices")}];
                  ${n}
                }`,a.kernelShape.length===2){let S=r-(h?3:2);p?$=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${S}] = indices[${S}] * uniforms.sh - uniforms.phStart + j;
                  if (xIndices[${S}] < 0 || xIndices[${S}] >= uniforms.x_shape[${S}]) {
                    pad += i32(uniforms.kw);
                    continue;
                  }
              `:$=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${S}] = indices[${S}] * uniforms.sh - uniforms.phStart + j;
                `,w=`
              }
            `}return`
            ${e.registerUniforms(u).declareVariables(t,m)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

              let indices = ${m.offsetToIndices("global_idx")};
              var xIndices = ${m.offsetToIndices("global_idx")};

              var value = ${f}(${o});
              var pad = 0;
              ${$}
              ${_}
              ${w}
              ${s}

              output[global_idx] = value;
            }`}else{if(h)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let _=a.kernelShape.length,$=a.pads.length,w="";return l?w=`
                if (xIndices[j] >= uniforms.x_shape[j]) {
                  pad++;
                  isPad = true;
                  break;
                }
              }
              if (!isPad) {
                let x_val = x[${t.indicesToOffset("xIndices")}];
                ${n}
              }`:w=`
              }
              let x_val = x[${t.indicesToOffset("xIndices")}];
              ${n}
            `,`
            ${e.registerUniforms(u).declareVariables(t,m)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
              let indices = ${m.offsetToIndices("global_idx")};
              var xIndices = ${m.offsetToIndices("global_idx")};

              var offsets: array<u32, ${_}>;

              var value = ${f}(${o});
              var pad = 0;
              var isPad = false;

              for (var i: u32 = 0u; i < uniforms.kernelSize; i++) {
                var offset = i;
                for (var j = 0u; j < ${_-1}u; j++) {
                  offsets[j] = offset / ${M("uniforms.kernelStrides","j",_)};
                  offset -= offsets[j] * ${M("uniforms.kernelStrides","j",_)};
                }
                offsets[${_-1}] = offset;

                isPad = false;
                for (var j = ${r-_}u; j < ${r}u; j++) {
                  xIndices[j] = indices[j] * ${M("uniforms.strides",`j - ${r-_}u`,_)}
                    + offsets[j - ${r-_}u] - ${M("uniforms.pads","j - 2u",$)};
                  ${w}
              }
              ${s}

              output[global_idx] = value;
            }`}},Un=e=>`${e.format};${e.ceilMode};${e.autoPad};${e.kernelShape.length}`,dd=e=>`${Un(e)};${e.countIncludePad}`,pd=e=>`${Un(e)};${e.storageOrder};${e.dilations}`,Nn=e=>({format:e.format,autoPad:["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][e.auto_pad],ceilMode:e.ceil_mode,kernelShape:e.kernel_shape,strides:e.strides,pads:e.pads}),Ln=(e,t,r,i)=>{let[a,n]=Mn(t,i,r),s=C("x",t.dataType,t.dims.length),o=s.type.value,u="value += x_val;",l="";a.countIncludePad?l+=`value /= ${o}(uniforms.kernelSize);`:l+=`value /= ${o}(i32(uniforms.kernelSize) - pad);`;let[d,p,h,f,m]=Dn(n,a);d.push(...k(t.dims,n));let _=["rank"];return{name:e,shaderCache:{hint:`${i.cacheKey};${h};${f};${m}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:n,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(D.size(n)/64)},programUniforms:d}),getShaderSource:$=>Pn($,s,t.dims.length,n.length,a,u,l,0,p,h,f,m)}},cd=e=>{let t=e.count_include_pad!==0,r=Nn(e);if(r.ceilMode!==0)throw new Error("using ceil() in shape computation is not yet supported for AveragePool");let i={countIncludePad:t,...r,cacheKey:""};return{...i,cacheKey:dd(i)}},hd=(e,t)=>{fa(e.inputs),e.compute(Ln("AveragePool",e.inputs[0],!1,t))},Vn={autoPad:"",ceilMode:0,countIncludePad:!1,kernelShape:[],strides:[],pads:[],storageOrder:0,dilations:[]},fd=e=>{let t=e.format;return{format:t,...Vn,cacheKey:t}},md=(e,t)=>{fa(e.inputs),e.compute(Ln("GlobalAveragePool",e.inputs[0],!0,t))},Fn=(e,t,r,i)=>{let[a,n]=Mn(t,i,r),s=`
      value = max(x_val, value);
    `,o="",u=C("x",t.dataType,t.dims.length),l=["rank"],[d,p,h,f,m]=Dn(n,a);return d.push(...k(t.dims,n)),{name:e,shaderCache:{hint:`${i.cacheKey};${h};${f};${m}`,inputDependencies:l},getRunData:()=>({outputs:[{dims:n,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(D.size(n)/64)},programUniforms:d}),getShaderSource:_=>Pn(_,u,t.dims.length,n.length,a,s,o,t.dataType===10?-65504:-1e5,p,h,f,m)}},gd=(e,t)=>{fa(e.inputs),e.compute(Fn("MaxPool",e.inputs[0],!1,t))},yd=e=>{let t=e.storage_order,r=e.dilations,i=Nn(e);if(t!==0)throw new Error("column major storage order is not yet supported for MaxPool");if(i.ceilMode!==0)throw new Error("using ceil() in shape computation is not yet supported for MaxPool");let a={storageOrder:t,dilations:r,...i,cacheKey:""};return{...a,cacheKey:pd(a)}},_d=e=>{let t=e.format;return{format:t,...Vn,cacheKey:t}},wd=(e,t)=>{fa(e.inputs),e.compute(Fn("GlobalMaxPool",e.inputs[0],!0,t))}}),bd,$d,vd,xd,Uc=I(()=>{le(),te(),b(),J(),bd=(e,t)=>{if(e.length<2||e.length>3)throw new Error("DequantizeLinear requires 2 or 3 inputs.");if(e.length===3&&e[1].dims===e[2].dims)throw new Error("x-scale and x-zero-point must have the same shape.");if(e.length===3&&e[0].dataType!==e[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(e[1].dims.length!==0&&e[1].dims.length!==1&&e[1].dims.length!==e[0].dims.length)throw new Error("scale input must be a scalar, a 1D tensor, or have the same rank as the input tensor.");if(e.length>2){if(e[0].dataType!==e[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(e[1].dims.length!==e[2].dims.length)throw new Error("scale and zero-point inputs must have the same rank.");if(!e[1].dims.map((r,i)=>r===e[2].dims[i]).reduce((r,i)=>r&&i,!0))throw new Error("scale and zero-point inputs must have the same shape.")}if(t.blockSize>0){if(e[1].dims.length===0||e[1].dims.length===1&&e[1].dims[0]===1)throw new Error("blockSize must be set only for block quantization.");if(!e[1].dims.map((a,n)=>n===t.axis||a===e[0].dims[n]).reduce((a,n)=>a&&n,!0))throw new Error("For block qunatization, scale input shape to match the input shape except for the axis");if(e[1].dims.length!==e[0].dims.length)throw new Error("For block qunatization the scale input rank must be the same as the x rank.");let r=e[0].dims[t.axis],i=e[1].dims[t.axis];if(t.blockSize<Math.ceil(r/i)||t.blockSize>Math.ceil(r/(i-1)-1))throw new Error("blockSize must be with in the range [ceil(dI / Si), ceil(dI / (Si - 1) - 1)].")}},$d=(e,t)=>{let r=D.normalizeAxis(t.axis,e[0].dims.length),i=e[0].dataType,a=i===3,n=e[0].dims,s=e[1].dataType,o=D.size(n),u=i===3||i===2,l=u?[Math.ceil(D.size(e[0].dims)/4)]:e[0].dims,d=e[1].dims,p=e.length>2?e[2]:void 0,h=p?u?[Math.ceil(D.size(p.dims)/4)]:p.dims:void 0,f=d.length===0||d.length===1&&d[0]===1,m=f===!1&&d.length===1,_=O(o),$=f&&(!u||_===4),w=$?_:1,y=$&&!u?_:1,S=C("input",u?12:i,l.length,y),v=C("scale",s,d.length),z=p?C("zero_point",u?12:i,h.length):void 0,B=q("output",s,n.length,w),R=[S,v];z&&R.push(z);let P=[l,d];p&&P.push(h);let V=[{type:12,data:o/w},{type:12,data:r},{type:12,data:t.blockSize},...k(...P,n)],W=oe=>{let re=[{name:"output_size",type:"u32"},{name:"axis",type:"u32"},{name:"block_size",type:"u32"}];return`
      ${oe.registerUniforms(re).declareVariables(...R,B)}
      ${oe.mainStart()}
          ${oe.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let output_indices = ${B.offsetToIndices("global_idx")};

          // Set input x
          ${u?`
            let input = ${S.getByOffset("global_idx / 4")};
            let x_vec = ${a?"unpack4xI8(input)":"unpack4xU8(input)"};
            let x_value = ${w===1?"x_vec[global_idx % 4]":"x_vec"};`:`let x_value = ${S.getByOffset("global_idx")};`};

          // Set scale input
          ${f?`let scale_value= ${v.getByOffset("0")}`:m?`
            let scale_index = ${B.indicesGet("output_indices","uniforms.axis")};
            let scale_value= ${v.getByOffset("scale_index")};`:`
            var scale_indices: ${v.type.indices} = output_indices;
            let index = ${v.indicesGet("scale_indices","uniforms.axis")} / uniforms.block_size;
            ${v.indicesSet("scale_indices","uniforms.axis","index")};
            let scale_value= ${v.getByIndices("scale_indices")};`};

          // Set zero-point input
          ${z?f?u?`
                let zero_point_input = ${z.getByOffset("0")};
                let zero_point_vec =  ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value= zero_point_vec[0]`:`let zero_point_value = ${z.getByOffset("0")}`:m?u?`
                let zero_point_index = ${B.indicesGet("output_indices","uniforms.axis")};
                let zero_point_input = ${z.getByOffset("zero_point_index / 4")};
                let zero_point_vec =  ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_index % 4]`:`
                let zero_point_index = ${B.indicesGet("output_indices","uniforms.axis")};
                let zero_point_value = ${z.getByOffset("zero_point_index")};`:u?`
                let zero_point_offset = ${v.indicesToOffset("scale_indices")};
                let zero_point_input = ${z.getByOffset("zero_point_offset / 4")};
                let zero_point_vec = ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_offset % 4];`:`let zero_point_value = ${z.getByIndices("scale_indices")};`:`let zero_point_value = ${u?a?"i32":"u32":S.type.value}(0);`};
      // Compute and write output
      ${B.setByOffset("global_idx",`${B.type.value}(x_value - zero_point_value) * scale_value`)};
      }`};return{name:"DequantizeLinear",shaderCache:{hint:t.cacheKey,inputDependencies:z?["rank","rank","rank"]:["rank","rank"]},getShaderSource:W,getRunData:()=>({outputs:[{dims:n,dataType:s}],dispatchGroup:{x:Math.ceil(o/w/64),y:1,z:1},programUniforms:V})}},vd=(e,t)=>{bd(e.inputs,t),e.compute($d(e.inputs,t))},xd=e=>g({axis:e.axis,blockSize:e.blockSize})}),Sd,Td,Ed,Nc=I(()=>{Ye(),le(),J(),Sd=(e,t,r)=>{let i=e===t,a=e<t&&r<0,n=e>t&&r>0;if(i||a||n)throw new Error("Range these inputs' contents are invalid.")},Td=(e,t,r,i)=>{let a=Math.abs(Math.ceil((t-e)/r)),n=[a],s=a,o=[{type:12,data:s},{type:i,data:e},{type:i,data:r},...k(n)],u=l=>{let d=q("output",i,n.length),p=d.type.value,h=[{name:"outputSize",type:"u32"},{name:"start",type:p},{name:"delta",type:p}];return`
        ${l.registerUniforms(h).declareVariables(d)}
        ${l.mainStart()}
        ${l.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        output[global_idx] = uniforms.start + ${p}(global_idx) * uniforms.delta;
      }`};return{name:"Range",shaderCache:{hint:`${i}`},getShaderSource:u,getRunData:()=>({outputs:[{dims:n,dataType:i}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:o})}},Ed=e=>{let t=0,r=0,i=0;e.inputs[0].dataType===6?(t=e.inputs[0].getInt32Array()[0],r=e.inputs[1].getInt32Array()[0],i=e.inputs[2].getInt32Array()[0]):e.inputs[0].dataType===1&&(t=e.inputs[0].getFloat32Array()[0],r=e.inputs[1].getFloat32Array()[0],i=e.inputs[2].getFloat32Array()[0]),Y.webgpu.validateInputContent&&Sd(t,r,i),e.compute(Td(t,r,i,e.inputs[0].dataType),{inputs:[]})}}),kd,Id,zd,Cd,Lc=I(()=>{le(),te(),b(),J(),kd=(e,t,r,i)=>{if(e!=="none"&&i!=="i32"&&i!=="u32"&&i!=="f32")throw new Error(`Input ${i} is not supported with reduction ${e}.`);let a=`{
                var oldValue = 0;
                loop {
                  let newValueF32 =`,n=`;
                  let newValue = bitcast<i32>(newValueF32);
                  let res = atomicCompareExchangeWeak(&${t}, oldValue, newValue);
                  if res.exchanged {
                    break;
                  }
                  oldValue = res.old_value;
                }
              }`;switch(e){case"none":return`${t}=${r};`;case"add":return i==="i32"||i==="u32"?`atomicAdd(&${t}, bitcast<${i}>(${r}));`:`
              ${a}bitcast<${i}>(oldValue) + (${r})${n}`;case"max":return i==="i32"||i==="u32"?`atomicMax(&${t}, bitcast<${i}>(${r}));`:`
                ${a}max(bitcast<f32>(oldValue), (${r}))${n}`;case"min":return i==="i32"||i==="u32"?`atomicMin(&${t}, bitcast<${i}>(${r}));`:`${a}min(bitcast<${i}>(oldValue), (${r}))${n}`;case"mul":return`${a}(bitcast<${i}>(oldValue) * (${r}))${n}`;default:throw new Error(`Reduction ${e} is not supported.`)}},Id=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r,n=1,s=Math.ceil(D.sizeToDimension(i,i.length-1)/n),o=i[i.length-1],u=D.sizeFromDimension(r,o),l=[{type:12,data:s},{type:12,data:o},{type:12,data:u},...k(e[1].dims,e[2].dims,a)],d=p=>{let h=C("indices",e[1].dataType,e[1].dims.length),f=C("updates",e[2].dataType,e[2].dims.length,n),m=t.reduction!=="none"&&t.reduction!==""?Ne("output",e[0].dataType,a.length):q("output",e[0].dataType,a.length,n);return`
      ${p.registerUniform("output_size","u32").registerUniform("last_index_dimension","u32").registerUniform("num_updates_elements","u32").declareVariables(h,f,m)}
      ${p.mainStart()}
        ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
  var data_offset = 0u;
  let indices_start = uniforms.last_index_dimension * global_idx;
  let indices_end = indices_start + uniforms.last_index_dimension;
  for (var i = indices_start; i < indices_end; i++) {
    var index = i32(indices[i].x);
    ${e[0].dims.length===1?`
    let element_count_dim = uniforms.output_strides;
    let dim_value = uniforms.output_shape;`:`
    let element_count_dim = uniforms.output_strides[i - indices_start];
    let dim_value = uniforms.output_shape[i - indices_start];`}
    if (index >= 0) {
      if (index >= i32(dim_value)) {
        index = i32(dim_value - 1);
      }
    } else {
      if (index < -i32(dim_value)) {
        index = 0;
      } else {
        index += i32(dim_value);
      }
    }
    data_offset += u32((u32(index) * element_count_dim));
  }

  for (var i = 0u; i < uniforms.num_updates_elements; i++) {
    let value = updates[uniforms.num_updates_elements * global_idx + i];
    ${kd(t.reduction,"output[data_offset + i]","value",m.type.value)}
  }

      }`};return{name:"ScatterND",shaderCache:{hint:`${t.cacheKey}_${t.reduction}`,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:a,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:l}),getShaderSource:d}},zd=e=>g({reduction:e.reduction}),Cd=(e,t)=>{e.compute(Id(e.inputs,t),{inputs:[e.inputs[1],e.inputs[2]],outputs:[]})}}),Ad,Od,Rd,qn,Bd,Md,Dd,Pd,Ud,Nd,Ld,Vd,Gn,Fd,qd,Gd,Wd,jd,Hd,Kd,Vc=I(()=>{le(),te(),b(),J(),Ad=(e,t)=>{if(e.every(r=>r>0||(()=>{throw new Error("Resize requires scales input values to be positive")})),e.length>0){if(t.mode==="linear"){if(!(e.length===2||e.length===3||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1||e.length===5&&e[0]===1&&e[1]===1))throw new Error(`For linear mode, Resize requires scales to be 2D, 3D, 4D with either two outermost or one innermost and
            one outermost scale values equal to 1, or 5D with two outermost scale values equal to 1`)}else if(t.mode==="cubic"&&!(e.length===2||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1))throw new Error("Resize requires scales input size to be 2 or 4 for cubic mode")}},Od=(e,t,r)=>{t.every(a=>a>=0&&a<r||(()=>{throw new Error("Resize requires axes input values to be positive and less than rank")}));let i=new Array(r).fill(1);return t.forEach((a,n)=>i[a]=e[n]),i},Rd=(e,t,r,i,a,n)=>{let[s,o,u]=r>10?[1,2,3]:[-1,e.length>1?1:-1,-1],l=e[0].dims.length;if(s>0&&e.length>s&&e[s].dims.length>0)e[s].getFloat32Array().forEach(d=>n.push(d));else if(t.coordinateTransformMode==="tf_crop_and_resize")throw new Error("Resize requires RoI input to be specified when coordinateTransformMode is tfCropAndResize");if(o>0&&e.length>o&&e[o].dims.length===1&&e[o].dims[0]>0){if(e[o].getFloat32Array().forEach(d=>i.push(d)),i.length!==0&&i.length!==l&&r>=18&&i.length!==t.axes.length)throw new Error("Resize requires scales input size to be same as input rank or axes size for opset 18 and up");Ad(i,t),t.axes.length>0&&Od(i,t.axes,l).forEach((d,p)=>i[p]=d)}if(u>0&&e.length>u&&e[u].dims.length===1&&e[u].dims[0]>0&&(e[u].getBigInt64Array().forEach(d=>a.push(Number(d))),a.length!==0&&a.length!==l&&r>=18&&a.length!==t.axes.length))throw new Error("Resize requires sizes input size to be same as input rank or axes size for opset 18 and up");if(t.axes.length>0){if(i.length!==0&&i.length!==t.axes.length)throw new Error('Resize requires "scales" input size to be of axes rank when axes attributes is specified');if(a.length!==0&&a.length!==t.axes.length)throw new Error('Resize requires "sizes" input size to be of rank axes rank when axes attributes is specified')}if(typeof i<"u"&&typeof a<"u"&&i.length>0&&a.length>l)throw new Error("Resize requires only of scales or sizes to be specified")},qn=(e,t,r,i)=>`
  // The whole part and the fractional part are calculated separately due to inaccuracy of floating
  // point division. As an example, f32(21) / f32(7) may evaluate to 2.99... instead of 3, causing an
  // offset-by-one error later in floor().
  let big = (${e}) * (${t});
  let whole = ${i}(big / (${r}));
  let fract = ${i}(big % (${r})) / ${i}(${r});
  return whole + fract;
`,Bd=(e,t)=>`fn getOriginalCoordinateFromResizedCoordinate(xResized: u32, xScale: f32, lengthResized: u32,
     lengthOriginal: u32, roiStart: f32, roiEnd: f32) -> ${t} { `+(()=>{switch(e){case"asymmetric":return`
          if (xScale < 1.0 || floor(xScale) != xScale) {
            return ${t}(xResized) / ${t}(xScale);
          } else {
            ${qn("xResized","lengthOriginal","lengthResized",t)}
          }
        `;case"pytorch_half_pixel":return`if (lengthResized > 1) {
                    return (${t}(xResized) + 0.5) / ${t}(xScale) - 0.5;
                  } else {
                    return 0.0;
                  }`;case"tf_half_pixel_for_nn":return`return (${t}(xResized) + 0.5) / ${t}(xScale);`;case"align_corners":return`if (lengthResized == 1) {
                    return 0.0;
                  } else {
                    ${qn("xResized","lengthOriginal - 1","lengthResized - 1",t)}
                  }`;case"tf_crop_and_resize":return`if (lengthResized > 1) {
                    return ${t}(roiStart) * ${t}(lengthOriginal - 1) +
                        (${t}(xResized) * ${t}(roiEnd - roiStart) * ${t}(lengthOriginal - 1)) /
                        ${t}(lengthResized - 1);
                  } else {
                    return 0.5 * ${t}(roiStart + roiEnd) * ${t}(lengthOriginal - 1);
                  }`;case"half_pixel_symmetric":return`const outputWidth = ${t}xScale * ${t}(lengthResized);
                  const adjustment = ${t}(lengthResized) / outputWidth;
                  const center = ${t}(lengthOriginal) / 2;
                  const offset = center * (1 - adjustment);
                  return offset + ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;case"half_pixel":return`return ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;default:throw new Error(`Coordinate transform mode ${e} is not supported`)}})()+"}",Md=(e,t,r)=>`fn getNearestPixelFromOriginal(xOriginal: ${r}, isDownSample: bool) -> ${r} {`+(()=>{switch(e){case"round_prefer_ceil":return"if (fract(xOriginal) == 0.5) {             return ceil(xOriginal);           } else {             return round(xOriginal);           }";case"floor":return"return floor(xOriginal);";case"ceil":return"return ceil(xOriginal);";case"round_prefer_floor":return"if (fract(xOriginal) == 0.5) {                     return floor(xOriginal);                   } else {                     return round(xOriginal);                   }";case"simple":default:if(t<11)return"if (isDownSample)                     {                       return ceil(xOriginal);                     } else {                       return xOriginal;                     }";throw new Error(`Nearest mode ${e} is not supported`)}})()+"}",Dd=(e,t,r)=>{let i=new Array(r).fill(0).concat(new Array(r).fill(1)),a=e.length===0?i:e.slice();return t.length>0?(t.forEach((n,s)=>{i[n]=a[s],i[s+r]=a[t.length+s]}),i):a},Pd=(e,t,r,i)=>{let a=[];if(r.length>0)if(i.length>0){if(e.forEach(n=>a.push(n)),Math.max(...i)>e.length)throw new Error("axes is out of bound");i.forEach((n,s)=>a[n]=r[s])}else r.forEach(n=>a.push(n));else{if(t.length===0)throw new Error("Resize requires either scales or sizes.");a=e.map((n,s)=>Math.round(n*t[s]))}return a},Ud=(e,t,r)=>{let i=(()=>{switch(r.keepAspectRatioPolicy){case"not_larger":return r.axes.length>0?Math.min(...r.axes.map(n=>t[n]),Number.MAX_VALUE):Math.min(...t,Number.MAX_VALUE);case"not_smaller":return r.axes.length>0?Math.max(...r.axes.map(n=>t[n]),Number.MIN_VALUE):Math.max(...t,Number.MIN_VALUE);default:throw new Error(`Keep aspect ratio policy ${r.keepAspectRatioPolicy} is not supported`)}})();t.fill(1,0,t.length);let a=e.slice();return r.axes.length>0?(r.axes.forEach(n=>t[n]=i),r.axes.forEach(n=>a[n]=Math.round(e[n]*t[n]))):(t.fill(i,0,t.length),a.forEach((n,s)=>a[s]=Math.round(n*t[s]))),a},Nd=(e,t,r,i,a)=>`
    fn calculateOriginalIndicesFromOutputIndices(output_indices: ${e.type.indices}) -> array<${e.type.value}, ${r.length}> {
      var original_indices: array<${e.type.value}, ${r.length}>;
      for (var i:u32 = 0; i < ${r.length}; i++) {
        var output_index = ${e.indicesGet("output_indices","i")};
        var scale = ${M("uniforms.scales","i",i)};
        var roi_low = ${M("uniforms.roi","i",a)};
        var roi_hi = ${M("uniforms.roi",`i + ${t.length}`,a)};
        if (scale == 1.0) {
          original_indices[i] = ${e.type.value}(output_index);
        } else {
          var input_shape_i = ${M("uniforms.input_shape","i",t.length)};
          var output_shape_i = ${M("uniforms.output_shape","i",r.length)};
          original_indices[i] = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                           input_shape_i, roi_low, roi_hi);
        }
      }
      return original_indices;
    }`,Ld=(e,t,r,i,a,n,s)=>`
    fn calculateInputIndicesFromOutputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
      var input_indices: ${e.type.indices};
      for (var i:u32 = 0; i < ${i.length}; i++) {
        var output_index = ${t.indicesGet("output_indices","i")};
        var input_index: u32;
        var scale = ${M("uniforms.scales","i",a)};
        if (scale == 1.0) {
          input_index = output_index;
        } else {
          var roi_low = ${M("uniforms.roi","i",n)};
          var roi_hi = ${M("uniforms.roi",`i + ${r.length}`,n)};
          var input_shape_i = ${M("uniforms.input_shape","i",r.length)};
          var output_shape_i = ${M("uniforms.output_shape","i",i.length)};
          var original_idx = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                        input_shape_i, roi_low, roi_hi);
          if (!${s} || (original_idx >= 0 && original_idx < ${t.type.value}(input_shape_i))) {
            if (original_idx < 0) {
              input_index = 0;
            } else if (original_idx > ${t.type.value}(input_shape_i - 1)) {
              input_index = input_shape_i - 1;
            } else {
              input_index = u32(getNearestPixelFromOriginal(original_idx, scale < 1));
            }
          } else {
            input_index = u32(original_idx);
          }
        }
        ${e.indicesSet("input_indices","i","input_index")}
      }
      return input_indices;
    }`,Vd=(e,t)=>`
    fn checkInputIndices(input_indices: ${e.type.indices}) -> bool {
      for (var i:u32 = 0; i < ${t.length}; i++) {
        var input_index = ${e.indicesGet("input_indices","i")};
        if (input_index < 0 || input_index >= ${M("uniforms.input_shape","i",t.length)}) {
          return false;
        }
      }
      return true;
    }`,Gn=(e,t,r,i)=>e.rank>i?`
    ${e.indicesSet("input_indices",t,"channel")};
    ${e.indicesSet("input_indices",r,"batch")};
`:"",Fd=(e,t,r,i,a)=>{let[n,s,o,u]=r.length===2?[-1,0,1,-1]:[0,2,3,1],l=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, row: u32, col: u32) -> ${l} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet("input_indices",s,`max(0, min(row, ${r[s]} - 1))`)};
      ${e.indicesSet("input_indices",o,`max(0, min(col, ${r[o]} - 1))`)};
      ${Gn(e,u,n,2)}
      return ${e.getByIndices("input_indices")};
    }

    fn bilinearInterpolation(output_indices: ${t.type.indices}) -> ${l} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var row:${l} = originalIndices[${s}];
      var col:${l} = originalIndices[${o}];
      ${i?`if (row < 0 || row > (${r[s]} - 1) || col < 0 || col > (${r[o]} - 1)) {
        return ${a};
      }`:""};
      row = max(0, min(row, ${r[s]} - 1));
      col = max(0, min(col, ${r[o]} - 1));
      var row1: u32 = u32(row);
      var col1: u32 = u32(col);
      var row2: u32 = u32(row + 1);
      var col2: u32 = u32(col + 1);
      var channel: u32 = ${r.length>2?`u32(originalIndices[${u}])`:"0"};
      var batch: u32 =  ${r.length>2?`u32(originalIndices[${n}])`:"0"};
      var x11: ${l} = getInputValue(batch, channel, row1, col1);
      var x12: ${l} = getInputValue(batch, channel, row1, col2);
      var x21: ${l} = getInputValue(batch, channel, row2, col1);
      var x22: ${l} = getInputValue(batch, channel, row2, col2);
      var dx1: ${l} = abs(row - ${l}(row1));
      var dx2: ${l} = abs(${l}(row2) - row);
      var dy1: ${l} = abs(col - ${l}(col1));
      var dy2: ${l} = abs(${l}(col2) - col);
      if (row1 == row2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (col1 == col2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      return (x11 * dx2 * dy2 + x12 * dx2 * dy1 + x21 * dx1 * dy2 + x22 * dx1 * dy1);
    }`},qd=(e,t,r,i,a,n,s,o,u,l)=>{let d=r.length===2,[p,h]=d?[0,1]:[2,3],f=e.type.value,m=_=>{let $=_===p?"row":"col";return`
      fn ${$}CubicInterpolation(input_indices: ${e.type.indices}, output_indices: ${t.type.indices}) -> ${f} {
        var output_index = ${t.indicesGet("output_indices",_)};
        var originalIdx: ${f} = getOriginalCoordinateFromResizedCoordinate(output_index, ${a[_]},
        ${i[_]}, ${r[_]}, ${n[_]}, ${n[_]} + ${r.length});
        var fractOriginalIdx: ${f} = originalIdx - floor(originalIdx);
        var coefs = getCubicInterpolationCoefs(fractOriginalIdx);

        if (${o} && (originalIdx < 0 || originalIdx > (${r[_]} - 1))) {
          return ${u};
        }
        var data: array<${f}, 4> = array<${f}, 4>(0.0, 0.0, 0.0, 0.0);
        for (var i: i32 = -1; i < 3; i++) {
          var ${$}: ${f} = originalIdx + ${f}(i);
          if (${$} < 0 || ${$} >= ${r[_]}) {
            ${l?`coefs[i + 1] = 0.0;
                        continue;`:o?`return ${u};`:`${$} = max(0, min(${$}, ${r[_]} - 1));`};
          }
        var input_indices_copy: ${e.type.indices} = input_indices;
          ${e.indicesSet("input_indices_copy",_,`u32(${$})`)};
          data[i + 1] = ${_===p?e.getByIndices("input_indices_copy"):"rowCubicInterpolation(input_indices_copy, output_indices)"};
        }
        return cubicInterpolation1D(data, coefs);
      }`};return`
    ${m(p)};
    ${m(h)};
  fn getCubicInterpolationCoefs(s: ${f}) -> array<${f}, 4> {
    var absS = abs(s);
    var coeffs: array<${f}, 4> = array<${f}, 4>(0.0, 0.0, 0.0, 0.0);
    var oneMinusAbsS: ${f} = 1.0 - absS;
    var twoMinusAbsS: ${f} = 2.0 - absS;
    var onePlusAbsS: ${f} = 1.0 + absS;
    coeffs[0] = ((${s} * onePlusAbsS - 5 * ${s}) * onePlusAbsS + 8 * ${s}) * onePlusAbsS - 4 * ${s};
    coeffs[1] = ((${s} + 2) * absS - (${s} + 3)) * absS * absS + 1;
    coeffs[2] = ((${s} + 2) * oneMinusAbsS - (${s} + 3)) * oneMinusAbsS * oneMinusAbsS + 1;
    coeffs[3] = ((${s} * twoMinusAbsS - 5 * ${s}) * twoMinusAbsS + 8 * ${s}) * twoMinusAbsS - 4 * ${s};
    return coeffs;
  }

  fn cubicInterpolation1D(x: array<${f}, 4>, coefs: array<${f}, 4>) -> ${f} {
    var coefsSum: ${f} = coefs[0] + coefs[1] + coefs[2] + coefs[3];
    return (x[0] * coefs[0] + x[1] * coefs[1]+ x[2] * coefs[2]+ x[3] * coefs[3]) / coefsSum;
  }

  fn bicubicInterpolation(output_indices: ${t.type.indices}) -> ${f} {
    var input_indices: ${e.type.indices} = output_indices;
    return colCubicInterpolation(input_indices, output_indices);
  }
    `},Gd=(e,t,r,i,a)=>{let[n,s,o,u,l]=r.length===3?[-1,0,1,2,-1]:[0,2,3,4,1],d=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, depth:u32, height: u32, width: u32) -> ${d} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet("input_indices",s,`max(0, min(depth, ${r[s]} - 1))`)};
      ${e.indicesSet("input_indices",o,`max(0, min(height, ${r[o]} - 1))`)};
      ${e.indicesSet("input_indices",u,`max(0, min(width, ${r[u]} - 1))`)};
      ${Gn(e,l,n,3)}
      return ${e.getByIndices("input_indices")};
    }

    fn trilinearInterpolation(output_indices: ${t.type.indices}) -> ${d} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var depth:${d} = originalIndices[${s}];
      var height:${d} = originalIndices[${o}];
      var width:${d} = originalIndices[${u}];
      ${i?`if (depth < 0 || depth > (${r[s]} - 1) || height < 0 || height > (${r[o]} - 1) || width < 0 || (width > ${r[u]} - 1)) {
      return ${a};
        }`:""};

    depth = max(0, min(depth, ${r[s]} - 1));
      height = max(0, min(height, ${r[o]} - 1));
      width = max(0, min(width, ${r[u]} - 1));
      var depth1: u32 = u32(depth);
      var height1: u32 = u32(height);
      var width1: u32 = u32(width);
      var depth2: u32 = u32(depth + 1);
      var height2: u32 = u32(height + 1);
      var width2: u32 = u32(width + 1);
      var channel: u32 = ${r.length>3?`u32(originalIndices[${l}])`:"0"};
      var batch: u32 =  ${r.length>3?`u32(originalIndices[${n}])`:"0"};

      var x111: ${d} = getInputValue(batch, channel, depth1, height1, width1);
      var x112: ${d} = getInputValue(batch, channel, depth1, height1, width2);
      var x121: ${d} = getInputValue(batch, channel, depth1, height2, width1);
      var x122: ${d} = getInputValue(batch, channel, depth1, height2, width2);
      var x211: ${d} = getInputValue(batch, channel, depth2, height1, width1);
      var x212: ${d} = getInputValue(batch, channel, depth2, height1, width2);
      var x221: ${d} = getInputValue(batch, channel, depth2, height2, width1);
      var x222: ${d} = getInputValue(batch, channel, depth2, height2, width2);
      var dx1: ${d} = abs(depth - ${d}(depth1));
      var dx2: ${d} = abs(${d}(depth2) - depth);
      var dy1: ${d} = abs(height - ${d}(height1));
      var dy2: ${d} = abs(${d}(height2) - height);
      var dz1: ${d} = abs(width - ${d}(width1));
      var dz2: ${d} = abs(${d}(width2) - width);
      if (depth1 == depth2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (height1 == height2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      if (width1 == width2) {
        dz1 = 0.5;
        dz2 = 0.5;
      }
      return (x111 * dx2 * dy2 * dz2 + x112 * dx2 * dy2 * dz1 + x121 * dx2 * dy1 *dz2 + x122 * dx2 * dy1 * dz1 +
              x211 * dx1 * dy2 * dz2 + x212 * dx1 * dy2 * dz1 + x221 * dx1 * dy1 *dz2 + x222 * dx1 * dy1 * dz1);
    }`},Wd=(e,t,r,i,a,n)=>{let s=e.dims,o=Dd(n,t.axes,s.length),u=Pd(s,i,a,t.axes),l=i.slice();i.length===0&&(l=s.map((y,S)=>y===0?1:u[S]/y),t.keepAspectRatioPolicy!=="stretch"&&(u=Ud(s,l,t)));let d=q("output",e.dataType,u.length),p=C("input",e.dataType,s.length),h=D.size(u),f=s.length===u.length&&s.every((y,S)=>y===u[S]),m=t.coordinateTransformMode==="tf_crop_and_resize",_=t.extrapolationValue,$=p.type.value,w=y=>`
      ${f?"":`
      ${Bd(t.coordinateTransformMode,$)};
      ${(()=>{switch(t.mode){case"nearest":return`
              ${Vd(p,s)};
              ${Md(t.nearestMode,r,$)};
              ${Ld(p,d,s,u,l.length,o.length,m)};
              `;case"linear":return`
              ${Nd(d,s,u,l.length,o.length)};
              ${(()=>{if(s.length===2||s.length===4)return`${Fd(p,d,s,m,_)}`;if(s.length===3||s.length===5)return`${Gd(p,d,s,m,_)}`;throw Error("Linear mode only supports input dims 2, 3, 4 and 5 are supported in linear mode.")})()};
            `;case"cubic":return`
            ${(()=>{if(s.length===2||s.length===4)return`${qd(p,d,s,u,l,o,t.cubicCoeffA,m,t.extrapolationValue,t.excludeOutside)}`;throw Error("Cubic mode only supports input dims 2 and 4 are supported in linear mode.")})()};
            `;default:throw Error("Invalid resize mode")}})()};
      `}
      ${y.registerUniform("output_size","u32").registerUniform("scales","f32",l.length).registerUniform("roi","f32",o.length).declareVariables(p,d)}
      ${y.mainStart()}
        ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
        ${f?"output[global_idx] = input[global_idx];":`
        let output_indices = ${d.offsetToIndices("global_idx")};
        var input_indices: ${p.type.indices};
        ${(()=>{switch(t.mode){case"nearest":return`input_indices = calculateInputIndicesFromOutputIndices(output_indices);
                if (checkInputIndices(input_indices)) {
                  output[global_idx] = ${p.getByIndices("input_indices")};
                } else {
                  output[global_idx] = ${t.extrapolationValue};
                }`;case"linear":return`output[global_idx] = ${s.length===2||s.length===4?"bilinearInterpolation":"trilinearInterpolation"}(output_indices);`;case"cubic":return"output[global_idx] = bicubicInterpolation(output_indices);";default:throw Error(`Unsupported resize mode: ${t.mode}`)}})()};
`}
      }`;return{name:"Resize",shaderCache:{hint:`${t.cacheKey}|${r}|${l.length>0?t.mode==="cubic"?l:l.length:""}|${a.length>0?a:""}|${o.length>0?o:""}|${f}|${t.mode==="nearest"?s.length:s}`,inputDependencies:["rank"]},getShaderSource:w,getRunData:()=>({outputs:[{dims:u,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:[{type:12,data:h},{type:1,data:l},{type:1,data:o},...k(s,u)]})}},jd=e=>{let t=e.customDataBuffer;return new Uint32Array(t,t.byteOffset,1)[0]},Hd=(e,t)=>{let r=[],i=[],a=[],n=jd(e);if(t.antialias!==0)throw Error("Only default value (0) for Antialias attribute is supported");Rd(e.inputs,t,n,r,i,a),e.compute(Wd(e.inputs[0],t,n,r,i,a),{inputs:[0]})},Kd=e=>{let t=e.antialias,r=e.axes,i=e.coordinateTransformMode,a=e.cubicCoeffA,n=e.excludeOutside!==0,s=e.extrapolationValue,o=e.keepAspectRatioPolicy,u=e.mode,l=e.nearestMode===""?"simple":e.nearestMode;return g({antialias:t,axes:r,coordinateTransformMode:i,cubicCoeffA:a,excludeOutside:n,extrapolationValue:s,keepAspectRatioPolicy:o,mode:u,nearestMode:l})}}),Zd,Qd,Xd,Fc=I(()=>{le(),te(),J(),Zd=e=>{if(!e||e.length<3)throw new Error("layerNorm requires at least 3 inputs.");let t=e[0],r=e[1],i=e[2];if(t.dataType!==r.dataType||t.dataType!==i.dataType)throw new Error("All inputs must have the same data type");if(t.dims.length!==3&&t.dims.length!==2)throw new Error("Input must be 2D or 3D");if(r.dims.length!==3&&r.dims.length!==2)throw new Error("Skip must be 2D or 3D");let a=t.dims[t.dims.length-1],n=t.dims[t.dims.length-2];if(r.dims[r.dims.length-1]!==a)throw new Error("Skip must have the same hidden size as input");if(r.dims[r.dims.length-2]!==n)throw new Error("Skip must have the same sequence length as input");if(i.dims.length!==1)throw new Error("Gamma must be 1D");if(i.dims[i.dims.length-1]!==a)throw new Error("Gamma must have the same hidden size as input");if(e.length>3){let s=e[3];if(s.dims.length!==1)throw new Error("Beta must be 1D");if(s.dims[s.dims.length-1]!==a)throw new Error("Beta must have the same hidden size as input")}if(e.length>4){let s=e[4];if(s.dims.length!==1)throw new Error("Bias must be 1D");if(s.dims[s.dims.length-1]!==a)throw new Error("Bias must have the same hidden size as input")}},Qd=(e,t,r,i)=>{let a=t.simplified,n=e[0].dims,s=D.size(n),o=n,u=s,l=n.slice(-1)[0],d=i?n.slice(0,-1).concat(1):[],p=!a&&e.length>3,h=e.length>4,f=i&&r>1,m=i&&r>2,_=r>3,$=64,w=O(l),y=[{type:12,data:u},{type:12,data:w},{type:12,data:l},{type:1,data:t.epsilon}],S=z=>{let B=[{name:"output_size",type:"u32"},{name:"components",type:"u32"},{name:"hidden_size",type:"u32"},{name:"epsilon",type:"f32"}],R=[C("x",e[0].dataType,e[0].dims,w),C("skip",e[1].dataType,e[1].dims,w),C("gamma",e[2].dataType,e[2].dims,w)];p&&R.push(C("beta",e[3].dataType,e[3].dims,w)),h&&R.push(C("bias",e[4].dataType,e[4].dims,w)),R.push(q("output",e[0].dataType,o,w)),f&&R.push(q("mean_output",1,d)),m&&R.push(q("inv_std_output",1,d)),_&&R.push(q("input_skip_bias_sum",e[0].dataType,o,w));let P=A(e[0].dataType),V=A(1,w);return`

      ${z.registerUniforms(B).declareVariables(...R)}
      var<workgroup> sum_shared : array<${V}, ${$}>;
      var<workgroup> sum_squared_shared : array<${V}, ${$}>;

      ${z.mainStart([$,1,1])}
        let ix = local_id.x;
        let iy = global_id.x / ${$};

        let hidden_size_vectorized: u32 = uniforms.hidden_size / uniforms.components;
        var stride = hidden_size_vectorized / ${$};
        let offset = ix * stride + iy * hidden_size_vectorized;
        let offset1d = stride * ix;
        if (ix == ${$-1}) {
          stride = hidden_size_vectorized - stride * ix;
        }
        for (var i: u32 = 0; i < stride; i++) {
          let skip_value = skip[offset + i];
          let bias_value = ${h?"bias[offset1d + i]":P+"(0.0)"};
          let input_value = x[offset + i];
          let value = input_value + skip_value + bias_value;
          ${_?"input_skip_bias_sum[offset + i] = value;":""}
          output[offset + i] = value;
          let f32_value = ${F(P,w,"value")};
          sum_shared[ix] += f32_value;
          sum_squared_shared[ix] += f32_value * f32_value;
        }
        workgroupBarrier();

        var reduce_size : u32 = ${$};
        for (var curr_size = reduce_size >> 1;  curr_size > 0; curr_size = reduce_size >> 1) {
          reduce_size = curr_size + (reduce_size & 1);
          if (ix < curr_size) {
            sum_shared[ix] += sum_shared[ix + reduce_size];
            sum_squared_shared[ix] += sum_squared_shared[ix + reduce_size];
          }
          workgroupBarrier();
        }

        let sum = sum_shared[0];
        let square_sum = sum_squared_shared[0];
        let mean = ${U("sum",w)} / f32(uniforms.hidden_size);
        let inv_std_dev = inverseSqrt(${U("square_sum",w)} / f32(uniforms.hidden_size) ${a?"":"- mean * mean"} + uniforms.epsilon);
        ${f?"mean_output[global_idx] = mean;":""}
        ${m?"inv_std_output[global_idx] = inv_std_dev;":""}

        for (var i: u32 = 0; i < stride; i++) {
          output[offset + i] = (output[offset + i] ${a?"":`- ${P}(mean)`}) *
            ${P}(inv_std_dev) * gamma[offset1d + i]
            ${p?"+ beta[offset1d + i]":""};
        }
      }`},v=[{dims:o,dataType:e[0].dataType}];return r>1&&v.push({dims:d,dataType:1}),r>2&&v.push({dims:d,dataType:1}),r>3&&v.push({dims:n,dataType:e[0].dataType}),{name:"SkipLayerNormalization",shaderCache:{hint:`${w};${f};${m};${_}`,inputDependencies:e.map((z,B)=>"type")},getShaderSource:S,getRunData:()=>({outputs:v,dispatchGroup:{x:Math.ceil(u/l)},programUniforms:y})}},Xd=(e,t)=>{Zd(e.inputs);let r=[0];e.outputCount>1&&r.push(-3),e.outputCount>2&&r.push(-3),e.outputCount>3&&r.push(3),e.compute(Qd(e.inputs,t,e.outputCount,!1),{outputs:r})}}),Yd,ma,Jd,Wn,ep,tp,rp,ip,qc=I(()=>{le(),te(),b(),J(),Yd=(e,t)=>{if(!e||e.length<1)throw new Error("too few inputs");if(t.axes.length!==0){if(t.axes.length!==t.starts.length||t.axes.length!==t.ends.length)throw new Error("axes, starts and ends must have the same length")}else if(t.starts.length!==t.ends.length)throw new Error("starts and ends must have the same length");e.slice(1).forEach((r,i)=>{if(e[i+1].dataType!==6&&e[i+1].dataType!==7)throw new Error(`Input ${i} must be an array of int32 or int64`)})},ma=(e,t)=>{let r=[];if(e.length>t)if(e[t].dataType===7)e[t].getBigInt64Array().forEach(i=>r.push(Number(i)));else if(e[t].dataType===6)e[t].getInt32Array().forEach(i=>r.push(Number(i)));else throw new Error(`Input ${t} must be an array of int32 or int64`);return r},Jd=(e,t)=>{if(e.length>1){let r=ma(e,1),i=ma(e,2),a=ma(e,3);return a.length===0&&(a=[...Array(e[0].dims.length).keys()]),g({starts:r,ends:i,axes:a})}else return t},Wn=(e,t,r,i,a)=>{let n=e;return e<0&&(n+=r[i[t]]),a[t]<0?Math.max(0,Math.min(n,r[i[t]]-1)):Math.max(0,Math.min(n,r[i[t]]))},ep=(e,t,r)=>`fn calculateInputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
          var input_indices: ${e.type.indices};
          var carry = 0u;
          for (var i = ${r.length-1}; i >= 0; i--) {
            let input_shape_i = ${M("uniforms.input_shape","i",r.length)};
            let steps_i = ${M("uniforms.steps","i",r.length)};
            let signs_i = ${M("uniforms.signs","i",r.length)};
            let starts_i = ${M("uniforms.starts","i",r.length)};
            var output_index = ${t.indicesGet("output_indices","i")};
            var input_index = output_index * steps_i + starts_i + carry;
            carry = input_index / input_shape_i;
            input_index = input_index % input_shape_i;
            if (signs_i < 0) {
              input_index = input_shape_i - input_index - 1u + starts_i;
            }
            ${e.indicesSet("input_indices","i","input_index")};
          }
          return input_indices;
      }`,tp=(e,t)=>{let r=e[0].dims,i=D.size(r),a=t.axes.length>0?D.normalizeAxes(t.axes,r.length):[...Array(r.length).keys()],n=ma(e,4);n.forEach(w=>w!==0||(()=>{throw new Error("step cannot be 0")})),n.length===0&&(n=Array(a.length).fill(1));let s=t.starts.map((w,y)=>Wn(w,y,r,a,n)),o=t.ends.map((w,y)=>Wn(w,y,r,a,n));if(a.length!==s.length||a.length!==o.length)throw new Error("start, ends and axes should have the same number of elements");if(a.length!==r.length)for(let w=0;w<r.length;++w)a.includes(w)||(s.splice(w,0,0),o.splice(w,0,r[w]),n.splice(w,0,1));let u=n.map(w=>Math.sign(w));n.forEach((w,y,S)=>{if(w<0){let v=(o[y]-s[y])/w,z=s[y],B=z+v*n[y];s[y]=B,o[y]=z,S[y]=-w}});let l=r.slice(0);a.forEach((w,y)=>{l[w]=Math.ceil((o[w]-s[w])/n[w])});let d={dims:l,dataType:e[0].dataType},p=q("output",e[0].dataType,l.length),h=C("input",e[0].dataType,e[0].dims.length),f=D.size(l),m=[{name:"outputSize",type:"u32"},{name:"starts",type:"u32",length:s.length},{name:"signs",type:"i32",length:u.length},{name:"steps",type:"u32",length:n.length}],_=[{type:12,data:f},{type:12,data:s},{type:6,data:u},{type:12,data:n},...k(e[0].dims,l)],$=w=>`
      ${w.registerUniforms(m).declareVariables(h,p)}
        ${ep(h,p,r)}
        ${w.mainStart()}
          ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
          let output_indices = ${p.offsetToIndices("global_idx")};
          let input_indices = calculateInputIndices(output_indices);
          ${p.setByOffset("global_idx",h.getByIndices("input_indices"))}
      }`;return{name:"Slice",shaderCache:{hint:`${u.length}_${s.length}_${n.length}`,inputDependencies:["rank"]},getShaderSource:$,getRunData:()=>({outputs:[d],dispatchGroup:{x:Math.ceil(i/64)},programUniforms:_})}},rp=(e,t)=>{Yd(e.inputs,t);let r=Jd(e.inputs,t);e.compute(tp(e.inputs,r),{inputs:[0]})},ip=e=>{let t=e.starts,r=e.ends,i=e.axes;return g({starts:t,ends:r,axes:i})}}),ap,np,sp,op,Gc=I(()=>{le(),te(),b(),rt(),J(),ap=e=>{if(!e||e.length!==1)throw new Error("Softmax op requires 1 input.")},np=(e,t)=>{let r=e.inputs[0],i=r.dims,a=D.size(i),n=i.length,s=D.normalizeAxis(t.axis,n),o=s<i.length-1,u,l=[];o?(l=Array.from({length:n},(R,P)=>P),l[s]=n-1,l[n-1]=s,u=e.compute(ht(r,l),{inputs:[r],outputs:[-1]})[0]):u=r;let d=u.dims,p=d[n-1],h=a/p,f=O(p),m=p/f,_=64;h===1&&(_=256);let $=(R,P)=>P===4?`max(max(${R}.x, ${R}.y), max(${R}.z, ${R}.w))`:P===2?`max(${R}.x, ${R}.y)`:P===3?`max(max(${R}.x, ${R}.y), ${R}.z)`:R,w=C("x",u.dataType,u.dims,f),y=q("result",u.dataType,u.dims,f),S=w.type.value,v=A(u.dataType)==="f32"?`var threadMax = ${S}(-3.4028234663852886e+38f);`:`var threadMax = ${S}(-65504.0h);`,z=R=>`
      var<workgroup> rowMaxShared : ${S};
      var<workgroup> rowSumShared : ${S};
      var<workgroup> threadShared : array<${S}, ${_}>;

      fn getValue(row: i32, col: i32, row_stride: i32) -> ${S} {
        let index = row * row_stride + col;
        return x[index];
      }

      fn setValue(row: i32, col: i32, row_stride: i32, value: ${S}) {
        let index = row * row_stride + col;
        result[index] = value;
      }
      ${R.registerUniform("packedCols","i32").declareVariables(w,y)}
      ${R.mainStart(_)}
        let gindex = i32(global_idx);
        let lindex = i32(local_idx);
        const wg = ${_};
        let row = gindex / wg;
        let cols = uniforms.packedCols;
        let row_stride : i32 = uniforms.packedCols;

        // find the rows max
        ${v}
        for (var col = lindex; col < cols; col += wg) {
          let value = getValue(row, col, row_stride);
          threadMax = max(threadMax, value);
        }
        if (lindex < cols) {
          threadShared[lindex] = threadMax;
        }
        workgroupBarrier();

        var reduceSize = min(cols, wg);
        for (var currSize = reduceSize >> 1;  currSize > 0; currSize = reduceSize >> 1) {
          reduceSize = currSize + (reduceSize & 1);
          if (lindex < currSize) {
            threadShared[lindex] = max(threadShared[lindex], threadShared[lindex + reduceSize]);
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowMaxShared = ${S}(${$("threadShared[0]",f)});
        }
        workgroupBarrier();

        // find the rows sum
        var threadSum = ${S}(0.0);
        for (var col = lindex; col < cols; col += wg) {
          let subExp = exp(getValue(row, col, row_stride) - rowMaxShared);
          threadSum += subExp;
        }
        threadShared[lindex] = threadSum;
        workgroupBarrier();

        for (var currSize = wg >> 1;  currSize > 0; currSize = currSize >> 1) {
          if (lindex < currSize) {
            threadShared[lindex] = threadShared[lindex] + threadShared[lindex + currSize];
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowSumShared = ${S}(${U("threadShared[0]",f)});
        }
        workgroupBarrier();

        // calculate final value for each element in the row
        for (var col = lindex; col < cols; col += wg) {
          var value = exp(getValue(row, col, row_stride) - rowMaxShared) / rowSumShared;
          // max operation protects against NaN since all values should be >=0
          value = max(value, ${S}(0.0));
          setValue(row, col, row_stride, value);
        }
      }`,B=e.compute({name:"Softmax",shaderCache:{hint:`${f};${_}`,inputDependencies:["type"]},getRunData:()=>({outputs:[{dims:d,dataType:u.dataType}],dispatchGroup:{x:h},programUniforms:[{type:6,data:m}]}),getShaderSource:z},{inputs:[u],outputs:[o?-1:0]})[0];o&&e.compute(ht(B,l),{inputs:[B]})},sp=(e,t)=>{ap(e.inputs),np(e,t)},op=e=>g({axis:e.axis})}),jn,up,lp,dp,pp,Wc=I(()=>{le(),te(),J(),jn=e=>Array.from(e.getBigInt64Array(),Number),up=e=>{if(!e||e.length!==2)throw new Error("Tile requires 2 inputs.");if(e[0].dataType!==1&&e[0].dataType!==10&&e[0].dataType!==6&&e[0].dataType!==12)throw new Error("Tile only support float, float16, int32, and uint32 data types");if(e[1].dataType!==7)throw new Error("Tile `repeats` input should be of int64 data type");if(e[1].dims.length!==1)throw new Error("Tile `repeats` input should be 1-D");if(jn(e[1]).length!==e[0].dims.length)throw new Error("Tile `repeats` input should have same number of elements as rank of input data tensor")},lp=(e,t)=>{let r=[];for(let i=0;i<e.length;++i)r.push(e[i]*t[i]);return r},dp=(e,t)=>{let r=e[0].dims,i=t??jn(e[1]),a=lp(r,i),n=D.size(a),s=e[0].dataType,o=C("input",s,r.length),u=q("output",s,a.length),l=d=>`
      const inputShape = ${o.indices(...r)};
      ${d.registerUniform("output_size","u32").declareVariables(o,u)}
      ${d.mainStart()}
      ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let output_indices = ${u.offsetToIndices("global_idx")};
      var input_indices: ${o.type.indices};
      for (var i = 0; i < ${r.length}; i++) {
        let input_dim_i = ${o.indicesGet("uniforms.input_shape","i")};
        let input_dim_value = ${u.indicesGet("output_indices","i")}  % input_dim_i;

        ${o.indicesSet("input_indices","i","input_dim_value")}
      }
      ${u.setByOffset("global_idx",o.getByIndices("input_indices"))}
    }`;return{name:"Tile",shaderCache:{hint:`${i}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:a,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:[{type:12,data:n},...k(e[0].dims,a)]}),getShaderSource:l}},pp=e=>{up(e.inputs),e.compute(dp(e.inputs),{inputs:[0]})}}),cp,hp,fp,jc=I(()=>{le(),te(),J(),cp=(e,t,r,i,a)=>{let n=q("output_data",a,r.length,4),s=C("a_data",t[1].dataType,t[1].dims.length,4),o=C("b_data",t[2].dataType,t[2].dims.length,4),u=C("c_data",t[0].dataType,t[0].dims.length,4),l,d=(p,h,f)=>`select(${h}, ${p}, ${f})`;if(!i)l=n.setByOffset("global_idx",d(s.getByOffset("global_idx"),o.getByOffset("global_idx"),u.getByOffset("global_idx")));else{let p=(h,f,m="")=>{let _=`a_data[index_a${f}][component_a${f}]`,$=`b_data[index_b${f}][component_b${f}]`,w=`bool(c_data[index_c${f}] & (0xffu << (component_c${f} * 8)))`;return`
            let output_indices${f} = ${n.offsetToIndices(`global_idx * 4u + ${f}u`)};
            let offset_a${f} = ${s.broadcastedIndicesToOffset(`output_indices${f}`,n)};
            let offset_b${f} = ${o.broadcastedIndicesToOffset(`output_indices${f}`,n)};
            let offset_c${f} = ${u.broadcastedIndicesToOffset(`output_indices${f}`,n)};
            let index_a${f} = offset_a${f} / 4u;
            let index_b${f} = offset_b${f} / 4u;
            let index_c${f} = offset_c${f} / 4u;
            let component_a${f} = offset_a${f} % 4u;
            let component_b${f} = offset_b${f} % 4u;
            let component_c${f} = offset_c${f} % 4u;
            ${h}[${f}] = ${m}(${d(_,$,w)});
          `};a===9?l=`
            var data = vec4<u32>(0);
            ${p("data",0,"u32")}
            ${p("data",1,"u32")}
            ${p("data",2,"u32")}
            ${p("data",3,"u32")}
            output_data[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:l=`
            ${p("output_data[global_idx]",0)}
            ${p("output_data[global_idx]",1)}
            ${p("output_data[global_idx]",2)}
            ${p("output_data[global_idx]",3)}
          `}return`
        ${e.registerUniform("vec_size","u32").declareVariables(u,s,o,n)}
        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${l}
      }`},hp=e=>{let t=e[1].dims,r=e[2].dims,i=e[0].dims,a=e[1].dataType,n=!(D.areEqual(t,r)&&D.areEqual(r,i)),s=t,o=D.size(t);if(n){let l=Zt.calcShape(Zt.calcShape(t,r,!1),i,!1);if(!l)throw new Error("Can't perform where op on the given tensors");s=l,o=D.size(s)}let u=Math.ceil(o/4);return{name:"Where",shaderCache:{inputDependencies:["rank","rank","rank"]},getShaderSource:l=>cp(l,e,s,n,a),getRunData:()=>({outputs:[{dims:s,dataType:a}],dispatchGroup:{x:Math.ceil(o/64/4)},programUniforms:[{type:12,data:u},...k(i,t,r,s)]})}},fp=e=>{e.compute(hp(e.inputs))}}),mp,Hc=I(()=>{oc(),un(),uc(),lc(),dc(),pc(),cc(),yc(),wc(),bc(),$c(),vc(),xc(),Sc(),Tc(),Ec(),kc(),Ic(),zc(),Cc(),Ac(),Oc(),Rc(),Bc(),Mc(),kl(),Dc(),Pc(),Uc(),Nc(),Lc(),nn(),Vc(),Pl(),Fc(),qc(),Gc(),Bl(),Wc(),rt(),cn(),jc(),mp=new Map([["Abs",[Ks]],["Acos",[Zs]],["Acosh",[Qs]],["Add",[Uo]],["ArgMax",[Rs,on]],["ArgMin",[Os,on]],["Asin",[Xs]],["Asinh",[Ys]],["Atan",[Js]],["Atanh",[eo]],["Attention",[Ns]],["AveragePool",[hd,cd]],["BatchNormalization",[qs]],["BiasAdd",[js]],["BiasSplitGelu",[Mo]],["Cast",[ro,to]],["Ceil",[no]],["Clip",[ao]],["Concat",[Yo,Jo]],["Conv",[Tn,xn]],["ConvTranspose",[Eu,xu]],["Cos",[so]],["Cosh",[oo]],["CumSum",[Iu,zu]],["DepthToSpace",[Ru,Bu]],["DequantizeLinear",[vd,xd]],["Div",[No]],["Einsum",[Lu,Vu]],["Elu",[uo,la]],["Equal",[Lo]],["Erf",[lo]],["Exp",[po]],["Expand",[Wu]],["FastGelu",[Hu]],["Floor",[co]],["FusedConv",[Tn,xn]],["Gather",[Xu,Qu]],["GatherElements",[ul,ol]],["GatherBlockQuantized",[il,al]],["GatherND",[Ju,el]],["Gelu",[ho]],["Gemm",[cl,pl]],["GlobalAveragePool",[md,fd]],["GlobalMaxPool",[wd,_d]],["Greater",[Go]],["GreaterOrEqual",[jo]],["GridSample",[$l,vl]],["GroupQueryAttention",[Vl]],["HardSigmoid",[$o,bo]],["InstanceNormalization",[Gl]],["LayerNormalization",[Hl]],["LeakyRelu",[fo,la]],["Less",[Wo]],["LessOrEqual",[Ho]],["Log",[zo]],["MatMul",[Zl]],["MatMulNBits",[Jl,ed]],["MaxPool",[gd,yd]],["Mul",[Vo]],["MultiHeadAttention",[El,Sl]],["Neg",[go]],["Not",[mo]],["Pad",[ld]],["Pow",[Fo]],["QuickGelu",[Oo,la]],["Range",[Ed]],["Reciprocal",[yo]],["ReduceMin",[ks]],["ReduceMean",[vs]],["ReduceMax",[Es]],["ReduceSum",[zs]],["ReduceProd",[Is]],["ReduceL1",[xs]],["ReduceL2",[Ss]],["ReduceLogSum",[As]],["ReduceLogSumExp",[Ts]],["ReduceSumSquare",[Cs]],["Relu",[_o]],["Resize",[Hd,Kd]],["RotaryEmbedding",[Dl]],["ScatterND",[Cd,zd]],["Sigmoid",[wo]],["Sin",[vo]],["Sinh",[xo]],["Slice",[rp,ip]],["SkipLayerNormalization",[Xd]],["Split",[Ol,Rl]],["Sqrt",[So]],["Softmax",[sp,op]],["Sub",[qo]],["Tan",[To]],["Tanh",[Eo]],["ThresholdedRelu",[Io,la]],["Tile",[pp]],["Transpose",[aa,na]],["Where",[fp]]])}),gp,Kc=I(()=>{Ye(),kt(),J(),gp=class{constructor(e){this.backend=e,this.repo=new Map,this.attributesBound=!1}getArtifact(e){return this.repo.get(e)}setArtifact(e,t){this.repo.set(e,t)}run(e,t,r,i,a){et(e.programInfo.name);let n=this.backend.device,s=this.backend.getComputePassEncoder();this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2);let o=[];for(let l of t)o.push({binding:o.length,resource:{buffer:l.buffer}});for(let l of r)o.push({binding:o.length,resource:{buffer:l.buffer}});a&&o.push({binding:o.length,resource:a});let u=n.createBindGroup({layout:e.computePipeline.getBindGroupLayout(0),entries:o,label:e.programInfo.name});if(this.backend.sessionStatus==="capturing"){let l={kernelId:this.backend.currentKernelId,computePipeline:e.computePipeline,bindGroup:u,dispatchGroup:i};this.backend.capturedCommandList.get(this.backend.currentSessionId).push(l)}s.setPipeline(e.computePipeline),s.setBindGroup(0,u),s.dispatchWorkgroups(...i),this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2+1),this.backend.pendingDispatchNumber++,(this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber||this.backend.queryType==="at-passes")&&this.backend.endComputePass(),this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber&&this.backend.flush(),Xe(e.programInfo.name)}dispose(){}build(e,t){et(e.name);let r=this.backend.device,i=[];[{feature:"shader-f16",extension:"f16"},{feature:"subgroups",extension:"subgroups"}].forEach(l=>{r.features.has(l.feature)&&i.push(`enable ${l.extension};`)});let a=Oe(t,this.backend.device.limits),n=e.getShaderSource(a),s=`${i.join(`
`)}
${a.additionalImplementations}
${n}`,o=r.createShaderModule({code:s,label:e.name});xe("verbose",()=>`[WebGPU] ${e.name} shader code: ${s}`);let u=r.createComputePipeline({compute:{module:o,entryPoint:"main"},layout:"auto",label:e.name});return Xe(e.name),{programInfo:e,computePipeline:u,uniformVariablesInfo:a.variablesInfo}}normalizeDispatchGroupSize(e){let t=typeof e=="number"?e:e.x,r=typeof e=="number"?1:e.y||1,i=typeof e=="number"?1:e.z||1,a=this.backend.device.limits.maxComputeWorkgroupsPerDimension;if(t<=a&&r<=a&&i<=a)return[t,r,i];let n=t*r*i,s=Math.ceil(Math.sqrt(n));if(s>a){if(s=Math.ceil(Math.cbrt(n)),s>a)throw new Error("Total dispatch size exceeds WebGPU maximum.");return[s,s,s]}else return[s,s,1]}}}),yp={};be(yp,{WebGpuBackend:()=>$p});var _p,wp,bp,$p,Zc=I(()=>{Ye(),le(),kt(),dr(),rn(),Hc(),Kc(),_p=(e,t)=>{if(t.length!==e.length)throw new Error(`inputDependencies length ${t.length} is not equal to inputTensors length ${e.length}.`);let r=[];for(let i=0;i<e.length;++i){let a=e[i].dataType;switch(t[i]){case"none":{r.push("");break}case"type":{r.push(`${a}`);break}case"rank":{let n=e[i].dims.length;r.push(`${a};${n}`);break}case"dims":{let n=e[i].dims.join(",");r.push(`${a};${n}`);break}default:throw new Error(`unsupported input dependency: ${t[i]}`)}}return r.join("|")},wp=(e,t,r)=>{var a,n;let i=e.name;return(a=e.shaderCache)!=null&&a.hint&&(i+="["+e.shaderCache.hint+"]"),i+=":"+r+`:${_p(t,((n=e.shaderCache)==null?void 0:n.inputDependencies)??new Array(t.length).fill("dims"))}`,i},bp=class{constructor(e){e&&(this.architecture=e.architecture,this.vendor=e.vendor)}isArchitecture(e){return this.architecture===e}isVendor(e){return this.vendor===e}},$p=class{constructor(){this.currentSessionId=null,this.currentKernelId=null,this.commandEncoder=null,this.computePassEncoder=null,this.maxDispatchNumber=16,this.pendingDispatchNumber=0,this.pendingKernels=[],this.pendingQueries=new Map,this.sessionStatus="default",this.capturedCommandList=new Map,this.capturedPendingKernels=new Map,this.sessionExternalDataMapping=new Map}get currentKernelCustomData(){if(this.currentKernelId===null)throw new Error("currentKernelCustomData(): currentKernelId is null. (should not happen)");let e=this.kernelCustomData.get(this.currentKernelId);return e||(e={},this.kernelCustomData.set(this.currentKernelId,e)),e}async initialize(e,t){this.env=e;let r=[],i={requiredLimits:{maxComputeWorkgroupStorageSize:t.limits.maxComputeWorkgroupStorageSize,maxComputeWorkgroupsPerDimension:t.limits.maxComputeWorkgroupsPerDimension,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize,maxBufferSize:t.limits.maxBufferSize,maxComputeInvocationsPerWorkgroup:t.limits.maxComputeInvocationsPerWorkgroup,maxComputeWorkgroupSizeX:t.limits.maxComputeWorkgroupSizeX,maxComputeWorkgroupSizeY:t.limits.maxComputeWorkgroupSizeY,maxComputeWorkgroupSizeZ:t.limits.maxComputeWorkgroupSizeZ},requiredFeatures:r},a=n=>t.features.has(n)&&r.push(n)&&!0;a("chromium-experimental-timestamp-query-inside-passes")||a("timestamp-query"),a("shader-f16"),a("subgroups"),this.device=await t.requestDevice(i),this.adapterInfo=new bp(t.info||await t.requestAdapterInfo()),this.gpuDataManager=Sa(this),this.programManager=new gp(this),this.kernels=new Map,this.kernelPersistentData=new Map,this.kernelCustomData=new Map,si(e.logLevel,!!e.debug),this.device.onuncapturederror=n=>{n.error instanceof GPUValidationError&&console.error(`An uncaught WebGPU validation error was raised: ${n.error.message}`)},Object.defineProperty(this.env.webgpu,"device",{value:this.device,writable:!1,enumerable:!0,configurable:!0}),Object.defineProperty(this.env.webgpu,"adapter",{value:t,writable:!1,enumerable:!0,configurable:!1}),this.setQueryType()}dispose(){var e;typeof this.querySet<"u"&&this.querySet.destroy(),this.gpuDataManager.dispose(),this.device&&((e=this.env)!=null&&e.webgpu)&&this.device.lost.then(()=>{delete this.env.webgpu.device})}getCommandEncoder(){return this.commandEncoder||(this.commandEncoder=this.device.createCommandEncoder()),this.commandEncoder}getComputePassEncoder(){if(!this.computePassEncoder){let e=this.getCommandEncoder(),t={};this.queryType==="at-passes"&&(t.timestampWrites={querySet:this.querySet,beginningOfPassWriteIndex:this.pendingDispatchNumber*2,endOfPassWriteIndex:this.pendingDispatchNumber*2+1}),this.computePassEncoder=e.beginComputePass(t)}return this.computePassEncoder}endComputePass(){this.computePassEncoder&&(this.computePassEncoder.end(),this.computePassEncoder=null)}flush(){if(!this.commandEncoder)return;et(),this.endComputePass();let e;this.queryType!=="none"&&(this.commandEncoder.resolveQuerySet(this.querySet,0,this.pendingDispatchNumber*2,this.queryResolveBuffer,0),e=this.device.createBuffer({size:this.pendingDispatchNumber*2*8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pendingQueries.set(e,this.pendingKernels),this.pendingKernels=[],this.commandEncoder.copyBufferToBuffer(this.queryResolveBuffer,0,e,0,this.pendingDispatchNumber*2*8)),this.device.queue.submit([this.commandEncoder.finish()]),this.gpuDataManager.refreshPendingBuffers(),this.commandEncoder=null,this.pendingDispatchNumber=0,this.queryType!=="none"&&e.mapAsync(GPUMapMode.READ).then(()=>{var i;let t=new BigUint64Array(e.getMappedRange()),r=this.pendingQueries.get(e);for(let a=0;a<t.length/2;a++){let n=r[a],s=n.kernelId,o=this.kernels.get(s),u=o.kernelType,l=o.kernelName,d=n.programName,p=n.inputTensorViews,h=n.outputTensorViews,f=t[a*2],m=t[a*2+1];typeof this.queryTimeBase>"u"&&(this.queryTimeBase=f);let _=Number(f-this.queryTimeBase),$=Number(m-this.queryTimeBase);if(!Number.isSafeInteger(_)||!Number.isSafeInteger($))throw new RangeError("incorrect timestamp range");if((i=this.env.webgpu.profiling)!=null&&i.ondata)this.env.webgpu.profiling.ondata({version:1,inputsMetadata:p.map(w=>({dims:w.dims,dataType:St(w.dataType)})),outputsMetadata:h.map(w=>({dims:w.dims,dataType:St(w.dataType)})),kernelId:s,kernelType:u,kernelName:l,programName:d,startTime:_,endTime:$});else{let w="";p.forEach((S,v)=>{w+=`input[${v}]: [${S.dims}] | ${St(S.dataType)}, `});let y="";h.forEach((S,v)=>{y+=`output[${v}]: [${S.dims}] | ${St(S.dataType)}, `}),console.log(`[profiling] kernel "${s}|${u}|${l}|${d}" ${w}${y}start time: ${_} ns, execution time: ${$-_} ns`)}Ht("GPU",`${d}::${f}::${m}`)}e.unmap(),this.pendingQueries.delete(e)}),Xe()}run(e,t,r,i,a,n){et(e.name);let s=[];for(let y=0;y<t.length;++y){let S=t[y].data;if(S===0)continue;let v=this.gpuDataManager.get(S);if(!v)throw new Error(`no GPU data for input: ${S}`);s.push(v)}let{outputs:o,dispatchGroup:u,programUniforms:l}=e.getRunData(t),d=r.length===0?o.map((y,S)=>S):r;if(d.length!==o.length)throw new Error(`Output size ${d.length} must be equal to ${o.length}.`);let p=[],h=[];for(let y=0;y<o.length;++y){if(!Number.isInteger(d[y])||d[y]<-3||d[y]>=n)throw new Error(`Invalid output index: ${d[y]}`);if(d[y]===-3)continue;let S=d[y]===-1,v=d[y]===-2,z=S||v?a(o[y].dataType,o[y].dims):i(d[y],o[y].dataType,o[y].dims);if(p.push(z),z.data===0)continue;let B=this.gpuDataManager.get(z.data);if(!B)throw new Error(`no GPU data for output: ${z.data}`);if(S&&this.temporaryData.push(B),v){let R=this.kernelPersistentData.get(this.currentKernelId);R||(R=[],this.kernelPersistentData.set(this.currentKernelId,R)),R.push(B)}h.push(B)}if(s.length!==t.length||h.length!==p.length){if(h.length===0)return Xe(e.name),p;throw new Error(`Program ${e.name} has zero-sized tensor(s) in inputs or outputs. This is not supported now.`)}let f;if(l){let y=0,S=[];l.forEach(R=>{let P=typeof R.data=="number"?[R.data]:R.data;if(P.length===0)return;let V=R.type===10?2:4,W,oe;R.type===10?(oe=P.length>4?16:P.length>2?8:P.length*V,W=P.length>4?16:V*P.length):(oe=P.length<=2?P.length*V:16,W=16),y=Math.ceil(y/oe)*oe,S.push(y);let re=R.type===10?8:4;y+=P.length>4?Math.ceil(P.length/re)*W:P.length*V});let v=16;y=Math.ceil(y/v)*v;let z=new ArrayBuffer(y);l.forEach((R,P)=>{let V=S[P],W=typeof R.data=="number"?[R.data]:R.data;if(R.type===6)new Int32Array(z,V,W.length).set(W);else if(R.type===12)new Uint32Array(z,V,W.length).set(W);else if(R.type===10)new Uint16Array(z,V,W.length).set(W);else if(R.type===1)new Float32Array(z,V,W.length).set(W);else throw new Error(`Unsupported uniform type: ${St(R.type)}`)});let B=this.gpuDataManager.create(y,GPUBufferUsage.COPY_DST|GPUBufferUsage.UNIFORM);this.device.queue.writeBuffer(B.buffer,0,z,0,y),this.gpuDataManager.release(B.id),f={offset:0,size:y,buffer:B.buffer}}let m=this.programManager.normalizeDispatchGroupSize(u),_=m[1]===1&&m[2]===1,$=wp(e,t,_),w=this.programManager.getArtifact($);if(w||(w=this.programManager.build(e,m),this.programManager.setArtifact($,w),xe("info",()=>`[artifact] key: ${$}, programName: ${e.name}`)),l&&w.uniformVariablesInfo){if(l.length!==w.uniformVariablesInfo.length)throw new Error(`Uniform variables count mismatch: expect ${w.uniformVariablesInfo.length}, got ${l.length} in program "${w.programInfo.name}".`);for(let y=0;y<l.length;y++){let S=l[y],v=S.type,z=typeof S.data=="number"?1:S.data.length,[B,R]=w.uniformVariablesInfo[y];if(v!==B||z!==R)throw new Error(`Uniform variable ${y} mismatch: expect type ${B} with size ${R}, got type ${v} with size ${z} in program "${w.programInfo.name}".`)}}if(xe("info",()=>`[ProgramManager] run "${e.name}" (key=${$}) with ${m[0]}x${m[1]}x${m[2]}`),this.queryType!=="none"||this.sessionStatus==="capturing"){let y={kernelId:this.currentKernelId,programName:w.programInfo.name,inputTensorViews:t,outputTensorViews:p};this.pendingKernels.push(y),this.sessionStatus==="capturing"&&this.capturedPendingKernels.get(this.currentSessionId).push(y)}return this.programManager.run(w,s,h,m,f),Xe(e.name),p}upload(e,t){this.gpuDataManager.upload(e,t)}memcpy(e,t){this.gpuDataManager.memcpy(e,t)}async download(e,t){await this.gpuDataManager.download(e,t)}alloc(e){return this.gpuDataManager.create(e).id}free(e){return this.gpuDataManager.release(e)}createKernel(e,t,r,i){let a=mp.get(e);if(!a)throw new Error(`kernel not implemented: ${e}`);let n={kernelType:e,kernelName:i,kernelEntry:a[0],attributes:[a[1],r]};this.kernels.set(t,n)}releaseKernel(e){let t=this.kernelPersistentData.get(e);if(t){for(let r of t)this.gpuDataManager.release(r.id);this.kernelPersistentData.delete(e)}this.kernelCustomData.delete(e),this.kernels.delete(e)}computeKernel(e,t,r){let i=this.kernels.get(e);if(!i)throw new Error(`kernel not created: ${e}`);let a=i.kernelType,n=i.kernelName,s=i.kernelEntry,o=i.attributes;if(this.currentKernelId!==null)throw new Error(`kernel "[${a}] ${n}" is not allowed to be called recursively`);this.currentKernelId=e,o[0]&&(o[1]=o[0](o[1]),o[0]=void 0),xe("info",()=>`[WebGPU] Start to run kernel "[${a}] ${n}"...`);let u=this.env.debug;this.temporaryData=[];try{return u&&this.device.pushErrorScope("validation"),s(t,o[1]),0}catch(l){return r.push(Promise.resolve(`[WebGPU] Kernel "[${a}] ${n}" failed. ${l}`)),1}finally{u&&r.push(this.device.popErrorScope().then(l=>l?`GPU validation error for kernel "[${a}] ${n}": ${l.message}`:null));for(let l of this.temporaryData)this.gpuDataManager.release(l.id);this.temporaryData=[],this.currentKernelId=null}}registerBuffer(e,t,r,i){let a=this.sessionExternalDataMapping.get(e);a||(a=new Map,this.sessionExternalDataMapping.set(e,a));let n=a.get(t),s=this.gpuDataManager.registerExternalBuffer(r,i,n);return a.set(t,[s,r]),s}unregisterBuffers(e){let t=this.sessionExternalDataMapping.get(e);t&&(t.forEach(r=>this.gpuDataManager.unregisterExternalBuffer(r[0])),this.sessionExternalDataMapping.delete(e))}getBuffer(e){let t=this.gpuDataManager.get(e);if(!t)throw new Error(`no GPU data for buffer: ${e}`);return t.buffer}createDownloader(e,t,r){return async()=>{let i=await ra(this,e,t);return Qt(i.buffer,r)}}writeTimestamp(e){this.queryType==="inside-passes"&&this.computePassEncoder.writeTimestamp(this.querySet,e)}setQueryType(){var e;this.queryType="none",(((e=this.env.webgpu.profiling)==null?void 0:e.mode)==="default"||(typeof this.env.trace>"u"?this.env.wasm.trace:this.env.trace))&&(this.device.features.has("chromium-experimental-timestamp-query-inside-passes")?this.queryType="inside-passes":this.device.features.has("timestamp-query")&&(this.queryType="at-passes"),this.queryType!=="none"&&typeof this.querySet>"u"&&(this.querySet=this.device.createQuerySet({type:"timestamp",count:this.maxDispatchNumber*2}),this.queryResolveBuffer=this.device.createBuffer({size:this.maxDispatchNumber*2*8,usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.QUERY_RESOLVE})))}captureBegin(){xe("info","captureBegin"),this.capturedCommandList.get(this.currentSessionId)||this.capturedCommandList.set(this.currentSessionId,[]),this.capturedPendingKernels.get(this.currentSessionId)||this.capturedPendingKernels.set(this.currentSessionId,[]),this.flush(),this.sessionStatus="capturing"}captureEnd(){xe("info","captureEnd"),this.flush(),this.sessionStatus="default"}replay(){xe("info","replay"),this.sessionStatus="replaying";let e=this.capturedCommandList.get(this.currentSessionId),t=this.capturedPendingKernels.get(this.currentSessionId),r=e.length;this.pendingKernels=[];for(let i=0;i<r;i++){let a=this.getComputePassEncoder(),n=e[i];this.writeTimestamp(this.pendingDispatchNumber*2),a.setPipeline(n.computePipeline),a.setBindGroup(0,n.bindGroup),a.dispatchWorkgroups(...n.dispatchGroup),this.writeTimestamp(this.pendingDispatchNumber*2+1),this.pendingDispatchNumber++,this.queryType!=="none"&&this.pendingKernels.push(t[i]),(this.pendingDispatchNumber>=this.maxDispatchNumber||this.queryType==="at-passes")&&this.endComputePass(),this.pendingDispatchNumber>=this.maxDispatchNumber&&this.flush()}this.flush(),this.sessionStatus="default"}onCreateSession(){this.gpuDataManager.onCreateSession()}onReleaseSession(e){this.unregisterBuffers(e),this.capturedCommandList.has(e)&&this.capturedCommandList.delete(e),this.capturedPendingKernels.has(e)&&this.capturedPendingKernels.delete(e),this.gpuDataManager.onReleaseSession(e)}onRunStart(e){this.currentSessionId=e,this.setQueryType()}}}),vp={};be(vp,{init:()=>Sp});var Pa,xp,Sp,Qc=I(()=>{le(),kt(),te(),ta(),Pa=class Yp{constructor(t,r,i,a){this.module=t,this.dataType=r,this.data=i,this.dims=a}getFloat32Array(){if(this.dataType!==1)throw new Error("Invalid data type");let t=D.size(this.dims);return t===0?new Float32Array:new Float32Array(this.module.HEAP8.buffer,this.data,t)}getBigInt64Array(){if(this.dataType!==7)throw new Error("Invalid data type");let t=D.size(this.dims);return t===0?new BigInt64Array:new BigInt64Array(this.module.HEAP8.buffer,this.data,t)}getInt32Array(){if(this.dataType!==6)throw new Error("Invalid data type");let t=D.size(this.dims);return t===0?new Int32Array:new Int32Array(this.module.HEAP8.buffer,this.data,t)}getUint16Array(){if(this.dataType!==10&&this.dataType!==4)throw new Error("Invalid data type");let t=D.size(this.dims);return t===0?new Uint16Array:new Uint16Array(this.module.HEAP8.buffer,this.data,t)}reshape(t){if(D.size(t)!==D.size(this.dims))throw new Error("Invalid new shape");return new Yp(this.module,this.dataType,this.data,t)}},xp=class{constructor(e,t,r){this.module=e,this.backend=t,this.customDataOffset=0,this.customDataSize=0,this.adapterInfo=t.adapterInfo;let i=e.PTR_SIZE,a=r/e.PTR_SIZE,n=i===4?"i32":"i64";this.opKernelContext=Number(e.getValue(i*a++,n));let s=Number(e.getValue(i*a++,n));this.outputCount=Number(e.getValue(i*a++,n)),this.customDataOffset=Number(e.getValue(i*a++,"*")),this.customDataSize=Number(e.getValue(i*a++,n));let o=[];for(let u=0;u<s;u++){let l=Number(e.getValue(i*a++,n)),d=Number(e.getValue(i*a++,"*")),p=Number(e.getValue(i*a++,n)),h=[];for(let f=0;f<p;f++)h.push(Number(e.getValue(i*a++,n)));o.push(new Pa(e,l,d,h))}this.inputs=o}get kernelCustomData(){return this.backend.currentKernelCustomData}get customDataBuffer(){return this.module.HEAPU8.subarray(this.customDataOffset,this.customDataOffset+this.customDataSize)}compute(e,t){var s;let r=((s=t==null?void 0:t.inputs)==null?void 0:s.map(o=>typeof o=="number"?this.inputs[o]:o))??this.inputs,i=(t==null?void 0:t.outputs)??[],a=(o,u,l)=>new Pa(this.module,u,this.output(o,l),l),n=(o,u)=>{let l=Tt(o,u);if(!l)throw new Error(`Unsupported data type: ${o}`);let d=l>0?this.backend.gpuDataManager.create(l).id:0;return new Pa(this.module,o,d,u)};return this.backend.run(e,r,i,a,n,this.outputCount)}output(e,t){let r=this.module.stackSave();try{let i=this.module.PTR_SIZE,a=i===4?"i32":"i64",n=this.module.stackAlloc((1+t.length)*i);this.module.setValue(n,t.length,a);for(let s=0;s<t.length;s++)this.module.setValue(n+i*(s+1),t[s],a);return this.module._JsepOutput(this.opKernelContext,e,n)}catch(i){throw new Error(`Failed to generate kernel's output[${e}] with dims [${t}]. If you are running with pre-allocated output, please make sure the output type/dims are correct. Error: ${i}`)}finally{this.module.stackRestore(r)}}},Sp=async(e,t,r,i)=>{let a=t.jsepInit;if(!a)throw new Error("Failed to initialize JSEP. The WebAssembly module is not built with JSEP support.");if(e==="webgpu"){let n=(Zc(),Ve(yp)).WebGpuBackend,s=new n;await s.initialize(r,i),a("webgpu",[s,o=>s.alloc(Number(o)),o=>s.free(o),(o,u,l,d=!1)=>{if(d)xe("verbose",()=>`[WebGPU] jsepCopyGpuToGpu: src=${Number(o)}, dst=${Number(u)}, size=${Number(l)}`),s.memcpy(Number(o),Number(u));else{xe("verbose",()=>`[WebGPU] jsepCopyCpuToGpu: dataOffset=${Number(o)}, gpuDataId=${Number(u)}, size=${Number(l)}`);let p=t.HEAPU8.subarray(Number(o>>>0),Number(o>>>0)+Number(l));s.upload(Number(u),p)}},async(o,u,l)=>{xe("verbose",()=>`[WebGPU] jsepCopyGpuToCpu: gpuDataId=${o}, dataOffset=${u}, size=${l}`),await s.download(Number(o),()=>t.HEAPU8.subarray(Number(u)>>>0,Number(u+l)>>>0))},(o,u,l)=>s.createKernel(o,Number(u),l,t.UTF8ToString(t._JsepGetNodeName(Number(u)))),o=>s.releaseKernel(o),(o,u,l,d)=>{xe("verbose",()=>`[WebGPU] jsepRun: sessionHandle=${l}, kernel=${o}, contextDataOffset=${u}`);let p=new xp(t,s,Number(u));return s.computeKernel(Number(o),p,d)},()=>s.captureBegin(),()=>s.captureEnd(),()=>s.replay()])}else{let n=new ea(r);a("webnn",[n,()=>n.reserveTensorId(),s=>n.releaseTensorId(s),async(s,o,u,l,d)=>n.ensureTensor(s,o,u,l,d),(s,o)=>{n.uploadTensor(s,o)},async(s,o)=>n.downloadTensor(s,o),(s,o)=>n.registerMLContext(s,o),!!r.trace])}}}),Tp,Hn,Kn,fr,Ep,Zn,Ua,Qn,Xn,Yn,Jn,es,ts,kp=I(()=>{Ye(),en(),tn(),le(),vt(),Dr(),Ki(),Tp=(e,t)=>{pe()._OrtInit(e,t)!==0&&se("Can't initialize onnxruntime.")},Hn=async e=>{Tp(e.wasm.numThreads,Ur(e.logLevel))},Kn=async(e,t)=>{var i,a;(a=(i=pe()).asyncInit)==null||a.call(i);let r=e.webgpu.adapter;if(t==="webgpu"){if(typeof navigator>"u"||!navigator.gpu)throw new Error("WebGPU is not supported in current environment");if(r){if(typeof r.limits!="object"||typeof r.features!="object"||typeof r.requestDevice!="function")throw new Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.")}else{let n=e.webgpu.powerPreference;if(n!==void 0&&n!=="low-power"&&n!=="high-performance")throw new Error(`Invalid powerPreference setting: "${n}"`);let s=e.webgpu.forceFallbackAdapter;if(s!==void 0&&typeof s!="boolean")throw new Error(`Invalid forceFallbackAdapter setting: "${s}"`);if(r=await navigator.gpu.requestAdapter({powerPreference:n,forceFallbackAdapter:s}),!r)throw new Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.')}}if(t==="webnn"&&(typeof navigator>"u"||!navigator.ml))throw new Error("WebNN is not supported in current environment");{let n=(Qc(),Ve(vp)).init;t==="webgpu"&&await n("webgpu",pe(),e,r),t==="webnn"&&await n("webnn",pe(),e)}},fr=new Map,Ep=e=>{let t=pe(),r=t.stackSave();try{let i=t.PTR_SIZE,a=t.stackAlloc(2*i);t._OrtGetInputOutputCount(e,a,a+i)!==0&&se("Can't get session input/output count.");let n=i===4?"i32":"i64";return[Number(t.getValue(a,n)),Number(t.getValue(a+i,n))]}finally{t.stackRestore(r)}},Zn=(e,t)=>{let r=pe(),i=r.stackSave(),a=0;try{let n=r.PTR_SIZE,s=r.stackAlloc(2*n);r._OrtGetInputOutputMetadata(e,t,s,s+n)!==0&&se("Can't get session input/output metadata.");let o=Number(r.getValue(s,"*"));a=Number(r.getValue(s+n,"*"));let u=r.HEAP32[a/4];if(u===0)return[o,0];let l=r.HEAPU32[a/4+1],d=[];for(let p=0;p<l;p++){let h=Number(r.getValue(a+8+p*n,"*"));d.push(h!==0?r.UTF8ToString(h):Number(r.getValue(a+8+(p+l)*n,"*")))}return[o,u,d]}finally{r.stackRestore(i),a!==0&&r._OrtFree(a)}},Ua=e=>{let t=pe(),r=t._malloc(e.byteLength);if(r===0)throw new Error(`Can't create a session. failed to allocate a buffer of size ${e.byteLength}.`);return t.HEAPU8.set(e,r),[r,e.byteLength]},Qn=async(e,t)=>{var p,h,f,m;let r,i,a=pe();Array.isArray(e)?[r,i]=e:e.buffer===a.HEAPU8.buffer?[r,i]=[e.byteOffset,e.byteLength]:[r,i]=Ua(e);let n=0,s=0,o=0,u=[],l=[],d=[];try{if([s,u]=await Hi(t),(t==null?void 0:t.externalData)&&a.mountExternalData){let P=[];for(let V of t.externalData){let W=typeof V=="string"?V:V.path;P.push(Vr(typeof V=="string"?V:V.data).then(oe=>{a.mountExternalData(W,oe)}))}await Promise.all(P)}for(let P of(t==null?void 0:t.executionProviders)??[])if((typeof P=="string"?P:P.name)==="webnn"){if(a.shouldTransferToMLTensor=!1,typeof P!="string"){let V=P,W=V==null?void 0:V.context,oe=V==null?void 0:V.gpuDevice,re=V==null?void 0:V.deviceType,ie=V==null?void 0:V.powerPreference;W?a.currentContext=W:oe?a.currentContext=await a.webnnCreateMLContext(oe):a.currentContext=await a.webnnCreateMLContext({deviceType:re,powerPreference:ie})}else a.currentContext=await a.webnnCreateMLContext();break}n=await a._OrtCreateSession(r,i,s),(p=a.webgpuOnCreateSession)==null||p.call(a,n),n===0&&se("Can't create a session."),(h=a.jsepOnCreateSession)==null||h.call(a),a.currentContext&&(a.webnnRegisterMLContext(n,a.currentContext),a.currentContext=void 0,a.shouldTransferToMLTensor=!0);let[_,$]=Ep(n),w=!!(t!=null&&t.enableGraphCapture),y=[],S=[],v=[],z=[],B=[];for(let P=0;P<_;P++){let[V,W,oe]=Zn(n,P);V===0&&se("Can't get an input name."),l.push(V);let re=a.UTF8ToString(V);y.push(re),v.push(W===0?{name:re,isTensor:!1}:{name:re,isTensor:!0,type:St(W),shape:oe})}for(let P=0;P<$;P++){let[V,W,oe]=Zn(n,P+_);V===0&&se("Can't get an output name."),d.push(V);let re=a.UTF8ToString(V);S.push(re),z.push(W===0?{name:re,isTensor:!1}:{name:re,isTensor:!0,type:St(W),shape:oe});{if(w&&(t==null?void 0:t.preferredOutputLocation)===void 0){B.push("gpu-buffer");continue}let ie=typeof(t==null?void 0:t.preferredOutputLocation)=="string"?t.preferredOutputLocation:((f=t==null?void 0:t.preferredOutputLocation)==null?void 0:f[re])??"cpu",Te=a.webnnIsGraphOutput;if(ie==="cpu"&&Te&&Te(n,re)){B.push("ml-tensor-cpu-output");continue}if(ie!=="cpu"&&ie!=="cpu-pinned"&&ie!=="gpu-buffer"&&ie!=="ml-tensor")throw new Error(`Not supported preferred output location: ${ie}.`);if(w&&ie!=="gpu-buffer")throw new Error(`Not supported preferred output location: ${ie}. Only 'gpu-buffer' location is supported when enableGraphCapture is true.`);B.push(ie)}}let R=null;return B.some(P=>P==="gpu-buffer"||P==="ml-tensor"||P==="ml-tensor-cpu-output")&&(o=a._OrtCreateBinding(n),o===0&&se("Can't create IO binding."),R={handle:o,outputPreferredLocations:B,outputPreferredLocationsEncoded:B.map(P=>P==="ml-tensor-cpu-output"?"ml-tensor":P).map(P=>ii(P))}),fr.set(n,[n,l,d,R,w,!1]),[n,y,S,v,z]}catch(_){throw l.forEach($=>a._OrtFree($)),d.forEach($=>a._OrtFree($)),o!==0&&a._OrtReleaseBinding(o)!==0&&se("Can't release IO binding."),n!==0&&a._OrtReleaseSession(n)!==0&&se("Can't release session."),_}finally{a._free(r),s!==0&&a._OrtReleaseSessionOptions(s)!==0&&se("Can't release session options."),u.forEach(_=>a._free(_)),(m=a.unmountExternalData)==null||m.call(a)}},Xn=e=>{var u,l,d;let t=pe(),r=fr.get(e);if(!r)throw new Error(`cannot release session. invalid session id: ${e}`);let[i,a,n,s,o]=r;s&&(o&&t._OrtClearBoundOutputs(s.handle)!==0&&se("Can't clear bound outputs."),t._OrtReleaseBinding(s.handle)!==0&&se("Can't release IO binding.")),(u=t.jsepOnReleaseSession)==null||u.call(t,e),(l=t.webnnOnReleaseSession)==null||l.call(t,e),(d=t.webgpuOnReleaseSession)==null||d.call(t,e),a.forEach(p=>t._OrtFree(p)),n.forEach(p=>t._OrtFree(p)),t._OrtReleaseSession(i)!==0&&se("Can't release session."),fr.delete(e)},Yn=async(e,t,r,i,a,n,s=!1)=>{if(!e){t.push(0);return}let o=pe(),u=o.PTR_SIZE,l=e[0],d=e[1],p=e[3],h=p,f,m;if(l==="string"&&(p==="gpu-buffer"||p==="ml-tensor"))throw new Error("String tensor is not supported on GPU.");if(s&&p!=="gpu-buffer")throw new Error(`External buffer must be provided for input/output index ${n} when enableGraphCapture is true.`);if(p==="gpu-buffer"){let w=e[2].gpuBuffer;m=Tt(xt(l),d);{let y=o.jsepRegisterBuffer;if(!y)throw new Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');f=y(i,n,w,m)}}else if(p==="ml-tensor"){let w=e[2].mlTensor;m=Tt(xt(l),d);let y=o.webnnRegisterMLTensor;if(!y)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');f=y(i,w,xt(l),d)}else{let w=e[2];if(Array.isArray(w)){m=u*w.length,f=o._malloc(m),r.push(f);for(let y=0;y<w.length;y++){if(typeof w[y]!="string")throw new TypeError(`tensor data at index ${y} is not a string`);o.setValue(f+y*u,Ge(w[y],r),"*")}}else{let y=o.webnnIsGraphInput,S=o.webnnIsGraphOutput;if(l!=="string"&&y&&S){let v=o.UTF8ToString(a);if(y(i,v)||S(i,v)){let z=xt(l);m=Tt(z,d),h="ml-tensor";let B=o.webnnCreateTemporaryTensor,R=o.webnnUploadTensor;if(!B||!R)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');let P=await B(i,z,d);R(P,new Uint8Array(w.buffer,w.byteOffset,w.byteLength)),f=P}else m=w.byteLength,f=o._malloc(m),r.push(f),o.HEAPU8.set(new Uint8Array(w.buffer,w.byteOffset,m),f)}else m=w.byteLength,f=o._malloc(m),r.push(f),o.HEAPU8.set(new Uint8Array(w.buffer,w.byteOffset,m),f)}}let _=o.stackSave(),$=o.stackAlloc(4*d.length);try{d.forEach((y,S)=>o.setValue($+S*u,y,u===4?"i32":"i64"));let w=o._OrtCreateTensor(xt(l),f,m,$,d.length,ii(h));w===0&&se(`Can't create tensor for input/output. session=${i}, index=${n}.`),t.push(w)}finally{o.stackRestore(_)}},Jn=async(e,t,r,i,a,n)=>{var re,ie,Te,ze;let s=pe(),o=s.PTR_SIZE,u=fr.get(e);if(!u)throw new Error(`cannot run inference. invalid session id: ${e}`);let l=u[0],d=u[1],p=u[2],h=u[3],f=u[4],m=u[5],_=t.length,$=i.length,w=0,y=[],S=[],v=[],z=[],B=[],R=s.stackSave(),P=s.stackAlloc(_*o),V=s.stackAlloc(_*o),W=s.stackAlloc($*o),oe=s.stackAlloc($*o);try{[w,y]=Fi(n),dt("wasm prepareInputOutputTensor");for(let j=0;j<_;j++)await Yn(r[j],S,z,e,d[t[j]],t[j],f);for(let j=0;j<$;j++)await Yn(a[j],v,z,e,p[i[j]],_+i[j],f);pt("wasm prepareInputOutputTensor");for(let j=0;j<_;j++)s.setValue(P+j*o,S[j],"*"),s.setValue(V+j*o,d[t[j]],"*");for(let j=0;j<$;j++)s.setValue(W+j*o,v[j],"*"),s.setValue(oe+j*o,p[i[j]],"*");if(h&&!m){let{handle:j,outputPreferredLocations:Ce,outputPreferredLocationsEncoded:G}=h;if(d.length!==_)throw new Error(`input count from feeds (${_}) is expected to be always equal to model's input count (${d.length}).`);dt("wasm bindInputsOutputs");for(let K=0;K<_;K++){let X=t[K];await s._OrtBindInput(j,d[X],S[K])!==0&&se(`Can't bind input[${K}] for session=${e}.`)}for(let K=0;K<$;K++){let X=i[K];(re=a[K])!=null&&re[3]?(B.push(v[K]),s._OrtBindOutput(j,p[X],v[K],0)!==0&&se(`Can't bind pre-allocated output[${K}] for session=${e}.`)):s._OrtBindOutput(j,p[X],0,G[X])!==0&&se(`Can't bind output[${K}] to ${Ce[K]} for session=${e}.`)}pt("wasm bindInputsOutputs"),fr.set(e,[l,d,p,h,f,!0])}(ie=s.jsepOnRunStart)==null||ie.call(s,l),(Te=s.webnnOnRunStart)==null||Te.call(s,l);let ae;h?ae=await s._OrtRunWithBinding(l,h.handle,$,W,w):ae=await s._OrtRun(l,V,P,_,oe,$,W,w),ae!==0&&se("failed to call OrtRun().");let ce=[],Ze=[];dt("wasm ProcessOutputTensor");for(let j=0;j<$;j++){let Ce=Number(s.getValue(W+j*o,"*"));if(Ce===v[j]||B.includes(v[j])){ce.push(a[j]),Ce!==v[j]&&s._OrtReleaseTensor(Ce)!==0&&se("Can't release tensor.");continue}let G=s.stackSave(),K=s.stackAlloc(4*o),X=!1,H,Re=0;try{s._OrtGetTensorData(Ce,K,K+o,K+2*o,K+3*o)!==0&&se(`Can't access output tensor data on index ${j}.`);let sr=o===4?"i32":"i64",ot=Number(s.getValue(K,sr));Re=s.getValue(K+o,"*");let Wt=s.getValue(K+o*2,"*"),jt=Number(s.getValue(K+o*3,sr)),gr=[];for(let nt=0;nt<jt;nt++)gr.push(Number(s.getValue(Wt+nt*o,sr)));s._OrtFree(Wt)!==0&&se("Can't free memory for tensor dims.");let yr=gr.reduce((nt,Qe)=>nt*Qe,1);H=St(ot);let _a=h==null?void 0:h.outputPreferredLocations[i[j]];if(H==="string"){if(_a==="gpu-buffer"||_a==="ml-tensor")throw new Error("String tensor is not supported on GPU.");let nt=[];for(let Qe=0;Qe<yr;Qe++){let or=s.getValue(Re+Qe*o,"*"),th=s.getValue(Re+(Qe+1)*o,"*"),rh=Qe===yr-1?void 0:th-or;nt.push(s.UTF8ToString(or,rh))}ce.push([H,gr,nt,"cpu"])}else if(_a==="gpu-buffer"&&yr>0){let nt=s.jsepGetBuffer;if(!nt)throw new Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');let Qe=nt(Re),or=Tt(ot,yr);if(or===void 0||!Nr(H))throw new Error(`Unsupported data type: ${H}`);X=!0,ce.push([H,gr,{gpuBuffer:Qe,download:s.jsepCreateDownloader(Qe,or,H),dispose:()=>{s._OrtReleaseTensor(Ce)!==0&&se("Can't release tensor.")}},"gpu-buffer"])}else if(_a==="ml-tensor"&&yr>0){let nt=s.webnnEnsureTensor,Qe=s.webnnIsGraphInputOutputTypeSupported;if(!nt||!Qe)throw new Error('preferredLocation "ml-tensor" is not supported without using WebNN.');if(Tt(ot,yr)===void 0||!Lr(H))throw new Error(`Unsupported data type: ${H}`);if(!Qe(e,H,!1))throw new Error(`preferredLocation "ml-tensor" for ${H} output is not supported by current WebNN Context.`);let or=await nt(e,Re,ot,gr,!1);X=!0,ce.push([H,gr,{mlTensor:or,download:s.webnnCreateMLTensorDownloader(Re,H),dispose:()=>{s.webnnReleaseTensorId(Re),s._OrtReleaseTensor(Ce)}},"ml-tensor"])}else if(_a==="ml-tensor-cpu-output"&&yr>0){let nt=s.webnnCreateMLTensorDownloader(Re,H)(),Qe=ce.length;X=!0,Ze.push((async()=>{let or=[Qe,await nt];return s.webnnReleaseTensorId(Re),s._OrtReleaseTensor(Ce),or})()),ce.push([H,gr,[],"cpu"])}else{let nt=Pr(H),Qe=new nt(yr);new Uint8Array(Qe.buffer,Qe.byteOffset,Qe.byteLength).set(s.HEAPU8.subarray(Re,Re+Qe.byteLength)),ce.push([H,gr,Qe,"cpu"])}}finally{s.stackRestore(G),H==="string"&&Re&&s._free(Re),X||s._OrtReleaseTensor(Ce)}}h&&!f&&(s._OrtClearBoundOutputs(h.handle)!==0&&se("Can't clear bound outputs."),fr.set(e,[l,d,p,h,f,!1]));for(let[j,Ce]of await Promise.all(Ze))ce[j][2]=Ce;return pt("wasm ProcessOutputTensor"),ce}finally{(ze=s.webnnOnRunEnd)==null||ze.call(s,l),s.stackRestore(R),S.forEach(ae=>s._OrtReleaseTensor(ae)),v.forEach(ae=>s._OrtReleaseTensor(ae)),z.forEach(ae=>s._free(ae)),w!==0&&s._OrtReleaseRunOptions(w),y.forEach(ae=>s._free(ae))}},es=e=>{let t=pe(),r=fr.get(e);if(!r)throw new Error("invalid session id");let i=r[0],a=t._OrtEndProfiling(i);a===0&&se("Can't get an profile file name."),t._OrtFree(a)},ts=e=>{let t=[];for(let r of e){let i=r[2];!Array.isArray(i)&&"buffer"in i&&t.push(i.buffer)}return t}}),mr,Et,bi,ga,ya,Na,rs,La,Jr,ei,Ip,zp,Cp,Ap,Op,Rp,Bp,Mp,Dp=I(()=>{Ye(),kp(),vt(),Or(),mr=()=>!!Y.wasm.proxy&&typeof document<"u",bi=!1,ga=!1,ya=!1,La=new Map,Jr=(e,t)=>{let r=La.get(e);r?r.push(t):La.set(e,[t])},ei=()=>{if(bi||!ga||ya||!Et)throw new Error("worker not ready")},Ip=e=>{switch(e.data.type){case"init-wasm":bi=!1,e.data.err?(ya=!0,rs[1](e.data.err)):(ga=!0,rs[0]()),Na&&(URL.revokeObjectURL(Na),Na=void 0);break;case"init-ep":case"copy-from":case"create":case"release":case"run":case"end-profiling":{let t=La.get(e.data.type);e.data.err?t.shift()[1](e.data.err):t.shift()[0](e.data.out);break}}},zp=async()=>{if(!ga){if(bi)throw new Error("multiple calls to 'initWasm()' detected.");if(ya)throw new Error("previous call to 'initWasm()' failed.");if(bi=!0,mr())return new Promise((e,t)=>{Et==null||Et.terminate(),Pi().then(([r,i])=>{try{Et=i,Et.onerror=n=>t(n),Et.onmessage=Ip,rs=[e,t];let a={type:"init-wasm",in:Y};if(!a.in.wasm.wasmPaths&&r){let n=Ir();n&&(a.in.wasm.wasmPaths=n)}Et.postMessage(a),Na=r}catch(a){t(a)}},t)});try{await Mr(Y.wasm),await Hn(Y),ga=!0}catch(e){throw ya=!0,e}finally{bi=!1}}},Cp=async e=>{if(mr())return ei(),new Promise((t,r)=>{Jr("init-ep",[t,r]);let i={type:"init-ep",in:{epName:e,env:Y}};Et.postMessage(i)});await Kn(Y,e)},Ap=async e=>mr()?(ei(),new Promise((t,r)=>{Jr("copy-from",[t,r]);let i={type:"copy-from",in:{buffer:e}};Et.postMessage(i,[e.buffer])})):Ua(e),Op=async(e,t)=>{if(mr()){if(t!=null&&t.preferredOutputLocation)throw new Error('session option "preferredOutputLocation" is not supported for proxy.');return ei(),new Promise((r,i)=>{Jr("create",[r,i]);let a={type:"create",in:{model:e,options:{...t}}},n=[];e instanceof Uint8Array&&n.push(e.buffer),Et.postMessage(a,n)})}else return Qn(e,t)},Rp=async e=>{if(mr())return ei(),new Promise((t,r)=>{Jr("release",[t,r]);let i={type:"release",in:e};Et.postMessage(i)});Xn(e)},Bp=async(e,t,r,i,a,n)=>{if(mr()){if(r.some(s=>s[3]!=="cpu"))throw new Error("input tensor on GPU is not supported for proxy.");if(a.some(s=>s))throw new Error("pre-allocated output tensor is not supported for proxy.");return ei(),new Promise((s,o)=>{Jr("run",[s,o]);let u=r,l={type:"run",in:{sessionId:e,inputIndices:t,inputs:u,outputIndices:i,options:n}};Et.postMessage(l,ts(u))})}else return Jn(e,t,r,i,a,n)},Mp=async e=>{if(mr())return ei(),new Promise((t,r)=>{Jr("end-profiling",[t,r]);let i={type:"end-profiling",in:e};Et.postMessage(i)});es(e)}}),is,Pp,Up,Xc=I(()=>{Ye(),Dp(),le(),Tr(),Ki(),is=(e,t)=>{switch(e.location){case"cpu":return[e.type,e.dims,e.data,"cpu"];case"gpu-buffer":return[e.type,e.dims,{gpuBuffer:e.gpuBuffer},"gpu-buffer"];case"ml-tensor":return[e.type,e.dims,{mlTensor:e.mlTensor},"ml-tensor"];default:throw new Error(`invalid data location: ${e.location} for ${t()}`)}},Pp=e=>{switch(e[3]){case"cpu":return new qe(e[0],e[2],e[1]);case"gpu-buffer":{let t=e[0];if(!Nr(t))throw new Error(`not supported data type: ${t} for deserializing GPU tensor`);let{gpuBuffer:r,download:i,dispose:a}=e[2];return qe.fromGpuBuffer(r,{dataType:t,dims:e[1],download:i,dispose:a})}case"ml-tensor":{let t=e[0];if(!Lr(t))throw new Error(`not supported data type: ${t} for deserializing MLTensor tensor`);let{mlTensor:r,download:i,dispose:a}=e[2];return qe.fromMLTensor(r,{dataType:t,dims:e[1],download:i,dispose:a})}default:throw new Error(`invalid data location: ${e[3]}`)}},Up=class{async fetchModelAndCopyToWasmMemory(e){return Ap(await Vr(e))}async loadModel(e,t){et();let r;typeof e=="string"?r=await this.fetchModelAndCopyToWasmMemory(e):r=e,[this.sessionId,this.inputNames,this.outputNames,this.inputMetadata,this.outputMetadata]=await Op(r,t),Xe()}async dispose(){return Rp(this.sessionId)}async run(e,t,r){et();let i=[],a=[];Object.entries(e).forEach(p=>{let h=p[0],f=p[1],m=this.inputNames.indexOf(h);if(m===-1)throw new Error(`invalid input '${h}'`);i.push(f),a.push(m)});let n=[],s=[];Object.entries(t).forEach(p=>{let h=p[0],f=p[1],m=this.outputNames.indexOf(h);if(m===-1)throw new Error(`invalid output '${h}'`);n.push(f),s.push(m)});let o=i.map((p,h)=>is(p,()=>`input "${this.inputNames[a[h]]}"`)),u=n.map((p,h)=>p?is(p,()=>`output "${this.outputNames[s[h]]}"`):null),l=await Bp(this.sessionId,a,o,s,u,r),d={};for(let p=0;p<l.length;p++)d[this.outputNames[s[p]]]=n[p]??Pp(l[p]);return Xe(),d}startProfiling(){}endProfiling(){Mp(this.sessionId)}}}),Np={};be(Np,{OnnxruntimeWebAssemblyBackend:()=>ns,initializeFlags:()=>as,wasmBackend:()=>Lp});var as,ns,Lp,Yc=I(()=>{Ye(),Dp(),Xc(),as=()=>{(typeof Y.wasm.initTimeout!="number"||Y.wasm.initTimeout<0)&&(Y.wasm.initTimeout=0);let e=Y.wasm.simd;if(typeof e!="boolean"&&e!==void 0&&e!=="fixed"&&e!=="relaxed"&&(console.warn(`Property "env.wasm.simd" is set to unknown value "${e}". Reset it to \`false\` and ignore SIMD feature checking.`),Y.wasm.simd=!1),typeof Y.wasm.proxy!="boolean"&&(Y.wasm.proxy=!1),typeof Y.wasm.trace!="boolean"&&(Y.wasm.trace=!1),typeof Y.wasm.numThreads!="number"||!Number.isInteger(Y.wasm.numThreads)||Y.wasm.numThreads<=0)if(typeof self<"u"&&!self.crossOriginIsolated)Y.wasm.numThreads=1;else{let t=typeof navigator>"u"?fe("node:os").cpus().length:navigator.hardwareConcurrency;Y.wasm.numThreads=Math.min(4,Math.ceil((t||1)/2))}},ns=class{async init(e){as(),await zp(),await Cp(e)}async createInferenceSessionHandler(e,t){let r=new Up;return await r.loadModel(e,t),r}},Lp=new ns}),Vp={};be(Vp,{InferenceSession:()=>Sr,TRACE:()=>Ht,TRACE_EVENT_BEGIN:()=>dt,TRACE_EVENT_END:()=>pt,TRACE_FUNC_BEGIN:()=>et,TRACE_FUNC_END:()=>Xe,Tensor:()=>qe,default:()=>eh,env:()=>Y,registerBackend:()=>we}),Ye(),Ye(),Ye();var Jc="1.26.0",eh=zi;{let e=(Yc(),Ve(Np)).wasmBackend;we("webgpu",e,5),we("webnn",e,5),we("cpu",e,10),we("wasm",e,10)}return Object.defineProperty(Y.versions,"web",{value:Jc,enumerable:!0}),Ve(Vp)})();/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 *//**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 *//**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */L.exports=ne})(Qp);var lh=Qp.exports,us={},Jp={};Object.defineProperty(Jp,"__esModule",{value:!0});var qa={},ec;Object.defineProperty(qa,"__esModule",{value:!0});qa.SileroLegacy=void 0;const jp=_r;class ls{constructor(ee,ne,Z,ue,he){this.ortInstance=ee,this._session=ne,this._h=Z,this._c=ue,this._sr=he,this.reset_state=()=>{const _e=Array(128).fill(0);this._h=new this.ortInstance.Tensor("float32",_e,[2,1,64]),this._c=new this.ortInstance.Tensor("float32",_e,[2,1,64])},this.process=async _e=>{var ve;const I={input:new this.ortInstance.Tensor("float32",_e,[1,_e.length]),h:this._h,c:this._c,sr:this._sr},be=await this._session.run(I);this._h=be.hn,this._c=be.cn;const[Je]=(ve=be.output)==null?void 0:ve.data;return{notSpeech:1-Je,isSpeech:Je}},this.release=async()=>{await this._session.release(),this._h.dispose(),this._c.dispose(),this._sr.dispose()}}}qa.SileroLegacy=ls;ec=ls;ls.new=async(L,ee)=>{jp.log.debug("initializing vad");const ne=await ee(),Z=await L.InferenceSession.create(ne),ue=new L.Tensor("int64",[16000n]),he=Array(2*64).fill(0),_e=new L.Tensor("float32",he,[2,1,64]),fe=new L.Tensor("float32",he,[2,1,64]);return jp.log.debug("vad is initialized"),new ec(L,Z,_e,fe,ue)};var Ga={},tc;Object.defineProperty(Ga,"__esModule",{value:!0});Ga.SileroV5=void 0;const Hp=_r;function rc(L){const ee=Array(256).fill(0);return new L.Tensor("float32",ee,[2,1,128])}class ds{constructor(ee,ne,Z,ue){this._session=ee,this._state=ne,this._sr=Z,this.ortInstance=ue,this.reset_state=()=>{this._state=rc(this.ortInstance)},this.process=async he=>{var Ve;const fe={input:new this.ortInstance.Tensor("float32",he,[1,he.length]),state:this._state,sr:this._sr},I=await this._session.run(fe);if(!I.stateN)throw new Error("No state from model");if(this._state=I.stateN,!((Ve=I.output)!=null&&Ve.data))throw new Error("No output from model");const be=I.output.data[0];if(typeof be!="number")throw new Error("Weird output data");return{notSpeech:1-be,isSpeech:be}},this.release=async()=>{await this._session.release(),this._state.dispose(),this._sr.dispose()}}}Ga.SileroV5=ds;tc=ds;ds.new=async(L,ee)=>{Hp.log.debug("Loading VAD...");const ne=await ee(),Z=await L.InferenceSession.create(ne),ue=new L.Tensor("int64",[16000n]),he=rc(L);return Hp.log.debug("...finished loading VAD"),new tc(Z,he,ue,L)};(function(L){var ee=gt&&gt.__createBinding||(Object.create?function(he,_e,fe,I){I===void 0&&(I=fe);var be=Object.getOwnPropertyDescriptor(_e,fe);(!be||("get"in be?!_e.__esModule:be.writable||be.configurable))&&(be={enumerable:!0,get:function(){return _e[fe]}}),Object.defineProperty(he,I,be)}:function(he,_e,fe,I){I===void 0&&(I=fe),he[I]=_e[fe]}),ne=gt&&gt.__exportStar||function(he,_e){for(var fe in he)fe!=="default"&&!Object.prototype.hasOwnProperty.call(_e,fe)&&ee(_e,he,fe)};Object.defineProperty(L,"__esModule",{value:!0}),L.SileroV5=L.SileroLegacy=void 0,ne(Jp,L);var Z=qa;Object.defineProperty(L,"SileroLegacy",{enumerable:!0,get:function(){return Z.SileroLegacy}});var ue=Ga;Object.defineProperty(L,"SileroV5",{enumerable:!0,get:function(){return ue.SileroV5}})})(us);var va={};Object.defineProperty(va,"__esModule",{value:!0});va.Resampler=void 0;const dh=_r;class ph{constructor(ee){this.options=ee,this.process=ne=>{const Z=[];for(const ue of ne)for(this.inputBuffer.push(ue);this.hasEnoughDataForFrame();){const he=this.generateOutputFrame();Z.push(he)}return Z},ee.nativeSampleRate<16e3&&dh.log.error("nativeSampleRate is too low. Should have 16000 = targetSampleRate <= nativeSampleRate"),this.inputBuffer=[]}async*stream(ee){for(const ne of ee)for(this.inputBuffer.push(ne);this.hasEnoughDataForFrame();)yield this.generateOutputFrame()}hasEnoughDataForFrame(){return this.inputBuffer.length*this.options.targetSampleRate/this.options.nativeSampleRate>=this.options.targetFrameSize}generateOutputFrame(){const ee=new Float32Array(this.options.targetFrameSize);let ne=0,Z=0;for(;ne<this.options.targetFrameSize;){let ue=0,he=0;for(;Z<Math.min(this.inputBuffer.length,(ne+1)*this.options.nativeSampleRate/this.options.targetSampleRate);){const _e=this.inputBuffer[Z];_e!==void 0&&(ue+=_e,he++),Z++}ee[ne]=ue/he,ne++}return this.inputBuffer=this.inputBuffer.slice(Z),ee}}va.Resampler=ph;(function(L){var ee=gt&&gt.__createBinding||(Object.create?function(ve,$e,we,Ue){Ue===void 0&&(Ue=we);var je=Object.getOwnPropertyDescriptor($e,we);(!je||("get"in je?!$e.__esModule:je.writable||je.configurable))&&(je={enumerable:!0,get:function(){return $e[we]}}),Object.defineProperty(ve,Ue,je)}:function(ve,$e,we,Ue){Ue===void 0&&(Ue=we),ve[Ue]=$e[we]}),ne=gt&&gt.__setModuleDefault||(Object.create?function(ve,$e){Object.defineProperty(ve,"default",{enumerable:!0,value:$e})}:function(ve,$e){ve.default=$e}),Z=gt&&gt.__importStar||function(ve){if(ve&&ve.__esModule)return ve;var $e={};if(ve!=null)for(var we in ve)we!=="default"&&Object.prototype.hasOwnProperty.call(ve,we)&&ee($e,ve,we);return ne($e,ve),$e};Object.defineProperty(L,"__esModule",{value:!0}),L.NonRealTimeVAD=L.defaultNonRealTimeVADOptions=void 0;const ue=Z(lh),he=$a,_e=$i,fe=er,I=ri,be=us,Je=va;L.defaultNonRealTimeVADOptions={...fe.defaultFrameProcessorOptions,modelURL:he.baseAssetPath+"silero_vad_legacy.onnx",modelFetcher:_e.defaultModelFetcher};class Ve{static async new($e={}){const we={...L.defaultNonRealTimeVADOptions,...$e};(0,fe.validateOptions)(we),we.ortConfig!==void 0&&we.ortConfig(ue);const Ue=()=>we.modelFetcher(we.modelURL),je=await be.SileroLegacy.new(ue,Ue),bt=new fe.FrameProcessor(je.process,je.reset_state,{positiveSpeechThreshold:we.positiveSpeechThreshold,negativeSpeechThreshold:we.negativeSpeechThreshold,redemptionMs:we.redemptionMs,preSpeechPadMs:we.preSpeechPadMs,minSpeechMs:we.minSpeechMs,submitUserSpeechOnPause:we.submitUserSpeechOnPause},1536/16);return bt.resume(),new this(Ue,ue,we,bt)}constructor($e,we,Ue,je){this.modelFetcher=$e,this.ort=we,this.options=Ue,this.frameProcessor=je,this.frameSamples=1536}async*run($e,we){const Ue={nativeSampleRate:we,targetSampleRate:16e3,targetFrameSize:this.frameSamples},je=new Je.Resampler(Ue);let bt=0,Rt=0,Ee=0;for await(const me of je.stream($e)){const de=[];await this.frameProcessor.process(me,Le=>{de.push(Le)});for(const Le of de)switch(Le.msg){case I.Message.SpeechStart:bt=Ee*this.frameSamples/16;break;case I.Message.SpeechEnd:Rt=(Ee+1)*this.frameSamples/16,yield{audio:Le.audio,start:bt,end:Rt};break}Ee++}const ke=[];this.frameProcessor.endSegment(me=>{ke.push(me)});for(const me of ke)switch(me.msg){case I.Message.SpeechEnd:yield{audio:me.audio,start:bt,end:Ee*this.frameSamples/16}}}}L.NonRealTimeVAD=Ve})(Zp);var Jt={};Object.defineProperty(Jt,"__esModule",{value:!0});Jt.audioFileToArray=Jt.encodeWAV=Jt.arrayBufferToBase64=Jt.minFramesForTargetMS=void 0;function ch(L,ee,ne=16e3){return Math.ceil(L*ne/1e3/ee)}Jt.minFramesForTargetMS=ch;function hh(L){const ee=new Uint8Array(L),ne=ee.byteLength,Z=new Array(ne);for(let ue=0;ue<ne;ue++){const he=ee[ue];if(he===void 0)break;Z[ue]=String.fromCharCode(he)}return btoa(Z.join(""))}Jt.arrayBufferToBase64=hh;function fh(L,ee=3,ne=16e3,Z=1,ue=32){const he=ue/8,_e=Z*he,fe=new ArrayBuffer(44+L.length*he),I=new DataView(fe);return Va(I,0,"RIFF"),I.setUint32(4,36+L.length*he,!0),Va(I,8,"WAVE"),Va(I,12,"fmt "),I.setUint32(16,16,!0),I.setUint16(20,ee,!0),I.setUint16(22,Z,!0),I.setUint32(24,ne,!0),I.setUint32(28,ne*_e,!0),I.setUint16(32,_e,!0),I.setUint16(34,ue,!0),Va(I,36,"data"),I.setUint32(40,L.length*he,!0),ee===1?gh(I,44,L):mh(I,44,L),fe}Jt.encodeWAV=fh;function mh(L,ee,ne){for(let Z=0;Z<ne.length;Z++,ee+=4)L.setFloat32(ee,ne[Z],!0)}function gh(L,ee,ne){for(let Z=0;Z<ne.length;Z++,ee+=2){const ue=Math.max(-1,Math.min(1,ne[Z]));L.setInt16(ee,ue<0?ue*32768:ue*32767,!0)}}function Va(L,ee,ne){for(let Z=0;Z<ne.length;Z++)L.setUint8(ee+Z,ne.charCodeAt(Z))}async function yh(L){const ee=new OfflineAudioContext(1,1,44100),ne=new FileReader;let Z=null;if(await new Promise(_e=>{ne.addEventListener("loadend",()=>{const fe=ne.result;ee.decodeAudioData(fe,I=>{Z=I,ee.startRendering().then(()=>{console.log("Rendering completed successfully"),_e()}).catch(be=>{console.error("Rendering failed: ",be)})},I=>{console.log("Error with decoding audio data: ",I)})}),ne.readAsArrayBuffer(L)}),Z===null)throw Error("some shit");const ue=Z,he=new Float32Array(ue.length);for(let _e=0;_e<ue.length;_e++)for(let fe=0;fe<ue.numberOfChannels;fe++){const I=ue.getChannelData(fe)[_e],be=he[_e];if(I===void 0||be===void 0)throw new Error("sample or out[i] is undefined");he[_e]=be+I}return{audio:he,sampleRate:ue.sampleRate}}Jt.audioFileToArray=yh;var ic={},ac={exports:{}};/*!
 * ONNX Runtime Web v1.26.0
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */(function(L,ee){var ne=(()=>{var Z=Object.defineProperty,ue=Object.getOwnPropertyDescriptor,he=Object.getOwnPropertyNames,_e=Object.prototype.hasOwnProperty,fe=(c=>typeof Ot<"u"?Ot:typeof Proxy<"u"?new Proxy(c,{get:(g,b)=>(typeof Ot<"u"?Ot:g)[b]}):c)(function(c){if(typeof Ot<"u")return Ot.apply(this,arguments);throw Error('Dynamic require of "'+c+'" is not supported')}),I=(c,g)=>()=>(c&&(g=c(c=0)),g),be=(c,g)=>{for(var b in g)Z(c,b,{get:g[b],enumerable:!0})},Je=(c,g,b,T)=>{if(g&&typeof g=="object"||typeof g=="function")for(let x of he(g))!_e.call(c,x)&&x!==b&&Z(c,x,{get:()=>g[x],enumerable:!(T=ue(g,x))||T.enumerable});return c},Ve=c=>Je(Z({},"__esModule",{value:!0}),c),ve,$e,we,Ue,je,bt=I(()=>{ve=new Map,$e=[],we=(c,g,b)=>{if(g&&typeof g.init=="function"&&typeof g.createInferenceSessionHandler=="function"){let T=ve.get(c);if(T===void 0)ve.set(c,{backend:g,priority:b});else{if(T.priority>b)return;if(T.priority===b&&T.backend!==g)throw new Error(`cannot register backend "${c}" using priority ${b}`)}if(b>=0){let x=$e.indexOf(c);x!==-1&&$e.splice(x,1);for(let A=0;A<$e.length;A++)if(ve.get($e[A]).priority<=b){$e.splice(A,0,c);return}$e.push(c)}return}throw new TypeError("not a valid backend")},Ue=async c=>{let g=ve.get(c);if(!g)return"backend not found.";if(g.initialized)return g.backend;if(g.aborted)return g.error;{let b=!!g.initPromise;try{return b||(g.initPromise=g.backend.init(c)),await g.initPromise,g.initialized=!0,g.backend}catch(T){return b||(g.error=`${T}`,g.aborted=!0),g.error}finally{delete g.initPromise}}},je=async c=>{let g=c.executionProviders||[],b=g.map(O=>typeof O=="string"?O:O.name),T=b.length===0?$e:b,x,A=[],E=new Set;for(let O of T){let N=await Ue(O);typeof N=="string"?A.push({name:O,err:N}):(x||(x=N),x===N&&E.add(O))}if(!x)throw new Error(`no available backend found. ERR: ${A.map(O=>`[${O.name}] ${O.err}`).join(", ")}`);for(let{name:O,err:N}of A)b.includes(O)&&console.warn(`removing requested execution provider "${O}" from session options because it is not available: ${N}`);let k=g.filter(O=>E.has(typeof O=="string"?O:O.name));return[x,new Proxy(c,{get:(O,N)=>N==="executionProviders"?k:Reflect.get(O,N)})]}}),Rt=I(()=>{bt()}),Ee,ke=I(()=>{Ee="1.26.0"}),me,de,Le=I(()=>{ke(),me="warning",de={wasm:{},webgl:{},webgpu:{},versions:{common:Ee},set logLevel(c){if(c!==void 0){if(typeof c!="string"||["verbose","info","warning","error","fatal"].indexOf(c)===-1)throw new Error(`Unsupported logging level: ${c}`);me=c}},get logLevel(){return me}},Object.defineProperty(de,"logLevel",{enumerable:!0})}),Y,ut=I(()=>{Le(),Y=de}),We,yt,ur=I(()=>{We=(c,g)=>{let b=typeof document<"u"?document.createElement("canvas"):new OffscreenCanvas(1,1);b.width=c.dims[3],b.height=c.dims[2];let T=b.getContext("2d");if(T!=null){let x,A;(g==null?void 0:g.tensorLayout)!==void 0&&g.tensorLayout==="NHWC"?(x=c.dims[2],A=c.dims[3]):(x=c.dims[3],A=c.dims[2]);let E=(g==null?void 0:g.format)!==void 0?g.format:"RGB",k=g==null?void 0:g.norm,O,N;k===void 0||k.mean===void 0?O=[255,255,255,255]:typeof k.mean=="number"?O=[k.mean,k.mean,k.mean,k.mean]:(O=[k.mean[0],k.mean[1],k.mean[2],0],k.mean[3]!==void 0&&(O[3]=k.mean[3])),k===void 0||k.bias===void 0?N=[0,0,0,0]:typeof k.bias=="number"?N=[k.bias,k.bias,k.bias,k.bias]:(N=[k.bias[0],k.bias[1],k.bias[2],0],k.bias[3]!==void 0&&(N[3]=k.bias[3]));let F=A*x,U=0,M=F,Q=F*2,C=-1;E==="RGBA"?(U=0,M=F,Q=F*2,C=F*3):E==="RGB"?(U=0,M=F,Q=F*2):E==="RBG"&&(U=0,Q=F,M=F*2);for(let q=0;q<A;q++)for(let Ne=0;Ne<x;Ne++){let ye=(c.data[U++]-N[0])*O[0],ge=(c.data[M++]-N[1])*O[1],Oe=(c.data[Q++]-N[2])*O[2],J=C===-1?255:(c.data[C++]-N[3])*O[3];T.fillStyle="rgba("+ye+","+ge+","+Oe+","+J+")",T.fillRect(Ne,q,1,1)}if("toDataURL"in b)return b.toDataURL();throw new Error("toDataURL is not supported")}else throw new Error("Can not access image data")},yt=(c,g)=>{let b=typeof document<"u"?document.createElement("canvas").getContext("2d"):new OffscreenCanvas(1,1).getContext("2d"),T;if(b!=null){let x,A,E;(g==null?void 0:g.tensorLayout)!==void 0&&g.tensorLayout==="NHWC"?(x=c.dims[2],A=c.dims[1],E=c.dims[3]):(x=c.dims[3],A=c.dims[2],E=c.dims[1]);let k=g!==void 0&&g.format!==void 0?g.format:"RGB",O=g==null?void 0:g.norm,N,F;O===void 0||O.mean===void 0?N=[255,255,255,255]:typeof O.mean=="number"?N=[O.mean,O.mean,O.mean,O.mean]:(N=[O.mean[0],O.mean[1],O.mean[2],255],O.mean[3]!==void 0&&(N[3]=O.mean[3])),O===void 0||O.bias===void 0?F=[0,0,0,0]:typeof O.bias=="number"?F=[O.bias,O.bias,O.bias,O.bias]:(F=[O.bias[0],O.bias[1],O.bias[2],0],O.bias[3]!==void 0&&(F[3]=O.bias[3]));let U=A*x;if(g!==void 0&&(g.format!==void 0&&E===4&&g.format!=="RGBA"||E===3&&g.format!=="RGB"&&g.format!=="BGR"))throw new Error("Tensor format doesn't match input tensor dims");let M=4,Q=0,C=1,q=2,Ne=3,ye=0,ge=U,Oe=U*2,J=-1;k==="RGBA"?(ye=0,ge=U,Oe=U*2,J=U*3):k==="RGB"?(ye=0,ge=U,Oe=U*2):k==="RBG"&&(ye=0,Oe=U,ge=U*2),T=b.createImageData(x,A);for(let Pe=0;Pe<A*x;Q+=M,C+=M,q+=M,Ne+=M,Pe++)T.data[Q]=(c.data[ye++]-F[0])*N[0],T.data[C]=(c.data[ge++]-F[1])*N[1],T.data[q]=(c.data[Oe++]-F[2])*N[2],T.data[Ne]=J===-1?255:(c.data[J++]-F[3])*N[3]}else throw new Error("Can not access image data");return T}}),lt,$t,wr,br,Be,zt,vi=I(()=>{vr(),lt=(c,g)=>{if(c===void 0)throw new Error("Image buffer must be defined");if(g.height===void 0||g.width===void 0)throw new Error("Image height and width must be defined");if(g.tensorLayout==="NHWC")throw new Error("NHWC Tensor layout is not supported yet");let{height:b,width:T}=g,x=g.norm??{mean:255,bias:0},A,E;typeof x.mean=="number"?A=[x.mean,x.mean,x.mean,x.mean]:A=[x.mean[0],x.mean[1],x.mean[2],x.mean[3]??255],typeof x.bias=="number"?E=[x.bias,x.bias,x.bias,x.bias]:E=[x.bias[0],x.bias[1],x.bias[2],x.bias[3]??0];let k=g.format!==void 0?g.format:"RGBA",O=g.tensorFormat!==void 0&&g.tensorFormat!==void 0?g.tensorFormat:"RGB",N=b*T,F=O==="RGBA"?new Float32Array(N*4):new Float32Array(N*3),U=4,M=0,Q=1,C=2,q=3,Ne=0,ye=N,ge=N*2,Oe=-1;k==="RGB"&&(U=3,M=0,Q=1,C=2,q=-1),O==="RGBA"?Oe=N*3:O==="RBG"?(Ne=0,ge=N,ye=N*2):O==="BGR"&&(ge=0,ye=N,Ne=N*2);for(let J=0;J<N;J++,M+=U,C+=U,Q+=U,q+=U)F[Ne++]=(c[M]+E[0])/A[0],F[ye++]=(c[Q]+E[1])/A[1],F[ge++]=(c[C]+E[2])/A[2],Oe!==-1&&q!==-1&&(F[Oe++]=(c[q]+E[3])/A[3]);return O==="RGBA"?new Me("float32",F,[1,4,b,T]):new Me("float32",F,[1,3,b,T])},$t=async(c,g)=>{let b=typeof HTMLImageElement<"u"&&c instanceof HTMLImageElement,T=typeof ImageData<"u"&&c instanceof ImageData,x=typeof ImageBitmap<"u"&&c instanceof ImageBitmap,A=typeof c=="string",E,k=g??{},O=()=>{if(typeof document<"u")return document.createElement("canvas");if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(1,1);throw new Error("Canvas is not supported")},N=F=>typeof HTMLCanvasElement<"u"&&F instanceof HTMLCanvasElement||F instanceof OffscreenCanvas?F.getContext("2d"):null;if(b){let F=O();F.width=c.width,F.height=c.height;let U=N(F);if(U!=null){let M=c.height,Q=c.width;if(g!==void 0&&g.resizedHeight!==void 0&&g.resizedWidth!==void 0&&(M=g.resizedHeight,Q=g.resizedWidth),g!==void 0){if(k=g,g.tensorFormat!==void 0)throw new Error("Image input config format must be RGBA for HTMLImageElement");k.tensorFormat="RGBA",k.height=M,k.width=Q}else k.tensorFormat="RGBA",k.height=M,k.width=Q;U.drawImage(c,0,0),E=U.getImageData(0,0,Q,M).data}else throw new Error("Can not access image data")}else if(T){let F,U;if(g!==void 0&&g.resizedWidth!==void 0&&g.resizedHeight!==void 0?(F=g.resizedHeight,U=g.resizedWidth):(F=c.height,U=c.width),g!==void 0&&(k=g),k.format="RGBA",k.height=F,k.width=U,g!==void 0){let M=O();M.width=U,M.height=F;let Q=N(M);if(Q!=null)Q.putImageData(c,0,0),E=Q.getImageData(0,0,U,F).data;else throw new Error("Can not access image data")}else E=c.data}else if(x){if(g===void 0)throw new Error("Please provide image config with format for Imagebitmap");let F=O();F.width=c.width,F.height=c.height;let U=N(F);if(U!=null){let M=c.height,Q=c.width;return U.drawImage(c,0,0,Q,M),E=U.getImageData(0,0,Q,M).data,k.height=M,k.width=Q,lt(E,k)}else throw new Error("Can not access image data")}else{if(A)return new Promise((F,U)=>{let M=O(),Q=N(M);if(!c||!Q)return U();let C=new Image;C.crossOrigin="Anonymous",C.src=c,C.onload=()=>{M.width=C.width,M.height=C.height,Q.drawImage(C,0,0,M.width,M.height);let q=Q.getImageData(0,0,M.width,M.height);k.height=M.height,k.width=M.width,F(lt(q.data,k))}});throw new Error("Input data provided is not supported - aborted tensor creation")}if(E!==void 0)return lt(E,k);throw new Error("Input data provided is not supported - aborted tensor creation")},wr=(c,g)=>{let{width:b,height:T,download:x,dispose:A}=g,E=[1,T,b,4];return new Me({location:"texture",type:"float32",texture:c,dims:E,download:x,dispose:A})},br=(c,g)=>{let{dataType:b,dims:T,download:x,dispose:A}=g;return new Me({location:"gpu-buffer",type:b??"float32",gpuBuffer:c,dims:T,download:x,dispose:A})},Be=(c,g)=>{let{dataType:b,dims:T,download:x,dispose:A}=g;return new Me({location:"ml-tensor",type:b??"float32",mlTensor:c,dims:T,download:x,dispose:A})},zt=(c,g,b)=>new Me({location:"cpu-pinned",type:c,data:g,dims:b??[g.length]})}),it,Bt,$r,xi,Wa=I(()=>{it=new Map([["float32",Float32Array],["uint8",Uint8Array],["int8",Int8Array],["uint16",Uint16Array],["int16",Int16Array],["int32",Int32Array],["bool",Uint8Array],["float64",Float64Array],["uint32",Uint32Array],["int4",Uint8Array],["uint4",Uint8Array]]),Bt=new Map([[Float32Array,"float32"],[Uint8Array,"uint8"],[Int8Array,"int8"],[Uint16Array,"uint16"],[Int16Array,"int16"],[Int32Array,"int32"],[Float64Array,"float64"],[Uint32Array,"uint32"]]),$r=!1,xi=()=>{if(!$r){$r=!0;let c=typeof BigInt64Array<"u"&&BigInt64Array.from,g=typeof BigUint64Array<"u"&&BigUint64Array.from,b=globalThis.Float16Array,T=typeof b<"u"&&b.from;c&&(it.set("int64",BigInt64Array),Bt.set(BigInt64Array,"int64")),g&&(it.set("uint64",BigUint64Array),Bt.set(BigUint64Array,"uint64")),T?(it.set("float16",b),Bt.set(b,"float16")):it.set("float16",Uint16Array)}}}),Si,Ti,ja=I(()=>{vr(),Si=c=>{let g=1;for(let b=0;b<c.length;b++){let T=c[b];if(typeof T!="number"||!Number.isSafeInteger(T))throw new TypeError(`dims[${b}] must be an integer, got: ${T}`);if(T<0)throw new RangeError(`dims[${b}] must be a non-negative integer, got: ${T}`);g*=T}return g},Ti=(c,g)=>{switch(c.location){case"cpu":return new Me(c.type,c.data,g);case"cpu-pinned":return new Me({location:"cpu-pinned",data:c.data,type:c.type,dims:g});case"texture":return new Me({location:"texture",texture:c.texture,type:c.type,dims:g});case"gpu-buffer":return new Me({location:"gpu-buffer",gpuBuffer:c.gpuBuffer,type:c.type,dims:g});case"ml-tensor":return new Me({location:"ml-tensor",mlTensor:c.mlTensor,type:c.type,dims:g});default:throw new Error(`tensorReshape: tensor location ${c.location} is not supported`)}}}),Me,vr=I(()=>{ur(),vi(),Wa(),ja(),Me=class{constructor(c,g,b){xi();let T,x;if(typeof c=="object"&&"location"in c)switch(this.dataLocation=c.location,T=c.type,x=c.dims,c.location){case"cpu-pinned":{let E=it.get(T);if(!E)throw new TypeError(`unsupported type "${T}" to create tensor from pinned buffer`);if(!(c.data instanceof E))throw new TypeError(`buffer should be of type ${E.name}`);this.cpuData=c.data;break}case"texture":{if(T!=="float32")throw new TypeError(`unsupported type "${T}" to create tensor from texture`);this.gpuTextureData=c.texture,this.downloader=c.download,this.disposer=c.dispose;break}case"gpu-buffer":{if(T!=="float32"&&T!=="float16"&&T!=="int32"&&T!=="int64"&&T!=="uint32"&&T!=="uint8"&&T!=="bool"&&T!=="uint4"&&T!=="int4")throw new TypeError(`unsupported type "${T}" to create tensor from gpu buffer`);this.gpuBufferData=c.gpuBuffer,this.downloader=c.download,this.disposer=c.dispose;break}case"ml-tensor":{if(T!=="float32"&&T!=="float16"&&T!=="int32"&&T!=="int64"&&T!=="uint32"&&T!=="uint64"&&T!=="int8"&&T!=="uint8"&&T!=="bool"&&T!=="uint4"&&T!=="int4")throw new TypeError(`unsupported type "${T}" to create tensor from MLTensor`);this.mlTensorData=c.mlTensor,this.downloader=c.download,this.disposer=c.dispose;break}default:throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)}else{let E,k;if(typeof c=="string")if(T=c,k=b,c==="string"){if(!Array.isArray(g))throw new TypeError("A string tensor's data must be a string array.");E=g}else{let O=it.get(c);if(O===void 0)throw new TypeError(`Unsupported tensor type: ${c}.`);if(Array.isArray(g)){if(c==="float16"&&O===Uint16Array||c==="uint4"||c==="int4")throw new TypeError(`Creating a ${c} tensor from number array is not supported. Please use ${O.name} as data.`);c==="uint64"||c==="int64"?E=O.from(g,BigInt):E=O.from(g)}else if(g instanceof O)E=g;else if(g instanceof Uint8ClampedArray)if(c==="uint8")E=Uint8Array.from(g);else throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");else if(c==="float16"&&g instanceof Uint16Array&&O!==Uint16Array)E=new globalThis.Float16Array(g.buffer,g.byteOffset,g.length);else throw new TypeError(`A ${T} tensor's data must be type of ${O}`)}else if(k=g,Array.isArray(c)){if(c.length===0)throw new TypeError("Tensor type cannot be inferred from an empty array.");let O=typeof c[0];if(O==="string")T="string",E=c;else if(O==="boolean")T="bool",E=Uint8Array.from(c);else throw new TypeError(`Invalid element type of data array: ${O}.`)}else if(c instanceof Uint8ClampedArray)T="uint8",E=Uint8Array.from(c);else{let O=Bt.get(c.constructor);if(O===void 0)throw new TypeError(`Unsupported type for tensor data: ${c.constructor}.`);T=O,E=c}if(k===void 0)k=[E.length];else if(!Array.isArray(k))throw new TypeError("A tensor's dims must be a number array");x=k,this.cpuData=E,this.dataLocation="cpu"}let A=Si(x);if(this.cpuData&&A!==this.cpuData.length&&!((T==="uint4"||T==="int4")&&Math.ceil(A/2)===this.cpuData.length))throw new Error(`Tensor's size(${A}) does not match data length(${this.cpuData.length}).`);this.type=T,this.dims=x,this.size=A}static async fromImage(c,g){return $t(c,g)}static fromTexture(c,g){return wr(c,g)}static fromGpuBuffer(c,g){return br(c,g)}static fromMLTensor(c,g){return Be(c,g)}static fromPinnedBuffer(c,g,b){return zt(c,g,b)}toDataURL(c){return We(this,c)}toImageData(c){return yt(this,c)}get data(){if(this.ensureValid(),!this.cpuData)throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");return this.cpuData}get location(){return this.dataLocation}get texture(){if(this.ensureValid(),!this.gpuTextureData)throw new Error("The data is not stored as a WebGL texture.");return this.gpuTextureData}get gpuBuffer(){if(this.ensureValid(),!this.gpuBufferData)throw new Error("The data is not stored as a WebGPU buffer.");return this.gpuBufferData}get mlTensor(){if(this.ensureValid(),!this.mlTensorData)throw new Error("The data is not stored as a WebNN MLTensor.");return this.mlTensorData}async getData(c){switch(this.ensureValid(),this.dataLocation){case"cpu":case"cpu-pinned":return this.data;case"texture":case"gpu-buffer":case"ml-tensor":{if(!this.downloader)throw new Error("The current tensor is not created with a specified data downloader.");if(this.isDownloading)throw new Error("The current tensor is being downloaded.");try{this.isDownloading=!0;let g=await this.downloader();return this.downloader=void 0,this.dataLocation="cpu",this.cpuData=g,c&&this.disposer&&(this.disposer(),this.disposer=void 0),g}finally{this.isDownloading=!1}}default:throw new Error(`cannot get data from location: ${this.dataLocation}`)}}dispose(){if(this.isDownloading)throw new Error("The current tensor is being downloaded.");this.disposer&&(this.disposer(),this.disposer=void 0),this.cpuData=void 0,this.gpuTextureData=void 0,this.gpuBufferData=void 0,this.mlTensorData=void 0,this.downloader=void 0,this.isDownloading=void 0,this.dataLocation="none"}ensureValid(){if(this.dataLocation==="none")throw new Error("The tensor is disposed.")}reshape(c){if(this.ensureValid(),this.downloader||this.disposer)throw new Error("Cannot reshape a tensor that owns GPU resource.");return Ti(this,c)}}}),qe,Ei=I(()=>{vr(),qe=Me}),Ht,xr,et,Xe,dt,pt,ki=I(()=>{Le(),Ht=(c,g)=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||console.timeStamp(`${c}::ORT::${g}`)},xr=(c,g)=>{var x;let b=((x=new Error().stack)==null?void 0:x.split(/\r\n|\r|\n/g))||[],T=!1;for(let A=0;A<b.length;A++){if(T&&!b[A].includes("TRACE_FUNC")){let E=`FUNC_${c}::${b[A].trim().split(" ")[1]}`;g&&(E+=`::${g}`),Ht("CPU",E);return}b[A].includes("TRACE_FUNC")&&(T=!0)}},et=c=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||xr("BEGIN",c)},Xe=c=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||xr("END",c)},dt=c=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||console.time(`ORT::${c}`)},pt=c=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||console.timeEnd(`ORT::${c}`)}}),Ii,Ha=I(()=>{bt(),Ei(),ki(),Ii=class nc{constructor(g){this.handler=g}async run(g,b,T){et(),dt("InferenceSession.run");let x={},A={};if(typeof g!="object"||g===null||g instanceof qe||Array.isArray(g))throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");let E=!0;if(typeof b=="object"){if(b===null)throw new TypeError("Unexpected argument[1]: cannot be null.");if(b instanceof qe)throw new TypeError("'fetches' cannot be a Tensor");if(Array.isArray(b)){if(b.length===0)throw new TypeError("'fetches' cannot be an empty array.");E=!1;for(let N of b){if(typeof N!="string")throw new TypeError("'fetches' must be a string array or an object.");if(this.outputNames.indexOf(N)===-1)throw new RangeError(`'fetches' contains invalid output name: ${N}.`);x[N]=null}if(typeof T=="object"&&T!==null)A=T;else if(typeof T<"u")throw new TypeError("'options' must be an object.")}else{let N=!1,F=Object.getOwnPropertyNames(b);for(let U of this.outputNames)if(F.indexOf(U)!==-1){let M=b[U];(M===null||M instanceof qe)&&(N=!0,E=!1,x[U]=M)}if(N){if(typeof T=="object"&&T!==null)A=T;else if(typeof T<"u")throw new TypeError("'options' must be an object.")}else A=b}}else if(typeof b<"u")throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");for(let N of this.inputNames)if(typeof g[N]>"u")throw new Error(`input '${N}' is missing in 'feeds'.`);if(E)for(let N of this.outputNames)x[N]=null;let k=await this.handler.run(g,x,A),O={};for(let N in k)if(Object.hasOwnProperty.call(k,N)){let F=k[N];F instanceof qe?O[N]=F:O[N]=new qe(F.type,F.data,F.dims)}return pt("InferenceSession.run"),Xe(),O}async release(){return this.handler.dispose()}static async create(g,b,T,x){et(),dt("InferenceSession.create");let A,E={};if(typeof g=="string"){if(A=g,typeof b=="object"&&b!==null)E=b;else if(typeof b<"u")throw new TypeError("'options' must be an object.")}else if(g instanceof Uint8Array){if(A=g,typeof b=="object"&&b!==null)E=b;else if(typeof b<"u")throw new TypeError("'options' must be an object.")}else if(g instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&g instanceof SharedArrayBuffer){let F=g,U=0,M=g.byteLength;if(typeof b=="object"&&b!==null)E=b;else if(typeof b=="number"){if(U=b,!Number.isSafeInteger(U))throw new RangeError("'byteOffset' must be an integer.");if(U<0||U>=F.byteLength)throw new RangeError(`'byteOffset' is out of range [0, ${F.byteLength}).`);if(M=g.byteLength-U,typeof T=="number"){if(M=T,!Number.isSafeInteger(M))throw new RangeError("'byteLength' must be an integer.");if(M<=0||U+M>F.byteLength)throw new RangeError(`'byteLength' is out of range (0, ${F.byteLength-U}].`);if(typeof x=="object"&&x!==null)E=x;else if(typeof x<"u")throw new TypeError("'options' must be an object.")}else if(typeof T<"u")throw new TypeError("'byteLength' must be a number.")}else if(typeof b<"u")throw new TypeError("'options' must be an object.");A=new Uint8Array(F,U,M)}else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");let[k,O]=await je(E),N=await k.createInferenceSessionHandler(A,O);return pt("InferenceSession.create"),Xe(),new nc(N)}startProfiling(){this.handler.startProfiling()}endProfiling(){this.handler.endProfiling()}get inputNames(){return this.handler.inputNames}get outputNames(){return this.handler.outputNames}get inputMetadata(){return this.handler.inputMetadata}get outputMetadata(){return this.handler.outputMetadata}}}),Sr,Ka=I(()=>{Ha(),Sr=Ii}),Za=I(()=>{}),Qa=I(()=>{}),Xa=I(()=>{}),Ya=I(()=>{}),zi={};be(zi,{InferenceSession:()=>Sr,TRACE:()=>Ht,TRACE_EVENT_BEGIN:()=>dt,TRACE_EVENT_END:()=>pt,TRACE_FUNC_BEGIN:()=>et,TRACE_FUNC_END:()=>Xe,Tensor:()=>qe,env:()=>Y,registerBackend:()=>we});var Ye=I(()=>{Rt(),ut(),Ka(),Ei(),Za(),Qa(),ki(),Xa(),Ya()}),Tr=I(()=>{}),Ci={};be(Ci,{default:()=>Ai});var Er,kr,Ai,Ja=I(()=>{var c;Qi(),vt(),Or(),Er="ort-wasm-proxy-worker",kr=((c=globalThis.self)==null?void 0:c.name)===Er,kr&&(self.onmessage=g=>{let{type:b,in:T}=g.data;try{switch(b){case"init-wasm":Mr(T.wasm).then(()=>{ai(T).then(()=>{postMessage({type:b})},x=>{postMessage({type:b,err:x})})},x=>{postMessage({type:b,err:x})});break;case"init-ep":{let{epName:x,env:A}=T;ni(A,x).then(()=>{postMessage({type:b})},E=>{postMessage({type:b,err:E})});break}case"copy-from":{let{buffer:x}=T,A=xe(x);postMessage({type:b,out:A});break}case"create":{let{model:x,options:A}=T;kt(x,A).then(E=>{postMessage({type:b,out:E})},E=>{postMessage({type:b,err:E})});break}case"release":ui(T),postMessage({type:b});break;case"run":{let{sessionId:x,inputIndices:A,inputs:E,outputIndices:k,options:O}=T;D(x,A,E,k,new Array(k.length).fill(null),O).then(N=>{N.some(F=>F[3]!=="cpu")?postMessage({type:b,err:"Proxy does not support non-cpu tensor location."}):postMessage({type:b,out:N},li([...E,...N]))},N=>{postMessage({type:b,err:N})});break}case"end-profiling":lr(T),postMessage({type:b});break;default:}}catch(x){postMessage({type:b,err:x})}}),Ai=kr?null:g=>new Worker(g??De,{type:"classic",name:Er})}),Oi,Ri,De,Ir,tr,Bi,Mi,zr,Di,Cr,Pi,Ar,Ui,Or=I(()=>{Tr(),Oi=typeof location>"u"?void 0:location.origin,Ri=()=>{var c,g;return typeof document<"u"?(c=document.currentScript)==null?void 0:c.src:typeof self<"u"?(g=self.location)==null?void 0:g.href:void 0},De=Ri(),Ir=()=>{if(De&&!De.startsWith("blob:"))return De.substring(0,De.lastIndexOf("/")+1)},tr=(c,g)=>{try{let b=g??De;return(b?new URL(c,b):new URL(c)).origin===Oi}catch{return!1}},Bi=(c,g)=>{let b=g??De;try{return(b?new URL(c,b):new URL(c)).href}catch{return}},Mi=(c,g)=>`${g??"./"}${c}`,zr=async c=>{let g=await(await fetch(c,{credentials:"same-origin"})).blob();return URL.createObjectURL(g)},Di=async c=>(await import(c)).default,Cr=(Ja(),Ve(Ci)).default,Pi=async()=>{if(!De)throw new Error("Failed to load proxy worker: cannot determine the script source URL.");if(tr(De))return[void 0,Cr()];let c=await zr(De);return[c,Cr(c)]},Ar=void 0,Ui=async(c,g,b,T)=>{let x=Ar&&!(c||g);if(x)if(De)x=tr(De)||T&&!b;else if(T&&!b)x=!0;else throw new Error("cannot determine the script source URL.");if(x)return[void 0,Ar];{let A="ort-wasm-simd-threaded.mjs",E=c??Bi(A,g),k=b&&E&&!tr(E,g),O=k?await zr(E):E??Mi(A,g);return[k?O:void 0,await Di(O)]}}}),Rr,rr,Mt,Br,Ni,Li,Vi,Mr,pe,vt=I(()=>{Or(),rr=!1,Mt=!1,Br=!1,Ni=()=>{if(typeof SharedArrayBuffer>"u")return!1;try{return typeof MessageChannel<"u"&&new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)),WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]))}catch{return!1}},Li=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,30,1,28,0,65,0,253,15,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,186,1,26,11]))}catch{return!1}},Vi=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,19,1,17,0,65,1,253,15,65,2,253,15,65,3,253,15,253,147,2,11]))}catch{return!1}},Mr=async c=>{if(rr)return Promise.resolve();if(Mt)throw new Error("multiple calls to 'initializeWebAssembly()' detected.");if(Br)throw new Error("previous call to 'initializeWebAssembly()' failed.");Mt=!0;let g=c.initTimeout,b=c.numThreads;if(c.simd!==!1){if(c.simd==="relaxed"){if(!Vi())throw new Error("Relaxed WebAssembly SIMD is not supported in the current environment.")}else if(!Li())throw new Error("WebAssembly SIMD is not supported in the current environment.")}let T=Ni();b>1&&!T&&(typeof self<"u"&&!self.crossOriginIsolated&&console.warn("env.wasm.numThreads is set to "+b+", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."),console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."),c.numThreads=b=1);let x=c.wasmPaths,A=typeof x=="string"?x:void 0,E=x==null?void 0:x.mjs,k=(E==null?void 0:E.href)??E,O=x==null?void 0:x.wasm,N=(O==null?void 0:O.href)??O,F=c.wasmBinary,[U,M]=await Ui(k,A,b>1,!!F||!!N),Q=!1,C=[];if(g>0&&C.push(new Promise(q=>{setTimeout(()=>{Q=!0,q()},g)})),C.push(new Promise((q,Ne)=>{let ye={numThreads:b};if(F)ye.wasmBinary=F,ye.locateFile=ge=>ge;else if(N||A)ye.locateFile=ge=>N??A+ge;else if(k&&k.indexOf("blob:")!==0)ye.locateFile=ge=>new URL(ge,k).href;else if(U){let ge=Ir();ge&&(ye.locateFile=Oe=>ge+Oe)}M(ye).then(ge=>{Mt=!1,rr=!0,Rr=ge,q(),U&&URL.revokeObjectURL(U)},ge=>{Mt=!1,Br=!0,Ne(ge)})})),await Promise.race(C),Q)throw new Error(`WebAssembly backend initializing failed due to timeout: ${g}ms`)},pe=()=>{if(rr&&Rr)return Rr;throw new Error("WebAssembly is not initialized yet.")}}),Ge,ir,se,Dr=I(()=>{vt(),Ge=(c,g)=>{let b=pe(),T=b.lengthBytesUTF8(c)+1,x=b._malloc(T);return b.stringToUTF8(c,x,T),g.push(x),x},ir=(c,g,b,T)=>{if(typeof c=="object"&&c!==null){if(b.has(c))throw new Error("Circular reference in options");b.add(c)}Object.entries(c).forEach(([x,A])=>{let E=g?g+x:x;if(typeof A=="object")ir(A,E+".",b,T);else if(typeof A=="string"||typeof A=="number")T(E,A.toString());else if(typeof A=="boolean")T(E,A?"1":"0");else throw new Error(`Can't handle extra config type: ${typeof A}`)})},se=c=>{let g=pe(),b=g.stackSave();try{let T=g.PTR_SIZE,x=g.stackAlloc(2*T);g._OrtGetLastError(x,x+T);let A=Number(g.getValue(x,T===4?"i32":"i64")),E=g.getValue(x+T,"*"),k=E?g.UTF8ToString(E):"";throw new Error(`${c} ERROR_CODE: ${A}, ERROR_MESSAGE: ${k}`)}finally{g.stackRestore(b)}}}),Fi,en=I(()=>{vt(),Dr(),Fi=c=>{let g=pe(),b=0,T=[],x=c||{};try{if((c==null?void 0:c.logSeverityLevel)===void 0)x.logSeverityLevel=2;else if(typeof c.logSeverityLevel!="number"||!Number.isInteger(c.logSeverityLevel)||c.logSeverityLevel<0||c.logSeverityLevel>4)throw new Error(`log severity level is not valid: ${c.logSeverityLevel}`);if((c==null?void 0:c.logVerbosityLevel)===void 0)x.logVerbosityLevel=0;else if(typeof c.logVerbosityLevel!="number"||!Number.isInteger(c.logVerbosityLevel))throw new Error(`log verbosity level is not valid: ${c.logVerbosityLevel}`);(c==null?void 0:c.terminate)===void 0&&(x.terminate=!1);let A=0;return(c==null?void 0:c.tag)!==void 0&&(A=Ge(c.tag,T)),b=g._OrtCreateRunOptions(x.logSeverityLevel,x.logVerbosityLevel,!!x.terminate,A),b===0&&se("Can't create run options."),(c==null?void 0:c.extra)!==void 0&&ir(c.extra,"",new WeakSet,(E,k)=>{let O=Ge(E,T),N=Ge(k,T);g._OrtAddRunConfigEntry(b,O,N)!==0&&se(`Can't set a run config entry: ${E} - ${k}.`)}),[b,T]}catch(A){throw b!==0&&g._OrtReleaseRunOptions(b),T.forEach(E=>g._free(E)),A}}}),qi,Gi,Wi,_t,ji,Hi,tn=I(()=>{vt(),Dr(),qi=c=>{switch(c){case"disabled":return 0;case"basic":return 1;case"extended":return 2;case"layout":return 3;case"all":return 99;default:throw new Error(`unsupported graph optimization level: ${c}`)}},Gi=c=>{switch(c){case"sequential":return 0;case"parallel":return 1;default:throw new Error(`unsupported execution mode: ${c}`)}},Wi=c=>{c.extra||(c.extra={}),c.extra.session||(c.extra.session={});let g=c.extra.session;g.use_ort_model_bytes_directly||(g.use_ort_model_bytes_directly="1"),c.executionProviders&&c.executionProviders.some(b=>(typeof b=="string"?b:b.name)==="webgpu")&&(c.enableMemPattern=!1)},_t=(c,g,b,T)=>{let x=Ge(g,T),A=Ge(b,T);pe()._OrtAddSessionConfigEntry(c,x,A)!==0&&se(`Can't set a session config entry: ${g} - ${b}.`)},ji=async(c,g,b)=>{let T=g.executionProviders;for(let x of T){let A=typeof x=="string"?x:x.name,E=[];switch(A){case"webnn":if(A="WEBNN",_t(c,"session.disable_quant_qdq","1",b),_t(c,"session.disable_qdq_constant_folding","1",b),typeof x!="string"){let U=x==null?void 0:x.deviceType;U&&_t(c,"deviceType",U,b)}break;case"webgpu":if(A="JS",typeof x!="string"){let U=x;if(U!=null&&U.preferredLayout){if(U.preferredLayout!=="NCHW"&&U.preferredLayout!=="NHWC")throw new Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${U.preferredLayout}`);_t(c,"preferredLayout",U.preferredLayout,b)}}break;case"wasm":case"cpu":continue;default:throw new Error(`not supported execution provider: ${A}`)}let k=Ge(A,b),O=E.length,N=0,F=0;if(O>0){N=pe()._malloc(O*pe().PTR_SIZE),b.push(N),F=pe()._malloc(O*pe().PTR_SIZE),b.push(F);for(let U=0;U<O;U++)pe().setValue(N+U*pe().PTR_SIZE,E[U][0],"*"),pe().setValue(F+U*pe().PTR_SIZE,E[U][1],"*")}await pe()._OrtAppendExecutionProvider(c,k,N,F,O)!==0&&se(`Can't append execution provider: ${A}.`)}},Hi=async c=>{let g=pe(),b=0,T=[],x=c||{};Wi(x);try{let A=qi(x.graphOptimizationLevel??"all"),E=Gi(x.executionMode??"sequential"),k=typeof x.logId=="string"?Ge(x.logId,T):0,O=x.logSeverityLevel??2;if(!Number.isInteger(O)||O<0||O>4)throw new Error(`log severity level is not valid: ${O}`);let N=x.logVerbosityLevel??0;if(!Number.isInteger(N)||N<0||N>4)throw new Error(`log verbosity level is not valid: ${N}`);let F=typeof x.optimizedModelFilePath=="string"?Ge(x.optimizedModelFilePath,T):0;if(b=g._OrtCreateSessionOptions(A,!!x.enableCpuMemArena,!!x.enableMemPattern,E,!!x.enableProfiling,0,k,O,N,F),b===0&&se("Can't create session options."),x.executionProviders&&await ji(b,x,T),x.enableGraphCapture!==void 0){if(typeof x.enableGraphCapture!="boolean")throw new Error(`enableGraphCapture must be a boolean value: ${x.enableGraphCapture}`);_t(b,"enableGraphCapture",x.enableGraphCapture.toString(),T)}if(x.freeDimensionOverrides)for(let[U,M]of Object.entries(x.freeDimensionOverrides)){if(typeof U!="string")throw new Error(`free dimension override name must be a string: ${U}`);if(typeof M!="number"||!Number.isInteger(M)||M<0)throw new Error(`free dimension override value must be a non-negative integer: ${M}`);let Q=Ge(U,T);g._OrtAddFreeDimensionOverride(b,Q,M)!==0&&se(`Can't set a free dimension override: ${U} - ${M}.`)}return x.extra!==void 0&&ir(x.extra,"",new WeakSet,(U,M)=>{_t(b,U,M,T)}),[b,T]}catch(A){throw b!==0&&g._OrtReleaseSessionOptions(b)!==0&&se("Can't release session options."),T.forEach(E=>g._free(E)),A}}}),xt,St,Tt,Pr,Ur,Nr,Lr,ii,le=I(()=>{xt=c=>{switch(c){case"int8":return 3;case"uint8":return 2;case"bool":return 9;case"int16":return 5;case"uint16":return 4;case"int32":return 6;case"uint32":return 12;case"float16":return 10;case"float32":return 1;case"float64":return 11;case"string":return 8;case"int64":return 7;case"uint64":return 13;case"int4":return 22;case"uint4":return 21;default:throw new Error(`unsupported data type: ${c}`)}},St=c=>{switch(c){case 3:return"int8";case 2:return"uint8";case 9:return"bool";case 5:return"int16";case 4:return"uint16";case 6:return"int32";case 12:return"uint32";case 10:return"float16";case 1:return"float32";case 11:return"float64";case 8:return"string";case 7:return"int64";case 13:return"uint64";case 22:return"int4";case 21:return"uint4";default:throw new Error(`unsupported data type: ${c}`)}},Tt=(c,g)=>{let b=[-1,4,1,1,2,2,4,8,-1,1,2,8,4,8,-1,-1,-1,-1,-1,-1,-1,.5,.5][c],T=typeof g=="number"?g:g.reduce((x,A)=>x*A,1);return b>0?Math.ceil(T*b):void 0},Pr=c=>{switch(c){case"float16":return typeof Float16Array<"u"&&Float16Array.from?Float16Array:Uint16Array;case"float32":return Float32Array;case"uint8":return Uint8Array;case"int8":return Int8Array;case"uint16":return Uint16Array;case"int16":return Int16Array;case"int32":return Int32Array;case"bool":return Uint8Array;case"float64":return Float64Array;case"uint32":return Uint32Array;case"int64":return BigInt64Array;case"uint64":return BigUint64Array;default:throw new Error(`unsupported type: ${c}`)}},Ur=c=>{switch(c){case"verbose":return 0;case"info":return 1;case"warning":return 2;case"error":return 3;case"fatal":return 4;default:throw new Error(`unsupported logging level: ${c}`)}},Nr=c=>c==="float32"||c==="float16"||c==="int32"||c==="int64"||c==="uint32"||c==="uint8"||c==="bool"||c==="uint4"||c==="int4",Lr=c=>c==="float32"||c==="float16"||c==="int32"||c==="int64"||c==="uint32"||c==="uint64"||c==="int8"||c==="uint8"||c==="bool"||c==="uint4"||c==="int4",ii=c=>{switch(c){case"none":return 0;case"cpu":return 1;case"cpu-pinned":return 2;case"texture":return 3;case"gpu-buffer":return 4;case"ml-tensor":return 5;default:throw new Error(`unsupported data location: ${c}`)}}}),Vr,Ki=I(()=>{Tr(),Vr=async c=>{if(typeof c=="string"){let g=await fetch(c);if(!g.ok)throw new Error(`failed to load external data file: ${c}`);let b=g.headers.get("Content-Length"),T=b?parseInt(b,10):0;if(T<1073741824)return new Uint8Array(await g.arrayBuffer());{if(!g.body)throw new Error(`failed to load external data file: ${c}, no response body.`);let x=g.body.getReader(),A;try{A=new ArrayBuffer(T)}catch(k){if(k instanceof RangeError){let O=Math.ceil(T/65536);A=new WebAssembly.Memory({initial:O,maximum:O}).buffer}else throw k}let E=0;for(;;){let{done:k,value:O}=await x.read();if(k)break;let N=O.byteLength;new Uint8Array(A,E,N).set(O),E+=N}return new Uint8Array(A,0,T)}}else return c instanceof Blob?new Uint8Array(await c.arrayBuffer()):c instanceof Uint8Array?c:new Uint8Array(c)}}),Zi,ai,ni,Kt,si,oi,xe,kt,ui,Zt,D,lr,li,Qi=I(()=>{Ye(),en(),tn(),le(),vt(),Dr(),Ki(),Zi=(c,g)=>{pe()._OrtInit(c,g)!==0&&se("Can't initialize onnxruntime.")},ai=async c=>{Zi(c.wasm.numThreads,Ur(c.logLevel))},ni=async(c,g)=>{var T,x;(x=(T=pe()).asyncInit)==null||x.call(T);let b=c.webgpu.adapter;if(g==="webgpu"){if(typeof navigator>"u"||!navigator.gpu)throw new Error("WebGPU is not supported in current environment");if(b){if(typeof b.limits!="object"||typeof b.features!="object"||typeof b.requestDevice!="function")throw new Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.")}else{let A=c.webgpu.powerPreference;if(A!==void 0&&A!=="low-power"&&A!=="high-performance")throw new Error(`Invalid powerPreference setting: "${A}"`);let E=c.webgpu.forceFallbackAdapter;if(E!==void 0&&typeof E!="boolean")throw new Error(`Invalid forceFallbackAdapter setting: "${E}"`);if(b=await navigator.gpu.requestAdapter({powerPreference:A,forceFallbackAdapter:E}),!b)throw new Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.')}}if(g==="webnn"&&(typeof navigator>"u"||!navigator.ml))throw new Error("WebNN is not supported in current environment")},Kt=new Map,si=c=>{let g=pe(),b=g.stackSave();try{let T=g.PTR_SIZE,x=g.stackAlloc(2*T);g._OrtGetInputOutputCount(c,x,x+T)!==0&&se("Can't get session input/output count.");let A=T===4?"i32":"i64";return[Number(g.getValue(x,A)),Number(g.getValue(x+T,A))]}finally{g.stackRestore(b)}},oi=(c,g)=>{let b=pe(),T=b.stackSave(),x=0;try{let A=b.PTR_SIZE,E=b.stackAlloc(2*A);b._OrtGetInputOutputMetadata(c,g,E,E+A)!==0&&se("Can't get session input/output metadata.");let k=Number(b.getValue(E,"*"));x=Number(b.getValue(E+A,"*"));let O=b.HEAP32[x/4];if(O===0)return[k,0];let N=b.HEAPU32[x/4+1],F=[];for(let U=0;U<N;U++){let M=Number(b.getValue(x+8+U*A,"*"));F.push(M!==0?b.UTF8ToString(M):Number(b.getValue(x+8+(U+N)*A,"*")))}return[k,O,F]}finally{b.stackRestore(T),x!==0&&b._OrtFree(x)}},xe=c=>{let g=pe(),b=g._malloc(c.byteLength);if(b===0)throw new Error(`Can't create a session. failed to allocate a buffer of size ${c.byteLength}.`);return g.HEAPU8.set(c,b),[b,c.byteLength]},kt=async(c,g)=>{var F,U,M;let b,T,x=pe();Array.isArray(c)?[b,T]=c:c.buffer===x.HEAPU8.buffer?[b,T]=[c.byteOffset,c.byteLength]:[b,T]=xe(c);let A=0,E=0,k=[],O=[],N=[];try{if([E,k]=await Hi(g),(g==null?void 0:g.externalData)&&x.mountExternalData){let Pe=[];for(let Ie of g.externalData){let tt=typeof Ie=="string"?Ie:Ie.path;Pe.push(Vr(typeof Ie=="string"?Ie:Ie.data).then(st=>{x.mountExternalData(tt,st)}))}await Promise.all(Pe)}for(let Pe of(g==null?void 0:g.executionProviders)??[])if((typeof Pe=="string"?Pe:Pe.name)==="webnn"){if(x.shouldTransferToMLTensor=!1,typeof Pe!="string"){let Ie=Pe,tt=Ie==null?void 0:Ie.context,st=Ie==null?void 0:Ie.gpuDevice,ct=Ie==null?void 0:Ie.deviceType,Wr=Ie==null?void 0:Ie.powerPreference;tt?x.currentContext=tt:st?x.currentContext=await x.webnnCreateMLContext(st):x.currentContext=await x.webnnCreateMLContext({deviceType:ct,powerPreference:Wr})}else x.currentContext=await x.webnnCreateMLContext();break}A=await x._OrtCreateSession(b,T,E),(F=x.webgpuOnCreateSession)==null||F.call(x,A),A===0&&se("Can't create a session."),(U=x.jsepOnCreateSession)==null||U.call(x),x.currentContext&&(x.webnnRegisterMLContext(A,x.currentContext),x.currentContext=void 0,x.shouldTransferToMLTensor=!0);let[Q,C]=si(A),q=!!(g!=null&&g.enableGraphCapture),Ne=[],ye=[],ge=[],Oe=[],J=[];for(let Pe=0;Pe<Q;Pe++){let[Ie,tt,st]=oi(A,Pe);Ie===0&&se("Can't get an input name."),O.push(Ie);let ct=x.UTF8ToString(Ie);Ne.push(ct),ge.push(tt===0?{name:ct,isTensor:!1}:{name:ct,isTensor:!0,type:St(tt),shape:st})}for(let Pe=0;Pe<C;Pe++){let[Ie,tt,st]=oi(A,Pe+Q);Ie===0&&se("Can't get an output name."),N.push(Ie);let ct=x.UTF8ToString(Ie);ye.push(ct),Oe.push(tt===0?{name:ct,isTensor:!1}:{name:ct,isTensor:!0,type:St(tt),shape:st})}return Kt.set(A,[A,O,N,null,q,!1]),[A,Ne,ye,ge,Oe]}catch(Q){throw O.forEach(C=>x._OrtFree(C)),N.forEach(C=>x._OrtFree(C)),A!==0&&x._OrtReleaseSession(A)!==0&&se("Can't release session."),Q}finally{x._free(b),E!==0&&x._OrtReleaseSessionOptions(E)!==0&&se("Can't release session options."),k.forEach(Q=>x._free(Q)),(M=x.unmountExternalData)==null||M.call(x)}},ui=c=>{var O,N,F;let g=pe(),b=Kt.get(c);if(!b)throw new Error(`cannot release session. invalid session id: ${c}`);let[T,x,A,E,k]=b;E&&(k&&g._OrtClearBoundOutputs(E.handle)!==0&&se("Can't clear bound outputs."),g._OrtReleaseBinding(E.handle)!==0&&se("Can't release IO binding.")),(O=g.jsepOnReleaseSession)==null||O.call(g,c),(N=g.webnnOnReleaseSession)==null||N.call(g,c),(F=g.webgpuOnReleaseSession)==null||F.call(g,c),x.forEach(U=>g._OrtFree(U)),A.forEach(U=>g._OrtFree(U)),g._OrtReleaseSession(T)!==0&&se("Can't release session."),Kt.delete(c)},Zt=async(c,g,b,T,x,A,E=!1)=>{if(!c){g.push(0);return}let k=pe(),O=k.PTR_SIZE,N=c[0],F=c[1],U=c[3],M=U,Q,C;if(N==="string"&&(U==="gpu-buffer"||U==="ml-tensor"))throw new Error("String tensor is not supported on GPU.");if(E&&U!=="gpu-buffer")throw new Error(`External buffer must be provided for input/output index ${A} when enableGraphCapture is true.`);if(U==="gpu-buffer"){let ye=c[2].gpuBuffer;C=Tt(xt(N),F);{let ge=k.jsepRegisterBuffer;if(!ge)throw new Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');Q=ge(T,A,ye,C)}}else if(U==="ml-tensor"){let ye=c[2].mlTensor;C=Tt(xt(N),F);let ge=k.webnnRegisterMLTensor;if(!ge)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');Q=ge(T,ye,xt(N),F)}else{let ye=c[2];if(Array.isArray(ye)){C=O*ye.length,Q=k._malloc(C),b.push(Q);for(let ge=0;ge<ye.length;ge++){if(typeof ye[ge]!="string")throw new TypeError(`tensor data at index ${ge} is not a string`);k.setValue(Q+ge*O,Ge(ye[ge],b),"*")}}else{let ge=k.webnnIsGraphInput,Oe=k.webnnIsGraphOutput;if(N!=="string"&&ge&&Oe){let J=k.UTF8ToString(x);if(ge(T,J)||Oe(T,J)){let Pe=xt(N);C=Tt(Pe,F),M="ml-tensor";let Ie=k.webnnCreateTemporaryTensor,tt=k.webnnUploadTensor;if(!Ie||!tt)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');let st=await Ie(T,Pe,F);tt(st,new Uint8Array(ye.buffer,ye.byteOffset,ye.byteLength)),Q=st}else C=ye.byteLength,Q=k._malloc(C),b.push(Q),k.HEAPU8.set(new Uint8Array(ye.buffer,ye.byteOffset,C),Q)}else C=ye.byteLength,Q=k._malloc(C),b.push(Q),k.HEAPU8.set(new Uint8Array(ye.buffer,ye.byteOffset,C),Q)}}let q=k.stackSave(),Ne=k.stackAlloc(4*F.length);try{F.forEach((ge,Oe)=>k.setValue(Ne+Oe*O,ge,O===4?"i32":"i64"));let ye=k._OrtCreateTensor(xt(N),Q,C,Ne,F.length,ii(M));ye===0&&se(`Can't create tensor for input/output. session=${T}, index=${A}.`),g.push(ye)}finally{k.stackRestore(q)}},D=async(c,g,b,T,x,A)=>{var ht,aa,na;let E=pe(),k=E.PTR_SIZE,O=Kt.get(c);if(!O)throw new Error(`cannot run inference. invalid session id: ${c}`);let N=O[0],F=O[1],U=O[2],M=O[3],Q=O[4];O[5];let C=g.length,q=T.length,Ne=0,ye=[],ge=[],Oe=[],J=[],Pe=[],Ie=E.stackSave(),tt=E.stackAlloc(C*k),st=E.stackAlloc(C*k),ct=E.stackAlloc(q*k),Wr=E.stackAlloc(q*k);try{[Ne,ye]=Fi(A),dt("wasm prepareInputOutputTensor");for(let Se=0;Se<C;Se++)await Zt(b[Se],ge,J,c,F[g[Se]],g[Se],Q);for(let Se=0;Se<q;Se++)await Zt(x[Se],Oe,J,c,U[T[Se]],C+T[Se],Q);pt("wasm prepareInputOutputTensor");for(let Se=0;Se<C;Se++)E.setValue(tt+Se*k,ge[Se],"*"),E.setValue(st+Se*k,F[g[Se]],"*");for(let Se=0;Se<q;Se++)E.setValue(ct+Se*k,Oe[Se],"*"),E.setValue(Wr+Se*k,U[T[Se]],"*");(ht=E.jsepOnRunStart)==null||ht.call(E,N),(aa=E.webnnOnRunStart)==null||aa.call(E,N);let rt;rt=await E._OrtRun(N,st,tt,C,Wr,q,ct,Ne),rt!==0&&se("failed to call OrtRun().");let Ct=[],sa=[];dt("wasm ProcessOutputTensor");for(let Se=0;Se<q;Se++){let It=Number(E.getValue(ct+Se*k,"*"));if(It===Oe[Se]||Pe.includes(Oe[Se])){Ct.push(x[Se]),It!==Oe[Se]&&E._OrtReleaseTensor(It)!==0&&se("Can't release tensor.");continue}let Ta=E.stackSave(),Ut=E.stackAlloc(4*k),jr=!1,He,ft=0;try{E._OrtGetTensorData(It,Ut,Ut+k,Ut+2*k,Ut+3*k)!==0&&se(`Can't access output tensor data on index ${Se}.`);let wi=k===4?"i32":"i64",mt=Number(E.getValue(Ut,wi));ft=E.getValue(Ut+k,"*");let oa=E.getValue(Ut+k*2,"*"),Ea=Number(E.getValue(Ut+k*3,wi)),Nt=[];for(let Ke=0;Ke<Ea;Ke++)Nt.push(Number(E.getValue(oa+Ke*k,wi)));E._OrtFree(oa)!==0&&se("Can't free memory for tensor dims.");let Lt=Nt.reduce((Ke,Fe)=>Ke*Fe,1);He=St(mt);let hr=M==null?void 0:M.outputPreferredLocations[T[Se]];if(He==="string"){if(hr==="gpu-buffer"||hr==="ml-tensor")throw new Error("String tensor is not supported on GPU.");let Ke=[];for(let Fe=0;Fe<Lt;Fe++){let At=E.getValue(ft+Fe*k,"*"),ka=E.getValue(ft+(Fe+1)*k,"*"),Ia=Fe===Lt-1?void 0:ka-At;Ke.push(E.UTF8ToString(At,Ia))}Ct.push([He,Nt,Ke,"cpu"])}else if(hr==="gpu-buffer"&&Lt>0){let Ke=E.jsepGetBuffer;if(!Ke)throw new Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');let Fe=Ke(ft),At=Tt(mt,Lt);if(At===void 0||!Nr(He))throw new Error(`Unsupported data type: ${He}`);jr=!0,Ct.push([He,Nt,{gpuBuffer:Fe,download:E.jsepCreateDownloader(Fe,At,He),dispose:()=>{E._OrtReleaseTensor(It)!==0&&se("Can't release tensor.")}},"gpu-buffer"])}else if(hr==="ml-tensor"&&Lt>0){let Ke=E.webnnEnsureTensor,Fe=E.webnnIsGraphInputOutputTypeSupported;if(!Ke||!Fe)throw new Error('preferredLocation "ml-tensor" is not supported without using WebNN.');if(Tt(mt,Lt)===void 0||!Lr(He))throw new Error(`Unsupported data type: ${He}`);if(!Fe(c,He,!1))throw new Error(`preferredLocation "ml-tensor" for ${He} output is not supported by current WebNN Context.`);let At=await Ke(c,ft,mt,Nt,!1);jr=!0,Ct.push([He,Nt,{mlTensor:At,download:E.webnnCreateMLTensorDownloader(ft,He),dispose:()=>{E.webnnReleaseTensorId(ft),E._OrtReleaseTensor(It)}},"ml-tensor"])}else if(hr==="ml-tensor-cpu-output"&&Lt>0){let Ke=E.webnnCreateMLTensorDownloader(ft,He)(),Fe=Ct.length;jr=!0,sa.push((async()=>{let At=[Fe,await Ke];return E.webnnReleaseTensorId(ft),E._OrtReleaseTensor(It),At})()),Ct.push([He,Nt,[],"cpu"])}else{let Ke=Pr(He),Fe=new Ke(Lt);new Uint8Array(Fe.buffer,Fe.byteOffset,Fe.byteLength).set(E.HEAPU8.subarray(ft,ft+Fe.byteLength)),Ct.push([He,Nt,Fe,"cpu"])}}finally{E.stackRestore(Ta),He==="string"&&ft&&E._free(ft),jr||E._OrtReleaseTensor(It)}}M&&!Q&&(E._OrtClearBoundOutputs(M.handle)!==0&&se("Can't clear bound outputs."),Kt.set(c,[N,F,U,M,Q,!1]));for(let[Se,It]of await Promise.all(sa))Ct[Se][2]=It;return pt("wasm ProcessOutputTensor"),Ct}finally{(na=E.webnnOnRunEnd)==null||na.call(E,N),E.stackRestore(Ie),ge.forEach(rt=>E._OrtReleaseTensor(rt)),Oe.forEach(rt=>E._OrtReleaseTensor(rt)),J.forEach(rt=>E._free(rt)),Ne!==0&&E._OrtReleaseRunOptions(Ne),ye.forEach(rt=>E._free(rt))}},lr=c=>{let g=pe(),b=Kt.get(c);if(!b)throw new Error("invalid session id");let T=b[0],x=g._OrtEndProfiling(T);x===0&&se("Can't get an profile file name."),g._OrtFree(x)},li=c=>{let g=[];for(let b of c){let T=b[2];!Array.isArray(T)&&"buffer"in T&&g.push(T.buffer)}return g}}),Dt,te,Qt,dr,ar,pr,Fr,qr,Pt,Xt,di,pi,ci,Xi,Yi,xa,cr,Ji,ea=I(()=>{Ye(),Qi(),vt(),Or(),Dt=()=>!!Y.wasm.proxy&&typeof document<"u",Qt=!1,dr=!1,ar=!1,qr=new Map,Pt=(c,g)=>{let b=qr.get(c);b?b.push(g):qr.set(c,[g])},Xt=()=>{if(Qt||!dr||ar||!te)throw new Error("worker not ready")},di=c=>{switch(c.data.type){case"init-wasm":Qt=!1,c.data.err?(ar=!0,Fr[1](c.data.err)):(dr=!0,Fr[0]()),pr&&(URL.revokeObjectURL(pr),pr=void 0);break;case"init-ep":case"copy-from":case"create":case"release":case"run":case"end-profiling":{let g=qr.get(c.data.type);c.data.err?g.shift()[1](c.data.err):g.shift()[0](c.data.out);break}}},pi=async()=>{if(!dr){if(Qt)throw new Error("multiple calls to 'initWasm()' detected.");if(ar)throw new Error("previous call to 'initWasm()' failed.");if(Qt=!0,Dt())return new Promise((c,g)=>{te==null||te.terminate(),Pi().then(([b,T])=>{try{te=T,te.onerror=A=>g(A),te.onmessage=di,Fr=[c,g];let x={type:"init-wasm",in:Y};if(!x.in.wasm.wasmPaths&&b){let A=Ir();A&&(x.in.wasm.wasmPaths=A)}te.postMessage(x),pr=b}catch(x){g(x)}},g)});try{await Mr(Y.wasm),await ai(Y),dr=!0}catch(c){throw ar=!0,c}finally{Qt=!1}}},ci=async c=>{if(Dt())return Xt(),new Promise((g,b)=>{Pt("init-ep",[g,b]);let T={type:"init-ep",in:{epName:c,env:Y}};te.postMessage(T)});await ni(Y,c)},Xi=async c=>Dt()?(Xt(),new Promise((g,b)=>{Pt("copy-from",[g,b]);let T={type:"copy-from",in:{buffer:c}};te.postMessage(T,[c.buffer])})):xe(c),Yi=async(c,g)=>{if(Dt()){if(g!=null&&g.preferredOutputLocation)throw new Error('session option "preferredOutputLocation" is not supported for proxy.');return Xt(),new Promise((b,T)=>{Pt("create",[b,T]);let x={type:"create",in:{model:c,options:{...g}}},A=[];c instanceof Uint8Array&&A.push(c.buffer),te.postMessage(x,A)})}else return kt(c,g)},xa=async c=>{if(Dt())return Xt(),new Promise((g,b)=>{Pt("release",[g,b]);let T={type:"release",in:c};te.postMessage(T)});ui(c)},cr=async(c,g,b,T,x,A)=>{if(Dt()){if(b.some(E=>E[3]!=="cpu"))throw new Error("input tensor on GPU is not supported for proxy.");if(x.some(E=>E))throw new Error("pre-allocated output tensor is not supported for proxy.");return Xt(),new Promise((E,k)=>{Pt("run",[E,k]);let O=b,N={type:"run",in:{sessionId:c,inputIndices:g,inputs:O,outputIndices:T,options:A}};te.postMessage(N,li(O))})}else return D(c,g,b,T,x,A)},Ji=async c=>{if(Dt())return Xt(),new Promise((g,b)=>{Pt("end-profiling",[g,b]);let T={type:"end-profiling",in:c};te.postMessage(T)});lr(c)}}),ta,hi,fi,mi=I(()=>{Ye(),ea(),le(),Tr(),Ki(),ta=(c,g)=>{switch(c.location){case"cpu":return[c.type,c.dims,c.data,"cpu"];case"gpu-buffer":return[c.type,c.dims,{gpuBuffer:c.gpuBuffer},"gpu-buffer"];case"ml-tensor":return[c.type,c.dims,{mlTensor:c.mlTensor},"ml-tensor"];default:throw new Error(`invalid data location: ${c.location} for ${g()}`)}},hi=c=>{switch(c[3]){case"cpu":return new qe(c[0],c[2],c[1]);case"gpu-buffer":{let g=c[0];if(!Nr(g))throw new Error(`not supported data type: ${g} for deserializing GPU tensor`);let{gpuBuffer:b,download:T,dispose:x}=c[2];return qe.fromGpuBuffer(b,{dataType:g,dims:c[1],download:T,dispose:x})}case"ml-tensor":{let g=c[0];if(!Lr(g))throw new Error(`not supported data type: ${g} for deserializing MLTensor tensor`);let{mlTensor:b,download:T,dispose:x}=c[2];return qe.fromMLTensor(b,{dataType:g,dims:c[1],download:T,dispose:x})}default:throw new Error(`invalid data location: ${c[3]}`)}},fi=class{async fetchModelAndCopyToWasmMemory(c){return Xi(await Vr(c))}async loadModel(c,g){et();let b;typeof c=="string"?b=await this.fetchModelAndCopyToWasmMemory(c):b=c,[this.sessionId,this.inputNames,this.outputNames,this.inputMetadata,this.outputMetadata]=await Yi(b,g),Xe()}async dispose(){return xa(this.sessionId)}async run(c,g,b){et();let T=[],x=[];Object.entries(c).forEach(U=>{let M=U[0],Q=U[1],C=this.inputNames.indexOf(M);if(C===-1)throw new Error(`invalid input '${M}'`);T.push(Q),x.push(C)});let A=[],E=[];Object.entries(g).forEach(U=>{let M=U[0],Q=U[1],C=this.outputNames.indexOf(M);if(C===-1)throw new Error(`invalid output '${M}'`);A.push(Q),E.push(C)});let k=T.map((U,M)=>ta(U,()=>`input "${this.inputNames[x[M]]}"`)),O=A.map((U,M)=>U?ta(U,()=>`output "${this.outputNames[E[M]]}"`):null),N=await cr(this.sessionId,x,k,E,O,b),F={};for(let U=0;U<N.length;U++)F[this.outputNames[E[U]]]=A[U]??hi(N[U]);return Xe(),F}startProfiling(){}endProfiling(){Ji(this.sessionId)}}}),Gr={};be(Gr,{OnnxruntimeWebAssemblyBackend:()=>yi,initializeFlags:()=>gi,wasmBackend:()=>_i});var gi,yi,_i,ra=I(()=>{Ye(),ea(),mi(),gi=()=>{(typeof Y.wasm.initTimeout!="number"||Y.wasm.initTimeout<0)&&(Y.wasm.initTimeout=0);let c=Y.wasm.simd;if(typeof c!="boolean"&&c!==void 0&&c!=="fixed"&&c!=="relaxed"&&(console.warn(`Property "env.wasm.simd" is set to unknown value "${c}". Reset it to \`false\` and ignore SIMD feature checking.`),Y.wasm.simd=!1),typeof Y.wasm.proxy!="boolean"&&(Y.wasm.proxy=!1),typeof Y.wasm.trace!="boolean"&&(Y.wasm.trace=!1),typeof Y.wasm.numThreads!="number"||!Number.isInteger(Y.wasm.numThreads)||Y.wasm.numThreads<=0)if(typeof self<"u"&&!self.crossOriginIsolated)Y.wasm.numThreads=1;else{let g=typeof navigator>"u"?fe("node:os").cpus().length:navigator.hardwareConcurrency;Y.wasm.numThreads=Math.min(4,Math.ceil((g||1)/2))}},yi=class{async init(c){gi(),await pi(),await ci(c)}async createInferenceSessionHandler(c,g){let b=new fi;return await b.loadModel(c,g),b}},_i=new yi}),ia={};be(ia,{InferenceSession:()=>Sr,TRACE:()=>Ht,TRACE_EVENT_BEGIN:()=>dt,TRACE_EVENT_END:()=>pt,TRACE_FUNC_BEGIN:()=>et,TRACE_FUNC_END:()=>Xe,Tensor:()=>qe,default:()=>rn,env:()=>Y,registerBackend:()=>we}),Ye(),Ye(),Ye();var Sa="1.26.0",rn=zi;{let c=(ra(),Ve(Gr)).wasmBackend;we("cpu",c,10),we("wasm",c,10)}return Object.defineProperty(Y.versions,"web",{value:Sa,enumerable:!0}),Ve(ia)})();L.exports=ne})(ac);var _h=ac.exports;(function(L){var ee=gt&&gt.__createBinding||(Object.create?function(Ee,ke,me,de){de===void 0&&(de=me);var Le=Object.getOwnPropertyDescriptor(ke,me);(!Le||("get"in Le?!ke.__esModule:Le.writable||Le.configurable))&&(Le={enumerable:!0,get:function(){return ke[me]}}),Object.defineProperty(Ee,de,Le)}:function(Ee,ke,me,de){de===void 0&&(de=me),Ee[de]=ke[me]}),ne=gt&&gt.__setModuleDefault||(Object.create?function(Ee,ke){Object.defineProperty(Ee,"default",{enumerable:!0,value:ke})}:function(Ee,ke){Ee.default=ke}),Z=gt&&gt.__importStar||function(Ee){if(Ee&&Ee.__esModule)return Ee;var ke={};if(Ee!=null)for(var me in Ee)me!=="default"&&Object.prototype.hasOwnProperty.call(Ee,me)&&ee(ke,Ee,me);return ne(ke,Ee),ke};Object.defineProperty(L,"__esModule",{value:!0}),L.MicVAD=L.getDefaultRealTimeVADOptions=L.ort=L.DEFAULT_MODEL=void 0;const ue=Z(_h),he=$i,_e=er,fe=_r,I=ri,be=us,Je=va;L.DEFAULT_MODEL="legacy",L.ort=ue;const Ve="vad.worklet.bundle.min.js",ve="silero_vad_v5.onnx",$e="silero_vad_legacy.onnx",we=Ee=>({..._e.defaultFrameProcessorOptions,onFrameProcessed:()=>{},onVADMisfire:()=>{fe.log.debug("VAD misfire")},onSpeechStart:()=>{fe.log.debug("Detected speech start")},onSpeechEnd:()=>{fe.log.debug("Detected speech end")},onSpeechRealStart:()=>{fe.log.debug("Detected real speech start")},baseAssetPath:"./",onnxWASMBasePath:"./",model:Ee,workletOptions:{},getStream:async()=>await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,autoGainControl:!0,noiseSuppression:!0}}),pauseStream:async ke=>{ke.getTracks().forEach(me=>{me.stop()})},resumeStream:async()=>await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,autoGainControl:!0,noiseSuppression:!0}}),ortConfig:ke=>{ke.env.logLevel="error"},startOnLoad:!0,processorType:"auto"});L.getDefaultRealTimeVADOptions=we;const Ue=Ee=>"audioWorklet"in Ee&&typeof AudioWorkletNode=="function"?"AudioWorklet":"ScriptProcessor";async function je(Ee,ke,me,de,Le){await me.audioWorklet.addModule(Ee),ke.processorOptions={...ke.processorOptions??{},frameSamples:de};const Y=new AudioWorkletNode(me,"vad-helper-worklet",ke);return Y.port.onmessage=async ut=>{const We=ut.data;if(!(typeof We=="object"&&We&&"message"in We)){console.error("Invalid message event",We);return}switch(We.message){case I.Message.AudioFrame:{if(!("data"in We&&We.data instanceof ArrayBuffer)){console.log("Audio frame message has no data");return}const yt=new Float32Array(We.data);await Le(yt);break}}},Y}async function bt(Ee,ke,me){const de=new Je.Resampler({nativeSampleRate:Ee.sampleRate,targetSampleRate:16e3,targetFrameSize:ke});fe.log.debug("using script processor");const Y=Ee.createScriptProcessor(4096,1,1);let ut=!1;return Y.onaudioprocess=async We=>{if(!ut){ut=!0;try{const yt=We.inputBuffer.getChannelData(0);We.outputBuffer.getChannelData(0).fill(0);const lt=de.process(yt);for(const $t of lt)await me($t)}catch(yt){console.error("Error processing audio:",yt)}finally{ut=!1}}},Y.connect(Ee.destination),Y}class Rt{constructor(ke,me,de,Le,Y=!1,ut=null,We=null,yt=null,ur=null,lt=null,$t=null,wr="uninitialized",br=!1){this.options=ke,this.frameProcessor=me,this.model=de,this.frameSamples=Le,this.listening=Y,this.errored=ut,this._stream=We,this._audioContext=yt,this._vadNode=ur,this._mediaStreamAudioSourceNode=lt,this._audioProcessorAdapterType=$t,this.initializationState=wr,this.ownsAudioContext=br,this.getAudioInstances=()=>{if(this._stream===null||this._audioContext===null||this._vadNode==null||this._mediaStreamAudioSourceNode==null)throw new Error("MicVAD has null stream, audio context, or processor adapter");return{stream:this._stream,audioContext:this._audioContext,vadNode:this._vadNode,mediaStreamAudioSourceNode:this._mediaStreamAudioSourceNode}},this.setErrored=Be=>{this.initializationState="errored",this.errored=Be},this.start=async()=>{switch(this.initializationState){case"uninitialized":{fe.log.debug("initializing micVAD"),this.initializationState="initializing",this.frameProcessor.resume();try{this._stream=await this.options.getStream()}catch(Be){throw Be instanceof Error?this.setErrored(Be.message):this.setErrored(String(Be)),Be}if(this.options.audioContext?(console.log("using custom audio context"),this._audioContext=this.options.audioContext):(console.log("using default audio context"),this._audioContext=new AudioContext,this.ownsAudioContext=!0),!this._audioContext)throw this.setErrored("Audio context is null"),Error("Audio context is null");switch(this._audioProcessorAdapterType=this.options.processorType=="auto"?Ue(this._audioContext):this.options.processorType,this._audioProcessorAdapterType){case"AudioWorklet":this._vadNode=await je(this.options.baseAssetPath+Ve,this.options.workletOptions,this._audioContext,this.frameSamples,this.processFrame);break;case"ScriptProcessor":this._vadNode=await bt(this._audioContext,this.frameSamples,this.processFrame);break;default:throw new Error(`Unsupported audio processor adapter type: ${this._audioProcessorAdapterType}`)}this._mediaStreamAudioSourceNode=new MediaStreamAudioSourceNode(this._audioContext,{mediaStream:this._stream}),this._mediaStreamAudioSourceNode.connect(this._vadNode),fe.log.debug("started micVAD"),this.listening=!0,this.initializationState="initialized";break}case"initializing":{fe.log.warn("start called while initializing");break}case"initialized":{if(this.listening)return;this.listening=!0,this.frameProcessor.resume();const{stream:Be,audioContext:zt,vadNode:vi}=this.getAudioInstances();this._stream=await this.options.resumeStream(Be);const it=new MediaStreamAudioSourceNode(zt,{mediaStream:this._stream});this._mediaStreamAudioSourceNode=it,it.connect(vi);break}case"destroyed":{fe.log.warn("start called after destroyed");break}case"errored":{fe.log.error("start called after errored");break}default:{fe.log.warn("weird initialization state");break}}},this.pause=async()=>{if(!this.listening)return;this.listening=!1;const{stream:Be,mediaStreamAudioSourceNode:zt}=this.getAudioInstances();await this.options.pauseStream(Be),zt.disconnect(),this.frameProcessor.pause(this.handleFrameProcessorEvent)},this.destroy=async()=>{var zt;fe.log.debug("destroy called"),this.initializationState="destroyed";const{vadNode:Be}=this.getAudioInstances();Be instanceof AudioWorkletNode&&Be.port.postMessage(I.Message.SpeechStop),this.listening&&await this.pause(),await this.model.release(),this.ownsAudioContext&&await((zt=this._audioContext)==null?void 0:zt.close())},this.setOptions=Be=>{this.frameProcessor.setOptions(Be)},this.processFrame=async Be=>{await this.frameProcessor.process(Be,this.handleFrameProcessorEvent)},this.handleFrameProcessorEvent=Be=>{switch(Be.msg){case I.Message.FrameProcessed:this.options.onFrameProcessed(Be.probs,Be.frame);break;case I.Message.SpeechStart:this.options.onSpeechStart();break;case I.Message.SpeechRealStart:this.options.onSpeechRealStart();break;case I.Message.VADMisfire:this.options.onVADMisfire();break;case I.Message.SpeechEnd:this.options.onSpeechEnd(Be.audio);break}}}static async new(ke={}){const me={...(0,L.getDefaultRealTimeVADOptions)(ke.model??L.DEFAULT_MODEL),...ke};(0,_e.validateOptions)(me),L.ort.env.wasm.wasmPaths=me.onnxWASMBasePath,me.ortConfig!==void 0&&me.ortConfig(L.ort);const de=me.model==="v5"?ve:$e,Le=me.baseAssetPath+de,Y=me.model==="v5"?be.SileroV5.new:be.SileroLegacy.new;let ut;try{ut=await Y(L.ort,()=>(0,he.defaultModelFetcher)(Le))}catch($t){throw console.error(`Encountered an error while loading model file ${Le}`),$t}const We=me.model==="v5"?512:1536,yt=We/16,ur=new _e.FrameProcessor(ut.process,ut.reset_state,{positiveSpeechThreshold:me.positiveSpeechThreshold,negativeSpeechThreshold:me.negativeSpeechThreshold,redemptionMs:me.redemptionMs,preSpeechPadMs:me.preSpeechPadMs,minSpeechMs:me.minSpeechMs,submitUserSpeechOnPause:me.submitUserSpeechOnPause},yt),lt=new Rt(me,ur,ut,We);if(me.startOnLoad)try{await lt.start()}catch($t){throw console.error("Error starting micVad",$t),$t}return lt}}L.MicVAD=Rt})(ic);(function(L){Object.defineProperty(L,"__esModule",{value:!0}),L.getDefaultRealTimeVADOptions=L.MicVAD=L.DEFAULT_MODEL=L.utils=L.NonRealTimeVAD=L.Message=L.FrameProcessor=L.defaultModelFetcher=L.baseAssetPath=void 0;var ee=$a;Object.defineProperty(L,"baseAssetPath",{enumerable:!0,get:function(){return ee.baseAssetPath}});var ne=$i;Object.defineProperty(L,"defaultModelFetcher",{enumerable:!0,get:function(){return ne.defaultModelFetcher}});var Z=er;Object.defineProperty(L,"FrameProcessor",{enumerable:!0,get:function(){return Z.FrameProcessor}});var ue=ri;Object.defineProperty(L,"Message",{enumerable:!0,get:function(){return ue.Message}});var he=Zp;Object.defineProperty(L,"NonRealTimeVAD",{enumerable:!0,get:function(){return he.NonRealTimeVAD}});const _e=Jt;L.utils={audioFileToArray:_e.audioFileToArray,minFramesForTargetMS:_e.minFramesForTargetMS,arrayBufferToBase64:_e.arrayBufferToBase64,encodeWAV:_e.encodeWAV};var fe=ic;Object.defineProperty(L,"DEFAULT_MODEL",{enumerable:!0,get:function(){return fe.DEFAULT_MODEL}}),Object.defineProperty(L,"MicVAD",{enumerable:!0,get:function(){return fe.MicVAD}}),Object.defineProperty(L,"getDefaultRealTimeVADOptions",{enumerable:!0,get:function(){return fe.getDefaultRealTimeVADOptions}})})(os);const wh=ih(os),$h=ah({__proto__:null,default:wh},[os]);export{$h as i};
