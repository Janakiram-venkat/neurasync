// Derives a session timeline from raw events. Pure: no React, no DOM, no storage.
import type { Session, TrackingEvent } from '../types';

export interface Interval {
  start: number;
  end: number;
}

export interface SessionTimeline {
  /** Focus time: not paused and not on a break. */
  active: Interval[];
  breaks: Interval[];
  /** Periods the study tab was hidden; an open leave ends at the timeline's end. */
  leaves: Interval[];
  isPaused: boolean;
  isOnBreak: boolean;
  /** Start of the current focus stretch: end of the last break, or session start. */
  focusStretchStart: number;
  /** When the current break (if any) started. */
  breakStartedAt?: number;
  end: number;
}

export function sortByTime<T extends { at: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.at - b.at);
}

export function buildTimeline(
  session: Session,
  events: readonly TrackingEvent[],
  now: number,
): SessionTimeline {
  const end = Math.max(session.startedAt, session.endedAt ?? now);
  const active: Interval[] = [];
  const breaks: Interval[] = [];
  const leaves: Interval[] = [];

  let paused = false;
  let onBreak = false;
  let activeSince: number | undefined = session.startedAt;
  let breakSince: number | undefined;
  let hiddenSince: number | undefined;
  let focusStretchStart = session.startedAt;

  const sync = (at: number) => {
    const isActive = !paused && !onBreak;
    if (isActive && activeSince === undefined) activeSince = at;
    if (!isActive && activeSince !== undefined) {
      if (at > activeSince) active.push({ start: activeSince, end: at });
      activeSince = undefined;
    }
  };

  for (const event of sortByTime(events)) {
    if (event.sessionId !== session.id) continue;
    const at = Math.min(Math.max(event.at, session.startedAt), end);
    switch (event.type) {
      case 'pause':
        paused = true;
        break;
      case 'resume':
        paused = false;
        break;
      case 'break_start':
        if (!onBreak) breakSince = at;
        onBreak = true;
        paused = false;
        break;
      case 'break_end':
        if (onBreak && breakSince !== undefined) breaks.push({ start: breakSince, end: at });
        onBreak = false;
        breakSince = undefined;
        paused = false;
        focusStretchStart = at;
        break;
      case 'tab_hidden':
        hiddenSince ??= at;
        break;
      case 'tab_visible':
        if (hiddenSince !== undefined) leaves.push({ start: hiddenSince, end: at });
        hiddenSince = undefined;
        break;
    }
    sync(at);
  }

  if (activeSince !== undefined && end > activeSince) active.push({ start: activeSince, end });
  if (onBreak && breakSince !== undefined) breaks.push({ start: breakSince, end });
  if (hiddenSince !== undefined) leaves.push({ start: hiddenSince, end });

  return {
    active,
    breaks,
    leaves,
    isPaused: paused,
    isOnBreak: onBreak,
    focusStretchStart,
    breakStartedAt: onBreak ? breakSince : undefined,
    end,
  };
}

/** Total length of `intervals` that falls inside [from, to). */
export function overlap(intervals: readonly Interval[], from: number, to: number): number {
  let total = 0;
  for (const { start, end } of intervals) {
    const s = Math.max(start, from);
    const e = Math.min(end, to);
    if (e > s) total += e - s;
  }
  return total;
}

export function isWithin(intervals: readonly Interval[], at: number): boolean {
  return intervals.some(({ start, end }) => at >= start && at <= end);
}

/** Tab-leaves that began during focus time (leaves during breaks or pauses don't count). */
export function focusLeaves(timeline: SessionTimeline): Interval[] {
  return timeline.leaves.filter((leave) => isWithin(timeline.active, leave.start));
}

export function totalFocusMs(timeline: SessionTimeline): number {
  return overlap(timeline.active, -Infinity, Infinity);
}
