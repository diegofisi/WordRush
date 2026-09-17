import { PHRASE_RULES } from '@/shared/contract';

import { LOW_TIME_THRESHOLD } from '../stores/useGameStore';
import type { GameViewProps } from '../models/game-view.model';
// BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
import { BossPanel } from '@/features/boss/components/BossPanel';
import { Board } from './Board';
import { Clock } from './Clock';
import { ClockCard } from './ClockCard';
import { Keyboard } from './Keyboard';
import { ObserverCard } from './ObserverCard';
import { PhraseCard } from './PhraseCard';
import { PhraseModal } from './PhraseModal';
import { PhraseScoreCard } from './PhraseScoreCard';
import { RivalsPanel } from './RivalsPanel';
import { ScorePreviewCard } from './ScorePreviewCard';
import { TeamPanel } from './TeamPanel';
import { TeamScoreCard } from './TeamScoreCard';
import { WaitingCard } from './WaitingCard';

/**
 * Three-column game (Main.dc.html, and phrase/Equipos.dc.html in team mode):
 * rivals or teams · clock/board/keyboard · the room's chat and the score. The
 * chat is one panel: events, stickers and messages in a single stream, with
 * the sticker picker in its composer (docs/context/06-v1.1.md -> Chat).
 */
export const GameDesktop = (props: GameViewProps) => {
  const { t } = props;
  const phrase = props.phrase;
  const phraseGame = props.round.game === 'phrase';
  // Phrase game: six words and no more; the FRASE key stays live.
  const rowsUsed = phraseGame && props.rows.length >= props.round.maxAttempts;
  // `grid-rows-[minmax(0,1fr)]`: an auto row would grow past the grid's own
  // height (tall sticker messages in the feed) and push the whole page down;
  // pinning the row to the viewport keeps every column scrolling inside itself.
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_320px] grid-rows-[minmax(0,1fr)] gap-6 px-7 py-5">
      <div className="flex min-h-0 flex-col gap-4">
        {/* BOSS-MODE (temporary; see docs/context/07-boss-removal.md) */}
        {props.boss ? <BossPanel t={t} boss={props.boss} roomCode={props.roomCode} /> : null}
        {phrase && !props.observer ? (
          // Phrase game: the clock lives in a side card, so the centre column
          // holds only the phrase, the board and the keyboard (they never scroll).
          <ClockCard
            t={t}
            title={props.team ? t.game.teamClock : t.game.yourClock}
            clock={props.clock}
            gains={props.gains}
            caption={t.game.phraseClockCaption(
              Math.round((phrase.self.found / Math.max(1, phrase.self.total)) * 100),
              Math.min(PHRASE_RULES.words, props.rows.length + 1),
              PHRASE_RULES.words,
            )}
          />
        ) : null}
        {props.team ? (
          <TeamPanel
            t={t}
            wordLength={props.round.wordLength}
            team={props.team}
            lowTimeThreshold={LOW_TIME_THRESHOLD}
            colorLabels={props.tileLabels}
            phraseGame={phraseGame}
          />
        ) : (
          <RivalsPanel
            t={t}
            wordLength={props.round.wordLength}
            rivals={props.rivals}
            rivalClocks={props.rivalClocks}
            solvedCount={props.solvedCount}
            lowTimeThreshold={LOW_TIME_THRESHOLD}
            phraseGame={phraseGame}
          />
        )}
      </div>

      {props.observer ? (
        <div className="flex min-h-0 flex-col items-center justify-center gap-4">
          <ObserverCard t={t} observer={props.observer} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-col items-center justify-between gap-4">
          {phrase ? (
            <PhraseCard
              t={t}
              phrase={phrase.self}
              wordCount={phrase.wordCount}
              shared={props.team !== null}
              className="max-w-160"
            />
          ) : (
            <Clock
              clock={props.clock}
              caption={t.game.timeLeftPct(props.clock.percent)}
              gains={props.gains}
              gainLabel={(chip) =>
                chip.kind === 'yellow'
                  ? t.game.gainYellow(chip.letter)
                  : t.game.gainGreen(chip.letter)
              }
            />
          )}
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
            size={phrase ? 'sm' : 'lg'}
          />
          {props.outcome === 'playing' ? (
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
            <WaitingCard
              t={t}
              outcome={props.outcome}
              solvedPosition={props.solvedPosition}
              timePercent={props.clock.percent}
              solverName={props.team?.solverName}
              phraseGame={phraseGame}
            />
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-col gap-4">
        {props.chat.panel}
        {props.observer ? null : phrase ? (
          <PhraseScoreCard
            t={t}
            preview={phrase.preview}
            finished={props.outcome !== 'playing'}
            teamMode={props.team !== null}
          />
        ) : props.team ? (
          <TeamScoreCard t={t} preview={props.team.preview} outcome={props.outcome} />
        ) : (
          <ScorePreviewCard t={t} preview={props.preview} outcome={props.outcome} />
        )}
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
