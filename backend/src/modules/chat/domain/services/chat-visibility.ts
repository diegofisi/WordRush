import type { ChatChannel, ChatMessage } from '@shared/contract';
import type { Player } from '@modules/rooms/domain/entities/player.entity';
import type { Room } from '@modules/rooms/domain/entities/room.entity';

/**
 * Who may write where, and who may read what (docs/context/06-v1.1.md -> Chat).
 *
 * - `team`: team mode only, members of that team, from the first second.
 * - `all` while a round is in play: only those done with it — solved, out of
 *   attempts, out of time, or (team mode) whose team finished — plus the
 *   observers. Everybody still guessing sees stickers only.
 * - `all` between rounds, in the lobby or after the game: everybody.
 *
 * A message written on `all` during play stays hidden from the players who
 * were still guessing until the round ends; then it is history for all.
 */

/** Done with the current round: allowed into the finished players' talk. */
export function isDoneWithRound(room: Room, person: Player): boolean {
  if (person.isObserver) return true;
  if (room.status !== 'playing') return true;
  const team = room.teamOf(person);
  if (team) return team.round?.finished === true;
  return person.round?.finished === true;
}

export function canSend(room: Room, sender: Player, channel: ChatChannel): boolean {
  if (channel === 'team') {
    return room.settings.mode === 'teams' && !sender.isObserver && sender.team !== null;
  }
  return isDoneWithRound(room, sender);
}

export function canRead(room: Room, reader: Player, message: ChatMessage): boolean {
  if (message.channel === 'team') {
    return !reader.isObserver && reader.team !== null && reader.team === message.team;
  }
  // Talk from a round already over is history for everybody.
  if (!message.duringPlay || message.round < room.currentRound) return true;
  return isDoneWithRound(room, reader);
}
