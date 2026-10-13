import {useEffect,useRef,useState} from 'react';
import {CALIBRATION_TESTS,SpatialCalibrationSession,type CalibrationKind} from '../core/vision/spatial-calibration';
import './spatial-calibration.css';

type VisionSnapshot=ReturnType<typeof import('../presence/vision-runtime')['visionSnapshot']>;
interface Props {
 visionOn:boolean;visionBooting:boolean;onToggleVision:()=>void;
 getVisionSnapshot:()=>VisionSnapshot|null;
 getVisionStream:()=>MediaStream|null;
}
const fmt=(value:number|null|undefined)=>value==null?'—':Math.round(value)+' ms';
export default function SpatialCalibrationPanel(props:Props){
 const engine=useRef(new SpatialCalibrationSession());
 const videoRef=useRef<HTMLVideoElement>(null);
 const streamGetterRef=useRef(props.getVisionStream);streamGetterRef.current=props.getVisionStream;
 const getter=useRef(props.getVisionSnapshot);getter.current=props.getVisionSnapshot;
 const [chosen,setChosen]=useState<CalibrationKind>('left');
 const [version,setVersion]=useState(0);
 const [handState,setHandState]=useState({left:false,right:false,pinch:false,palm:false,count:0});
 const [latency,setLatency]=useState({inferenceToUi:{count:0,p50Ms:0,p95Ms:0},
   inferenceToHandAction:{count:0,p50Ms:0,p95Ms:0},uniqueHandFrames:0});
 const [message,setMessage]=useState('');
 useEffect(()=>{
   if(!props.visionOn)return;
   let disposed=false;
   // Rebind to an already-authorized stream after automatic camera recovery.
   // Never call getUserMedia, create a second track, or restart a stable video.
   const attach=()=>{
     if(disposed||document.hidden)return;
     const video=videoRef.current;
     const stream=streamGetterRef.current();
     if(!video||!stream||!stream.getVideoTracks().some(track=>track.readyState==='live'))return;
     if(video.srcObject!==stream){
       video.srcObject=stream;
       video.muted=true;
       video.playsInline=true;
       void video.play().catch(()=>{});
     }
   };
   attach();
   const timer=window.setInterval(attach,750);
   return()=>{
     disposed=true;
     window.clearInterval(timer);
     const video=videoRef.current;
     if(video){video.pause();video.srcObject=null;}
   };
 },[props.visionOn]);
 useEffect(()=>{
   if(props.visionOn)return;
   const wasRunning=Boolean(engine.current.snapshot().active);
   engine.current.cancel();
   if(wasRunning)setMessage('Camera đã tắt. Bài thử được hủy, không tính vào tỷ lệ đạt.');
   setHandState({left:false,right:false,pinch:false,palm:false,count:0});
   setVersion(v=>v+1);
 },[props.visionOn]);
 useEffect(()=>{
   const onVisibility=()=>{
     if(document.visibilityState!=='hidden'||!engine.current.snapshot().active)return;
     engine.current.cancel();
     setMessage('Bài thử đã hủy khi ứng dụng chạy nền. Không tính kết quả.');
     setVersion(v=>v+1);
   };
   document.addEventListener('visibilitychange',onVisibility);
   return()=>document.removeEventListener('visibilitychange',onVisibility);
 },[]);
 useEffect(()=>{
   // Read-only observation. The settings dialog deliberately disables
   // Spatial UI actions; these samples must never trigger DOM clicks.
   if(!props.visionOn)return;
   let disposed=false;
   const timer=window.setInterval(()=>{
     if(disposed||document.hidden)return;
     const now=performance.now();
     const active=Boolean(engine.current.snapshot().active);
     const stream=streamGetterRef.current();
     const cameraLive=Boolean(stream?.getVideoTracks().some(track=>track.readyState==='live'));
     if(!cameraLive){
       if(active){
         engine.current.cancel();
         setMessage('Camera mất kết nối. Bài thử đã hủy, không tính kết quả.');
         setVersion(v=>v+1);
       }
       setHandState({left:false,right:false,pinch:false,palm:false,count:0});
       return;
     }
     const snapshot=getter.current();
     if(!snapshot){
       if(active){
         engine.current.cancel();
         setMessage('Luồng nhận diện chưa sẵn sàng. Vui lòng thử lại.');
         setVersion(v=>v+1);
       }
       return;
     }
     if(!snapshot.handSeen){
       setHandState({left:false,right:false,pinch:false,palm:false,count:0});
       // A neutral test counts camera-active observation polls even though
       // the hand detector correctly reports no hand/frame timestamp.
       if(engine.current.snapshot(now).active?.kind==='idle'){
         const done=engine.current.sample({at:now,now,hands:[]});
         if(done)setMessage(done.passed?'Bài thử trung tính đạt.':'Bài thử chưa đạt.');
         setVersion(v=>v+1); // advance neutral progress even with zero tracked hands
       }else if(engine.current.tick(now))setVersion(v=>v+1);
       return;
     }
     const hands=snapshot.hands.map(hand=>({
       handedness:hand.handedness,gesture:hand.gesture,
       pinching:Boolean(hand.pinching),score:Number(hand.score),
     }));
     const current=hands.filter(hand=>hand.score>=.75);
     setHandState({
       left:current.some(hand=>hand.handedness==='Left'),
       right:current.some(hand=>hand.handedness==='Right'),
       pinch:current.some(hand=>hand.pinching),
       palm:current.some(hand=>hand.gesture==='Open_Palm'),
       count:current.length,
     });
     const perf=snapshot.spatialPerformance;
     if(perf)setLatency({
       inferenceToUi:perf.inferenceToUi,
       inferenceToHandAction:perf.inferenceToHandAction,
       uniqueHandFrames:perf.uniqueHandFrames,
     });
     const result=engine.current.sample({at:snapshot.handFrameAt,now,hands});
     if(result){setMessage(result.passed?'Đã ghi nhận bài thử đạt':'Bài thử chưa đạt, có thể thực hiện lại.');setVersion(v=>v+1);}
     else if(engine.current.snapshot(now).active)setVersion(v=>v+1);
   },120);
   return()=>{disposed=true;window.clearInterval(timer);};
 },[props.visionOn]);
 // Counts/UI are derived from numeric-only session state, never serialized camera frames.
 const results=engine.current.snapshot(performance.now());
 const selected=CALIBRATION_TESTS.find(x=>x.kind===chosen)!;
 const start=()=>{
   if(!props.visionOn)return;
   engine.current.begin(chosen,performance.now());
   setMessage('Đang đo… thực hiện cử chỉ theo hướng dẫn.');
   setVersion(v=>v+1);
 };
 const exportLocal=()=>{
   const report={schema:'mira.spatial-calibration.v1',
     notice:'Guided self-test, not population-level accuracy or sensor-to-photon latency.',
     results:engine.current.snapshot(),spatialLatency:latency};
   const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],
     {type:'application/json'}));
   const link=document.createElement('a');link.href=url;
   link.download='mira-spatial-calibration.json';link.click();
   window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <div className="v2-calibration" data-spatial-calibration data-session={version}>
  <section className="v2-setting-group">
   <div className="v2-calibration-head">
    <div><h3>Hiệu chuẩn điều khiển</h3><p>Thử cử chỉ trực tiếp với camera hiện tại. Không tự bấm nút hoặc phát lệnh từ cử chỉ trong lúc thử.</p></div>
    <span className="v2-calibration-state" data-connected={props.visionOn}>
      {props.visionOn?'Camera kết nối':props.visionBooting?'Đang mở…':'Camera tắt'}
    </span>
   </div>
   {!props.visionOn&&<div className="v2-calibration-gate"><p>Camera chỉ bật khi anh cho phép. Không ghi hình hoặc gửi dữ liệu lên máy chủ.</p>
      <button type="button" disabled={props.visionBooting} onClick={props.onToggleVision}>{props.visionBooting?'Đang mở…':'Bật camera để thử'}</button>
    </div>}
   {props.visionOn&&<div className="v2-calibration-preview">
      <video ref={videoRef} autoPlay playsInline muted aria-label="Camera hiệu chuẩn tại chỗ"/>
      <span>LIVE · Chỉ hiển thị tại máy, không ghi hình</span>
    </div>}
   <div className="v2-calibration-live" aria-label="Tín hiệu camera trực tiếp">
    <div><i data-on={handState.left}/><span>Tay trái</span></div>
    <div><i data-on={handState.right}/><span>Tay phải</span></div>
    <div><i data-on={handState.pinch}/><span>Pinch</span></div>
    <div><i data-on={handState.palm}/><span>Xòe tay</span></div>
   </div>
   <div className="v2-calibration-steps" role="group" aria-label="Chọn cử chỉ kiểm tra">
    {CALIBRATION_TESTS.map(x=><button key={x.kind} type="button"
       disabled={Boolean(results.active)} aria-pressed={chosen===x.kind}
       onClick={()=>setChosen(x.kind)}>{x.label}
       {results.trials.some(t=>t.kind===x.kind)&&<small aria-hidden="true">
        {results.trials.filter(t=>t.kind===x.kind).slice(-1)[0]?.passed?'✓':'·'}</small>}
      </button>)}
   </div>
   <div className="v2-calibration-prompt">
     <span>BÀI THỬ ĐANG CHỌN</span><strong>{selected.label}</strong><p>{selected.instruction}</p>
     {results.active&&<div className="v2-calibration-progress" aria-label="Tiến độ bài thử">
       <span style={{width:Math.min(100,results.active.elapsedMs/results.active.durationMs*100)+'%'}} /></div>}
   </div>
   <div className="v2-calibration-actions">
    {results.active?<button type="button" onClick={()=>{engine.current.cancel();setMessage('Đã hủy bài thử.');setVersion(v=>v+1);}}>Hủy bài thử</button>
     :<button type="button" className="primary" disabled={!props.visionOn} onClick={start}>Bắt đầu kiểm tra</button>}
    <button type="button" disabled={!results.completed} onClick={()=>{engine.current.reset();setMessage('Đã xóa kết quả phiên.');setVersion(v=>v+1);}}>Đặt lại</button>
   </div>
   {message&&<p className="v2-calibration-note" role="status">{message}</p>}
  </section>
  <section className="v2-setting-group">
   <div className="v2-calibration-head"><div><h3>Kết quả phiên thử</h3>
     <p>Chỉ phản ánh các bài thử anh thực hiện, không phải độ chính xác của hệ thống trên tất cả người dùng.</p></div></div>
   <div className="v2-calibration-stats">
    <div><b>{results.completed}</b><span>Bài thử</span></div>
    <div><b>{results.passedRatePct==null?'—':results.passedRatePct+'%'}</b><span>Tỷ lệ đạt</span></div>
    <div><b>{results.unexpectedFrames}</b><span>Tín hiệu bất thường*</span></div>
   </div>
   <div className="v2-calibration-metrics">
    <div><span>Nhận diện từ lúc bấm Bắt đầu</span><b>{fmt(results.reactionAndRecognition.p50Ms)} / {fmt(results.reactionAndRecognition.p95Ms)}</b><small>P50 / P95, gồm thời gian anh đưa tay vào khung hình</small></div>
    <div><span>Camera → giao diện (frame)</span><b>{fmt(latency.inferenceToUi.p50Ms)} / {fmt(latency.inferenceToUi.p95Ms)}</b><small>P50 / P95, {latency.inferenceToUi.count} mẫu; không phải độ trễ màn hình vật lý</small></div>
    <div><span>Camera → hành động thật</span><b>{fmt(latency.inferenceToHandAction.p50Ms)} / {fmt(latency.inferenceToHandAction.p95Ms)}</b><small>P50 / P95, {latency.inferenceToHandAction.count} mẫu; có thể chưa có mẫu khi đang mở Cài đặt</small></div>
   </div>
   <div className="v2-calibration-actions"><button type="button" disabled={!results.completed} onClick={exportLocal}>Xuất JSON trên máy</button></div>
   <p className="v2-calibration-disclaimer">*Tín hiệu bất thường: nhận diện pinch hoặc xòe tay trong bài thử “Không thao tác”; không đồng nghĩa với thao tác click nhầm. Kết quả chỉ nằm trong bộ nhớ phiên, không tự lưu hay gửi mạng.</p>
  </section>
 </div>;
}
