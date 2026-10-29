import { useEffect } from 'react';
import { resolveShownMode } from '../engine/display';
import { useSessionStore } from '../store/sessionStore';
import { useSettingsStore } from '../store/settingsStore';
import { applyModeColours } from '../styles/modes';
import { watchVisibility } from '../tracking/visibility';
import type { ThemePreference } from '../types';

const TICK_MS = 1_000;

/** Wires the stores to time, page visibility and the document's theme and colours. */
export function useAppRuntime() {
  const loaded = useSettingsStore((s) => s.loaded);
  const settings = useSettingsStore((s) => s.settings);
  const hydrated = useSessionStore((s) => s.hydrated);
  const display = useSessionStore((s) => s.display);
  const override = useSessionStore((s) => s.override);

  useEffect(() => {
    void useSettingsStore.getState().load();
    void useSessionStore.getState().hydrate(Date.now());
  }, []);

  useEffect(() => {
    if (!loaded || !hydrated) return;
    const tick = () =>
      useSessionStore.getState().tick(Date.now(), useSettingsStore.getState().settings);
    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [loaded, hydrated]);

  useEffect(
    () => watchVisibility((type, at) => useSessionStore.getState().recordVisibility(type, at)),
    [],
  );

  useEffect(() => applyModeColours(settings.colours, document.documentElement), [settings.colours]);

  const shownMode = resolveShownMode(display, override).mode;
  useEffect(() => {
    document.documentElement.style.setProperty('--mode-current', `var(--mode-${shownMode})`);
  }, [shownMode]);

  useEffect(() => applyTheme(settings.theme), [settings.theme]);

  return { ready: loaded && hydrated };
}

function applyTheme(preference: ThemePreference): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const update = () => {
    const dark = preference === 'dark' || (preference === 'system' && media.matches);
    document.documentElement.classList.toggle('dark', dark);
  };
  update();
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
}
