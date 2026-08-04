import type { Card } from './cards';

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  isActive: boolean;
}

export function createPlayers(playerCount: number): Player[] {
  const players: Player[] = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({
      id: i + 1,
      name: `Player ${i + 1}`,
      hand: [],
      isActive: true,
    });
  }
  return players;
}

export function nextActivePlayer(players: Player[], currentPlayerId: number): Player | null {
  const currentIndex = players.findIndex(player => player.id === currentPlayerId);
    if (currentIndex === -1) {
        return null; // Current player not found
    }

    const playerCount = players.length; 
    for (let i = 1; i <= playerCount; i++) {
        const nextIndex = (currentIndex + i) % playerCount;
        const candidate = players[nextIndex]!;
        if (candidate.isActive && candidate.hand.length > 0) {
            if (candidate.id === currentPlayerId) {
                return null; // No other active players found
            }
            return candidate;
        }
    }
    return null; // No active players found
}