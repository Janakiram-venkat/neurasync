import { describe, expect, it } from 'vitest';
import { parseExport } from '../../src/db/validate';
import { goalStats } from '../../src/features/dashboard/stats';
import { buildModeSegments } from '../../src/features/session/modeSegments';
import { shortcutAction, type KeyInfo } from '../../src/features/session/shortcuts';
import { summarizeSession } from '../../src/features/session/summary';
import { DEFAULT_SETTINGS, withDefaults } from '../../src/features/settings/defaults';
import type { Mode, ModeChange } from '../../src/types';
import { at, checkIn, ev, leave, makeSession, MIN } from '../helpers';

describe('summarizeSession', () => {
  it('counts focus time, breaks, switches and check-in averages', () => {
    const session = makeSession({ endedAt: at(40) });
    const events = [...leave(5, 6), ev('break_start', 25), ev('break_end', 30)];
    const recap = summarizeSession(session, events, [checkIn(10, 4, 3), checkIn(20, 2, 5)], at(40));
    expect(recap).toMatchObject({
      focusMs: 35 * MIN,
      breakCount: 1,
      switches: 1,
      avgFocus: 4,
      avgEnergy: 3,
    });
  });

  it('notices when most switches came late', () => {
    const session = makeSession({ endedAt: at(40) });
    const events = [...leave(5, 5.1), ...leave(25, 25.1), ...leave(30, 30.1), ...leave(35, 35.1)];
    const recap = summarizeSession(session, events, [], at(40));
    expect(recap.observation).toMatch(/after about minute 20/);
  });

  it('notices when switches settled down after the start', () => {
    const session = makeSession({ endedAt: at(40) });
    const events = [...leave(2, 2.1), ...leave(4, 4.1), ...leave(6, 6.1)];
    expect(summarizeSession(session, events, [], at(40)).observation).toMatch(/settled in/);
  });

  it('praises nothing and stays quiet for short, unremarkable sessions', () => {
    const session = makeSession({ endedAt: at(5) });
    expect(summarizeSession(session, leave(1, 1.1), [], at(5)).observation).toBeUndefined();
  });

  it('mentions a long stretch without a break', () => {
    const session = makeSession({ endedAt: at(60) });
    const recap = summarizeSession(session, [...leave(10, 10.1)], [], at(60));
    expect(recap.observation).toMatch(/long stretch without a break/);
  });
});

describe('buildModeSegments', () => {
  const change = (
    atMin: number,
    mode: Mode,
    source: 'engine' | 'manual' = 'engine',
  ): ModeChange => ({
    id: `${atMin}-${mode}`,
    sessionId: 's1',
    at: at(atMin),
    mode,
    source,
    reasons: [`${mode} reason`],
  });

  it('builds contiguous segments from session start to the end', () => {
    const session = makeSession({ endedAt: at(30) });
    const segs = buildModeSegments(
      session,
      [change(0, 'productive'), change(10, 'distraction'), change(20, 'productive')],
      at(99),
    );
    expect(segs.map((s) => [s.mode, (s.start - at(0)) / MIN, (s.end - at(0)) / MIN])).toEqual([
      ['productive', 0, 10],
      ['distraction', 10, 20],
      ['productive', 20, 30],
    ]);
  });

  it('merges repeated entries and keeps manual overrides distinct', () => {
    const session = makeSession();
    const segs = buildModeSegments(
      session,
      [change(0, 'productive'), change(5, 'productive'), change(10, 'productive', 'manual')],
      at(15),
    );
    expect(segs.map((s) => [s.mode, s.source])).toEqual([
      ['productive', 'engine'],
      ['productive', 'manual'],
    ]);
  });

  it('ignores other sessions and returns nothing without changes', () => {
    const session = makeSession();
    expect(
      buildModeSegments(session, [{ ...change(1, 'fatigue'), sessionId: 'x' }], at(5)),
    ).toEqual([]);
  });
});

describe('shortcutAction', () => {
  const key = (k: string, extra: Partial<KeyInfo> = {}): KeyInfo => ({
    key: k,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    inTextEntry: false,
    onButton: false,
    ...extra,
  });

  it('uses Space to start, pause and resume', () => {
    expect(shortcutAction(key(' '), 'idle')).toBe('start');
    expect(shortcutAction(key(' '), 'focus')).toBe('pause');
    expect(shortcutAction(key(' '), 'paused')).toBe('resume');
    expect(shortcutAction(key(' '), 'break')).toBeUndefined();
  });

  it('toggles breaks with B', () => {
    expect(shortcutAction(key('b'), 'focus')).toBe('startBreak');
    expect(shortcutAction(key('B'), 'break')).toBe('endBreak');
    expect(shortcutAction(key('b'), 'idle')).toBeUndefined();
  });

  it('ends a session only with Shift+E', () => {
    expect(shortcutAction(key('e'), 'focus')).toBeUndefined();
    expect(shortcutAction(key('E', { shiftKey: true }), 'focus')).toBe('end');
    expect(shortcutAction(key('E', { shiftKey: true }), 'idle')).toBeUndefined();
  });

  it('stays out of the way of typing, buttons and browser shortcuts', () => {
    expect(shortcutAction(key(' ', { inTextEntry: true }), 'idle')).toBeUndefined();
    expect(shortcutAction(key('b', { inTextEntry: true }), 'focus')).toBeUndefined();
    expect(shortcutAction(key(' ', { onButton: true }), 'focus')).toBeUndefined();
    expect(shortcutAction(key('b', { onButton: true }), 'focus')).toBe('startBreak');
    expect(shortcutAction(key('b', { ctrlKey: true }), 'focus')).toBeUndefined();
  });
});

describe('import validation', () => {
  const valid = {
    app: 'neurosync',
    version: 1,
    exportedAt: 1,
    sessions: [
      {
        id: 's1',
        startedAt: 1,
        plannedFocusMin: 25,
        plannedBreakMin: 5,
        goal: 'Read',
        goalOutcome: 'done',
      },
    ],
    events: [{ id: 'e1', sessionId: 's1', type: 'tab_hidden', at: 2 }],
    checkIns: [{ id: 'c1', sessionId: 's1', at: 3, focus: 4 }],
    modeChanges: [
      { id: 'm1', sessionId: 's1', at: 1, mode: 'productive', source: 'engine', reasons: [] },
    ],
  };

  it('accepts a well-formed export', () => {
    const result = parseExport(valid);
    expect(result.ok).toBe(true);
  });

  it('rejects files that are not NeuroSync exports', () => {
    expect(parseExport({ hello: 'world' })).toEqual({
      ok: false,
      error: 'This does not look like a NeuroSync export.',
    });
    expect(parseExport(null).ok).toBe(false);
    expect(parseExport({ ...valid, version: 2 }).ok).toBe(false);
  });

  it('points at the first malformed row', () => {
    const bad = {
      ...valid,
      checkIns: [...valid.checkIns, { id: 'c2', sessionId: 's1', at: 4, energy: 9 }],
    };
    expect(parseExport(bad)).toEqual({
      ok: false,
      error: 'checkIns entry 2 is not in the expected format.',
    });
    expect(
      parseExport({ ...valid, events: [{ id: 'e', sessionId: 's1', type: 'typing', at: 1 }] }).ok,
    ).toBe(false);
  });
});

describe('withDefaults', () => {
  it('drops wrongly typed or invalid values and fills in missing ones', () => {
    const settings = withDefaults({
      focusMin: 'forty',
      breakMin: 10,
      engine: { hysteresisMs: Number.NaN, distractionLeaveCount: 5 },
      colours: { productive: 'red', fatigue: '#123456' },
      theme: 'neon',
    });
    expect(settings.focusMin).toBe(DEFAULT_SETTINGS.focusMin);
    expect(settings.breakMin).toBe(10);
    expect(settings.engine.hysteresisMs).toBe(DEFAULT_SETTINGS.engine.hysteresisMs);
    expect(settings.engine.distractionLeaveCount).toBe(5);
    expect(settings.colours.productive).toBe(DEFAULT_SETTINGS.colours.productive);
    expect(settings.colours.fatigue).toBe('#123456');
    expect(settings.theme).toBe('system');
  });

  it('returns defaults for nothing stored', () => {
    expect(withDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('goalStats', () => {
  it('counts goals set and their outcomes', () => {
    const sessions = [
      makeSession({ id: 'a', goal: 'x', goalOutcome: 'done' }),
      makeSession({ id: 'b', goal: 'y', goalOutcome: 'partly' }),
      makeSession({ id: 'c', goal: 'z' }),
      makeSession({ id: 'd' }),
    ];
    expect(goalStats(sessions)).toEqual({ set: 3, done: 1, partly: 1 });
  });
});
