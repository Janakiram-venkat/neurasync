import { useState } from 'react';
import { MODE_DESCRIPTIONS, MODE_LABELS, MODES } from '../styles/modes';
import type { Mode } from '../types';
import { ModeIcon } from './ModeIcon';

interface ModeIndicatorProps {
  mode: Mode;
  reasons: string[];
  source: 'engine' | 'manual';
  /** Overriding is only offered during a session. */
  canOverride: boolean;
  onOverride: (mode: Mode) => void;
  onClearOverride: () => void;
}

export function ModeIndicator({
  mode,
  reasons,
  source,
  canOverride,
  onOverride,
  onClearOverride,
}: ModeIndicatorProps) {
  const [choosing, setChoosing] = useState(false);

  return (
    <section
      aria-labelledby="mode-heading"
      className="rounded-2xl border border-line bg-surface p-5 shadow-sm"
    >
      <div className="flex items-center gap-4">
        <span className="mode-dot flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white">
          <ModeIcon mode={mode} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {source === 'manual' ? 'Mode (set by you)' : 'Suggested mode'}
          </p>
          <h2 id="mode-heading" className="text-xl font-semibold" aria-live="polite">
            {MODE_LABELS[mode]}
          </h2>
          <p className="text-sm text-muted">{MODE_DESCRIPTIONS[mode]}</p>
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="mt-4 text-sm">
          <p className="font-medium">{source === 'manual' ? 'Why:' : 'Suggested because:'}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {canOverride && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {source === 'manual' ? (
            <button type="button" className="btn-secondary" onClick={onClearOverride}>
              Go back to suggestions
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              aria-expanded={choosing}
              onClick={() => setChoosing((c) => !c)}
            >
              Not quite right? Set it yourself
            </button>
          )}
          {choosing && source === 'engine' && (
            <div role="group" aria-label="Choose a mode" className="flex flex-wrap gap-2">
              {MODES.filter((m) => m !== mode).map((m) => (
                <button
                  key={m}
                  type="button"
                  className="btn-secondary inline-flex items-center gap-1.5"
                  onClick={() => {
                    setChoosing(false);
                    onOverride(m);
                  }}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: `var(--mode-${m})` }}
                    aria-hidden
                  />
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
