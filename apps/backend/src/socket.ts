import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { verifier } from './middleware';
import { db, TABLE_NAME, MESSAGES_TABLE } from './db';
import { isChatAvailable } from './helpers';

export function setupSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token requerido'));
    try {
      const payload = await verifier.verify(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join-chat', async ({ gameId }: { gameId: string }) => {
      try {
        const gameResult = await db.send(new GetCommand({
          TableName: TABLE_NAME,
          Key: { id: gameId },
        }));
        const game = gameResult.Item as any;
        if (!game) {
          socket.emit('chat-error', { message: 'Juego no encontrado' });
          return;
        }
        if (!game.players.includes(socket.data.user.sub)) {
          socket.emit('chat-error', { message: 'No eres participante de este juego' });
          return;
        }
        if (!isChatAvailable(game)) {
          socket.emit('chat-error', { message: 'El chat ya no está disponible' });
          return;
        }

        socket.join(`game:${gameId}`);

        const messagesResult = await db.send(new QueryCommand({
          TableName: MESSAGES_TABLE,
          KeyConditionExpression: 'gameId = :gameId',
          ExpressionAttributeValues: { ':gameId': gameId },
          ScanIndexForward: true,
          Limit: 50,
        }));

        socket.emit('chat-history', {
          gameId,
          messages: messagesResult.Items || [],
        });
      } catch (err) {
        socket.emit('chat-error', { message: 'Error al unirse al chat' });
      }
    });

    socket.on('leave-chat', ({ gameId }: { gameId: string }) => {
      socket.leave(`game:${gameId}`);
    });

    socket.on('send-message', async ({ gameId, content }: { gameId: string; content: string }) => {
      if (!content || !content.trim()) return;

      try {
        const gameResult = await db.send(new GetCommand({
          TableName: TABLE_NAME,
          Key: { id: gameId },
        }));
        const game = gameResult.Item as any;
        if (!game || !game.players.includes(socket.data.user.sub) || !isChatAvailable(game)) {
          socket.emit('chat-error', { message: 'No puedes enviar mensajes en este chat' });
          return;
        }

        const user = socket.data.user;
        const message = {
          gameId,
          createdAt: new Date().toISOString(),
          id: uuid(),
          senderId: user.sub,
          senderName: `${user.given_name} ${user.family_name}`,
          content: content.trim(),
        };

        await db.send(new PutCommand({
          TableName: MESSAGES_TABLE,
          Item: message,
        }));

        io.to(`game:${gameId}`).emit('new-message', message);
      } catch (err) {
        socket.emit('chat-error', { message: 'Error al enviar mensaje' });
      }
    });
  });

  return io;
}
