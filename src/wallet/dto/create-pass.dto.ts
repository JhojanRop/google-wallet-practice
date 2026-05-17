export class CreatePassDto {
  readonly userId!: string;
  readonly holderName!: string;
  readonly eventName!: string;
  readonly eventDate!: string;
  readonly seat?: string;
}
