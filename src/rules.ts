import type { Card } from './cards';

export function getMoveValue(cards: Card[]): number | null {
    if (cards.length === 0) {
        return null; // No cards played
    }

    const referenceCard = cards.find(card => !card.isJoker);
    const referenceValue = referenceCard ? referenceCard.value : 13;

    for (const card of cards) {
        if (!card.isJoker && card.value !== referenceValue) {
            return null; // Not all cards have the same value
        }
    }
    return referenceValue;
}

export function isValidMove(move: Card[], previousMove: Card[] | null): boolean {
    if (previousMove === null) {
        return getMoveValue(move) !== null;
    }
    const moveValue = getMoveValue(move);
    const previousMoveValue = getMoveValue(previousMove);
    if(moveValue != null && previousMoveValue != null) {
        if(moveValue < previousMoveValue &&  move.length === previousMove.length) {
        return true; // Placeholder return value
        }
    }
    return false;
}