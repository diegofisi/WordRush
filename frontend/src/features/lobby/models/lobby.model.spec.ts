import { describe, expect, it } from 'vitest';

import type { LobbyState } from '@/shared/contract';

import { toLobbyViewModel } from './lobby.model';

const lobby = (over: Partial<LobbyState> = {}): LobbyState => ({
  code: 'ABCD',
  status: 'lobby',
  settings: {
    language: 'es',
    game: 'wordle',
    mode: 'teams',
    wordLength: 5,
    initialSeconds: 90,
    rounds: 3,
    capacity: 8,
    hintEnabled: true,
  },
  players: [
    { id: 'p1', name: 'Ana', isHost: true, ready: false, connected: true, team: 'a' },
    { id: 'p2', name: 'Bruno', isHost: false, ready: true, connected: true, team: 'b' },
    { id: 'p3', name: 'Carla', isHost: false, ready: false, connected: false, team: 'a' },
  ],
  teams: [
    { id: 'a', name: '', color: 'violet', roundsWon: 1, gamesWon: 0 },
    { id: 'b', name: 'Lobos', color: 'green', roundsWon: 0, gamesWon: 2 },
  ],
  observers: [{ id: 'o1', name: 'Olga', connected: true, wantsSeat: true }],
  ...over,
});

describe('toLobbyViewModel · teams', () => {
  it('groups the players under their team and marks mine', () => {
    const vm = toLobbyViewModel(lobby(), 'p3');
    expect(vm.mode).toBe('teams');
    expect(vm.teams.map((team) => team.members.map((member) => member.name))).toEqual([
      ['Ana', 'Carla'],
      ['Bruno'],
    ]);
    expect(vm.teams.map((team) => team.isMine)).toEqual([true, false]);
    expect(vm.teams[1]?.name).toBe('Lobos');
    expect(vm.teams[1]?.gamesWon).toBe(2);
  });

  it('knows whether I sit or observe', () => {
    expect(toLobbyViewModel(lobby(), 'o1')).toMatchObject({
      role: 'observer',
      me: null,
      freeSeats: 5,
    });
    expect(toLobbyViewModel(lobby(), 'p1').role).toBe('player');
    expect(toLobbyViewModel(lobby(), 'p1').observers[0]).toMatchObject({
      name: 'Olga',
      wantsSeat: true,
      isMe: false,
    });
  });

  it('has no teams in the normal mode', () => {
    const state = lobby({ teams: [] });
    state.settings = { ...state.settings, mode: 'normal' };
    const vm = toLobbyViewModel(state, 'p1');
    expect(vm.mode).toBe('normal');
    expect(vm.teams).toEqual([]);
    expect(vm.playerCount).toBe(3);
  });
});
