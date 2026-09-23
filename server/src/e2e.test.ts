import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { WebSocket, type RawData } from 'ws';
import type { AddressInfo } from 'net';
import { httpServer, resetGame } from './index';
import { createAccessToken } from './auth/jwt';

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

// Wartet auf die erste Nachricht eines bestimmten Typs und ignoriert alle anderen
// (z.B. die 'waiting'-Nachrichten, die bei jedem neuen Mitspieler verschickt werden).
function waitForMessage(ws: WebSocket, type: string): Promise<{ type: string }> {
  return new Promise((resolve) => {
    const onMessage = (raw: RawData) => {
      const message = JSON.parse(raw.toString());
      if (message.type === type) {
        ws.off('message', onMessage);
        resolve(message);
      }
    };
    ws.on('message', onMessage);
  });
}

// Token direkt signieren statt ueber /auth/guest -> braucht keine Datenbank.
let nextTestUserId = 100000;
async function connectPlayer(): Promise<WebSocket> {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.once('open', resolve));
  const token = createAccessToken({ sub: nextTestUserId++, username: 'test' });
  ws.send(JSON.stringify({ type: 'auth', token }));
  const result = await waitForFirstMessageOrClose(ws);
  expect(result).toMatchObject({ type: 'waiting' });
  return ws;
}

async function startGame(ws: WebSocket) {
  // Listener VOR dem Senden anhaengen, sonst kann die Antwort verpasst werden.
  const state = waitForMessage(ws, 'state');
  ws.send(JSON.stringify({ type: 'start' }));
  await state;
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

describe('Robustheit: Server bleibt bei boesartigen Nachrichten stabil', () => {
  beforeEach(() => {
    resetGame();
  });

  it.each(['{kaputt', 'null', '42'])('ueberlebt ungueltiges JSON ohne Auth: %s', async (payload) => {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve) => ws.once('open', resolve));
    ws.send(payload);

    const result = await waitForFirstMessageOrClose(ws);
    expect(result).toEqual({ closed: true });

    // Server lebt noch: ein neuer Spieler kann beitreten
    const other = await connectPlayer();
    other.close();
  });

  it('ueberlebt kaputte Zuege eines eingeloggten Spielers', async () => {
    const [a, b, c] = await Promise.all([connectPlayer(), connectPlayer(), connectPlayer()]);
    await startGame(a);

    a.send('{kaputt');
    a.send(JSON.stringify({ type: 'move', cards: 'keine-liste' }));
    a.send(JSON.stringify({ type: 'move', cards: [null] }));

    // a ist noch verbunden und der Server reagiert weiter
    const other = await connectPlayer();
    expect(a.readyState).toBe(WebSocket.OPEN);

    [a, b, c, other].forEach(ws => ws.close());
  });

  it('Beitritt waehrend eines laufenden Spiels crasht den Server nicht', async () => {
    const [a, b, c] = await Promise.all([connectPlayer(), connectPlayer(), connectPlayer()]);
    await startGame(a);

    const late = await connectPlayer();
    late.send(JSON.stringify({ type: 'move', cards: [] }));

    // c geht -> broadcastGameState() laeuft auch ueber die Verbindung von 'late'
    const update = waitForMessage(a, 'state');
    c.close();
    await update;

    [a, b, late].forEach(ws => ws.close());
  });

  it("'start' waehrend eines laufenden Spiels setzt das Spiel nicht zurueck", async () => {
    const [a, b, c] = await Promise.all([connectPlayer(), connectPlayer(), connectPlayer()]);
    await startGame(a);

    let restarted = false;
    a.on('message', (raw) => {
      if (JSON.parse(raw.toString()).type === 'state') restarted = true;
    });
    b.send(JSON.stringify({ type: 'start' }));
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(restarted).toBe(false);

    [a, b, c].forEach(ws => ws.close());
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

describe('Rate-Limits auf den Auth-Routen', () => {
  // Jeder Test nutzt eine eigene (erfundene) Client-IP ueber X-Forwarded-For.
  // So stoeren sich die Tests nicht gegenseitig, und es ist gleich mitgeprueft,
  // dass 'trust proxy' greift (sonst zaehlte alles fuer 127.0.0.1).
  // Leerer Body -> 400 vor jedem DB-Zugriff, die Tests brauchen also keine Datenbank.
  function postFrom(ip: string, path: string) {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: '{}',
    });
  }

  it('sperrt Login nach 10 Fehlversuchen, aber nur fuer diese IP', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await postFrom('203.0.113.1', '/auth/login')).status).toBe(400);
    }

    const blocked = await postFrom('203.0.113.1', '/auth/login');
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: expect.stringContaining('Login-Versuche') });

    // eine andere IP ist davon nicht betroffen
    expect((await postFrom('203.0.113.2', '/auth/login')).status).toBe(400);
  });

  it('sperrt Registrierung nach 5 Anfragen', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await postFrom('203.0.113.3', '/auth/register')).status).toBe(400);
    }
    expect((await postFrom('203.0.113.3', '/auth/register')).status).toBe(429);
  });
});
