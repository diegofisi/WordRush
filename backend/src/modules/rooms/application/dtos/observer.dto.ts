import { IsBoolean } from 'class-validator';
import type { ObserverSitPayload } from '@shared/contract';

export class ObserverSitDto implements ObserverSitPayload {
  @IsBoolean()
  wants!: boolean;
}
