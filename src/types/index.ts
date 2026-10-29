export type Mode = 'productive' | 'distraction' | 'fatigue' | 'break';

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface Session {
  id: string;
  startedAt: number; // epoch ms
  endedAt?: number;
  plannedFocusMin: number;
  plannedBreakMin: number;
  /** Optional one-line intention set before starting. */
  goal?: string;
  /** Self-reported at the end of the session; undefined if not answered. */
  goalOutcome?: GoalOutcome;
}

export type GoalOutcome = 'done' | 'partly' | 'not_yet';

export type TrackingEventType =
  'tab_hidden' | 'tab_visible' | 'pause' | 'resume' | 'break_start' | 'break_end';

export interface TrackingEvent {
  id: string;
  sessionId: string;
  type: TrackingEventType;
  at: number;
}

export interface CheckIn {
  id: string;
  sessionId: string;
  at: number;
  focus?: Rating; // undefined if skipped
  energy?: Rating;
}

export interface ModeChange {
  id: string;
  sessionId: string;
  at: number;
  mode: Mode;
  source: 'engine' | 'manual';
  reasons: string[];
}

export interface ModeSuggestion {
  mode: Mode;
  reasons: string[];
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface EngineConfig {
  /** Window used to count recent tab-leaves for Distraction. */
  distractionWindowMs: number;
  /** Tab-leaves within the window that suggest Distraction. */
  distractionLeaveCount: number;
  /** A single tab-leave longer than this suggests Distraction. */
  longLeaveMs: number;
  /** Focus time since the last break that suggests Fatigue. */
  maxContinuousFocusMs: number;
  /** Latest check-in energy at or below this suggests Fatigue. */
  lowEnergyThreshold: number;
  /** Window size for the switch-rate comparison. */
  switchRateWindowMs: number;
  /** Recent switch rate must be at least this multiple of the early rate. */
  switchRateMultiplier: number;
  /** Session length before the switch-rate rule applies. */
  switchRateMinSessionMs: number;
  /** How long a suggestion must hold before the colour changes. */
  hysteresisMs: number;
}

export interface NudgeConfig {
  enabled: boolean;
  minIntervalMs: number;
  autoDismissMs: number;
  snoozeMs: number;
}

export interface Settings {
  focusMin: number;
  breakMin: number;
  checkInIntervalMs: number;
  engine: EngineConfig;
  nudges: NudgeConfig;
  colours: Record<Mode, string>;
  theme: ThemePreference;
}
