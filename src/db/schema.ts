import Dexie, { type EntityTable } from 'dexie';
import type { CheckIn, ModeChange, Session, Settings, TrackingEvent } from '../types';

export interface SettingsRow {
  key: 'settings';
  value: Settings;
}

export class NeuroSyncDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  events!: EntityTable<TrackingEvent, 'id'>;
  checkIns!: EntityTable<CheckIn, 'id'>;
  modeChanges!: EntityTable<ModeChange, 'id'>;
  settings!: EntityTable<SettingsRow, 'key'>;

  constructor() {
    super('neurosync');
    this.version(1).stores({
      sessions: 'id, startedAt',
      events: 'id, sessionId, at',
      checkIns: 'id, sessionId, at',
      modeChanges: 'id, sessionId, at',
      settings: 'key',
    });
  }
}

export const db = new NeuroSyncDB();
