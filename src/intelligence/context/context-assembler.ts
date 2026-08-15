import type { HostContext } from '../../host';

export function assembleBrainContext(memory: string, host: HostContext, skills: string[]): string {
  const sections: string[] = [];
  if (memory.trim()) sections.push(memory.trim());

  const hostLines = [
    `Sản phẩm hiện tại: ${host.product}`,
    host.project ? `Dự án hiện tại: ${host.project}` : '',
    host.screen ? `Màn hình/ngữ cảnh hiện tại: ${host.screen}` : '',
  ].filter(Boolean);
  if (hostLines.length) sections.push(`Ngữ cảnh ứng dụng:\n${hostLines.map((x) => `- ${x}`).join('\n')}`);

  if (skills.length) sections.push(`Khả năng có thể dùng khi phù hợp: ${skills.join(', ')}.`);
  return sections.join('\n\n');
}
