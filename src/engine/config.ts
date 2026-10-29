// Every threshold NeuroSync uses lives here. All of them are user-adjustable in
// Settings. When a value changes, update CLAUDE.md ("Mode logic") as well.
import type { EngineConfig, NudgeConfig } from '../types';

export const MINUTE = 60_000;
export const SECOND = 1_000;

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  distractionWindowMs: 10 * MINUTE,
  distractionLeaveCount: 3,
  longLeaveMs: 2 * MINUTE,
  maxContinuousFocusMs: 50 * MINUTE,
  lowEnergyThreshold: 2,
  switchRateWindowMs: 15 * MINUTE,
  switchRateMultiplier: 2,
  switchRateMinSessionMs: 30 * MINUTE,
  hysteresisMs: 60 * SECOND,
};

export const DEFAULT_NUDGE_CONFIG: NudgeConfig = {
  enabled: true,
  minIntervalMs: 10 * MINUTE,
  autoDismissMs: 15 * SECOND,
  snoozeMs: 30 * MINUTE,
};

export const DEFAULT_FOCUS_MIN = 25;
export const DEFAULT_BREAK_MIN = 5;
export const DEFAULT_CHECK_IN_INTERVAL_MS = 20 * MINUTE;
/** Check-ins may never be asked more often than this (CLAUDE.md: "at most every 20 minutes"). */
export const MIN_CHECK_IN_INTERVAL_MS = 20 * MINUTE;
