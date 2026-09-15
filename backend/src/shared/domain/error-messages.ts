import type { ErrorCode } from '@shared/contract';

/** Default human-readable message for every contract error code. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  room_not_found: 'Room not found',
  room_full: 'The room is full',
  server_full: 'The server is full right now; try again in a moment',
  game_in_progress: 'The game has already started',
  name_taken: 'That name is already taken in this room',
  invalid_payload: 'Invalid payload',
  not_host: 'Only the host can do that',
  not_enough_players: 'At least two connected players are needed',
  not_in_round: 'There is no round in progress',
  already_finished: 'You have already finished this round',
  word_length: 'The word must have 5 letters',
  word_not_in_list: 'That word is not in the list',
  hint_unavailable: 'Hints are not available',
  hint_already_used: 'You already used your hint this round',
  cooldown: 'Too fast, wait a moment',
  not_in_room: 'You are not in a room',
  already_in_room: 'You are already in another room; leave it first',
  not_in_team: 'That team action needs team mode and a seat in that team.',
  session_expired: 'Your session has expired',
  internal: 'Unexpected server error',
};
