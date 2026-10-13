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
 assert.match(turn,/import\('\.\.\/intelligence\/social\/companion-dialogue'\)/);
 assert.match(turn,/companionTurnGuidance\(input, prior, persona\)/);
 assert.match(turn,/dialoguePromise,/);
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

test('casual Vietnamese words do not accidentally trigger work from substring UI',()=>{
 assert.equal(dialogue.detectCompanionIntent('Anh vui lắm'), 'ordinary');
 assert.equal(dialogue.detectCompanionIntent('Anh vui quá'), 'celebrate');
 assert.equal(dialogue.detectCompanionIntent('Làm UI/UX cho web'), 'practical');
});
test('warm companion guide stays outside default voice bundle',()=>{
 const source=readFileSync('src/runtime/turn-manager.ts','utf8');
 assert.doesNotMatch(source,/^import \{ companionTurnGuidance \} from/m);
 assert.match(source,/persona === 'close' \|\| persona === 'partner'/);
 assert.match(source,/const dialoguePromise/);
 assert.match(source,/await Promise\.all\(\[/);
});

test('repair beats affection or distress keywords without ignoring the actual request',()=>{
 for(const prompt of ['Em chưa hiểu ý anh rồi','Không phải ý anh, em trả lời sai',
    'Em trả lời như máy và lặp đi lặp lại','Em nói nhầm rồi, chồng yêu']) {
   assert.equal(dialogue.detectCompanionIntent(prompt),'repair',prompt);
   const context=dialogue.companionTurnGuidance(prompt,[],'partner');
   assert.match(context,/Thừa nhận điểm sai cụ thể một lần/);
   assert.match(context,/Không biện hộ/);
 }
});

test('mixed stress and specific technical work remain actionable in partner mode',()=>{
 for(const prompt of ['Anh stress quá, sửa lỗi API giúp anh',
    'Anh mệt mỏi vì dự án. Kiểm tra CI nhé',
    'Thiết kế UI có chữ chồng yêu trên banner']) {
   assert.equal(dialogue.detectCompanionIntent(prompt),'practical',prompt);
   assert.match(dialogue.companionTurnGuidance(prompt,[],'partner'),/Ưu tiên thông tin chính xác/);
 }
 assert.equal(dialogue.detectCompanionIntent('Anh đang buồn quá'),'support');
});

test('opt-in romantic invitation lasts one turn without changing persona preference',()=>{
 assert.equal(dialogue.isExplicitCompanionRoleplayRequest('Em thử đóng vai vợ anh nhé'),true);
 assert.equal(dialogue.isExplicitCompanionRoleplayRequest('Nói chuyện như người yêu nhé'),true);
 assert.equal(dialogue.isExplicitCompanionRoleplayRequest('Đừng đóng vai vợ anh'),false);
 assert.equal(dialogue.isExplicitCompanionRoleplayRequest('Viết truyện về một người vợ'),false);
 const guidance=dialogue.companionTurnGuidance('Em thử đóng vai vợ anh nhé',[],'gentle');
 assert.match(guidance,/chủ động đề nghị nhập vai/);
 assert.match(guidance,/không âm thầm đổi chế độ/);
 assert.match(dialogue.companionTurnGuidance('Đừng gọi anh là chồng',[],'partner'),/không gọi thân mật/);
 assert.equal(prefs.voicePrefs.persona,'gentle');
});

test('continuity distinguishes real user history from AI-only claims',()=>{
 const history=[{role:'mira',text:'Chúng mình đã gặp nhau ngoài đời.'}];
 assert.equal(dialogue.detectCompanionIntent('Kể tiếp chuyện hôm trước',history),'ordinary');
 history.push({role:'user',text:'Hôm trước anh nói về dự án giao diện'});
 const context=dialogue.companionTurnGuidance('Kể tiếp chuyện hôm trước',history,'partner');
 assert.match(context,/không coi lời Mira từng tự nói là bằng chứng/);
 assert.match(context,/không bịa ký ức/);
});

test('roleplay dispatch remains lazy, permissionless and does not block Brain if guidance fails',()=>{
 const turn=readFileSync('src/runtime/turn-manager.ts','utf8');
 assert.match(turn,/persona === 'close' \|\| persona === 'partner' \|\| invited/);
 assert.match(turn,/\.catch\(\(\) => ''\)/);
 assert.match(turn,/const dialoguePromise/);
 assert.match(turn,/const reply = await this.getBrain\(\)\.reply/);
 const prompt=readFileSync('src/core/brain/prompt.ts','utf8');
 assert.match(prompt,/sửa nội dung trước/);
 assert.match(prompt,/không tự khẳng định quan hệ đời thực/);
});
