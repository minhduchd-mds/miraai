/**
 * v28 camera reconnection policy: bounded attempts, stability window,
 * visibility-gated by its caller, RAM only. Never prompts while off.
 */
export class VisionCameraRecoveryPolicy {
  private attempts = 0;
  private lastAttemptAt = -Infinity;
  private liveSince = -1;

  get exhausted(): boolean { return this.attempts >= 3; }

  canRetry(now: number): boolean {
    if (!Number.isFinite(now) || now < 0 || this.exhausted) return false;
    const cooldown = this.attempts ? 1000 * 2 ** (this.attempts - 1) : 0;
    return now >= this.lastAttemptAt + cooldown;
  }

  noteAttempt(now: number): void {
    if (!this.canRetry(now)) return;
    this.attempts += 1;
    this.lastAttemptAt = now;
    this.liveSince = -1;
  }

  noteLive(now: number): void {
    if (!Number.isFinite(now)) return;
    if (this.liveSince < 0 || now < this.liveSince) this.liveSince = now;
    if (now - this.liveSince >= 15_000) {
      this.attempts = 0;
      this.lastAttemptAt = -Infinity;
    }
  }

  noteOffline(): void { this.liveSince = -1; }

  snapshot(): { attempts: number; exhausted: boolean } {
    return { attempts: this.attempts, exhausted: this.exhausted };
  }

  reset(): void {
    this.attempts = 0;
    this.lastAttemptAt = -Infinity;
    this.liveSince = -1;
  }
}
