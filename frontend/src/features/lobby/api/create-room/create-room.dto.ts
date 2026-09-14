import type { CreateRoomPayload, Language, SessionAck } from '@/shared/contract';

export type CreateRoomRequest = CreateRoomPayload;
export type CreateRoomResponse = SessionAck;

/** Form values as the create screen holds them. */
export interface CreateRoomForm {
  name: string;
  language: Language;
  initialSeconds: number;
  rounds: number;
  capacity: number;
  hintEnabled: boolean;
  /** The room plays against the fly. docs/context/06-boss-mode.md */
  bossMode: boolean;
}

export const toCreateRoomRequest = (form: CreateRoomForm): CreateRoomRequest => ({
  name: form.name.trim(),
  settings: {
    language: form.language,
    initialSeconds: form.initialSeconds,
    rounds: form.rounds,
    capacity: form.capacity,
    hintEnabled: form.hintEnabled,
    bossMode: form.bossMode,
  },
});
