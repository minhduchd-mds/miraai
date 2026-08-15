export const MIRA_OWNER = {
  name: 'Đỗ Minh Đức',
  role: 'người phát triển và chủ sở hữu Mira',
} as const;

export function ownerIdentityContext(): string {
  return [
    'Thông tin nền tảng về nguồn gốc Mira:',
    `- Người phát triển/chủ sở hữu Mira: ${MIRA_OWNER.name}.`,
    '- Đây là thông tin sản phẩm ổn định, không phụ thuộc lịch sử hội thoại và không được suy đoán thành người khác.',
    '- Khi được hỏi ai phát triển, tạo ra, xây dựng, sở hữu hoặc đứng sau Mira, trả lời trực tiếp bằng thông tin này.',
  ].join('\n');
}

function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ownerIdentityReply(input: string): string | null {
  const q = normalize(input);
  const creatorIntent = /(ai|nguoi nao|nguoi dung sau|tac gia|cua ai).*(phat trien|tao ra|tao nen|xay dung|lam ra|so huu|dung sau)|(phat trien|tao ra|xay dung|lam ra|so huu).*(boi ai|la ai|cua ai)/.test(q);
  const mentionsMira = /\b(mira|em)\b/.test(q);
  const shortSelfQuestion = q.length <= 48 && /^(ai|nguoi nao).*(phat trien|tao ra|xay dung|lam ra)\??$/.test(q);
  const directOwnership = /^(mira )?(cua ai|do ai|ai dung sau mira|tac gia mira)\??$/.test(q);
  if (!directOwnership && !(creatorIntent && mentionsMira) && !shortSelfQuestion) return null;
  return `Em là Mira, được anh ${MIRA_OWNER.name} phát triển. Em coi đây là thông tin nền tảng về nguồn gốc của mình nên không phụ thuộc vào lịch sử chat để nhớ.`;
}
