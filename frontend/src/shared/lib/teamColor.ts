import type { TeamColor, TeamId, TeamPublic } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import type { AvatarTone } from './avatarTone';

/** Tailwind classes for each team colour; every one maps to a palette token. */
export interface TeamPaint {
  text: string;
  bg: string;
  soft: string;
  border: string;
  swatch: string;
  avatar: AvatarTone;
}

const PAINT: Record<TeamColor, TeamPaint> = {
  violet: {
    text: 'text-accent',
    bg: 'bg-accent',
    soft: 'bg-accent-soft',
    border: 'border-accent',
    swatch: 'bg-accent',
    avatar: 'accent',
  },
  gold: {
    text: 'text-yellow-deep',
    bg: 'bg-yellow',
    soft: 'bg-yellow-soft',
    border: 'border-yellow',
    swatch: 'bg-yellow',
    avatar: 'yellow',
  },
  green: {
    text: 'text-green-ink',
    bg: 'bg-green',
    soft: 'bg-green-soft',
    border: 'border-green',
    swatch: 'bg-green',
    avatar: 'green',
  },
  red: {
    text: 'text-red',
    bg: 'bg-red',
    soft: 'bg-red-soft',
    border: 'border-red',
    swatch: 'bg-red',
    avatar: 'red',
  },
  blue: {
    text: 'text-team-blue-ink',
    bg: 'bg-team-blue',
    soft: 'bg-team-blue-soft',
    border: 'border-team-blue',
    swatch: 'bg-team-blue',
    avatar: 'blue',
  },
  pink: {
    text: 'text-team-pink-ink',
    bg: 'bg-team-pink',
    soft: 'bg-team-pink-soft',
    border: 'border-team-pink',
    swatch: 'bg-team-pink',
    avatar: 'pink',
  },
};

export const paintFor = (color: TeamColor): TeamPaint => PAINT[color];

/** The team's own name, or the translated default ("Equipo A") while it has none. */
export const teamLabel = (t: Dictionary, team: Pick<TeamPublic, 'id' | 'name'>): string =>
  team.name.trim() || t.lobby.teamDefault(team.id);

export const otherTeam = (id: TeamId): TeamId => (id === 'a' ? 'b' : 'a');
