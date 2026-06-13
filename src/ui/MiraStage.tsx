import type { RefObject, MutableRefObject } from 'react';
import type { MiraState, Mood, Theme } from '../core/types';
import MiraAvatar from '../avatar/MiraAvatar';
import MiraOrb from '../avatar/MiraOrb';

export type DisplayMode = 'avatar' | 'orb';

interface Props {
  chip: string;
  footglowRef: RefObject<HTMLDivElement>;
  stateRef: MutableRefObject<MiraState>;
  moodRef: MutableRefObject<Mood>;
  theme: Theme;
  displayMode: DisplayMode;
  avatarUrl: string;
  avatarOpacity: number;
}

// Sân khấu trung tâm: halo + vòng sàn + hào quang chân + avatar VRM 3D (hoặc orb giọng nói).
export default function MiraStage({ chip, footglowRef, stateRef, moodRef, theme, displayMode, avatarUrl, avatarOpacity }: Props) {
  return (
    <main className="center">
      <div className="scene">
        <div className="halo" />

        <div className="floor">
          <div className="r spin" />
          <div className="r spin rev" />
          <div className="r spin" />
          <div className="r spin rev" />
        </div>

        <div className="footglow" ref={footglowRef} />

        {displayMode === 'orb' ? (
          <MiraOrb stateRef={stateRef} theme={theme} />
        ) : (
          <MiraAvatar stateRef={stateRef} moodRef={moodRef} theme={theme} avatarUrl={avatarUrl} avatarOpacity={avatarOpacity} />
        )}

        <div className="chip">
          <b />
          <span>{chip}</span>
        </div>
      </div>
    </main>
  );
}
