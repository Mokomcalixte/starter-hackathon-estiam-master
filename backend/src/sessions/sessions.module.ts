import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SessionsGateway } from './sessions.gateway'
import { EngineModule } from '../engine/engine.module'

@Module({
  imports: [EngineModule],
  providers: [SessionsService, SessionsGateway],
  controllers: [SessionsController]
})
export class SessionsModule {}
