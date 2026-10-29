import { describe, expect, it } from 'vitest';
import {
  advanceDisplay,
  INITIAL_DISPLAY,
  resolveShownMode,
  type DisplayState,
} from '../../src/engine';

const HOLD = 60_000;
const productive: DisplayState = { mode: 'productive', reasons: ['ok'] };
const distraction = { mode: 'distraction' as const, reasons: ['3 leaves'] };

describe('advanceDisplay (hysteresis)', () => {
  it('switches out of break immediately when a session starts', () => {
    const next = advanceDisplay(INITIAL_DISPLAY, { mode: 'productive', reasons: ['ok'] }, 0, HOLD);
    expect(next.mode).toBe('productive');
  });

  it('switches into break immediately', () => {
    const next = advanceDisplay(productive, { mode: 'break', reasons: ['paused'] }, 0, HOLD);
    expect(next.mode).toBe('break');
  });

  it('holds a new suggestion for 60 seconds before changing colour', () => {
    let state = advanceDisplay(productive, distraction, 0, HOLD);
    expect(state.mode).toBe('productive');
    expect(state.pending).toEqual({ mode: 'distraction', since: 0 });

    state = advanceDisplay(state, distraction, 59_999, HOLD);
    expect(state.mode).toBe('productive');

    state = advanceDisplay(state, distraction, 60_000, HOLD);
    expect(state).toEqual({ mode: 'distraction', reasons: ['3 leaves'] });
  });

  it('drops a pending change if the suggestion flips back (no flicker)', () => {
    let state = advanceDisplay(productive, distraction, 0, HOLD);
    state = advanceDisplay(state, { mode: 'productive', reasons: ['ok'] }, 30_000, HOLD);
    expect(state.pending).toBeUndefined();
    state = advanceDisplay(state, distraction, 40_000, HOLD);
    state = advanceDisplay(state, distraction, 90_000, HOLD);
    expect(state.mode).toBe('productive');
  });

  it('restarts the hold when a different non-break suggestion appears', () => {
    let state = advanceDisplay(productive, distraction, 0, HOLD);
    state = advanceDisplay(state, { mode: 'fatigue', reasons: ['tired'] }, 30_000, HOLD);
    expect(state.pending).toEqual({ mode: 'fatigue', since: 30_000 });
  });
});

describe('resolveShownMode (manual override)', () => {
  it('uses the engine mode without an override', () => {
    expect(resolveShownMode(productive, undefined)).toEqual({
      mode: 'productive',
      reasons: ['ok'],
      source: 'engine',
    });
  });

  it('lets a manual override win', () => {
    const shown = resolveShownMode(productive, { mode: 'fatigue', at: 0 });
    expect(shown.mode).toBe('fatigue');
    expect(shown.source).toBe('manual');
  });
});
