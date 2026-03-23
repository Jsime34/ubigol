import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID || '',
  tokenUse: 'id',
  clientId: process.env.COGNITO_CLIENT_ID || '',
});

export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean);

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    const user = (req as any).user;
    if (!user || !ADMIN_EMAILS.includes(user.email)) {
      res.status(403).json({ error: 'Acceso de administrador requerido' });
      return;
    }
    next();
  });
}
