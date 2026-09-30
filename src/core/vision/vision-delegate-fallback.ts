export function visionInferenceErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '');
}

/**
 * Some MediaPipe Tasks can create a GPU graph successfully, then fail only
 * when the first inference executes because a model op is unsupported by the
 * WebGL delegate. Treat these as delegate incompatibility, not camera failure.
 */
export function isRecoverableGpuDelegateError(error: unknown): boolean {
  const message = visionInferenceErrorMessage(error).toUpperCase();
  if (!message) return false;
  return [
    'UNIMPLEMENTED',
    'GPU DELEGATE',
    'DEQUANTIZE',
    'STRIDED_SLICE',
    'SHRINK_AXIS_MASK',
    'CALCULATORGRAPH::RUN',
    'INFERENCECALCULATOR',
  ].some((token) => message.includes(token));
}
