import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { SecurityModule } from './security/security.module'
import { SessionsModule } from './sessions/sessions.module'
import { EngineModule } from './engine/engine.module'

@Module({
  imports: [AuthModule, SecurityModule, SessionsModule, EngineModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
