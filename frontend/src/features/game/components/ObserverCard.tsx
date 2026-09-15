import { Eye } from 'lucide-react';

import { Button } from '@/shared/components/ui/Button';
import { Card } from '@/shared/components/ui/Card';
import type { Dictionary } from '@/shared/i18n';

import type { ObserverViewProps } from '../models/game-view.model';

interface ObserverCardProps {
  t: Dictionary;
  observer: ObserverViewProps;
}

/**
 * What an observer gets where the board would be (docs/context/06-v1.1.md ->
 * Observers): they watch the boards, and may ask for a seat at the next round.
 */
export const ObserverCard = ({ t, observer }: ObserverCardProps) => (
  <Card
    role="status"
    className="flex w-full max-w-130 flex-col items-center gap-3 px-5 py-6 text-center animate-fade-in"
  >
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-2">
      <Eye size={24} aria-hidden="true" />
    </span>
    <span className="font-display text-xl font-bold tracking-[-0.02em]">
      {t.game.observingTitle}
    </span>
    <span className="text-sm text-ink-2">{t.game.observingBody}</span>
    <span className="text-xs text-ink-3">
      {observer.freeSeats > 0 ? t.game.freeSeatsNext(observer.freeSeats) : t.game.noFreeSeats}
    </span>
    <Button
      size="md"
      variant={observer.wantsSeat ? 'outline' : 'primary'}
      disabled={observer.pending}
      onClick={() => observer.onSit(!observer.wantsSeat)}
    >
      {observer.wantsSeat ? t.game.stayObserving : t.game.sitNextRound}
    </Button>
  </Card>
);
