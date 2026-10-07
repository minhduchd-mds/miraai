import { desktopInvoke, isDesktopRuntime } from './bridge';

export type DesktopStructuredMemoryKind =
  | 'fact'
  | 'preference'
  | 'life_event'
  | 'relationship_context'
  | 'emotional_episode'
  | 'active_thread'
  | string;

export type DesktopStructuredMemoryStatus = 'stored' | 'active' | 'resolved' | string;

export interface DesktopStructuredMemoryNode {
  id: number;
  kind: DesktopStructuredMemoryKind;
  text: string;
  importance: number;
  status: DesktopStructuredMemoryStatus;
  firstSeenTs: number;
  lastSeenTs: number;
  hitCount: number;
  linkCount: number;
}

export interface DesktopStructuredMemoryLink {
  sourceId: number;
  targetId: number;
  relation: 'co_occurs' | 'semantic_temporal' | string;
  weight: number;
  createdAt: number;
}

export interface DesktopStructuredMemoryGraph {
  nodes: DesktopStructuredMemoryNode[];
  links: DesktopStructuredMemoryLink[];
}

export interface DesktopStructuredMemoryPatch {
  id: number;
  text?: string;
  importance?: number;
  status?: 'stored' | 'active' | 'resolved';
}

export async function loadDesktopMemoryGraph(): Promise<DesktopStructuredMemoryGraph> {
  if (!isDesktopRuntime()) return { nodes: [], links: [] };
  const graph = await desktopInvoke<DesktopStructuredMemoryGraph>('desktop_memory_graph');
  return {
    nodes: Array.isArray(graph?.nodes) ? graph.nodes : [],
    links: Array.isArray(graph?.links) ? graph.links : [],
  };
}

export async function updateDesktopStructuredMemory(
  patch: DesktopStructuredMemoryPatch,
): Promise<void> {
  if (!isDesktopRuntime()) throw new Error('Structured memory graph is available in Mira Desktop only.');
  await desktopInvoke<void>('desktop_memory_structured_update', { patch });
}

export async function deleteDesktopStructuredMemory(id: number): Promise<void> {
  if (!isDesktopRuntime()) throw new Error('Structured memory graph is available in Mira Desktop only.');
  await desktopInvoke<void>('desktop_memory_structured_delete', { id });
}

export function desktopMemoryKindLabel(kind: DesktopStructuredMemoryKind): string {
  if (kind === 'preference') return 'Sở thích';
  if (kind === 'life_event') return 'Sự kiện';
  if (kind === 'relationship_context') return 'Mối quan hệ';
  if (kind === 'emotional_episode') return 'Cảm xúc đã chia sẻ';
  if (kind === 'active_thread') return 'Việc đang theo dõi';
  if (kind === 'fact') return 'Thông tin';
  return 'Ký ức';
}

export function desktopMemoryRelationLabel(relation: string): string {
  if (relation === 'co_occurs') return 'Cùng bối cảnh';
  if (relation === 'semantic_temporal') return 'Liên quan chủ đề';
  return relation || 'Liên kết';
}
