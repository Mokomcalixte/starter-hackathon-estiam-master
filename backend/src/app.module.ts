import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { EngineModule } from './engine/engine.module'
import { SecurityModule } from './security/security.module'
import { SessionsModule } from './sessions/sessions.module'
import { VideoGateway } from './video.gateway'

@Module({
  imports: [AuthModule, SecurityModule, SessionsModule, EngineModule],
  controllers: [AppController],
  providers: [AppService, VideoGateway],
})
export class AppModule {}
