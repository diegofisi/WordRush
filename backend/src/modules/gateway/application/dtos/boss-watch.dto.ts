import { IsBoolean } from 'class-validator';

/** Opening or closing the fly's brain panel. Streaming costs CPU, so it is asked for. */
export class BossWatchDto {
  @IsBoolean()
  watching!: boolean;
}
