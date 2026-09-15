import { toDataURL } from 'qrcode';
import { useEffect, useState } from 'react';

interface RoomQrProps {
  /** The invitation link the QR encodes. */
  link: string;
  label: string;
}

/**
 * The room link as a QR for phones (docs/context/06-v1.1.md -> Room
 * management). Rendered on the client from the link; nothing leaves the page.
 */
export const RoomQr = ({ link, label }: RoomQrProps) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    toDataURL(link, { margin: 1, width: 192, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setSrc(null);
      });
    return () => {
      alive = false;
    };
  }, [link]);
  if (!src) return null;
  return (
    <figure className="m-0 flex flex-col items-center gap-2 rounded-2xl border border-line bg-white p-3 animate-fade-in">
      <img src={src} alt={label} width={192} height={192} className="rounded-lg" />
      <figcaption className="max-w-48 text-center text-[11px] break-all text-ink-3">
        {link}
      </figcaption>
    </figure>
  );
};
