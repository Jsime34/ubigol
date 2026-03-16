import { Router, Request, Response } from 'express';
import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { db, TABLE_NAME, COMPLEXES_TABLE, PLAYFIELDS_TABLE, OWNERS_TABLE, COMPLEX_OWNERS_TABLE } from '../db';
import { requireAuth } from '../middleware';
import { isComplexOwner, createNotification } from '../helpers';

const router = Router();

// Submit a new complex (auth required)
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { name, address, latitude, longitude, type, amenities, description, ownerPhone, countryCode, playfields } = req.body;

  if (!name || !address || !latitude || !longitude || !type || !ownerPhone) {
    res.status(400).json({ error: 'Faltan campos requeridos: name, address, latitude, longitude, type, ownerPhone' });
    return;
  }

  if (type !== 'public' && type !== 'private') {
    res.status(400).json({ error: 'El tipo debe ser "public" o "private"' });
    return;
  }

  if (!playfields || !playfields.length) {
    res.status(400).json({ error: 'El complejo debe tener al menos una cancha' });
    return;
  }

  const now = new Date().toISOString();
  const complexId = uuid();

  const complex = {
    id: complexId,
    name,
    address,
    latitude: Number(latitude),
    longitude: Number(longitude),
    type,
    verificationStatus: 'pending',
    amenities: amenities || [],
    description: description || '',
    countryCode: countryCode || null,
    createdAt: now,
    updatedAt: now,
  };
  await db.send(new PutCommand({ TableName: COMPLEXES_TABLE, Item: complex }));

  const existingOwner = await db.send(new QueryCommand({
    TableName: OWNERS_TABLE,
    IndexName: 'ByUserId',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': user.sub },
  }));

  let ownerId: string;
  if (existingOwner.Items && existingOwner.Items.length > 0) {
    ownerId = (existingOwner.Items[0] as any).id;
  } else {
    ownerId = uuid();
    await db.send(new PutCommand({
      TableName: OWNERS_TABLE,
      Item: {
        id: ownerId,
        userId: user.sub,
        name: `${user.given_name} ${user.family_name}`,
        email: user.email,
        phone: ownerPhone,
        createdAt: now,
      },
    }));
  }

  await db.send(new PutCommand({
    TableName: COMPLEX_OWNERS_TABLE,
    Item: {
      complexId,
      ownerId,
      role: 'owner',
      createdAt: now,
    },
  }));

  const createdPlayfields = [];
  for (const pf of playfields) {
    const sports = pf.sports || (pf.sport ? [pf.sport] : ['other']);
    const playfieldItem = {
      id: uuid(),
      complexId,
      name: pf.name,
      sports,
      pricePerHour: pf.pricePerHour || null,
      createdAt: now,
      updatedAt: now,
    };
    await db.send(new PutCommand({ TableName: PLAYFIELDS_TABLE, Item: playfieldItem }));
    createdPlayfields.push(playfieldItem);
  }

  res.status(201).json({ ...complex, playfields: createdPlayfields });
});

// List approved complexes with playfields (public)
router.get('/', async (_req: Request, res: Response) => {
  const result = await db.send(new QueryCommand({
    TableName: COMPLEXES_TABLE,
    IndexName: 'ByStatus',
    KeyConditionExpression: 'verificationStatus = :status',
    ExpressionAttributeValues: { ':status': 'approved' },
  }));

  const complexes = [];
  for (const cx of result.Items || []) {
    const pfResult = await db.send(new QueryCommand({
      TableName: PLAYFIELDS_TABLE,
      IndexName: 'ByComplex',
      KeyConditionExpression: 'complexId = :complexId',
      ExpressionAttributeValues: { ':complexId': (cx as any).id },
    }));
    complexes.push({ ...cx, playfields: pfResult.Items || [] });
  }

  res.json(complexes);
});

// List complexes owned by the current user (auth required)
// MUST be before /:id to avoid matching "mine" as an id
router.get('/mine', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;

  const ownerResult = await db.send(new QueryCommand({
    TableName: OWNERS_TABLE,
    IndexName: 'ByUserId',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': user.sub },
  }));
  const owner = ownerResult.Items?.[0] as any;
  if (!owner) {
    res.json([]);
    return;
  }

  const linksResult = await db.send(new QueryCommand({
    TableName: COMPLEX_OWNERS_TABLE,
    IndexName: 'ByOwner',
    KeyConditionExpression: 'ownerId = :ownerId',
    ExpressionAttributeValues: { ':ownerId': owner.id },
  }));

  const complexes = [];
  for (const link of linksResult.Items || []) {
    const cx = await db.send(new GetCommand({
      TableName: COMPLEXES_TABLE,
      Key: { id: (link as any).complexId },
    }));
    if (cx.Item) {
      const pfResult = await db.send(new QueryCommand({
        TableName: PLAYFIELDS_TABLE,
        IndexName: 'ByComplex',
        KeyConditionExpression: 'complexId = :complexId',
        ExpressionAttributeValues: { ':complexId': (cx.Item as any).id },
      }));
      complexes.push({ ...cx.Item, playfields: pfResult.Items || [], role: (link as any).role });
    }
  }

  res.json(complexes);
});

// Playfield routes (before /:id to avoid matching "playfields" as an id)
// Get games for a specific playfield (public)
router.get('/playfields/:id/games', async (req: Request, res: Response) => {
  const result = await db.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'ByPlayfield',
    KeyConditionExpression: 'playfieldId = :playfieldId',
    ExpressionAttributeValues: { ':playfieldId': req.params.id },
  }));
  const games = (result.Items || []).filter((g: any) => g.status !== 'cancelled');
  res.json(games);
});

// List pending games at a playfield owned by current user (auth required)
router.get('/playfields/:id/pending-games', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const playfieldId = req.params.id;

  const pfResult = await db.send(new GetCommand({
    TableName: PLAYFIELDS_TABLE,
    Key: { id: playfieldId },
  }));
  const playfield = pfResult.Item as any;
  if (!playfield) {
    res.status(404).json({ error: 'Cancha no encontrada' });
    return;
  }

  if (!(await isComplexOwner(user.sub, playfield.complexId))) {
    res.status(403).json({ error: 'No eres dueño de este complejo' });
    return;
  }

  const gamesResult = await db.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'ByPlayfield',
    KeyConditionExpression: 'playfieldId = :playfieldId',
    ExpressionAttributeValues: { ':playfieldId': playfieldId },
  }));

  const pendingGames = (gamesResult.Items || []).filter((g: any) => g.status === 'pending_approval');
  res.json(pendingGames);
});

// Approve a pending game at a playfield (auth required, owner only)
router.post('/playfields/:id/games/:gameId/approve', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const playfieldId = req.params.id;

  const pfResult = await db.send(new GetCommand({
    TableName: PLAYFIELDS_TABLE,
    Key: { id: playfieldId },
  }));
  const playfield = pfResult.Item as any;
  if (!playfield) {
    res.status(404).json({ error: 'Cancha no encontrada' });
    return;
  }

  if (!(await isComplexOwner(user.sub, playfield.complexId))) {
    res.status(403).json({ error: 'No eres dueño de este complejo' });
    return;
  }

  const gameResult = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.gameId },
  }));
  const game = gameResult.Item as any;
  if (!game || game.playfieldId !== playfieldId) {
    res.status(404).json({ error: 'Juego no encontrado en esta cancha' });
    return;
  }
  if (game.status !== 'pending_approval') {
    res.status(400).json({ error: 'Este juego no está pendiente de aprobación' });
    return;
  }

  await db.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.gameId },
    UpdateExpression: 'SET #s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':status': 'open' },
  }));

  await createNotification(
    game.creatorId,
    'game_approved',
    'Juego aprobado',
    `Tu juego "${game.title}" en ${game.playfieldName || 'la cancha'} fue aprobado`,
    { gameId: game.id },
  );

  res.json({ message: 'Juego aprobado' });
});

// Reject a pending game at a playfield (auth required, owner only)
router.post('/playfields/:id/games/:gameId/reject', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const playfieldId = req.params.id;

  const pfResult = await db.send(new GetCommand({
    TableName: PLAYFIELDS_TABLE,
    Key: { id: playfieldId },
  }));
  const playfield = pfResult.Item as any;
  if (!playfield) {
    res.status(404).json({ error: 'Cancha no encontrada' });
    return;
  }

  if (!(await isComplexOwner(user.sub, playfield.complexId))) {
    res.status(403).json({ error: 'No eres dueño de este complejo' });
    return;
  }

  const gameResult = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.gameId },
  }));
  const game = gameResult.Item as any;
  if (!game || game.playfieldId !== playfieldId) {
    res.status(404).json({ error: 'Juego no encontrado en esta cancha' });
    return;
  }
  if (game.status !== 'pending_approval') {
    res.status(400).json({ error: 'Este juego no está pendiente de aprobación' });
    return;
  }

  await db.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: req.params.gameId },
    UpdateExpression: 'SET #s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':status': 'rejected' },
  }));

  await createNotification(
    game.creatorId,
    'game_rejected',
    'Juego rechazado',
    `Tu juego "${game.title}" en ${game.playfieldName || 'la cancha'} fue rechazado por el dueño`,
    { gameId: game.id },
  );

  res.json({ message: 'Juego rechazado' });
});

// Get a single complex with its playfields (public)
router.get('/:id', async (req: Request, res: Response) => {
  const result = await db.send(new GetCommand({
    TableName: COMPLEXES_TABLE,
    Key: { id: req.params.id },
  }));

  if (!result.Item) {
    res.status(404).json({ error: 'Complejo no encontrado' });
    return;
  }

  const pfResult = await db.send(new QueryCommand({
    TableName: PLAYFIELDS_TABLE,
    IndexName: 'ByComplex',
    KeyConditionExpression: 'complexId = :complexId',
    ExpressionAttributeValues: { ':complexId': req.params.id },
  }));

  res.json({ ...result.Item, playfields: pfResult.Items || [] });
});

// Add a playfield to a complex (auth required, owner only)
router.post('/:id/playfields', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const complexId = req.params.id as string;

  if (!(await isComplexOwner(user.sub as string, complexId))) {
    res.status(403).json({ error: 'Solo un dueno puede agregar canchas' });
    return;
  }

  const { name, sports, sport, pricePerHour } = req.body;
  const resolvedSports = sports || (sport ? [sport] : null);
  if (!name || !resolvedSports || resolvedSports.length === 0) {
    res.status(400).json({ error: 'Faltan campos requeridos: name, sports' });
    return;
  }

  const now = new Date().toISOString();
  const playfield = {
    id: uuid(),
    complexId,
    name,
    sports: resolvedSports,
    pricePerHour: pricePerHour || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.send(new PutCommand({ TableName: PLAYFIELDS_TABLE, Item: playfield }));
  res.status(201).json(playfield);
});

// Get playfields for a complex (public)
router.get('/:id/playfields', async (req: Request, res: Response) => {
  const result = await db.send(new QueryCommand({
    TableName: PLAYFIELDS_TABLE,
    IndexName: 'ByComplex',
    KeyConditionExpression: 'complexId = :complexId',
    ExpressionAttributeValues: { ':complexId': req.params.id },
  }));
  res.json(result.Items || []);
});

// Update complex info (auth required, owner only)
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const complexId = req.params.id as string;

  if (!(await isComplexOwner(user.sub as string, complexId))) {
    res.status(403).json({ error: 'Solo un dueño puede editar este complejo' });
    return;
  }

  const { name, address, description, amenities } = req.body;
  const now = new Date().toISOString();

  const updates: string[] = ['#updatedAt = :updatedAt'];
  const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
  const values: Record<string, any> = { ':updatedAt': now };

  if (name !== undefined) { updates.push('#name = :name'); names['#name'] = 'name'; values[':name'] = name; }
  if (address !== undefined) { updates.push('#address = :address'); names['#address'] = 'address'; values[':address'] = address; }
  if (description !== undefined) { updates.push('#description = :description'); names['#description'] = 'description'; values[':description'] = description; }
  if (amenities !== undefined) { updates.push('#amenities = :amenities'); names['#amenities'] = 'amenities'; values[':amenities'] = amenities; }

  await db.send(new UpdateCommand({
    TableName: COMPLEXES_TABLE,
    Key: { id: complexId },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));

  const result = await db.send(new GetCommand({ TableName: COMPLEXES_TABLE, Key: { id: complexId } }));
  res.json(result.Item);
});

// Update a playfield (auth required, owner only)
router.put('/:id/playfields/:pfId', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const complexId = req.params.id as string;

  if (!(await isComplexOwner(user.sub as string, complexId))) {
    res.status(403).json({ error: 'Solo un dueño puede editar canchas' });
    return;
  }

  const pfResult = await db.send(new GetCommand({ TableName: PLAYFIELDS_TABLE, Key: { id: req.params.pfId } }));
  if (!pfResult.Item || (pfResult.Item as any).complexId !== complexId) {
    res.status(404).json({ error: 'Cancha no encontrada en este complejo' });
    return;
  }

  const { name, sports, pricePerHour } = req.body;
  const now = new Date().toISOString();

  const updates: string[] = ['#updatedAt = :updatedAt'];
  const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
  const values: Record<string, any> = { ':updatedAt': now };

  if (name !== undefined) { updates.push('#name = :name'); names['#name'] = 'name'; values[':name'] = name; }
  if (sports !== undefined) { updates.push('#sports = :sports'); names['#sports'] = 'sports'; values[':sports'] = sports; }
  if (pricePerHour !== undefined) { updates.push('#price = :price'); names['#price'] = 'pricePerHour'; values[':price'] = pricePerHour; }

  await db.send(new UpdateCommand({
    TableName: PLAYFIELDS_TABLE,
    Key: { id: req.params.pfId },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));

  const updated = await db.send(new GetCommand({ TableName: PLAYFIELDS_TABLE, Key: { id: req.params.pfId } }));
  res.json(updated.Item);
});

// Delete a playfield (auth required, owner only)
router.delete('/:id/playfields/:pfId', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const complexId = req.params.id as string;

  if (!(await isComplexOwner(user.sub as string, complexId))) {
    res.status(403).json({ error: 'Solo un dueño puede eliminar canchas' });
    return;
  }

  const pfResult = await db.send(new GetCommand({ TableName: PLAYFIELDS_TABLE, Key: { id: req.params.pfId } }));
  if (!pfResult.Item || (pfResult.Item as any).complexId !== complexId) {
    res.status(404).json({ error: 'Cancha no encontrada en este complejo' });
    return;
  }

  await db.send(new DeleteCommand({ TableName: PLAYFIELDS_TABLE, Key: { id: req.params.pfId } }));
  res.json({ message: 'Cancha eliminada' });
});

export default router;
