import { IsBoolean, IsIn, IsInt, Max, Min } from 'class-validator';
import {
  ROOM_LIMITS,
  WORD_LENGTHS,
  type GameMode,
  type Language,
  type RoomSettings,
  type WordLength,
} from '@shared/contract';

export class RoomSettingsDto implements RoomSettings {
  @IsIn(['es', 'en'])
  language!: Language;
  @IsIn(['normal', 'teams'])
  mode!: GameMode;
  @IsIn(WORD_LENGTHS)
  wordLength!: WordLength;

  @IsInt()
  @Min(ROOM_LIMITS.minInitialSeconds)
  @Max(ROOM_LIMITS.maxInitialSeconds)
  initialSeconds!: number;

  @IsInt()
  @Min(ROOM_LIMITS.minRounds)
  @Max(ROOM_LIMITS.maxRounds)
  rounds!: number;

  @IsInt()
  @Min(ROOM_LIMITS.minPlayers)
  @Max(ROOM_LIMITS.maxPlayers)
  capacity!: number;

  @IsBoolean()
  hintEnabled!: boolean;
}
