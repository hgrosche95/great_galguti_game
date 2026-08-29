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

// Erlaubt: lokaler Vite-Dev-Server sowie die Azure Static Web Apps-Domain
// (Produktion und PR-Vorschau-Umgebungen laufen beide unter *.azurestaticapps.net).
const ALLOWED_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.azurestaticapps\.net$/;

const app = express();
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
    const data = JSON.parse(raw.toString());

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

    if (data.type === 'setName' && !trickState && typeof data.name === 'string') {
      const connection = connections.find(conn => conn.socket === socket);
      const trimmedName = data.name.trim().slice(0, 20);
      if (connection && trimmedName) {
        connection.name = trimmedName;
      }
    } else if (data.type === 'addBot' && !trickState && connections.length + bots.length < 8) {
      bots.push(nextPlayerId++);
      broadcastWaitingCount();
    } else if (data.type === 'start' && connections.length + bots.length >= 3) {
      startGame();
    } else if (data.type === 'move' && trickState) {
      const me = players.find(p => p.id === playerId)!;
      const cards = resolveCardsFromHand(me.hand, data.cards);
      if (!cards) return; // Spieler behauptet, Karten zu haben, die er nicht hat

      processMove(playerId, cards);
    }
  });

  socket.on('close', () => {
    clearTimeout(authTimeout);
    if (!authed) return;

    connections = connections.filter(conn => conn.socket !== socket);
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
  }, 800);
}

function broadcastGameState() {
  if (!trickState) return;

  const gameOver = players.filter(p => p.hand.length > 0).length <= 1;
  const ranking = gameOver
    ? [...finishOrder, ...players.filter(p => !finishOrder.includes(p.id)).map(p => p.id)]
    : [];

  for (const conn of connections) {
    const me = players.find(p => p.id === conn.playerId)!;
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

httpServer.listen(8080, () => {
  console.log('Server (HTTP + WebSocket) läuft auf http://localhost:8080');
});
