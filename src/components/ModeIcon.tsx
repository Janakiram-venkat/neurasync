import type { Mode } from '../types';

interface ModeIconProps {
  mode: Mode;
  className?: string;
}

/** A distinct shape per mode, so colour is never the only signal. */
export function ModeIcon({ mode, className = 'h-6 w-6' }: ModeIconProps) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (mode) {
    case 'productive':
      // Target: steady focus
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      );
    case 'distraction':
      // Scattered arrows
      return (
        <svg {...common}>
          <path d="M4 12h6M14 6l6-2M14 18l6 2M17 9l3-3M17 15l3 3" />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
      );
    case 'fatigue':
      // Low battery
      return (
        <svg {...common}>
          <rect x="3" y="7" width="16" height="10" rx="2" />
          <path d="M21 10.5v3M6 10v4" />
        </svg>
      );
    case 'break':
      // Cup
      return (
        <svg {...common}>
          <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z" />
          <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M9 3.5c0 1 .8 1.5.8 2.5M12.5 3.5c0 1 .8 1.5.8 2.5" />
        </svg>
      );
  }
}
