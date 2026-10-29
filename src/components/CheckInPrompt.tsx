import { useEffect, useRef, useState } from 'react';
import { isTextEntry } from '../features/session/shortcuts';
import type { Rating } from '../types';

const RATINGS: readonly Rating[] = [1, 2, 3, 4, 5];

interface CheckInPromptProps {
  onAnswer: (answer: { focus?: Rating; energy?: Rating }) => void;
  onSkip: () => void;
}

/** Quick check-in: one tap per scale, sent as soon as both are chosen. */
export function CheckInPrompt({ onAnswer, onSkip }: CheckInPromptProps) {
  const [focus, setFocus] = useState<Rating>();
  const [energy, setEnergy] = useState<Rating>();

  const choose = (scale: 'focus' | 'energy', value: Rating) => {
    const next = { focus, energy, [scale]: value };
    if (scale === 'focus') setFocus(value);
    else setEnergy(value);
    if (next.focus !== undefined && next.energy !== undefined) onAnswer(next);
  };

  // Keys 1–5 answer focus first, then energy.
  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat || isTextEntry(ev.target)) return;
      const n = Number(ev.key);
      if (!Number.isInteger(n) || n < 1 || n > 5) return;
      ev.preventDefault();
      chooseRef.current(focusRef.current === undefined ? 'focus' : 'energy', n as Rating);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section
      aria-labelledby="checkin-heading"
      className="rounded-2xl border border-line bg-surface p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="checkin-heading" className="font-semibold">
            Quick check-in
          </h2>
          <p className="text-sm text-muted">Totally optional. How is it going right now?</p>
        </div>
        <button type="button" className="btn-ghost" onClick={onSkip}>
          Skip
        </button>
      </div>
      <Scale
        label="Focus"
        low="Scattered"
        high="Locked in"
        value={focus}
        onChoose={(v) => choose('focus', v)}
      />
      <Scale
        label="Energy"
        low="Drained"
        high="Fresh"
        value={energy}
        onChoose={(v) => choose('energy', v)}
      />
    </section>
  );
}

interface ScaleProps {
  label: string;
  low: string;
  high: string;
  value?: Rating;
  onChoose: (value: Rating) => void;
}

function Scale({ label, low, high, value, onChoose }: ScaleProps) {
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="hidden w-16 text-right text-xs text-muted sm:block">{low}</span>
        {RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={value === r}
            aria-label={`${label} ${r} of 5`}
            onClick={() => onChoose(r)}
            className={`h-10 w-10 rounded-full border text-sm font-medium transition-colors ${
              value === r ? 'mode-dot border-transparent text-white' : 'border-line hover:bg-line'
            }`}
          >
            {r}
          </button>
        ))}
        <span className="hidden w-16 text-xs text-muted sm:block">{high}</span>
      </div>
    </fieldset>
  );
}
