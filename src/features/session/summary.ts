// End-of-session recap. Pure: derived from the session's raw events and check-ins.
import { average } from '../dashboard/stats';
import { buildTimeline, focusLeaves, overlap, totalFocusMs } from '../../engine/timeline';
import type { CheckIn, Session, TrackingEvent } from '../../types';

export interface SessionRecap {
  focusMs: number;
  breakCount: number;
  switches: number;
  avgFocus?: number;
  avgEnergy?: number;
  /** One gentle, tentative observation, or undefined when nothing stands out. */
  observation?: string;
}

const MIN = 60_000;

export function summarizeSession(
  session: Session,
  events: readonly TrackingEvent[],
  checkIns: readonly CheckIn[],
  now: number,
): SessionRecap {
  const timeline = buildTimeline(session, events, now);
  const focusMs = totalFocusMs(timeline);
  const leaves = focusLeaves(timeline);
  const ownCheckIns = checkIns.filter((c) => c.sessionId === session.id);

  // Where in the session's focus time (not wall time) each tab-leave began.
  const leaveFocusOffsets = leaves.map((l) => overlap(timeline.active, session.startedAt, l.start));

  return {
    focusMs,
    breakCount: timeline.breaks.length,
    switches: leaves.length,
    avgFocus: average(ownCheckIns.map((c) => c.focus)),
    avgEnergy: average(ownCheckIns.map((c) => c.energy)),
    observation: observe(focusMs, timeline.breaks.length, leaveFocusOffsets),
  };
}

function observe(focusMs: number, breakCount: number, leaveOffsets: number[]): string | undefined {
  const switches = leaveOffsets.length;
  if (switches >= 3 && focusMs >= 20 * MIN) {
    const half = focusMs / 2;
    const late = leaveOffsets.filter((o) => o >= half).length;
    if (late * 3 >= switches * 2) {
      return `Most of your tab switches came after about minute ${Math.round(half / MIN)}. Attention might fade around then, so a break there could help.`;
    }
    if ((switches - late) * 3 >= switches * 2) {
      return 'Most tab switches happened early on. Looks like you settled in after that.';
    }
  }
  if (switches === 0 && focusMs >= 10 * MIN) {
    return 'No tab switches this session. Looks like a steady one.';
  }
  if (breakCount === 0 && focusMs > 50 * MIN) {
    return 'This was a long stretch without a break. A short pause might help next time.';
  }
  return undefined;
}
