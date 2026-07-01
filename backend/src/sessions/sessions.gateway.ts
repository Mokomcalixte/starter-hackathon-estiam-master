import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

interface ChatMessage {
  id: string
  username: string
  message: string
  text: string
  sentAt: string
  timestamp: string
  type: 'user' | 'system'
}

interface Participant {
  username: string
  isPresenter: boolean
}

interface RoomState {
  isPlaying: boolean
  currentTime: number
  updatedAt: number
  playbackRate: number
  presenterSocketId: string | null
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SessionsGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly rooms = new Map<string, RoomState>()
  private readonly clients = new Map<
    string,
    { code: string; username: string; isPresenter: boolean }
  >()
  private readonly participantsBySession = new Map<
    string,
    Map<string, Participant>
  >()
  private readonly messagesBySession = new Map<string, ChatMessage[]>()
  private readonly leaveTimersBySocket = new Map<
    string,
    ReturnType<typeof setTimeout>
  >()

  @SubscribeMessage('join-session')
  handleJoinSession(
    @MessageBody()
    data: { code: string; username: string; isPresenter?: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    this.cancelPendingLeave(client.id)

    const previousClient = this.clients.get(client.id)

    if (previousClient?.code === data.code) {
      this.emitSessionState(data.code, client)
      return
    }

    if (previousClient && previousClient.code !== data.code) {
      this.removeParticipant(previousClient.code, client.id, true)
      client.leave(previousClient.code)
    }

    client.join(data.code)

    const isPresenter = Boolean(data.isPresenter)
    this.clients.set(client.id, {
      code: data.code,
      username: data.username,
      isPresenter,
    })

    const room = this.getOrCreateRoom(data.code)
    if (isPresenter) {
      room.presenterSocketId = client.id
    }

    const participants =
      this.participantsBySession.get(data.code) ?? new Map<string, Participant>()
    const alreadyInRoom = [...participants.values()].some(
      (participant) => participant.username === data.username,
    )

    participants.set(client.id, {
      username: data.username,
      isPresenter,
    })
    this.participantsBySession.set(data.code, participants)

    if (!alreadyInRoom) {
      this.addSystemMessage(data.code, `${data.username} a rejoint la session`)
    }

    this.emitParticipantList(data.code)
    this.emitSessionState(data.code, client)
  }

  @SubscribeMessage('leave-session')
  handleLeaveSession(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(data.code)
    this.scheduleParticipantRemoval(data.code, client.id)
  }

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

    if (!info?.isPresenter) return

    const room = this.getOrCreateRoom(data.code)
    room.currentTime = data.time
    room.updatedAt = Date.now()

    if (data.action === 'play') room.isPlaying = true
    if (data.action === 'pause') room.isPlaying = false
    if (data.action === 'rate' && data.rate) room.playbackRate = data.rate

    client.to(data.code).emit('video-control', data)
  }

  @SubscribeMessage('request-sync')
  handleRequestSync(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.emitSyncState(data.code, client)
  }

  @SubscribeMessage('chat-message')
  handleChatMessage(
    @MessageBody()
    data: {
      code: string
      username: string
      message: string
    },
    @ConnectedSocket() client: Socket,
  ) {
    if (!client.rooms.has(data.code)) {
      client.join(data.code)
      this.clients.set(client.id, {
        code: data.code,
        username: data.username,
        isPresenter: false,
      })

      const participants =
        this.participantsBySession.get(data.code) ??
        new Map<string, Participant>()
      participants.set(client.id, {
        username: data.username,
        isPresenter: false,
      })
      this.participantsBySession.set(data.code, participants)
      this.emitParticipantList(data.code)
    }

    const message = this.addMessage(data.code, {
      username: data.username,
      message: data.message,
      type: 'user',
    })

    this.server.to(data.code).emit('chat-message', message)
  }

  @SubscribeMessage('reaction')
  handleReaction(
    @MessageBody() data: { code: string; username: string; emoji: string },
  ) {
    this.server.to(data.code).emit('reaction', data)
  }

  handleDisconnect(client: Socket) {
    const info = this.clients.get(client.id)

    if (!info) return

    this.scheduleParticipantRemoval(info.code, client.id)
  }

  private getOrCreateRoom(code: string) {
    let room = this.rooms.get(code)

    if (!room) {
      room = {
        isPlaying: false,
        currentTime: 0,
        updatedAt: Date.now(),
        playbackRate: 1,
        presenterSocketId: null,
      }
      this.rooms.set(code, room)
    }

    return room
  }

  private scheduleParticipantRemoval(code: string, socketId: string) {
    this.cancelPendingLeave(socketId)

    const timer = setTimeout(() => {
      this.leaveTimersBySocket.delete(socketId)
      this.removeParticipant(code, socketId)
    }, 800)

    this.leaveTimersBySocket.set(socketId, timer)
  }

  private cancelPendingLeave(socketId: string) {
    const timer = this.leaveTimersBySocket.get(socketId)

    if (!timer) return

    clearTimeout(timer)
    this.leaveTimersBySocket.delete(socketId)
  }

  private removeParticipant(
    code: string,
    socketId: string,
    silent = false,
  ) {
    const participants = this.participantsBySession.get(code)
    const clientInfo = this.clients.get(socketId)

    if (!participants || !clientInfo) return

    const participant = participants.get(socketId)
    participants.delete(socketId)
    this.clients.delete(socketId)

    const room = this.rooms.get(code)
    if (room?.presenterSocketId === socketId) {
      room.presenterSocketId = null
      this.server.to(code).emit('presenter-left', {})
    }

    const stillConnectedWithSameName = participant
      ? [...participants.values()].some(
          (item) => item.username === participant.username,
        )
      : false

    if (participants.size === 0) {
      this.participantsBySession.delete(code)
      return
    }

    if (participant && !silent && !stillConnectedWithSameName) {
      this.addSystemMessage(code, `${participant.username} a quitte la session`)
    }

    this.emitParticipantList(code)
  }

  private emitSessionState(code: string, client: Socket) {
    client.emit('chat-history', {
      messages: this.messagesBySession.get(code) ?? [],
    })
    this.emitSyncState(code, client)
    this.emitParticipantList(code)
  }

  private emitSyncState(code: string, client: Socket) {
    const room = this.rooms.get(code)
    if (!room) return

    const elapsed = (Date.now() - room.updatedAt) / 1000
    const currentTime = room.isPlaying
      ? room.currentTime + elapsed * room.playbackRate
      : room.currentTime

    client.emit('sync-state', {
      isPlaying: room.isPlaying,
      currentTime,
      playbackRate: room.playbackRate,
    })
  }

  private emitParticipantList(code: string) {
    const participants = this.participantsBySession.get(code)
    const byName = new Map<string, Participant>()

    for (const participant of participants?.values() ?? []) {
      const existing = byName.get(participant.username)
      byName.set(participant.username, {
        username: participant.username,
        isPresenter:
          Boolean(existing?.isPresenter) || Boolean(participant.isPresenter),
      })
    }

    this.server.to(code).emit('participant-list', {
      participants: [...byName.values()],
    })
  }

  private addSystemMessage(code: string, message: string) {
    const chatMessage = this.addMessage(code, {
      username: 'Systeme',
      message,
      type: 'system',
    })

    this.server.to(code).emit('chat-message', chatMessage)
  }

  private addMessage(
    code: string,
    message: Pick<ChatMessage, 'username' | 'message' | 'type'>,
  ) {
    const timestamp = new Date().toISOString()
    const chatMessage: ChatMessage = {
      ...message,
      text: message.message,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sentAt: timestamp,
      timestamp,
    }
    const messages = this.messagesBySession.get(code) ?? []

    messages.push(chatMessage)
    this.messagesBySession.set(code, messages.slice(-100))

    return chatMessage
  }
}
