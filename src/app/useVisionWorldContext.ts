import { useCallback, useRef } from 'react';
import type { EnvironmentContext, TrackedObject } from '../core/vision/environment-model';
import { environmentPrompt } from '../core/vision/environment-model';
import {
  SpatialSceneGraphTracker,
  spatialScenePrompt,
  type SpatialPointerSample,
} from '../core/vision/spatial-scene-graph';
import {
  ObjectInteractionTracker,
  objectInteractionPrompt,
  type InteractionHandSample,
} from '../core/vision/object-interaction';
import {
  ActionSequenceTracker,
  actionSequencePrompt,
} from '../core/vision/action-sequence';
import {
  CausalActionGraphTracker,
  causalActionGraphPrompt,
} from '../core/vision/causal-action-graph';
import {
  ShortTermWorldModelTracker,
  worldModelPrompt,
} from '../core/vision/world-model';
import {
  BehaviorTimeline,
} from '../intelligence/social/behavior-timeline';
import {
  interactionPrompt,
  type InteractionContext,
} from '../intelligence/social/interaction-engine';
import {
  presenceContinuityPrompt,
  type PresenceContinuityState,
} from '../intelligence/social/presence-continuity';

type VisionWorldContextSample = {
  environmentObjects: TrackedObject[];
  pointer: SpatialPointerSample;
  hands: InteractionHandSample[];
  interaction: InteractionContext;
  continuity: PresenceContinuityState;
  microKind: string;
  microConfidence: number;
  postureLabel: string;
  postureConfidence: number;
  gesture: string;
  gestureScore: number;
  proximity: string;
  environmentContext: EnvironmentContext;
};

export function useVisionWorldContext() {
  const sceneGraphTrackerRef = useRef(new SpatialSceneGraphTracker());
  const objectInteractionTrackerRef = useRef(new ObjectInteractionTracker());
  const actionSequenceTrackerRef = useRef(new ActionSequenceTracker());
  const causalActionGraphTrackerRef = useRef(new CausalActionGraphTracker());
  const worldModelTrackerRef = useRef(new ShortTermWorldModelTracker());
  const behaviorTimelineRef = useRef(new BehaviorTimeline());

  const updateVisionWorldContext = useCallback((
    sample: VisionWorldContextSample,
    now: number,
  ) => {
    const sceneGraph = sceneGraphTrackerRef.current.update(
      sample.environmentObjects,
      sample.pointer,
      now,
    );
    const objectInteraction = objectInteractionTrackerRef.current.update(
      sceneGraph,
      sample.hands,
      now,
    );
    const actionSequence = actionSequenceTrackerRef.current.update(
      sceneGraph,
      sample.hands,
      now,
    );
    const causalActionGraph = causalActionGraphTrackerRef.current.update(
      sceneGraph,
      sample.hands,
      actionSequence,
      now,
    );
    const worldState = worldModelTrackerRef.current.update(
      sceneGraph,
      causalActionGraph,
      now,
    );

    behaviorTimelineRef.current.observe({
      interaction: sample.interaction,
      microKind: sample.microKind,
      microConfidence: sample.microConfidence,
      postureLabel: sample.postureLabel,
      postureConfidence: sample.postureConfidence,
      gesture: sample.gesture,
      gestureScore: sample.gestureScore,
      proximity: sample.proximity,
      environment: String(sample.environmentContext.label || 'unknown'),
      environmentConfidence: Number(sample.environmentContext.confidence || 0),
      spatialTarget: sceneGraph.focus?.label || '',
      spatialConfidence: Number(sceneGraph.focus?.confidence || 0),
      objectInteractionStage: objectInteraction.stage,
      objectInteractionLabel: objectInteraction.objectLabel,
      objectInteractionConfidence: objectInteraction.confidence,
      actionSequenceStage: actionSequence.stage,
      actionSequenceLabel: actionSequence.objectLabel,
      actionSequenceConfidence: actionSequence.confidence,
      causalActionLabel: causalActionGraph.leader?.objectLabel || '',
      causalActionConfidence: Number(causalActionGraph.leader?.confidence || 0),
      causalActionMargin: causalActionGraph.margin,
    }, now);

    const promptContext = [
      interactionPrompt(sample.interaction),
      presenceContinuityPrompt(sample.continuity),
      behaviorTimelineRef.current.promptSummary(now),
      environmentPrompt(sample.environmentContext),
      spatialScenePrompt(sceneGraph, now),
      objectInteractionPrompt(objectInteraction, now),
      actionSequencePrompt(actionSequence, now),
      causalActionGraphPrompt(causalActionGraph, now),
      worldModelPrompt(worldState, now),
    ]
      .filter(Boolean)
      .join(' ');

    return {
      sceneGraph,
      objectInteraction,
      actionSequence,
      causalActionGraph,
      worldState,
      promptContext,
    };
  }, []);

  const resetVisionWorldContext = useCallback(() => {
    sceneGraphTrackerRef.current.reset();
    objectInteractionTrackerRef.current.reset();
    actionSequenceTrackerRef.current.reset();
    causalActionGraphTrackerRef.current.reset();
    worldModelTrackerRef.current.reset();
    behaviorTimelineRef.current.reset();
  }, []);

  return {
    updateVisionWorldContext,
    resetVisionWorldContext,
  };
}
