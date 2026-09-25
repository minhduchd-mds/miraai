import type { InteractionContext } from './interaction-engine';

export type BehaviorEventType = 'attention' | 'micro' | 'posture' | 'gesture' | 'proximity' | 'environment' | 'spatial';

export interface BehaviorEvent {
  id: string;
  type: BehaviorEventType;
  label: string;
  strength: number;
  at: number;
}

export interface BehaviorObservation {
  interaction?: InteractionContext;
  microKind?: string;
  microConfidence?: number;
  postureLabel?: string;
  postureConfidence?: number;
  gesture?: string;
  gestureScore?: number;
  proximity?: string;
  environment?: string;
  environmentConfidence?: number;
  spatialTarget?: string;
  spatialConfidence?: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export class BehaviorTimeline {
  private events: BehaviorEvent[] = [];
  private lastKeys = new Map<BehaviorEventType, string>();
  private seq = 0;

  private push(type: BehaviorEventType, label: string, strength: number, now: number): void {
    const key = type + ':' + label;
    if (this.lastKeys.get(type) === key) return;
    this.lastKeys.set(type, key);
    this.seq += 1;
    this.events.push({
      id: String(this.seq),
      type,
      label,
      strength: clamp01(strength),
      at: now,
    });
    if (this.events.length > 32) this.events.splice(0, this.events.length - 32);
  }

  observe(observation: BehaviorObservation, now = performance.now()): BehaviorEvent[] {
    const interaction = observation.interaction;
    if (interaction?.state) {
      this.push('attention', interaction.state, interaction.confidence, now);
    }

    const microKind = String(observation.microKind || 'none');
    if (microKind !== 'none' && Number(observation.microConfidence || 0) >= 0.35) {
      // Hold the key during the event's short display window; unlock after it returns to none.
      this.push('micro', microKind, Number(observation.microConfidence || 0), now);
    } else if (microKind === 'none') {
      this.lastKeys.delete('micro');
    }

    const posture = String(observation.postureLabel || 'unknown');
    if (posture !== 'unknown' && Number(observation.postureConfidence || 0) >= 0.5) {
      this.push('posture', posture, Number(observation.postureConfidence || 0), now);
    }

    const gesture = String(observation.gesture || 'None');
    if (gesture !== 'None' && Number(observation.gestureScore || 0) >= 0.55) {
      this.push('gesture', gesture, Number(observation.gestureScore || 0), now);
    } else if (gesture === 'None') {
      this.lastKeys.delete('gesture');
    }

    const proximity = String(observation.proximity || 'unknown');
    if (proximity !== 'unknown') {
      this.push('proximity', proximity, 0.7, now);
    }

    const environment = String(observation.environment || 'unknown');
    if (environment !== 'unknown' && Number(observation.environmentConfidence || 0) >= 0.48) {
      this.push('environment', environment, Number(observation.environmentConfidence || 0), now);
    }

    const spatialTarget = String(observation.spatialTarget || '');
    if (spatialTarget && Number(observation.spatialConfidence || 0) >= 0.52) {
      this.push('spatial', 'target:' + spatialTarget, Number(observation.spatialConfidence || 0), now);
    } else if (!spatialTarget) {
      this.lastKeys.delete('spatial');
    }

    this.events = this.events.filter((event) => now - event.at <= 90_000);
    return this.recent(6);
  }

  recent(limit = 6): BehaviorEvent[] {
    return this.events.slice(-Math.max(1, limit)).map((event) => ({ ...event }));
  }

  promptSummary(now = performance.now()): string {
    const recent = this.events.filter((event) => now - event.at <= 12_000 && event.strength >= 0.45);
    if (!recent.length) return '';
    const labels = recent.slice(-4).map((event) => event.type + '=' + event.label);
    return 'Các tín hiệu hành vi quan sát gần đây: ' + labels.join(', ') + '. Chỉ dùng như ngữ cảnh phụ, không suy diễn ý định hay cảm xúc bên trong.';
  }

  reset(): void {
    this.events = [];
    this.lastKeys.clear();
    this.seq = 0;
  }
}
