import type { Brain } from '../types';
import { CannedBrain } from './canned-brain';
import { LLMBrain } from './llm-brain';

const DEFAULT_MODEL: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
};

export interface LLMConfig {
  provider: '' | 'anthropic' | 'openai';
  apiKey: string;
  model: string;
}

const LS_KEY = 'mira.llm.config';

// Cấu hình lấy từ: localStorage (nhập qua Developer Console) > .env > rỗng (brain demo).
// ⚠️ Key trong localStorage chỉ dành cho dev cục bộ — production phải qua server proxy (§12).
export function loadLLMConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (c && typeof c === 'object') {
        return {
          provider: c.provider === 'anthropic' || c.provider === 'openai' ? c.provider : '',
          apiKey: typeof c.apiKey === 'string' ? c.apiKey : '',
          model: typeof c.model === 'string' ? c.model : '',
        };
      }
    }
  } catch {
    /* localStorage hỏng/bị chặn → rơi xuống env */
  }
  const provider = (import.meta.env.VITE_LLM_PROVIDER as string) || '';
  return {
    provider: provider === 'anthropic' || provider === 'openai' ? provider : '',
    apiKey: (import.meta.env.VITE_LLM_API_KEY as string) || '',
    model: (import.meta.env.VITE_LLM_MODEL as string) || '',
  };
}

export function saveLLMConfig(cfg: LLMConfig): void {
  try {
    if (!cfg.provider || !cfg.apiKey) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  } catch {
    /* noop */
  }
}

export function defaultModelFor(provider: string): string {
  return DEFAULT_MODEL[provider] || '';
}

export function createBrain(): Brain {
  const cfg = loadLLMConfig();
  if (cfg.provider && cfg.apiKey) {
    try {
      return new LLMBrain(cfg.provider, cfg.apiKey, cfg.model || DEFAULT_MODEL[cfg.provider]);
    } catch {
      // Lỗi khởi tạo → fallback brain demo để app vẫn chạy.
    }
  }
  return new CannedBrain();
}
