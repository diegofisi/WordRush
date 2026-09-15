import type {
  GameMode,
  LobbyState,
  Role,
  RoomSettings,
  RoomStatus,
  TeamColor,
  TeamId,
} from '@/shared/contract';

export interface LobbyPlayerViewModel {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  isMe: boolean;
  /** Team mode only. */
  team: TeamId | null;
}

export interface LobbyTeamViewModel {
  id: TeamId;
  /** As the members typed it; empty means "use the default label". */
  name: string;
  color: TeamColor;
  roundsWon: number;
  gamesWon: number;
  members: LobbyPlayerViewModel[];
  isMine: boolean;
}

export interface LobbyObserverViewModel {
  id: string;
  name: string;
  connected: boolean;
  wantsSeat: boolean;
  isMe: boolean;
}

export interface LobbyViewModel {
  code: string;
  status: RoomStatus;
  settings: RoomSettings;
  mode: GameMode;
  players: LobbyPlayerViewModel[];
  /** Both teams in team mode; empty otherwise. */
  teams: LobbyTeamViewModel[];
  /** Joined a running game (docs/context/06-v1.1.md -> Observers). */
  observers: LobbyObserverViewModel[];
  /** Whether I hold a seat or watch. */
  role: Role;
  hostName: string;
  isHost: boolean;
  /** Null while I observe. */
  me: LobbyPlayerViewModel | null;
  readyCount: number;
  playerCount: number;
  /** Seated players with a live socket. */
  connectedCount: number;
  freeSeats: number;
}

export const toLobbyViewModel = (dto: LobbyState, myId: string | null): LobbyViewModel => {
  const players = dto.players.map((player) => ({
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    ready: player.ready,
    connected: player.connected,
    isMe: player.id === myId,
    team: player.team,
  }));
  const me = players.find((player) => player.isMe) ?? null;
  const teams = (dto.teams ?? []).map((team) => ({
    id: team.id,
    name: team.name,
    color: team.color,
    roundsWon: team.roundsWon,
    gamesWon: team.gamesWon,
    members: players.filter((player) => player.team === team.id),
    isMine: me?.team === team.id,
  }));
  const observers = (dto.observers ?? []).map((observer) => ({
    id: observer.id,
    name: observer.name,
    connected: observer.connected,
    wantsSeat: observer.wantsSeat,
    isMe: observer.id === myId,
  }));
  return {
    code: dto.code,
    status: dto.status,
    settings: dto.settings,
    mode: dto.settings.mode,
    players,
    teams,
    observers,
    role: observers.some((observer) => observer.isMe) ? 'observer' : 'player',
    hostName: players.find((player) => player.isHost)?.name ?? '',
    isHost: me?.isHost ?? false,
    me,
    readyCount: players.filter((player) => player.ready).length,
    playerCount: players.length,
    connectedCount: players.filter((player) => player.connected).length,
    freeSeats: Math.max(0, dto.settings.capacity - players.length),
  };
};
