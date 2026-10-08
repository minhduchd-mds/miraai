import type { Brain } from '../types';
import { GeminiBrain } from './gemini-brain';
import { LLMBrain } from './llm-brain';


const DEFAULT_MODEL: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
};

export interface LLMConfig {
  provider: '' | 'anthropic' | 'openai';
  apiKey: string;
  model: string;
  webSearch: boolean;
}

const LS_KEY = 'mira.llm.config';

export function browserBYOKAllowed(): boolean {
  return import.meta.env.DEV;
}

export function loadLLMConfig(): LLMConfig {
  if (!browserBYOKAllowed()) {
    return { provider: '', apiKey: '', model: '', webSearch: false };
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const config = JSON.parse(raw);
      return {
        provider: config?.provider === 'anthropic' || config?.provider === 'openai' ? config.provider : '',
        apiKey: typeof config?.apiKey === 'string' ? config.apiKey : '',
        model: typeof config?.model === 'string' ? config.model : '',
        webSearch: typeof config?.webSearch === 'boolean' ? config.webSearch : true,
      };
    }
  } catch { /* fall through */ }
  return { provider: '', apiKey: '', model: '', webSearch: true };
}

export function saveLLMConfig(config: LLMConfig): void {
  try {
    if (!browserBYOKAllowed() || !config.provider || !config.apiKey) {
      localStorage.removeItem(LS_KEY);
      return;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  } catch { /* server gateway remains available */ }
}

export function defaultModelFor(provider: string): string {
  return DEFAULT_MODEL[provider] || '';
}

export function createBrain(): Brain {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')) {
    // Load the Pages-only WebLLM runtime when a response is first requested.
    // macOS/Windows Desktop never needs this engine in the AppV2 boot graph.
    let engine: Promise<Brain> | null = null;
    return {
      name: 'Mira Brain · local Qwen',
      async reply(input, history, context) {
        if (!engine) {
          engine = import('./local-webllm-brain')
            .then(({ LocalWebLLMBrain }) => new LocalWebLLMBrain())
            .catch((error) => { engine = null; throw error; });
        }
        return (await engine).reply(input, history, context);
      },
    };
  }
  const config = loadLLMConfig();
  if (browserBYOKAllowed() && config.provider && config.apiKey) {
    try {
      return new LLMBrain(
        config.provider,
        config.apiKey,
        config.model || DEFAULT_MODEL[config.provider],
        config.webSearch,
      );
    } catch { /* fall through */ }
  }
  return new GeminiBrain();
}
