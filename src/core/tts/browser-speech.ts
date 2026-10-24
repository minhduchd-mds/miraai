// Last-resort spoken reply: the device's own Vietnamese voice (Web Speech synthesis).
// Free, on-device, no network. Used only when the server voice (ElevenLabs → Gemini)
// cannot answer, so Mira never goes silent; Settings shows which voice is speaking.

export interface BrowserSpeechHandlers {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (reason: string) => void;
}

// Female Vietnamese system voices first (iOS/macOS Linh, Windows HoaiMy/An, Android/Chrome Google).
const PREFERRED = [/linh/i, /hoaimy|hoài my/i, /google.*vi|tiếng việt/i, /\ban\b/i];

export function pickVietnameseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const vi = voices.filter((voice) => /^vi(-|_|$)/i.test(voice.lang));
  if (!vi.length) return null;
  for (const pattern of PREFERRED) {
    const hit = vi.find((voice) => pattern.test(voice.name));
    if (hit) return hit;
  }
  return vi[0];
}

export class BrowserSpeech {
  private current: SpeechSynthesisUtterance | null = null;

  static supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  /** True when the device has a Vietnamese voice (voices load async on some browsers). */
  hasVietnameseVoice(): boolean {
    return BrowserSpeech.supported() && !!pickVietnameseVoice(window.speechSynthesis.getVoices());
  }

  get speaking(): boolean {
    return !!this.current && BrowserSpeech.supported() && window.speechSynthesis.speaking;
  }

  /** Returns false when it cannot even start (unsupported / no Vietnamese voice). */
  speak(text: string, rate: number, handlers: BrowserSpeechHandlers): boolean {
    if (!BrowserSpeech.supported()) return false;
    const synth = window.speechSynthesis;
    const voice = pickVietnameseVoice(synth.getVoices());
    // Without a Vietnamese voice the device would read Vietnamese with an English voice.
    if (!voice) return false;
    this.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Some engines only expose voices by lang; a foreign voice object must not abort the reply.
    try { utterance.voice = voice; } catch { /* lang below still selects Vietnamese */ }
    utterance.lang = voice.lang || 'vi-VN';
    utterance.rate = Math.min(1.6, Math.max(0.6, rate || 1));
    utterance.pitch = 1.05;
    utterance.onstart = () => { if (this.current === utterance) handlers.onStart?.(); };
    utterance.onend = () => {
      if (this.current !== utterance) return;
      this.current = null;
      handlers.onEnd?.();
    };
    utterance.onerror = (event) => {
      if (this.current !== utterance) return;
      this.current = null;
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      handlers.onError?.(`browser_speech_${event.error || 'failed'}`);
    };
    this.current = utterance;
    try { synth.speak(utterance); } catch { this.current = null; return false; }
    return true;
  }

  cancel(): void {
    if (!this.current) return;
    this.current = null;
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
  }
}
