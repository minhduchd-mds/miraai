const MEMORY_KEY = 'mira.memory.enabled';

export function memoryEnabled(): boolean {
  try {
    return localStorage.getItem(MEMORY_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setMemoryEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(MEMORY_KEY, enabled ? '1' : '0');
  } catch {
    // Privacy preference is best-effort when storage is unavailable.
  }
}
