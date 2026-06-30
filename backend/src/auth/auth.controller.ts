import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { AuthGuard } from './auth.guard'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // POST /auth/register
  @Post('register')
  register(
    @Body()
    body: {
      fullName?: string
      email?: string
      password?: string
    },
  ) {
    if (!body?.fullName || !body?.email || !body?.password) {
      throw new UnauthorizedException(
        'fullName, email et password sont requis',
      )
    }

    return this.auth.register(
      body.fullName,
      body.email,
      body.password,
    )
  }

  // POST /auth/login
  @Post('login')
  login(
    @Body()
    body: {
      email?: string
      password?: string
    },
  ) {
    if (!body?.email || !body?.password) {
      throw new UnauthorizedException(
        'email et password sont requis',
      )
    }

    return this.auth.login(
      body.email,
      body.password,
    )
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    return (req as Request & { user?: unknown }).user
  }
}