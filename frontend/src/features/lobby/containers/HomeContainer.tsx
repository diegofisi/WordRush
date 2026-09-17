import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DEFAULT_WORD_LENGTH, ROOM_LIMITS, type GameKind } from '@/shared/contract';
import { useT } from '@/shared/i18n';
import { lobbyPath } from '@/shared/routes/paths';
import { toast } from '@/shared/stores/useToastStore';
import { useUiStore } from '@/shared/stores/useUiStore';
import { playSound } from '@/shared/lib/sound';

import type { CreateRoomForm as CreateRoomFormValues } from '../api/create-room/create-room.dto';
import { useCreateRoom } from '../api/create-room/useCreateRoom';
import { useJoinRoom } from '../api/join-room/useJoinRoom';
import { CreateRoomForm } from '../components/CreateRoomForm';
import { JoinRoomForm } from '../components/JoinRoomForm';

const defaultValues = (name: string, uiLang: 'es' | 'en'): CreateRoomFormValues => ({
  name,
  language: uiLang,
  game: 'wordle',
  mode: 'normal',
  wordLength: DEFAULT_WORD_LENGTH,
  initialSeconds: 90,
  rounds: 3,
  capacity: ROOM_LIMITS.maxPlayers,
  hintEnabled: true,
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
  bossMode: false,
});

interface HomeContainerProps {
  /** Chosen on the hero, above the forms. */
  game: GameKind;
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
  /** The third home option: the room plays against the fly. */
  bossMode: boolean;
}

/** Owns the create/join forms; the name is shared by both actions. */
export const HomeContainer = ({ game, bossMode }: HomeContainerProps) => {
  const t = useT();
  const navigate = useNavigate();
  const rememberedName = useUiStore((state) => state.rememberedName);
  const rememberName = useUiStore((state) => state.rememberName);
  const uiLang = useUiStore((state) => state.lang);

  const [values, setValues] = useState<CreateRoomFormValues>(() =>
    defaultValues(rememberedName, uiLang),
  );
  const [code, setCode] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const { createRoom, pending: creating } = useCreateRoom();
  const { joinRoom, pending: joining } = useJoinRoom();

  useEffect(() => {
    setValues((current) => (current.game === game ? current : { ...current, game }));
  }, [game]);

  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — start.
  // Choosing the fly forces the only shape she can play: five letters, no
  // teams (docs/context/08-boss-mode.md). Unchoosing it leaves the rest alone.
  useEffect(() => {
    setValues((current) =>
      current.bossMode === bossMode
        ? current
        : bossMode
          ? { ...current, bossMode, wordLength: DEFAULT_WORD_LENGTH, mode: 'normal' }
          : { ...current, bossMode },
    );
  }, [bossMode]);
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — end.

  const validName = () => {
    const name = values.name.trim();
    if (name.length < ROOM_LIMITS.nameMinLength) {
      setNameError(t.home.nameRequired);
      return null;
    }
    setNameError(null);
    rememberName(name);
    return name;
  };

  const handleCreate = async () => {
    if (!validName()) return;
    const result = await createRoom(values);
    if (result.ok) {
      playSound('roomCreated');
      navigate(lobbyPath(result.value.roomCode));
    } else toast.error(result.error.message === 'timeout' ? 'timeout' : result.error.code);
  };

  const handleJoin = async () => {
    const name = validName();
    if (!name) return;
    if (!code.trim()) {
      setCodeError(t.home.codeRequired);
      return;
    }
    setCodeError(null);
    const result = await joinRoom(code, name);
    if (result.ok) navigate(lobbyPath(result.value.roomCode));
    else toast.error(result.error.message === 'timeout' ? 'timeout' : result.error.code);
  };

  return (
    <div className="flex h-full flex-col justify-between gap-6">
      <CreateRoomForm
        t={t}
        values={values}
        nameError={nameError}
        pending={creating}
        onChange={(patch) =>
          setValues((current) => {
            const next = { ...current, ...patch };
            // BOSS-MODE (temporary; see docs/context/07-boss-removal.md): she only plays the five-letter word
            // race with no teams, so those three controls snap back while she
            // is chosen rather than quietly costing the room its opponent.
            return next.bossMode
              ? { ...next, game: 'wordle', mode: 'normal', wordLength: DEFAULT_WORD_LENGTH }
              : next;
          })
        }
        onSubmit={() => void handleCreate()}
      />
      <JoinRoomForm
        t={t}
        code={code}
        codeError={codeError}
        pending={joining}
        onCodeChange={(next) => {
          setCode(next);
          if (codeError) setCodeError(null);
        }}
        onSubmit={() => void handleJoin()}
      />
    </div>
  );
};
