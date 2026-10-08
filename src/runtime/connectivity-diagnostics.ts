import { desktopInvoke, isDesktopRuntime } from '../desktop/bridge';
import { miraApiUrl } from '../desktop/cloud-endpoints';

export type ConnectivityState = 'ready' | 'unconfigured' | 'unavailable' | 'not_applicable';
export interface MiraConnectivityReport {
  model: ConnectivityState;
  memory: ConnectivityState;
  modelDetail: string;
  memoryDetail: string;
  memoryTurnCount?: number;
}

/** Read-only checks; no paid inference and no user data read beyond local count. */
export async function checkMiraConnectivity(): Promise<MiraConnectivityReport> {
  const native = isDesktopRuntime();
  const [brain, memory] = await Promise.all([
    (async (): Promise<{ state: ConnectivityState; detail: string }> => {
      try {
        const response = await fetch(miraApiUrl('brain-health'), {
          method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) return { state: 'unavailable', detail: 'Brain API HTTP ' + response.status };
        const status = await response.json();
        return status?.configured === true
          ? { state: 'ready', detail: 'Có cấu hình Brain; cần kiểm tra câu trả lời thực tế' }
          : { state: 'unconfigured', detail: 'Server chưa cấu hình được model trả lời' };
      } catch {
        return { state: 'unavailable', detail: 'Không kết nối được Brain API; kiểm tra mạng hoặc CORS' };
      }
    })(),
    (async (): Promise<{ state: ConnectivityState; detail: string; count?: number }> => {
      if (!native) return { state: 'not_applicable', detail: 'Không phải Desktop native' };
      try {
        const count = await desktopInvoke<number>('desktop_memory_count');
        if (!Number.isSafeInteger(count) || count < 0) {
          return { state: 'unavailable', detail: 'SQLite count không hợp lệ' };
        }
        return { state: 'ready', detail: 'SQLite local hoạt động', count };
      } catch {
        return { state: 'unavailable', detail: 'Không đọc được Tauri SQLite; không xóa dữ liệu' };
      }
    })(),
  ]);
  return { model: brain.state, modelDetail: brain.detail,
    memory: memory.state, memoryDetail: memory.detail,
    ...(memory.count === undefined ? {} : { memoryTurnCount: memory.count }) };
}
