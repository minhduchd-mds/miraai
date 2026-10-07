import type { SpatialSelectionRuntime } from '../core/vision/spatial-layout';
import type { SpatialWorldRuntime } from '../core/vision/spatial-world';

type SpatialSelectionFocus = {
  id: string;
  kind: string;
} | null | undefined;

type SpatialSelectionGestureInput = {
  intent: string;
  focus: SpatialSelectionFocus;
  selectionRuntime: SpatialSelectionRuntime;
  worldRuntime: SpatialWorldRuntime;
};

export function applySpatialSelectionGesture(input: SpatialSelectionGestureInput) {
  if (input.intent === 'victory_hold' && input.focus?.kind === 'object') {
    const clusterRoot = input.worldRuntime.clusterRootObjectId(input.focus.id);
    const selectedClusterRoots = input.selectionRuntime.toggle(clusterRoot);
    return {
      handled: true,
      selectedClusterRoots,
      resetGroupTransform: false,
      feedback: selectedClusterRoots.includes(clusterRoot)
        ? `Victory · chọn cụm ${clusterRoot}`
        : `Victory · bỏ chọn ${clusterRoot}`,
    };
  }

  if (input.intent === 'open_palm_hold' && input.selectionRuntime.snapshot().length) {
    input.selectionRuntime.clear();
    return {
      handled: true,
      selectedClusterRoots: [] as string[],
      resetGroupTransform: true,
      feedback: 'Open Palm · bỏ chọn nhóm',
    };
  }

  return null;
}
