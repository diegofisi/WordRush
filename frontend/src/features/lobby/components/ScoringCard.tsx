import { LightningIcon } from '@/shared/components/icons/GameIcons';
import { Card } from '@/shared/components/ui/Card';
import { PHRASE_RULES, SCORING, type GameKind } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';

interface ScoringCardProps {
  t: Dictionary;
  /** The game the room plays: the card explains that game's formula only. */
  game: GameKind;
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

const positions = SCORING.positionBonus.map((bonus) => `+${bonus}`).join(' · ');

/** Word race rows (docs/context/03-scoring-system.md); every number comes from SCORING. */
const WordRows = ({ t }: { t: Dictionary }) => (
  <div className="flex flex-col gap-3">
    <Row label={t.lobby.scoringSolve} value={`+${SCORING.solveBonus}`} tone="pos" />
    <Row label={t.lobby.scoringTime} value={t.lobby.scoringTimeValue} />
    <Row label={t.lobby.scoringAttempt} value={`−${SCORING.attemptPenalty}`} tone="neg" />
    <Row label={t.lobby.scoringPosition} value={positions} tone="pos" />
    <Row label={t.lobby.scoringHint} value={`+${SCORING.hintKeptBonus}`} tone="pos" />
    <Row label={t.lobby.scoringGreens} value={`+${SCORING.pointsPerGreenUnsolved}`} />
    <Row label={t.lobby.scoringYellows} value={`+${SCORING.pointsPerYellowUnsolved}`} />
  </div>
);

/** Phrase game rows (docs/context/06-v1.1.md -> Guess the phrase); numbers from PHRASE_RULES. */
const PhraseRows = ({ t }: { t: Dictionary }) => (
  <div className="flex flex-col gap-3">
    <Row
      label={t.lobby.phraseScoringComplete}
      value={`+${PHRASE_RULES.completeBonus}`}
      tone="pos"
    />
    <Row label={t.lobby.scoringTime} value={t.lobby.scoringTimeValue} />
    <Row label={t.lobby.phraseScoringWord} value={`−${PHRASE_RULES.wordPenalty}`} tone="neg" />
    <Row
      label={t.lobby.phraseScoringMiss(PHRASE_RULES.sends)}
      value={`−${PHRASE_RULES.sendPenalty}`}
      tone="neg"
    />
    <Row label={t.lobby.phraseScoringPosition} value={positions} tone="pos" />
    <Row
      label={t.lobby.phraseScoringUncovered}
      value={t.lobby.phraseScoringUncoveredValue(PHRASE_RULES.uncoveredMaxPoints)}
    />
  </div>
);

/** The lobby scoring card from Lobby.dc.html, in the version of the game the room plays. */
export const ScoringCard = ({ t, game }: ScoringCardProps) => {
  const phrase = game === 'phrase';
  return (
    <Card className="flex flex-col gap-5 p-6 self-start">
      <h3 className="m-0 font-display text-[22px] font-bold tracking-[-0.02em]">
        {t.lobby.scoringTitle}
      </h3>
      {phrase ? <PhraseRows t={t} /> : <WordRows t={t} />}
      <div className="h-px bg-line" />
      <div className="flex flex-col gap-2.5">
        <span className="label">{t.lobby.letterTime}</span>
        <div className="flex gap-2">
          {phrase ? null : (
            <span className="flex flex-1 items-center gap-2 rounded-[10px] bg-yellow-soft px-3 py-2.5">
              <span className="h-4 w-4 rounded bg-yellow" aria-hidden="true" />
              <span className="font-mono text-sm font-bold text-yellow-deep">
                +{SCORING.yellowSeconds} s
              </span>
            </span>
          )}
          <span className="flex flex-1 items-center gap-2 rounded-[10px] bg-green-soft px-3 py-2.5">
            <span className="h-4 w-4 rounded bg-green" aria-hidden="true" />
            <span className="font-mono text-sm font-bold text-green-ink">
              +{phrase ? PHRASE_RULES.secondsPerOccurrence : SCORING.greenSeconds} s
            </span>
          </span>
          <span className="flex flex-1 items-center gap-2 rounded-[10px] bg-red-soft px-3 py-2.5 text-red">
            <LightningIcon size={16} />
            <span className="font-mono text-sm font-bold">
              −{SCORING.penaltyOnRivalSolveSeconds} s
            </span>
          </span>
        </div>
        <p className="m-0 text-xs leading-[1.45] text-ink-3">
          {phrase ? t.lobby.phraseLetterTimeNote : t.lobby.letterTimeNote}
        </p>
      </div>
    </Card>
  );
};
