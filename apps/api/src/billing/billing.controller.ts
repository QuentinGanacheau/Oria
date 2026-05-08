import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('status')
  configStatus() {
    return { stripeEnabled: this.billing.isEnabled() };
  }

  @Post('checkout/full-report')
  async checkout(@Body() body: CreateCheckoutDto) {
    return this.billing.createFullReportCheckout({
      successPath: body.successPath,
      cancelPath: body.cancelPath,
      sessionId: body.sessionId,
    });
  }

  @Get('session')
  async session(@Query('session_id') sessionId: string) {
    if (!sessionId) {
      return { paid: false };
    }
    return this.billing.verifyPaidSession(sessionId);
  }
}
