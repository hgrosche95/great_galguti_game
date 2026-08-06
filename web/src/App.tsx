import { createDeck, handOutDeck } from '../../src/deck';
import { createPlayers } from '../../src/players';
import { useState, useEffect } from 'react';
import { shuffle } from '../../src/general';
import { createTrickState, move, chooseMove, isTrickOver, startNewTrick } from '../../src/trick';
import { getMoveValue } from '../../src/rules';
import type { Card } from '../../src/cards';
import './App.css';

const YOUR_ID = 1;

function CardFace({ card }: { card: Card }) {
  return <>{card.isJoker ? 'J' : card.value}</>;
}

function App() {
  const [players, setPlayers] = useState(() => {
    const deck = shuffle(createDeck());
    const initialPlayers = createPlayers(4);
    const hands = handOutDeck(deck, initialPlayers.length);
    initialPlayers.forEach((player, i) => {
      player.hand = hands[i]!;
    });
    return initialPlayers;
  });

  const [trickState, setTrickState] = useState(() => createTrickState(players[0]!.id));

  const [selectedCards, setSelectedCards] = useState<Card[]>([]);

  const [finishOrder, setFinishOrder] = useState<number[]>([]);

  const recordFinishers = (currentPlayers: typeof players) => {
    const newlyFinished = currentPlayers
      .filter(p => p.hand.length === 0 && !finishOrder.includes(p.id))
      .map(p => p.id);

    if (newlyFinished.length > 0) {
      setFinishOrder(prev => [...prev, ...newlyFinished]);
    }
  };

  const selectCard = (card: Card) => {
    if (selectedCards.includes(card)) {
      setSelectedCards(selectedCards.filter(c => c !== card));
    } else {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const makeMove = (cards: Card[]) => () => {
    const newTrickState = move(players, YOUR_ID, cards, trickState);
    if (newTrickState) {
      setTrickState(newTrickState);
      setSelectedCards([]);
      setPlayers([...players]);
      recordFinishers(players);
    } else {
      alert('Invalid move');
    }
  };

  useEffect(() => {
    if (trickState.currentPlayerId === YOUR_ID || players.filter(player => player.hand.length > 0).length <= 1) {
      return;
    }

    const timer = setTimeout(() => {
      const player = players.find(p => p.id === trickState.currentPlayerId);
      if (!player) {
        return;
      }

      const result = move(players, player.id, chooseMove(player, trickState.lastMove), trickState);

      if (result !== false) {
        if (isTrickOver(players)) {
          setTrickState(startNewTrick(players, result));
        } else {
          setTrickState(result);
        }
        setPlayers([...players]);
        recordFinishers(players);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [trickState, players]);

  const me = players.find(p => p.id === YOUR_ID)!;
  const others = players.filter(p => p.id !== YOUR_ID);
  const gameOver = players.filter(player => player.hand.length > 0).length <= 1;
  const ranking = gameOver
    ? [...finishOrder, ...players.filter(p => !finishOrder.includes(p.id)).map(p => p.id)]
    : [];

  const maxValue = trickState.lastMove ? getMoveValue(trickState.lastMove) : null;
  const isPlayable = (card: Card) => card.isJoker || maxValue === null || card.value < maxValue;

  const visibleHand = [...me.hand]
    .filter(card => !selectedCards.includes(card))
    .sort((a, b) => a.value - b.value);

  const handGroups: Card[][] = [];
  for (const card of visibleHand) {
    const lastGroup = handGroups[handGroups.length - 1];
    if (lastGroup && lastGroup[0]!.value === card.value) {
      lastGroup.push(card);
    } else {
      handGroups.push([card]);
    }
  }

  const currentPlayerName =
    trickState.currentPlayerId === YOUR_ID
      ? 'Du'
      : (players.find(p => p.id === trickState.currentPlayerId)?.name ?? '?');

  return (
    <div className="game">
      <div className="opponents">
        {others.map(player => (
          <div
            key={player.id}
            className={`opponent${trickState.currentPlayerId === player.id ? ' active' : ''}`}
          >
            <div className="opponent-name">{player.name}</div>
            <div className="card-stack">
              {player.hand.map((_, i) => (
                <div key={i} className="card back" />
              ))}
            </div>
            <div className="opponent-count">{player.hand.length} Karten</div>
          </div>
        ))}
      </div>

      <div className="table">
        <div className="table-status">
          {gameOver ? 'Spiel vorbei' : `${currentPlayerName} ${trickState.currentPlayerId === YOUR_ID ? 'bist dran' : 'ist am Zug'}`}
        </div>
        {gameOver ? (
          <ol className="ranking">
            {ranking.map(id => (
              <li key={id}>{id === YOUR_ID ? 'Du' : players.find(p => p.id === id)?.name}</li>
            ))}
          </ol>
        ) : (
        <div className="played-cards">
          {trickState.lastMove && trickState.lastMove.length > 0 ? (
            trickState.lastMove.map((card, i) => (
              <div key={i} className={`card${card.isJoker ? ' joker' : ''}`}>
                <CardFace card={card} />
              </div>
            ))
          ) : (
            <div className="table-hint">Noch nichts gelegt</div>
          )}
        </div>
        )}
      </div>

      <div className="hand-area">
        <div className="selected-cards">
          {selectedCards.map((card, i) => (
            <button
              key={i}
              className={`card selected${card.isJoker ? ' joker' : ''}`}
              onClick={() => selectCard(card)}
            >
              <CardFace card={card} />
            </button>
          ))}
        </div>

        <div className="hand">
          {handGroups.map((group, gi) => (
            <div className="card-group" key={gi}>
              <div className="card-row">
                {group.map((card, i) => (
                  <button
                    key={i}
                    className={`card${card.isJoker ? ' joker' : ''}${isPlayable(card) ? ' playable' : ''}`}
                    onClick={() => selectCard(card)}
                    disabled={!isPlayable(card)}
                  >
                    <CardFace card={card} />
                  </button>
                ))}
              </div>
              {group.length > 1 && <div className="card-group-count">×{group.length}</div>}
            </div>
          ))}
        </div>

        <button
          className="action-button"
          onClick={makeMove(selectedCards)}
          hidden={trickState.currentPlayerId !== YOUR_ID}
        >
          {selectedCards.length === 0 ? 'Passen' : 'Spielen'}
        </button>
      </div>
    </div>
  );
}

export default App;
