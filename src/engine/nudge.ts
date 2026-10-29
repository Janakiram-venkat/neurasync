// Nudge rate-limiting and copy. Nudges are rare, dismissible and always explain themselves.
import type { Mode, NudgeConfig } from '../types';

export interface NudgeHistory {
  lastNudgeAt?: number;
  snoozedUntil?: number;
}

export interface NudgeContent {
  mode: Mode;
  title: string;
  body: string;
  reasons: string[];
}

export function canNudge(mode: Mode, history: NudgeHistory, now: number, config: NudgeConfig) {
  if (!config.enabled) return false;
  if (mode !== 'distraction' && mode !== 'fatigue') return false;
  if (history.snoozedUntil !== undefined && now < history.snoozedUntil) return false;
  return history.lastNudgeAt === undefined || now - history.lastNudgeAt >= config.minIntervalMs;
}

export function nudgeContent(mode: 'distraction' | 'fatigue', reasons: string[]): NudgeContent {
  if (mode === 'distraction') {
    return {
      mode,
      title: 'Looks like attention might be drifting',
      body: 'Consider closing a tab or two, or picking one small goal for the next few minutes.',
      reasons,
    };
  }
  return {
    mode,
    title: 'A short break might help',
    body: 'Consider stepping away for a few minutes: stretch, get some water, rest your eyes.',
    reasons,
  };
}
