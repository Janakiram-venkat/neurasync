// Validates an imported NeuroSync export before anything touches the database.
import type { CheckIn, ModeChange, Session, Settings, TrackingEvent } from '../types';
import type { ExportedData } from './repositories';

export type ParseResult = { ok: true; data: ExportedData } | { ok: false; error: string };

const EVENT_TYPES = new Set([
  'tab_hidden',
  'tab_visible',
  'pause',
  'resume',
  'break_start',
  'break_end',
]);
const MODES = new Set(['productive', 'distraction', 'fatigue', 'break']);
const OUTCOMES = new Set(['done', 'partly', 'not_yet']);

type Row = Record<string, unknown>;

const isRow = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const optional = (v: unknown, check: (x: unknown) => boolean) => v === undefined || check(v);
const isRating = (v: unknown) => isNum(v) && Number.isInteger(v) && v >= 1 && v <= 5;

const isSession = (r: Row): boolean =>
  isStr(r.id) &&
  isNum(r.startedAt) &&
  optional(r.endedAt, isNum) &&
  isNum(r.plannedFocusMin) &&
  isNum(r.plannedBreakMin) &&
  optional(r.goal, (g) => typeof g === 'string') &&
  optional(r.goalOutcome, (o) => OUTCOMES.has(o as string));

const isEvent = (r: Row): boolean =>
  isStr(r.id) && isStr(r.sessionId) && isNum(r.at) && EVENT_TYPES.has(r.type as string);

const isCheckIn = (r: Row): boolean =>
  isStr(r.id) &&
  isStr(r.sessionId) &&
  isNum(r.at) &&
  optional(r.focus, isRating) &&
  optional(r.energy, isRating);

const isModeChange = (r: Row): boolean =>
  isStr(r.id) &&
  isStr(r.sessionId) &&
  isNum(r.at) &&
  MODES.has(r.mode as string) &&
  (r.source === 'engine' || r.source === 'manual') &&
  Array.isArray(r.reasons) &&
  r.reasons.every((x) => typeof x === 'string');

function checkList(value: unknown, name: string, check: (r: Row) => boolean): string | undefined {
  if (!Array.isArray(value)) return `"${name}" is missing or not a list.`;
  const bad = value.findIndex((r) => !isRow(r) || !check(r));
  return bad === -1 ? undefined : `${name} entry ${bad + 1} is not in the expected format.`;
}

export function parseExport(value: unknown): ParseResult {
  if (!isRow(value) || value.app !== 'neurosync') {
    return { ok: false, error: 'This does not look like a NeuroSync export.' };
  }
  if (value.version !== 1) {
    return { ok: false, error: `Unsupported export version: ${String(value.version)}.` };
  }
  const error =
    checkList(value.sessions, 'sessions', isSession) ??
    checkList(value.events, 'events', isEvent) ??
    checkList(value.checkIns, 'checkIns', isCheckIn) ??
    checkList(value.modeChanges, 'modeChanges', isModeChange);
  if (error) return { ok: false, error };
  if (value.settings !== undefined && !isRow(value.settings)) {
    return { ok: false, error: '"settings" is not in the expected format.' };
  }

  return {
    ok: true,
    data: {
      app: 'neurosync',
      version: 1,
      exportedAt: isNum(value.exportedAt) ? value.exportedAt : 0,
      sessions: value.sessions as Session[],
      events: value.events as TrackingEvent[],
      checkIns: value.checkIns as CheckIn[],
      modeChanges: value.modeChanges as ModeChange[],
      settings: value.settings as Settings | undefined,
    },
  };
}
