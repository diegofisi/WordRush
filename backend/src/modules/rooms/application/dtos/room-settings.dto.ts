import { IsBoolean, IsIn, IsInt, Max, Min } from 'class-validator';
import { ROOM_LIMITS, type Language, type RoomSettings } from '@shared/contract';

export class RoomSettingsDto implements RoomSettings {
  @IsIn(['es', 'en'])
  language!: Language;

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
