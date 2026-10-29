import type { ModeSegment } from '../features/session/modeSegments';
import type { SessionRecap as Recap } from '../features/session/summary';
import type { GoalOutcome } from '../types';
import { ModeTimeline } from './ModeTimeline';

interface SessionRecapProps {
  recap: Recap;
  segments: ModeSegment[];
  goal?: string;
  goalOutcome?: GoalOutcome;
  onGoalOutcome: (outcome: GoalOutcome) => void;
  onDismiss: () => void;
}

const OUTCOMES: { value: GoalOutcome; label: string }[] = [
  { value: 'done', label: 'Done' },
  { value: 'partly', label: 'Partly' },
  { value: 'not_yet', label: 'Not this time' },
];

const formatFocus = (ms: number) => {
  const total = Math.round(ms / 60_000);
  return total >= 60 ? `${Math.floor(total / 60)}h ${total % 60}m` : `${total} min`;
};

export function SessionRecap({
  recap,
  segments,
  goal,
  goalOutcome,
  onGoalOutcome,
  onDismiss,
}: SessionRecapProps) {
  const stats = [
    { label: 'Focus time', value: formatFocus(recap.focusMs) },
    { label: 'Breaks', value: String(recap.breakCount) },
    { label: 'Tab switches', value: String(recap.switches) },
    {
      label: 'Check-ins',
      value:
        recap.avgFocus !== undefined || recap.avgEnergy !== undefined
          ? `Focus ${recap.avgFocus?.toFixed(1) ?? '–'} · Energy ${recap.avgEnergy?.toFixed(1) ?? '–'}`
          : 'None',
    },
  ];

  return (
    <section
      aria-labelledby="recap-heading"
      className="rounded-2xl border border-line bg-surface p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="recap-heading" className="font-semibold">
          Session recap
        </h2>
        <button type="button" className="btn-ghost" onClick={onDismiss}>
          Close
        </button>
      </div>

      {goal && (
        <div className="mt-3">
          <p className="text-sm">
            <span className="text-muted">Your goal:</span> {goal}
          </p>
          <div role="group" aria-label="How did the goal go?" className="mt-2 flex flex-wrap gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={goalOutcome === o.value}
                className={goalOutcome === o.value ? 'btn-primary' : 'btn-secondary'}
                onClick={() => onGoalOutcome(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">{s.label}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {recap.observation && <p className="mt-4 text-sm">{recap.observation}</p>}

      {segments.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium">How the session went</p>
          <ModeTimeline segments={segments} label="Modes during this session" />
        </div>
      )}
    </section>
  );
}
