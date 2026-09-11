import { SCORING, type LetterGain } from '@shared/contract';
import type { PositionCharge } from '@modules/rooms/domain/entities/player-round.entity';
import type { Feedback } from './color-feedback';

/**
 * Charges a guess against the player's per-position ledger and returns the
 * seconds earned. Each answer position pays at most once per colour:
 *   yellow                      +5  (once)
 *   green, never yellow         +10
 *   green after yellow          +5  (10 in total)
 *   green on a hinted position  +5  (the hint already gave the yellow away)
 *   anything already charged     0
 * `LetterGain.position` is the tile index in the guess row (what the UI animates).
 */
export function chargeGuess(charges: PositionCharge[], guess: string, fb: Feedback): LetterGain[] {
  const gains: LetterGain[] = [];
  for (let i = 0; i < fb.colors.length; i++) {
    const color = fb.colors[i];
    if (color === 'green') {
      const charge = charges[i];
      if (charge.green) continue;
      charge.green = true;
      if (charge.hinted) {
        gains.push(gain(guess[i], i, 'green-after-hint', SCORING.greenAfterHintSeconds));
      } else if (charge.yellow) {
        gains.push(gain(guess[i], i, 'green-after-yellow', SCORING.greenAfterYellowSeconds));
      } else {
        gains.push(gain(guess[i], i, 'green', SCORING.greenSeconds));
      }
    } else if (color === 'yellow') {
      const target = fb.yellowTargets[i];
      if (target === null) continue;
      const charge = charges[target];
      if (charge.green || charge.yellow || charge.hinted) continue;
      charge.yellow = true;
      gains.push(gain(guess[i], i, 'yellow', SCORING.yellowSeconds));
    }
  }
  return gains;
}

export function totalSeconds(gains: LetterGain[]): number {
  return gains.reduce((sum, g) => sum + g.seconds, 0);
}

function gain(
  letter: string,
  position: number,
  kind: LetterGain['kind'],
  seconds: number,
): LetterGain {
  return { letter, position, kind, seconds };
}
