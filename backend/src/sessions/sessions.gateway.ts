import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

// État en mémoire de chaque room
interface RoomState {
  isPlaying: boolean
  currentTime: number
  updatedAt: number   // timestamp local pour calculer la dérive
  playbackRate: number
  presenterSocketId: string | null
}

@WebSocketGateway({ cors: { origin: '*' } })
export class SessionsGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  // Map<roomCode, RoomState>
  private rooms = new Map<string, RoomState>()

  // Map<socketId, { code, username }>
  private clients = new Map<string, { code: string; username: string; isPresenter: boolean }>()

  // ── Déconnexion ──────────────────────────────────────────────
  handleDisconnect(client: Socket) {
    const info = this.clients.get(client.id)
    if (!info) return

    this.clients.delete(client.id)

    // Notifier la room
    this.server.to(info.code).emit('participant-left', { username: info.username })

    // Si le présentateur se déconnecte, nettoyer
    const room = this.rooms.get(info.code)
    if (room && room.presenterSocketId === client.id) {
      room.presenterSocketId = null
      this.rooms.set(info.code, room)
      this.server.to(info.code).emit('presenter-left', {})
    }
  }

  // ── Join session ─────────────────────────────────────────────
  @SubscribeMessage('join-session')
  handleJoinSession(
    @MessageBody() data: { code: string; username: string; isPresenter: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.code)

    // Enregistrer le client
    this.clients.set(client.id, {
      code: data.code,
      username: data.username,
      isPresenter: data.isPresenter,
    })

    // Créer la room si elle n'existe pas
    if (!this.rooms.has(data.code)) {
      this.rooms.set(data.code, {
        isPlaying: false,
        currentTime: 0,
        updatedAt: Date.now(),
        playbackRate: 1,
        presenterSocketId: null,
      })
    }

    // Si c'est le présentateur, l'enregistrer
    if (data.isPresenter) {
      const room = this.rooms.get(data.code)!
      room.presenterSocketId = client.id
      this.rooms.set(data.code, room)
    }

    // Notifier tout le monde
    this.server.to(data.code).emit('participant-joined', {
      username: data.username,
      isPresenter: data.isPresenter,
    })

    // ★ Resynchronisation tardive :
    // Envoyer l'état actuel au nouvel arrivant seulement
    const room = this.rooms.get(data.code)!
    const elapsed = (Date.now() - room.updatedAt) / 1000
    const syncTime = room.isPlaying
      ? room.currentTime + elapsed * room.playbackRate
      : room.currentTime

    client.emit('sync-state', {
      isPlaying: room.isPlaying,
      currentTime: syncTime,
      playbackRate: room.playbackRate,
    })
  }

  // ── Contrôle vidéo (présentateur uniquement) ─────────────────
  @SubscribeMessage('video-control')
  handleVideoControl(
    @MessageBody()
    data: {
      code: string
      action: 'play' | 'pause' | 'seek' | 'rate'
      time: number
      rate?: number
    },
    @ConnectedSocket() client: Socket,
  ) {
    const info = this.clients.get(client.id)

    // Sécurité : seul le présentateur peut envoyer des contrôles
    if (!info?.isPresenter) return

    // Mettre à jour l'état de la room
    const room = this.rooms.get(data.code) ?? {
      isPlaying: false,
      currentTime: 0,
      updatedAt: Date.now(),
      playbackRate: 1,
      presenterSocketId: client.id,
    }

    room.currentTime = data.time
    room.updatedAt = Date.now()

    if (data.action === 'play') room.isPlaying = true
    if (data.action === 'pause') room.isPlaying = false
    if (data.action === 'rate' && data.rate) room.playbackRate = data.rate

    this.rooms.set(data.code, room)

    // ★ Anti-boucle d'écho : broadcast SAUF l'émetteur
    client.to(data.code).emit('video-control', data)
  }

  // ── Demande de resync manuelle ────────────────────────────────
  @SubscribeMessage('request-sync')
  handleRequestSync(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.rooms.get(data.code)
    if (!room) return

    const elapsed = (Date.now() - room.updatedAt) / 1000
    const syncTime = room.isPlaying
      ? room.currentTime + elapsed * room.playbackRate
      : room.currentTime

    client.emit('sync-state', {
      isPlaying: room.isPlaying,
      currentTime: syncTime,
      playbackRate: room.playbackRate,
    })
  }

  // ── Chat ──────────────────────────────────────────────────────
  @SubscribeMessage('chat-message')
  handleChatMessage(
    @MessageBody() data: { code: string; username: string; message: string },
  ) {
    this.server.to(data.code).emit('chat-message', {
      ...data,
      timestamp: new Date().toISOString(),
    })
  }

  // ── Réactions emoji (bonus) ───────────────────────────────────
  @SubscribeMessage('reaction')
  handleReaction(
    @MessageBody() data: { code: string; username: string; emoji: string },
  ) {
    this.server.to(data.code).emit('reaction', data)
  }
}