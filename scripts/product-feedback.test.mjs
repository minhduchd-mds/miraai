import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateProductFeedback, FEEDBACK_REASONS } from '../lib/feedback-validation.js';

const rating={consent:true,rating:'not_helpful',reason:'accuracy',note:'Mira trả lời chưa đúng',shareContext:false};
test('product feedback is denied without explicit consent and valid enum',()=>{
 for(const wrong of [
  {...rating,consent:false}, {...rating,consent:undefined},
  {...rating,rating:'excellent'}, {...rating,reason:'secret'}, {...rating,shareContext:null}
 ])assert.equal(validateProductFeedback(wrong),null);
 assert.ok(FEEDBACK_REASONS.includes('privacy'));
});
test('content is never inferred from stored history: shareContext=false drops it',()=>{
 const result=validateProductFeedback({...rating,question:'PRIVATE QUESTION',
  answer:'PRIVATE ANSWER',firstAudioMs:250.5});
 assert.equal(result.sharedContext,false);
 assert.equal(result.question,null);assert.equal(result.answer,null);
 assert.equal(result.firstAudioMs,251);
 assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});
test('each explicitly shared pair is bounded, typed and length capped',()=>{
 assert.equal(validateProductFeedback({...rating,shareContext:true}),null);
 const obj=validateProductFeedback({...rating,shareContext:true,question:'Q'.repeat(1300),
  answer:'A'.repeat(1800),note:'N'.repeat(700),firstAudioMs:Infinity});
 assert.equal(obj.question.length,900);assert.equal(obj.answer.length,1400);
 assert.equal(obj.note.length,500);assert.equal(obj.firstAudioMs,null);
});
test('feedback API enforces signed scope, trusted origin, retention and deletion',()=>{
 const endpoint=readFileSync('api/feedback.js','utf8');
 assert.match(endpoint,/requireTrustedWrite\(req,res\)/);
 assert.match(endpoint,/resolveMemoryScope\(req,res\)/);
 assert.match(endpoint,/markPrivateResponse\(res\)/);
 assert.match(endpoint,/validateProductFeedback\(data\)/);
 assert.match(endpoint,/enforceAiQuota\(req,res,'feedback',sql\)/);
 assert.match(endpoint,/where scope_id=\$\{scope\}/);
 assert.match(endpoint,/created_at\s*<\s*now\(\)\s*-\s*interval '90 days'/);
 assert.match(endpoint,/req.method==='DELETE'/);
 assert.doesNotMatch(endpoint,/log\(.*(?:question|answer|note)/);
});
