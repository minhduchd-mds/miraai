// Product-improvement feedback is never an implicit transcript upload.
// Explicit confirmation and per-submission context sharing are mandatory.
export const FEEDBACK_REASONS = Object.freeze([
  'accuracy', 'relevance', 'speed', 'voice', 'vision', 'privacy', 'other',
]);
const ratingValues = new Set(['helpful','not_helpful']);
const reasons = new Set(FEEDBACK_REASONS);
function clean(value, cap) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0,cap) : '';
}
export function validateProductFeedback(data) {
  if (!data || typeof data !== 'object' || data.consent !== true ||
      !ratingValues.has(data.rating) || !reasons.has(data.reason)) return null;
  if (data.shareContext !== true && data.shareContext !== false) return null;
  const note = clean(data.note, 500);
  // Sharing raw dialogue is opt-in FOR THIS SUBMISSION. Never infer it from
  // product analytics, stored Memory settings, or the existence of chat history.
  const question = data.shareContext ? clean(data.question, 900) : null;
  const answer = data.shareContext ? clean(data.answer, 1400) : null;
  if (data.shareContext && (!question || !answer)) return null;
  const firstAudioMs = Number.isFinite(data.firstAudioMs) &&
    data.firstAudioMs >= 0 && data.firstAudioMs <= 120000
      ? Math.round(data.firstAudioMs) : null;
  return {
    rating: data.rating, reason:data.reason, note,
    sharedContext: data.shareContext, question, answer, firstAudioMs,
  };
}
