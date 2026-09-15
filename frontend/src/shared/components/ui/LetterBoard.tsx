import type { OwnRow, TileColor } from '@/shared/contract';
import { cn } from '@/shared/lib/cn';

interface LetterBoardProps {
  wordLength: number;
  rows: OwnRow[];
  /** 22 px tiles, or 14 px for strips. */
  size?: 'md' | 'xs';
  lastRowOnly?: boolean;
  /** Wording for the colour of a tile, for screen readers. */
  colorLabels: Record<TileColor, string>;
}

const colorClass: Record<TileColor, string> = {
  green: 'tile-green',
  yellow: 'tile-yellow',
  gray: 'tile-gray',
};

/**
 * A small board with letters: a teammate's live board, or anybody's once the
 * round is over and the word is public. Never used for a rival mid-round.
 */
export const LetterBoard = ({
  wordLength,
  rows,
  size = 'md',
  lastRowOnly = false,
  colorLabels,
}: LetterBoardProps) => {
  const shown = lastRowOnly ? rows.slice(-1) : rows;
  const cell =
    size === 'md'
      ? 'h-5.5 w-5.5 rounded-[4px] text-[11px]'
      : 'h-3.5 w-3.5 rounded-[3px] text-[8px]';
  const gap = size === 'md' ? 'gap-0.75' : 'gap-px';
  if (shown.length === 0) {
    return (
      <div
        className={cn('grid', gap)}
        style={{ gridTemplateColumns: `repeat(${wordLength}, auto)` }}
        aria-hidden="true"
      >
        {Array.from({ length: wordLength }, (_, col) => (
          <span key={col} className={cn('tile', cell)} />
        ))}
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col', gap)} role="grid">
      {shown.map((row, rowIndex) => (
        <div key={rowIndex} className={cn('flex', gap)} role="row">
          {Array.from({ length: wordLength }, (_, col) => {
            const letter = row.word[col]?.toUpperCase() ?? '';
            const color = row.colors[col] ?? 'gray';
            return (
              <span
                key={col}
                role="gridcell"
                aria-label={`${letter}, ${colorLabels[color]}`}
                className={cn('tile font-bold', cell, colorClass[color])}
              >
                {letter}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
