import { PlayerRound } from '@modules/rooms/domain/entities/player-round.entity';
import { computeFeedback } from './color-feedback';
import { pickHint } from './hint-picker';
import { chargeGuess } from './time-ledger';

/** Plays a guess through the ledger so the charges match a real round. */
function play(round: PlayerRound, guess: string, answer: string): void {
  chargeGuess(round.charges, guess, computeFeedback(guess, answer));
}

/** Every pick the hint can come out with, over all random draws. */
function possiblePicks(answer: string, round: PlayerRound) {
  const picks = new Map<string, { position: number; kind: string }>();
  for (let i = 0; i < round.charges.length; i++) {
    const pick = pickHint(answer, round.charges, () => i / round.charges.length);
    if (pick) picks.set(pick.letter, { position: pick.position, kind: pick.kind });
  }
  return picks;
}

describe('pickHint', () => {
  it('reveals a new letter while some slot is unknown, never one the player holds', () => {
    const answer = 'plato'; // no repeated letters
    const round = new PlayerRound(0, 90, 5);
    play(round, 'tapes', answer); // T, A and P yellow; E and S absent
    const picks = possiblePicks(answer, round);
    expect([...picks.keys()].sort()).toEqual(['l', 'o']);
    for (const pick of picks.values()) expect(pick.kind).toBe('letter');
  });

  it('still offers the second slot of a repeated letter', () => {
    const answer = 'llama'; // L L A M A
    const round = new PlayerRound(0, 90, 5);
    play(round, 'salto', answer); // one L yellow and one A yellow, one slot each
    expect([...possiblePicks(answer, round).keys()].sort()).toEqual(['a', 'l', 'm']);
    round.charges[0].yellow = true;
    round.charges[1].yellow = true;
    expect(possiblePicks(answer, round).has('l')).toBe(false);
  });

  it('places a known letter once every slot is known', () => {
    const answer = 'plato';
    const round = new PlayerRound(0, 90, 5);
    round.charges[0].green = true; // P placed
    for (let i = 1; i < round.charges.length; i++) round.charges[i].yellow = true;
    const picks = possiblePicks(answer, round);
    expect([...picks.keys()].sort()).toEqual(['a', 'l', 'o', 't']);
    for (const [letter, pick] of picks) {
      expect(pick.kind).toBe('position');
      expect(answer[pick.position]).toBe(letter);
      expect(pick.position).toBeGreaterThan(0); // never the green slot
    }
  });

  it('a placement turns the slot green and earns nothing later', () => {
    const answer = 'plato';
    const round = new PlayerRound(0, 90, 5);
    for (let i = 0; i < round.charges.length; i++) round.charges[i].yellow = true;
    const pick = pickHint(answer, round.charges, () => 0);
    expect(pick?.kind).toBe('position');
    round.revealHint(pick!);
    expect(round.hint).toEqual({
      letter: pick!.letter,
      kind: 'position',
      position: pick!.position,
    });
    expect(round.charges[pick!.position].green).toBe(true);
    const gains = chargeGuess(round.charges, answer, computeFeedback(answer, answer));
    expect(gains.some((g) => g.position === pick!.position)).toBe(false);
  });

  it('a letter hint keeps the slot unsaid and charges it as hinted', () => {
    const answer = 'plato';
    const round = new PlayerRound(0, 90, 5);
    const pick = pickHint(answer, round.charges, () => 0);
    expect(pick?.kind).toBe('letter');
    round.revealHint(pick!);
    expect(round.hint).toEqual({ letter: pick!.letter, kind: 'letter', position: null });
    expect(round.charges[pick!.position].hinted).toBe(true);
    expect(round.charges[pick!.position].green).toBe(false);
  });

  it('returns null when every slot is green', () => {
    const answer = 'plato';
    const round = new PlayerRound(0, 90, 5);
    play(round, 'plato', answer);
    expect(pickHint(answer, round.charges, () => 0)).toBeNull();
  });
});
