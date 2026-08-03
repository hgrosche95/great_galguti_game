import type { Card } from './cards';

export function createDeck(): Card[] {
    const deck: Card[] = [];
    for (let i = 1; i <= 12; i++) {
        for (let j = 1; j <= i; j++) {
            deck.push({ value: i, isJoker: false });
        }
    }
    deck.push({ value: 13, isJoker: true });
    deck.push({ value: 13, isJoker: true });
    return deck;
}

export function shuffle<T>(array: T[]): T[] {
    const shuffledArray: T[] = [...array];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
    }
    return shuffledArray;
}

export function handOutDeck(deck: Card[], playerCount: number): Card[][] {
    const hands: Card[][] = Array.from({ length: playerCount }, () => []);
    for (let i = 0; i < deck.length; i++) {
        hands[i % playerCount].push(deck[i]);
    }
    return hands;
}