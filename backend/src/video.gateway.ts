import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

// @WebSocketGateway ouvre un port de communication permanent. 
// "cors: true" est une sécurité pour autoriser l'interface React (Frontend) à s'y connecter.
@WebSocketGateway({ cors: true })
export class VideoGateway {

    // @WebSocketServer te donne accès à l'outil global pour parler à tout le monde
    @WebSocketServer()
    server!: Server;

    // === 1. GESTION DES SALONS ===
    // Quand le Frontend (Dev 3) envoie le message 'JOIN_ROOM'...
    @SubscribeMessage('JOIN_ROOM')
    handleJoinRoom(@MessageBody() data: { roomId: string, username: string }, @ConnectedSocket() client: Socket) {
        // On prend le client (l'utilisateur) et on le force à entrer dans le salon virtuel
        client.join(data.roomId);
        // Un petit log dans ton terminal pour que tu puisses suivre ce qu'il se passe
        console.log(`[JOIN] ${data.username} a rejoint le salon ${data.roomId}`);
    }

    // === 2. LECTURE DE LA VIDÉO ===
    // Quand le Frontend envoie le message 'CMD_PLAY'...
    @SubscribeMessage('CMD_PLAY')
    handlePlay(@MessageBody() data: { roomId: string, role: string }) {

        // VÉRIFICATION DE SÉCURITÉ : Est-ce bien le présentateur ?
        if (data.role === 'PRESENTATEUR') {
            console.log(`[PLAY] Lecture lancée par le présentateur dans le salon ${data.roomId}`);

            // La commande magique : on prend tous les gens dans la "roomId",
            // et on leur diffuse le message 'SYNC_PLAY' pour forcer leur lecteur à démarrer.
            this.server.to(data.roomId).emit('SYNC_PLAY');

        } else {
            // Si c'est un invité, on ne fait rien, on bloque la triche !
            console.log(`[REJETÉ] Un invité a essayé de lancer la vidéo.`);
        }
    }

    // === 3. PAUSE DE LA VIDÉO ===
    @SubscribeMessage('CMD_PAUSE')
    handlePause(@MessageBody() data: { roomId: string, role: string }) {

        // Toujours la même sécurité
        if (data.role === 'PRESENTATEUR') {
            console.log(`[PAUSE] Pause demandée dans le salon ${data.roomId}`);
            // On diffuse l'ordre de pause à tout le monde
            this.server.to(data.roomId).emit('SYNC_PAUSE');
        }
    }
}