import {useEffect,useMemo,useState} from 'react';
import type {BrainTurn} from '../core/types';
import {deleteFeedback,listFeedback,submitFeedback,
 type FeedbackRating,type FeedbackReason,type FeedbackRow} from '../intelligence/feedback/feedback-client';
const REASONS:{id:FeedbackReason;label:string}[]=[
 {id:'accuracy',label:'Nội dung chưa chính xác'},
 {id:'latency',label:'Phản hồi chậm'},
 {id:'voice',label:'Giọng nói chưa tự nhiên'},
 {id:'experience',label:'Trải nghiệm giao diện'},
 {id:'other',label:'Khác'},
];
function latestExchange(history:BrainTurn[]){
 for(let i=history.length-1;i>=1;i--){
   if(history[i].role!=='mira'||!history[i].text.trim())continue;
   for(let j=i-1;j>=0;j--)if(history[j].role==='user'&&history[j].text.trim())
     return {user:history[j].text.slice(0,1200),assistant:history[i].text.slice(0,1200)};
 }
 return null;
}
export default function FeedbackPanel({recentHistory}:{recentHistory:BrainTurn[]}){
 const exchange=useMemo(()=>latestExchange(recentHistory),[recentHistory]);
 const [rating,setRating]=useState<FeedbackRating|null>(null);
 const [reason,setReason]=useState<FeedbackReason>('accuracy');
 const [note,setNote]=useState('');
 const [shareExchange,setShareExchange]=useState(false);
 const [rows,setRows]=useState<FeedbackRow[]>([]);
 const quality=useMemo(()=>{
   const total=rows.length;
   const positives=rows.filter(item=>item.rating==='helpful').length;
   const negative=rows.filter(item=>item.rating==='unhelpful');
   const top=REASONS.map(item=>({
     label:item.label,count:negative.filter(row=>row.reason===item.id).length,
   })).sort((a,b)=>b.count-a.count)[0];
   return {total,positives,negative:negative.length,
     positiveRate:total?Math.round(positives/total*100):null,
     topIssue:top?.count?top.label:null};
 },[rows]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 useEffect(()=>{
   let active=true;
   void listFeedback().then(items=>{if(active)setRows(items);})
     .catch(()=>{if(active)setError('Chưa tải được lịch sử góp ý.');});
   return()=>{active=false;};
 },[]);
 async function submit(){
   if(!rating||busy)return;
   setBusy(true);setError('');setSuccess('');
   try{
     await submitFeedback({
       rating,reason,note:note.trim(),shareExchange:shareExchange&&Boolean(exchange),
       ...(shareExchange&&exchange?{userExcerpt:exchange.user,assistantExcerpt:exchange.assistant}:{}),
     });
     setRating(null);setNote('');setShareExchange(false);
     setRows(await listFeedback());
     setSuccess('Đã ghi nhận góp ý. Cảm ơn anh!');
   }catch(e){setError(e instanceof Error?e.message:'Lỗi khi gửi góp ý.');}
   finally{setBusy(false);}
 }
 async function remove(id?:string){
   if(busy||!window.confirm(id?'Xóa góp ý này?':'Xóa tất cả góp ý?'))return;
   setBusy(true);setError('');setSuccess('');
   try{await deleteFeedback(id);setRows(await listFeedback());setSuccess('Đã xóa dữ liệu góp ý.');}
   catch(e){setError(e instanceof Error?e.message:'Không xóa được góp ý.');}
   finally{setBusy(false);}
 }
 return <div className="v2-feedback-panel" data-feedback-default="no-chat-sharing">
  <section className="v2-setting-group v2-feedback-form">
   <div className="v2-feedback-heading">
    <div><h3>Giúp Mira tốt hơn</h3>
     <p>Đánh giá câu trả lời để Mira được cải thiện trong các bản cập nhật.</p></div>
    <span className="v2-feedback-privacy-badge">Không gửi chat</span>
   </div>
   <div className="v2-feedback-choices" role="group" aria-label="Đánh giá câu trả lời">
    <button type="button" aria-pressed={rating==='helpful'} onClick={()=>setRating('helpful')}>👍 Hữu ích</button>
    <button type="button" aria-pressed={rating==='unhelpful'} onClick={()=>setRating('unhelpful')}>👎 Cần cải thiện</button>
   </div>
   <label className="v2-feedback-field">Lý do đánh giá
    <select value={reason} onChange={e=>setReason(e.target.value as FeedbackReason)}>
     {REASONS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
    </select>
   </label>
   <label className="v2-feedback-field">Góp ý thêm <small>(không bắt buộc)</small>
    <textarea value={note} maxLength={400} rows={3} onChange={e=>setNote(e.target.value)}
      placeholder="Điều gì cần cải thiện?"/>
   </label>
   <label className="v2-feedback-check">
     <input type="checkbox" disabled={!exchange} checked={shareExchange&&Boolean(exchange)}
        onChange={e=>setShareExchange(e.target.checked)}/>
     <span>Kèm cặp hỏi–đáp gần nhất để kiểm tra lỗi <strong>(tùy chọn)</strong></span>
   </label>
   {shareExchange&&exchange&&<div className="v2-feedback-preview" aria-label="Xem trước phần chat sẽ chia sẻ">
      <div><strong>Câu hỏi</strong><p>{exchange.user}</p></div>
      <div><strong>Mira trả lời</strong><p>{exchange.assistant}</p></div>
      <small>Hãy kiểm tra và chỉ gửi khi không chứa thông tin riêng tư anh không muốn chia sẻ. Mỗi đoạn tối đa 1200 ký tự.</small>
   </div>}
   {!exchange&&<p className="v2-feedback-help">Chưa có hội thoại trong phiên. Anh vẫn có thể gửi đánh giá.</p>}
   <details className="v2-feedback-privacy-info"><summary>Dữ liệu góp ý được dùng như thế nào?</summary>
     <p>Chỉ gửi khi anh bấm Gửi góp ý. Không tự gửi camera, giọng nói hoặc hội thoại.
      Nội dung ghi chú anh nhập có thể được đội phát triển đọc để cải thiện sản phẩm.
      Dữ liệu góp ý có hạn lưu 90 ngày và có thể xóa bất kỳ lúc nào.
      Không tự động huấn luyện model từ góp ý.</p>
   </details>
   <div className="v2-feedback-actions"><button type="button" className="primary"
     disabled={!rating||busy} onClick={()=>void submit()}>{busy?'Đang gửi…':'Gửi góp ý'}</button></div>
   {success&&<p role="status">{success}</p>}
   {error&&<p className="v2-profile-error" role="alert">{error}</p>}
  </section>
  <section className="v2-setting-group">
   <div className="v2-feedback-heading">
    <div><h3>Chất lượng theo phản hồi của anh</h3>
      <p>Thống kê từ tối đa 30 góp ý mới nhất của phiên này, không phải toàn bộ người dùng.</p></div>
   </div>
   <div className="v2-feedback-stats" aria-label="Thống kê phản hồi cá nhân">
    <div><strong>{quality.total}</strong><span>Góp ý</span></div>
    <div><strong>{quality.positiveRate===null?'—':quality.positiveRate+'%'}</strong><span>Hữu ích</span></div>
    <div><strong>{quality.negative}</strong><span>Cần cải thiện</span></div>
   </div>
   {quality.topIssue&&<p className="v2-feedback-issue">Vấn đề được góp ý nhiều nhất: <b>{quality.topIssue}</b></p>}
   <h4 className="v2-feedback-history-heading">Lịch sử góp ý</h4>
   <div className="v2-feedback-list">
    {!rows.length&&<p className="v2-disclosure">Chưa có góp ý trong phiên này.</p>}
    {rows.map(row=><article className="v2-feedback-item" key={row.id}>
       <span>{row.rating==='helpful'?'👍 Hữu ích':'👎 Cần cải thiện'} · {REASONS.find(x=>x.id===row.reason)?.label}
        <small> · {row.shared_exchange?'Có chia sẻ chat':'Không chia sẻ chat'}</small>
       </span>
       <button type="button" disabled={busy} onClick={()=>void remove(String(row.id))}>Xóa</button>
    </article>)}
   </div>
   {rows.length>0&&<div className="v2-feedback-actions"><button disabled={busy}
     type="button" onClick={()=>void remove()}>Xóa toàn bộ góp ý</button></div>}
   <p className="v2-disclosure">Góp ý và Memory lưu riêng. Xóa toàn bộ Memory cũng xóa góp ý của phiên hiện tại.</p>
  </section>
 </div>;
}
