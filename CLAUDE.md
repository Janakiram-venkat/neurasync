# CLAUDE.md — NeuroSync

## What this project is

NeuroSync is a web app that helps students notice their own study behaviour: when they are focused, when they are drifting, and when they need a break. It shows the current study state as a calm, ambient colour and gives short, well-timed nudges. A dashboard helps students reflect on their patterns over time.

It started as a hardware concept (an RGB desk cube with switch-selected modes). It is now a pure software platform. The core idea is unchanged: **make study behaviour visible so students can respond to it consciously.**

## Non-negotiable principles

These shape every feature, every line of UI copy and every code review.

1. **Estimates, not diagnoses.** NeuroSync never claims to read minds, measure emotions or detect medical fatigue. Modes are _suggestions_ based on simple, explainable signals. UI copy says "Looks like you've been switching tabs a lot" — never "You are distracted" or "You are fatigued".
2. **Explainable.** Every mode change must have a reason that can be shown to the user ("Suggested because: 4 tab switches in the last 10 minutes"). No black-box scoring.
3. **Local-first and private.** All data stays in the browser (IndexedDB). No accounts, no analytics, no network calls with user data in the MVP. The user can view, export (JSON) and delete all their data.
4. **Calm, not another distraction.** The app lives on the same screen that distracts students, so it must be quiet. Ambient colour first; nudges are rare, dismissible and rate-limited. No sounds by default. No streak guilt, no red badges.
5. **User stays in control.** The student can always override the suggested mode, snooze nudges, and change every threshold in Settings.

## MVP scope

In scope:

- Focus session timer (start / pause / end, configurable focus and break lengths, defaults 25/5)
- Three study modes shown as an ambient colour (plus a neutral Break/Idle state)
- Distraction signal: leaving the study tab, using the Page Visibility API
- Fatigue signal: long unbroken focus time, low self-reported energy, rising switch rate within a session
- Quick check-ins (focus 1–5, energy 1–5), at most every 20 minutes, one tap to answer or skip
- Gentle nudges with the reason shown
- Dashboard: sessions per day, total focus time, switches per session, check-in trends, best focus time of day
- Settings: durations, thresholds, nudge frequency, colours, data export, import and delete
- Optional one-line session goal, with a Done / Partly / Not this time outcome at the end
- End-of-session recap: focus time, breaks, switches, check-in averages, one tentative observation
- Mode timeline: what mode was shown when, and why (live during a session and in the recap)
- Keyboard shortcuts: Space start/pause/resume, B break, Shift+E end, 1–5 check-in, Esc dismiss
- Import JSON: merges an export into local data (by id; nothing is deleted); settings only if opted in

Out of scope for now (do not build unless asked):

- Browser extension or cross-site tracking
- Webcam, microphone, keystroke content or any biometric input
- Accounts, cloud sync, backend server
- Mobile app
- Any AI or ML-based inference

## Modes

| Mode         | Colour token         | Default hex              | Meaning                                                  |
| ------------ | -------------------- | ------------------------ | -------------------------------------------------------- |
| Productive   | `--mode-productive`  | `#1E40AF` (deep blue)    | Session active, staying on task                          |
| Distraction  | `--mode-distraction` | `#DB2777` (soft magenta) | Frequent or long tab-leaves; a prompt to check attention |
| Fatigue      | `--mode-fatigue`     | `#D97706` (amber)        | Signs a break or reset may help                          |
| Break / Idle | `--mode-break`       | `#0D9488` (teal)         | On a break or no session running                         |

Colour must never be the only signal: always pair it with the mode name and an icon (accessibility, colour-blind users).

## Mode logic (v1 heuristics)

All thresholds live in one file, `src/engine/config.ts`, and are user-adjustable. The engine is a pure function: `(events, checkIns, now, config) => { mode, reasons[] }`. Keep it pure and fully unit-tested.

- **Distraction** if, during an active session, either:
  - tab left ≥ 3 times in the last 10 minutes, or
  - a single tab-leave lasted > 2 minutes
- **Fatigue** if, during an active session, any of:
  - continuous focus time > 50 minutes without a break
  - latest check-in energy ≤ 2
  - switch rate in the last 15 minutes is ≥ 2× the rate in the session's first 15 minutes (only once the session is ≥ 30 minutes long)
- **Priority:** Fatigue > Distraction > Productive. Break/Idle whenever no session is active or a break is running.
- **Hysteresis:** a suggested mode must hold for at least 60 seconds before the UI changes colour, to prevent flicker.
- **Manual override** wins until the user clears it or the session ends.

Clarifications (as implemented in `src/engine/`):
- The engine signature also takes the session being evaluated: `suggestMode(events, checkIns, now, config, session)`. Session start is not an event type, so the engine needs it.
- Only focus time counts. Tab-leaves that start during a pause or break are ignored, and paused time is not counted towards a long leave or continuous focus.
- "Continuous focus" is focus time since the last break ended (or the session started). Pausing does not reset it, but paused time is excluded.
- A break resets the energy signal: only check-ins since the current focus stretch began count. Skipped check-ins have no energy, so they never override an earlier rating.
- A long leave counts if any part of it falls inside the 10-minute distraction window.
- Switch rate: when the first 15 minutes had 0 switches, the baseline is treated as 1, so the recent window needs ≥ 2 switches.
- Hysteresis applies to engine suggestions between Productive, Distraction and Fatigue. Transitions into or out of Break/Idle are immediate, because they come from the user's own actions (start, pause, break, end).
- Nudges fire only when the displayed engine mode changes into Distraction or Fatigue, never while a manual override is active, at most once per 10 minutes, and not while snoozed.
- Check-ins are due 20 minutes after the latest of: last check-in (answered or skipped), session start, or the end of the last break. They are never shown during a pause or break.

## Tech stack

- React 18 + TypeScript (strict) + Vite
- Tailwind CSS for styling; mode colours as CSS variables
- Zustand for app state
- Dexie (IndexedDB) for local persistence
- Recharts for the dashboard
- Vitest + React Testing Library for tests
- ESLint + Prettier

Ask before adding any dependency not listed here.

## Commands

```bash
npm install        # install dependencies
npm run dev        # start dev server
npm run build      # production build
npm run test       # run tests (Vitest)
npm run lint       # lint
npm run typecheck  # tsc --noEmit
```

Run `npm run typecheck`, `npm run lint` and `npm run test` before calling any task done.

## Project structure

```
src/
  app/            # routes, layout, providers
  components/     # reusable UI (ModeIndicator, Timer, CheckInPrompt, NudgeToast)
  features/
    session/      # timer, session lifecycle
    checkin/      # check-in prompt and scheduling
    dashboard/    # charts and summaries
    settings/     # preferences, export, delete data
  engine/         # pure mode logic + config.ts (no React, no DOM)
  tracking/       # visibility listener -> events (only place that touches browser APIs)
  db/             # Dexie schema and repositories
  store/          # Zustand stores
  styles/         # tokens, mode colours
  types/          # shared domain types
tests/
```

## Domain model

```ts
type Mode = 'productive' | 'distraction' | 'fatigue' | 'break';

interface Session {
  id: string;
  startedAt: number; // epoch ms
  endedAt?: number;
  plannedFocusMin: number;
  plannedBreakMin: number;
  goal?: string;              // optional intention, max 140 chars
  goalOutcome?: 'done' | 'partly' | 'not_yet';
}

interface TrackingEvent {
  id: string;
  sessionId: string;
  type: 'tab_hidden' | 'tab_visible' | 'pause' | 'resume' | 'break_start' | 'break_end';
  at: number;
}

interface CheckIn {
  id: string;
  sessionId: string;
  at: number;
  focus?: 1 | 2 | 3 | 4 | 5; // undefined if skipped
  energy?: 1 | 2 | 3 | 4 | 5;
}

interface ModeChange {
  id: string;
  sessionId: string;
  at: number;
  mode: Mode;
  source: 'engine' | 'manual';
  reasons: string[];
}
```

Store raw events and derive everything else, so heuristics can change without migrating data.

`ModeChange` records what the user *saw*: one entry whenever the shown mode or its source changes (engine suggestion vs manual override). Engine changes hidden behind an override are not recorded; they can be re-derived from raw events.

## Coding conventions

- TypeScript strict; no `any`. Prefer named exports.
- `engine/` must not import React, Dexie or browser APIs.
- Only `tracking/` touches `document.visibilityState` and related events.
- Small, focused components; logic in hooks or the engine, not in JSX.
- All times stored as epoch milliseconds; format only at the UI edge.
- Write tests for every engine rule, including edge cases (session start, pauses, breaks, overrides).

## UI and copy guidelines

- Full-width ambient glow or border in the current mode colour, low saturation in dark mode.
- Support light and dark themes and `prefers-reduced-motion`.
- Nudges: max one every 10 minutes, auto-dismiss after 15 seconds, always show the reason and a "Not now" option.
- Use tentative, supportive language: "might", "looks like", "consider". Avoid: "detected", "diagnosed", "your brain", "you are tired".
- Never shame the user for distraction or short sessions.

## Roadmap (for context, not current work)

1. MVP web app (this document)
2. PWA install + optional system notifications
3. Opt-in browser extension for site-level distraction signals
4. Weekly reflection reports and personalised threshold suggestions
5. Pilot study tooling: anonymised export for consenting participants

## How to work on this repo

- Build in small, reviewable steps; propose a plan before large changes.
- When a heuristic or threshold changes, update this file and `engine/config.ts` together.
- If a requested feature conflicts with the principles above, flag it before implementing.
