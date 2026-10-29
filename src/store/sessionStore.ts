import { create } from 'zustand';
import { checkInsRepo, eventsRepo, modeChangesRepo, sessionsRepo } from '../db/repositories';
import {
  advanceDisplay,
  canNudge,
  INITIAL_DISPLAY,
  isCheckInDue,
  nudgeContent,
  resolveShownMode,
  suggestMode,
  type DisplayState,
  type ManualOverride,
  type NudgeContent,
  type NudgeHistory,
} from '../engine';
import type {
  CheckIn,
  GoalOutcome,
  Mode,
  ModeChange,
  Rating,
  Session,
  Settings,
  TrackingEvent,
  TrackingEventType,
} from '../types';

/** An unfinished session older than this is closed on load rather than resumed. */
const RESUME_WINDOW_MS = 3 * 60 * 60_000;

const newId = () => crypto.randomUUID();

const MAX_GOAL_LENGTH = 140;

type Shown = ReturnType<typeof resolveShownMode>;

/** A just-ended session, kept in memory for the end-of-session recap. */
export interface EndedSession {
  session: Session;
  events: TrackingEvent[];
  checkIns: CheckIn[];
  modeChanges: ModeChange[];
}

interface SessionState {
  hydrated: boolean;
  now: number;
  session?: Session;
  events: TrackingEvent[];
  checkIns: CheckIn[];
  /** What the user saw, in order: one entry per change of shown mode or its source. */
  modeChanges: ModeChange[];
  lastEnded?: EndedSession;
  display: DisplayState;
  override?: ManualOverride;
  nudge?: NudgeContent;
  nudgeHistory: NudgeHistory;
  checkInOpen: boolean;

  hydrate: (now: number) => Promise<void>;
  tick: (now: number, settings: Settings) => void;
  startSession: (settings: Settings, goal?: string) => void;
  endSession: () => void;
  pause: () => void;
  resume: () => void;
  startBreak: () => void;
  endBreak: () => void;
  recordVisibility: (type: 'tab_hidden' | 'tab_visible', at: number) => void;
  setOverride: (mode: Mode) => void;
  clearOverride: () => void;
  answerCheckIn: (answer: { focus?: Rating; energy?: Rating }) => void;
  dismissNudge: () => void;
  snoozeNudges: (ms: number) => void;
  setGoalOutcome: (outcome: GoalOutcome) => void;
  dismissRecap: () => void;
  /** Clears in-memory state after all stored data was deleted. */
  forget: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => {
  const addEvent = (type: TrackingEventType, at = Date.now()) => {
    const { session } = get();
    if (!session || session.endedAt !== undefined) return;
    const event: TrackingEvent = { id: newId(), sessionId: session.id, type, at };
    set((s) => ({ events: [...s.events, event] }));
    void eventsRepo.add(event);
  };

  /** Records a change in what the user sees (mode or who chose it). */
  const logShown = (prev: Shown | undefined, next: Shown, at: number) => {
    const { session } = get();
    if (!session) return;
    if (prev && prev.mode === next.mode && prev.source === next.source) return;
    const change: ModeChange = {
      id: newId(),
      sessionId: session.id,
      at,
      mode: next.mode,
      source: next.source,
      reasons: next.reasons,
    };
    set((s) => ({ modeChanges: [...s.modeChanges, change] }));
    void modeChangesRepo.add(change);
  };

  return {
    hydrated: false,
    now: Date.now(),
    events: [],
    checkIns: [],
    modeChanges: [],
    display: INITIAL_DISPLAY,
    nudgeHistory: {},
    checkInOpen: false,

    async hydrate(now) {
      const open = await sessionsRepo.findOpen();
      if (!open) {
        set({ hydrated: true, now });
        return;
      }
      const [events, checkIns, modeChanges] = await Promise.all([
        eventsRepo.forSession(open.id),
        checkInsRepo.forSession(open.id),
        modeChangesRepo.forSession(open.id),
      ]);
      const lastActivity = Math.max(open.startedAt, ...events.map((e) => e.at));
      if (now - lastActivity > RESUME_WINDOW_MS) {
        // Abandoned (e.g. the tab was closed): end it where activity stopped.
        await sessionsRepo.put({ ...open, endedAt: lastActivity });
        set({ hydrated: true, now });
        return;
      }
      set({ hydrated: true, now, session: open, events, checkIns, modeChanges });
    },

    tick(now, settings) {
      const { session, events, checkIns, display, override, nudgeHistory, checkInOpen } = get();
      const suggestion = suggestMode(events, checkIns, now, settings.engine, session);
      const nextDisplay = advanceDisplay(display, suggestion, now, settings.engine.hysteresisMs);
      const changed = nextDisplay.mode !== display.mode;
      const patch: Partial<SessionState> = { now, display: nextDisplay };

      if (changed && session) {
        const shown = resolveShownMode(nextDisplay, override);
        // On a fresh or reloaded session nothing has been logged yet, so log the first state.
        const prev = get().modeChanges.length > 0 ? resolveShownMode(display, override) : undefined;
        logShown(prev, shown, now);
        if (
          shown.source === 'engine' &&
          (shown.mode === 'distraction' || shown.mode === 'fatigue') &&
          canNudge(shown.mode, nudgeHistory, now, settings.nudges)
        ) {
          patch.nudge = nudgeContent(shown.mode, shown.reasons);
          patch.nudgeHistory = { ...nudgeHistory, lastNudgeAt: now };
        }
      }

      if (
        !checkInOpen &&
        isCheckInDue(session, events, checkIns, now, settings.checkInIntervalMs)
      ) {
        patch.checkInOpen = true;
      }
      set(patch);
    },

    startSession(settings, goal) {
      const now = Date.now();
      const trimmed = goal?.trim().slice(0, MAX_GOAL_LENGTH);
      const session: Session = {
        id: newId(),
        startedAt: now,
        plannedFocusMin: settings.focusMin,
        plannedBreakMin: settings.breakMin,
        ...(trimmed ? { goal: trimmed } : {}),
      };
      set({
        session,
        events: [],
        checkIns: [],
        modeChanges: [],
        lastEnded: undefined,
        override: undefined,
        nudge: undefined,
        checkInOpen: false,
        now,
      });
      void sessionsRepo.put(session);
      get().tick(now, settings);
    },

    endSession() {
      const { session, events, checkIns, modeChanges } = get();
      if (!session) return;
      const ended = { ...session, endedAt: Date.now() };
      void sessionsRepo.put(ended);
      set({
        lastEnded: { session: ended, events, checkIns, modeChanges },
        session: undefined,
        events: [],
        checkIns: [],
        modeChanges: [],
        display: INITIAL_DISPLAY,
        override: undefined,
        nudge: undefined,
        checkInOpen: false,
      });
    },

    pause: () => addEvent('pause'),
    resume: () => addEvent('resume'),
    startBreak: () => {
      set({ checkInOpen: false, nudge: undefined });
      addEvent('break_start');
    },
    endBreak: () => addEvent('break_end'),
    recordVisibility: (type, at) => addEvent(type, at),

    setOverride(mode) {
      const at = Date.now();
      const { display, override } = get();
      const prev = resolveShownMode(display, override);
      const next = { mode, at };
      set({ override: next, nudge: undefined });
      logShown(prev, resolveShownMode(display, next), at);
    },
    clearOverride() {
      const { display, override } = get();
      set({ override: undefined });
      logShown(
        resolveShownMode(display, override),
        resolveShownMode(display, undefined),
        Date.now(),
      );
    },

    answerCheckIn(answer) {
      const { session } = get();
      set({ checkInOpen: false });
      if (!session) return;
      const checkIn: CheckIn = { id: newId(), sessionId: session.id, at: Date.now(), ...answer };
      set((s) => ({ checkIns: [...s.checkIns, checkIn] }));
      void checkInsRepo.add(checkIn);
    },

    dismissNudge: () => set({ nudge: undefined }),
    snoozeNudges(ms) {
      set((s) => ({
        nudge: undefined,
        nudgeHistory: { ...s.nudgeHistory, snoozedUntil: Date.now() + ms },
      }));
    },
    setGoalOutcome(goalOutcome) {
      const { lastEnded } = get();
      if (!lastEnded) return;
      const session = { ...lastEnded.session, goalOutcome };
      set({ lastEnded: { ...lastEnded, session } });
      void sessionsRepo.put(session);
    },
    dismissRecap: () => set({ lastEnded: undefined }),

    forget() {
      set({
        session: undefined,
        events: [],
        checkIns: [],
        modeChanges: [],
        lastEnded: undefined,
        display: INITIAL_DISPLAY,
        override: undefined,
        nudge: undefined,
        nudgeHistory: {},
        checkInOpen: false,
      });
    },
  };
});
