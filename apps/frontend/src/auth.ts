import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

const poolId = import.meta.env.VITE_COGNITO_USER_POOL_ID || '';
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || '';
const isCognitoConfigured = poolId !== '' && clientId !== '';

const userPool = isCognitoConfigured
  ? new CognitoUserPool({ UserPoolId: poolId, ClientId: clientId })
  : null;

function ensurePool(): CognitoUserPool {
  if (!userPool) throw new Error('Cognito no está configurado. Configura VITE_COGNITO_USER_POOL_ID y VITE_COGNITO_CLIENT_ID en .env');
  return userPool;
}

export function signUp(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<CognitoUser> {
  const pool = ensurePool();
  const attributes = [
    new CognitoUserAttribute({ Name: 'given_name', Value: firstName }),
    new CognitoUserAttribute({ Name: 'family_name', Value: lastName }),
  ];

  return new Promise((resolve, reject) => {
    pool.signUp(email, password, attributes, [], (err, result) => {
      if (err || !result) return reject(err);
      resolve(result.user);
    });
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  const pool = ensurePool();
  const user = new CognitoUser({ Username: email, Pool: pool });
  return new Promise((resolve, reject) => {
    user.confirmRegistration(code, true, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function signIn(email: string, password: string): Promise<CognitoUserSession> {
  const pool = ensurePool();
  const user = new CognitoUser({ Username: email, Pool: pool });
  const authDetails = new AuthenticationDetails({ Username: email, Password: password });

  return new Promise((resolve, reject) => {
    user.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    });
  });
}

export function signOut(): void {
  if (!userPool) return;
  const user = userPool.getCurrentUser();
  if (user) user.signOut();
}

export function getCurrentSession(): Promise<CognitoUserSession | null> {
  if (!userPool) return Promise.resolve(null);
  const user = userPool.getCurrentUser();
  if (!user) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) return reject(err);
      resolve(session);
    });
  });
}

export function getIdToken(): Promise<string | null> {
  return getCurrentSession().then((session) =>
    session ? session.getIdToken().getJwtToken() : null
  );
}
