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

export type VisionWorldContextSample = {
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

/**
 * Camera-only world-context pipeline (scene graph → object interaction → action sequence →
 * causal graph → short-term world model + behaviour timeline → prompt context).
 * Loaded on demand by useVisionWorldContext so voice-only sessions never download it.
 */
export class VisionWorldPipeline {
  private sceneGraphTracker = new SpatialSceneGraphTracker();
  private objectInteractionTracker = new ObjectInteractionTracker();
  private actionSequenceTracker = new ActionSequenceTracker();
  private causalActionGraphTracker = new CausalActionGraphTracker();
  private worldModelTracker = new ShortTermWorldModelTracker();
  private behaviorTimeline = new BehaviorTimeline();

  update(sample: VisionWorldContextSample, now: number) {
    const sceneGraph = this.sceneGraphTracker.update(
      sample.environmentObjects,
      sample.pointer,
      now,
    );
    const objectInteraction = this.objectInteractionTracker.update(
      sceneGraph,
      sample.hands,
      now,
    );
    const actionSequence = this.actionSequenceTracker.update(
      sceneGraph,
      sample.hands,
      now,
    );
    const causalActionGraph = this.causalActionGraphTracker.update(
      sceneGraph,
      sample.hands,
      actionSequence,
      now,
    );
    const worldState = this.worldModelTracker.update(
      sceneGraph,
      causalActionGraph,
      now,
    );

    this.behaviorTimeline.observe({
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
      this.behaviorTimeline.promptSummary(now),
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
  }

  reset() {
    this.sceneGraphTracker.reset();
    this.objectInteractionTracker.reset();
    this.actionSequenceTracker.reset();
    this.causalActionGraphTracker.reset();
    this.worldModelTracker.reset();
    this.behaviorTimeline.reset();
  }
}
