import type { CheckIn, ModeChange, Session, Settings, TrackingEvent } from '../types';
import { db } from './schema';

export const sessionsRepo = {
  put: (session: Session) => db.sessions.put(session),
  all: () => db.sessions.orderBy('startedAt').toArray(),
  /** The most recent session that was never ended, e.g. after a page reload. */
  async findOpen(): Promise<Session | undefined> {
    const latest = await db.sessions.orderBy('startedAt').last();
    return latest && latest.endedAt === undefined ? latest : undefined;
  },
};

export const eventsRepo = {
  add: (event: TrackingEvent) => db.events.add(event),
  forSession: (sessionId: string) => db.events.where('sessionId').equals(sessionId).sortBy('at'),
  all: () => db.events.orderBy('at').toArray(),
};

export const checkInsRepo = {
  add: (checkIn: CheckIn) => db.checkIns.add(checkIn),
  forSession: (sessionId: string) => db.checkIns.where('sessionId').equals(sessionId).sortBy('at'),
  all: () => db.checkIns.orderBy('at').toArray(),
};

export const modeChangesRepo = {
  add: (change: ModeChange) => db.modeChanges.add(change),
  forSession: (sessionId: string) =>
    db.modeChanges.where('sessionId').equals(sessionId).sortBy('at'),
  all: () => db.modeChanges.orderBy('at').toArray(),
};

export const settingsRepo = {
  async get(): Promise<Settings | undefined> {
    return (await db.settings.get('settings'))?.value;
  },
  save: (value: Settings) => db.settings.put({ key: 'settings', value }),
};

export interface ExportedData {
  app: 'neurosync';
  version: 1;
  exportedAt: number;
  sessions: Session[];
  events: TrackingEvent[];
  checkIns: CheckIn[];
  modeChanges: ModeChange[];
  settings?: Settings;
}

export async function exportAll(now: number): Promise<ExportedData> {
  const [sessions, events, checkIns, modeChanges, settings] = await Promise.all([
    sessionsRepo.all(),
    eventsRepo.all(),
    checkInsRepo.all(),
    modeChangesRepo.all(),
    settingsRepo.get(),
  ]);
  return {
    app: 'neurosync',
    version: 1,
    exportedAt: now,
    sessions,
    events,
    checkIns,
    modeChanges,
    settings,
  };
}

export async function deleteAll(): Promise<void> {
  await db.transaction(
    'rw',
    [db.sessions, db.events, db.checkIns, db.modeChanges, db.settings],
    () =>
      Promise.all([
        db.sessions.clear(),
        db.events.clear(),
        db.checkIns.clear(),
        db.modeChanges.clear(),
        db.settings.clear(),
      ]),
  );
}

export interface ImportCounts {
  sessions: number;
  checkIns: number;
}

/**
 * Merges an export into the local database. Rows with the same id are replaced, so importing
 * the same file twice is harmless. Settings are only replaced when `settings` is passed.
 */
export async function importAll(data: ExportedData, settings?: Settings): Promise<ImportCounts> {
  await db.transaction(
    'rw',
    [db.sessions, db.events, db.checkIns, db.modeChanges, db.settings],
    async () => {
      await Promise.all([
        db.sessions.bulkPut(data.sessions),
        db.events.bulkPut(data.events),
        db.checkIns.bulkPut(data.checkIns),
        db.modeChanges.bulkPut(data.modeChanges),
      ]);
      if (settings) await db.settings.put({ key: 'settings', value: settings });
    },
  );
  return { sessions: data.sessions.length, checkIns: data.checkIns.length };
}
