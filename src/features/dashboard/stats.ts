// Pure summaries for the dashboard. Everything is derived from raw sessions, events and check-ins.
import { buildTimeline, focusLeaves, totalFocusMs } from '../../engine/timeline';
import type { CheckIn, Session, TrackingEvent } from '../../types';

export interface SessionSummary {
  id: string;
  startedAt: number;
  focusMs: number;
  switches: number;
}

export interface DayStat {
  /** Local midnight of the day, epoch ms. */
  day: number;
  sessions: number;
  focusMin: number;
  avgFocus?: number;
  avgEnergy?: number;
}

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

export interface BestTime {
  part: DayPart;
  basis: 'check-ins' | 'switches';
  detail: string;
}

export const DAY_PART_LABELS: Record<DayPart, string> = {
  morning: 'Mornings (5am–12pm)',
  afternoon: 'Afternoons (12–5pm)',
  evening: 'Evenings (5–10pm)',
  night: 'Late nights (10pm–5am)',
};

export function dayPartOf(at: number): DayPart {
  const hour = new Date(at).getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function summarizeSessions(
  sessions: readonly Session[],
  events: readonly TrackingEvent[],
  now: number,
): SessionSummary[] {
  const bySession = groupBy(events, (e) => e.sessionId);
  return sessions.map((session) => {
    const timeline = buildTimeline(session, bySession.get(session.id) ?? [], now);
    return {
      id: session.id,
      startedAt: session.startedAt,
      focusMs: totalFocusMs(timeline),
      switches: focusLeaves(timeline).length,
    };
  });
}

export function dailyStats(
  summaries: readonly SessionSummary[],
  checkIns: readonly CheckIn[],
  days: number,
  now: number,
): DayStat[] {
  const today = startOfDay(now);
  const result: DayStat[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day = d.getTime();
    const daySessions = summaries.filter((s) => startOfDay(s.startedAt) === day);
    const dayCheckIns = checkIns.filter((c) => startOfDay(c.at) === day);
    result.push({
      day,
      sessions: daySessions.length,
      focusMin: Math.round(daySessions.reduce((sum, s) => sum + s.focusMs, 0) / 60_000),
      avgFocus: average(dayCheckIns.map((c) => c.focus)),
      avgEnergy: average(dayCheckIns.map((c) => c.energy)),
    });
  }
  return result;
}

const MIN_RATED_CHECK_INS = 2;
const MIN_FOCUS_MS_PER_PART = 20 * 60_000;

/**
 * Suggests the part of day that tends to go best. Prefers self-reported focus (at least two
 * day-parts with two rated check-ins each); otherwise the fewest tab switches per focus hour.
 * Returns undefined when there isn't enough data to say anything honest.
 */
export function bestTimeOfDay(
  summaries: readonly SessionSummary[],
  checkIns: readonly CheckIn[],
): BestTime | undefined {
  const ratingsByPart = groupBy(
    checkIns.filter((c) => c.focus !== undefined),
    (c) => dayPartOf(c.at),
  );
  const rated = [...ratingsByPart.entries()]
    .filter(([, list]) => list.length >= MIN_RATED_CHECK_INS)
    .map(([part, list]) => ({ part, avg: average(list.map((c) => c.focus)) ?? 0, n: list.length }));
  if (rated.length >= 2) {
    const best = rated.reduce((a, b) => (b.avg > a.avg ? b : a));
    return {
      part: best.part,
      basis: 'check-ins',
      detail: `Average focus rating ${best.avg.toFixed(1)} of 5 across ${best.n} check-ins.`,
    };
  }

  const sessionsByPart = groupBy(summaries, (s) => dayPartOf(s.startedAt));
  const rates = [...sessionsByPart.entries()]
    .map(([part, list]) => {
      const focusMs = list.reduce((sum, s) => sum + s.focusMs, 0);
      const switches = list.reduce((sum, s) => sum + s.switches, 0);
      return { part, focusMs, perHour: switches / (focusMs / 3_600_000) };
    })
    .filter((r) => r.focusMs >= MIN_FOCUS_MS_PER_PART);
  if (rates.length >= 2) {
    const best = rates.reduce((a, b) => (b.perHour < a.perHour ? b : a));
    return {
      part: best.part,
      basis: 'switches',
      detail: `About ${best.perHour.toFixed(1)} tab switches per focus hour, the fewest of any time of day.`,
    };
  }
  return undefined;
}

export interface GoalStats {
  set: number;
  done: number;
  partly: number;
}

export function goalStats(sessions: readonly Session[]): GoalStats {
  const withGoal = sessions.filter((s) => s.goal);
  return {
    set: withGoal.length,
    done: withGoal.filter((s) => s.goalOutcome === 'done').length,
    partly: withGoal.filter((s) => s.goalOutcome === 'partly').length,
  };
}

export function average(values: readonly (number | undefined)[]): number | undefined {
  const defined = values.filter((v): v is number => v !== undefined);
  if (defined.length === 0) return undefined;
  return defined.reduce((a, b) => a + b, 0) / defined.length;
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
