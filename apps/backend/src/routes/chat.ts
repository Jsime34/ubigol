import { Router, Request, Response } from 'express';
import { GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { requireAuth } from '../middleware';
import { db, TABLE_NAME, MESSAGES_TABLE } from '../db';
import { isChatAvailable } from '../helpers';

const router = Router();

router.get('/active', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;

  const gamesResult = await db.send(new ScanCommand({ TableName: TABLE_NAME }));
  const allGames = (gamesResult.Items || []) as any[];

  const activeChats = [];
  for (const game of allGames) {
    if (!game.players.includes(user.sub)) continue;
    if (!isChatAvailable(game)) continue;

    let lastMessage = null;
    try {
      const msgResult = await db.send(new QueryCommand({
        TableName: MESSAGES_TABLE,
        KeyConditionExpression: 'gameId = :gameId',
        ExpressionAttributeValues: { ':gameId': game.id },
        ScanIndexForward: false,
        Limit: 1,
      }));
      if (msgResult.Items && msgResult.Items.length > 0) {
        const msg = msgResult.Items[0] as any;
        lastMessage = { content: msg.content, senderName: msg.senderName, createdAt: msg.createdAt };
      }
    } catch {}

    activeChats.push({
      id: game.id,
      title: game.title,
      sport: game.sport,
      date: game.date,
      time: game.time,
      endTime: game.endTime,
      playerCount: game.players.length,
      lastMessage,
    });
  }

  activeChats.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt || '';
    const bTime = b.lastMessage?.createdAt || '';
    return bTime.localeCompare(aTime);
  });

  res.json(activeChats);
});

router.get('/:gameId/messages', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { gameId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = req.query.before as string | undefined;

  const gameGet = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: gameId },
  }));
  const game = gameGet.Item as any;

  if (!game) {
    res.status(404).json({ error: 'Juego no encontrado' });
    return;
  }
  if (!game.players.includes(user.sub)) {
    res.status(403).json({ error: 'No eres participante de este juego' });
    return;
  }
  if (!isChatAvailable(game)) {
    res.status(403).json({ error: 'El chat ya no está disponible' });
    return;
  }

  const queryParams: any = {
    TableName: MESSAGES_TABLE,
    KeyConditionExpression: before
      ? 'gameId = :gameId AND createdAt < :before'
      : 'gameId = :gameId',
    ExpressionAttributeValues: before
      ? { ':gameId': gameId, ':before': before }
      : { ':gameId': gameId },
    ScanIndexForward: false,
    Limit: limit,
  };

  const result = await db.send(new QueryCommand(queryParams));
  const messages = (result.Items || []).reverse();

  res.json(messages);
});

export default router;
