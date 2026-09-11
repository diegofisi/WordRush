import type { TileColor } from '@/shared/contract';
import { WORD_LENGTH } from '@/shared/contract';
import { cn } from '@/shared/lib/cn';

interface MiniBoardProps {
  rows: TileColor[][];
  /** 12 px squares in the panel, 7 px in the phone strip. */
  size?: 'md' | 'xs';
  /** Only the latest row (phone strip). */
  lastRowOnly?: boolean;
}

const colorClass: Record<TileColor, string> = {
  green: 'mini-green',
  yellow: 'mini-yellow',
  gray: 'mini-gray',
};

/** Colours-only board of a rival. */
export const MiniBoard = ({ rows, size = 'md', lastRowOnly = false }: MiniBoardProps) => {
  const shown = lastRowOnly ? rows.slice(-1) : rows;
  const cell = size === 'md' ? 'h-3 w-3 rounded-[3px]' : 'h-1.75 w-1.75 rounded-xs';
  const gap = size === 'md' ? 'gap-0.5' : 'gap-px';
  const rowsToRender = shown.length > 0 ? shown : [Array<TileColor | null>(WORD_LENGTH).fill(null)];
  return (
    <div
      className={cn('grid', gap)}
      style={{ gridTemplateColumns: `repeat(${WORD_LENGTH}, auto)` }}
      aria-hidden="true"
    >
      {rowsToRender.flatMap((row, rowIndex) =>
        Array.from({ length: WORD_LENGTH }, (_, col) => {
          const color = row[col];
          return (
            <span
              key={`${rowIndex}-${col}`}
              className={cn('mini', cell, color ? colorClass[color] : undefined)}
            />
          );
        }),
      )}
    </div>
  );
};
