import type { MiraTTS } from '../core/tts';
import { normalizeVietnameseSpeech } from '../core/tts/vi-normalize';
import { directVietnameseSpeech, semanticPauseMs } from '../core/tts/vi-speech-director';
import { chunkSpeech, cleanForSpeech } from './speech-utils';

export interface SpeechQueuePlayOptions {
  text: string;
  lang: string;
  rate: number;
  voiceURI?: string;
  isActive: () => boolean;
  onDone: () => void;
}

/** Serializes sentence-sized TTS chunks and invalidates old queues on interrupt/new turns. */
export class SpeechQueue {
  private sequence = 0;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly getTTS: () => MiraTTS | null) {}

  cancel(): void {
    this.sequence += 1;
    if (this.pauseTimer != null) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    this.getTTS()?.cancel();
  }

  play(options: SpeechQueuePlayOptions): void {
    const tts = this.getTTS();
    if (!tts) {
      options.onDone();
      return;
    }

    if (this.pauseTimer != null) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }

    const cleaned = cleanForSpeech(options.text) || options.text;
    const directed = directVietnameseSpeech(cleaned);
    const normalized = normalizeVietnameseSpeech(directed.speechText);
    const chunks = chunkSpeech(normalized, 46);
    const effectiveRate = Math.max(0.7, Math.min(1.35, options.rate * directed.rateMultiplier));
    const token = ++this.sequence;
    let finished = false;

    const finish = () => {
      if (finished || token !== this.sequence) return;
      finished = true;
      this.pauseTimer = null;
      options.onDone();
    };

    const playFrom = (index: number) => {
      if (token !== this.sequence || !options.isActive()) return;
      if (index >= chunks.length) {
        finish();
        return;
      }

      const chunk = chunks[index];
      tts.speak({
        text: chunk,
        lang: options.lang,
        rate: effectiveRate,
        voiceURI: options.voiceURI,
        instructions: directed.instructions,
        onEnd: () => {
          if (token !== this.sequence || !options.isActive()) return;
          const isLast = index >= chunks.length - 1;
          if (isLast) {
            finish();
            return;
          }
          const pause = semanticPauseMs(chunk, directed.performance);
          if (pause <= 0) playFrom(index + 1);
          else {
            this.pauseTimer = setTimeout(() => {
              this.pauseTimer = null;
              playFrom(index + 1);
            }, pause);
          }
        },
        onError: finish,
      });
    };

    if (!chunks.length) finish();
    else playFrom(0);
  }
}
