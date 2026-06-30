import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  // Hackathon : on autorise le front (Vite) à appeler l'API. À restreindre en prod.
  app.enableCors()
  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
