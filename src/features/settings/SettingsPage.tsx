import { useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { MIN_CHECK_IN_INTERVAL_MS } from '../../engine/config';
import { deleteAll, exportAll, importAll } from '../../db/repositories';
import { parseExport } from '../../db/validate';
import { useSessionStore } from '../../store/sessionStore';
import { useSettingsStore } from '../../store/settingsStore';
import { DEFAULT_MODE_COLOURS, MODE_LABELS, MODES } from '../../styles/modes';
import type { EngineConfig, ThemePreference } from '../../types';
import { withDefaults } from './defaults';

const MIN = 60_000;

export function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const reset = useSettingsStore((s) => s.reset);
  const setEngine = (patch: Partial<EngineConfig>) =>
    update({ engine: { ...settings.engine, ...patch } });
  const e = settings.engine;

  return (
    <div className="grid gap-5">
      <Card title="Session timer">
        <NumberField
          label="Focus length"
          unit="min"
          min={5}
          max={180}
          value={settings.focusMin}
          onChange={(v) => update({ focusMin: v })}
        />
        <NumberField
          label="Break length"
          unit="min"
          min={1}
          max={60}
          value={settings.breakMin}
          onChange={(v) => update({ breakMin: v })}
        />
        <p className="text-xs text-muted sm:col-span-2">
          Changes apply to the next session you start.
        </p>
      </Card>

      <Card title="Check-ins and nudges">
        <NumberField
          label="Check-in every"
          unit="min"
          min={MIN_CHECK_IN_INTERVAL_MS / MIN}
          max={120}
          value={settings.checkInIntervalMs / MIN}
          onChange={(v) => update({ checkInIntervalMs: v * MIN })}
        />
        <label className="flex items-center gap-3 self-end py-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-current"
            checked={settings.nudges.enabled}
            onChange={(ev) =>
              update({ nudges: { ...settings.nudges, enabled: ev.target.checked } })
            }
          />
          Show gentle nudges
        </label>
        <NumberField
          label="At most one nudge every"
          unit="min"
          min={10}
          max={120}
          value={settings.nudges.minIntervalMs / MIN}
          onChange={(v) => update({ nudges: { ...settings.nudges, minIntervalMs: v * MIN } })}
        />
        <NumberField
          label="“Quiet” snoozes nudges for"
          unit="min"
          min={5}
          max={240}
          value={settings.nudges.snoozeMs / MIN}
          onChange={(v) => update({ nudges: { ...settings.nudges, snoozeMs: v * MIN } })}
        />
      </Card>

      <Card
        title="Mode thresholds"
        description="These are the simple rules behind each suggestion. Adjust them to fit how you study."
      >
        <NumberField
          label="Distraction: tab-leaves"
          unit="times"
          min={1}
          max={30}
          value={e.distractionLeaveCount}
          onChange={(v) => setEngine({ distractionLeaveCount: v })}
        />
        <NumberField
          label="…within the last"
          unit="min"
          min={1}
          max={60}
          value={e.distractionWindowMs / MIN}
          onChange={(v) => setEngine({ distractionWindowMs: v * MIN })}
        />
        <NumberField
          label="Distraction: single leave longer than"
          unit="min"
          min={1}
          max={60}
          value={e.longLeaveMs / MIN}
          onChange={(v) => setEngine({ longLeaveMs: v * MIN })}
        />
        <NumberField
          label="Fatigue: focus without a break over"
          unit="min"
          min={10}
          max={240}
          value={e.maxContinuousFocusMs / MIN}
          onChange={(v) => setEngine({ maxContinuousFocusMs: v * MIN })}
        />
        <NumberField
          label="Fatigue: check-in energy at or below"
          unit="of 5"
          min={1}
          max={4}
          value={e.lowEnergyThreshold}
          onChange={(v) => setEngine({ lowEnergyThreshold: v })}
        />
        <NumberField
          label="Fatigue: switch rate multiplier"
          unit="×"
          min={1.5}
          max={10}
          step={0.5}
          value={e.switchRateMultiplier}
          onChange={(v) => setEngine({ switchRateMultiplier: v })}
        />
        <NumberField
          label="Switch-rate window"
          unit="min"
          min={5}
          max={60}
          value={e.switchRateWindowMs / MIN}
          onChange={(v) => setEngine({ switchRateWindowMs: v * MIN })}
        />
        <NumberField
          label="Switch-rate rule starts after"
          unit="min"
          min={10}
          max={240}
          value={e.switchRateMinSessionMs / MIN}
          onChange={(v) => setEngine({ switchRateMinSessionMs: v * MIN })}
        />
        <NumberField
          label="Hold a new mode before showing it"
          unit="sec"
          min={0}
          max={600}
          value={e.hysteresisMs / 1000}
          onChange={(v) => setEngine({ hysteresisMs: v * 1000 })}
        />
      </Card>

      <Card title="Appearance">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Theme</span>
          <select
            className="field"
            value={settings.theme}
            onChange={(ev) => update({ theme: ev.target.value as ThemePreference })}
          >
            <option value="system">Match system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <div />
        {MODES.map((mode) => (
          <label key={mode} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{MODE_LABELS[mode]} colour</span>
            <input
              type="color"
              className="h-9 w-14 cursor-pointer rounded border border-line bg-surface"
              value={settings.colours[mode]}
              onChange={(ev) =>
                update({ colours: { ...settings.colours, [mode]: ev.target.value } })
              }
            />
          </label>
        ))}
        <div className="sm:col-span-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => update({ colours: DEFAULT_MODE_COLOURS })}
          >
            Reset colours
          </button>
        </div>
      </Card>

      <DataCard onResetSettings={reset} />
    </div>
  );
}

function DataCard({ onResetSettings }: { onResetSettings: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string>();
  const [includeSettings, setIncludeSettings] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const importData = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = ''; // allow choosing the same file again
    if (!file) return;
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setStatus('That file is not valid JSON, so nothing was imported.');
      return;
    }
    const parsed = parseExport(json);
    if (!parsed.ok) {
      setStatus(`Nothing was imported: ${parsed.error}`);
      return;
    }
    const settings =
      includeSettings && parsed.data.settings ? withDefaults(parsed.data.settings) : undefined;
    try {
      const counts = await importAll(parsed.data, settings);
      if (settings) await useSettingsStore.getState().load();
      setStatus(
        `Imported ${counts.sessions} sessions and ${counts.checkIns} check-ins${settings ? ', plus settings' : ''}.`,
      );
    } catch {
      setStatus('Something went wrong while saving the import. Your existing data is unchanged.');
    }
  };

  const exportData = async () => {
    const data = await exportAll(Date.now());
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neurosync-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Exported.');
  };

  const deleteData = async () => {
    await deleteAll();
    useSessionStore.getState().forget();
    useSettingsStore.getState().forget();
    setConfirming(false);
    setStatus('All NeuroSync data on this device has been deleted.');
  };

  return (
    <Card
      title="Your data"
      description="Everything NeuroSync records stays in this browser. Nothing is sent anywhere."
    >
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="button" className="btn-secondary" onClick={() => void exportData()}>
          Export as JSON
        </button>
        <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
          Import JSON…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Choose a NeuroSync export file"
          onChange={(ev) => void importData(ev)}
        />
        <button type="button" className="btn-ghost" onClick={onResetSettings}>
          Reset settings to defaults
        </button>
        {!confirming ? (
          <button type="button" className="btn-ghost" onClick={() => setConfirming(true)}>
            Delete all data…
          </button>
        ) : (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            This removes every session, check-in and setting.
            <button type="button" className="btn-primary" onClick={() => void deleteData()}>
              Yes, delete everything
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </span>
        )}
      </div>
      <label className="flex items-center gap-3 text-sm sm:col-span-2">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={includeSettings}
          onChange={(ev) => setIncludeSettings(ev.target.checked)}
        />
        When importing, also replace my settings with the ones in the file
      </label>
      <p className="text-xs text-muted sm:col-span-2">
        Importing adds sessions from the file to the ones already here; nothing is deleted.
      </p>
      {status && (
        <p role="status" className="text-sm text-muted sm:col-span-2">
          {status}
        </p>
      )}
    </Card>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="text-sm text-muted">{description}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

interface NumberFieldProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

function NumberField({ label, unit, value, min, max, step = 1, onChange }: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string>();
  const commit = (raw: string) => {
    setDraft(undefined);
    const n = Number(raw);
    if (raw.trim() === '' || Number.isNaN(n)) return;
    onChange(Math.min(max, Math.max(min, n)));
  };
  return (
    <div className="grid gap-1 text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className="field"
          min={min}
          max={max}
          step={step}
          value={draft ?? String(value)}
          onChange={(ev) => setDraft(ev.target.value)}
          onBlur={(ev) => commit(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') commit(ev.currentTarget.value);
          }}
        />
        <span className="w-12 shrink-0 text-muted">{unit}</span>
      </div>
    </div>
  );
}
