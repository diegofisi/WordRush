import { LOW_TIME_THRESHOLD } from '../stores/useGameStore';
import { isTextFeedEvent } from '../models/game.model';
import type { GameViewProps } from '../models/game-view.model';
import { Board } from './Board';
import { ChatSheet } from './ChatSheet';
import { Clock } from './Clock';
import { EmotePicker } from './EmotePicker';
import { HintButton } from './HintButton';
import { HintLetterChip } from './HintLetterChip';
import { Keyboard } from './Keyboard';
import { FeedRow } from './LiveFeed';
import { ObserverCard } from './ObserverCard';
import { PenaltyChip } from './PenaltyChip';
import { PhraseCard } from './PhraseCard';
import { PhraseModal } from './PhraseModal';
import { PhraseScoreCard } from './PhraseScoreCard';
import { RivalCarousel } from './RivalCarousel';
import { RivalStrip } from './RivalStrip';
import { ScorePreviewCard } from './ScorePreviewCard';
import { StickerOverlay } from './StickerOverlay';
import { TeamScoreCard } from './TeamScoreCard';
import { TeamStrip } from './TeamStrip';
import { WaitingCard } from './WaitingCard';

/** Phone game (GameMobile.dc.html): clock + actions, rival strip, last event, board, keyboard, emotes. */
export const GameMobile = (props: GameViewProps) => {
  const { t } = props;
  const phrase = props.phrase;
  const phraseGame = props.round.game === 'phrase';
  // Phrase game: six words and no more; the FRASE key stays live.
  const rowsUsed = phraseGame && props.rows.length >= props.round.maxAttempts;
  // Stickers are not a line here: they fly over the keyboard (StickerOverlay).
  const lastEvent = [...props.feed].reverse().find(isTextFeedEvent);
  return (
    <div className="flex flex-1 flex-col gap-3.5 px-4 pt-3 pb-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-xs text-ink-3">
            <span>
              {t.common.roundOf(props.round.round, props.round.totalRounds)} ·{' '}
              <span className="font-mono">{props.roomCode}</span>
            </span>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
              {t.common.language[props.wordLanguage]}
            </span>
          </span>
          {props.observer ? (
            <span className="font-display text-xl font-bold tracking-[-0.02em]">
              {t.game.observing}
            </span>
          ) : (
            <Clock
              compact
              clock={props.clock}
              caption=""
              gains={props.gains}
              gainLabel={(chip) => chip.letter}
            />
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {props.observer ? null : props.penaltySeconds > 0 ? (
            <PenaltyChip
              compact
              seconds={props.penaltySeconds}
              label={t.game.penaltyTotal(props.penaltySeconds)}
            />
          ) : null}
          {props.observer || phraseGame ? null : (
            <HintButton
              compact
              t={t}
              team={props.team !== null}
              state={props.hintState}
              pending={props.hintPending}
              disabled={props.outcome !== 'playing'}
              onClick={props.onHint}
            />
          )}
        </div>
      </div>

      {props.hint ? (
        <div className="flex justify-end">
          <HintLetterChip t={t} reveal={props.hint} />
        </div>
      ) : null}

      {phrase && !props.observer ? (
        <PhraseCard
          t={t}
          phrase={phrase.self}
          wordCount={phrase.wordCount}
          shared={props.team !== null}
          onOpen={phrase.onOpen}
          openDisabled={phrase.locked || props.outcome !== 'playing'}
        />
      ) : null}

      {props.team ? (
        <TeamStrip
          t={t}
          wordLength={props.round.wordLength}
          team={props.team}
          lowTimeThreshold={LOW_TIME_THRESHOLD}
          colorLabels={props.tileLabels}
          phraseGame={phraseGame}
        />
      ) : phraseGame && props.rivals.length > 0 ? (
        <RivalCarousel t={t} rivals={props.rivals} rivalClocks={props.rivalClocks} />
      ) : props.rivals.length > 0 ? (
        <RivalStrip
          t={t}
          wordLength={props.round.wordLength}
          rivals={props.rivals}
          rivalClocks={props.rivalClocks}
          lowTimeThreshold={LOW_TIME_THRESHOLD}
        />
      ) : null}

      {lastEvent ? (
        <ul className="m-0 list-none p-0" aria-label={t.game.lastEvent} aria-live="polite">
          <FeedRow t={t} event={lastEvent} />
        </ul>
      ) : null}

      <div className="flex justify-center">
        {props.observer ? (
          <ObserverCard t={t} observer={props.observer} />
        ) : (
          <Board
            wordLength={props.round.wordLength}
            maxAttempts={props.round.maxAttempts}
            rows={props.rows}
            draft={props.draft}
            revealRow={props.revealRow}
            shakeKey={props.shakeKey}
            notice={props.guessNotice}
            finished={props.outcome !== 'playing'}
            hint={props.hint}
            colorLabels={props.tileLabels}
            size="sm"
          />
        )}
      </div>

      <div className="relative mt-auto flex flex-col gap-2.5">
        <StickerOverlay t={t} sticker={props.sticker} />
        {props.observer ? null : props.outcome === 'playing' ? (
          <Keyboard
            language={props.wordLanguage}
            keyStates={props.keyStates}
            stateLabels={props.tileLabels}
            disabled={rowsUsed}
            enterLabel={t.game.enter}
            backspaceLabel={t.game.backspace}
            onLetter={props.onLetter}
            onEnter={props.onEnter}
            onBackspace={props.onBackspace}
            disableGray={phraseGame}
            phraseKey={
              phrase
                ? { label: t.game.phraseKey, disabled: phrase.locked, onClick: phrase.onOpen }
                : null
            }
          />
        ) : (
          <>
            <WaitingCard
              t={t}
              outcome={props.outcome}
              solvedPosition={props.solvedPosition}
              timePercent={props.clock.percent}
              solverName={props.team?.solverName}
              phraseGame={phraseGame}
            />
            {phrase ? (
              <PhraseScoreCard
                t={t}
                preview={phrase.preview}
                finished
                teamMode={props.team !== null}
              />
            ) : props.team ? (
              <TeamScoreCard t={t} preview={props.team.preview} outcome={props.outcome} />
            ) : (
              <ScorePreviewCard t={t} preview={props.preview} outcome={props.outcome} />
            )}
          </>
        )}
        <div className="flex items-center justify-between gap-2">
          <ChatSheet
            t={t}
            open={props.chat.open}
            unread={props.chat.unread}
            onToggle={props.chat.onToggle}
          >
            {props.chat.panel}
          </ChatSheet>
          <EmotePicker
            t={t}
            variant="row"
            cooldownSeconds={props.emoteCooldownSeconds}
            onEmote={props.onEmote}
          />
        </div>
      </div>

      {phrase ? (
        <PhraseModal
          t={t}
          open={phrase.modalOpen}
          phrase={phrase.self}
          secondsLeft={props.clock.secondsLeft}
          pending={phrase.pending}
          wrong={phrase.wrong}
          onClose={phrase.onClose}
          onSend={phrase.onSend}
        />
      ) : null}
    </div>
  );
};
