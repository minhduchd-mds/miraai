import type {CSSProperties} from 'react';
import type {MiraState} from '../core/types';
import type {PhotorealVisualQuality} from './photoreal-depth';

type Props={src:string;state:MiraState;reducedMotion:boolean;
  gazeX:number;gazeY:number;quality:PhotorealVisualQuality};

/** A cinematic, photograph-based female Mira presentation.
 * Deliberately does NOT claim to animate individual eye/mouth muscles,
 * perform a deepfake, or be a real rigged 3D model. Every visual stays local.
 * A high-quality 3D GLB/VRM still requires a reviewed, licensed asset. */
export default function LiveFemalePortrait({src,state,reducedMotion,gazeX,gazeY,quality}:Props){
  const animate=!reducedMotion&&quality!=='lite';
  const limit=(value:number)=>Math.max(-1,Math.min(1,Number.isFinite(value)?value:0));
  const style={
    '--female-gaze-x':animate?(-limit(gazeX)*1.8).toFixed(2)+'px':'0px',
    '--female-gaze-y':animate?(-limit(gazeY)*1.1).toFixed(2)+'px':'0px',
  } as CSSProperties;
  const talking=animate&&state==='speaking';
  const listening=animate&&state==='listening';
  return <span className={`pm-live-female-portrait${talking?' is-speaking':''}${listening?' is-listening':''}`}
    style={style} data-source="authored-still" aria-hidden="true">
    <img src={src} alt="" draggable={false} decoding="async"/>
  </span>;
}
