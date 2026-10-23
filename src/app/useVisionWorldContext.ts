import { useCallback, useRef } from 'react';
import type { VisionWorldContextSample, VisionWorldPipeline } from './vision-world-pipeline';

// The world-context pipeline (SpatialSceneGraphTracker, ObjectInteractionTracker,
// ActionSequenceTracker, CausalActionGraphTracker, ShortTermWorldModelTracker, BehaviorTimeline,
// and spatialScenePrompt / objectInteractionPrompt / actionSequencePrompt / causalActionGraphPrompt /
// worldModelPrompt / environmentPrompt / interactionPrompt / presenceContinuityPrompt) only runs
// while the camera is on, so it is imported on first use instead of riding in the AppV2 boot graph.
// Until it has loaded (a few frames) the prompt context is simply empty.

const EMPTY = { promptContext: '' };

export function useVisionWorldContext() {
  const pipelineRef = useRef<VisionWorldPipeline | null>(null);
  const loadingRef = useRef<Promise<void> | null>(null);

  const updateVisionWorldContext = useCallback((
    sample: VisionWorldContextSample,
    now: number,
  ) => {
    const pipeline = pipelineRef.current;
    if (pipeline) return pipeline.update(sample, now);
    loadingRef.current = loadingRef.current || import('./vision-world-pipeline')
      .then(({ VisionWorldPipeline: Pipeline }) => { pipelineRef.current = new Pipeline(); })
      .catch(() => { loadingRef.current = null; });
    return EMPTY;
  }, []);

  const resetVisionWorldContext = useCallback(() => {
    pipelineRef.current?.reset();
  }, []);

  return {
    updateVisionWorldContext,
    resetVisionWorldContext,
  };
}
