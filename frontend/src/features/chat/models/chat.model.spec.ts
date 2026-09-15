import { describe, expect, it } from 'vitest';

import type { ChatMessage } from '@/shared/contract';

import { toChatMessageViewModels } from './chat.model';

const message = (over: Partial<ChatMessage>): ChatMessage => ({
  id: 1,
  round: 1,
  playerId: 'p1',
  name: 'Ana',
  observer: false,
  team: null,
  channel: 'all',
  text: 'hola',
  at: Date.UTC(2026, 8, 15, 12, 0),
  duringPlay: false,
  ...over,
});

describe('toChatMessageViewModels', () => {
  it('prints a round divider before the first message of every round', () => {
    const rows = toChatMessageViewModels(
      [
        message({ id: 1, round: 0 }),
        message({ id: 2, round: 1 }),
        message({ id: 3, round: 1 }),
        message({ id: 4, round: 2 }),
      ],
      'p1',
      null,
    );
    expect(rows.map((row) => row.startsRound)).toEqual([false, true, false, true]);
  });

  it('marks my messages and my teammates', () => {
    const rows = toChatMessageViewModels(
      [
        message({ id: 1, playerId: 'p1', team: 'a' }),
        message({ id: 2, playerId: 'p2', team: 'b' }),
      ],
      'p1',
      'a',
    );
    expect(rows[0]).toMatchObject({ isMe: true, isTeammate: true });
    expect(rows[1]).toMatchObject({ isMe: false, isTeammate: false });
  });
});
