import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { checkInsRepo, eventsRepo, sessionsRepo } from '../../db/repositories';
import type { CheckIn, Session, TrackingEvent } from '../../types';
import {
  bestTimeOfDay,
  dailyStats,
  DAY_PART_LABELS,
  goalStats,
  type GoalStats,
  summarizeSessions,
  type SessionSummary,
} from './stats';

const DAYS = 14;

interface Data {
  sessions: Session[];
  events: TrackingEvent[];
  checkIns: CheckIn[];
}

const dayLabel = (day: number) =>
  new Date(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function DashboardPage() {
  const [data, setData] = useState<Data>();

  useEffect(() => {
    void Promise.all([sessionsRepo.all(), eventsRepo.all(), checkInsRepo.all()]).then(
      ([sessions, events, checkIns]) => setData({ sessions, events, checkIns }),
    );
  }, []);

  const view = useMemo(() => {
    if (!data) return undefined;
    const now = Date.now();
    const summaries = summarizeSessions(data.sessions, data.events, now);
    return {
      summaries,
      days: dailyStats(summaries, data.checkIns, DAYS, now).map((d) => ({
        ...d,
        label: dayLabel(d.day),
      })),
      best: bestTimeOfDay(summaries, data.checkIns),
      goals: goalStats(data.sessions),
    };
  }, [data]);

  if (!view) return <p className="text-muted">Loading your patterns…</p>;

  if (view.summaries.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <h2 className="text-lg font-semibold">Nothing to reflect on yet</h2>
        <p className="mt-1 text-sm text-muted">
          Your patterns will show up here after a session or two. Everything stays on this device.
        </p>
      </div>
    );
  }

  const recent = view.summaries.slice(-10).map((s, i) => ({
    label: `#${view.summaries.length - Math.min(10, view.summaries.length) + i + 1}`,
    switches: s.switches,
  }));

  return (
    <div className="grid gap-5">
      <Tiles summaries={view.summaries} goals={view.goals} />

      <ChartCard title="Focus time per day" subtitle={`Last ${DAYS} days, in minutes`}>
        <BarChart data={view.days}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={32} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--line)' }} />
          <Bar
            dataKey="focusMin"
            name="Focus minutes"
            fill="var(--mode-productive)"
            radius={[4, 4, 0, 0]}
          />
          <Bar dataKey="sessions" name="Sessions" fill="var(--mode-break)" radius={[4, 4, 0, 0]} />
          <Legend />
        </BarChart>
      </ChartCard>

      <ChartCard title="Tab switches per session" subtitle="Your last 10 sessions">
        <BarChart data={recent}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={32} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--line)' }} />
          <Bar
            dataKey="switches"
            name="Tab switches"
            fill="var(--mode-distraction)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartCard>

      <ChartCard title="Check-in trends" subtitle="Daily average, 1–5">
        <LineChart data={view.days}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            width={32}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v.toFixed(1)} />
          <Line
            type="monotone"
            dataKey="avgFocus"
            name="Focus"
            stroke="var(--mode-productive)"
            strokeWidth={2}
            connectNulls
            dot
          />
          <Line
            type="monotone"
            dataKey="avgEnergy"
            name="Energy"
            stroke="var(--mode-fatigue)"
            strokeWidth={2}
            strokeDasharray="5 3"
            connectNulls
            dot
          />
          <Legend />
        </LineChart>
      </ChartCard>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Best focus time of day</h2>
        {view.best ? (
          <>
            <p className="mt-1">
              Looks like <strong>{DAY_PART_LABELS[view.best.part].toLowerCase()}</strong> tend to go
              well for you.
            </p>
            <p className="mt-1 text-sm text-muted">Based on: {view.best.detail}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">
            Not enough data yet. Study at a few different times of day (or answer a few check-ins)
            and a pattern may show up here.
          </p>
        )}
      </section>
    </div>
  );
}

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  color: 'var(--text)',
};

function Tiles({ summaries, goals }: { summaries: SessionSummary[]; goals: GoalStats }) {
  const totalMin = Math.round(summaries.reduce((s, x) => s + x.focusMs, 0) / 60_000);
  const avgSwitches = summaries.reduce((s, x) => s + x.switches, 0) / summaries.length;
  const tiles = [
    { label: 'Sessions', value: String(summaries.length) },
    {
      label: 'Total focus',
      value: totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${totalMin}m`,
    },
    { label: 'Avg switches / session', value: avgSwitches.toFixed(1) },
    ...(goals.set > 0
      ? [
          {
            label: 'Goals done',
            value: `${goals.done} of ${goals.set}${goals.partly > 0 ? ` (+${goals.partly} partly)` : ''}`,
          },
        ]
      : []),
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{t.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{t.value}</p>
        </div>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactElement;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-muted">{subtitle}</p>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}
