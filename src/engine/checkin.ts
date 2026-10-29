import type { CheckIn, Session, TrackingEvent } from '../types';
import { MIN_CHECK_IN_INTERVAL_MS } from './config';
import { buildTimeline } from './timeline';

/**
 * A check-in is due during focus time once `intervalMs` (never less than 20 minutes) has passed
 * since the last check-in, answered or skipped, the session start, or the end of the last break.
 */
export function isCheckInDue(
  session: Session | undefined,
  events: readonly TrackingEvent[],
  checkIns: readonly CheckIn[],
  now: number,
  intervalMs: number,
): boolean {
  if (!session || session.endedAt !== undefined) return false;
  const timeline = buildTimeline(session, events, now);
  if (timeline.isPaused || timeline.isOnBreak) return false;

  const lastCheckIn = checkIns
    .filter((c) => c.sessionId === session.id && c.at <= now)
    .reduce((latest, c) => Math.max(latest, c.at), -Infinity);
  const since = Math.max(lastCheckIn, timeline.focusStretchStart);
  return now - since >= Math.max(intervalMs, MIN_CHECK_IN_INTERVAL_MS);
}
