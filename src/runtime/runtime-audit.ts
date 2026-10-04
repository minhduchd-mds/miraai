export type RuntimeAuditKind = 'skill' | 'host';
export type RuntimeAuditOutcome = 'allowed' | 'blocked' | 'executed' | 'failed';

export interface RuntimeAuditEvent {
  at: number;
  kind: RuntimeAuditKind;
  id: string;
  outcome: RuntimeAuditOutcome;
  risk?: string;
  reason?: string;
  /** Capability names only. Never store user input, secrets or model prompts here. */
  capabilities?: readonly string[];
  hostId?: string;
}

const DEFAULT_LIMIT = 200;

export class RuntimeAuditTrail {
  private events: RuntimeAuditEvent[] = [];

  constructor(private readonly limit = DEFAULT_LIMIT) {}

  record(event: Omit<RuntimeAuditEvent, 'at'> & { at?: number }): void {
    this.events.push({ ...event, at: event.at ?? Date.now() });
    if (this.events.length > this.limit) {
      this.events.splice(0, this.events.length - this.limit);
    }
  }

  snapshot(): RuntimeAuditEvent[] {
    return this.events.map((event) => ({
      ...event,
      capabilities: event.capabilities ? [...event.capabilities] : undefined,
    }));
  }

  clear(): void {
    this.events = [];
  }
}

/** Session-local audit trail. It intentionally does not persist prompts or secrets. */
export const runtimeAuditTrail = new RuntimeAuditTrail();

export function getRuntimeAuditTrailSnapshot(): RuntimeAuditEvent[] {
  return runtimeAuditTrail.snapshot();
}
