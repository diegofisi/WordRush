import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useSessionStore } from '@/core/session/stores/useSessionStore';
import { PageLoading } from '@/shared/components/ui/PageState';
import { MAX_ATTEMPTS, WORD_LENGTH, type Emote } from '@/shared/contract';
import { useIsDesktopGame } from '@/shared/hooks/useMediaQuery';
import { useNow } from '@/shared/hooks/useNow';
import { useToastSafeBottom } from '@/shared/hooks/useToastSafeBottom';
import { useT } from '@/shared/i18n';
import { percentOf, secondsLeftAt } from '@/shared/lib/format';
import { resultsPath } from '@/shared/routes/paths';
import { toast } from '@/shared/stores/useToastStore';

import { useSendGuess } from '../api/send-guess/useSendGuess';
import { useSendReaction } from '../api/send-reaction/useSendReaction';
import { useUseHint } from '../api/use-hint/useUseHint';
import { GameDesktop } from '../components/GameDesktop';
import { GameMobile } from '../components/GameMobile';
import { countGreenPositions, deriveKeyStates } from '../helpers/keyboard';
import { computeScorePreview } from '../helpers/scorePreview';
import { useBossBroadcast } from '../hooks/useBossBroadcast';
import { useClockSounds } from '../hooks/useClockSounds';
import { usePhysicalKeyboard } from '../hooks/usePhysicalKeyboard';
import { toRivalViewModel } from '../models/game.model';
import type { BossViewModel, GameViewProps, MyOutcome } from '../models/game-view.model';
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
  const settings = useGameStore((state) => state.settings);
  const roster = useGameStore((state) => state.roster);
  const myId = useGameStore((state) => state.myId);
  const me = useGameStore((state) => state.me);
  const players = useGameStore((state) => state.players);
  const left = useGameStore((state) => state.left);
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

  const { sendGuess } = useSendGuess();
  const { requestHint, pending: hintPending } = useUseHint();
  const { sendReaction } = useSendReaction();

  const playing = status === 'playing' && Boolean(round && me);
  const now = useNow(100, playing || status === 'ended');

  // The server decides when a round ends; we only follow it to the results screen.
  useEffect(() => {
    if (status === 'ended') navigate(resultsPath(roomCode), { replace: true });
  }, [status, roomCode, navigate]);

  const boss = useGameStore((state) => state.boss);
  const bossFrame = useGameStore((state) => state.bossFrame);

  const rivals = useMemo(
    () =>
      Object.values(players)
        // The fly gets her own health panel instead of a rival card.
        .filter((player) => player.playerId !== myId && player.playerId !== boss?.playerId)
        .map((player) =>
          toRivalViewModel(
            player,
            roster[player.playerId],
            round?.initialSeconds ?? 0,
            player.playerId in left,
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
    [players, myId, roster, left, round?.initialSeconds, boss?.playerId],
  );

  const rivalClocks = useMemo(() => {
    const clocks: Record<string, number> = {};
    for (const rival of rivals) {
      clocks[rival.id] = rival.status === 'playing' ? secondsLeftAt(rival, now) : rival.secondsLeft;
    }
    return clocks;
  }, [rivals, now]);

  // Her clock ticks the same way a rival's does; the bar is that against the
  // clock she started the round with (docs/context/06-boss-mode.md).
  const bossView = useMemo<BossViewModel | null>(() => {
    if (!boss) return null;
    const done = boss.solved || boss.defeated;
    const secondsLeft = done ? boss.secondsLeft : secondsLeftAt(boss, now);
    return {
      id: boss.playerId,
      secondsLeft,
      percent: Math.max(0, Math.min(100, percentOf(secondsLeft, boss.startSeconds))),
      startSeconds: boss.startSeconds,
      damageSeconds: boss.damageSeconds,
      forfeitedSeconds: boss.forfeitedSeconds,
      attempt: boss.attempt,
      solved: boss.solved,
      defeated: boss.defeated,
      rows: players[boss.playerId]?.rows ?? [],
      decision: boss.decision,
      frame: bossFrame,
    };
  }, [boss, bossFrame, players, now]);

  // The brain tab lives in another tab and has no socket of its own; this is
  // what feeds it, and what tells the server to stream while it is open.
  useBossBroadcast(roomCode, bossView);

  // "Hugo tiene menos de 15 s" is derived from the ticking clocks, once per rival.
  useEffect(() => {
    for (const rival of rivals) {
      if (rival.status === 'playing' && (rivalClocks[rival.id] ?? Infinity) < LOW_TIME_THRESHOLD) {
        announceLowTime(rival.id);
      }
    }
  }, [rivals, rivalClocks, announceLowTime]);

  const keyStates = useMemo(
    () => deriveKeyStates(me?.rows ?? [], me?.hint ?? null),
    [me?.rows, me?.hint],
  );

  const submit = useCallback(async () => {
    const current = useGameStore.getState();
    if (current.status !== 'playing' || !current.me || current.me.finished) return;
    // Guess errors are printed under the row being typed, where the player is
    // looking; a toast there would cover the clock.
    if (current.draft.length < WORD_LENGTH) {
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
    enabled: playing && !me?.finished,
    language: settings?.language ?? 'es',
    onLetter: typeLetter,
    onEnter: handleEnter,
    onBackspace: backspace,
  });

  const handleHint = useCallback(async () => {
    const result = await requestHint();
    if (result.ok) {
      toast.info(t.game.hintInWord(result.value.letter.toUpperCase(), result.value.count));
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

  // Above the early return: hooks run in the same order on every render, and
  // `me` is only missing while the round is still being handed over.
  useClockSounds(
    me && !me.finished ? secondsLeftAt(me, now) : 0,
    me !== null && !me.finished && status === 'playing',
  );

  if (!round || !me || !settings) {
    return (
      <PageLoading
        title={connection === 'disconnected' ? t.common.reconnecting : t.game.roundStarting}
      />
    );
  }

  const outcome: MyOutcome = me.solved
    ? 'solved'
    : me.finished
      ? me.rows.length >= MAX_ATTEMPTS
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
    outcome,
    solvedPosition,
    rivals,
    rivalClocks,
    boss: bossView,
    solvedCount,
    feed,
    sticker,
    preview,
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
