import type { RefObject, MutableRefObject } from 'react';
import type { MiraState, Mood, Theme } from '../core/types';
import MiraAvatar from '../avatar/MiraAvatar';

interface Props {
  footglowRef: RefObject<HTMLDivElement>;
  stateRef: MutableRefObject<MiraState>;
  moodRef: MutableRefObject<Mood>;
  theme: Theme;
  avatarUrl: string | null; // null = bộ chưa có model 3D → hiện ảnh PNG (lookSrc)
  lookSrc: string;
  avatarOpacity: number;
}

// Sân khấu trung tâm: halo + vòng sàn + hào quang chân + avatar (VRM 3D hoặc ảnh PNG 2D).
export default function MiraStage({ footglowRef, stateRef, moodRef, theme, avatarUrl, lookSrc, avatarOpacity }: Props) {
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

        <MiraAvatar stateRef={stateRef} moodRef={moodRef} theme={theme} avatarUrl={avatarUrl} lookSrc={lookSrc} avatarOpacity={avatarOpacity} />
      </div>
    </main>
  );
}
