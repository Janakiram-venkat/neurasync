import {
  DEFAULT_BREAK_MIN,
  DEFAULT_CHECK_IN_INTERVAL_MS,
  DEFAULT_ENGINE_CONFIG,
  DEFAULT_FOCUS_MIN,
  DEFAULT_NUDGE_CONFIG,
} from '../../engine/config';
import { DEFAULT_MODE_COLOURS } from '../../styles/modes';
import type { Settings } from '../../types';

export const DEFAULT_SETTINGS: Settings = {
  focusMin: DEFAULT_FOCUS_MIN,
  breakMin: DEFAULT_BREAK_MIN,
  checkInIntervalMs: DEFAULT_CHECK_IN_INTERVAL_MS,
  engine: DEFAULT_ENGINE_CONFIG,
  nudges: DEFAULT_NUDGE_CONFIG,
  colours: DEFAULT_MODE_COLOURS,
  theme: 'system',
};

const THEMES = new Set(['system', 'light', 'dark']);
const HEX = /^#[0-9a-f]{6}$/i;

/** Copies each field from `stored` only when it has the same type as the default. */
function pick<T extends object>(
  defaults: T,
  stored: unknown,
  valid: (k: string, v: unknown) => boolean,
): T {
  const result = { ...defaults };
  if (typeof stored !== 'object' || stored === null) return result;
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const value = (stored as Record<string, unknown>)[key];
    if (typeof value === typeof defaults[key] && valid(key, value))
      result[key] = value as T[typeof key];
  }
  return result;
}

const finite = (_: string, v: unknown) => typeof v !== 'number' || Number.isFinite(v);

/**
 * Fills in any fields missing from stored or imported settings (e.g. added in a later version)
 * and drops values of the wrong type, so a bad file can never break the thresholds.
 */
export function withDefaults(stored: unknown): Settings {
  const s = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<
    string,
    unknown
  >;
  const top = pick(
    {
      focusMin: DEFAULT_SETTINGS.focusMin,
      breakMin: DEFAULT_SETTINGS.breakMin,
      checkInIntervalMs: DEFAULT_SETTINGS.checkInIntervalMs,
    },
    s,
    finite,
  );
  return {
    ...top,
    engine: pick(DEFAULT_SETTINGS.engine, s.engine, finite),
    nudges: pick(DEFAULT_SETTINGS.nudges, s.nudges, finite),
    colours: pick(DEFAULT_SETTINGS.colours, s.colours, (_, v) => HEX.test(v as string)),
    theme: THEMES.has(s.theme as string) ? (s.theme as Settings['theme']) : DEFAULT_SETTINGS.theme,
  };
}
