// Lazy bridge to the shared crisis-safety module so its phrase tables and copy stay out
// of the AppV2 boot graph (strict 300 KiB budget). The first check loads a ~3 KiB chunk.
type CrisisModule = typeof import('../../../lib/crisis-safety.js');

let loading: Promise<CrisisModule> | null = null;

export function loadCrisisSafety(): Promise<CrisisModule> {
  loading = loading || import('../../../lib/crisis-safety.js');
  return loading;
}

export async function isHighRiskText(text: string): Promise<boolean> {
  try {
    const { detectCrisis } = await loadCrisisSafety();
    return detectCrisis(text).level === 'high';
  } catch {
    return false;
  }
}

export async function crisisReply(): Promise<string> {
  const { crisisReplyVi } = await loadCrisisSafety();
  return crisisReplyVi();
}
