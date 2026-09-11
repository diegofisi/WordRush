interface RoomContextProps {
  code: string;
  parts?: (string | null | undefined)[];
}

/** "KX7P · Ronda 2 de 3 · Español" for the top bar. */
export const RoomContext = ({ code, parts = [] }: RoomContextProps) => (
  <>
    <span className="font-mono font-semibold text-ink">{code}</span>
    {parts.filter(Boolean).map((part) => (
      <span key={part} className="flex items-center gap-2">
        <span aria-hidden="true">·</span>
        <span className="truncate">{part}</span>
      </span>
    ))}
  </>
);
