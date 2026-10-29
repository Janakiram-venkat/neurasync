import { useEffect, useRef } from 'react';
import { isButtonLike, isTextEntry, shortcutAction, type ShortcutAction } from './shortcuts';
import type { TimerPhase } from './timer';

type Handlers = Record<ShortcutAction, () => void> & { escape: () => void };

/** Global keyboard shortcuts for the study screen. Digits for check-ins live in CheckInPrompt. */
export function useStudyShortcuts(phase: TimerPhase, handlers: Handlers) {
  // Keep the latest handlers without re-subscribing on every render.
  const latest = useRef({ phase, handlers });
  latest.current = { phase, handlers };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      const { phase: current, handlers: h } = latest.current;
      if (ev.key === 'Escape' && !isTextEntry(ev.target)) {
        h.escape();
        return;
      }
      const action = shortcutAction(
        {
          key: ev.key,
          shiftKey: ev.shiftKey,
          ctrlKey: ev.ctrlKey,
          metaKey: ev.metaKey,
          altKey: ev.altKey,
          inTextEntry: isTextEntry(ev.target),
          onButton: isButtonLike(ev.target),
        },
        current,
      );
      if (!action) return;
      ev.preventDefault();
      h[action]();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
