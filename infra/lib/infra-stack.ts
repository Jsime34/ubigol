import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Tabla para guardar los partidos de fútbol
    const matchesTable = new dynamodb.Table(this, 'UbigolMatches', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Gratis en el nivel gratuito si no hay millones de datos
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Para el prototipo: si borras la infra, se borra la tabla
    });

    // Esto te dirá el nombre de la tabla en la consola al finalizar
    new cdk.CfnOutput(this, 'TableName', { value: matchesTable.tableName });
  }
}