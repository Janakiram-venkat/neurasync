// v1 mode heuristics. Pure and explainable: every suggestion carries the reasons behind it.
// Rules and thresholds are documented in CLAUDE.md ("Mode logic") and src/engine/config.ts.
import type { CheckIn, EngineConfig, ModeSuggestion, Session, TrackingEvent } from '../types';
import { buildTimeline, focusLeaves, overlap, sortByTime, type SessionTimeline } from './timeline';

export function formatMinutes(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'under a minute';
  return min === 1 ? '1 minute' : `${min} minutes`;
}

function times(n: number): string {
  return n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
}

/**
 * Suggests a study mode from raw events.
 * `session` is the session being evaluated; with none (or an ended one) the mode is Break/Idle.
 */
export function suggestMode(
  events: readonly TrackingEvent[],
  checkIns: readonly CheckIn[],
  now: number,
  config: EngineConfig,
  session: Session | undefined,
): ModeSuggestion {
  if (!session || session.endedAt !== undefined) {
    return { mode: 'break', reasons: ['No study session is running.'] };
  }

  const timeline = buildTimeline(session, events, now);
  if (timeline.isOnBreak) return { mode: 'break', reasons: ['You are on a break.'] };
  if (timeline.isPaused) return { mode: 'break', reasons: ['The session is paused.'] };

  const fatigue = fatigueReasons(session, timeline, checkIns, now, config);
  if (fatigue.length > 0) return { mode: 'fatigue', reasons: fatigue };

  const distraction = distractionReasons(timeline, now, config);
  if (distraction.length > 0) return { mode: 'distraction', reasons: distraction };

  return {
    mode: 'productive',
    reasons: ['Session running and you have mostly stayed on this tab.'],
  };
}

export function distractionReasons(
  timeline: SessionTimeline,
  now: number,
  config: EngineConfig,
): string[] {
  const reasons: string[] = [];
  const windowStart = now - config.distractionWindowMs;
  const leaves = focusLeaves(timeline);
  const windowMin = Math.round(config.distractionWindowMs / 60_000);

  const recent = leaves.filter((l) => l.start > windowStart && l.start <= now).length;
  if (recent >= config.distractionLeaveCount) {
    reasons.push(`You left the study tab ${times(recent)} in the last ${windowMin} minutes.`);
  }

  const longest = leaves
    .filter((l) => l.end > windowStart)
    .map((l) => overlap(timeline.active, l.start, l.end))
    .reduce((max, d) => Math.max(max, d), 0);
  if (longest > config.longLeaveMs) {
    reasons.push(`One recent tab-leave lasted ${formatMinutes(longest)}.`);
  }

  return reasons;
}

export function fatigueReasons(
  session: Session,
  timeline: SessionTimeline,
  checkIns: readonly CheckIn[],
  now: number,
  config: EngineConfig,
): string[] {
  const reasons: string[] = [];

  const stretch = overlap(timeline.active, timeline.focusStretchStart, now);
  if (stretch > config.maxContinuousFocusMs) {
    reasons.push(`You have focused for ${formatMinutes(stretch)} without a break.`);
  }

  // A break resets the energy signal: only check-ins since the current focus stretch count.
  const latestEnergy = sortByTime(
    checkIns.filter(
      (c) =>
        c.sessionId === session.id &&
        c.energy !== undefined &&
        c.at >= timeline.focusStretchStart &&
        c.at <= now,
    ),
  ).at(-1);
  if (latestEnergy?.energy !== undefined && latestEnergy.energy <= config.lowEnergyThreshold) {
    reasons.push(`Your last check-in rated energy ${latestEnergy.energy} out of 5.`);
  }

  if (now - session.startedAt >= config.switchRateMinSessionMs) {
    const w = config.switchRateWindowMs;
    const leaves = focusLeaves(timeline);
    const early = leaves.filter((l) => l.start < session.startedAt + w).length;
    const recent = leaves.filter((l) => l.start > now - w && l.start <= now).length;
    // With no early switches, treat the baseline as 1 so a couple of switches don't trip it.
    if (recent > 0 && recent >= config.switchRateMultiplier * Math.max(early, 1)) {
      const windowMin = Math.round(w / 60_000);
      reasons.push(
        `Tab switching has picked up: ${recent} in the last ${windowMin} minutes vs ${early} in the first ${windowMin}.`,
      );
    }
  }

  return reasons;
}
