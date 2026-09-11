import type { GuessAck, GuessPayload } from '@/shared/contract';

export type SendGuessRequest = GuessPayload;
export type SendGuessResponse = GuessAck;

/** The server normalises case and accents itself; we only trim. */
export const toSendGuessRequest = (word: string): SendGuessRequest => ({ word: word.trim() });
