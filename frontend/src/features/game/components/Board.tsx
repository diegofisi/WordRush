import type { CSSProperties } from 'react';

import { MAX_ATTEMPTS, WORD_LENGTH, type OwnRow, type TileColor } from '@/shared/contract';
import { cn } from '@/shared/lib/cn';

interface BoardProps {
  rows: OwnRow[];
  draft: string;
  revealRow: number | null;
  shakeKey: number;
  /** No current row is editable once finished. */
  finished: boolean;
  /** Guess error printed under the row being typed; the id restarts the fade. */
  notice?: { id: number; text: string } | null;
  /** Wording for the colour of a revealed tile; the colour alone is invisible
   * to a screen reader, so every revealed tile is labelled "C, correcta". */
  colorLabels: Record<TileColor, string>;
  size: 'lg' | 'sm';
}

const TILE_SIZE: Record<BoardProps['size'], string> = {
  lg: 'clamp(40px, min(10vw, (100dvh - 420px) / 8.9), 56px)',
  sm: 'clamp(36px, min(10.5vw, (100dvh - 470px) / 8.9), 44px)',
};

const FLIP_STAGGER_MS = 110;

/** 8×5 own board: revealed rows, the row being typed and empty rows. The hint
 * never shows here: it only lights its letter on the keyboard. */
export const Board = ({
  rows,
  draft,
  revealRow,
  shakeKey,
  finished,
  notice = null,
  colorLabels,
  size,
}: BoardProps) => {
  const currentRow = finished ? -1 : rows.length;
  const style = { '--tile-size': TILE_SIZE[size] } as CSSProperties;
  const rowGap = { gap: 'calc(var(--tile-size) * 0.14)' } as CSSProperties;
  const tileStyle = {
    width: 'var(--tile-size)',
    height: 'var(--tile-size)',
    fontSize: 'calc(var(--tile-size) * 0.5)',
    borderRadius: 'calc(var(--tile-size) * 0.18)',
  } as CSSProperties;

  // The caption hangs off a wrapper instead of the grid so `role="grid"` keeps
  // owning nothing but rows. Its offset is the rows above it plus the gap plus
  // a bit of a tile, so it lands centred in the band of the next empty row
  // rather than on its top edge.
  const noticeTop = `calc(${currentRow + 1} * var(--tile-size) + ${currentRow} * var(--tile-size) * 0.14 + var(--tile-size) * 0.42)`;

  return (
    <div className="relative" style={style}>
      <div className="flex flex-col" style={rowGap} role="grid" aria-rowcount={MAX_ATTEMPTS}>
        {Array.from({ length: MAX_ATTEMPTS }, (_, rowIndex) => {
          const revealed = rows[rowIndex];
          const isCurrent = rowIndex === currentRow;
          const isReveal = revealed && rowIndex === revealRow;
          return (
            <div
              key={isCurrent ? `row-${rowIndex}-${shakeKey}` : `row-${rowIndex}`}
              role="row"
              className={cn('flex', isCurrent && shakeKey > 0 && 'animate-shake')}
              style={rowGap}
            >
              {Array.from({ length: WORD_LENGTH }, (_, col) => {
                if (revealed) {
                  const letter = revealed.word[col]?.toUpperCase() ?? '';
                  const color = revealed.colors[col] ?? 'gray';
                  return (
                    <div
                      key={col}
                      role="gridcell"
                      aria-label={`${letter}, ${colorLabels[color]}`}
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
      {notice && currentRow >= 0 ? (
        <div
          key={notice.id}
          role="alert"
          style={{ top: noticeTop }}
          className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-lg bg-red-soft px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-red shadow-card animate-caption-flash"
        >
          {notice.text}
        </div>
      ) : null}
    </div>
  );
};
