import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from './jwt';

export interface AuthenticatedRequest extends Request {
  userId: number;
  username: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization-Header (Bearer <token>) fehlt' });
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).userId = payload.sub;
    (req as AuthenticatedRequest).username = payload.username;
    next();
  } catch {
    res.status(401).json({ error: 'accessToken ungueltig oder abgelaufen' });
  }
}
