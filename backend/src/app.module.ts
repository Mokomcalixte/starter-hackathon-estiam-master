import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller'
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { User } from './user.entity';
import { VideoGateway } from './video.gateway';
import { SecurityModule } from './security/security.module';
import { SessionsModule } from './sessions/sessions.module';
import { EngineModule } from './engine/engine.module';

// Le mot-clé @Module déclare "l'enveloppe" principale de ton application
@Module({

  // "imports" sert à charger des outils externes ou d'autres modules
  imports: [
    // Ici, on configure la connexion à la base de données SQLite
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'db.sqlite', // C'est le nom du fichier que Calixte a créé
      entities: [User],      // On indique quelles tables existent dans la base
      // "synchronize: true" est magique : si tu ajoutes une colonne dans ton code, 
      // NestJS mettra à jour la base SQLite tout seul sans que tu n'aies rien à faire !
      synchronize: true,
    }),
    // On rend la table "User" accessible partout dans ce module
    TypeOrmModule.forFeature([User]),
    // On importe le module d'authentification (déjà fourni dans le starter)
    AuthModule,
  ],
  // "controllers" gère les routes classiques (les requêtes HTTP comme GET ou POST)

  imports: [AuthModule, SecurityModule, SessionsModule, EngineModule],
  controllers: [AppController],
  // "providers" regroupe les services métiers et tes WebSockets (la Gateway)
  providers: [AppService, VideoGateway],
})
export class AppModule { }