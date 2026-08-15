import { useState, type FormEvent, type KeyboardEvent } from 'react';
import './composer.css';

interface Props {
  onSubmit: (text: string) => void;
  busy?: boolean;
}

export default function Composer({ onSubmit, busy = false }: Props) {
  const [value, setValue] = useState('');

  const send = () => {
    const text = value.trim();
    if (!text) return;
    onSubmit(text);
    setValue('');
  };

  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  return (
    <form className={`mira-composer${busy ? ' busy' : ''}`} onSubmit={onFormSubmit} aria-label="Nhắn tin cho Mira">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        maxLength={4000}
        placeholder={busy ? 'Mira đang suy nghĩ — gửi tin mới để chuyển chủ đề…' : 'Nhắn Mira…'}
        aria-label="Tin nhắn cho Mira"
      />
      <button type="submit" disabled={!value.trim()} aria-label="Gửi tin nhắn">
        <span aria-hidden="true">↑</span>
      </button>
    </form>
  );
}
