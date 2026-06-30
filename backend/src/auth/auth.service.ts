import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import { UsersService } from './users.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  // Vérifie les identifiants puis émet un JWT court qui identifiera l'utilisateur
  // sur toutes les requêtes suivantes.
  async login(username: string, password: string) {
    const user = await this.users.findByUsername(username)
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Identifiants invalides')
    }

    const payload = { sub: user.id, username: user.username, role: user.role }
    const accessToken = await this.jwt.signAsync(payload)

    return {
      accessToken,
      user: { id: user.id, username: user.username, role: user.role },
    }
  }
}
