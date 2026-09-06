import type { VRM } from '@pixiv/three-vrm';

// LipSync MVP (đề xuất research): chỉ tiêu thụ MỘT biên độ `amp` 0..1 mỗi frame —
// KHÔNG biết amp đến từ đâu. Web Speech không cho audio node nên amp là envelope
// tổng hợp theo vòng đời câu nói; sau này đổi sang provider TTS nội bộ (audio file) thì
// thay nguồn amp bằng AnalyserNode RMS, phần này giữ nguyên.
const VISEMES = ['aa', 'ih', 'ou', 'ee', 'oh'] as const;

export class LipSync {
  private jaw = 0; // độ mở hàm đã làm mượt
  private phase = 0;

  /** amp 0..1: 0 = im (ngậm), 1 = mở to. Gọi mỗi frame TRƯỚC vrm.update(delta). */
  update(vrm: VRM, delta: number, amp: number) {
    const em = vrm.expressionManager;
    if (!em) return;
    // làm mượt về amp mục tiêu + dao động 8–14Hz cho cảm giác âm tiết
    this.jaw += (amp - this.jaw) * Math.min(1, delta * 14);
    this.phase += delta * (8 + amp * 6);
    const open = Math.max(0, this.jaw) * (0.55 + 0.45 * Math.abs(Math.sin(this.phase)));
    em.setValue('aa', open * 0.9);
    em.setValue('ih', open * 0.22 * (0.5 + 0.5 * Math.sin(this.phase * 1.7)));
    em.setValue('ou', open * 0.3 * (0.5 + 0.5 * Math.sin(this.phase * 0.9 + 1)));
    em.setValue('oh', open * 0.2);
    em.setValue('ee', 0);
  }

  reset(vrm: VRM) {
    const em = vrm.expressionManager;
    if (em) VISEMES.forEach((v) => em.setValue(v, 0));
    this.jaw = 0;
  }
}