import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
async function load(path){
 const source=readFileSync(path,'utf8');
 const js=ts.transpileModule(source,{fileName:path,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
const dialogue=await load('src/intelligence/social/companion-dialogue.ts');
const prefs=await load('src/core/voice-prefs.ts');
test('romantic role is opt-in and gentle remains the default',()=>{
 assert.equal(prefs.voicePrefs.persona,'gentle');
 assert.ok(prefs.PERSONAS.some(x=>x.id==='partner'&&x.label.includes('nhập vai')));
 assert.ok(prefs.PERSONAS.some(x=>x.id==='close'));
 assert.match(prefs.personaTone('partner'),/không tự nhận là vợ\/người yêu ngoài đời/);
 assert.equal(prefs.personaTone('unknown'),'');
});
test('support mode reflects feelings without inventing private facts',()=>{
 for(const s of ['Anh bất lực với công việc','Hôm nay anh stress quá','Anh cảm thấy cô đơn','Mệt mỏi thật']){
   const h=dialogue.companionTurnGuidance(s,[],'partner');
   assert.match(h,/lắng nghe cụ thể/);
   assert.match(h,/không đoán bệnh/);
   assert.doesNotMatch(h,/anh đang mắc|đã xảy ra chuyện/i);
 }
});
test('user boundaries always override intimate persona',()=>{
 for(const s of ['Đừng gọi anh là chồng yêu','Em nói bình thường thôi','Đừng lãng mạn nữa']){
   const h=dialogue.companionTurnGuidance(s,[],'partner');
   assert.match(h,/nói bình thường/);
   assert.match(h,/không gọi thân mật/);
 }
});
test('work prompts remain precise and concise even in partner persona',()=>{
 assert.match(dialogue.companionTurnGuidance('Em fix lỗi API trong dự án nhé',[],'partner'),/Ưu tiên thông tin chính xác/);
 assert.match(dialogue.companionTurnGuidance('Em nhớ anh lắm',[],'partner'),/Đáp lại tự nhiên/);
 assert.equal(dialogue.companionTurnGuidance('Em nhớ anh lắm',[],'pro'),'');
});
test('continuity needs actual past user context and never invents history',()=>{
 assert.equal(dialogue.detectCompanionIntent('Kể tiếp chuyện hôm trước',[]),'ordinary');
 assert.equal(dialogue.detectCompanionIntent('Kể tiếp chuyện hôm trước',[{role:'user',text:'Chuyện gia đình'}]),'continuity');
 assert.match(dialogue.companionTurnGuidance('Kể tiếp chuyện hôm trước',[{role:'user',text:'Chuyện gia đình'}],'close'),/không bịa ký ức/);
});
test('turn manager supplies temporal guidance without modifying memory persistence',()=>{
 const turn=readFileSync('src/runtime/turn-manager.ts','utf8');
 assert.match(turn,/companionTurnGuidance\(input, prior, voicePrefs\.persona\)/);
 assert.match(turn,/const context = \[baseContext, preBrainEvidence\(preBrainResult\), runtimeContext\.trim\(\), dialogue\]/);
 assert.match(turn,/this\.memory\.distill\('Người dùng: ' \+ input/);
 const prompt=readFileSync('src/core/brain/prompt.ts','utf8');
 assert.match(prompt,/không tự khẳng định quan hệ đời thực/);
});
test('voice guidance respects the chosen warm role without changing ElevenLabs model',()=>{
 const speech=readFileSync('src/core/tts/vi-speech-director.ts','utf8');
 assert.match(speech,/partner: 'Preset Bạn đời nhập vai/);
 assert.match(speech,/close: 'Preset Thân thiết/);
 assert.match(speech,/rateMultiplier/);
 assert.doesNotMatch(speech,/model:|voiceId:|apiKey:/i);
 const ui=readFileSync('src/settings/SettingsPanel.tsx','utf8');
 assert.match(ui,/aria-label="Chọn vai trò hội thoại"/);
 assert.match(ui,/persona === 'partner'/);
});
