import { describe, it, expect } from 'vitest';
import { createDeck } from './deck';

describe('createDeck', () => {
  it('Deck contains 80 cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(80);
  });
  it('Deck contains 2 jokers', () => {
    const deck = createDeck();
    expect(deck.filter(card => card.isJoker)).toHaveLength(2);
  });
  it('Deck contais each number card from 1 to 12 with the correct amount of cards', () => {
    const deck = createDeck();
    for (let i = 1; i <= 12; i++) {
      const expectedCount = i;
      const actualCount = deck.filter(card => card.value === i && !card.isJoker).length;
      expect(actualCount).toBe(expectedCount);
    }
  });
});