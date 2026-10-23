export interface CrisisResource {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly hours: string;
}

export declare const CRISIS_RESOURCES: readonly CrisisResource[];
export declare const SAFETY_POLICY_VI: string;
export declare function normalizeVi(text: string): string;
export declare function detectCrisis(text: string): { level: 'none' | 'concern' | 'high'; matched: boolean };
export declare function crisisResourceLines(): string[];
export declare function crisisReplyVi(): string;
