# Mira Companion Runtime

## Implemented runtime

- Local neural Vietnamese TTS on GitHub Pages with Piper + ONNX/WASM. The voice model is downloaded once and cached in OPFS.
- Real local LLM on compatible WebGPU browsers with WebLLM + Qwen 2.5 1.5B. No LLM API key is required for the Pages build.
- Long-term local memory in IndexedDB, while the existing Neon/API memory path remains available on server deployments.
- MediaPipe face landmarks with facial activity map, head pose, gaze, nod/shake and existing hand gestures.
- Camera affect estimate: happy, sad, tired, tense/angry, surprised and neutral. It is treated as an uncertain visual signal, never a diagnosis.
- Affect adaptation: speech rate, visual energy, prompt context and conservative proactive prompts.
- Proactive companion loop for stable expression signals, long silence, resume/wake events and late-night context.
- PWA + Screen Wake Lock + visibility/focus recovery for the strongest background behavior available to a web app.

## Privacy

Raw camera frames are processed in the browser and are not persisted. Only small numeric affect observations may be written to local IndexedDB when memory is enabled.

## Browser boundary

A normal web page or installed PWA cannot keep microphone/camera capture alive after the operating system has explicitly locked the device or suspended the browser. Mira requests a screen wake lock while 24/7 mode is active and resumes the voice loop when the page becomes visible again.

True locked-screen microphone capture requires a native/desktop host. GitHub Pages cannot honestly provide that capability by itself.
