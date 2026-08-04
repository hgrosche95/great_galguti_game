import type { Card } from './cards';
import { isValidMove } from './rules';
import { nextActivePlayer, type Player } from './players';

export interface TrickState {
  currentPlayerId: number;
  lastMove: Card[] | null;
  lastPlayerId: number | null;
}

export function createTrickState(startingPlayerId: number): TrickState {
  return {
    currentPlayerId: startingPlayerId,
    lastMove: null,
    lastPlayerId: null,
  };
}

export function move(players: Player[], playerId: number, cards: Card[], trickState: TrickState): TrickState | false {
  if (playerId !== trickState.currentPlayerId) {
    return false;
  }
  if(cards.length === 0) {
    if (trickState.lastMove === null) {
      return false; // The player opening a trick must play, not pass.
    }
    const player = players.find(p => p.id === playerId);
    if (player) {
      player.isActive = false;
    }
    return {
      currentPlayerId: nextActivePlayer(players, trickState.currentPlayerId)!.id,
      lastMove: trickState.lastMove,
      lastPlayerId: trickState.lastPlayerId,
    };
  }
  if(isValidMove(cards, trickState.lastMove)) {
    const player = players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }
    player.hand = player.hand.filter(card => !cards.includes(card));
  }
  else {
    return false;
  }

  return {
    currentPlayerId: nextActivePlayer(players, trickState.currentPlayerId)!.id,
    lastMove: cards,
    lastPlayerId: playerId,
  };
}

export function isTrickOver(players: Player[]): boolean {
  const activePlayers = players.filter(player => player.isActive && player.hand.length > 0);
  return activePlayers.length <= 1;
}

export function getWinner(players: Player[], trickState: TrickState): Player | null {
  const winner = players.find(player => player.id === trickState.lastPlayerId);
  return winner ?? null;
} 

export function startNewTrick(players: Player[], trickState: TrickState): TrickState {
  if (!isTrickOver(players)) {
    return trickState;
  }

  const winner = getWinner(players, trickState)!;
  for (const player of players) {
    if (player.hand.length > 0) {
      player.isActive = true;
    }
  }

  const startingPlayerId = winner.hand.length > 0
    ? winner.id
    : nextActivePlayer(players, winner.id)!.id;

  return createTrickState(startingPlayerId);
}