export type DesktopProfileNode = {
  id: number;
  kind: string;
  text: string;
  lastSeenTs: number;
};

const PROFILE_KINDS = new Set(['fact', 'preference', 'life_event', 'relationship_context', 'active_thread']);

/** Camera/affect observations are not asserted as durable profile facts. */
export function desktopProfileFacts(nodes: DesktopProfileNode[]): Array<{
  id: number;
  fact: string;
  updatedAt?: string;
}> {
  return (Array.isArray(nodes) ? nodes : [])
    .filter(node => PROFILE_KINDS.has(node.kind)
      && Number.isSafeInteger(node.id) && node.id > 0 && typeof node.text === 'string' && node.text.trim())
    .slice(0, 60)
    .map(node => ({
      id: node.id,
      fact: node.text,
      ...(Number.isFinite(node.lastSeenTs) && node.lastSeenTs > 0
        ? { updatedAt: new Date(node.lastSeenTs).toISOString() } : {}),
    }));
}
