import { lazy, Suspense, useEffect, useState } from 'react';
import { AmbientGlow } from '../components/AmbientGlow';
import { StudyPage } from '../features/session/StudyPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { useAppRuntime } from './useAppRuntime';

// Recharts is large; load the dashboard only when it is opened.
const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);

const ROUTES = [
  { id: 'study', label: 'Study' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'settings', label: 'Settings' },
] as const;

type Route = (typeof ROUTES)[number]['id'];

const routeFromHash = (): Route => {
  const hash = window.location.hash.replace('#/', '');
  return ROUTES.find((r) => r.id === hash)?.id ?? 'study';
};

export function App() {
  const { ready } = useAppRuntime();
  const [route, setRoute] = useState<Route>(routeFromHash);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <>
      <AmbientGlow />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <a href="#/study" className="flex items-center gap-2 text-lg font-semibold">
            <span className="mode-dot inline-block h-3 w-3 rounded-full" aria-hidden />
            NeuroSync
          </a>
          <nav aria-label="Main">
            <ul className="flex gap-1 rounded-full border border-line bg-surface p-1">
              {ROUTES.map((r) => (
                <li key={r.id}>
                  <a
                    href={`#/${r.id}`}
                    aria-current={route === r.id ? 'page' : undefined}
                    className={`block rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      route === r.id ? 'bg-ink text-bg' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {r.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <main className="flex-1">
          {!ready ? (
            <p className="text-muted">Loading…</p>
          ) : route === 'dashboard' ? (
            <Suspense fallback={<p className="text-muted">Loading your patterns…</p>}>
              <DashboardPage />
            </Suspense>
          ) : route === 'settings' ? (
            <SettingsPage />
          ) : (
            <StudyPage />
          )}
        </main>

        <footer className="mt-10 text-center text-xs text-muted">
          Modes are estimates from simple signals, not a diagnosis. Your data never leaves this
          device.
        </footer>
      </div>
    </>
  );
}
