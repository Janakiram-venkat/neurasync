import { buildTimeline, overlap } from '../../engine/timeline';
import type { Session, TrackingEvent } from '../../types';

export type TimerPhase = 'idle' | 'focus' | 'paused' | 'break';

export interface TimerView {
  phase: TimerPhase;
  /** Time left in the current focus block or break; negative once it runs over. */
  remainingMs: number;
  plannedMs: number;
}

export function computeTimer(
  session: Session | undefined,
  events: readonly TrackingEvent[],
  now: number,
): TimerView {
  if (!session || session.endedAt !== undefined) {
    return { phase: 'idle', remainingMs: 0, plannedMs: 0 };
  }
  const timeline = buildTimeline(session, events, now);
  if (timeline.isOnBreak && timeline.breakStartedAt !== undefined) {
    const plannedMs = session.plannedBreakMin * 60_000;
    return { phase: 'break', remainingMs: plannedMs - (now - timeline.breakStartedAt), plannedMs };
  }
  const plannedMs = session.plannedFocusMin * 60_000;
  const focused = overlap(timeline.active, timeline.focusStretchStart, now);
  return {
    phase: timeline.isPaused ? 'paused' : 'focus',
    remainingMs: plannedMs - focused,
    plannedMs,
  };
}

/** Formats a duration as m:ss, with a leading "+" for overtime. */
export function formatClock(ms: number): string {
  const sign = ms < 0 ? '+' : '';
  const total = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`;
}
