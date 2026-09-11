import { LOW_TIME_THRESHOLD } from '../stores/useGameStore';
import type { GameViewProps } from '../models/game-view.model';
import { Board } from './Board';
import { Clock } from './Clock';
import { EmotePicker } from './EmotePicker';
import { HintButton } from './HintButton';
import { HintLetterChip } from './HintLetterChip';
import { Keyboard } from './Keyboard';
import { FeedRow } from './LiveFeed';
import { PenaltyChip } from './PenaltyChip';
import { RivalStrip } from './RivalStrip';
import { ScorePreviewCard } from './ScorePreviewCard';
import { WaitingCard } from './WaitingCard';

/** Phone game (GameMobile.dc.html): clock + actions, rival strip, last event, board, keyboard, emotes. */
export const GameMobile = (props: GameViewProps) => {
  const { t } = props;
  const lastEvent = props.feed[props.feed.length - 1];
  return (
    <div className="flex flex-1 flex-col gap-3.5 px-4 pt-3 pb-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-ink-3">
            {t.common.roundOf(props.round.round, props.round.totalRounds)} ·{' '}
            <span className="font-mono">{props.roomCode}</span>
          </span>
          <Clock
            compact
            clock={props.clock}
            caption=""
            gains={props.gains}
            gainLabel={(chip) => chip.letter}
          />
        </div>
        <div className="flex shrink-0 gap-2">
          {props.penaltySeconds > 0 ? (
            <PenaltyChip
              compact
              seconds={props.penaltySeconds}
              label={t.game.penaltyTotal(props.penaltySeconds)}
            />
          ) : null}
          <HintButton
            compact
            t={t}
            state={props.hintState}
            pending={props.hintPending}
            disabled={props.outcome !== 'playing'}
            onClick={props.onHint}
          />
        </div>
      </div>

      {props.hint ? (
        <div className="flex justify-end">
          <HintLetterChip t={t} letter={props.hint.letter} />
        </div>
      ) : null}

      {props.rivals.length > 0 ? (
        <RivalStrip
          t={t}
          rivals={props.rivals}
          rivalClocks={props.rivalClocks}
          reactions={props.reactions}
          lowTimeThreshold={LOW_TIME_THRESHOLD}
        />
      ) : null}

      {lastEvent ? (
        <ul className="m-0 list-none p-0" aria-label={t.game.lastEvent} aria-live="polite">
          <FeedRow t={t} event={lastEvent} />
        </ul>
      ) : null}

      <div className="flex justify-center">
        <Board
          rows={props.rows}
          draft={props.draft}
          revealRow={props.revealRow}
          shakeKey={props.shakeKey}
          finished={props.outcome !== 'playing'}
          size="sm"
        />
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        {props.outcome === 'playing' ? (
          <Keyboard
            language={props.wordLanguage}
            keyStates={props.keyStates}
            disabled={false}
            enterLabel={t.game.enter}
            backspaceLabel={t.game.backspace}
            onLetter={props.onLetter}
            onEnter={props.onEnter}
            onBackspace={props.onBackspace}
          />
        ) : (
          <>
            <WaitingCard
              t={t}
              outcome={props.outcome}
              solvedPosition={props.solvedPosition}
              timePercent={props.clock.percent}
            />
            <ScorePreviewCard t={t} preview={props.preview} outcome={props.outcome} />
          </>
        )}
        <div className="flex justify-end">
          <EmotePicker
            t={t}
            variant="row"
            cooldownSeconds={props.emoteCooldownSeconds}
            onEmote={props.onEmote}
          />
        </div>
      </div>
    </div>
  );
};
