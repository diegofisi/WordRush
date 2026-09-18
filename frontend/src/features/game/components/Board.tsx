import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import type { HintReveal, OwnRow, TileColor } from '@/shared/contract';
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
  /** A placement hint: its slot shows the letter, green and dashed, until typed. */
  hint?: HintReveal | null;
  /** Guess error printed under the row being typed; the id restarts the fade. */
  notice?: { id: number; text: string } | null;
  /** Wording for the colour of a revealed tile; the colour alone is invisible
   * to a screen reader, so every revealed tile is labelled "C, correcta". */
  colorLabels: Record<TileColor | 'hint', string>;
  /** Which pair of limits the tile is clamped to: `lg` desktop, `sm` phone. */
  size: 'lg' | 'sm';
}

/** The gap between tiles, as a share of the tile. */
const GAP = 0.14;

/**
 * Smallest and largest tile per variant (2026-09-18). The minimums are the ones
 * the board has always had; the desktop maximum is 1.3× the old 56 px, which is
 * what lets a four-row phrase board grow on a tall window. The phone keeps its
 * old 44 px ceiling — it never gets near it anyway, the column is what limits
 * it there.
 */
const LIMITS: Record<BoardProps['size'], { min: number; max: number }> = {
  lg: { min: 34, max: 73 },
  sm: { min: 30, max: 44 },
};

/** `n` tiles plus their gaps, in tiles: the divisor of the space they share. */
const span = (n: number) => n + (n - 1) * GAP;

/**
 * Tile size from the space the board is actually given, not from the viewport:
 * `cols` tiles plus their gaps across the free width, `rows` tiles plus their
 * gaps down the free height. Seven letters on a phone is what the width term is
 * for. Rounded to the half pixel so a resize cannot shiver.
 */
const fitTile = (
  size: BoardProps['size'],
  cols: number,
  rows: number,
  width: number,
  height: number,
): number => {
  const { min, max } = LIMITS[size];
  const fits = Math.min(width / span(cols), height / span(rows));
  return Math.min(max, Math.max(min, Math.round(fits * 2) / 2));
};

/**
 * The value the first paint uses, before the box has been measured: the same
 * formula in container units. It is right wherever the board's column has a
 * definite height (every desktop layout); on the phone the shell is
 * `min-h-full`, so `100cqh` is 0 there and the measurement is what settles it.
 */
const initialTileSize = (size: BoardProps['size'], cols: number, rows: number): string =>
  `clamp(${LIMITS[size].min}px, min(100cqw / ${span(cols).toFixed(2)}, 100cqh / ${span(rows).toFixed(2)}), ${LIMITS[size].max}px)`;

/** The board at its smallest: the floor of the area, so a short screen scrolls
 * instead of running the board under the keyboard. */
const minAreaHeight = (size: BoardProps['size'], rows: number): string =>
  `${(LIMITS[size].min * span(rows)).toFixed(1)}px`;

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
  hint = null,
  notice = null,
  colorLabels,
  size,
}: BoardProps) => {
  const currentRow = finished ? -1 : rows.length;

  // The board is drawn to the box it is given (2026-09-18). `.board-area` is a
  // size container, so what it holds can never push the box it is measured
  // from: reading it back is stable, never a loop.
  const areaRef = useRef<HTMLDivElement>(null);
  const [tile, setTile] = useState<number | null>(null);
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const read = () => {
      const box = area.getBoundingClientRect();
      setTile(fitTile(size, wordLength, maxAttempts, box.width, box.height));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(area);
    return () => observer.disconnect();
  }, [size, wordLength, maxAttempts]);

  const style = {
    '--tile-size': tile === null ? initialTileSize(size, wordLength, maxAttempts) : `${tile}px`,
  } as CSSProperties;
  const rowGap = { gap: `calc(var(--tile-size) * ${GAP})` } as CSSProperties;
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
    // The outer box is the size container the tile is measured against: it
    // takes the free height of the column it sits in (2026-09-18), never less
    // than the board at its smallest.
    <div
      ref={areaRef}
      className="board-area flex w-full min-w-0 flex-1 items-center justify-center"
      style={{ minHeight: minAreaHeight(size, maxAttempts) }}
    >
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
                    if (!typed && hint?.kind === 'position' && hint.position === col) {
                      return (
                        <div
                          key={`${col}-placed`}
                          role="gridcell"
                          aria-label={`${hint.letter.toUpperCase()}, ${colorLabels.hint}`}
                          className="tile tile-placed"
                          style={tileStyle}
                        >
                          {hint.letter.toUpperCase()}
                        </div>
                      );
                    }
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
    </div>
  );
};
