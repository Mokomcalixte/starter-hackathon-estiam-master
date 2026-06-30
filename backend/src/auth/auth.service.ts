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

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email)

    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Email ou mot de passe invalide')
    }

    const payload = { sub: user.id, email: user.email, role: user.role }
    const accessToken = await this.jwt.signAsync(payload)

    return {
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    }
  }

  async register(fullName: string, email: string, password: string) {
    const user = await this.users.create(fullName, email, password)

    const payload = { sub: user.id, email: user.email, role: user.role }
    const accessToken = await this.jwt.signAsync(payload)

    return {
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    }
  }
}