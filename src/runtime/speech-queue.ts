import type { MiraTTS } from '../core/tts';
import { normalizeVietnameseSpeech } from '../core/tts/vi-normalize';
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

  constructor(private readonly getTTS: () => MiraTTS | null) {}

  cancel(): void {
    this.sequence += 1;
    this.getTTS()?.cancel();
  }

  play(options: SpeechQueuePlayOptions): void {
    const tts = this.getTTS();
    if (!tts) {
      options.onDone();
      return;
    }

    const normalized = normalizeVietnameseSpeech(cleanForSpeech(options.text) || options.text);
    const chunks = chunkSpeech(normalized);
    const token = ++this.sequence;
    let finished = false;

    const finish = () => {
      if (finished || token !== this.sequence) return;
      finished = true;
      options.onDone();
    };

    const playFrom = (index: number) => {
      if (token !== this.sequence || !options.isActive()) return;
      if (index >= chunks.length) {
        finish();
        return;
      }
      tts.speak({
        text: chunks[index],
        lang: options.lang,
        rate: options.rate,
        voiceURI: options.voiceURI,
        onEnd: () => playFrom(index + 1),
        onError: finish,
      });
    };

    if (!chunks.length) finish();
    else playFrom(0);
  }
}
