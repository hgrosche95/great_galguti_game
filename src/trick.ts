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