import { Router, Request, Response } from 'express';
import { GetCommand, ScanCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, COMPLEXES_TABLE, PLAYFIELDS_TABLE, OWNERS_TABLE, COMPLEX_OWNERS_TABLE } from '../db';
import { requireAdmin } from '../middleware';
import { getComplexOwnerUserIds, createNotification } from '../helpers';

const router = Router();

// List pending complexes (admin only)
router.get('/complexes', requireAdmin, async (_req: Request, res: Response) => {
  const result = await db.send(new QueryCommand({
    TableName: COMPLEXES_TABLE,
    IndexName: 'ByStatus',
    KeyConditionExpression: 'verificationStatus = :status',
    ExpressionAttributeValues: { ':status': 'pending' },
  }));

  const complexes = [];
  for (const cx of result.Items || []) {
    const cxId = (cx as any).id;

    const linksResult = await db.send(new ScanCommand({
      TableName: COMPLEX_OWNERS_TABLE,
      FilterExpression: 'complexId = :cxId',
      ExpressionAttributeValues: { ':cxId': cxId },
    }));
    const owners = [];
    for (const link of linksResult.Items || []) {
      const ownerResult = await db.send(new GetCommand({
        TableName: OWNERS_TABLE,
        Key: { id: (link as any).ownerId },
      }));
      if (ownerResult.Item) owners.push({ ...ownerResult.Item, role: (link as any).role });
    }

    const pfResult = await db.send(new QueryCommand({
      TableName: PLAYFIELDS_TABLE,
      IndexName: 'ByComplex',
      KeyConditionExpression: 'complexId = :complexId',
      ExpressionAttributeValues: { ':complexId': cxId },
    }));

    complexes.push({ ...cx, owners, playfields: pfResult.Items || [] });
  }

  res.json(complexes);
});

// Approve a complex (admin only)
router.post('/complexes/:id/approve', requireAdmin, async (req: Request, res: Response) => {
  const result = await db.send(new GetCommand({
    TableName: COMPLEXES_TABLE,
    Key: { id: req.params.id },
  }));

  if (!result.Item) {
    res.status(404).json({ error: 'Complejo no encontrado' });
    return;
  }

  await db.send(new UpdateCommand({
    TableName: COMPLEXES_TABLE,
    Key: { id: req.params.id },
    UpdateExpression: 'SET verificationStatus = :status, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':status': 'approved',
      ':updatedAt': new Date().toISOString(),
    },
  }));

  const complex = result.Item as any;
  const ownerUserIds = await getComplexOwnerUserIds(req.params.id as string);
  for (const ownerUserId of ownerUserIds) {
    await createNotification(
      ownerUserId,
      'complex_approved',
      'Complejo aprobado',
      `Tu complejo "${complex.name}" fue aprobado y ya aparece en el mapa.`,
      { complexId: complex.id },
    );
  }

  res.json({ message: 'Complejo aprobado' });
});

// Reject a complex (admin only)
router.post('/complexes/:id/reject', requireAdmin, async (req: Request, res: Response) => {
  const { reason } = req.body;

  const result = await db.send(new GetCommand({
    TableName: COMPLEXES_TABLE,
    Key: { id: req.params.id },
  }));

  if (!result.Item) {
    res.status(404).json({ error: 'Complejo no encontrado' });
    return;
  }

  await db.send(new UpdateCommand({
    TableName: COMPLEXES_TABLE,
    Key: { id: req.params.id },
    UpdateExpression: 'SET verificationStatus = :status, rejectionReason = :reason, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':status': 'rejected',
      ':reason': reason || '',
      ':updatedAt': new Date().toISOString(),
    },
  }));

  const complex = result.Item as any;
  const ownerUserIds = await getComplexOwnerUserIds(req.params.id as string);
  for (const ownerUserId of ownerUserIds) {
    await createNotification(
      ownerUserId,
      'complex_rejected',
      'Complejo rechazado',
      `Tu complejo "${complex.name}" fue rechazado.${reason ? ` Motivo: ${reason}` : ''}`,
      { complexId: complex.id },
    );
  }

  res.json({ message: 'Complejo rechazado' });
});

export default router;
