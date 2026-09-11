import { computeFeedback } from './color-feedback';

describe('computeFeedback', () => {
  it('colours an exact match all green', () => {
    expect(computeFeedback('solid', 'solid').colors).toEqual([
      'green',
      'green',
      'green',
      'green',
      'green',
    ]);
  });

  it('marks letters present elsewhere yellow and absent letters gray', () => {
    const fb = computeFeedback('sandy', 'solid');
    expect(fb.colors).toEqual(['green', 'gray', 'gray', 'yellow', 'gray']);
    // The D at guess index 3 accounts for the answer's D at position 4.
    expect(fb.yellowTargets).toEqual([null, null, null, 4, null]);
  });

  it('does not over-credit a repeated guess letter when the answer has it once', () => {
    // ABIDE has one E and one D: only one E may be yellow.
    expect(computeFeedback('speed', 'abide').colors).toEqual([
      'gray',
      'gray',
      'yellow',
      'gray',
      'yellow',
    ]);
  });

  it('greens are matched first, then yellows consume what is left', () => {
    // ABBEY vs BABES: B(2) and E(3) are green; the leading B and A are yellow
    // because one B and the A of the answer remain unmatched; S is gray.
    expect(computeFeedback('babes', 'abbey').colors).toEqual([
      'yellow',
      'yellow',
      'green',
      'green',
      'gray',
    ]);
    // ABBEY vs BOBBY: B(2) and Y(4) are green, the first B takes the remaining B
    // of the answer (yellow) and the third B has nothing left to match (gray).
    expect(computeFeedback('bobby', 'abbey').colors).toEqual([
      'yellow',
      'gray',
      'green',
      'gray',
      'green',
    ]);
  });

  it('handles repeated letters in the answer (LLAMA)', () => {
    const fb = computeFeedback('alarm', 'llama');
    expect(fb.colors).toEqual(['yellow', 'green', 'green', 'gray', 'yellow']);
    expect(fb.yellowTargets[0]).toBe(4);
    expect(fb.yellowTargets[4]).toBe(3);
  });
});
