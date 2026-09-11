import { CopyIcon } from '@/shared/components/icons/GameIcons';
import { Button } from '@/shared/components/ui/Button';
import type { RoomSettings } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';

interface RoomCodeHeaderProps {
  t: Dictionary;
  code: string;
  settings: RoomSettings;
  playerCount: number;
  onCopyLink: () => void;
}

const Chip = ({ value, caption }: { value: string; caption?: string }) => (
  <span className="flex h-8.5 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold">
    <span className="font-mono">{value}</span>
    {caption ? <span className="font-medium text-ink-2">{caption}</span> : null}
  </span>
);

export const RoomCodeHeader = ({
  t,
  code,
  settings,
  playerCount,
  onCopyLink,
}: RoomCodeHeaderProps) => (
  <div className="flex flex-wrap items-end justify-between gap-6">
    <div className="flex flex-col gap-2.5">
      <span className="label">{t.lobby.roomCode}</span>
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-mono text-[clamp(48px,10vw,72px)] leading-none font-bold tracking-[0.12em]">
          {code}
        </span>
        <Button variant="outline" size="sm" onClick={onCopyLink} leading={<CopyIcon size={18} />}>
          {t.common.copyLink}
        </Button>
      </div>
      <span className="text-sm text-ink-2">{t.lobby.shareHint}</span>
    </div>
    <div className="flex flex-wrap gap-2 lg:justify-end">
      <span className="flex h-8.5 items-center rounded-full border border-line bg-surface px-3.5 text-sm font-semibold">
        {t.common.language[settings.language]}
      </span>
      <Chip value={t.common.seconds(settings.initialSeconds)} caption={t.common.perRound} />
      <Chip value={String(settings.rounds)} caption={t.common.rounds} />
      <Chip
        value={t.lobby.playersChip(playerCount, settings.capacity)}
        caption={t.common.players}
      />
      {!settings.hintEnabled ? (
        <span className="flex h-8.5 items-center rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink-2">
          {t.lobby.hintOff}
        </span>
      ) : null}
    </div>
  </div>
);
