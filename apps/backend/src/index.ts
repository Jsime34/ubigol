import express, { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, DeleteCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';

const app = express();
const PORT = 3000;

app.use(express.json());

// DynamoDB
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const db = DynamoDBDocumentClient.from(ddbClient);
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'InfraStack-UbigolMatchesBFA2FAAA-OWTUKQEH47I2';
const PLAYFIELDS_TABLE = process.env.DYNAMODB_PLAYFIELDS_TABLE || '';

// Cognito JWT verifier
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID || '',
  tokenUse: 'id',
  clientId: process.env.COGNITO_CLIENT_ID || '',
});

// Auth middleware
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Token requerido' });
    return;
  }
  try {
    const payload = await verifier.verify(token);
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// Admin middleware
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean);

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    const user = (req as any).user;
    if (!user || !ADMIN_EMAILS.includes(user.email)) {
      res.status(403).json({ error: 'Acceso de administrador requerido' });
      return;
    }
    next();
  });
}

// Health check
app.get('/', (_req: Request, res: Response) => {
  res.send('Ubigol Backend API - Online');
});

// Get current user
app.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({ email: user.email, name: `${user.given_name} ${user.family_name}`, isAdmin: ADMIN_EMAILS.includes(user.email) });
});

// ==================== GAME ROUTES ====================

// Create a game (auth required)
app.post('/games', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { sport, title, latitude, longitude, date, time, maxPlayers, description, playfieldId } = req.body;

  let gameLat = latitude;
  let gameLng = longitude;
  let gameStatus = 'open';
  let playfieldName: string | undefined;
  let playfieldOwnerId: string | undefined;

  if (playfieldId) {
    const pfResult = await db.send(new GetCommand({
      TableName: PLAYFIELDS_TABLE,
      Key: { id: playfieldId },
    }));
    const playfield = pfResult.Item as any;

    if (!playfield || playfield.verificationStatus !== 'approved') {
      res.status(400).json({ error: 'Cancha no encontrada o no aprobada' });
      return;
    }

    gameLat = playfield.latitude;
    gameLng = playfield.longitude;
    playfieldName = playfield.name;

    if (playfield.type === 'private') {
      gameStatus = 'pending_approval';
      playfieldOwnerId = playfield.ownerId;
    }
  }

  if (!sport || !title || !gameLat || !gameLng || !date || !time || !maxPlayers) {
    res.status(400).json({ error: 'Faltan campos requeridos: sport, title, latitude, longitude, date, time, maxPlayers' });
    return;
  }

  const game: any = {
    id: uuid(),
    sport,
    title,
    latitude: Number(gameLat),
    longitude: Number(gameLng),
    date,
    time,
    maxPlayers: Number(maxPlayers),
    description: description || '',
    creatorId: user.sub,
    creatorName: `${user.given_name} ${user.family_name}`,
    creatorEmail: user.email,
    players: [user.sub],
    createdAt: new Date().toISOString(),
    status: gameStatus,
  };

  if (playfieldId) {
    game.playfieldId = playfieldId;
    game.playfieldName = playfieldName;
  }
  if (playfieldOwnerId) {
    game.playfieldOwnerId = playfieldOwnerId;
  }

  await db.send(new PutCommand({ TableName: TABLE_NAME, Item: game }));
  res.status(201).json(game);
});

// List all games (public)
app.get('/games', async (_req: Request, res: Response) => {
  const result = await db.send(new ScanCommand({ TableName: TABLE_NAME }));
  const games = (result.Items || []).filter((g: any) => g.status !== 'cancelled');
  res.json(games);
});

// Get a single game (public)
app.get('/games/:id', async (req: Request, res: Response) => {
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
app.post('/games/:id/join', requireAuth, async (req: Request, res: Response) => {
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

  await db.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.id },
    UpdateExpression: 'SET players = :players, #s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':players': updatedPlayers, ':status': newStatus },
  }));

  res.json({ message: 'Te uniste al juego', playerCount: updatedPlayers.length, maxPlayers: game.maxPlayers });
});

// Leave a game (auth required)
app.post('/games/:id/leave', requireAuth, async (req: Request, res: Response) => {
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

  const updatedPlayers = game.players.filter((p: string) => p !== user.sub);

  await db.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.id },
    UpdateExpression: 'SET players = :players, #s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':players': updatedPlayers, ':status': 'open' },
  }));

  res.json({ message: 'Saliste del juego' });
});

// Cancel a game (auth required, creator only)
app.delete('/games/:id', requireAuth, async (req: Request, res: Response) => {
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

  res.json({ message: 'Juego cancelado' });
});

// ==================== PLAYFIELD ROUTES ====================

// Submit a new playfield (auth required)
app.post('/playfields', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { name, address, latitude, longitude, type, sports, amenities, description } = req.body;

  if (!name || !address || !latitude || !longitude || !type || !sports || !sports.length) {
    res.status(400).json({ error: 'Faltan campos requeridos: name, address, latitude, longitude, type, sports' });
    return;
  }

  if (type !== 'public' && type !== 'private') {
    res.status(400).json({ error: 'El tipo debe ser "public" o "private"' });
    return;
  }

  const playfield = {
    id: uuid(),
    name,
    address,
    latitude: Number(latitude),
    longitude: Number(longitude),
    type,
    ownerId: user.sub,
    ownerName: `${user.given_name} ${user.family_name}`,
    ownerEmail: user.email,
    verificationStatus: 'pending',
    sports,
    amenities: amenities || [],
    description: description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.send(new PutCommand({ TableName: PLAYFIELDS_TABLE, Item: playfield }));
  res.status(201).json(playfield);
});

// List approved playfields (public)
app.get('/playfields', async (_req: Request, res: Response) => {
  const result = await db.send(new QueryCommand({
    TableName: PLAYFIELDS_TABLE,
    IndexName: 'ByStatus',
    KeyConditionExpression: 'verificationStatus = :status',
    ExpressionAttributeValues: { ':status': 'approved' },
  }));
  res.json(result.Items || []);
});

// Get a single playfield (public)
app.get('/playfields/:id', async (req: Request, res: Response) => {
  const result = await db.send(new GetCommand({
    TableName: PLAYFIELDS_TABLE,
    Key: { id: req.params.id },
  }));

  if (!result.Item) {
    res.status(404).json({ error: 'Cancha no encontrada' });
    return;
  }
  res.json(result.Item);
});

// List playfields owned by the current user (auth required)
app.get('/my-playfields', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await db.send(new QueryCommand({
    TableName: PLAYFIELDS_TABLE,
    IndexName: 'ByOwner',
    KeyConditionExpression: 'ownerId = :ownerId',
    ExpressionAttributeValues: { ':ownerId': user.sub },
  }));
  res.json(result.Items || []);
});

// Update a playfield (auth required, owner only)
app.put('/playfields/:id', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await db.send(new GetCommand({
    TableName: PLAYFIELDS_TABLE,
    Key: { id: req.params.id },
  }));

  const playfield = result.Item as any;
  if (!playfield) {
    res.status(404).json({ error: 'Cancha no encontrada' });
    return;
  }
  if (playfield.ownerId !== user.sub) {
    res.status(403).json({ error: 'Solo el dueño puede editar esta cancha' });
    return;
  }

  const { name, address, type, sports, amenities, description } = req.body;

  await db.send(new UpdateCommand({
    TableName: PLAYFIELDS_TABLE,
    Key: { id: req.params.id },
    UpdateExpression: 'SET #n = :name, address = :address, #t = :type, sports = :sports, amenities = :amenities, description = :description, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#n': 'name', '#t': 'type' },
    ExpressionAttributeValues: {
      ':name': name || playfield.name,
      ':address': address || playfield.address,
      ':type': type || playfield.type,
      ':sports': sports || playfield.sports,
      ':amenities': amenities || playfield.amenities,
      ':description': description !== undefined ? description : playfield.description,
      ':updatedAt': new Date().toISOString(),
    },
  }));

  res.json({ message: 'Cancha actualizada' });
});

// ==================== ADMIN ROUTES ====================

// List pending playfields (admin only)
app.get('/admin/playfields', requireAdmin, async (_req: Request, res: Response) => {
  const result = await db.send(new QueryCommand({
    TableName: PLAYFIELDS_TABLE,
    IndexName: 'ByStatus',
    KeyConditionExpression: 'verificationStatus = :status',
    ExpressionAttributeValues: { ':status': 'pending' },
  }));
  res.json(result.Items || []);
});

// Approve a playfield (admin only)
app.post('/admin/playfields/:id/approve', requireAdmin, async (req: Request, res: Response) => {
  const result = await db.send(new GetCommand({
    TableName: PLAYFIELDS_TABLE,
    Key: { id: req.params.id },
  }));

  if (!result.Item) {
    res.status(404).json({ error: 'Cancha no encontrada' });
    return;
  }

  await db.send(new UpdateCommand({
    TableName: PLAYFIELDS_TABLE,
    Key: { id: req.params.id },
    UpdateExpression: 'SET verificationStatus = :status, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':status': 'approved',
      ':updatedAt': new Date().toISOString(),
    },
  }));

  res.json({ message: 'Cancha aprobada' });
});

// Reject a playfield (admin only)
app.post('/admin/playfields/:id/reject', requireAdmin, async (req: Request, res: Response) => {
  const { reason } = req.body;

  const result = await db.send(new GetCommand({
    TableName: PLAYFIELDS_TABLE,
    Key: { id: req.params.id },
  }));

  if (!result.Item) {
    res.status(404).json({ error: 'Cancha no encontrada' });
    return;
  }

  await db.send(new UpdateCommand({
    TableName: PLAYFIELDS_TABLE,
    Key: { id: req.params.id },
    UpdateExpression: 'SET verificationStatus = :status, rejectionReason = :reason, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':status': 'rejected',
      ':reason': reason || '',
      ':updatedAt': new Date().toISOString(),
    },
  }));

  res.json({ message: 'Cancha rechazada' });
});

app.listen(PORT, () => {
  console.log(`Servidor de Ubigol corriendo en http://localhost:${PORT}`);
});
