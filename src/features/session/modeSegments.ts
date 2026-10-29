import type { Mode, ModeChange, Session } from '../../types';

export interface ModeSegment {
  mode: Mode;
  source: 'engine' | 'manual';
  start: number;
  end: number;
  reasons: string[];
}

/**
 * Turns the session's recorded mode changes (what the user saw) into contiguous segments
 * from session start to `end`. Consecutive changes to the same mode and source are merged.
 */
export function buildModeSegments(
  session: Session,
  changes: readonly ModeChange[],
  end: number,
): ModeSegment[] {
  const stop = Math.max(session.startedAt, session.endedAt ?? end);
  const sorted = changes
    .filter((c) => c.sessionId === session.id && c.at <= stop)
    .sort((a, b) => a.at - b.at);

  const segments: ModeSegment[] = [];
  for (const change of sorted) {
    const start = Math.max(change.at, session.startedAt);
    const last = segments.at(-1);
    if (last && last.mode === change.mode && last.source === change.source) continue;
    if (last) last.end = start;
    segments.push({
      mode: change.mode,
      source: change.source,
      start: segments.length === 0 ? session.startedAt : start,
      end: stop,
      reasons: change.reasons,
    });
  }
  return segments.filter((s) => s.end > s.start);
}
