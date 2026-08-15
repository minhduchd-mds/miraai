import { useEffect } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Trap Tab inside a modal surface and restore focus to the trigger when it closes. */
export function useDialogFocus(open: boolean, selector: string): void {
  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let dialog: HTMLElement | null = null;
    const frame = window.requestAnimationFrame(() => {
      dialog = document.querySelector<HTMLElement>(selector);
      const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      dialog ||= document.querySelector<HTMLElement>(selector);
      if (!dialog) return;

      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true',
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      if (previous?.isConnected) window.requestAnimationFrame(() => previous.focus());
    };
  }, [open, selector]);
}
