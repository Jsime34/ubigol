import { Router, Request, Response } from 'express';
import { PutCommand, GetCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE_NAME, ATTENDANCE_TABLE } from '../db';
import { requireAuth } from '../middleware';

const router = Router();

// Submit attendance + ratings for a finished game
router.post('/:gameId', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { gameId } = req.params;
  const { ratings } = req.body;
  // ratings: Array<{ subjectId: string, attended: boolean, rating?: number }>

  if (!Array.isArray(ratings) || ratings.length === 0) {
    res.status(400).json({ error: 'Se requiere al menos una calificacion' });
    return;
  }

  const gameResult = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: gameId },
  }));
  const game = gameResult.Item as any;
  if (!game) {
    res.status(404).json({ error: 'Juego no encontrado' });
    return;
  }

  if (!game.players.includes(user.sub)) {
    res.status(403).json({ error: 'No participaste en este juego' });
    return;
  }

  // Game must have ended
  const gameEnd = new Date(`${game.date}T${game.endTime}`);
  if (new Date() < gameEnd) {
    res.status(400).json({ error: 'El juego aun no termino' });
    return;
  }

  const now = new Date().toISOString();

  for (const r of ratings) {
    if (r.subjectId === user.sub) continue; // can't rate yourself

    const reviewerSubjectKey = `${user.sub}#${r.subjectId}`;

    await db.send(new PutCommand({
      TableName: ATTENDANCE_TABLE,
      Item: {
        gameId,
        reviewerSubjectKey,
        reviewerId: user.sub,
        subjectId: r.subjectId,
        attended: r.attended,
        rating: r.attended ? (r.rating || null) : null,
        createdAt: now,
      },
    }));
  }

  res.json({ message: 'Calificaciones enviadas' });
});

// Get games pending review for current user
router.get('/pending', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;

  // Get all non-cancelled games
  const gamesResult = await db.send(new ScanCommand({ TableName: TABLE_NAME }));
  const allGames = (gamesResult.Items || []) as any[];

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const pendingGames = [];

  for (const game of allGames) {
    if (game.status === 'cancelled') continue;
    if (!game.players.includes(user.sub)) continue;
    if (game.players.length < 2) continue;

    const gameEnd = new Date(`${game.date}T${game.endTime}`);
    if (gameEnd > now) continue; // not finished yet
    if (gameEnd < threeDaysAgo) continue; // too old

    // Check if user already submitted reviews for this game
    const existing = await db.send(new QueryCommand({
      TableName: ATTENDANCE_TABLE,
      KeyConditionExpression: 'gameId = :gameId AND begins_with(reviewerSubjectKey, :prefix)',
      ExpressionAttributeValues: {
        ':gameId': game.id,
        ':prefix': `${user.sub}#`,
      },
    }));

    if ((existing.Items || []).length === 0) {
      pendingGames.push(game);
    }
  }

  res.json(pendingGames);
});

// Get player reliability stats
router.get('/players/:sub/reliability', async (req: Request, res: Response) => {
  const { sub } = req.params;

  const result = await db.send(new QueryCommand({
    TableName: ATTENDANCE_TABLE,
    IndexName: 'BySubject',
    KeyConditionExpression: 'subjectId = :subjectId',
    ExpressionAttributeValues: { ':subjectId': sub },
  }));

  const reviews = (result.Items || []) as any[];
  if (reviews.length === 0) {
    res.json({ totalReviews: 0, attendanceRate: null, avgRating: null });
    return;
  }

  const attendedCount = reviews.filter((r) => r.attended).length;
  const attendanceRate = Math.round((attendedCount / reviews.length) * 100);

  const rated = reviews.filter((r) => r.attended && r.rating != null);
  const avgRating = rated.length > 0
    ? Math.round((rated.reduce((sum: number, r: any) => sum + r.rating, 0) / rated.length) * 10) / 10
    : null;

  res.json({
    totalReviews: reviews.length,
    attendanceRate,
    avgRating,
  });
});

export default router;
