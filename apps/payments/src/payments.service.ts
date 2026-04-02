import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { NOTIFICATIONS_SERVICE } from '@app/common';
import { ClientProxy } from '@nestjs/microservices';
import { PaymentsCreateChargeDto } from '../dto/payments-create-charge.dto';

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationsService: ClientProxy
  ) {
    this.stripe = new Stripe(this.configService.getOrThrow<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-02-25.clover',
    });
  }

  async createCharge({ card, amount, email }: PaymentsCreateChargeDto) {
    if (!card.token) {
      throw new BadRequestException(
        'Stripe token is required. Send charge.card.token (for example: tok_visa) instead of raw card fields.',
      );
    }

    const paymentMethod = await this.stripe.paymentMethods.create({
      type: 'card',
      card: {
        token: card.token,
      },
    });

    const paymentIntent = await this.stripe.paymentIntents.create({
      payment_method: paymentMethod.id,
      amount: amount * 100,
      confirm: true,
      payment_method_types: ['card'],
      currency: 'brl',
    });

    this.notificationsService.emit('notify_email', { 
      email, 
      text: `Your payment of $${amount} was successful!` 
    });

    return paymentIntent;
  }
}
