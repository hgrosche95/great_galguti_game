import { describe, it, expect } from 'vitest';
import { createDeck, handOutDeck } from './deck';
import { shuffle } from './general';

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
    const shuffledDeck = shuffle(originalDeck);
    expect(shuffledDeck).toHaveLength(originalDeck.length);
    const sortedOriginalDeck = [...originalDeck].sort((a, b) => a.value - b.value);
    const sortedShuffledDeck = [...shuffledDeck].sort((a, b) => a.value - b.value);
    expect(sortedShuffledDeck).toEqual(sortedOriginalDeck);
  });
  it('Shuffled deck is not in the same order as the original deck', () => {
    const originalDeck = createDeck();
    const shuffledDeck = shuffle(originalDeck);
    expect(shuffledDeck).not.toEqual(originalDeck);
  });
});

describe('handOutDeck', () => {
  it('Hands out the deck evenly among players', () => {
    const deck = createDeck();
    const playerCount = 4;
    const hands = handOutDeck(deck, playerCount);
    expect(hands).toHaveLength(playerCount);
    hands.forEach(hand => {
      expect(hand).toHaveLength(deck.length / playerCount);
    });
    const playerCount2 = 3;
    const hands2 = handOutDeck(deck, playerCount2);
    expect(hands2).toHaveLength(playerCount2);
    expect(hands2[0]).toHaveLength(Math.floor(deck.length / playerCount2)+1);
    expect(hands2[1]).toHaveLength(Math.floor(deck.length / playerCount2)+1);
    expect(hands2[2]).toHaveLength(Math.floor(deck.length / playerCount2));
    const totalCards = hands.reduce((sum, hand) => sum + hand.length, 0);
    expect(totalCards).toBe(deck.length);
  });
}); 