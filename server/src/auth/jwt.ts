import jwt from 'jsonwebtoken';

// In Produktion via Azure Container App-Secrets als Umgebungsvariable setzen.
// Die Dev-Fallbacks sind bewusst offensichtlich unsicher, damit niemand sie
// versehentlich in Produktion verwendet, ohne es zu merken.
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-in-production';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-in-production';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

export interface AccessTokenPayload {
  sub: number;
  username: string;
}

export interface RefreshTokenPayload {
  sub: number;
}

export function createAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function createRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

// wirft bei ungueltiger Signatur oder abgelaufenem Token
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as unknown as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as unknown as RefreshTokenPayload;
}
