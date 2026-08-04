import { describe, it, expect } from 'vitest';
import { createPlayers, nextActivePlayer } from './players';

describe('createPlayers', () => {
  it('Creates the correct number of players', () => {
    const playerCount = 4;
    const players = createPlayers(playerCount);
    expect(players).toHaveLength(playerCount);
  });
  for (let i = 0; i < 4; i++) {
    it(`Player ${i + 1} has the correct id and name`, () => {
      const players = createPlayers(4);
      expect(players[i]!.id).toBe(i + 1);
      expect(players[i]!.name).toBe(`Player ${i + 1}`);
    });
  }
});

describe('nextActivePlayer', () => {
  it('Returns the next active player', () => {
    let players = createPlayers(4);
    players[0]!.hand = [{ value: 13, isJoker: true }];
    players[1]!.hand = [{ value: 7, isJoker: false }];
    players[3]!.hand = [{ value: 5, isJoker: false }];
    players[1]!.isActive = false;
    players[2]!.isActive = false;
    let nextPlayer = nextActivePlayer(players, 1);
    expect(nextPlayer?.id).toBe(4);
    nextPlayer = nextActivePlayer(players, 4);
    expect(nextPlayer?.id).toBe(1);
  });

  it('Returns null for a non-existent currentPlayerId', () => {
    const players = createPlayers(4);
    const nextPlayer = nextActivePlayer(players, 999);
    expect(nextPlayer).toBeNull();
  });
});