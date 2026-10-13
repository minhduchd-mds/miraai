export type FeedbackRating='helpful'|'unhelpful';
export type FeedbackReason='accuracy'|'latency'|'voice'|'experience'|'other';
export type FeedbackRow={
  id:string;rating:FeedbackRating;reason:FeedbackReason;note:string;
  shared_exchange:boolean;created_at:string;expires_at:string;
};
export type FeedbackSubmission={
  rating:FeedbackRating;reason:FeedbackReason;note:string;shareExchange:boolean;
  userExcerpt?:string;assistantExcerpt?:string;
};
async function query(method:'GET'|'POST'|'DELETE',body?:object) {
  const response=await fetch('/api/feedback',{
    method,credentials:'same-origin',cache:'no-store',
    ...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),
  });
  if(!response.ok)throw new Error(response.status===429?'Đã hết lượt góp ý trong 24 giờ.'
    :response.status===503?'Kho góp ý chưa sẵn sàng.':'Không lưu được góp ý.');
  return response.json();
}
export async function listFeedback():Promise<FeedbackRow[]>{
  const result=await query('GET');
  return Array.isArray(result.feedback)?result.feedback:[];
}
export async function submitFeedback(entry:FeedbackSubmission):Promise<void>{
  await query('POST',entry);
}
export async function deleteFeedback(id?:string):Promise<void>{
  await query('DELETE',id?{id}:{all:true});
}
