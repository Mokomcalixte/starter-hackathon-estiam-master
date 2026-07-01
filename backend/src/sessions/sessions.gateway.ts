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
  sentAt: string
  type: 'user' | 'system'
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SessionsGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly participantsBySession = new Map<string, Map<string, string>>()
  private readonly sessionBySocket = new Map<string, string>()
  private readonly messagesBySession = new Map<string, ChatMessage[]>()
  private readonly leaveTimersBySocket = new Map<
    string,
    ReturnType<typeof setTimeout>
  >()

  @SubscribeMessage('join-session')
  handleJoinSession(
    @MessageBody() data: { code: string; username: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.cancelPendingLeave(client.id)

    const previousCode = this.sessionBySocket.get(client.id)

    if (previousCode === data.code) {
      client.emit('chat-history', {
        messages: this.messagesBySession.get(data.code) ?? [],
      })
      this.emitParticipantList(data.code)
      return
    }

    if (previousCode && previousCode !== data.code) {
      this.removeParticipant(previousCode, client.id, true)
      client.leave(previousCode)
    }

    client.join(data.code)
    this.sessionBySocket.set(client.id, data.code)

    const participants =
      this.participantsBySession.get(data.code) ?? new Map<string, string>()
    const alreadyInRoom = [...participants.values()].includes(data.username)

    participants.set(client.id, data.username)
    this.participantsBySession.set(data.code, participants)

    if (!alreadyInRoom) {
      this.addSystemMessage(data.code, `${data.username} a rejoint la session`)
    }

    client.emit('chat-history', {
      messages: this.messagesBySession.get(data.code) ?? [],
    })

    this.emitParticipantList(data.code)
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
      action: 'play' | 'pause' | 'seek'
      time: number
    },
  ) {
    this.server.to(data.code).emit('video-control', data)
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
      this.sessionBySocket.set(client.id, data.code)

      const participants =
        this.participantsBySession.get(data.code) ?? new Map<string, string>()
      participants.set(client.id, data.username)
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

  handleDisconnect(client: Socket) {
    const code = this.sessionBySocket.get(client.id)

    if (!code) return

    this.scheduleParticipantRemoval(code, client.id)
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

    if (!participants) return

    const username = participants.get(socketId)
    participants.delete(socketId)
    this.sessionBySocket.delete(socketId)
    const stillConnectedWithSameName = username
      ? [...participants.values()].includes(username)
      : false

    if (participants.size === 0) {
      this.participantsBySession.delete(code)
      return
    }

    if (username && !silent && !stillConnectedWithSameName) {
      this.addSystemMessage(code, `${username} a quitte la session`)
    }

    this.emitParticipantList(code)
  }

  private emitParticipantList(code: string) {
    const participants = this.participantsBySession.get(code)
    const names = participants ? [...new Set(participants.values())] : []

    this.server.to(code).emit('participant-list', {
      participants: names,
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
    const chatMessage: ChatMessage = {
      ...message,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sentAt: new Date().toISOString(),
    }
    const messages = this.messagesBySession.get(code) ?? []

    messages.push(chatMessage)
    this.messagesBySession.set(code, messages.slice(-100))

    return chatMessage
  }
}
