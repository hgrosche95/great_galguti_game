import { describe, it, expect, afterEach, vi } from 'vitest';
import { createAccessToken, createRefreshToken, verifyAccessToken, verifyRefreshToken } from './jwt';

describe('JWT-Secrets aus der Umgebung', () => {
  // Die Secrets werden beim Import gelesen -> fuer jeden Fall das Modul frisch laden.
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('bricht in Produktion ab, wenn ein Secret fehlt', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_ACCESS_SECRET', '');
    vi.stubEnv('JWT_REFRESH_SECRET', 'gesetzt');

    await expect(import('./jwt.js')).rejects.toThrow('JWT_ACCESS_SECRET');
  });

  it('startet in Produktion, wenn beide Secrets gesetzt sind', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_ACCESS_SECRET', 'access-geheim');
    vi.stubEnv('JWT_REFRESH_SECRET', 'refresh-geheim');

    const fresh = await import('./jwt.js');
    const token = fresh.createAccessToken({ sub: 1, username: 'x' });
    expect(fresh.verifyAccessToken(token).sub).toBe(1);
  });

  it('nutzt ausserhalb von Produktion den Dev-Fallback', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('JWT_ACCESS_SECRET', '');
    vi.stubEnv('JWT_REFRESH_SECRET', '');

    await expect(import('./jwt.js')).resolves.toBeDefined();
  });
});

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
