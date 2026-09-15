import { CheckIcon, PlusIcon } from '@/shared/components/icons/GameIcons';
import { Avatar } from '@/shared/components/ui/Avatar';
import { toneForName } from '@/shared/lib/avatarTone';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { LobbyPlayerViewModel } from '../models/lobby.model';

interface PlayerSlotsProps {
  t: Dictionary;
  players: LobbyPlayerViewModel[];
  capacity: number;
}

const ReadyBadge = ({ label }: { label: string }) => (
  <span className="flex items-center gap-1.5 rounded-full bg-green-soft px-2.5 py-1.25 text-xs font-bold text-green-ink">
    <CheckIcon size={14} />
    {label}
  </span>
);

const WaitingBadge = ({ label }: { label: string }) => (
  <span className="rounded-full bg-surface-2 px-2.5 py-1.25 text-xs font-semibold text-ink-3">
    {label}
  </span>
);

export const PlayerSlots = ({ t, players, capacity }: PlayerSlotsProps) => {
  // Capacity is human seats: the fly sits beside them, she does not fill one.
  const humans = players.filter((player) => !player.isBot);
  const boss = players.find((player) => player.isBot) ?? null;
  const emptyCount = Math.max(0, capacity - humans.length);
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-3.5 p-0 md:grid-cols-3 xl:grid-cols-4">
      {humans.map((player, index) => {
        const subtitle = [player.isHost ? t.common.host : null, player.isMe ? t.common.you : null]
          .filter(Boolean)
          .join(' · ');
        return (
          <li
            key={player.id}
            className={cn(
              'flex min-h-37.5 flex-col gap-3.5 rounded-2xl border bg-surface p-4 sm:p-5',
              player.isMe ? 'border-accent/60' : 'border-line',
              !player.connected && 'opacity-60',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <Avatar
                name={player.name}
                size={48}
                tone={player.isMe ? 'accent' : toneForName(player.name, index)}
              />
              {player.ready ? (
                <ReadyBadge label={t.lobby.ready} />
              ) : (
                <WaitingBadge label={player.connected ? t.lobby.waiting : t.lobby.disconnected} />
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="truncate text-[17px] font-bold">{player.name}</span>
              <span className="text-[13px] text-ink-3">{subtitle || ' '}</span>
            </div>
          </li>
        );
      })}
      {boss ? (
        <li
          key={boss.id}
          className="flex min-h-37.5 flex-col gap-3.5 rounded-2xl border border-accent/60 bg-accent-soft p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <Avatar name={t.game.boss} size={48} tone="ink" />
            <span className="rounded-full bg-surface px-2.5 py-1.25 text-xs font-bold text-accent">
              {t.lobby.bossOn}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-[17px] font-bold">{t.game.boss}</span>
            <span className="text-[13px] text-ink-3">{t.home.bossToggleHint}</span>
          </div>
        </li>
      ) : null}
      {Array.from({ length: emptyCount }, (_, index) => (
        <li
          key={`empty-${index}`}
          className="flex min-h-37.5 flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line-dashed p-5"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-dashed border-line-dashed text-faint">
            <PlusIcon size={20} />
          </span>
          <span className="text-[13px] text-ink-3">{t.lobby.freeSlot}</span>
        </li>
      ))}
    </ul>
  );
};
