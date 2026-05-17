export class UpdatePassDto {
  userId!: string;
  holderName?: string;
  eventName?: string;
  eventDate?: string;
  seat?: string;
  state?: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
}
