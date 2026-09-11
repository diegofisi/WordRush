import { IsString, MaxLength } from 'class-validator';
import type { GuessPayload } from '@shared/contract';

export class GuessDto implements GuessPayload {
  /** Length is checked after accent normalisation in the use case (`word_length`). */
  @IsString()
  @MaxLength(32)
  word!: string;
}
