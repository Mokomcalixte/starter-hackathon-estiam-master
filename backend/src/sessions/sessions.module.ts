import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SessionsGateway } from './sessions.gateway'

@Module({
  providers: [SessionsService, SessionsGateway],
  controllers: [SessionsController]
})
export class SessionsModule {}
