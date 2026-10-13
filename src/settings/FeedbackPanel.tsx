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
  <section className="v2-setting-group">
   <h3>Đánh giá Mira</h3>
   <p>Chỉ gửi khi anh bấm nút. Mặc định không gửi nội dung hội thoại, hình ảnh hoặc giọng nói. Phản hồi không tự động dùng để huấn luyện AI.</p>
   <div className="v2-feedback-choices" role="group" aria-label="Đánh giá câu trả lời">
    <button type="button" aria-pressed={rating==='helpful'} onClick={()=>setRating('helpful')}>👍 Hữu ích</button>
    <button type="button" aria-pressed={rating==='unhelpful'} onClick={()=>setRating('unhelpful')}>👎 Cần cải thiện</button>
   </div>
   <label className="v2-feedback-field">Vấn đề
    <select value={reason} onChange={e=>setReason(e.target.value as FeedbackReason)}>
     {REASONS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
    </select>
   </label>
   <label className="v2-feedback-field">Góp ý thêm (tùy chọn, tối đa 400 ký tự)
    <textarea value={note} maxLength={400} rows={3} onChange={e=>setNote(e.target.value)}
      placeholder="Điều gì cần cải thiện?"/>
   </label>
   <label className="v2-feedback-check">
     <input type="checkbox" disabled={!exchange} checked={shareExchange&&Boolean(exchange)}
        onChange={e=>setShareExchange(e.target.checked)}/>
     <span>Đồng ý chia sẻ duy nhất cặp hỏi–đáp dưới đây cho việc kiểm tra lỗi.
       Không bật mặc định. Dữ liệu hết hạn sau 90 ngày.</span>
   </label>
   {shareExchange&&exchange&&<div className="v2-feedback-preview" aria-label="Xem trước phần chat sẽ chia sẻ">
      <div><strong>Câu hỏi</strong><p>{exchange.user}</p></div>
      <div><strong>Mira trả lời</strong><p>{exchange.assistant}</p></div>
      <small>Hãy kiểm tra và chỉ gửi khi không chứa thông tin riêng tư anh không muốn chia sẻ. Mỗi đoạn tối đa 1200 ký tự.</small>
   </div>}
   {!exchange&&<p className="v2-disclosure">Chưa có cặp hỏi–đáp; anh vẫn có thể gửi đánh giá không kèm hội thoại.</p>}
   <div className="v2-feedback-actions"><button type="button" className="primary"
     disabled={!rating||busy} onClick={()=>void submit()}>{busy?'Đang gửi…':'Gửi góp ý'}</button></div>
   {success&&<p role="status">{success}</p>}
   {error&&<p className="v2-profile-error" role="alert">{error}</p>}
  </section>
  <section className="v2-setting-group">
   <h3>Dữ liệu góp ý đã gửi</h3>
   <p>Lưu riêng với Memory; anh có thể xóa từng góp ý hoặc toàn bộ. Dữ liệu hết hạn sau 90 ngày và được dọn khi hệ thống nhận yêu cầu góp ý tiếp theo.</p>
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
   <p className="v2-disclosure">Phản hồi không thu thập ngầm ảnh camera, ghi âm microphone, dữ liệu khuôn mặt hoặc thông tin sức khỏe.</p>
  </section>
 </div>;
}
