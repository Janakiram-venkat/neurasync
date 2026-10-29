import { useState } from 'react';
import type { ModeSegment } from '../features/session/modeSegments';
import { MODE_LABELS } from '../styles/modes';
import { ModeIcon } from './ModeIcon';

interface ModeTimelineProps {
  segments: ModeSegment[];
  label: string;
}

const clock = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const minutes = (ms: number) => {
  const m = Math.round(ms / 60_000);
  return m < 1 ? 'under a minute' : `${m} min`;
};

/** A strip of the modes shown during a session. Select a segment to see why it was suggested. */
export function ModeTimeline({ segments, label }: ModeTimelineProps) {
  const [selected, setSelected] = useState<number>();
  if (segments.length === 0) return null;

  const first = segments[0]!;
  const total = segments.at(-1)!.end - first.start;
  const active = selected !== undefined ? segments[selected] : undefined;

  return (
    <div>
      <div
        role="group"
        aria-label={label}
        className="flex h-8 w-full overflow-hidden rounded-lg border border-line"
      >
        {segments.map((seg, i) => {
          const share = total > 0 ? (seg.end - seg.start) / total : 1;
          return (
            <button
              key={`${seg.start}-${i}`}
              type="button"
              aria-pressed={selected === i}
              aria-label={`${MODE_LABELS[seg.mode]}${seg.source === 'manual' ? ' (set by you)' : ''}, ${clock(seg.start)} to ${clock(seg.end)}`}
              onClick={() => setSelected(selected === i ? undefined : i)}
              className={`flex min-w-1.5 items-center justify-center text-white transition-opacity focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${
                selected !== undefined && selected !== i ? 'opacity-45' : ''
              }`}
              style={{ flexGrow: share, flexBasis: 0, background: `var(--mode-${seg.mode})` }}
            >
              {share > 0.08 && <ModeIcon mode={seg.mode} className="h-4 w-4" />}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted tabular-nums">
        <span>{clock(first.start)}</span>
        <span>{clock(segments.at(-1)!.end)}</span>
      </div>

      {active ? (
        <div className="mt-2 rounded-lg bg-bg p-3 text-sm" aria-live="polite">
          <p className="flex items-center gap-2 font-medium">
            <ModeIcon mode={active.mode} className="h-4 w-4" />
            {MODE_LABELS[active.mode]}
            {active.source === 'manual' && <span className="text-muted">(set by you)</span>}
            <span className="ml-auto font-normal text-muted tabular-nums">
              {clock(active.start)}–{clock(active.end)} · {minutes(active.end - active.start)}
            </span>
          </p>
          {active.reasons.length > 0 && (
            <p className="mt-1 text-muted">
              {active.source === 'manual' ? '' : 'Suggested because: '}
              {active.reasons.join(' ')}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted">Select a segment to see why that mode was shown.</p>
      )}
    </div>
  );
}
