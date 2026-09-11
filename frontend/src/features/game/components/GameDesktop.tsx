import { LOW_TIME_THRESHOLD } from '../stores/useGameStore';
import type { GameViewProps } from '../models/game-view.model';
import { Board } from './Board';
import { Clock } from './Clock';
import { EmoteBar } from './EmoteBar';
import { Keyboard } from './Keyboard';
import { LiveFeed } from './LiveFeed';
import { RivalsPanel } from './RivalsPanel';
import { ScorePreviewCard } from './ScorePreviewCard';
import { WaitingCard } from './WaitingCard';

/** Three-column game (Main.dc.html): rivals · clock/board/keyboard · feed/score/emotes. */
export const GameDesktop = (props: GameViewProps) => {
  const { t } = props;
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_320px] gap-6 px-7 py-5">
      <RivalsPanel
        t={t}
        rivals={props.rivals}
        rivalClocks={props.rivalClocks}
        reactions={props.reactions}
        solvedCount={props.solvedCount}
        lowTimeThreshold={LOW_TIME_THRESHOLD}
      />

      <div className="flex min-h-0 flex-col items-center justify-between gap-4">
        <Clock
          clock={props.clock}
          caption={t.game.timeLeftPct(props.clock.percent)}
          gains={props.gains}
          gainLabel={(chip) =>
            chip.kind === 'yellow' ? t.game.gainYellow(chip.letter) : t.game.gainGreen(chip.letter)
          }
        />
        <Board
          rows={props.rows}
          draft={props.draft}
          revealRow={props.revealRow}
          shakeKey={props.shakeKey}
          finished={props.outcome !== 'playing'}
          size="lg"
        />
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
          <WaitingCard
            t={t}
            outcome={props.outcome}
            solvedPosition={props.solvedPosition}
            timePercent={props.clock.percent}
          />
        )}
      </div>

      <div className="flex min-h-0 flex-col gap-4">
        <LiveFeed t={t} feed={props.feed} />
        <ScorePreviewCard t={t} preview={props.preview} outcome={props.outcome} />
        <EmoteBar t={t} disabled={props.emoteCooldown} onEmote={props.onEmote} />
      </div>
    </div>
  );
};
