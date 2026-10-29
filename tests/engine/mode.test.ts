import { describe, expect, it } from 'vitest';
import { DEFAULT_ENGINE_CONFIG as config, suggestMode } from '../../src/engine';
import { at, checkIn, ev, leave, makeSession } from '../helpers';

const session = makeSession();

describe('suggestMode: Break / Idle', () => {
  it('is break with no session', () => {
    expect(suggestMode([], [], at(5), config, undefined).mode).toBe('break');
  });

  it('is break once the session has ended', () => {
    const ended = makeSession({ endedAt: at(30) });
    expect(suggestMode([], [], at(31), config, ended).mode).toBe('break');
  });

  it('is break during a break, even with fatigue signals', () => {
    const events = [ev('break_start', 55)];
    const result = suggestMode(events, [checkIn(54, 1)], at(56), config, session);
    expect(result).toEqual({ mode: 'break', reasons: ['You are on a break.'] });
  });

  it('is break while paused', () => {
    expect(suggestMode([ev('pause', 3)], [], at(4), config, session).mode).toBe('break');
  });

  it('returns to productive after resume', () => {
    const events = [ev('pause', 3), ev('resume', 4)];
    expect(suggestMode(events, [], at(5), config, session).mode).toBe('productive');
  });
});

describe('suggestMode: Productive', () => {
  it('is productive right at session start', () => {
    const result = suggestMode([], [], at(0), config, session);
    expect(result.mode).toBe('productive');
    expect(result.reasons).toHaveLength(1);
  });

  it('stays productive with two short leaves in 10 minutes', () => {
    const events = [...leave(1, 1.2), ...leave(4, 4.2)];
    expect(suggestMode(events, [], at(6), config, session).mode).toBe('productive');
  });

  it('ignores events from other sessions', () => {
    const events = [
      ev('tab_hidden', 1, 'other'),
      ev('tab_hidden', 2, 'other'),
      ev('tab_hidden', 3, 'other'),
    ];
    expect(suggestMode(events, [], at(4), config, session).mode).toBe('productive');
  });
});

describe('suggestMode: Distraction', () => {
  it('triggers on 3 tab-leaves in the last 10 minutes and explains why', () => {
    const events = [...leave(1, 1.1), ...leave(3, 3.1), ...leave(5, 5.1)];
    const result = suggestMode(events, [], at(6), config, session);
    expect(result.mode).toBe('distraction');
    expect(result.reasons).toEqual(['You left the study tab 3 times in the last 10 minutes.']);
  });

  it('drops out once leaves age past the 10-minute window', () => {
    const events = [...leave(1, 1.1), ...leave(3, 3.1), ...leave(5, 5.1)];
    expect(suggestMode(events, [], at(11.5), config, session).mode).toBe('productive');
  });

  it('triggers on a single leave longer than 2 minutes', () => {
    const result = suggestMode(leave(2, 5), [], at(6), config, session);
    expect(result.mode).toBe('distraction');
    expect(result.reasons).toEqual(['One recent tab-leave lasted 3 minutes.']);
  });

  it('does not trigger on a leave of exactly 2 minutes', () => {
    expect(suggestMode(leave(2, 4), [], at(6), config, session).mode).toBe('productive');
  });

  it('counts an ongoing leave up to now', () => {
    const result = suggestMode([ev('tab_hidden', 2)], [], at(4.5), config, session);
    expect(result.mode).toBe('distraction');
  });

  it('does not count leaves that happen during a break', () => {
    const events = [
      ev('break_start', 1),
      ...leave(1.5, 1.6),
      ...leave(2, 2.1),
      ...leave(3, 5.5),
      ev('break_end', 6),
    ];
    expect(suggestMode(events, [], at(7), config, session).mode).toBe('productive');
  });

  it('does not count time paused against a long leave', () => {
    const events = [ev('tab_hidden', 1), ev('pause', 1.5), ev('resume', 5), ev('tab_visible', 5.5)];
    expect(suggestMode(events, [], at(6), config, session).mode).toBe('productive');
  });
});

describe('suggestMode: Fatigue', () => {
  it('triggers after more than 50 minutes of focus without a break', () => {
    const result = suggestMode([], [], at(51), config, session);
    expect(result.mode).toBe('fatigue');
    expect(result.reasons[0]).toBe('You have focused for 51 minutes without a break.');
  });

  it('does not trigger at exactly 50 minutes', () => {
    expect(suggestMode([], [], at(50), config, session).mode).toBe('productive');
  });

  it('excludes paused time from continuous focus', () => {
    const events = [ev('pause', 20), ev('resume', 30)];
    expect(suggestMode(events, [], at(55), config, session).mode).toBe('productive');
  });

  it('resets continuous focus after a break', () => {
    const events = [ev('break_start', 45), ev('break_end', 50)];
    expect(suggestMode(events, [], at(80), config, session).mode).toBe('productive');
  });

  it('triggers on latest check-in energy <= 2', () => {
    const result = suggestMode([], [checkIn(10, 4), checkIn(20, 2)], at(21), config, session);
    expect(result.mode).toBe('fatigue');
    expect(result.reasons).toEqual(['Your last check-in rated energy 2 out of 5.']);
  });

  it('uses only the latest check-in that has an energy rating', () => {
    const checkIns = [checkIn(10, 1), checkIn(20, 4), checkIn(25)];
    expect(suggestMode([], checkIns, at(26), config, session).mode).toBe('productive');
  });

  it('clears low energy after a break', () => {
    const events = [ev('break_start', 21), ev('break_end', 26)];
    expect(suggestMode(events, [checkIn(20, 1)], at(27), config, session).mode).toBe('productive');
  });

  it('triggers when the switch rate doubles, once the session is 30+ minutes long', () => {
    const events = [...leave(2, 2.1), ...leave(20, 20.1), ...leave(25, 25.1)];
    const result = suggestMode(events, [], at(30), config, session);
    expect(result.mode).toBe('fatigue');
    expect(result.reasons).toEqual([
      'Tab switching has picked up: 2 in the last 15 minutes vs 1 in the first 15.',
    ]);
  });

  it('does not apply the switch-rate rule before 30 minutes', () => {
    const events = [...leave(2, 2.1), ...leave(20, 20.1), ...leave(25, 25.1)];
    expect(suggestMode(events, [], at(29), config, session).mode).toBe('productive');
  });

  it('needs at least 2 recent switches when the early window had none', () => {
    expect(suggestMode(leave(25, 25.1), [], at(30), config, session).mode).toBe('productive');
    const events = [...leave(20, 20.1), ...leave(25, 25.1)];
    expect(suggestMode(events, [], at(30), config, session).mode).toBe('fatigue');
  });

  it('takes priority over distraction', () => {
    const events = [...leave(48, 48.1), ...leave(49, 49.1), ...leave(50, 50.1)];
    const result = suggestMode(events, [], at(51), config, session);
    expect(result.mode).toBe('fatigue');
  });

  it('respects user-adjusted thresholds', () => {
    const custom = { ...config, maxContinuousFocusMs: 30 * 60_000 };
    expect(suggestMode([], [], at(31), custom, session).mode).toBe('fatigue');
  });
});
