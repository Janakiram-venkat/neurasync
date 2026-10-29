import type { CheckIn, Rating, Session, TrackingEvent, TrackingEventType } from '../src/types';

export const MIN = 60_000;
export const T0 = Date.UTC(2026, 9, 28, 9, 0, 0);

export function makeSession(overrides: Partial<Session> = {}): Session {
  return { id: 's1', startedAt: T0, plannedFocusMin: 25, plannedBreakMin: 5, ...overrides };
}

let counter = 0;
export function ev(type: TrackingEventType, atMin: number, sessionId = 's1'): TrackingEvent {
  counter += 1;
  return { id: `e${counter}`, sessionId, type, at: T0 + atMin * MIN };
}

/** A tab-leave from `fromMin` to `toMin` (minutes after T0). */
export function leave(fromMin: number, toMin: number): TrackingEvent[] {
  return [ev('tab_hidden', fromMin), ev('tab_visible', toMin)];
}

export function checkIn(atMin: number, energy?: Rating, focus?: Rating): CheckIn {
  counter += 1;
  return { id: `c${counter}`, sessionId: 's1', at: T0 + atMin * MIN, energy, focus };
}

export const at = (min: number) => T0 + min * MIN;
