import { useEffect } from 'react';
import type { NudgeContent } from '../engine/nudge';
import { ModeIcon } from './ModeIcon';

interface NudgeToastProps {
  nudge: NudgeContent;
  autoDismissMs: number;
  onDismiss: () => void;
  onSnooze: () => void;
  snoozeLabel: string;
}

export function NudgeToast({
  nudge,
  autoDismissMs,
  onDismiss,
  onSnooze,
  snoozeLabel,
}: NudgeToastProps) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(id);
  }, [nudge, autoDismissMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-20 mx-auto max-w-md rounded-2xl border border-line bg-surface p-4 shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      <div className="flex gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: `var(--mode-${nudge.mode})` }}
        >
          <ModeIcon mode={nudge.mode} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{nudge.title}</p>
          <p className="mt-0.5 text-sm text-muted">{nudge.body}</p>
          {nudge.reasons.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              <span className="font-medium">Suggested because:</span> {nudge.reasons.join(' ')}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-secondary" onClick={onDismiss}>
              Not now
            </button>
            <button type="button" className="btn-ghost" onClick={onSnooze}>
              {snoozeLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
