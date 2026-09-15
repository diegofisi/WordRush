import { IsString, MaxLength } from 'class-validator';
import type { PhraseSendPayload } from '@shared/contract';

export class PhraseSendDto implements PhraseSendPayload {
  /** Shape (words and lengths) is checked in the use case (`phrase_shape`). */
  @IsString()
  @MaxLength(120)
  text!: string;
}
