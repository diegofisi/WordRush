import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { ChatContainer, useChatStore } from '@/features/chat';
import { useSessionStore } from '@/core/session/stores/useSessionStore';
import { PageLoading } from '@/shared/components/ui/PageState';
import type { Emote } from '@/shared/contract';
import { useIsDesktopGame } from '@/shared/hooks/useMediaQuery';
import { useNow } from '@/shared/hooks/useNow';
import { useToastSafeBottom } from '@/shared/hooks/useToastSafeBottom';
import { useT } from '@/shared/i18n';
import { percentOf, secondsLeftAt } from '@/shared/lib/format';
import { otherTeam } from '@/shared/lib/teamColor';
import { resultsPath } from '@/shared/routes/paths';
import { toast } from '@/shared/stores/useToastStore';

import { useSitObserver } from '../api/observer-sit/useSitObserver';
import { useSendGuess } from '../api/send-guess/useSendGuess';
import { useSendReaction } from '../api/send-reaction/useSendReaction';
import { useUseHint } from '../api/use-hint/useUseHint';
import { GameDesktop } from '../components/GameDesktop';
import { GameMobile } from '../components/GameMobile';
import { countGreenPositions, deriveKeyStates } from '../helpers/keyboard';
import { computeScorePreview } from '../helpers/scorePreview';
import { computeTeamScorePreview } from '../helpers/teamScorePreview';
import { usePhysicalKeyboard } from '../hooks/usePhysicalKeyboard';
import {
  toRivalTeamViewModel,
  toRivalViewModel,
  toTeammateViewModel,
  type RivalViewModel,
} from '../models/game.model';
import type { GameViewProps, MyOutcome, TeamViewProps } from '../models/game-view.model';
import { LOW_TIME_THRESHOLD, useGameStore } from '../stores/useGameStore';

/** Clears the phone keyboard block (3 rows + the emote row) for the toasts. */
const PHONE_TOAST_BOTTOM = '15rem';

interface GameContainerProps {
  roomCode: string;
}

export const GameContainer = ({ roomCode }: GameContainerProps) => {
  const t = useT();
  const navigate = useNavigate();
  const isDesktop = useIsDesktopGame();
  useToastSafeBottom(isDesktop ? null : PHONE_TOAST_BOTTOM);

  const status = useGameStore((state) => state.status);
  const round = useGameStore((state) => state.round);
  const role = useGameStore((state) => state.role);
  const settings = useGameStore((state) => state.settings);
  const roster = useGameStore((state) => state.roster);
  const myId = useGameStore((state) => state.myId);
  const me = useGameStore((state) => state.me);
  const players = useGameStore((state) => state.players);
  const left = useGameStore((state) => state.left);
  const teamInfo = useGameStore((state) => state.teamInfo);
  const observers = useGameStore((state) => state.observers);
  const teams = useGameStore((state) => state.teams);
  const myTeam = useGameStore((state) => state.myTeam);
  const teammateRows = useGameStore((state) => state.teammates);
  const solvedCount = useGameStore((state) => state.solvedCount);
  const feed = useGameStore((state) => state.feed);
  const sticker = useGameStore((state) => state.sticker);
  const gains = useGameStore((state) => state.gains);
  const draft = useGameStore((state) => state.draft);
  const revealRow = useGameStore((state) => state.revealRow);
  const shakeKey = useGameStore((state) => state.shakeKey);
  const guessNotice = useGameStore((state) => state.guessNotice);
  const emotePausedUntil = useGameStore((state) => state.emotePausedUntil);
  const typeLetter = useGameStore((state) => state.typeLetter);
  const backspace = useGameStore((state) => state.backspace);
  const noticeGuess = useGameStore((state) => state.noticeGuess);
  const announceLowTime = useGameStore((state) => state.announceLowTime);
  const connection = useSessionStore((state) => state.connection);
  const chatOpen = useChatStore((state) => state.open);
  const chatUnread = useChatStore((state) => state.unread);
  const setChatOpen = useChatStore((state) => state.setOpen);

  const { sendGuess } = useSendGuess();
  const { requestHint, pending: hintPending } = useUseHint();
  const { sendReaction } = useSendReaction();
  const { sit, pending: sitting } = useSitObserver();

  const playing = status === 'playing' && Boolean(round && me);
  const now = useNow(100, playing || status === 'ended');
  const teamMode = round?.mode === 'teams';
  const observing = role === 'observer';

  // The server decides when a round ends; we only follow it to the results screen.
  useEffect(() => {
    if (status === 'ended') navigate(resultsPath(roomCode), { replace: true });
  }, [status, roomCode, navigate]);

  const rivals = useMemo(
    () =>
      Object.values(players)
        .filter((player) => player.playerId !== myId)
        // Team mode: teammates are not rivals; they get their own panel.
        .filter((player) => !teamMode || roster[player.playerId]?.team !== myTeam)
        .map((player) =>
          toRivalViewModel(
            player,
            roster[player.playerId],
            round?.initialSeconds ?? 0,
            player.playerId in left,
            round?.maxAttempts ?? 8,
          ),
        )
        .sort((first, second) => {
          if (first.status === 'solved' && second.status === 'solved') {
            return (first.solvedPosition ?? 0) - (second.solvedPosition ?? 0);
          }
          if (first.status === 'solved') return -1;
          if (second.status === 'solved') return 1;
          // Whoever left drops to the bottom of the panel.
          if (first.status === 'left') return 1;
          if (second.status === 'left') return -1;
          return 0;
        }),
    [players, myId, roster, left, round?.initialSeconds, round?.maxAttempts, teamMode, myTeam],
  );

  const rivalClocks = useMemo(() => {
    const clocks: Record<string, number> = {};
    for (const rival of rivals) {
      clocks[rival.id] = rival.status === 'playing' ? secondsLeftAt(rival, now) : rival.secondsLeft;
    }
    return clocks;
  }, [rivals, now]);

  // "Hugo tiene menos de 15 s" is derived from the ticking clocks, once per rival.
  // In team mode the rival clock is the team's; the panel shows it in red.
  useEffect(() => {
    if (teamMode) return;
    for (const rival of rivals) {
      if (rival.status === 'playing' && (rivalClocks[rival.id] ?? Infinity) < LOW_TIME_THRESHOLD) {
        announceLowTime(rival.id);
      }
    }
  }, [rivals, rivalClocks, announceLowTime, teamMode]);

  const keyStates = useMemo(
    () => deriveKeyStates(me?.rows ?? [], me?.hint ?? null),
    [me?.rows, me?.hint],
  );

  const submit = useCallback(async () => {
    const current = useGameStore.getState();
    if (current.status !== 'playing' || !current.me || current.me.finished) return;
    // Guess errors are printed under the row being typed, where the player is
    // looking; a toast there would cover the clock.
    if (current.draft.length < (current.round?.wordLength ?? 5)) {
      noticeGuess(t.game.tooShort);
      return;
    }
    const result = await sendGuess(current.draft);
    if (!result || result.ok) return;
    if (result.error.code === 'word_not_in_list' || result.error.code === 'word_length') {
      noticeGuess(t.errors[result.error.code]);
      return;
    }
    toast.error(result.error.message === 'timeout' ? 'timeout' : result.error.code);
  }, [sendGuess, noticeGuess, t]);

  const handleEnter = useCallback(() => void submit(), [submit]);

  usePhysicalKeyboard({
    enabled: playing && !me?.finished && !observing,
    language: settings?.language ?? 'es',
    onLetter: typeLetter,
    onEnter: handleEnter,
    onBackspace: backspace,
  });

  const handleHint = useCallback(async () => {
    const result = await requestHint();
    if (result.ok) {
      const letter = result.value.letter.toUpperCase();
      toast.info(
        result.value.kind === 'position' && result.value.position !== null
          ? t.game.hintPosition(letter, result.value.position + 1)
          : t.game.hintLetter(letter),
      );
    } else {
      toast.error(result.error.code);
    }
  }, [requestHint, t]);

  const handleEmote = useCallback(
    async (emote: Emote) => {
      // The local half of the burst rule; it also raises the "wait 5 s" toast.
      if (!useGameStore.getState().tryEmote()) return;
      const result = await sendReaction(emote);
      if (result.ok) return;
      if (result.error.code === 'cooldown') useGameStore.getState().pauseEmotes();
      else toast.error(result.error.code);
    },
    [sendReaction],
  );

  const handleSit = useCallback(
    async (wants: boolean) => {
      const result = await sit(wants);
      if (!result.ok) toast.error(result.error.code);
    },
    [sit],
  );

  if (!round || !me || !settings) {
    return (
      <PageLoading
        title={connection === 'disconnected' ? t.common.reconnecting : t.game.roundStarting}
      />
    );
  }

  const myTeamState = myTeam ? teams[myTeam] : undefined;
  const outcome: MyOutcome = me.solved
    ? 'solved'
    : me.finished
      ? teamMode && myTeamState?.solved
        ? 'team-solved'
        : me.rows.length >= round.maxAttempts
          ? 'out-of-attempts'
          : 'out-of-time'
      : 'playing';
  const secondsLeft = me.finished ? me.secondsLeft : secondsLeftAt(me, now);
  const percent = percentOf(secondsLeft, round.initialSeconds);
  const myProgress = myId ? players[myId] : undefined;
  const solvedPosition = myProgress?.solvedPosition ?? null;

  const preview = computeScorePreview({
    secondsLeft,
    initialSeconds: round.initialSeconds,
    attempts: me.rows.length,
    solved: me.solved,
    solvedPosition,
    finished: me.finished,
    solvedCount,
    hintEnabled: round.hintAvailable,
    hintUsed: me.hintUsed,
    greens: myProgress?.greens ?? countGreenPositions(me.rows),
    // Yellow slots only exist on the server ledger (the client never learns
    // which answer slot a yellow tile pointed at, nor the hint's position).
    yellows: myProgress?.yellows ?? 0,
  });

  let team: TeamViewProps | null = null;
  if (teamMode && myTeam && myTeamState) {
    const header = (id: typeof myTeam) => {
      const info = teamInfo.find((entry) => entry.id === id);
      return {
        id,
        name: info?.name ?? '',
        color: info?.color ?? (id === 'a' ? 'violet' : 'gold'),
        roundsWon: info?.roundsWon ?? 0,
      };
    };
    const rivalId = otherTeam(myTeam);
    const rivalState = teams[rivalId];
    const rivalMembers: RivalViewModel[] = rivals.filter(
      (rival) => roster[rival.id]?.team === rivalId,
    );
    const teammateIds = new Set([
      ...Object.keys(teammateRows),
      ...Object.keys(roster).filter((id) => id !== myId && roster[id]?.team === myTeam),
    ]);
    const teammates = [...teammateIds]
      .filter((id) => id !== myId)
      .map((id) =>
        toTeammateViewModel(
          id,
          teammateRows[id] ?? [],
          roster[id],
          myTeamState.solverId,
          id in left,
        ),
      )
      .sort((first, second) => Number(second.isSolver) - Number(first.isSolver));
    const solvedTeams = Object.values(teams).filter((entry) => entry?.solved).length;
    team = {
      mine: header(myTeam),
      solverName: myTeamState.solverId ? (roster[myTeamState.solverId]?.name ?? '?') : null,
      teammates,
      rival:
        rivalState && rivalMembers.length > 0
          ? toRivalTeamViewModel(
              header(rivalId),
              rivalState,
              rivalMembers,
              rivalState.solverId ? (roster[rivalState.solverId]?.name ?? '?') : null,
              round.initialSeconds,
            )
          : null,
      rivalClock:
        rivalState && !rivalState.finished
          ? secondsLeftAt(rivalState, now)
          : (rivalState?.secondsLeft ?? 0),
      preview: computeTeamScorePreview({
        secondsLeft,
        initialSeconds: round.initialSeconds,
        attemptsAfterFirst: myTeamState.attemptsAfterFirst,
        myAttempts: me.rows.length,
        solved: myTeamState.solved,
        solvedPosition: myTeamState.solvedPosition,
        finished: myTeamState.finished,
        solvedTeams,
        hintEnabled: round.hintAvailable,
        hintUsed: myTeamState.hintUsed,
      }),
    };
  }

  // Team mode: "finished" is the team's; the team channel is always open.
  const doneWithRound = observing || (teamMode ? (myTeamState?.finished ?? false) : me.finished);
  const chat = {
    panel: (
      <ChatContainer
        teamMode={teamMode}
        myTeam={observing ? null : myTeam}
        canWriteAll={doneWithRound || status !== 'playing'}
        lockedReason={teamMode ? t.chat.lockedTeam : t.chat.locked}
        bare={!isDesktop}
        className="min-h-0 flex-1"
      />
    ),
    open: chatOpen,
    unread: chatUnread,
    onToggle: () => setChatOpen(!chatOpen),
  };
  const observer = observing
    ? {
        wantsSeat: observers.find((entry) => entry.id === myId)?.wantsSeat ?? false,
        freeSeats: Math.max(0, settings.capacity - Object.keys(players).length),
        pending: sitting,
        onSit: (wants: boolean) => void handleSit(wants),
      }
    : null;

  const view: GameViewProps = {
    t,
    roomCode,
    round,
    wordLanguage: settings.language,
    clock: {
      secondsLeft,
      percent,
      frozen: me.finished,
      low: !me.finished && secondsLeft < LOW_TIME_THRESHOLD,
    },
    gains,
    penaltySeconds: me.penaltySeconds,
    rows: me.rows,
    draft,
    hint: me.hint,
    revealRow,
    shakeKey,
    guessNotice,
    keyStates,
    tileLabels: {
      green: t.game.tileCorrect,
      yellow: t.game.tilePresent,
      gray: t.game.tileAbsent,
      hint: t.game.tileHint,
    },
    outcome,
    solvedPosition,
    rivals,
    rivalClocks,
    solvedCount,
    feed,
    sticker,
    preview,
    team,
    observer,
    chat,
    hintState: !round.hintAvailable ? 'off' : me.hintUsed ? 'used' : 'available',
    hintPending,
    emoteCooldownSeconds: Math.max(0, Math.ceil((emotePausedUntil - now) / 1000)),
    onLetter: typeLetter,
    onEnter: handleEnter,
    onBackspace: backspace,
    onHint: () => void handleHint(),
    onEmote: (emote) => void handleEmote(emote),
  };

  return isDesktop ? <GameDesktop {...view} /> : <GameMobile {...view} />;
};
