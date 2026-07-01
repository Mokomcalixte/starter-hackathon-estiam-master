import {
  ConnectedSocket,
  MessageBody,
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
export class SessionsGateway {
  @WebSocketServer()
  server: Server

  @SubscribeMessage('join-session')
  handleJoinSession(
    @MessageBody() data: { code: string; username: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.code)

    this.server.to(data.code).emit('participant-joined', {
      username: data.username,
    })
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
}