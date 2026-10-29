import { formatClock, type TimerView } from '../features/session/timer';

interface TimerProps {
  view: TimerView;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onEnd: () => void;
  focusMin: number;
  breakMin: number;
  /** The running session's goal, shown quietly under the clock. */
  goal?: string;
  goalDraft: string;
  onGoalDraftChange: (value: string) => void;
}

const PHASE_LABEL = {
  idle: 'Ready when you are',
  focus: 'Focus',
  paused: 'Paused',
  break: 'Break',
} as const;

export function Timer({
  view,
  onStart,
  onPause,
  onResume,
  onStartBreak,
  onEndBreak,
  onEnd,
  focusMin,
  breakMin,
  goal,
  goalDraft,
  onGoalDraftChange,
}: TimerProps) {
  const { phase, remainingMs, plannedMs } = view;
  const over = phase !== 'idle' && remainingMs < 0;
  const progress = plannedMs > 0 ? Math.min(1, Math.max(0, 1 - remainingMs / plannedMs)) : 0;

  return (
    <section
      aria-label="Session timer"
      className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-muted">{PHASE_LABEL[phase]}</p>
      <p
        className="mt-2 font-mono text-6xl font-semibold tabular-nums sm:text-7xl"
        role="timer"
        aria-live="off"
      >
        {phase === 'idle' ? formatClock(focusMin * 60_000) : formatClock(remainingMs)}
      </p>
      {phase !== 'idle' && (
        <div className="mx-auto mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-line">
          <div className="mode-dot h-full rounded-full" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      {over && (
        <p className="mt-3 text-sm text-muted">
          {phase === 'break'
            ? 'Break time is up. Continue whenever you feel ready.'
            : 'Focus block complete. A short break might be a good idea.'}
        </p>
      )}
      {phase === 'idle' && (
        <>
          <p className="mt-2 text-sm text-muted">
            {focusMin} min focus · {breakMin} min break
          </p>
          <label className="mx-auto mt-5 block max-w-sm text-left text-sm">
            <span className="font-medium">Goal for this session</span>
            <span className="text-muted"> (optional)</span>
            <input
              type="text"
              className="field mt-1"
              maxLength={140}
              placeholder="e.g. Finish chapter 4 problems"
              value={goalDraft}
              onChange={(ev) => onGoalDraftChange(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') onStart();
              }}
            />
          </label>
        </>
      )}
      {phase !== 'idle' && goal && (
        <p className="mx-auto mt-3 max-w-sm text-sm">
          <span className="text-muted">Goal:</span> {goal}
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {phase === 'idle' && (
          <button type="button" className="btn-primary" onClick={onStart}>
            Start session
          </button>
        )}
        {phase === 'focus' && (
          <>
            <button
              type="button"
              className={over ? 'btn-primary' : 'btn-secondary'}
              onClick={onStartBreak}
            >
              Take a break
            </button>
            <button type="button" className="btn-secondary" onClick={onPause}>
              Pause
            </button>
          </>
        )}
        {phase === 'paused' && (
          <button type="button" className="btn-primary" onClick={onResume}>
            Resume
          </button>
        )}
        {phase === 'break' && (
          <button
            type="button"
            className={over ? 'btn-primary' : 'btn-secondary'}
            onClick={onEndBreak}
          >
            Back to focus
          </button>
        )}
        {phase !== 'idle' && (
          <button type="button" className="btn-ghost" onClick={onEnd}>
            End session
          </button>
        )}
      </div>
    </section>
  );
}
