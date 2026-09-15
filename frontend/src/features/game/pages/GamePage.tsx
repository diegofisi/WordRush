import { useParams } from 'react-router-dom';

import { LeaveGameAction } from '@/core/session/components/LeaveGameAction';
import { useSessionStore } from '@/core/session/stores/useSessionStore';
import { RoomContext } from '@/shared/components/layout/RoomContext';
import { TopBar } from '@/shared/components/layout/TopBar';
import { useIsDesktopGame } from '@/shared/hooks/useMediaQuery';
import { useT } from '@/shared/i18n';
import { teamLabel } from '@/shared/lib/teamColor';

import { useUseHint } from '../api/use-hint/useUseHint';
import { HintButton } from '../components/HintButton';
import { HintLetterChip } from '../components/HintLetterChip';
import { PenaltyChip } from '../components/PenaltyChip';
import { GameContainer } from '../containers/GameContainer';
import { useGameStore } from '../stores/useGameStore';
import { toast } from '@/shared/stores/useToastStore';

/** Top-bar chips live here so the container stays layout-agnostic. */
const GameTopBarActions = () => {
  const t = useT();
  const me = useGameStore((state) => state.me);
  const round = useGameStore((state) => state.round);
  const role = useGameStore((state) => state.role);
  const status = useGameStore((state) => state.status);
  const { requestHint, pending } = useUseHint();
  if (!me || !round || role === 'observer') return null;
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
        team={round.mode === 'teams'}
        state={hintState}
        pending={pending}
        disabled={status !== 'playing' || me.finished}
        onClick={() => void onHint()}
      />
      {me.hint ? <HintLetterChip t={t} reveal={me.hint} /> : null}
    </>
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
  const role = useGameStore((state) => state.role);
  const teamInfo = useGameStore((state) => state.teamInfo);
  const [teamA, teamB] = teamInfo;

  // From the three-column breakpoint up (the same 1100 px as `useIsDesktopGame`)
  // the game owns exactly one viewport. `flex-none` + `h-dvh` is what makes that
  // height definite (a `flex-1` basis of 0% against an auto-height parent falls
  // back to the content size), so the columns shrink and scroll inside
  // themselves instead of a tall live feed stretching the whole page. `auto`
  // rather than `hidden`: a window too short for the board must still scroll.
  // Phones keep the normal page scroll.
  return (
    <div className="flex flex-1 flex-col min-[1100px]:h-dvh min-[1100px]:flex-none min-[1100px]:overflow-auto">
      <TopBar
        context={
          session ? (
            <RoomContext
              code={session.roomCode}
              parts={[
                round ? t.common.roundOf(round.round, round.totalRounds) : null,
                role === 'observer' ? (
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-ink-2">
                    {t.game.observing}
                  </span>
                ) : null,
                // Team mode: the rounds won so far, by team name.
                round?.mode === 'teams' && teamA && teamB ? (
                  <span className="font-semibold text-ink">
                    {t.game.roundsWonHeader(
                      teamLabel(t, teamA),
                      teamA.roundsWon,
                      teamB.roundsWon,
                      teamLabel(t, teamB),
                    )}
                  </span>
                ) : null,
                settings ? (
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
                    {t.common.language[settings.language]}
                  </span>
                ) : null,
              ]}
            />
          ) : null
        }
        actions={isDesktop ? <GameTopBarActions /> : undefined}
        leaveAction={<LeaveGameAction />}
        playerName={session?.name}
        connectionLabel={connection === 'disconnected' ? t.common.reconnecting : undefined}
      />
      <GameContainer roomCode={session?.roomCode ?? code} />
    </div>
  );
};
