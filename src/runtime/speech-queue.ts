import type { MiraTTS } from '../core/tts';
import { normalizeVietnameseSpeech } from '../core/tts/vi-normalize';
import {
  directVietnameseSpeech,
  planVietnameseTurn,
  semanticPauseMs,
  turnSegmentPauseMs,
  type DirectedSpeechSegment,
} from '../core/tts/vi-speech-director';
import { chunkSpeech, cleanForSpeech } from './speech-utils';

export interface SpeechQueuePlayOptions {
  text: string;
  lang: string;
  rate: number;
  voiceURI?: string;
  isActive: () => boolean;
  onDone: () => void;
}

export interface SpeechQueueCueOptions {
  text: string;
  lang: string;
  rate: number;
  voiceURI?: string;
  isActive: () => boolean;
  onDone?: () => void;
}

interface PlannedChunk {
  text: string;
  segment: DirectedSpeechSegment;
  rate: number;
  pauseAfterMs: number;
}

/** Serializes semantic TTS chunks and invalidates old queues on interrupt/new turns. */
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

  /**
   * Plays one very short conversational backchannel while Mira is still in thinking state.
   * It deliberately does not transition the conversation machine to speaking. A later final
   * response supersedes this token and the TTS adapter naturally cancels/replaces the cue.
   */
  playCue(options: SpeechQueueCueOptions): void {
    const tts = this.getTTS();
    if (!tts || !options.isActive()) return;

    if (this.pauseTimer != null) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }

    const cleaned = cleanForSpeech(options.text) || options.text;
    const directed = directVietnameseSpeech(cleaned);
    const normalized = normalizeVietnameseSpeech(directed.speechText);
    const token = ++this.sequence;
    const rate = Math.max(0.76, Math.min(1.12, options.rate * 0.94));
    const cueInstructions = `${directed.instructions} Đây chỉ là một backchannel rất ngắn trong lúc đang suy nghĩ. Nói nhỏ, tự nhiên, không diễn, không kéo dài âm và không biến nó thành một câu trả lời hoàn chỉnh.`;

    tts.speak({
      text: normalized,
      lang: options.lang,
      rate,
      voiceURI: options.voiceURI,
      instructions: cueInstructions,
      onEnd: () => {
        if (token !== this.sequence || !options.isActive()) return;
        options.onDone?.();
      },
      onError: () => {
        if (token !== this.sequence) return;
        options.onDone?.();
      },
    });
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
    const turn = planVietnameseTurn(cleaned);
    const plannedChunks: PlannedChunk[] = [];

    turn.segments.forEach((segment, segmentIndex) => {
      const normalized = normalizeVietnameseSpeech(segment.text);
      const chunks = chunkSpeech(normalized, 52);
      const effectiveRate = Math.max(0.7, Math.min(1.35, options.rate * segment.rateMultiplier));

      chunks.forEach((chunk, chunkIndex) => {
        const isLastChunkInSegment = chunkIndex >= chunks.length - 1;
        const pauseAfterMs = isLastChunkInSegment
          ? turnSegmentPauseMs(segment, segmentIndex, turn.segments.length)
          : semanticPauseMs(chunk, segment.performance);
        plannedChunks.push({ text: chunk, segment, rate: effectiveRate, pauseAfterMs });
      });
    });

    // Defensive fallback for unexpected segmentation failure.
    if (!plannedChunks.length && turn.speechText.trim()) {
      const normalized = normalizeVietnameseSpeech(turn.speechText);
      const chunks = chunkSpeech(normalized, 52);
      const fallbackSegment: DirectedSpeechSegment = {
        text: turn.speechText,
        role: 'opening',
        performance: turn.performance,
        instructions: turn.instructions,
        rateMultiplier: turn.rateMultiplier,
      };
      const effectiveRate = Math.max(0.7, Math.min(1.35, options.rate * turn.rateMultiplier));
      chunks.forEach((chunk, index) => plannedChunks.push({
        text: chunk,
        segment: fallbackSegment,
        rate: effectiveRate,
        pauseAfterMs: index < chunks.length - 1 ? semanticPauseMs(chunk, turn.performance) : 0,
      }));
    }

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
      if (index >= plannedChunks.length) {
        finish();
        return;
      }

      const chunk = plannedChunks[index];
      tts.speak({
        text: chunk.text,
        lang: options.lang,
        rate: chunk.rate,
        voiceURI: options.voiceURI,
        instructions: chunk.segment.instructions,
        onEnd: () => {
          if (token !== this.sequence || !options.isActive()) return;
          const isLast = index >= plannedChunks.length - 1;
          if (isLast) {
            finish();
            return;
          }

          if (chunk.pauseAfterMs <= 0) playFrom(index + 1);
          else {
            this.pauseTimer = setTimeout(() => {
              this.pauseTimer = null;
              playFrom(index + 1);
            }, chunk.pauseAfterMs);
          }
        },
        onError: finish,
      });
    };

    if (!plannedChunks.length) finish();
    else playFrom(0);
  }
}
