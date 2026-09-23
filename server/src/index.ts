import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, type WebSocket } from 'ws';
import { nextActivePlayer, type Player } from '../../src/players';
import { shuffle } from '../../src/general';
import { createDeck, handOutDeck } from '../../src/deck';
import { createTrickState, isTrickOver, move, chooseMove, startNewTrick } from '../../src/trick';
import type { Card } from '../../src/cards';
import { authRouter } from './auth/routes';
import { verifyAccessToken } from './auth/jwt';

interface Connection {
  socket: WebSocket;
  playerId: number;
  name: string;
}

let connections: Connection[] = [];
let bots: number[] = [];
let players: Player[] = [];
let trickState: ReturnType<typeof createTrickState> | null = null;
let nextPlayerId = 1;
let finishOrder: number[] = [];

// Setzt den kompletten Spielzustand zurueck (wenn alle gegangen sind und in Tests).
function resetGame() {
  connections = [];
  bots = [];
  players = [];
  trickState = null;
  finishOrder = [];
}

function isGameOver(): boolean {
  return players.filter(p => p.hand.length > 0).length <= 1;
}

// trickState bleibt nach Spielende gesetzt, deshalb reicht !trickState nicht.
function isGameRunning(): boolean {
  return trickState !== null && !isGameOver();
}

function isConnected(playerId: number): boolean {
  return connections.some(conn => conn.playerId === playerId) || bots.includes(playerId);
}

function reapplyDisconnected() {
  for (const player of players) {
    if (!isConnected(player.id)) {
      player.isActive = false;
    }
  }
}

function skipDisconnectedPlayers() {
  if (!trickState) return;
  for (let i = 0; i < players.length && !isConnected(trickState.currentPlayerId); i++) {
    const next = nextActivePlayer(players, trickState.currentPlayerId);
    if (!next) break; // niemand mehr verbunden/aktiv
    trickState.currentPlayerId = next.id;
  }
}

function recordFinishers() {
  const newlyFinished = players
    .filter(p => p.hand.length === 0 && !finishOrder.includes(p.id))
    .map(p => p.id);
  finishOrder.push(...newlyFinished);
}

function broadcastWaitingCount() {
  const message = JSON.stringify({
    type: 'waiting',
    count: connections.length + bots.length,
    bots: bots.length,
  });
  connections.forEach(conn => conn.socket.send(message));
}

function isValidAccessToken(token: string): boolean {
  try {
    verifyAccessToken(token);
    return true;
  } catch {
    return false;
  }
}

function isValidCardList(value: unknown): value is { value: number; isJoker: boolean }[] {
  return Array.isArray(value) && value.every(c => typeof c === 'object' && c !== null);
}

// Erlaubt: lokaler Vite-Dev-Server sowie die Azure Static Web Apps-Domain
// (Produktion und PR-Vorschau-Umgebungen laufen beide unter *.azurestaticapps.net).
const ALLOWED_ORIGIN_PATTERN = /^https:\/\/[a-z0-9.-]+\.azurestaticapps\.net$/;

const app = express();
// Azure Container Apps setzt genau einen Proxy (Ingress) vor den Server. Ohne
// diese Einstellung waere req.ip immer die Proxy-IP, und alle Spieler teilten
// sich ein einziges Rate-Limit. So kommt die echte Client-IP aus X-Forwarded-For.
app.set('trust proxy', 1);
app.use(cors({
  origin: (origin, callback) => {
    // kein Origin-Header = kein Browser (curl, Server-zu-Server) -> erlauben
    if (!origin || origin === 'http://localhost:5173' || ALLOWED_ORIGIN_PATTERN.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Nicht erlaubte Origin'));
    }
  },
}));
app.use(express.json());
app.use('/auth', authRouter);

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (socket) => {
  let authed = false;
  let playerId = 0;

  // Client muss sich innerhalb von 5s per {type:'auth', token} authentifizieren,
  // sonst wird die Verbindung verworfen (verhindert offene, nie-authentifizierte Sockets).
  const authTimeout = setTimeout(() => {
    if (!authed) socket.close();
  }, 5000);

  socket.on('message', (raw) => {
    // Sicherheitsnetz: ein Fehler in einer einzelnen Nachricht darf nie den
    // ganzen Prozess (und damit das Spiel fuer alle) beenden.
    try {
      handleMessage(raw.toString());
    } catch (err) {
      console.error('Fehler beim Verarbeiten einer Nachricht:', err);
    }
  });

  function handleMessage(text: string) {
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    // JSON.parse('null') oder '42' klappt, aber data.type wuerde dann crashen
    if (typeof data !== 'object' || data === null) {
      if (!authed) socket.close();
      return;
    }

    if (!authed) {
      if (data.type !== 'auth' || typeof data.token !== 'string' || !isValidAccessToken(data.token)) {
        socket.close();
        return;
      }
      if (connections.length + bots.length >= 8) {
        socket.close();
        return;
      }

      authed = true;
      clearTimeout(authTimeout);
      playerId = nextPlayerId++;
      connections.push({ socket, playerId, name: `Player ${playerId}` });
      broadcastWaitingCount();
      return;
    }

    if (data.type === 'setName' && !isGameRunning() && typeof data.name === 'string') {
      const connection = connections.find(conn => conn.socket === socket);
      const trimmedName = data.name.trim().slice(0, 20);
      if (connection && trimmedName) {
        connection.name = trimmedName;
      }
    } else if (data.type === 'addBot' && !isGameRunning() && connections.length + bots.length < 8) {
      bots.push(nextPlayerId++);
      broadcastWaitingCount();
    } else if (data.type === 'start' && !isGameRunning() && connections.length + bots.length >= 3) {
      startGame();
    } else if (data.type === 'move' && isGameRunning() && isValidCardList(data.cards)) {
      // Wer waehrend eines laufenden Spiels beitritt, ist (noch) kein Spieler.
      const me = players.find(p => p.id === playerId);
      if (!me) return;
      const cards = resolveCardsFromHand(me.hand, data.cards);
      if (!cards) return; // Spieler behauptet, Karten zu haben, die er nicht hat

      processMove(playerId, cards);
    }
  }

  socket.on('close', () => {
    clearTimeout(authTimeout);
    if (!authed) return;

    connections = connections.filter(conn => conn.socket !== socket);
    if (connections.length === 0) {
      // Alle Menschen sind weg -> verwaiste Partie verwerfen, sonst bleibt die Lobby blockiert.
      resetGame();
      return;
    }
    broadcastWaitingCount();

    if (trickState) {
      const disconnectedPlayer = players.find(p => p.id === playerId);
      if (disconnectedPlayer) {
        disconnectedPlayer.isActive = false;
        skipDisconnectedPlayers();
        broadcastGameState();
      }
    }
  });
});

function startGame() {
  finishOrder = [];

  players = [
    ...connections.map(conn => ({
      id: conn.playerId,
      name: conn.name,
      hand: [],
      isActive: true,
    })),
    ...bots.map(botId => ({
      id: botId,
      name: `Bot ${botId}`,
      hand: [],
      isActive: true,
    })),
  ];

  const deck = shuffle(createDeck());
  const hands = handOutDeck(deck, players.length);
  players.forEach((player, i) => {
    player.hand = hands[i]!;
  });

  trickState = createTrickState(players[0]!.id);
  broadcastGameState();
  maybePlayBotTurn();
}

function resolveCardsFromHand(hand: Card[], requested: { value: number; isJoker: boolean }[]): Card[] | null {
  const remaining = [...hand];
  const resolved: Card[] = [];
  for (const want of requested) {
    const index = remaining.findIndex(c => c.value === want.value && c.isJoker === want.isJoker);
    if (index === -1) {
      return null; // Spieler behauptet, eine Karte zu haben, die er nicht hat
    }
    resolved.push(remaining[index]!);
    remaining.splice(index, 1);
  }
  return resolved;
}

// Verarbeitet einen Zug (Karten spielen oder passen), egal ob er von einem
// echten Spieler oder einem Bot kommt.
function processMove(playerId: number, cards: Card[]): boolean {
  if (!trickState) return false;

  const result = move(players, playerId, cards, trickState);
  if (result === false) return false;

  trickState = result;
  if (isTrickOver(players)) {
    trickState = startNewTrick(players, trickState);
    reapplyDisconnected();
    skipDisconnectedPlayers();
  }
  recordFinishers();
  broadcastGameState();
  maybePlayBotTurn();
  return true;
}

function maybePlayBotTurn() {
  if (!trickState) return;
  const currentPlayerId = trickState.currentPlayerId;
  if (!bots.includes(currentPlayerId)) return;

  setTimeout(() => {
    // Falls sich der Zustand zwischenzeitlich geaendert hat (z.B. Spielende), abbrechen.
    if (!trickState || trickState.currentPlayerId !== currentPlayerId) return;

    const bot = players.find(p => p.id === currentPlayerId)!;
    const cards = chooseMove(bot, trickState.lastMove);
    processMove(currentPlayerId, cards);
  }, 1800);
}

function broadcastGameState() {
  if (!trickState) return;

  const gameOver = isGameOver();
  const ranking = gameOver
    ? [...finishOrder, ...players.filter(p => !finishOrder.includes(p.id)).map(p => p.id)]
    : [];

  for (const conn of connections) {
    // Spaet beigetretene Verbindungen sitzen in der Lobby und spielen erst die naechste Runde mit.
    const me = players.find(p => p.id === conn.playerId);
    if (!me) continue;
    const state = {
      type: 'state',
      yourId: conn.playerId,
      currentPlayerId: trickState.currentPlayerId,
      lastMove: trickState.lastMove,
      yourHand: me.hand,
      gameOver,
      ranking,
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        cardCount: p.hand.length,
        isActive: p.isActive,
      })),
    };
    conn.socket.send(JSON.stringify(state));
  }
}

export { httpServer, resetGame };

// Nur beim direkten Start (node index.js) lauschen, nicht wenn dieses
// Modul von einem Test importiert wird (der startet den Server selbst
// auf einem freien Port).
if (require.main === module) {
  httpServer.listen(8080, () => {
    console.log('Server (HTTP + WebSocket) läuft auf http://localhost:8080');
  });
}
