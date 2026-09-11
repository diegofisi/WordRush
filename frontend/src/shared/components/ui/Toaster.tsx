import { X } from 'lucide-react';

import { useT } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { useToastStore, type ToastItem } from '@/shared/stores/useToastStore';

const toneClass: Record<ToastItem['tone'], string> = {
  error: 'bg-red-soft text-red border-red/20',
  info: 'bg-surface text-ink border-line',
  success: 'bg-green-soft text-green-ink border-green/20',
};

/** Mount once in the app shell; renders the toast store as a bottom-centre stack. */
export const Toaster = () => {
  const items = useToastStore((state) => state.items);
  const dismiss = useToastStore((state) => state.dismiss);
  const t = useT();

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-20 z-50 flex flex-col items-center gap-2"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex max-w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-pop animate-toast-in',
            toneClass[item.tone],
          )}
        >
          <span>{item.text ?? (item.code ? t.errors[item.code] : '')}</span>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="×"
            className="-mr-1 flex h-7 w-7 items-center justify-center rounded-md opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
