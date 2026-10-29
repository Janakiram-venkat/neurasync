// Turns raw suggestions into the mode the UI shows: hysteresis plus manual override.
import type { Mode, ModeSuggestion } from '../types';

export interface DisplayState {
  mode: Mode;
  reasons: string[];
  /** A different suggestion waiting to hold for `holdMs` before it is shown. */
  pending?: { mode: Mode; since: number };
}

export const INITIAL_DISPLAY: DisplayState = {
  mode: 'break',
  reasons: ['No study session is running.'],
};

/**
 * Advances the displayed mode. A new suggestion must hold for `holdMs` before the colour changes,
 * which prevents flicker. Changes into or out of Break/Idle are immediate: they follow from the
 * user's own actions (start, pause, break, end), not from heuristics.
 */
export function advanceDisplay(
  state: DisplayState,
  suggestion: ModeSuggestion,
  now: number,
  holdMs: number,
): DisplayState {
  if (suggestion.mode === state.mode) {
    return { mode: state.mode, reasons: suggestion.reasons };
  }
  if (suggestion.mode === 'break' || state.mode === 'break') {
    return { mode: suggestion.mode, reasons: suggestion.reasons };
  }
  if (state.pending?.mode === suggestion.mode) {
    if (now - state.pending.since >= holdMs) {
      return { mode: suggestion.mode, reasons: suggestion.reasons };
    }
    return state;
  }
  return { ...state, pending: { mode: suggestion.mode, since: now } };
}

export interface ManualOverride {
  mode: Mode;
  at: number;
}

/** A manual override wins until the user clears it or the session ends. */
export function resolveShownMode(
  display: DisplayState,
  override: ManualOverride | undefined,
): { mode: Mode; reasons: string[]; source: 'engine' | 'manual' } {
  if (override) {
    return { mode: override.mode, reasons: ['You chose this mode yourself.'], source: 'manual' };
  }
  return { mode: display.mode, reasons: display.reasons, source: 'engine' };
}
