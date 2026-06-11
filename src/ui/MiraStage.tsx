import type { RefObject, MutableRefObject } from 'react';
import type { MiraState, Mood, Theme } from '../core/types';
import MiraAvatar from '../avatar/MiraAvatar';

interface Props {
  chip: string;
  footglowRef: RefObject<HTMLDivElement>;
  stateRef: MutableRefObject<MiraState>;
  moodRef: MutableRefObject<Mood>;
  theme: Theme;
}

// Sân khấu trung tâm: halo + vòng sàn + hào quang chân + avatar VRM 3D (fallback 2D bên trong).
export default function MiraStage({ chip, footglowRef, stateRef, moodRef, theme }: Props) {
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

        <MiraAvatar stateRef={stateRef} moodRef={moodRef} theme={theme} />

        <div className="chip">
          <b />
          <span>{chip}</span>
        </div>
      </div>
    </main>
  );
}
