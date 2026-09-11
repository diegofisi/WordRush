import { EMOTES, type Emote } from '@/shared/contract';

const STORAGE_KEY = 'wordrush.recentEmotes';
const MAX_RECENT = 5;

const isEmote = (value: unknown): value is Emote => EMOTES.includes(value as Emote);

/** The last emotes this player sent, newest first. Never throws (private mode). */
export const readRecentEmotes = (): Emote[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEmote).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
};

/** Moves `emote` to the front of the recent list and returns the new list. */
export const pushRecentEmote = (emote: Emote): Emote[] => {
  const next = [emote, ...readRecentEmotes().filter((item) => item !== emote)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage disabled: the row simply does not survive a reload.
  }
  return next;
};
