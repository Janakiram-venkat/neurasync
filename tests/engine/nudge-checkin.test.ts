import { describe, expect, it } from 'vitest';
import {
  canNudge,
  DEFAULT_NUDGE_CONFIG as nudges,
  isCheckInDue,
  nudgeContent,
} from '../../src/engine';
import { at, checkIn, ev, makeSession, MIN } from '../helpers';

describe('canNudge', () => {
  it('never nudges for productive or break', () => {
    expect(canNudge('productive', {}, 0, nudges)).toBe(false);
    expect(canNudge('break', {}, 0, nudges)).toBe(false);
  });

  it('nudges for distraction and fatigue when nothing recent', () => {
    expect(canNudge('distraction', {}, 0, nudges)).toBe(true);
    expect(canNudge('fatigue', {}, 0, nudges)).toBe(true);
  });

  it('allows at most one nudge every 10 minutes', () => {
    expect(canNudge('fatigue', { lastNudgeAt: 0 }, 9 * MIN, nudges)).toBe(false);
    expect(canNudge('fatigue', { lastNudgeAt: 0 }, 10 * MIN, nudges)).toBe(true);
  });

  it('respects snooze and the enabled switch', () => {
    expect(canNudge('fatigue', { snoozedUntil: 5 * MIN }, 4 * MIN, nudges)).toBe(false);
    expect(canNudge('fatigue', { snoozedUntil: 5 * MIN }, 5 * MIN, nudges)).toBe(true);
    expect(canNudge('fatigue', {}, 0, { ...nudges, enabled: false })).toBe(false);
  });

  it('uses tentative language and carries the reasons', () => {
    for (const mode of ['distraction', 'fatigue'] as const) {
      const content = nudgeContent(mode, ['because']);
      expect(content.reasons).toEqual(['because']);
      expect(`${content.title} ${content.body}`).not.toMatch(
        /detected|diagnos|your brain|you are tired/i,
      );
    }
  });
});

describe('isCheckInDue', () => {
  const session = makeSession();
  const interval = 20 * MIN;

  it('is not due without an active session', () => {
    expect(isCheckInDue(undefined, [], [], at(30), interval)).toBe(false);
    expect(isCheckInDue(makeSession({ endedAt: at(25) }), [], [], at(30), interval)).toBe(false);
  });

  it('is due 20 minutes after session start', () => {
    expect(isCheckInDue(session, [], [], at(19), interval)).toBe(false);
    expect(isCheckInDue(session, [], [], at(20), interval)).toBe(true);
  });

  it('waits 20 minutes after the last check-in, even a skipped one', () => {
    expect(isCheckInDue(session, [], [checkIn(20)], at(39), interval)).toBe(false);
    expect(isCheckInDue(session, [], [checkIn(20)], at(40), interval)).toBe(true);
  });

  it('is never due during a break or pause', () => {
    expect(isCheckInDue(session, [ev('break_start', 19)], [], at(30), interval)).toBe(false);
    expect(isCheckInDue(session, [ev('pause', 19)], [], at(30), interval)).toBe(false);
  });

  it('restarts the clock after a break', () => {
    const events = [ev('break_start', 15), ev('break_end', 20)];
    expect(isCheckInDue(session, events, [], at(30), interval)).toBe(false);
    expect(isCheckInDue(session, events, [], at(40), interval)).toBe(true);
  });

  it('never asks more often than every 20 minutes, whatever the setting', () => {
    expect(isCheckInDue(session, [], [], at(10), 5 * MIN)).toBe(false);
  });
});
