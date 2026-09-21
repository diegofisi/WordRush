import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { ChatContainer } from '@/features/chat';
import { useSessionStore } from '@/core/session/stores/useSessionStore';
import { PageLoading } from '@/shared/components/ui/PageState';
import { useT } from '@/shared/i18n';
import { teamLabel } from '@/shared/lib/teamColor';
import { gamePath, lobbyPath, PATHS } from '@/shared/routes/paths';
import { toast } from '@/shared/stores/useToastStore';

import { useLeaveRoom } from '../api/leave-room/useLeaveRoom';
import { useRestartRoom } from '../api/restart-room/useRestartRoom';
import { BreakdownTable } from '../components/BreakdownTable';
import { FinalBanner } from '../components/FinalBanner';
import { RoundHeader } from '../components/RoundHeader';
import { StandingsList } from '../components/StandingsList';
import { TeamBreakdownCards } from '../components/TeamBreakdownCards';
import { TeamStandingsList } from '../components/TeamStandingsList';
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
  const roomStatus = useResultsStore((state) => state.roomStatus);
  const hostId = useResultsStore((state) => state.hostId);
  const myTeam = useResultsStore((state) => state.myTeam);
  const myId = useSessionStore((state) => state.session?.playerId ?? null);
  const initialSeconds = useSessionStore(
    (state) => state.snapshot?.lobby.settings.initialSeconds ?? null,
  );
  // The typed words' length (the room's), whatever the game: the phrase game
  // has no answer word to measure.
  const { leaveRoom } = useLeaveRoom();
  const { restartRoom, pending: restarting } = useRestartRoom();

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

  // The host pressed "play again": the finished room is a waiting room again,
  // so everybody still on this screen moves to it. The stale table stays in the
  // store until the next `round:end` overwrites it; this screen is gone by then.
  useEffect(() => {
    if (roomStatus !== 'lobby') return;
    navigate(lobbyPath(roomCode), { replace: true });
  }, [roomStatus, roomCode, navigate]);

  const results = useMemo(
    () => (roundEnd ? toRoundResultsViewModel(roundEnd, myId, gameEnd, myTeam) : null),
    [roundEnd, myId, gameEnd, myTeam],
  );

  if (!results) return <PageLoading title={t.results.waitingForRound} />;

  const playAgain = async () => {
    const result = await restartRoom();
    // On success the server's `lobby:update` is what moves everybody.
    if (!result.ok) toast.error(result.error.code);
  };

  const leave = () => {
    navigate(PATHS.home, { replace: true });
    void leaveRoom();
  };

  const teamMode = results.mode === 'teams';
  const winner = results.standings[0] ?? null;
  const winningTeam = results.teamStandings[0] ?? null;
  // Two teams on the same total and the same rounds won: nobody wins.
  const teamTie =
    teamMode &&
    results.teamStandings.length === 2 &&
    results.teamStandings[0]?.total === results.teamStandings[1]?.total &&
    results.teamStandings[0]?.roundsWon === results.teamStandings[1]?.roundsWon;
  const banner = teamMode
    ? winningTeam
      ? {
          name: teamLabel(t, { id: winningTeam.team, name: winningTeam.name }),
          isMe: winningTeam.isMine,
          team: true,
          tie: teamTie,
        }
      : null
    : winner
      ? { name: winner.name, isMe: winner.isMe, team: false, tie: false }
      : null;

  return (
    <div className="grid flex-1 grid-cols-1 gap-6 px-4 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-4.5">
        {results.isFinal && banner ? (
          <FinalBanner
            t={t}
            winnerName={banner.name}
            winnerIsMe={banner.isMe}
            winnerIsTeam={banner.team}
            tie={banner.tie}
            isHost={hostId !== null && hostId === myId}
            restarting={restarting}
            onPlayAgain={() => void playAgain()}
            onLeave={leave}
          />
        ) : null}
        <RoundHeader t={t} results={results} />
        {teamMode ? (
          <TeamBreakdownCards
            t={t}
            teams={results.teamRows}
            phraseGame={results.game === 'phrase'}
          />
        ) : (
          <BreakdownTable t={t} rows={results.rows} phraseGame={results.game === 'phrase'} />
        )}
        {initialSeconds !== null ? (
          <p className="m-0 text-[13px] text-ink-3">{t.results.timeNote(initialSeconds)}</p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        {teamMode ? (
          <TeamStandingsList
            t={t}
            standings={results.teamStandings}
            title={results.isFinal ? t.results.finalTable : t.results.accumulated}
            subtitle={t.results.afterRounds(results.round, results.totalRounds)}
          />
        ) : (
          <StandingsList
            t={t}
            standings={results.standings}
            title={results.isFinal ? t.results.finalTable : t.results.accumulated}
            subtitle={t.results.afterRounds(results.round, results.totalRounds)}
            showDetails={results.isFinal}
          />
        )}
        {/* Between rounds everybody talks; the round's talk is kept here. */}
        <ChatContainer
          teamMode={teamMode}
          myTeam={myTeam}
          canWriteAll
          className="h-90 max-h-[60vh]"
        />
      </div>
    </div>
  );
};
