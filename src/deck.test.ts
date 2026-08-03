import { describe, it, expect } from 'vitest';
import { createDeck, shuffleDeck } from './deck';

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

describe('shuffleDeck', () => {
  it('Shuffled deck contains the same cards as the original deck', () => {
    const originalDeck = createDeck();
    const shuffledDeck = shuffleDeck(originalDeck);
    expect(shuffledDeck).toHaveLength(originalDeck.length);
    const sortedOriginalDeck = [...originalDeck].sort((a, b) => a.value - b.value);
    const sortedShuffledDeck = [...shuffledDeck].sort((a, b) => a.value - b.value);
    expect(sortedShuffledDeck).toEqual(sortedOriginalDeck);
  });
  it('Shuffled deck is not in the same order as the original deck', () => {
    const originalDeck = createDeck();
    const shuffledDeck = shuffleDeck(originalDeck);
    expect(shuffledDeck).not.toEqual(originalDeck);
  });
});