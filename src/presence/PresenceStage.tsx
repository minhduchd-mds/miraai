import { lazy, Suspense, useEffect, useState, type MutableRefObject, type RefObject } from 'react';
import type { MiraState, Mood, Theme } from '../core/types';

const HeavyMiraStage = lazy(() => import('../ui/MiraStage'));

interface Props {
  footglowRef: RefObject<HTMLDivElement>;
  stateRef: MutableRefObject<MiraState>;
  moodRef: MutableRefObject<Mood>;
  theme: Theme;
  avatarUrl: string | null;
  lookSrc: string;
  avatarOpacity: number;
}

function Poster({ footglowRef, lookSrc, avatarOpacity }: Pick<Props, 'footglowRef' | 'lookSrc' | 'avatarOpacity'>) {
  return (
    <main className="center" aria-label="Mira">
      <div className="scene">
        <div className="halo" aria-hidden="true" />
        <div className="floor" aria-hidden="true">
          <div className="r spin" /><div className="r spin rev" /><div className="r spin" /><div className="r spin rev" />
        </div>
        <div className="footglow" ref={footglowRef} aria-hidden="true" />
        <img className="look2d breathe" id="avatar" alt="Mira" src={lookSrc} style={{ opacity: avatarOpacity }} />
      </div>
    </main>
  );
}

/**
 * Keeps Three/VRM out of the critical JS path. A 2D poster is interactive immediately;
 * 3D is requested after the initial shell has settled and only when the selected pack has a model.
 */
export default function PresenceStage(props: Props) {
  const [load3D, setLoad3D] = useState(false);

  useEffect(() => {
    setLoad3D(false);
    if (!props.avatarUrl) return;
    const timer = window.setTimeout(() => setLoad3D(true), 420);
    return () => window.clearTimeout(timer);
  }, [props.avatarUrl]);

  if (!props.avatarUrl || !load3D) {
    return <Poster footglowRef={props.footglowRef} lookSrc={props.lookSrc} avatarOpacity={props.avatarOpacity} />;
  }

  return (
    <Suspense fallback={<Poster footglowRef={props.footglowRef} lookSrc={props.lookSrc} avatarOpacity={props.avatarOpacity} />}>
      <HeavyMiraStage {...props} />
    </Suspense>
  );
}
