import { Router, Request, Response } from 'express';
import { PutCommand, GetCommand, ScanCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { db, TABLE_NAME, PLAYFIELDS_TABLE, COMPLEXES_TABLE } from '../db';
import { requireAuth } from '../middleware';
import { getComplexOwnerUserIds, createNotification } from '../helpers';

const router = Router();

// Create a game (auth required)
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { sport, title, latitude, longitude, date, time, endTime, maxPlayers, description, playfieldId } = req.body;

  let gameLat = latitude;
  let gameLng = longitude;
  let gameStatus = 'open';
  let playfieldName: string | undefined;
  let complexId: string | undefined;
  let complexName: string | undefined;

  if (playfieldId) {
    const pfResult = await db.send(new GetCommand({
      TableName: PLAYFIELDS_TABLE,
      Key: { id: playfieldId },
    }));
    const playfield = pfResult.Item as any;
    if (!playfield) {
      res.status(400).json({ error: 'Cancha no encontrada' });
      return;
    }

    const cxResult = await db.send(new GetCommand({
      TableName: COMPLEXES_TABLE,
      Key: { id: playfield.complexId },
    }));
    const complex = cxResult.Item as any;
    if (!complex || complex.verificationStatus !== 'approved') {
      res.status(400).json({ error: 'Complejo no encontrado o no aprobado' });
      return;
    }

    gameLat = complex.latitude;
    gameLng = complex.longitude;
    playfieldName = playfield.name;
    complexId = complex.id;
    complexName = complex.name;

    if (complex.type === 'private') {
      gameStatus = 'pending_approval';
    }
  }

  if (!sport || !title || !gameLat || !gameLng || !date || !time || !endTime || !maxPlayers) {
    res.status(400).json({ error: 'Faltan campos requeridos: sport, title, latitude, longitude, date, time, endTime, maxPlayers' });
    return;
  }

  const gameStart = new Date(`${date}T${time}`);
  if (gameStart < new Date()) {
    res.status(400).json({ error: 'No se puede crear un juego en el pasado' });
    return;
  }

  if (endTime <= time) {
    res.status(400).json({ error: 'La hora de fin debe ser después de la hora de inicio' });
    return;
  }

  if (playfieldId) {
    const existingGames = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'ByPlayfield',
      KeyConditionExpression: 'playfieldId = :playfieldId AND #d = :date',
      ExpressionAttributeNames: { '#d': 'date' },
      ExpressionAttributeValues: { ':playfieldId': playfieldId, ':date': date },
    }));

    const overlap = (existingGames.Items || []).some((g: any) => {
      if (g.status === 'cancelled') return false;
      const existingStart = g.time;
      const existingEnd = g.endTime || '23:59';
      return time < existingEnd && endTime > existingStart;
    });

    if (overlap) {
      res.status(400).json({ error: 'Ya hay un juego programado en esta cancha durante ese horario' });
      return;
    }
  }

  const game: any = {
    id: uuid(),
    sport,
    title,
    latitude: Number(gameLat),
    longitude: Number(gameLng),
    date,
    time,
    endTime,
    maxPlayers: Number(maxPlayers),
    description: description || '',
    creatorId: user.sub,
    creatorName: `${user.given_name} ${user.family_name}`,
    creatorEmail: user.email,
    players: [user.sub],
    playerNames: { [user.sub]: `${user.given_name} ${user.family_name}` },
    createdAt: new Date().toISOString(),
    status: gameStatus,
  };

  if (playfieldId) {
    game.playfieldId = playfieldId;
    game.playfieldName = playfieldName;
    game.complexId = complexId;
    game.complexName = complexName;
  }

  await db.send(new PutCommand({ TableName: TABLE_NAME, Item: game }));

  if (gameStatus === 'pending_approval' && complexId) {
    const ownerUserIds = await getComplexOwnerUserIds(complexId);
    for (const ownerUserId of ownerUserIds) {
      await createNotification(
        ownerUserId,
        'game_request',
        'Nueva solicitud de juego',
        `${game.creatorName} quiere jugar "${game.title}" en ${playfieldName} el ${date} de ${time} a ${endTime}`,
        { gameId: game.id, playfieldId: playfieldId!, complexId: complexId! },
      );
    }
  }

  res.status(201).json(game);
});

// List all games (public)
router.get('/', async (_req: Request, res: Response) => {
  const result = await db.send(new ScanCommand({ TableName: TABLE_NAME }));
  const games = (result.Items || []).filter((g: any) => g.status !== 'cancelled');
  res.json(games);
});

// Get a single game (public)
router.get('/:id', async (req: Request, res: Response) => {
  const result = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.id },
  }));

  if (!result.Item) {
    res.status(404).json({ error: 'Juego no encontrado' });
    return;
  }
  res.json(result.Item);
});

// Join a game (auth required)
router.post('/:id/join', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const gameResult = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.id },
  }));

  const game = gameResult.Item as any;
  if (!game) {
    res.status(404).json({ error: 'Juego no encontrado' });
    return;
  }
  if (game.players.includes(user.sub)) {
    res.status(400).json({ error: 'Ya estás en este juego' });
    return;
  }
  if (game.players.length >= game.maxPlayers) {
    res.status(400).json({ error: 'El juego está lleno' });
    return;
  }

  const updatedPlayers = [...game.players, user.sub];
  const newStatus = updatedPlayers.length >= game.maxPlayers ? 'full' : 'open';
  const playerName = `${user.given_name} ${user.family_name}`;
  const updatedPlayerNames = { ...(game.playerNames || {}), [user.sub]: playerName };

  await db.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.id },
    UpdateExpression: 'SET players = :players, #s = :status, playerNames = :playerNames',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':players': updatedPlayers, ':status': newStatus, ':playerNames': updatedPlayerNames },
  }));

  // Notify creator that someone joined
  if (game.creatorId !== user.sub) {
    await createNotification(
      game.creatorId,
      'player_joined',
      'Nuevo jugador',
      `${playerName} se unio a tu juego "${game.title}"`,
      { gameId: game.id },
    );
  }

  // Notify all players if game is now full
  if (newStatus === 'full') {
    for (const playerId of updatedPlayers) {
      await createNotification(
        playerId,
        'game_full',
        'Juego lleno',
        `El juego "${game.title}" ya esta completo. ¡Nos vemos el ${game.date}!`,
        { gameId: game.id },
      );
    }
  }

  // Notify all players when almost full (1 spot left)
  const spotsLeft = game.maxPlayers - updatedPlayers.length;
  if (spotsLeft === 1) {
    for (const playerId of updatedPlayers) {
      if (playerId === user.sub) continue;
      await createNotification(
        playerId,
        'game_almost_full',
        'Casi lleno',
        `Solo queda 1 lugar en "${game.title}"`,
        { gameId: game.id },
      );
    }
  }

  res.json({ message: 'Te uniste al juego', playerCount: updatedPlayers.length, maxPlayers: game.maxPlayers });
});

// Leave a game (auth required)
router.post('/:id/leave', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const gameResult = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.id },
  }));

  const game = gameResult.Item as any;
  if (!game) {
    res.status(404).json({ error: 'Juego no encontrado' });
    return;
  }
  if (!game.players.includes(user.sub)) {
    res.status(400).json({ error: 'No estás en este juego' });
    return;
  }
  if (game.creatorId === user.sub) {
    res.status(400).json({ error: 'El creador no puede abandonar el juego, cancélalo en su lugar' });
    return;
  }

  const wasFull = game.players.length >= game.maxPlayers;
  const updatedPlayers = game.players.filter((p: string) => p !== user.sub);
  const updatedPlayerNames = { ...(game.playerNames || {}) };
  delete updatedPlayerNames[user.sub];

  await db.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.id },
    UpdateExpression: 'SET players = :players, #s = :status, playerNames = :playerNames',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':players': updatedPlayers, ':status': 'open', ':playerNames': updatedPlayerNames },
  }));

  const playerName = `${user.given_name} ${user.family_name}`;

  // Notify creator that someone left
  await createNotification(
    game.creatorId,
    'player_left',
    'Jugador salio',
    `${playerName} salio de tu juego "${game.title}". ${updatedPlayers.length}/${game.maxPlayers} jugadores.`,
    { gameId: game.id },
  );

  // If game was full and now has a spot, notify remaining players
  if (wasFull) {
    for (const playerId of updatedPlayers) {
      await createNotification(
        playerId,
        'spot_opened',
        'Lugar disponible',
        `Se abrio un lugar en "${game.title}". Invita a alguien!`,
        { gameId: game.id },
      );
    }
  }

  res.json({ message: 'Saliste del juego' });
});

// Kick a player from a game (creator only)
router.post('/:id/kick', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { playerId } = req.body;

  if (!playerId) {
    res.status(400).json({ error: 'Falta el ID del jugador' });
    return;
  }

  const gameResult = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.id },
  }));

  const game = gameResult.Item as any;
  if (!game) {
    res.status(404).json({ error: 'Juego no encontrado' });
    return;
  }
  if (game.creatorId !== user.sub) {
    res.status(403).json({ error: 'Solo el creador puede expulsar jugadores' });
    return;
  }
  if (playerId === user.sub) {
    res.status(400).json({ error: 'No puedes expulsarte a ti mismo' });
    return;
  }
  if (!game.players.includes(playerId)) {
    res.status(400).json({ error: 'El jugador no está en este juego' });
    return;
  }

  const updatedPlayers = game.players.filter((p: string) => p !== playerId);
  const updatedPlayerNames = { ...(game.playerNames || {}) };
  const kickedName = updatedPlayerNames[playerId] || 'Jugador';
  delete updatedPlayerNames[playerId];

  await db.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.id },
    UpdateExpression: 'SET players = :players, #s = :status, playerNames = :playerNames',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':players': updatedPlayers, ':status': 'open', ':playerNames': updatedPlayerNames },
  }));

  await createNotification(
    playerId,
    'kicked_from_game',
    'Expulsado del juego',
    `Fuiste expulsado del juego "${game.title}" por el organizador.`,
    { gameId: game.id },
  );

  res.json({ message: `${kickedName} fue expulsado del juego` });
});

// Cancel a game (auth required, creator only)
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const gameResult = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.id },
  }));

  const game = gameResult.Item as any;
  if (!game) {
    res.status(404).json({ error: 'Juego no encontrado' });
    return;
  }
  if (game.creatorId !== user.sub) {
    res.status(403).json({ error: 'Solo el creador puede cancelar el juego' });
    return;
  }

  await db.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.id },
    UpdateExpression: 'SET #s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':status': 'cancelled' },
  }));

  // Notify all other players that the game was cancelled
  for (const playerId of game.players) {
    if (playerId === user.sub) continue;
    await createNotification(
      playerId,
      'game_cancelled',
      'Juego cancelado',
      `El juego "${game.title}" del ${game.date} fue cancelado por el organizador.`,
      { gameId: game.id },
    );
  }

  res.json({ message: 'Juego cancelado' });
});

export default router;
