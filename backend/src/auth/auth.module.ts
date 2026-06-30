import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import type { StringValue } from 'ms'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AuthGuard } from './auth.guard'
import { UsersService } from './users.service'

// 🔐 Brique d'IDENTITÉ partagée — point de départ, PAS l'objet de la note.
//    • P1   : identifie le collaborateur (req.user) pour la collaboration temps réel.
//    • P2-A : émet le token court qui ouvrira la clé AES (Zero-Trust, refus par défaut).
//    • P2-B : rattache chaque requête à un compte (sessions simultanées, blocage…).
//    À durcir librement : inscription, refresh tokens, rôles fins, anti-bruteforce…
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: (process.env.JWT_TTL ?? '15m') as StringValue }, // token volontairement court
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService, AuthGuard],
  exports: [AuthGuard, JwtModule],
})
export class AuthModule {}
