import { Avatar } from '@/shared/components/ui/Avatar';
import { Button } from '@/shared/components/ui/Button';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { LobbyObserverViewModel } from '../models/lobby.model';
import { KickButton } from './KickButton';

interface ObserverAreaProps {
  t: Dictionary;
  observers: LobbyObserverViewModel[];
  /** Seats not taken; an observer sits at once while there is one. */
  freeSeats: number;
  pending: boolean;
  onSit: (wants: boolean) => void;
  /** Host only. */
  onKick?: (playerId: string) => void;
}

/**
 * docs/context/06-v1.1.md -> Observers: their own area under the slots. They
 * joined a running game; in the lobby they take a free seat when they want to.
 */
export const ObserverArea = ({
  t,
  observers,
  freeSeats,
  pending,
  onSit,
  onKick,
}: ObserverAreaProps) => {
  if (observers.length === 0) return null;
  return (
    <section
      aria-label={t.lobby.observers}
      className="flex flex-col gap-2.5 rounded-2xl border border-dashed border-line-dashed px-4 py-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="label">{t.lobby.observers}</span>
        <span className="text-xs text-ink-3">{t.lobby.observersHint}</span>
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {observers.map((observer) => (
          <li
            key={observer.id}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border bg-surface py-2 pr-3 pl-2',
              observer.isMe ? 'border-accent/60' : 'border-line',
              !observer.connected && 'opacity-60',
            )}
          >
            <Avatar name={observer.name} size={30} tone="neutral" />
            <span className="flex flex-col">
              <span className="text-sm font-semibold">
                {observer.name}
                {observer.isMe ? (
                  <span className="ml-1.5 text-[11px] font-bold text-accent">{t.common.you}</span>
                ) : null}
              </span>
              <span className="text-[11px] text-ink-3">
                {observer.wantsSeat ? t.lobby.wantsSeat : t.lobby.observing}
              </span>
            </span>
            {observer.isMe ? (
              <Button
                size="sm"
                variant={observer.wantsSeat ? 'outline' : 'primary'}
                disabled={pending}
                onClick={() => onSit(freeSeats > 0 ? true : !observer.wantsSeat)}
                className="ml-2"
              >
                {freeSeats > 0
                  ? t.lobby.takeSeat
                  : observer.wantsSeat
                    ? t.lobby.stayObserving
                    : t.lobby.sitNextRound}
              </Button>
            ) : null}
            {onKick && !observer.isMe ? (
              <KickButton
                label={t.lobby.kick}
                name={observer.name}
                disabled={pending}
                onClick={() => onKick(observer.id)}
                className="ml-1"
              />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
};
