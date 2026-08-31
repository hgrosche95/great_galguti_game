import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'net';
import { httpServer } from './index';

let baseUrl: string;
let wsUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
  wsUrl = `ws://localhost:${port}`;
});

afterAll(() => {
  httpServer.close();
});

// Wartet auf die erste Nachricht vom Server oder darauf, dass die
// Verbindung geschlossen wird (je nachdem, was zuerst passiert).
function waitForFirstMessageOrClose(ws: WebSocket): Promise<{ type: string } | { closed: true }> {
  return new Promise((resolve) => {
    ws.once('message', (raw) => resolve(JSON.parse(raw.toString())));
    ws.once('close', () => resolve({ closed: true }));
  });
}

describe('Auth E2E Flow', () => {
  it('Registrieren -> Einloggen -> Spiel beitreten mit Token', async () => {
    const unique = Date.now();
    const username = `e2euser-${unique}`;
    const email = `e2e-${unique}@example.com`;

    const registerRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password: 'supersecret' }),
    });
    expect(registerRes.status).toBe(201);

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'supersecret' }),
    });
    expect(loginRes.status).toBe(200);
    const { accessToken } = await loginRes.json();
    expect(typeof accessToken).toBe('string');

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve) => ws.once('open', resolve));
    ws.send(JSON.stringify({ type: 'auth', token: accessToken }));

    const result = await waitForFirstMessageOrClose(ws);
    expect(result).toMatchObject({ type: 'waiting' });

    ws.close();
  });

  it('Als Gast spielen -> Spiel beitreten mit Token', async () => {
    const guestRes = await fetch(`${baseUrl}/auth/guest`, { method: 'POST' });
    expect(guestRes.status).toBe(201);
    const { accessToken, username } = await guestRes.json();
    expect(typeof accessToken).toBe('string');
    expect(username).toMatch(/^Gast-/);

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve) => ws.once('open', resolve));
    ws.send(JSON.stringify({ type: 'auth', token: accessToken }));

    const result = await waitForFirstMessageOrClose(ws);
    expect(result).toMatchObject({ type: 'waiting' });

    ws.close();
  });

  it('Spiel beitreten ohne gueltiges Token wird abgelehnt', async () => {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve) => ws.once('open', resolve));
    ws.send(JSON.stringify({ type: 'auth', token: 'kein-gueltiges-token' }));

    const result = await waitForFirstMessageOrClose(ws);
    expect(result).toEqual({ closed: true });
  });
});

describe('CORS', () => {
  // Die echte Produktions-URL hat ein zusaetzliches Label vor azurestaticapps.net
  // (z.B. https://blue-sea-08b19cb0f.7.azurestaticapps.net) - das hat eine
  // fruehere, zu enge Regex faelschlicherweise blockiert.
  it('erlaubt die echte Azure Static Web Apps-Produktions-URL', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Origin: 'https://blue-sea-08b19cb0f.7.azurestaticapps.net' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://blue-sea-08b19cb0f.7.azurestaticapps.net',
    );
  });

  it('lehnt eine fremde Origin ab', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
