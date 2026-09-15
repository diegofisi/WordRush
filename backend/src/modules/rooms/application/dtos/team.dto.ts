import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import {
  ROOM_LIMITS,
  TEAM_COLORS,
  TEAM_IDS,
  type AssignTeamPayload,
  type CustomizeTeamPayload,
  type JoinTeamPayload,
  type TeamColor,
  type TeamId,
} from '@shared/contract';

export class JoinTeamDto implements JoinTeamPayload {
  @IsIn(TEAM_IDS)
  team!: TeamId;
}

export class AssignTeamDto implements AssignTeamPayload {
  @IsString()
  @Length(1, 64)
  playerId!: string;

  @IsIn(TEAM_IDS)
  team!: TeamId;
}

export class CustomizeTeamDto implements CustomizeTeamPayload {
  @IsIn(TEAM_IDS)
  team!: TeamId;

  @IsOptional()
  @IsString()
  @MaxLength(ROOM_LIMITS.nameMaxLength)
  name?: string;

  @IsOptional()
  @IsIn(TEAM_COLORS)
  color?: TeamColor;
}
