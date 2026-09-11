import { LightningIcon } from '@/shared/components/icons/GameIcons';

interface PenaltyChipProps {
  label: string;
  compact?: boolean;
  seconds: number;
}

/** Red "−5 s recibidos" pill; the accumulated penalty for this round. */
export const PenaltyChip = ({ label, compact = false, seconds }: PenaltyChipProps) => (
  <span
    className="flex h-11 items-center gap-1.5 rounded-full bg-red-soft px-3 text-[13px] font-semibold text-red sm:h-9"
    title={label}
  >
    <LightningIcon size={16} />
    {compact ? <span className="font-mono">−{seconds}</span> : <span>{label}</span>}
  </span>
);
