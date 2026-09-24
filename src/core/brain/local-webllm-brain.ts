import type { Brain, BrainReply, BrainTurn } from '../types';
import { responseTokenBudget, voicePrefs } from '../voice-prefs';
import { buildSystem, buildTurns, parseMood } from './prompt';
import { CannedBrain } from './canned-brain';

const WEBLLM_MODULE_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.84';
const LARGE_MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
const SMALL_MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

function selectModel(): string {
  const memory = typeof navigator !== 'undefined' ? Number((navigator as any).deviceMemory || 0) : 0;
  return memory >= 8 ? LARGE_MODEL_ID : SMALL_MODEL_ID;
}

type LocalEngine = {
  chat: {
    completions: {
      create(input: Record<string, unknown>): Promise<any>;
    };
  };
};

let enginePromise: Promise<LocalEngine> | null = null;

function supportsWebGPU(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as any).gpu;
}

async function loadEngine(): Promise<LocalEngine> {
  if (!supportsWebGPU()) throw new Error('WebGPU unavailable');
  if (!enginePromise) {
    enginePromise = (async () => {
      const moduleUrl = WEBLLM_MODULE_URL;
      const webllm = await import(/* @vite-ignore */ moduleUrl) as any;
      return webllm.CreateMLCEngine(selectModel(), {
        initProgressCallback: (report: any) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('mira:local-brain-progress', { detail: report }));
          }
        },
        logLevel: 'WARN',
      }) as Promise<LocalEngine>;
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

/** Real local LLM for static GitHub Pages. Weights are cached by WebLLM after first load. */
export class LocalWebLLMBrain implements Brain {
  readonly name = 'Mira Brain · local Qwen';
  private fallback: Brain = new CannedBrain();

  async reply(input: string, history: BrainTurn[], context?: string): Promise<BrainReply> {
    if (!supportsWebGPU()) return this.fallback.reply(input, history, context);
    try {
      const engine = await loadEngine();
      const messages = [
        { role: 'system', content: buildSystem(context) },
        ...buildTurns(input, history),
      ];
      const maxTokens = Math.min(1200, responseTokenBudget(voicePrefs.responseLength));
      const response = await engine.chat.completions.create({
        messages,
        temperature: 0.72,
        top_p: 0.9,
        max_tokens: maxTokens,
        stream: false,
      });
      const raw = String(response?.choices?.[0]?.message?.content || '').trim();
      if (!raw) throw new Error('local model returned empty reply');
      const parsed = parseMood(raw);
      return { text: parsed.text || raw, mood: parsed.mood };
    } catch (error) {
      console.warn('[Mira Local Brain] fallback:', error);
      return this.fallback.reply(input, history, context);
    }
  }
}
