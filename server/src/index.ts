import { WebSocketServer, type WebSocket } from 'ws';
import { nextActivePlayer, Player } from '../../src/players';
import { shuffle } from '../../src/general';
import { createDeck, handOutDeck } from '../../src/deck';
import { createTrickState, isTrickOver, move, startNewTrick } from '../../src/trick';
import { Card } from '../../src/cards';

interface Connection {
  socket: WebSocket;
  playerId: number;
}

let connections: Connection[] = [];
let players: Player[] = [];
let trickState: ReturnType<typeof createTrickState> | null = null;
let nextPlayerId = 1;
let finishOrder: number[] = [];

function isConnected(playerId: number): boolean {
  return connections.some(conn => conn.playerId === playerId);
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
  const message = JSON.stringify({ type: 'waiting', count: connections.length });
  connections.forEach(conn => conn.socket.send(message));
}

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (socket) => {
  if(connections.length >= 8) {
    socket.close();
    return;
  }

  const playerId = nextPlayerId++;
  const connection: Connection = { socket, playerId };
  connections.push(connection);

  broadcastWaitingCount();

socket.on('message', (raw) => {
  const data = JSON.parse(raw.toString());
  if (data.type === 'start' && connections.length >= 3) {
    startGame();
  } else if (data.type === 'move' && trickState) {
    const me = players.find(p => p.id === playerId)!;
    const cards = resolveCardsFromHand(me.hand, data.cards);
    if (!cards) return; // Spieler behauptet, Karten zu haben, die er nicht hat

    const result = move(players, playerId, cards, trickState);
    if (result !== false) {
      trickState = result;
      if (isTrickOver(players)) {
        trickState = startNewTrick(players, trickState);
        reapplyDisconnected();
        skipDisconnectedPlayers();
      }
      recordFinishers();
      broadcastGameState();
    }
  }
});

  socket.on('close', () => {
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

  players = connections.map(conn => ({
    id: conn.playerId,
    name: `Player ${conn.playerId}`,
    hand: [],
    isActive: true,
  }));

  const deck = shuffle(createDeck());
  const hands = handOutDeck(deck, players.length);
  players.forEach((player, i) => {
    player.hand = hands[i]!;
  });

  trickState = createTrickState(players[0]!.id);
  broadcastGameState();
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

console.log('WebSocket-Server läuft auf ws://localhost:8080');