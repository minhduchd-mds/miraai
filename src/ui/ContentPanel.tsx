import { useState } from 'react';
import type { ResultView } from '../intelligence/skills/result-view';
import { downloadImage } from '../core/content';
import { IconClose, IconDownload } from './icons';
import './result-surface.css';

interface Props {
  content: ResultView;
  onClose: () => void;
}

/** Generic Result Surface: skills choose a view model; UI owns the presentation. */
export default function ContentPanel({ content, onClose }: Props) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <aside className="content-panel" aria-live="polite" aria-label="Kết quả từ Mira">
      <button className="cp-close" onClick={onClose} aria-label="Đóng kết quả">
        <IconClose />
      </button>

      {content.kind === 'weather' && (
        <div className="cp-weather">
          <div className="cp-emoji">{content.data.emoji}</div>
          <div className="cp-temp">{content.data.temp}°C</div>
          <div className="cp-city">{content.data.city}</div>
          <div className="cp-desc">{content.data.desc}</div>
          <div className="cp-meta">
            <span>💧 {content.data.humidity}%</span>
            <span>🌬 {content.data.wind} km/h</span>
          </div>
        </div>
      )}

      {content.kind === 'image' && (
        <div className="cp-image">
          <div className={`cp-imgwrap${imgLoaded ? ' loaded' : ''}`}>
            {!imgLoaded && <div className="cp-loading">Đang vẽ…</div>}
            <img src={content.data.url} alt={content.data.prompt} onLoad={() => setImgLoaded(true)} />
          </div>
          <div className="cp-cap">{content.data.prompt}</div>
          <button
            className="mbtn primary"
            onClick={() => downloadImage(content.data.url, `mira-${content.data.prompt.slice(0, 20).replace(/\s+/g, '-')}.jpg`)}
          >
            <IconDownload /> Tải về máy
          </button>
        </div>
      )}

      {content.kind === 'card' && (
        <article className="result-card">
          {content.data.eyebrow && <small>{content.data.eyebrow}</small>}
          <h3>{content.data.title}</h3>
          {content.data.body && <p>{content.data.body}</p>}
          {!!content.data.meta?.length && <div className="result-meta">{content.data.meta.map((item) => <span key={item}>{item}</span>)}</div>}
        </article>
      )}

      {content.kind === 'list' && (
        <div className="result-list">
          <h3>{content.data.title}</h3>
          <ul>{content.data.items.map((item, index) => <li key={`${item.title}-${index}`}><b>{item.title}</b>{item.subtitle && <span>{item.subtitle}</span>}</li>)}</ul>
        </div>
      )}
    </aside>
  );
}
