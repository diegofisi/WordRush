import type {
  CreateRoomPayload,
  GameMode,
  Language,
  SessionAck,
  WordLength,
} from '@/shared/contract';

export type CreateRoomRequest = CreateRoomPayload;
export type CreateRoomResponse = SessionAck;

/** Form values as the create screen holds them. */
export interface CreateRoomForm {
  name: string;
  language: Language;
  mode: GameMode;
  wordLength: WordLength;
  initialSeconds: number;
  rounds: number;
  capacity: number;
  hintEnabled: boolean;
}

export const toCreateRoomRequest = (form: CreateRoomForm): CreateRoomRequest => ({
  name: form.name.trim(),
  settings: {
    language: form.language,
    mode: form.mode,
    wordLength: form.wordLength,
    initialSeconds: form.initialSeconds,
    rounds: form.rounds,
    capacity: form.capacity,
    hintEnabled: form.hintEnabled,
  },
});
