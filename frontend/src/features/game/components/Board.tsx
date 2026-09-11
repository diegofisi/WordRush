import type { CSSProperties } from 'react';

import { MAX_ATTEMPTS, WORD_LENGTH, type OwnRow } from '@/shared/contract';
import { cn } from '@/shared/lib/cn';

interface BoardProps {
  rows: OwnRow[];
  draft: string;
  revealRow: number | null;
  shakeKey: number;
  /** No current row is editable once finished. */
  finished: boolean;
  size: 'lg' | 'sm';
}

const TILE_SIZE: Record<BoardProps['size'], string> = {
  lg: 'clamp(40px, min(10vw, (100dvh - 420px) / 8.9), 56px)',
  sm: 'clamp(36px, min(10.5vw, (100dvh - 470px) / 8.9), 44px)',
};

const FLIP_STAGGER_MS = 110;

/** 8×5 own board: revealed rows, the row being typed and empty rows. The hint
 * never shows here: it only lights its letter on the keyboard. */
export const Board = ({ rows, draft, revealRow, shakeKey, finished, size }: BoardProps) => {
  const currentRow = finished ? -1 : rows.length;
  const style = {
    '--tile-size': TILE_SIZE[size],
    gap: 'calc(var(--tile-size) * 0.14)',
  } as CSSProperties;
  const tileStyle = {
    width: 'var(--tile-size)',
    height: 'var(--tile-size)',
    fontSize: 'calc(var(--tile-size) * 0.5)',
    borderRadius: 'calc(var(--tile-size) * 0.18)',
  } as CSSProperties;

  return (
    <div className="flex flex-col" style={style} role="grid" aria-rowcount={MAX_ATTEMPTS}>
      {Array.from({ length: MAX_ATTEMPTS }, (_, rowIndex) => {
        const revealed = rows[rowIndex];
        const isCurrent = rowIndex === currentRow;
        const isReveal = revealed && rowIndex === revealRow;
        return (
          <div
            key={isCurrent ? `row-${rowIndex}-${shakeKey}` : `row-${rowIndex}`}
            role="row"
            className={cn('flex', isCurrent && shakeKey > 0 && 'animate-shake')}
            style={{ gap: 'calc(var(--tile-size) * 0.14)' }}
          >
            {Array.from({ length: WORD_LENGTH }, (_, col) => {
              if (revealed) {
                const letter = revealed.word[col]?.toUpperCase() ?? '';
                const color = revealed.colors[col] ?? 'gray';
                return (
                  <div
                    key={col}
                    role="gridcell"
                    className={cn('tile', `tile-${color}`, isReveal && 'animate-tile-flip')}
                    style={{
                      ...tileStyle,
                      animationDelay: isReveal ? `${col * FLIP_STAGGER_MS}ms` : undefined,
                    }}
                  >
                    {letter}
                  </div>
                );
              }
              if (isCurrent) {
                const typed = draft[col];
                if (typed) {
                  return (
                    <div
                      key={`${col}-${typed}`}
                      role="gridcell"
                      className="tile tile-filled animate-tile-pop"
                      style={tileStyle}
                    >
                      {typed}
                    </div>
                  );
                }
              }
              return <div key={col} role="gridcell" className="tile" style={tileStyle} />;
            })}
          </div>
        );
      })}
    </div>
  );
};
