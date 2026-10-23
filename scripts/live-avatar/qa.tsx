// Dev-only QA harness (vite dev): mounts LiveAvatarPresence with scriptable state and voice
// level so screenshots can be captured at known mouth/eye poses. Never part of the build.
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import LiveAvatarPresence from '../../src/presence/live-avatar/LiveAvatarPresence';
import { ttsLevel } from '../../src/core/audio-level';
import type { MiraState } from '../../src/core/types';

declare global { interface Window { __qa: { setState(s: MiraState): void; voice(level: number, bands?: { low: number; mid: number; high: number }): void; realtime(on: boolean): void } } }

function Harness() {
  const [state, setState] = useState<MiraState>('idle');
  const [realtime, setRealtime] = useState(false);
  useEffect(() => {
    window.__qa = {
      setState,
      realtime: setRealtime,
      voice(level, bands) {
        ttsLevel.active = level >= 0;
        ttsLevel.value = Math.max(0, level);
        Object.assign(ttsLevel.bands, bands || { low: 0.3, mid: 0.4, high: 0.2 });
      },
    };
  }, []);
  return <div className="voice-stage"><LiveAvatarPresence state={state} live={realtime} realtime={realtime} onActivate={() => undefined} /></div>;
}

createRoot(document.getElementById('root')!).render(<Harness />);
