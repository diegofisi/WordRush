import { LightningIcon } from '@/shared/components/icons/GameIcons';
import { Card } from '@/shared/components/ui/Card';
import { SCORING } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';

interface ScoringCardProps {
  t: Dictionary;
}

const Row = ({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) => (
  <div className="flex items-center justify-between gap-3 text-sm">
    <span className="text-ink-2">{label}</span>
    <span
      className={`font-mono font-bold whitespace-nowrap ${
        tone === 'pos' ? 'text-green-ink' : tone === 'neg' ? 'text-red' : ''
      }`}
    >
      {value}
    </span>
  </div>
);

/** The "how scoring works" side card from Lobby.dc.html; numbers come from SCORING. */
export const ScoringCard = ({ t }: ScoringCardProps) => (
  <Card className="flex flex-col gap-5 p-6 self-start">
    <div className="flex flex-col gap-1">
      <h3 className="m-0 font-display text-[22px] font-bold tracking-[-0.02em]">
        {t.lobby.scoringTitle}
      </h3>
      <p className="m-0 text-[13px] text-ink-2">{t.lobby.scoringSubtitle}</p>
    </div>
    <div className="flex flex-col gap-3">
      <Row label={t.lobby.scoringTime} value={t.lobby.scoringTimeValue} />
      <Row label={t.lobby.scoringAttempt} value={`−${SCORING.attemptPenalty}`} tone="neg" />
      <Row
        label={t.lobby.scoringPosition}
        value={SCORING.positionBonus.map((bonus) => `+${bonus}`).join(' · ')}
        tone="pos"
      />
      <Row label={t.lobby.scoringHint} value={`+${SCORING.hintKeptBonus}`} tone="pos" />
      <Row label={t.lobby.scoringFloor} value={t.lobby.scoringFloorValue(SCORING.solveFloor)} />
      <Row label={t.lobby.scoringGreens} value={`+${SCORING.pointsPerGreenUnsolved}`} />
      <Row label={t.lobby.scoringYellows} value={`+${SCORING.pointsPerYellowUnsolved}`} />
      <Row
        label={t.lobby.scoringUnsolvedCap}
        value={t.lobby.scoringCapValue(SCORING.maxUnsolvedPoints)}
      />
    </div>
    <div className="h-px bg-line" />
    <div className="flex flex-col gap-2.5">
      <span className="label">{t.lobby.letterTime}</span>
      <div className="flex gap-2">
        <span className="flex flex-1 items-center gap-2 rounded-[10px] bg-yellow-soft px-3 py-2.5">
          <span className="h-4 w-4 rounded bg-yellow" aria-hidden="true" />
          <span className="font-mono text-sm font-bold text-yellow-deep">
            +{SCORING.yellowSeconds} s
          </span>
        </span>
        <span className="flex flex-1 items-center gap-2 rounded-[10px] bg-green-soft px-3 py-2.5">
          <span className="h-4 w-4 rounded bg-green" aria-hidden="true" />
          <span className="font-mono text-sm font-bold text-green-ink">
            +{SCORING.greenSeconds} s
          </span>
        </span>
        <span className="flex flex-1 items-center gap-2 rounded-[10px] bg-red-soft px-3 py-2.5 text-red">
          <LightningIcon size={16} />
          <span className="font-mono text-sm font-bold">
            −{SCORING.penaltyOnRivalSolveSeconds} s
          </span>
        </span>
      </div>
      <p className="m-0 text-xs leading-[1.45] text-ink-3">{t.lobby.letterTimeNote}</p>
    </div>
  </Card>
);
