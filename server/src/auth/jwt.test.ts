import { describe, it, expect } from 'vitest';
import { createAccessToken, createRefreshToken, verifyAccessToken, verifyRefreshToken } from './jwt';

describe('JWT Access-/Refresh-Token', () => {
  it('erstellt und validiert ein Access-Token mit dem richtigen Payload', () => {
    const token = createAccessToken({ sub: 42, username: 'testuser' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(42);
    expect(payload.username).toBe('testuser');
  });

  it('erstellt und validiert ein Refresh-Token mit dem richtigen Payload', () => {
    const token = createRefreshToken({ sub: 42 });
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe(42);
  });

  it('lehnt ein manipuliertes Token ab', () => {
    const token = createAccessToken({ sub: 1, username: 'x' });
    const tampered = token.slice(0, -3) + 'xyz';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('lehnt ein voellig ungueltiges Token ab', () => {
    expect(() => verifyAccessToken('kaputt')).toThrow();
  });

  it('Access- und Refresh-Token sind wegen unterschiedlicher Secrets nicht austauschbar', () => {
    const refreshToken = createRefreshToken({ sub: 1 });
    expect(() => verifyAccessToken(refreshToken)).toThrow();

    const accessToken = createAccessToken({ sub: 1, username: 'x' });
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });
});
