import type { CSSProperties } from 'react';

import type { OwnRow, TileColor } from '@/shared/contract';
import { cn } from '@/shared/lib/cn';

interface BoardProps {
  /** Letters per word and rows on the board, from the round. */
  wordLength: number;
  maxAttempts: number;
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

/**
 * Tile size from the viewport and the board's shape: `cols` tiles plus their
 * gaps across the width, `rows` tiles plus their gaps down the free height.
 * Seven letters on a phone is what the width term is for.
 */
const tileSize = (size: BoardProps['size'], cols: number, rows: number): string => {
  const across = `(100vw - ${size === 'lg' ? 720 : 32}px) / ${(cols + (cols - 1) * 0.14).toFixed(2)}`;
  const down = `(100dvh - ${size === 'lg' ? 420 : 470}px) / ${(rows + (rows - 1) * 0.14).toFixed(2)}`;
  return size === 'lg'
    ? `clamp(34px, min(${across}, ${down}), 56px)`
    : `clamp(30px, min(${across}, ${down}), 44px)`;
};

const FLIP_STAGGER_MS = 110;

/** The own board (attempts × letters): revealed rows, the row being typed and empty rows. The hint
 * never shows here: it only lights its letter on the keyboard. */
export const Board = ({
  wordLength,
  maxAttempts,
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
  const style = { '--tile-size': tileSize(size, wordLength, maxAttempts) } as CSSProperties;
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
      <div className="flex flex-col" style={rowGap} role="grid" aria-rowcount={maxAttempts}>
        {Array.from({ length: maxAttempts }, (_, rowIndex) => {
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
              {Array.from({ length: wordLength }, (_, col) => {
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
