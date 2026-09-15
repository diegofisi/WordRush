import { Transform } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';
import { ROOM_LIMITS, type ChatChannel, type ChatSendPayload } from '@shared/contract';

const CHANNELS: readonly ChatChannel[] = ['all', 'team'];

/** Trimmed, and the inner whitespace collapsed so a message is one line. */
const tidy = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value;

export class ChatSendDto implements ChatSendPayload {
  @IsIn(CHANNELS)
  channel!: ChatChannel;

  @Transform(tidy)
  @IsString()
  @Length(1, ROOM_LIMITS.chatMaxLength)
  text!: string;
}
