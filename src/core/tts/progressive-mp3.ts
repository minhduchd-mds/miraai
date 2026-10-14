/**
 * Progressive MPEG audio for browsers with MediaSource('audio/mpeg').
 * Audio is never stored; aborting an utterance cancels the reader and playback.
 * This module is loaded separately so the initial Mira UI JS remains small.
 */
export interface ProgressiveMp3 {
  audio: HTMLAudioElement;
  url: string;
  finished: Promise<void>;
}
export function startProgressiveMp3(
  response: Response,
  signal: AbortSignal,
  onFailure: (error: Error) => void,
): ProgressiveMp3 {
  if (!response.body) throw new Error('progressive_audio_no_stream');
  const mediaSource = new MediaSource();
  const url = URL.createObjectURL(mediaSource);
  const audio = new Audio(url);
  const reader = response.body.getReader();
  const fail = (error: unknown) => {
    if (!signal.aborted) onFailure(error instanceof Error ? error : new Error('progressive_audio_failed'));
  };
  const open = new Promise<void>((resolve, reject) => {
    const clear = () => {
      mediaSource.removeEventListener('sourceopen', opened);
      mediaSource.removeEventListener('sourceclose', closed);
      signal.removeEventListener('abort', aborted);
    };
    const opened = () => {clear();resolve();};
    const closed = () => {clear();reject(new Error('progressive_audio_closed'));};
    const aborted = () => {clear();reject(new Error('progressive_audio_aborted'));};
    mediaSource.addEventListener('sourceopen', opened, {once:true});
    mediaSource.addEventListener('sourceclose', closed, {once:true});
    signal.addEventListener('abort', aborted, {once:true});
    if (mediaSource.readyState === 'open') opened();
  });
  audio.load?.(); // open MSE without claiming actual playback has started
  const finished = (async () => {
    let total = 0;
    try {
      await open;
      if (signal.aborted) return;
      const buffer = mediaSource.addSourceBuffer('audio/mpeg');
      let playRequested = false;
      while (!signal.aborted) {
        const {done,value} = await reader.read();
        if (done) break;
        if (!(value instanceof Uint8Array)) throw new Error('progressive_audio_invalid_chunk');
        total += value.byteLength;
        if (total > 8 * 1024 * 1024) throw new Error('progressive_audio_too_large');
        if (!value.byteLength) continue;
        await new Promise<void>((resolve,reject) => {
          const clear = () => {
            buffer.removeEventListener('updateend', updated);
            buffer.removeEventListener('error', errored);
            signal.removeEventListener('abort', aborted);
          };
          const updated = () => {clear();resolve();};
          const errored = () => {clear();reject(new Error('progressive_audio_decode_failed'));};
          const aborted = () => {clear();reject(new Error('progressive_audio_aborted'));};
          buffer.addEventListener('updateend', updated, {once:true});
          buffer.addEventListener('error', errored, {once:true});
          signal.addEventListener('abort', aborted, {once:true});
          try { buffer.appendBuffer(value); } catch (error) {clear();reject(error);}
        });
        if (!playRequested && !signal.aborted) {
          playRequested = true;
          void audio.play().catch(fail);
        }
      }
      if (!signal.aborted && !total) throw new Error('progressive_audio_empty');
      if (!signal.aborted && mediaSource.readyState === 'open') mediaSource.endOfStream();
    } catch(error) {fail(error);}
    finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
  })();
  signal.addEventListener('abort',()=>{void reader.cancel().catch(()=>{});},{once:true});
  return {audio,url,finished};
}
