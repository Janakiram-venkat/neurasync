import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/db/repositories', () => {
  const repo = { add: vi.fn(), put: vi.fn(), forSession: vi.fn(async () => []), findOpen: vi.fn() };
  return { sessionsRepo: repo, eventsRepo: repo, checkInsRepo: repo, modeChangesRepo: repo };
});

const { useSessionStore } = await import('../../src/store/sessionStore');
const { DEFAULT_SETTINGS } = await import('../../src/features/settings/defaults');

const MIN = 60_000;
const settings = DEFAULT_SETTINGS;
const store = () => useSessionStore.getState();

describe('sessionStore', () => {
  let t: number;

  beforeEach(() => {
    vi.useFakeTimers();
    t = Date.UTC(2026, 9, 28, 9);
    vi.setSystemTime(t);
    store().forget();
    store().startSession(settings);
  });

  const advance = (ms: number) => {
    t += ms;
    vi.setSystemTime(t);
    store().tick(t, settings);
  };

  it('shows Productive immediately when a session starts', () => {
    expect(store().display.mode).toBe('productive');
  });

  it('waits out the hysteresis, then nudges once with the reason', () => {
    for (const offset of [1, 2, 3]) {
      store().recordVisibility('tab_hidden', t + offset * 1000);
      store().recordVisibility('tab_visible', t + offset * 1000 + 500);
    }
    advance(10_000);
    expect(store().display.mode).toBe('productive');
    expect(store().nudge).toBeUndefined();

    advance(61_000);
    expect(store().display.mode).toBe('distraction');
    expect(store().nudge?.reasons[0]).toMatch(/left the study tab 3 times/);
  });

  it('manual override suppresses nudges and is cleared when the session ends', () => {
    store().setOverride('productive');
    store().recordVisibility('tab_hidden', t + 1000);
    advance(3 * MIN);
    advance(2 * MIN);
    expect(store().display.mode).toBe('distraction');
    expect(store().nudge).toBeUndefined();
    store().endSession();
    expect(store().override).toBeUndefined();
    expect(store().display.mode).toBe('break');
  });

  it('keeps a trimmed goal and a recap with the goal outcome after ending', () => {
    store().forget();
    store().startSession(settings, '  Finish chapter 4  ');
    expect(store().session?.goal).toBe('Finish chapter 4');
    advance(5 * MIN);
    store().endSession();
    expect(store().lastEnded?.session.endedAt).toBeDefined();
    expect(store().lastEnded?.modeChanges.map((c) => c.mode)).toEqual(['productive']);
    store().setGoalOutcome('partly');
    expect(store().lastEnded?.session.goalOutcome).toBe('partly');
    store().dismissRecap();
    expect(store().lastEnded).toBeUndefined();
  });

  it('records what the user saw, including overrides, without duplicates', () => {
    store().setOverride('fatigue');
    store().recordVisibility('tab_hidden', t + 1000);
    advance(3 * MIN);
    advance(2 * MIN); // engine moves to distraction, hidden behind the override
    store().clearOverride();
    expect(store().modeChanges.map((c) => [c.mode, c.source])).toEqual([
      ['productive', 'engine'],
      ['fatigue', 'manual'],
      ['distraction', 'engine'],
    ]);
  });

  it('opens a check-in after 20 minutes and closes it when answered', () => {
    advance(19 * MIN);
    expect(store().checkInOpen).toBe(false);
    advance(1 * MIN);
    expect(store().checkInOpen).toBe(true);
    store().answerCheckIn({ focus: 4, energy: 1 });
    expect(store().checkInOpen).toBe(false);
    advance(1000);
    expect(store().display.mode).toBe('productive'); // pending, held by hysteresis
    advance(60_000);
    expect(store().display.mode).toBe('fatigue');
  });
});
