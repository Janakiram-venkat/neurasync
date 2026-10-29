import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CheckInPrompt } from '../../src/components/CheckInPrompt';
import { ModeIndicator } from '../../src/components/ModeIndicator';
import { NudgeToast } from '../../src/components/NudgeToast';
import { nudgeContent } from '../../src/engine';

describe('ModeIndicator', () => {
  const noop = () => {};

  it('pairs the colour with a mode name and shows the reason', () => {
    render(
      <ModeIndicator
        mode="distraction"
        reasons={['You left the study tab 4 times in the last 10 minutes.']}
        source="engine"
        canOverride
        onOverride={noop}
        onClearOverride={noop}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Distraction' })).toBeInTheDocument();
    expect(screen.getByText('Suggested because:')).toBeInTheDocument();
    expect(screen.getByText(/4 times in the last 10 minutes/)).toBeInTheDocument();
  });

  it('lets the user override the mode', async () => {
    const onOverride = vi.fn();
    render(
      <ModeIndicator
        mode="productive"
        reasons={[]}
        source="engine"
        canOverride
        onOverride={onOverride}
        onClearOverride={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /set it yourself/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Fatigue' }));
    expect(onOverride).toHaveBeenCalledWith('fatigue');
  });

  it('offers to clear a manual override', async () => {
    const onClear = vi.fn();
    render(
      <ModeIndicator
        mode="fatigue"
        reasons={['You chose this mode yourself.']}
        source="manual"
        canOverride
        onOverride={noop}
        onClearOverride={onClear}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /back to suggestions/i }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe('CheckInPrompt', () => {
  it('submits once both scales have a tap', async () => {
    const onAnswer = vi.fn();
    render(<CheckInPrompt onAnswer={onAnswer} onSkip={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Focus 4 of 5' }));
    expect(onAnswer).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Energy 2 of 5' }));
    expect(onAnswer).toHaveBeenCalledWith({ focus: 4, energy: 2 });
  });

  it('can be skipped in one tap', async () => {
    const onSkip = vi.fn();
    render(<CheckInPrompt onAnswer={() => {}} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalled();
  });
});

describe('NudgeToast', () => {
  it('shows the reason, offers "Not now" and auto-dismisses', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <NudgeToast
        nudge={nudgeContent('fatigue', ['You have focused for 52 minutes without a break.'])}
        autoDismissMs={15_000}
        onDismiss={onDismiss}
        onSnooze={() => {}}
        snoozeLabel="Quiet for 30 min"
      />,
    );
    expect(screen.getByText(/52 minutes without a break/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(14_999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
