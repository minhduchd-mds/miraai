import { CRISIS_RESOURCES } from '../../lib/crisis-safety.js';

/** Persistent help card shown after a self-harm disclosure; closed only by the user. */
export default function CrisisBanner({ onClose }: { onClose: () => void }) {
  return (
    <div className="v2-crisis" role="alert" aria-label="Hỗ trợ khẩn cấp">
      <b>Anh không phải đối mặt một mình</b>
      <ul>
        {CRISIS_RESOURCES.map((item) => (
          <li key={item.id}>
            <a href={`tel:${item.phone.replace(/\s+/g, '')}`}>{item.name} · {item.phone}</a>
            <small>{item.hours}</small>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClose}>Đóng</button>
    </div>
  );
}
