import type { RoomSettings, UpdateSettingsPayload } from '@/shared/contract';

export type UpdateSettingsRequest = UpdateSettingsPayload;

/** Form values as the "change rules" dialog holds them: the settings themselves. */
export type RoomSettingsForm = RoomSettings;

export const toUpdateSettingsRequest = (form: RoomSettingsForm): UpdateSettingsRequest => ({
  settings: {
    language: form.language,
    initialSeconds: form.initialSeconds,
    rounds: form.rounds,
    capacity: form.capacity,
    hintEnabled: form.hintEnabled,
  },
});
