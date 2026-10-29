import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CheckInPrompt } from '../../src/components/CheckInPrompt';
import { ModeTimeline } from '../../src/components/ModeTimeline';
import { SessionRecap } from '../../src/components/SessionRecap';
import type { ModeSegment } from '../../src/features/session/modeSegments';
import { at } from '../helpers';

const segments: ModeSegment[] = [
  {
    mode: 'productive',
    source: 'engine',
    start: at(0),
    end: at(20),
    reasons: ['Mostly on this tab.'],
  },
  {
    mode: 'distraction',
    source: 'engine',
    start: at(20),
    end: at(30),
    reasons: ['You left the study tab 3 times in the last 10 minutes.'],
  },
];

describe('ModeTimeline', () => {
  it('labels each segment with its mode (not colour alone) and explains it on select', async () => {
    render(<ModeTimeline segments={segments} label="Modes" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAccessibleName(/^Productive,/);
    await userEvent.click(buttons[1]!);
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByText(/Suggested because: You left the study tab 3 times/),
    ).toBeInTheDocument();
  });

  it('renders nothing without segments', () => {
    const { container } = render(<ModeTimeline segments={[]} label="Modes" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SessionRecap', () => {
  const recap = {
    focusMs: 30 * 60_000,
    breakCount: 1,
    switches: 2,
    avgFocus: 4,
    observation: 'A steady one.',
  };

  it('shows stats, the observation and asks how the goal went', async () => {
    const onGoalOutcome = vi.fn();
    render(
      <SessionRecap
        recap={recap}
        segments={segments}
        goal="Finish chapter 4"
        onGoalOutcome={onGoalOutcome}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText('30 min')).toBeInTheDocument();
    expect(screen.getByText('A steady one.')).toBeInTheDocument();
    expect(screen.getByText(/Finish chapter 4/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Partly' }));
    expect(onGoalOutcome).toHaveBeenCalledWith('partly');
  });

  it('skips the goal question when no goal was set', () => {
    render(
      <SessionRecap recap={recap} segments={[]} onGoalOutcome={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });
});

describe('CheckInPrompt keyboard', () => {
  it('answers focus then energy with number keys', async () => {
    const onAnswer = vi.fn();
    render(<CheckInPrompt onAnswer={onAnswer} onSkip={() => {}} />);
    await userEvent.keyboard('4');
    expect(onAnswer).not.toHaveBeenCalled();
    await userEvent.keyboard('2');
    expect(onAnswer).toHaveBeenCalledWith({ focus: 4, energy: 2 });
  });

  it('ignores digits outside 1–5', async () => {
    const onAnswer = vi.fn();
    render(<CheckInPrompt onAnswer={onAnswer} onSkip={() => {}} />);
    await userEvent.keyboard('0');
    await userEvent.keyboard('9');
    expect(screen.getByRole('button', { name: 'Focus 1 of 5' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
