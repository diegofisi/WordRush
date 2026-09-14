import { describe, expect, it } from 'vitest';

import { clamp, formatClock, initialOf, percentOf, secondsLeftAt } from './format';

describe('secondsLeftAt', () => {
  /*
   * The one place the client turns a server snapshot into a running clock. The
   * server owns the deadline; this only renders it, and it must never hand a
   * negative number to the UI or let a stale snapshot read as time still left.
   */
  it('subtracts the time that passed since the snapshot', () => {
    expect(secondsLeftAt({ secondsLeft: 60, at: 1_000_000 }, 1_010_000)).toBe(50);
  });

  it('returns the snapshot untouched when no time has passed', () => {
    expect(secondsLeftAt({ secondsLeft: 60, at: 1_000_000 }, 1_000_000)).toBe(60);
  });

  it('floors at zero instead of going negative', () => {
    expect(secondsLeftAt({ secondsLeft: 5, at: 1_000_000 }, 1_060_000)).toBe(0);
  });
});

describe('percentOf', () => {
  it('rounds to whole percent', () => {
    expect(percentOf(45, 90)).toBe(50);
    expect(percentOf(1, 3)).toBe(33);
  });

  it('can exceed 100, because letter bonuses push the clock past its start', () => {
    expect(percentOf(120, 90)).toBe(133);
  });

  it('answers 0 rather than dividing by zero', () => {
    expect(percentOf(30, 0)).toBe(0);
  });
});

describe('formatClock', () => {
  it('pads the minutes for the big clock and not for a feed stamp', () => {
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(65, false)).toBe('1:05');
  });

  it('rounds up, so a clock never shows 0 while time is left', () => {
    expect(formatClock(0.2)).toBe('00:01');
    expect(formatClock(0)).toBe('00:00');
  });

  it('never shows a negative clock', () => {
    expect(formatClock(-5)).toBe('00:00');
  });
});

describe('initialOf', () => {
  it('takes the first letter, upper-cased and trimmed', () => {
    expect(initialOf('  ana ')).toBe('A');
  });

  it('falls back to ? for a name that is all space', () => {
    expect(initialOf('   ')).toBe('?');
  });
});

describe('clamp', () => {
  it('holds a value inside its bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
