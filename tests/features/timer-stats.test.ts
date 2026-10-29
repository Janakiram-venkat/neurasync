import { describe, expect, it } from 'vitest';
import {
  bestTimeOfDay,
  dailyStats,
  dayPartOf,
  summarizeSessions,
} from '../../src/features/dashboard/stats';
import { computeTimer, formatClock } from '../../src/features/session/timer';
import type { CheckIn, Session } from '../../src/types';
import { at, ev, leave, makeSession, MIN } from '../helpers';

describe('computeTimer', () => {
  const session = makeSession();

  it('is idle without a session', () => {
    expect(computeTimer(undefined, [], at(0)).phase).toBe('idle');
  });

  it('counts down the focus block', () => {
    expect(computeTimer(session, [], at(10))).toMatchObject({
      phase: 'focus',
      remainingMs: 15 * MIN,
    });
  });

  it('freezes while paused', () => {
    const view = computeTimer(session, [ev('pause', 10)], at(20));
    expect(view).toMatchObject({ phase: 'paused', remainingMs: 15 * MIN });
  });

  it('counts down the break and then a fresh focus block', () => {
    const events = [ev('break_start', 25), ev('break_end', 30)];
    expect(computeTimer(session, events.slice(0, 1), at(27))).toMatchObject({
      phase: 'break',
      remainingMs: 3 * MIN,
    });
    expect(computeTimer(session, events, at(35))).toMatchObject({
      phase: 'focus',
      remainingMs: 20 * MIN,
    });
  });

  it('goes negative on overtime', () => {
    expect(computeTimer(session, [], at(27)).remainingMs).toBe(-2 * MIN);
    expect(formatClock(-2 * MIN)).toBe('+2:00');
    expect(formatClock(25 * MIN)).toBe('25:00');
    expect(formatClock(61_500)).toBe('1:01');
  });
});

const local = (h: number, m = 0, dayOffset = 0) =>
  new Date(2026, 9, 20 + dayOffset, h, m).getTime();

describe('dashboard stats', () => {
  it('summarises focus time and switches per session', () => {
    const [summary] = summarizeSessions(
      [makeSession({ endedAt: at(30) })],
      [...leave(5, 6), ev('break_start', 20), ...leave(21, 22), ev('break_end', 25)],
      at(60),
    );
    expect(summary).toMatchObject({ focusMs: 25 * MIN, switches: 1 });
  });

  it('builds per-day stats ending today', () => {
    const now = local(18, 0, 1);
    const sessions = [
      makeSession({ id: 'a', startedAt: local(9), endedAt: local(9, 30) }),
      makeSession({ id: 'b', startedAt: local(10, 0, 1), endedAt: local(10, 20, 1) }),
    ];
    const checkIns: CheckIn[] = [
      { id: 'c1', sessionId: 'b', at: local(10, 10, 1), focus: 4, energy: 2 },
      { id: 'c2', sessionId: 'b', at: local(10, 15, 1), focus: 2 },
    ];
    const days = dailyStats(summarizeSessions(sessions, [], now), checkIns, 3, now);
    expect(days.map((d) => d.sessions)).toEqual([0, 1, 1]);
    expect(days.map((d) => d.focusMin)).toEqual([0, 30, 20]);
    expect(days[2]).toMatchObject({ avgFocus: 3, avgEnergy: 2 });
    expect(days[1]?.avgFocus).toBeUndefined();
  });

  it('maps hours to parts of the day', () => {
    expect(dayPartOf(local(5))).toBe('morning');
    expect(dayPartOf(local(12))).toBe('afternoon');
    expect(dayPartOf(local(21, 59))).toBe('evening');
    expect(dayPartOf(local(23))).toBe('night');
  });

  it('prefers check-in ratings for best time of day', () => {
    const c = (id: string, h: number, focus: 1 | 2 | 3 | 4 | 5): CheckIn => ({
      id,
      sessionId: 's',
      at: local(h),
      focus,
    });
    const best = bestTimeOfDay([], [c('1', 9, 5), c('2', 10, 4), c('3', 14, 2), c('4', 15, 3)]);
    expect(best).toMatchObject({ part: 'morning', basis: 'check-ins' });
  });

  it('falls back to fewest switches per focus hour', () => {
    const s = (id: string, h: number): Session =>
      makeSession({ id, startedAt: local(h), endedAt: local(h) + 30 * MIN });
    const summaries = summarizeSessions([s('m', 9), s('e', 19)], [], local(23)).map((x) => ({
      ...x,
      switches: x.id === 'm' ? 6 : 1,
    }));
    expect(bestTimeOfDay(summaries, [])).toMatchObject({ part: 'evening', basis: 'switches' });
  });

  it('says nothing without enough data', () => {
    expect(bestTimeOfDay([], [])).toBeUndefined();
  });
});
