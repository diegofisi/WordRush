import { Avatar } from '@/shared/components/ui/Avatar';
import { Card } from '@/shared/components/ui/Card';
import { LetterBoard } from '@/shared/components/ui/LetterBoard';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { paintFor } from '@/shared/lib/teamColor';

import type { BoardViewModel } from '../models/results.model';

interface RoundBoardsProps {
  t: Dictionary;
  wordLength: number;
  boards: BoardViewModel[];
}

/** Every board of the round with its letters, now that the word is public. */
export const RoundBoards = ({ t, wordLength, boards }: RoundBoardsProps) => {
  if (boards.length === 0) return null;
  const labels = {
    green: t.game.tileCorrect,
    yellow: t.game.tilePresent,
    gray: t.game.tileAbsent,
  };
  return (
    <Card className="flex flex-col gap-3 px-5 pt-4 pb-4">
      <span className="label">{t.results.boards}</span>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
        {boards.map((board) => {
          const paint = board.color ? paintFor(board.color) : null;
          return (
            <li
              key={board.playerId}
              className={cn(
                'flex flex-col gap-2 rounded-xl border p-2.5',
                board.solved ? 'border-green/50 bg-green-soft' : 'border-line',
                board.isMe && 'ring-2 ring-accent/50',
              )}
            >
              <div className="flex items-center gap-2">
                <Avatar
                  name={board.name}
                  size={24}
                  tone={board.solved ? 'green' : (paint?.avatar ?? 'neutral')}
                />
                <span className="truncate text-[13px] font-semibold">{board.name}</span>
                <span className="ml-auto text-[11px] text-ink-3">
                  {board.solved
                    ? t.results.boardSolved(board.rows.length)
                    : t.results.boardAttempts(board.rows.length)}
                </span>
              </div>
              <LetterBoard wordLength={wordLength} rows={board.rows} colorLabels={labels} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
};
