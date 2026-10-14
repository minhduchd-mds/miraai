import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function load(path) {
  const js = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
const { mergeTurnHistory } = await load('src/intelligence/memory/merge-turn-history.ts');
const dialogue = await load('src/intelligence/social/companion-dialogue.ts');
const speech = await load('src/core/tts/vi-speech-director.ts');
const u = text => ({ role: 'user', text });
const a = text => ({ role: 'mira', text });

test('two-source memory merge keeps real repeated utterances and aligned overlapping history', () => {
  const local = [u('Anh mệt vì công việc'), a('Em đang nghe'), u('Xin chào'), u('Xin chào')];
  const remote = [u('Anh mệt vì công việc'), a('Em đang nghe'), u('Xin chào')];
  assert.deepEqual(mergeTurnHistory(local, remote), local);
  assert.deepEqual(mergeTurnHistory([u('B'), u('C')], [u('A'), u('B')]), [u('A'), u('B'), u('C')]);
  assert.deepEqual(mergeTurnHistory([u('A'), u('B')], [u('B'), u('C')]), [u('A'), u('B'), u('C')]);
  assert.deepEqual(mergeTurnHistory([u('Lời nói')], [a('Lời nói')]), [u('Lời nói'), a('Lời nói')]);
  assert.equal(mergeTurnHistory(Array.from({ length: 80 }, (_, n) => u(String(n))), []).length, 40);
});

test('multi-turn companion journey respects correction, rejection, practical task, and invitation', () => {
  const history = [u('Hôm nay anh mệt vì công việc'), a('Em đang nghe đây')];
  assert.equal(dialogue.detectCompanionIntent('Em chưa hiểu ý anh, anh chỉ muốn tâm sự', history), 'repair');
  history.push(u('Đừng bắt em đóng vai vợ anh nữa'), a('Em sẽ nói bình thường'));
  assert.equal(dialogue.detectCompanionIntent('Đừng bắt em đóng vai vợ anh nữa', history), 'boundary');
  assert.equal(dialogue.isExplicitCompanionRoleplayRequest('Đừng bắt em đóng vai vợ anh nữa'), false);
  assert.equal(dialogue.isExplicitCompanionRoleplayRequest('Anh không muốn em đóng vai người yêu'), false);
  assert.equal(dialogue.recentRomanticBoundary(history), true);
  const context = dialogue.companionTurnGuidance('Em kiểm tra API 500 giúp anh', history, 'partner');
  assert.match(context, /giới hạn này thắng cả preset Bạn đời/);
  assert.match(context, /Ưu tiên thông tin chính xác/);
  history.push(u('Em thử đóng vai vợ anh nhé'));
  assert.equal(dialogue.recentRomanticBoundary(history), false);
  assert.equal(dialogue.detectCompanionIntent('Anh stress quá, nhưng cần sửa lỗi API', history), 'practical');
});

test('Vietnamese voice stays directed for selected persona without modifying ElevenLabs identity', () => {
  const gentle = speech.planVietnameseTurn('Hôm nay anh mệt. Nhưng đã ổn hơn rồi. Em giúp anh nhé?', 'gentle');
  const close = speech.planVietnameseTurn('Hôm nay anh mệt. Nhưng đã ổn hơn rồi. Em giúp anh nhé?', 'close');
  assert.ok(gentle.segments.length >= 3);
  assert.equal(gentle.segments.length, close.segments.length);
  assert.match(close.instructions, /Preset Thân thiết/);
  assert.match(gentle.instructions, /Preset Dịu dàng/);
  assert.ok(close.segments.every(x => x.rateMultiplier >= 0.88 && x.rateMultiplier <= 1.06));
  assert.doesNotMatch(readFileSync('src/core/tts/vi-speech-director.ts','utf8'), /ELEVENLABS_API_KEY|voice_id:/);
  assert.match(readFileSync('api/tts.js','utf8'), /elevenDialoguePayload\(text, body.instructions\)/);
});

test('multi-turn test runner is automatically part of main CI suite', () => {
  assert.match(JSON.parse(readFileSync('package.json','utf8')).scripts.test, /companion-journey\.test\.mjs/);
  assert.match(readFileSync('src/intelligence/memory/memory-service.ts','utf8'), /return mergeTurnHistory\(local, remote\)/);
});


test('romantic boundary persists across more than sixteen synthetic turns',()=>{
  const history=[
    u('Em đừng đóng vai người yêu anh nữa'),
    ...Array.from({length: 24},(_,i)=>i%2===0
      ? a('Đã hiểu, em hỗ trợ công việc bình thường.')
      : u('Tiếp tục trao đổi công việc số '+i)),
  ];
  assert.equal(dialogue.recentRomanticBoundary(history),true);
  assert.match(dialogue.companionTurnGuidance('Em kiểm tra API giúp anh',history,'partner'),
    /giới hạn này thắng cả preset Bạn đời/);
  // The assistant must never be able to grant a user's relationship consent.
  history.push(a('Em muốn gọi anh là chồng yêu lại nhé'));
  assert.equal(dialogue.recentRomanticBoundary(history),true);
  history.push(u('Em thử đóng vai vợ anh nhé'));
  assert.equal(dialogue.recentRomanticBoundary(history),false);
});
