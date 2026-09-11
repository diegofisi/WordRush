import { useParams } from 'react-router-dom';

import { LeaveGameAction } from '@/core/session/components/LeaveGameAction';
import { useSessionStore } from '@/core/session/stores/useSessionStore';
import { RoomContext } from '@/shared/components/layout/RoomContext';
import { TopBar } from '@/shared/components/layout/TopBar';
import { useIsDesktopGame } from '@/shared/hooks/useMediaQuery';
import { useT } from '@/shared/i18n';

import { useUseHint } from '../api/use-hint/useUseHint';
import { HintButton } from '../components/HintButton';
import { HintLetterChip } from '../components/HintLetterChip';
import { PenaltyChip } from '../components/PenaltyChip';
import { ReactionBurst } from '../components/ReactionBurst';
import { GameContainer } from '../containers/GameContainer';
import { useGameStore } from '../stores/useGameStore';
import { toast } from '@/shared/stores/useToastStore';

/** Top-bar chips live here so the container stays layout-agnostic. */
const GameTopBarActions = () => {
  const t = useT();
  const me = useGameStore((state) => state.me);
  const round = useGameStore((state) => state.round);
  const status = useGameStore((state) => state.status);
  const { requestHint, pending } = useUseHint();
  if (!me || !round) return null;
  const hintState = !round.hintAvailable ? 'off' : me.hintUsed ? 'used' : 'available';
  const onHint = async () => {
    const result = await requestHint();
    // The persistent HintLetterChip in the top bar already shows the letter.
    if (!result.ok) toast.error(result.error.code);
  };
  return (
    <>
      {me.penaltySeconds > 0 ? (
        <PenaltyChip seconds={me.penaltySeconds} label={t.game.penaltyTotal(me.penaltySeconds)} />
      ) : null}
      <HintButton
        t={t}
        state={hintState}
        pending={pending}
        disabled={status !== 'playing' || me.finished}
        onClick={() => void onHint()}
      />
      {me.hint ? <HintLetterChip t={t} letter={me.hint.letter} /> : null}
    </>
  );
};

/** My own reaction bursting out of my avatar; rivals see the same sticker fly. */
const MyReactionBurst = () => {
  const t = useT();
  const reaction = useGameStore((state) => (state.myId ? state.reactions[state.myId] : undefined));
  if (!reaction) return null;
  return (
    <ReactionBurst
      key={reaction.stamp}
      emote={reaction.emote}
      label={t.emotes[reaction.emote]}
    />
  );
};

export const GamePage = () => {
  const t = useT();
  const { code = '' } = useParams<{ code: string }>();
  const isDesktop = useIsDesktopGame();
  const session = useSessionStore((state) => state.session);
  const connection = useSessionStore((state) => state.connection);
  const round = useGameStore((state) => state.round);
  const settings = useGameStore((state) => state.settings);

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        context={
          session ? (
            <RoomContext
              code={session.roomCode}
              parts={[
                round ? t.common.roundOf(round.round, round.totalRounds) : null,
                settings ? t.common.language[settings.language] : null,
              ]}
            />
          ) : null
        }
        actions={isDesktop ? <GameTopBarActions /> : undefined}
        leaveAction={<LeaveGameAction />}
        playerName={session?.name}
        playerOverlay={<MyReactionBurst />}
        connectionLabel={connection === 'disconnected' ? t.common.reconnecting : undefined}
      />
      <GameContainer roomCode={session?.roomCode ?? code} />
    </div>
  );
};
