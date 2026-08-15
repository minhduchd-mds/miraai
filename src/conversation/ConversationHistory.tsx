import type { BrainTurn } from '../core/types';
import './history.css';

interface Props {
  open: boolean;
  turns: BrainTurn[];
  onClose: () => void;
}

export default function ConversationHistory({ open, turns, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="history-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="history-sheet" role="dialog" aria-modal="true" aria-labelledby="history-title">
        <header><div><small>CUỘC TRÒ CHUYỆN</small><h2 id="history-title">Gần đây</h2></div><button type="button" onClick={onClose} aria-label="Đóng lịch sử">×</button></header>
        <div className="history-turns">
          {!turns.length && <p className="history-empty">Chưa có lượt trò chuyện nào.</p>}
          {turns.map((turn, index) => (
            <article key={`${turn.role}-${index}`} className={`history-turn ${turn.role}`}>
              <span>{turn.role === 'mira' ? 'Mira' : 'Anh'}</span>
              <p>{turn.text}</p>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
