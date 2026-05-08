import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';

@Module({
  imports: [PrismaModule],
  controllers: [EmailController],
  providers: [EmailService],
  // Exporté pour qu'on puisse l'injecter ailleurs (ex: BillingService pour
  // l'email de confirmation de paiement dans une prochaine itération).
  exports: [EmailService],
})
export class EmailModule {}
