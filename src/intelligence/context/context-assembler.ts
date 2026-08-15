import type { HostContext } from '../../host';

export function assembleBrainContext(
  memory: string,
  host: HostContext,
  skills: string[],
  hostActions: string[] = [],
): string {
  const sections: string[] = [];
  if (memory.trim()) sections.push(memory.trim());

  const hostLines = [
    `Sản phẩm hiện tại: ${host.product}`,
    host.project ? `Dự án hiện tại: ${host.project}` : '',
    host.screen ? `Màn hình/ngữ cảnh hiện tại: ${host.screen}` : '',
  ].filter(Boolean);
  if (hostLines.length) sections.push(`Ngữ cảnh ứng dụng:\n${hostLines.map((line) => `- ${line}`).join('\n')}`);

  if (skills.length) sections.push(`Skill Mira có thể dùng: ${skills.join('; ')}.`);
  if (hostActions.length) {
    sections.push(
      'Action do ứng dụng chủ cung cấp: ' + hostActions.join('; ') +
      '. Chỉ yêu cầu action write/sensitive khi người dùng đã xác nhận rõ ràng.',
    );
  }
  return sections.join('\n\n');
}
