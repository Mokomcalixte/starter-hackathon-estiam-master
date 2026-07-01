import { Controller, Get } from '@nestjs/common'
import { AntiFraudService } from './anti-fraud.service'

@Controller('security')
export class SecurityController {
  constructor(private readonly antiFraud: AntiFraudService) {}

  // Route de test pour Membre 2 / Membre 3.
  // Via Nginx: http://localhost/api/security/protected
  // Direct backend: http://localhost:3000/security/protected
  @Get('protected')
  protectedRoute() {
    return {
      ok: true,
      message: 'Accès autorisé à une ressource vidéo/API protégée',
      timestamp: new Date().toISOString(),
    }
  }

  @Get('events')
  events() {
    return this.antiFraud.getRecentEvents()
  }

  @Get('stats')
  stats() {
    return this.antiFraud.getStats()
  }
}
