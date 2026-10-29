import type { TimerPhase } from './timer';

export type ShortcutAction = 'start' | 'pause' | 'resume' | 'startBreak' | 'endBreak' | 'end';

export interface KeyInfo {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** Focus is in a text field or select: it owns every key. */
  inTextEntry: boolean;
  /** Focus is on a button or link: it owns Space (and Enter). */
  onButton: boolean;
}

export const SHORTCUT_HELP: readonly { keys: string; does: string }[] = [
  { keys: 'Space', does: 'start, pause or resume' },
  { keys: 'B', does: 'start or end a break' },
  { keys: 'Shift + E', does: 'end the session' },
  { keys: '1–5', does: 'answer a check-in (focus, then energy)' },
  { keys: 'Esc', does: 'dismiss a nudge or skip a check-in' },
];

/** Maps a key press to a session action for the current timer phase. */
export function shortcutAction(info: KeyInfo, phase: TimerPhase): ShortcutAction | undefined {
  if (info.inTextEntry || info.ctrlKey || info.metaKey || info.altKey) return undefined;
  const key = info.key.toLowerCase();

  if (key === ' ') {
    if (info.onButton) return undefined;
    if (phase === 'idle') return 'start';
    if (phase === 'focus') return 'pause';
    if (phase === 'paused') return 'resume';
    return undefined;
  }
  if (key === 'b' && !info.shiftKey) {
    if (phase === 'focus' || phase === 'paused') return 'startBreak';
    if (phase === 'break') return 'endBreak';
    return undefined;
  }
  // Shift is required so ending a session never happens by a stray key press.
  if (key === 'e' && info.shiftKey && phase !== 'idle') return 'end';
  return undefined;
}

export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLInputElement) {
    return !['button', 'submit', 'checkbox', 'radio', 'color', 'file'].includes(target.type);
  }
  return target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

export function isButtonLike(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ['BUTTON', 'A', 'SUMMARY'].includes(target.tagName);
}
