import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
export const db = DynamoDBDocumentClient.from(ddbClient);

export const TABLE_NAME = process.env.DYNAMODB_TABLE || 'InfraStack-UbigolMatchesBFA2FAAA-OWTUKQEH47I2';
export const COMPLEXES_TABLE = process.env.DYNAMODB_COMPLEXES_TABLE || '';
export const PLAYFIELDS_TABLE = process.env.DYNAMODB_PLAYFIELDS_TABLE || '';
export const OWNERS_TABLE = process.env.DYNAMODB_OWNERS_TABLE || '';
export const COMPLEX_OWNERS_TABLE = process.env.DYNAMODB_COMPLEX_OWNERS_TABLE || '';
export const NOTIFICATIONS_TABLE = process.env.DYNAMODB_NOTIFICATIONS_TABLE || '';
export const ATTENDANCE_TABLE = process.env.DYNAMODB_ATTENDANCE_TABLE || '';
export const MESSAGES_TABLE = process.env.DYNAMODB_MESSAGES_TABLE || '';
