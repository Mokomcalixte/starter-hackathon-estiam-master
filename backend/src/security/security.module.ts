import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AntiFraudService } from './anti-fraud.service'
import { FraudGuard } from './fraud.guard'
import { SecurityController } from './security.controller'

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 20,
      },
    ]),
  ],
  controllers: [SecurityController],
  providers: [
    AntiFraudService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: FraudGuard,
    },
  ],
  exports: [AntiFraudService],
})
export class SecurityModule {}
