import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { initDatabase } from '../database/database'
import { join } from 'path'
import { NestExpressApplication } from '@nestjs/platform-express'

async function bootstrap() {
  await initDatabase()

  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  app.enableCors()

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  })

  await app.listen(process.env.PORT ?? 3000)

  console.log('✅ Backend démarré')
}

bootstrap()