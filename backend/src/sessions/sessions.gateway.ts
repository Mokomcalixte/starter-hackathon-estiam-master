import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

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

  @SubscribeMessage('join-session')
  handleJoinSession(
    @MessageBody() data: { code: string; username: string },
    @ConnectedSocket() client: Socket,
  ) {
    const previousCode = this.sessionBySocket.get(client.id)

    if (previousCode && previousCode !== data.code) {
      this.removeParticipant(previousCode, client.id)
      client.leave(previousCode)
    }

    client.join(data.code)
    this.sessionBySocket.set(client.id, data.code)

    const participants =
      this.participantsBySession.get(data.code) ?? new Map<string, string>()
    participants.set(client.id, data.username)
    this.participantsBySession.set(data.code, participants)

    this.server.to(data.code).emit('participant-joined', {
      username: data.username,
    })
    this.emitParticipantList(data.code)
  }

  @SubscribeMessage('leave-session')
  handleLeaveSession(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(data.code)
    this.removeParticipant(data.code, client.id)
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
  ) {
    this.server.to(data.code).emit('chat-message', data)
  }

  handleDisconnect(client: Socket) {
    const code = this.sessionBySocket.get(client.id)

    if (!code) return

    this.removeParticipant(code, client.id)
  }

  private removeParticipant(code: string, socketId: string) {
    const participants = this.participantsBySession.get(code)

    if (!participants) return

    participants.delete(socketId)
    this.sessionBySocket.delete(socketId)

    if (participants.size === 0) {
      this.participantsBySession.delete(code)
      return
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
}
