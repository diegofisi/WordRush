import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  GAME_KINDS,
  ROOM_LIMITS,
  WORD_LENGTHS,
  type GameKind,
  type GameMode,
  type Language,
  type RoomSettings,
  type WordLength,
} from '@shared/contract';

export class RoomSettingsDto implements RoomSettings {
  @IsIn(['es', 'en'])
  language!: Language;
  @IsIn(GAME_KINDS)
  game!: GameKind;
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

  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
  /** The room plays against the fly. Optional: absent means no. */
  @IsOptional()
  @IsBoolean()
  bossMode?: boolean;
}
