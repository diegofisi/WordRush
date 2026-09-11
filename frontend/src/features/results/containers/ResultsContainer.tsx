import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useSessionStore } from '@/core/session/stores/useSessionStore';
import { Button } from '@/shared/components/ui/Button';
import { PageLoading } from '@/shared/components/ui/PageState';
import { useT } from '@/shared/i18n';
import { gamePath, PATHS } from '@/shared/routes/paths';

import { useLeaveRoom } from '../api/leave-room/useLeaveRoom';
import { BreakdownTable } from '../components/BreakdownTable';
import { RoundHeader } from '../components/RoundHeader';
import { StandingsList } from '../components/StandingsList';
import { toRoundResultsViewModel } from '../models/results.model';
import { useResultsStore } from '../stores/useResultsStore';

interface ResultsContainerProps {
  roomCode: string;
}

export const ResultsContainer = ({ roomCode }: ResultsContainerProps) => {
  const t = useT();
  const navigate = useNavigate();
  const roundEnd = useResultsStore((state) => state.roundEnd);
  const gameEnd = useResultsStore((state) => state.gameEnd);
  const latestRoundStarted = useResultsStore((state) => state.latestRoundStarted);
  const myId = useSessionStore((state) => state.session?.playerId ?? null);
  const initialSeconds = useSessionStore(
    (state) => state.snapshot?.lobby.settings.initialSeconds ?? null,
  );
  const { leaveRoom } = useLeaveRoom();

  // A new round:start after this round's end means play resumed: back to the board.
  useEffect(() => {
    if (
      roundEnd &&
      !gameEnd &&
      latestRoundStarted !== null &&
      latestRoundStarted > roundEnd.round
    ) {
      navigate(gamePath(roomCode), { replace: true });
    }
  }, [roundEnd, gameEnd, latestRoundStarted, roomCode, navigate]);

  const results = useMemo(
    () => (roundEnd ? toRoundResultsViewModel(roundEnd, myId, gameEnd) : null),
    [roundEnd, myId, gameEnd],
  );

  if (!results) return <PageLoading title={t.results.waitingForRound} />;

  const newGame = async () => {
    await leaveRoom();
    navigate(PATHS.home, { replace: true });
  };

  const winner = results.standings[0] ?? null;

  return (
    <div className="grid flex-1 grid-cols-1 gap-6 px-4 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-4.5">
        {results.isFinal && winner ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4 animate-fade-in">
            <div className="flex flex-col gap-0.5">
              <span className="label">{t.results.gameOver}</span>
              <span className="font-display text-2xl font-extrabold tracking-[-0.02em]">
                {winner.isMe ? t.results.youWin : t.results.winner(winner.name)}
              </span>
            </div>
            <Button size="lg" onClick={() => void newGame()}>
              {t.common.newGame}
            </Button>
          </div>
        ) : null}
        <RoundHeader t={t} results={results} />
        <BreakdownTable t={t} rows={results.rows} />
        {initialSeconds !== null ? (
          <p className="m-0 text-[13px] text-ink-3">{t.results.timeNote(initialSeconds)}</p>
        ) : null}
      </div>
      <StandingsList
        t={t}
        standings={results.standings}
        title={results.isFinal ? t.results.finalTable : t.results.accumulated}
        subtitle={t.results.afterRounds(results.round, results.totalRounds)}
        showDetails={results.isFinal}
      />
    </div>
  );
};
