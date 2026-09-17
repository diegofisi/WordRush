import { useEffect, useState } from 'react';

import { ArrowRightIcon, CheckIcon, PlusIcon } from '@/shared/components/icons/GameIcons';
import { Avatar } from '@/shared/components/ui/Avatar';
import { Button } from '@/shared/components/ui/Button';
import { ROOM_LIMITS, TEAM_COLORS, type TeamColor, type TeamId } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { otherTeam, paintFor, teamLabel } from '@/shared/lib/teamColor';

import type { LobbyPlayerViewModel, LobbyTeamViewModel } from '../models/lobby.model';
import { KickButton } from './KickButton';

interface TeamSlotsProps {
  t: Dictionary;
  teams: LobbyTeamViewModel[];
  capacity: number;
  playerCount: number;
  isHost: boolean;
  pending: boolean;
  onJoin: (team: TeamId) => void;
  onAssign: (playerId: string, team: TeamId) => void;
  onCustomize: (team: TeamId, patch: { name?: string; color?: TeamColor }) => void;
  onResetGames: () => void;
  /** Host only. */
  onKick?: (playerId: string) => void;
}

/** A member's own team name field: typed locally, sent on blur or Enter. */
const TeamNameField = ({
  t,
  team,
  onCustomize,
}: {
  t: Dictionary;
  team: LobbyTeamViewModel;
  onCustomize: TeamSlotsProps['onCustomize'];
}) => {
  const [draft, setDraft] = useState(team.name);
  useEffect(() => setDraft(team.name), [team.name]);
  const commit = () => {
    const name = draft.trim();
    if (name !== team.name) onCustomize(team.id, { name });
  };
  return (
    <input
      value={draft}
      maxLength={ROOM_LIMITS.nameMaxLength}
      placeholder={t.lobby.teamDefault(team.id)}
      aria-label={t.lobby.teamNameLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
      }}
      className={cn(
        'h-9 w-full min-w-0 rounded-[8px] border border-transparent bg-transparent px-2 font-display text-[19px] font-bold tracking-[-0.02em] outline-none transition-colors hover:border-line focus:border-ink focus:bg-surface',
        paintFor(team.color).text,
      )}
    />
  );
};

const MemberRow = ({
  t,
  member,
  team,
  isHost,
  pending,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  onKick,
}: {
  t: Dictionary;
  member: LobbyPlayerViewModel;
  team: LobbyTeamViewModel;
  isHost: boolean;
  pending: boolean;
  /** The host may drag anybody; everybody else only their own card. */
  draggable: boolean;
  /** This very card is the one being dragged. */
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  /** The arrow button and the drop share this one move. */
  onMove: () => void;
  onKick?: TeamSlotsProps['onKick'];
}) => {
  const subtitle = [member.isHost ? t.common.host : null, member.isMe ? t.common.you : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <li
      draggable={draggable && !pending}
      data-player={member.id}
      title={draggable ? t.lobby.dragHint : undefined}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', member.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-surface px-3 py-2.5',
        member.isMe ? 'border-accent/60' : 'border-line',
        !member.connected && 'opacity-60',
        draggable && !pending && 'cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
    >
      <Avatar name={member.name} size={36} tone={paintFor(team.color).avatar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{member.name}</span>
        <span className="text-xs text-ink-3">
          {subtitle || (member.connected ? t.lobby.waiting : t.lobby.disconnected)}
        </span>
      </div>
      {member.ready ? (
        <span className="flex items-center gap-1 rounded-full bg-green-soft px-2 py-1 text-[11px] font-bold text-green-ink">
          <CheckIcon size={12} />
          {t.lobby.ready}
        </span>
      ) : null}
      {draggable ? (
        <button
          type="button"
          disabled={pending}
          onClick={onMove}
          title={t.lobby.moveToOther}
          aria-label={`${member.name}: ${t.lobby.moveToOther}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <ArrowRightIcon size={14} />
        </button>
      ) : null}
      {isHost && onKick && !member.isMe ? (
        <KickButton
          label={t.lobby.kick}
          name={member.name}
          disabled={pending}
          onClick={() => onKick(member.id)}
        />
      ) : null}
    </li>
  );
};

/**
 * Team mode lobby (docs/context/06-v1.1.md -> Teams): two columns, any split.
 * A card is **dragged** from one team to the other — the host drags anybody,
 * everybody else only their own card — and the arrow button does the same move
 * for touch and for the keyboard. A team's members name and colour it. The win
 * counters live here because the room outlives a game.
 */
export const TeamSlots = ({
  t,
  teams,
  capacity,
  playerCount,
  isHost,
  pending,
  onJoin,
  onAssign,
  onCustomize,
  onResetGames,
  onKick,
}: TeamSlotsProps) => {
  const freeSeats = Math.max(0, capacity - playerCount);
  // The card being dragged right now; both panels read it to light the target.
  const [dragging, setDragging] = useState<{ id: string; from: TeamId; isMe: boolean } | null>(
    null,
  );
  const [over, setOver] = useState<TeamId | null>(null);

  /**
   * One move, whatever started it: the host assigns (`team:assign`), anybody
   * else moves themselves (`team:join`). No new server event.
   */
  const move = (player: { id: string; isMe: boolean }, to: TeamId) => {
    if (isHost && !player.isMe) onAssign(player.id, to);
    else if (player.isMe) onJoin(to);
    else onAssign(player.id, to);
  };

  const dropOn = (to: TeamId) => {
    const card = dragging;
    setDragging(null);
    setOver(null);
    if (!card || card.from === to || pending) return;
    move(card, to);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {teams.map((team) => {
          const paint = paintFor(team.color);
          const isTarget = dragging !== null && dragging.from !== team.id;
          return (
            <section
              key={team.id}
              aria-label={teamLabel(t, team)}
              data-team={team.id}
              data-drop-target={isTarget ? 'true' : undefined}
              onDragOver={(event) => {
                if (!isTarget) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (over !== team.id) setOver(team.id);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                setOver((current) => (current === team.id ? null : current));
              }}
              onDrop={(event) => {
                if (!isTarget) return;
                event.preventDefault();
                dropOn(team.id);
              }}
              className={cn(
                'flex flex-col gap-3 rounded-2xl border-2 p-4 transition-colors',
                paint.border,
                paint.soft,
                isTarget && 'border-dashed',
                over === team.id && 'border-accent bg-accent-soft',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                {team.isMine || isHost ? (
                  <TeamNameField t={t} team={team} onCustomize={onCustomize} />
                ) : (
                  <span
                    className={cn(
                      'truncate font-display text-[19px] font-bold tracking-[-0.02em]',
                      paint.text,
                    )}
                  >
                    {teamLabel(t, team)}
                  </span>
                )}
                <span className="shrink-0 text-xs text-ink-3">
                  {t.lobby.membersCount(team.members.length)}
                </span>
              </div>

              {team.isMine || isHost ? (
                <div
                  className="flex items-center gap-1.5"
                  role="radiogroup"
                  aria-label={t.lobby.teamColor}
                >
                  {TEAM_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      role="radio"
                      aria-checked={color === team.color}
                      aria-label={t.lobby.colorName[color]}
                      title={t.lobby.colorName[color]}
                      disabled={pending}
                      onClick={() => onCustomize(team.id, { color })}
                      className={cn(
                        'h-6 w-6 rounded-full border-2 transition-transform',
                        paintFor(color).swatch,
                        color === team.color ? 'scale-110 border-ink' : 'border-transparent',
                      )}
                    />
                  ))}
                </div>
              ) : null}

              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {team.members.map((member) => (
                  <MemberRow
                    key={member.id}
                    t={t}
                    member={member}
                    team={team}
                    isHost={isHost}
                    pending={pending}
                    draggable={isHost || member.isMe}
                    dragging={dragging?.id === member.id}
                    onDragStart={() =>
                      setDragging({ id: member.id, from: team.id, isMe: member.isMe })
                    }
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onMove={() => move(member, otherTeam(team.id))}
                    onKick={onKick}
                  />
                ))}
                {team.members.length === 0 ? (
                  <li className="rounded-xl border-[1.5px] border-dashed border-line-dashed px-3 py-3 text-center text-[13px] text-ink-3">
                    {isTarget ? t.lobby.dropHere : t.lobby.noMembers}
                  </li>
                ) : null}
              </ul>

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-line/60 pt-3">
                <span className="text-xs text-ink-2">
                  <span className="font-mono font-bold text-ink">{team.roundsWon}</span>{' '}
                  {t.lobby.roundsWon} ·{' '}
                  <span className="font-mono font-bold text-ink">{team.gamesWon}</span>{' '}
                  {t.lobby.gamesWon}
                </span>
                {!team.isMine ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onJoin(team.id)}
                    leading={<PlusIcon size={14} />}
                  >
                    {t.lobby.joinTeam}
                  </Button>
                ) : (
                  <span className="text-xs font-bold text-ink-3">{t.lobby.yourTeam}</span>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-3">
        <span>
          {t.lobby.freeSeats(freeSeats)} · {t.lobby.dragHint}
        </span>
        {isHost ? (
          <button
            type="button"
            disabled={pending}
            onClick={onResetGames}
            className="text-xs font-semibold text-ink-2 underline-offset-2 hover:underline disabled:opacity-50"
          >
            {t.lobby.resetGames}
          </button>
        ) : null}
      </div>
    </div>
  );
};
