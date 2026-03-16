import { Router, Request, Response } from 'express';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, NOTIFICATIONS_TABLE } from '../db';
import { requireAuth } from '../middleware';

const router = Router();

// Get notifications for current user (auth required)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await db.send(new QueryCommand({
    TableName: NOTIFICATIONS_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': user.sub as string },
    ScanIndexForward: false,
    Limit: 30,
  }));
  res.json(result.Items || []);
});

// Mark all notifications as read (auth required)
// MUST be before /:id/read to avoid matching "read-all" as an id
router.post('/read-all', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await db.send(new QueryCommand({
    TableName: NOTIFICATIONS_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': user.sub as string },
  }));

  for (const item of (result.Items || []).filter((n: any) => !n.read)) {
    await db.send(new UpdateCommand({
      TableName: NOTIFICATIONS_TABLE,
      Key: { userId: user.sub as string, createdAt: (item as any).createdAt },
      UpdateExpression: 'SET #r = :read',
      ExpressionAttributeNames: { '#r': 'read' },
      ExpressionAttributeValues: { ':read': true },
    }));
  }
  res.json({ message: 'Todas las notificaciones marcadas como leídas' });
});

// Mark a notification as read (auth required)
router.post('/:id/read', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { createdAt } = req.body;
  if (!createdAt) {
    res.status(400).json({ error: 'createdAt requerido' });
    return;
  }
  await db.send(new UpdateCommand({
    TableName: NOTIFICATIONS_TABLE,
    Key: { userId: user.sub as string, createdAt },
    UpdateExpression: 'SET #r = :read',
    ExpressionAttributeNames: { '#r': 'read' },
    ExpressionAttributeValues: { ':read': true },
  }));
  res.json({ message: 'Notificación marcada como leída' });
});

export default router;
