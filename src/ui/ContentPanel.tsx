import { useState } from 'react';
import type { Content } from '../core/content';
import { downloadImage } from '../core/content';
import { IconClose, IconDownload } from './icons';

// Panel trực quan cạnh avatar: thẻ thời tiết hoặc ảnh (có nút tải về). Đóng → avatar về giữa.
interface Props {
  content: Content;
  onClose: () => void;
}

export default function ContentPanel({ content, onClose }: Props) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <aside className="content-panel" aria-live="polite">
      <button className="cp-close" onClick={onClose} aria-label="Đóng">
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
    </aside>
  );
}
