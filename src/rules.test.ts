import { describe, it, expect } from 'vitest';
import { getMoveValue, isValidMove } from './rules';

describe('getMoveValue', () => {
  it('returns null for an empty array', () => {
    expect(getMoveValue([])).toBeNull();
  });
  it('returns the value of the reference card when all cards have the same value', () => {
    const cards = [
      { value: 5, isJoker: false },
      { value: 5, isJoker: false },
    ];
    expect(getMoveValue(cards)).toBe(5);
  });
  it('returns null when not all cards have the same value', () => {
    const cards = [
      { value: 5, isJoker: false },
      { value: 6, isJoker: false },
    ];
    expect(getMoveValue(cards)).toBeNull();
  });
  it('returns the reference value when jokers are present', () => {
    const cards = [
      { value: 5, isJoker: false },
      { value: 13, isJoker: true },
    ];
    expect(getMoveValue(cards)).toBe(5);
  });
  it('returns 13 when all cards are jokers', () => {
    const cards = [
      { value: 13, isJoker: true },
      { value: 13, isJoker: true },
    ];
    expect(getMoveValue(cards)).toBe(13);
  });
});

describe('isValidMove', () => {
  it('accepts a valid move when there is no previous move', () => {
    const move = [
      { value: 7, isJoker: false },
      { value: 7, isJoker: false },
    ];
    expect(isValidMove(move, null)).toBe(true);
  });

  it('rejects an invalid move when there is no previous move', () => {
    const move = [
      { value: 5, isJoker: false },
      { value: 6, isJoker: false },
    ];
    expect(isValidMove(move, null)).toBe(false);
  });

  it('rejects an empty move when there is no previous move', () => {
    expect(isValidMove([], null)).toBe(false);
  });

  it('accepts a move with the same count and a lower value than the previous move', () => {
    const previousMove = [
      { value: 10, isJoker: false },
      { value: 10, isJoker: false },
    ];
    const move = [
      { value: 5, isJoker: false },
      { value: 5, isJoker: false },
    ];
    expect(isValidMove(move, previousMove)).toBe(true);
  });

  it('accepts a move using a joker to reach the same count with a lower value', () => {
    const previousMove = [
      { value: 10, isJoker: false },
      { value: 10, isJoker: false },
    ];
    const move = [
      { value: 5, isJoker: false },
      { value: 13, isJoker: true },
    ];
    expect(isValidMove(move, previousMove)).toBe(true);
  });

  it('rejects a move with a higher value than the previous move', () => {
    const previousMove = [
      { value: 5, isJoker: false },
      { value: 5, isJoker: false },
    ];
    const move = [
      { value: 10, isJoker: false },
      { value: 10, isJoker: false },
    ];
    expect(isValidMove(move, previousMove)).toBe(false);
  });

  it('rejects a move with the same value as the previous move', () => {
    const previousMove = [
      { value: 5, isJoker: false },
      { value: 5, isJoker: false },
    ];
    const move = [
      { value: 5, isJoker: false },
      { value: 5, isJoker: false },
    ];
    expect(isValidMove(move, previousMove)).toBe(false);
  });

  it('rejects a move with a different card count than the previous move', () => {
    const previousMove = [
      { value: 10, isJoker: false },
      { value: 10, isJoker: false },
      { value: 10, isJoker: false },
    ];
    const move = [
      { value: 5, isJoker: false },
    ];
    expect(isValidMove(move, previousMove)).toBe(false);
  });

  it('rejects an internally invalid move even if its count matches', () => {
    const previousMove = [
      { value: 10, isJoker: false },
      { value: 10, isJoker: false },
    ];
    const move = [
      { value: 5, isJoker: false },
      { value: 6, isJoker: false },
    ];
    expect(isValidMove(move, previousMove)).toBe(false);
  });
});