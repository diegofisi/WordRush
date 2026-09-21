import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DEFAULT_WORD_LENGTH, ROOM_LIMITS, type GameKind } from '@/shared/contract';
import { useT } from '@/shared/i18n';
import { lobbyPath } from '@/shared/routes/paths';
import { kickCooldown, useKickCooldown } from '@/shared/stores/useKickCooldown';
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
});

interface HomeContainerProps {
  /** Chosen on the hero, above the forms. */
  game: GameKind;
}

/** Owns the create/join forms; the name is shared by both actions. */
export const HomeContainer = ({ game }: HomeContainerProps) => {
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
  // A kick blocks this name in that room for 30 s; the notice counts it down.
  const kickedSeconds = useKickCooldown(code, values.name);

  useEffect(() => {
    setValues((current) => (current.game === game ? current : { ...current, game }));
  }, [game]);

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
    if (result.ok) {
      navigate(lobbyPath(result.value.roomCode));
      return;
    }
    // A kick is not a toast: one notice under the field, counting down.
    if (result.error.code === 'kicked') {
      kickCooldown.start(code, name, result.error.retryAfterSeconds ?? ROOM_LIMITS.kickRejoinSeconds);
      return;
    }
    toast.error(result.error.message === 'timeout' ? 'timeout' : result.error.code);
  };

  return (
    <div className="flex h-full flex-col justify-between gap-6">
      <CreateRoomForm
        t={t}
        values={values}
        nameError={nameError}
        pending={creating}
        onChange={(patch) => {
          // Every control but the name field is an option: it clicks.
          if (Object.keys(patch).some((key) => key !== 'name')) playSound('optionSelect');
          setValues((current) => ({ ...current, ...patch }));
        }}
        onSubmit={() => void handleCreate()}
      />
      <JoinRoomForm
        t={t}
        code={code}
        codeError={codeError}
        pending={joining}
        kickedSeconds={kickedSeconds}
        onCodeChange={(next) => {
          setCode(next);
          if (codeError) setCodeError(null);
        }}
        onSubmit={() => void handleJoin()}
      />
    </div>
  );
};
