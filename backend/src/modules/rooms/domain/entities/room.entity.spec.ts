import { ROOM_LIMITS, type RoomSettings } from '@shared/contract';
import { Room } from './room.entity';

const SETTINGS: RoomSettings = {
  language: 'es',
  game: 'wordle',
  mode: 'normal',
  wordLength: 5,
  initialSeconds: 60,
  rounds: 3,
  capacity: 8,
  hintEnabled: true,
};

/**
 * docs/context/06-v1.1.md -> Room management: the kicked name waits 30 s, and
 * the refusal has to say how much of that is left (the join view counts it
 * down, so the number is the message).
 */
describe('Room: how long a kicked name still has to wait', () => {
  const now = 1_000_000;
  const block = 1000 * ROOM_LIMITS.kickRejoinSeconds;

  const kicked = (name = 'Bruno') => {
    const room = Room.create('ABCD', SETTINGS, now);
    room.blockName(name, now + block);
    return room;
  };

  it('is the whole block the moment the kick lands', () => {
    expect(kicked().nameBlockSecondsLeft('Bruno', now)).toBe(ROOM_LIMITS.kickRejoinSeconds);
  });

  it('counts down with the clock', () => {
    const room = kicked();
    expect(room.nameBlockSecondsLeft('Bruno', now + 18_000)).toBe(12);
    expect(room.nameBlockSecondsLeft('Bruno', now + 29_000)).toBe(1);
  });

  it('rounds a part of a second up, so a refusal never says "0 seconds"', () => {
    const room = kicked();
    expect(room.nameBlockSecondsLeft('Bruno', now + 29_400)).toBe(1);
    expect(room.nameBlockSecondsLeft('Bruno', now + block - 1)).toBe(1);
  });

  it('is 0 once the block is over, and the name is forgotten', () => {
    const room = kicked();
    expect(room.nameBlockSecondsLeft('Bruno', now + block)).toBe(0);
    expect(room.isNameBlocked('Bruno', now)).toBe(false);
  });

  it('is 0 for a name nobody kicked, and ignores case and spaces', () => {
    const room = kicked();
    expect(room.nameBlockSecondsLeft('Ana', now)).toBe(0);
    expect(room.nameBlockSecondsLeft('  bruno ', now + 10_000)).toBe(20);
  });
});
