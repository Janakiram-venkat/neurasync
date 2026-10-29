import { create } from 'zustand';
import { settingsRepo } from '../db/repositories';
import { DEFAULT_SETTINGS, withDefaults } from '../features/settings/defaults';
import type { Settings } from '../types';

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  /** Back to defaults in memory only, after all stored data was deleted. */
  forget: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    const stored = await settingsRepo.get();
    set({ settings: withDefaults(stored), loaded: true });
  },
  update(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    void settingsRepo.save(settings);
  },
  reset() {
    set({ settings: DEFAULT_SETTINGS });
    void settingsRepo.save(DEFAULT_SETTINGS);
  },
  forget() {
    set({ settings: DEFAULT_SETTINGS });
  },
}));
