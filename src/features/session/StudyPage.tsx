import { useMemo, useState } from 'react';
import { CheckInPrompt } from '../../components/CheckInPrompt';
import { ModeIndicator } from '../../components/ModeIndicator';
import { ModeTimeline } from '../../components/ModeTimeline';
import { NudgeToast } from '../../components/NudgeToast';
import { SessionRecap } from '../../components/SessionRecap';
import { Timer } from '../../components/Timer';
import { resolveShownMode } from '../../engine/display';
import { useSessionStore } from '../../store/sessionStore';
import { useSettingsStore } from '../../store/settingsStore';
import { buildModeSegments } from './modeSegments';
import { SHORTCUT_HELP } from './shortcuts';
import { summarizeSession } from './summary';
import { computeTimer } from './timer';
import { useStudyShortcuts } from './useStudyShortcuts';

export function StudyPage() {
  const settings = useSettingsStore((s) => s.settings);
  const store = useSessionStore();
  const { session, events, modeChanges, now, display, override, nudge, checkInOpen, lastEnded } =
    store;
  const [goalDraft, setGoalDraft] = useState('');

  const shown = resolveShownMode(display, override);
  const timer = computeTimer(session, events, now);
  const snoozeMin = Math.round(settings.nudges.snoozeMs / 60_000);
  const showCheckIn = checkInOpen && timer.phase === 'focus';

  const start = () => {
    store.startSession(settings, goalDraft);
    setGoalDraft('');
  };

  useStudyShortcuts(timer.phase, {
    start,
    pause: store.pause,
    resume: store.resume,
    startBreak: store.startBreak,
    endBreak: store.endBreak,
    end: store.endSession,
    escape: () => {
      if (nudge) store.dismissNudge();
      else if (showCheckIn) store.answerCheckIn({});
    },
  });

  const liveSegments = session ? buildModeSegments(session, modeChanges, now) : [];
  const recap = useMemo(() => {
    if (!lastEnded) return undefined;
    const end = lastEnded.session.endedAt ?? Date.now();
    return {
      recap: summarizeSession(lastEnded.session, lastEnded.events, lastEnded.checkIns, end),
      segments: buildModeSegments(lastEnded.session, lastEnded.modeChanges, end),
    };
  }, [lastEnded]);

  return (
    <div className="grid gap-5">
      <Timer
        view={timer}
        focusMin={settings.focusMin}
        breakMin={settings.breakMin}
        goal={session?.goal}
        goalDraft={goalDraft}
        onGoalDraftChange={setGoalDraft}
        onStart={start}
        onPause={store.pause}
        onResume={store.resume}
        onStartBreak={store.startBreak}
        onEndBreak={store.endBreak}
        onEnd={store.endSession}
      />
      {showCheckIn && (
        <CheckInPrompt onAnswer={store.answerCheckIn} onSkip={() => store.answerCheckIn({})} />
      )}
      {!session && recap && lastEnded && (
        <SessionRecap
          recap={recap.recap}
          segments={recap.segments}
          goal={lastEnded.session.goal}
          goalOutcome={lastEnded.session.goalOutcome}
          onGoalOutcome={store.setGoalOutcome}
          onDismiss={store.dismissRecap}
        />
      )}
      <ModeIndicator
        mode={shown.mode}
        reasons={shown.reasons}
        source={shown.source}
        canOverride={session !== undefined}
        onOverride={store.setOverride}
        onClearOverride={store.clearOverride}
      />
      {liveSegments.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-2 text-sm font-medium">This session so far</h2>
          <ModeTimeline segments={liveSegments} label="Modes so far this session" />
        </section>
      )}
      <details className="text-sm text-muted">
        <summary className="cursor-pointer select-none">Keyboard shortcuts</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {SHORTCUT_HELP.map((s) => (
            <div key={s.keys} className="contents">
              <dt>
                <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-xs text-ink">
                  {s.keys}
                </kbd>
              </dt>
              <dd>{s.does}</dd>
            </div>
          ))}
        </dl>
      </details>
      {nudge && (
        <NudgeToast
          nudge={nudge}
          autoDismissMs={settings.nudges.autoDismissMs}
          onDismiss={store.dismissNudge}
          onSnooze={() => store.snoozeNudges(settings.nudges.snoozeMs)}
          snoozeLabel={`Quiet for ${snoozeMin} min`}
        />
      )}
    </div>
  );
}
