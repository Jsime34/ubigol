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

    // Tabla para canchas/playfields
    const playfieldsTable = new dynamodb.Table(this, 'UbigolPlayfields', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    playfieldsTable.addGlobalSecondaryIndex({
      indexName: 'ByOwner',
      partitionKey: { name: 'ownerId', type: dynamodb.AttributeType.STRING },
    });

    playfieldsTable.addGlobalSecondaryIndex({
      indexName: 'ByStatus',
      partitionKey: { name: 'verificationStatus', type: dynamodb.AttributeType.STRING },
    });

    // Outputs
    new cdk.CfnOutput(this, 'TableName', { value: matchesTable.tableName });
    new cdk.CfnOutput(this, 'PlayfieldsTableName', { value: playfieldsTable.tableName });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
  }
}