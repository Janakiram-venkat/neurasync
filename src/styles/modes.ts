import type { Mode } from '../types';

export const MODES: readonly Mode[] = ['productive', 'distraction', 'fatigue', 'break'];

export const DEFAULT_MODE_COLOURS: Record<Mode, string> = {
  productive: '#1E40AF',
  distraction: '#DB2777',
  fatigue: '#D97706',
  break: '#0D9488',
};

export const MODE_LABELS: Record<Mode, string> = {
  productive: 'Productive',
  distraction: 'Distraction',
  fatigue: 'Fatigue',
  break: 'Break / Idle',
};

export const MODE_DESCRIPTIONS: Record<Mode, string> = {
  productive: 'Looks like you are settled in.',
  distraction: 'Attention might be drifting a little.',
  fatigue: 'A break or a reset might help.',
  break: 'Resting, or no session running.',
};

/** Writes the mode colours as CSS variables (`--mode-productive`, ...) on the root element. */
export function applyModeColours(colours: Record<Mode, string>, root: HTMLElement): void {
  for (const mode of MODES) root.style.setProperty(`--mode-${mode}`, colours[mode]);
}
