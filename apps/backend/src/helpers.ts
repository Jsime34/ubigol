import { PutCommand, GetCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { db, OWNERS_TABLE, COMPLEX_OWNERS_TABLE, NOTIFICATIONS_TABLE } from './db';

export async function isComplexOwner(userId: string, complexId: string): Promise<boolean> {
  const ownerResult = await db.send(new QueryCommand({
    TableName: OWNERS_TABLE,
    IndexName: 'ByUserId',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId },
  }));
  const owner = ownerResult.Items?.[0] as any;
  if (!owner) return false;

  const linkResult = await db.send(new GetCommand({
    TableName: COMPLEX_OWNERS_TABLE,
    Key: { complexId, ownerId: owner.id },
  }));
  return !!linkResult.Item;
}

export async function getComplexOwnerUserIds(complexId: string): Promise<string[]> {
  const linksResult = await db.send(new ScanCommand({
    TableName: COMPLEX_OWNERS_TABLE,
    FilterExpression: 'complexId = :cxId',
    ExpressionAttributeValues: { ':cxId': complexId },
  }));
  const userIds: string[] = [];
  for (const link of linksResult.Items || []) {
    const ownerResult = await db.send(new GetCommand({
      TableName: OWNERS_TABLE,
      Key: { id: (link as any).ownerId },
    }));
    if (ownerResult.Item) userIds.push((ownerResult.Item as any).userId);
  }
  return userIds;
}

export async function createNotification(userId: string, type: string, title: string, message: string, data?: Record<string, string>) {
  await db.send(new PutCommand({
    TableName: NOTIFICATIONS_TABLE,
    Item: {
      userId,
      createdAt: new Date().toISOString(),
      id: uuid(),
      type,
      title,
      message,
      read: false,
      ...(data ? { data } : {}),
    },
  }));
}
