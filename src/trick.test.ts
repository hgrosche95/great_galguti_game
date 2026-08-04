import { describe, it, expect } from 'vitest';
import { createTrickState, move, isTrickOver, getWinner } from './trick';
import { createPlayers } from './players';

describe('createTrickState', () => {
  it('initializes with the given starting player and no previous move', () => {
    const state = createTrickState(2);
    expect(state.currentPlayerId).toBe(2);
    expect(state.lastMove).toBeNull();
    expect(state.lastPlayerId).toBeNull();
  });
});

describe('move', () => {
  it('rejects a move from a player whose turn it is not', () => {
    const players = createPlayers(3);
    players[0]!.hand = [{ value: 5, isJoker: false }];
    players[1]!.hand = [{ value: 5, isJoker: false }];
    const trickState = createTrickState(1);

    const result = move(players, 2, [players[1]!.hand[0]!], trickState);

    expect(result).toBe(false);
    expect(players[1]!.hand).toHaveLength(1);
  });

  it('plays a valid first move, removes the cards from the hand and advances the turn', () => {
    const players = createPlayers(3);
    players[0]!.hand = [
      { value: 7, isJoker: false },
      { value: 7, isJoker: false },
    ];
    players[1]!.hand = [{ value: 5, isJoker: false }];
    players[2]!.hand = [{ value: 3, isJoker: false }];
    const trickState = createTrickState(1);
    const playedMove = [players[0]!.hand[0]!, players[0]!.hand[1]!];

    const result = move(players, 1, playedMove, trickState);

    expect(result).not.toBe(false);
    if (result !== false) {
      expect(result.lastMove).toEqual(playedMove);
      expect(result.lastPlayerId).toBe(1);
      expect(result.currentPlayerId).toBe(2);
    }
    expect(players[0]!.hand).toHaveLength(0);
  });

  it('rejects an internally invalid move and leaves the hand untouched', () => {
    const players = createPlayers(3);
    players[0]!.hand = [
      { value: 5, isJoker: false },
      { value: 6, isJoker: false },
    ];
    const trickState = createTrickState(1);
    const invalidMove = [players[0]!.hand[0]!, players[0]!.hand[1]!];

    const result = move(players, 1, invalidMove, trickState);

    expect(result).toBe(false);
    expect(players[0]!.hand).toHaveLength(2);
  });

  it('handles passing: deactivates the player and keeps the previous move intact', () => {
    const players = createPlayers(3);
    players[0]!.hand = [{ value: 5, isJoker: false }];
    players[1]!.hand = [{ value: 6, isJoker: false }];
    players[2]!.hand = [{ value: 7, isJoker: false }];
    const trickState = createTrickState(1);

    const result = move(players, 1, [], trickState);

    expect(result).not.toBe(false);
    if (result !== false) {
      expect(result.lastMove).toBeNull();
      expect(result.lastPlayerId).toBeNull();
      expect(result.currentPlayerId).toBe(2);
    }
    expect(players[0]!.isActive).toBe(false);
  });

  it('accepts a follow-up move with the same count and a lower value', () => {
    const players = createPlayers(3);
    players[0]!.hand = [
      { value: 10, isJoker: false },
      { value: 10, isJoker: false },
    ];
    players[1]!.hand = [
      { value: 5, isJoker: false },
      { value: 5, isJoker: false },
    ];
    players[2]!.hand = [{ value: 3, isJoker: false }];
    const initialState = createTrickState(1);
    const firstMove = [players[0]!.hand[0]!, players[0]!.hand[1]!];
    const stateAfterFirstMove = move(players, 1, firstMove, initialState);
    expect(stateAfterFirstMove).not.toBe(false);

    if (stateAfterFirstMove !== false) {
      const secondMove = [players[1]!.hand[0]!, players[1]!.hand[1]!];
      const result = move(players, 2, secondMove, stateAfterFirstMove);

      expect(result).not.toBe(false);
      if (result !== false) {
        expect(result.lastMove).toEqual(secondMove);
        expect(result.lastPlayerId).toBe(2);
      }
      expect(players[1]!.hand).toHaveLength(0);
    }
  });

  it('rejects a follow-up move with a higher value than the previous move', () => {
    const players = createPlayers(3);
    players[0]!.hand = [
      { value: 5, isJoker: false },
      { value: 5, isJoker: false },
    ];
    players[1]!.hand = [
      { value: 10, isJoker: false },
      { value: 10, isJoker: false },
    ];
    const initialState = createTrickState(1);
    const firstMove = [players[0]!.hand[0]!, players[0]!.hand[1]!];
    const stateAfterFirstMove = move(players, 1, firstMove, initialState);
    expect(stateAfterFirstMove).not.toBe(false);

    if (stateAfterFirstMove !== false) {
      const secondMove = [players[1]!.hand[0]!, players[1]!.hand[1]!];
      const result = move(players, 2, secondMove, stateAfterFirstMove);

      expect(result).toBe(false);
      expect(players[1]!.hand).toHaveLength(2);
    }
  });

  it('rejects a follow-up move with a different card count than the previous move', () => {
    const players = createPlayers(3);
    players[0]!.hand = [
      { value: 10, isJoker: false },
      { value: 10, isJoker: false },
    ];
    players[1]!.hand = [{ value: 5, isJoker: false }];
    const initialState = createTrickState(1);
    const firstMove = [players[0]!.hand[0]!, players[0]!.hand[1]!];
    const stateAfterFirstMove = move(players, 1, firstMove, initialState);
    expect(stateAfterFirstMove).not.toBe(false);

    if (stateAfterFirstMove !== false) {
      const secondMove = [players[1]!.hand[0]!];
      const result = move(players, 2, secondMove, stateAfterFirstMove);

      expect(result).toBe(false);
      expect(players[1]!.hand).toHaveLength(1);
    }
  });

  it('returns false when the current player id does not match any player', () => {
    const players = createPlayers(2);
    const trickState = createTrickState(99);

    const result = move(players, 99, [{ value: 1, isJoker: false }], trickState);

    expect(result).toBe(false);
  });
});

describe('isTrickOver', () => {
  it('is false when more than one player is still active with cards', () => {
    const players = createPlayers(3);
    players[0]!.hand = [{ value: 5, isJoker: false }];
    players[1]!.hand = [{ value: 6, isJoker: false }];
    players[2]!.hand = [{ value: 7, isJoker: false }];

    expect(isTrickOver(players)).toBe(false);
  });

  it('is true when only one player is still active with cards', () => {
    const players = createPlayers(3);
    players[0]!.hand = [{ value: 5, isJoker: false }];
    players[1]!.hand = [{ value: 6, isJoker: false }];
    players[1]!.isActive = false;
    players[2]!.hand = [{ value: 7, isJoker: false }];
    players[2]!.isActive = false;

    expect(isTrickOver(players)).toBe(true);
  });

  it('is true when no player is active with cards left', () => {
    const players = createPlayers(2);
    players[0]!.isActive = false;
    players[1]!.isActive = false;

    expect(isTrickOver(players)).toBe(true);
  });

  it('does not count a player with an empty hand as still active, even if isActive is true', () => {
    const players = createPlayers(2);
    players[0]!.hand = [{ value: 5, isJoker: false }];
    players[1]!.hand = [];

    expect(isTrickOver(players)).toBe(true);
  });
});

describe('getWinner', () => {
  it('returns the player who played the last move, even with an empty hand', () => {
    const players = createPlayers(3);
    players[0]!.hand = [];
    players[1]!.hand = [];
    players[1]!.isActive = false;
    players[2]!.hand = [];
    players[2]!.isActive = false;
    const trickState = { ...createTrickState(1), lastPlayerId: 1 };

    const winner = getWinner(players, trickState);

    expect(winner?.id).toBe(1);
  });

  it('returns null when no move has been played yet', () => {
    const players = createPlayers(3);
    const trickState = createTrickState(1);

    expect(getWinner(players, trickState)).toBeNull();
  });

  it('returns null when the lastPlayerId does not match any player', () => {
    const players = createPlayers(3);
    const trickState = { ...createTrickState(1), lastPlayerId: 999 };

    expect(getWinner(players, trickState)).toBeNull();
  });
});
