import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { AntiFraudService } from './anti-fraud.service'

interface JwtPayload {
  sub?: number | string
  username?: string
  role?: string
}

@Injectable()
export class FraudGuard implements CanActivate {
  constructor(
    private readonly antiFraud: AntiFraudService,
    private readonly jwt: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>()

    const ip = this.getClientIp(req)
    const userAgent = this.getHeader(req, 'user-agent')
    const accountId = this.getAccountId(req)

    const decision = this.antiFraud.evaluateRequest({
      ip,
      userAgent,
      accountId,
    })

    if (!decision.allowed) {
      this.antiFraud.addSecurityEvent({
        timestamp: new Date().toISOString(),
        ip,
        accountId,
        userAgent,
        path: req.originalUrl ?? req.url,
        method: req.method,
        action: 'blocked',
        reason: decision.reason ?? 'Requête suspecte bloquée',
      })

      throw new ForbiddenException({
        message: 'Requête bloquée par le module anti-fraude',
        reason: decision.reason,
        code: decision.code,
      })
    }

    this.antiFraud.addSecurityEvent({
      timestamp: new Date().toISOString(),
      ip,
      accountId,
      userAgent,
      path: req.originalUrl ?? req.url,
      method: req.method,
      action: 'allowed',
      reason: 'Requête autorisée',
    })

    return true
  }

  private getClientIp(req: Request): string {
    const forwardedFor = this.getHeader(req, 'x-forwarded-for')

    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim().replace('::ffff:', '')
    }

    const realIp = this.getHeader(req, 'x-real-ip')
    if (realIp) return realIp.trim().replace('::ffff:', '')

    return (req.ip || req.socket.remoteAddress || '0.0.0.0').replace(
      '::ffff:',
      '',
    )
  }

  private getAccountId(req: Request): string {
    // Démo pratique pour les tests: on peut forcer l’utilisateur avec X-Demo-User.
    const demoUser = this.getHeader(req, 'x-demo-user')
    if (demoUser) return demoUser

    const authorization = this.getHeader(req, 'authorization')
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined

    if (!token) return 'anonymous'

    try {
      const payload = this.jwt.decode(token) as JwtPayload | null
      return String(payload?.sub ?? payload?.username ?? 'anonymous')
    } catch {
      return 'anonymous'
    }
  }

  private getHeader(req: Request, name: string): string {
    const value = req.headers[name]
    if (Array.isArray(value)) return value[0] ?? ''
    return value ?? ''
  }
}
