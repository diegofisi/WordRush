import type { LetterGain, TileColor } from '@shared/contract';
import type { PlayerRound } from '@modules/rooms/domain/entities/player-round.entity';
import { computeFeedback } from '@modules/game/domain/services/color-feedback';
import { chargeGuess, totalSeconds } from '@modules/game/domain/services/time-ledger';

export interface GuessRowOutcome {
  colors: TileColor[];
  gains: LetterGain[];
  secondsGained: number;
}

/**
 * Colours one of the fly's guesses, charges her time ledger and appends the
 * row — the same three domain steps a human guess takes in
 * `submit-guess.use-case.ts`, called from here so the game module never has to
 * know she exists.
 *
 * `earnsTime` is the one knob: she banks her gains like anybody else
 * (`BOSS.earnsTimeFromLetters`), and the forfeited total is returned for the
 * interface if that ever changes back (docs/context/08-boss-mode.md).
 */
export function applyBossGuessRow(
  round: PlayerRound,
  word: string,
  answer: string,
  earnsTime: boolean,
): GuessRowOutcome {
  const feedback = computeFeedback(word, answer);
  const gains = chargeGuess(round.charges, word, feedback);
  const secondsGained = totalSeconds(gains);
  if (earnsTime) round.addSeconds(secondsGained);
  round.rows.push({ word, colors: feedback.colors });
  return { colors: feedback.colors, gains, secondsGained };
}
