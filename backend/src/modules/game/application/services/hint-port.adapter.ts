import { Injectable } from '@nestjs/common';
import type { HintReveal } from '@shared/contract';
import { DomainException } from '@shared/domain/domain.exception';
import type { IHintPort } from '../../domain/interfaces/round-bookkeeping.interface';
import { UseHintUseCase } from '../use-cases/use-hint.use-case';

/**
 * Turns the hint use case into the port another module can hold: a refusal
 * comes back as null instead of an exception, so a policy can simply ask.
 */
@Injectable()
export class HintPortAdapter implements IHintPort {
  constructor(private readonly useHint: UseHintUseCase) {}

  reveal(roomCode: string, playerId: string): HintReveal | null {
    try {
      const ack = this.useHint.execute(roomCode, playerId);
      return { letter: ack.letter, count: ack.count };
    } catch (error) {
      if (error instanceof DomainException) return null;
      throw error;
    }
  }
}
