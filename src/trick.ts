import type { Card } from './cards';
import { isValidMove, getMoveValue } from './rules';
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
      currentPlayerId: nextActivePlayer(players, trickState.currentPlayerId)?.id ?? trickState.currentPlayerId,
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
    currentPlayerId: nextActivePlayer(players, trickState.currentPlayerId)?.id ?? trickState.currentPlayerId,
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
    : (nextActivePlayer(players, winner.id)?.id ?? winner.id);

  return createTrickState(startingPlayerId);
}

export function chooseMove(player: Player, lastMove: Card[] | null): Card[] {
  const requiredCount = lastMove ? lastMove.length : null;
  const maxValue = lastMove ? getMoveValue(lastMove) : null;
  const isPlayableValue = (value: number) => maxValue === null || value < maxValue;

  const jokers = player.hand.filter(card => card.isJoker);
  const groupsByValue = new Map<number, Card[]>();
  for (const card of player.hand) {
    if (card.isJoker) {
      continue;
    }
    const group = groupsByValue.get(card.value) ?? [];
    group.push(card);
    groupsByValue.set(card.value, group);
  }

  // 1. A natural group without any joker.
  for (const [value, group] of groupsByValue) {
    if (!isPlayableValue(value)) {
      continue;
    }
    const count = requiredCount ?? group.length;
    if (group.length >= count) {
      return group.slice(0, count);
    }
  }

  // 2. Top up a group with exactly one joker, if that reaches the needed count.
  if (jokers.length > 0) {
    for (const [value, group] of groupsByValue) {
      if (!isPlayableValue(value)) {
        continue;
      }
      const count = requiredCount ?? group.length + 1;
      if (group.length + 1 === count) {
        return [...group, jokers[0]!];
      }
    }
    // No matching non-joker cards at all: try playing a single joker on its own.
    const count = requiredCount ?? 1;
    if (count === 1 && isPlayableValue(13)) {
      return [jokers[0]!];
    }
  }

  return []; // no valid combination found: pass
}

export function game(players: Player[], startingPlayerId: number): void {
  let trickState = createTrickState(startingPlayerId);

  while (players.some(player => player.hand.length > 0)) {
    const currentPlayer = players.find(player => player.id === trickState.currentPlayerId);
    if (!currentPlayer) {
      break;
    }

    const cardsToPlay = chooseMove(currentPlayer, trickState.lastMove);
    const result = move(players, currentPlayer.id, cardsToPlay, trickState);
    if (result === false) {
      break;
    }
    trickState = result;

    if (isTrickOver(players)) {
      trickState = startNewTrick(players, trickState);
    }
  }
}