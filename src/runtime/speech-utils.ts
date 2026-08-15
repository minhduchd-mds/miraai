// Pure helpers for the speech pipeline. Kept outside React so they can be unit/eval tested.
export function cleanForSpeech(input: string): string {
  return input
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
    .replace(/\n+/g, '. ')
    .replace(/[*_`#>~|]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+([,.!?…])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function chunkSpeech(text: string, minChunk = 40): string[] {
  const clean = text.trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…\n]+[.!?…]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  if (sentences.length <= 1) return [clean];

  const out: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    current = current ? `${current} ${sentence}` : sentence;
    // The first sentence is intentionally emitted early to reduce time-to-first-audio.
    if (out.length === 0 || current.length >= minChunk) {
      out.push(current);
      current = '';
    }
  }
  if (current) out.push(current);
  return out.length ? out : [clean];
}
