import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteDesktopStructuredMemory,
  desktopMemoryKindLabel,
  desktopMemoryRelationLabel,
  loadDesktopMemoryGraph,
  updateDesktopStructuredMemory,
  type DesktopStructuredMemoryGraph,
  type DesktopStructuredMemoryNode,
} from '../desktop/memory-graph';

function statusLabel(status: string) {
  if (status === 'active') return 'Đang theo dõi';
  if (status === 'resolved') return 'Đã khép';
  return 'Đang lưu';
}

function formatDate(ts: number) {
  if (!Number.isFinite(ts) || ts <= 0) return 'Không rõ';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(new Date(ts));
  } catch {
    return 'Không rõ';
  }
}

function nodeMatches(node: DesktopStructuredMemoryNode, query: string) {
  if (!query) return true;
  const hay = `${node.text} ${desktopMemoryKindLabel(node.kind)} ${statusLabel(node.status)}`
    .toLocaleLowerCase('vi-VN');
  return hay.includes(query.toLocaleLowerCase('vi-VN'));
}

export default function StructuredMemoryInspector() {
  const [graph, setGraph] = useState<DesktopStructuredMemoryGraph | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'stored' | 'active' | 'resolved'>('stored');
  const [importance, setImportance] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const next = await loadDesktopMemoryGraph();
      setGraph(next);
      setSelectedId((current) => {
        if (current != null && next.nodes.some((node) => node.id === current)) return current;
        return next.nodes[0]?.id ?? null;
      });
    } catch (cause) {
      setGraph(null);
      setSelectedId(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const selected = useMemo(
    () => graph?.nodes.find((node) => node.id === selectedId) ?? null,
    [graph, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setText('');
      setStatus('stored');
      setImportance(0.5);
      return;
    }
    setText(selected.text);
    setStatus(
      selected.status === 'active' || selected.status === 'resolved'
        ? selected.status
        : 'stored',
    );
    setImportance(Math.max(0, Math.min(1, Number(selected.importance || 0))));
  }, [selected]);

  const filteredNodes = useMemo(
    () => (graph?.nodes ?? []).filter((node) => nodeMatches(node, query)).slice(0, 80),
    [graph, query],
  );

  const related = useMemo(() => {
    if (!graph || !selected) return [];
    return graph.links
      .filter((link) => link.sourceId === selected.id || link.targetId === selected.id)
      .map((link) => {
        const relatedId = link.sourceId === selected.id ? link.targetId : link.sourceId;
        return {
          link,
          node: graph.nodes.find((node) => node.id === relatedId) ?? null,
        };
      })
      .filter((item) => item.node)
      .sort((a, b) => b.link.weight - a.link.weight)
      .slice(0, 6);
  }, [graph, selected]);

  const save = async () => {
    if (!selected || !text.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await updateDesktopStructuredMemory({
        id: selected.id,
        text: text.trim(),
        importance,
        status,
      });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selected || busy) return;
    if (!window.confirm('Quên ký ức có cấu trúc này và các liên kết của nó?')) return;
    setBusy(true);
    setError('');
    try {
      await deleteDesktopStructuredMemory(selected.id);
      setSelectedId(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  };

  return (
    <div className="v2-structured-memory">
      <div className="v2-structured-memory-head">
        <div>
          <h3>Ký ức có cấu trúc</h3>
          <p>{graph ? `${graph.nodes.length} ký ức · ${graph.links.length} liên kết` : 'Đang đọc memory graph…'}</p>
        </div>
        <button type="button" disabled={busy} onClick={() => void refresh()}>
          {busy ? 'Đang đọc…' : 'Làm mới'}
        </button>
      </div>

      <label className="v2-memory-search">
        <span className="sr-only">Tìm trong ký ức có cấu trúc</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm theo nội dung, loại hoặc trạng thái…"
          maxLength={120}
        />
      </label>

      {error && <p className="v2-profile-error">{error}</p>}

      {!graph?.nodes.length && !busy ? (
        <p className="v2-empty">Chưa có ký ức có cấu trúc trên Mira Desktop.</p>
      ) : (
        <div className="v2-memory-inspector-layout">
          <div className="v2-memory-node-list" role="list" aria-label="Danh sách ký ức có cấu trúc">
            {filteredNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                role="listitem"
                className={selectedId === node.id ? 'active' : ''}
                onClick={() => setSelectedId(node.id)}
              >
                <span>
                  <i data-status={node.status}>{desktopMemoryKindLabel(node.kind)}</i>
                  <small>{statusLabel(node.status)}</small>
                </span>
                <b>{node.text}</b>
                <em>{Math.round(node.importance * 100)}% · {node.hitCount} lần · {node.linkCount} liên kết</em>
              </button>
            ))}
          </div>

          <div className="v2-memory-node-detail">
            {selected ? <>
              <div className="v2-memory-node-meta">
                <span>{desktopMemoryKindLabel(selected.kind)}</span>
                <small>Cập nhật {formatDate(selected.lastSeenTs)}</small>
              </div>

              <label className="v2-field">
                <span>Nội dung</span>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={1200}
                  rows={4}
                />
              </label>

              <div className="v2-memory-node-controls">
                <label className="v2-field">
                  <span>Trạng thái</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value as 'stored' | 'active' | 'resolved')}>
                    {selected.kind === 'active_thread' && <option value="active">Đang theo dõi</option>}
                    <option value="stored">Đang lưu</option>
                    <option value="resolved">Đã khép</option>
                  </select>
                </label>
                <label className="v2-memory-importance">
                  <span>Độ quan trọng <b>{Math.round(importance * 100)}%</b></span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={importance}
                    onChange={(event) => setImportance(Number(event.target.value))}
                  />
                </label>
              </div>

              <div className="v2-memory-relations">
                <span>Liên kết gần nhất</span>
                {related.length ? related.map(({ link, node }) => (
                  <button key={`${link.sourceId}:${link.targetId}:${link.relation}`} type="button" onClick={() => node && setSelectedId(node.id)}>
                    <i>{desktopMemoryRelationLabel(link.relation)} · {Math.round(link.weight * 100)}%</i>
                    <b>{node?.text}</b>
                  </button>
                )) : <small>Chưa có liên kết.</small>}
              </div>

              <p className="v2-disclosure">Sửa nội dung sẽ xoá liên kết semantic cũ của node để tránh quan hệ sai; liên kết cùng bối cảnh lịch sử vẫn được giữ.</p>
              <div className="v2-memory-actions">
                <button type="button" className="danger" disabled={busy} onClick={() => void remove()}>Quên ký ức</button>
                <button type="button" className="primary" disabled={busy || !text.trim()} onClick={() => void save()}>Lưu thay đổi</button>
              </div>
            </> : <p className="v2-empty">Chọn một ký ức để xem chi tiết.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
