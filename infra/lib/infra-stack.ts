import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Tabla para guardar los partidos de fútbol
    const matchesTable = new dynamodb.Table(this, 'UbigolMatches', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    matchesTable.addGlobalSecondaryIndex({
      indexName: 'ByPlayfield',
      partitionKey: { name: 'playfieldId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
    });

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UbigolUserPool', {
      userPoolName: 'ubigol-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // App Client (frontend uses this to talk to Cognito)
    const userPoolClient = userPool.addClient('UbigolWebClient', {
      userPoolClientName: 'ubigol-web',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      preventUserExistenceErrors: true,
    });

    // Tabla para complejos deportivos
    const complexesTable = new dynamodb.Table(this, 'UbigolComplexes', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    complexesTable.addGlobalSecondaryIndex({
      indexName: 'ByStatus',
      partitionKey: { name: 'verificationStatus', type: dynamodb.AttributeType.STRING },
    });

    // Tabla para canchas individuales dentro de un complejo
    const playfieldsTable = new dynamodb.Table(this, 'UbigolPlayfields', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    playfieldsTable.addGlobalSecondaryIndex({
      indexName: 'ByComplex',
      partitionKey: { name: 'complexId', type: dynamodb.AttributeType.STRING },
    });

    // Tabla para duenos/managers de complejos
    const ownersTable = new dynamodb.Table(this, 'UbigolOwners', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    ownersTable.addGlobalSecondaryIndex({
      indexName: 'ByUserId',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    });

    // Tabla de relacion muchos a muchos entre complejos y duenos
    const complexOwnersTable = new dynamodb.Table(this, 'UbigolComplexOwners', {
      partitionKey: { name: 'complexId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'ownerId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    complexOwnersTable.addGlobalSecondaryIndex({
      indexName: 'ByOwner',
      partitionKey: { name: 'ownerId', type: dynamodb.AttributeType.STRING },
    });

    // Tabla de notificaciones para usuarios
    const notificationsTable = new dynamodb.Table(this, 'UbigolNotifications', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Tabla de asistencia / calificaciones de jugadores
    const attendanceTable = new dynamodb.Table(this, 'UbigolAttendance', {
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'reviewerSubjectKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    attendanceTable.addGlobalSecondaryIndex({
      indexName: 'BySubject',
      partitionKey: { name: 'subjectId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // Tabla de mensajes de chat por juego
    const messagesTable = new dynamodb.Table(this, 'UbigolMessages', {
      tableName: 'UbigolMessages',
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Outputs
    new cdk.CfnOutput(this, 'TableName', { value: matchesTable.tableName });
    new cdk.CfnOutput(this, 'ComplexesTableName', { value: complexesTable.tableName });
    new cdk.CfnOutput(this, 'PlayfieldsTableName', { value: playfieldsTable.tableName });
    new cdk.CfnOutput(this, 'OwnersTableName', { value: ownersTable.tableName });
    new cdk.CfnOutput(this, 'ComplexOwnersTableName', { value: complexOwnersTable.tableName });
    new cdk.CfnOutput(this, 'NotificationsTableName', { value: notificationsTable.tableName });
    new cdk.CfnOutput(this, 'AttendanceTableName', { value: attendanceTable.tableName });
    new cdk.CfnOutput(this, 'MessagesTableName', { value: messagesTable.tableName });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
  }
}