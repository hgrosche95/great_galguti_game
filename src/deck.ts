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