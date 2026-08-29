import { useState, useEffect, useRef } from 'react';
import { getMoveValue } from '../../src/rules';
import type { Card } from '../../src/cards';
import LoginScreen from './LoginScreen';
import './App.css';

const SERVER_HOST = import.meta.env.DEV
  ? 'localhost:8080'
  : 'great-galguti-server.redisland-e7c19e60.germanywestcentral.azurecontainerapps.io';
const WS_URL = `${import.meta.env.DEV ? 'ws' : 'wss'}://${SERVER_HOST}`;
const API_URL = `${import.meta.env.DEV ? 'http' : 'https'}://${SERVER_HOST}`;

interface ServerPlayer {
  id: number;
  name: string;
  cardCount: number;
  isActive: boolean;
}

interface ServerState {
  type: 'state';
  yourId: number;
  currentPlayerId: number;
  lastMove: Card[] | null;
  yourHand: Card[];
  gameOver: boolean;
  ranking: number[];
  players: ServerPlayer[];
}

function CardFace({ card }: { card: Card }) {
  return <>{card.isJoker ? 'J' : card.value}</>;
}

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [serverState, setServerState] = useState<ServerState | null>(null);
  const [name, setName] = useState('');

  const socketRef = useRef<WebSocket | null>(null);

  const sendStart = () => {
    socketRef.current?.send(JSON.stringify({ type: 'start' }));
  };

  const sendAddBot = () => {
    socketRef.current?.send(JSON.stringify({ type: 'addBot' }));
  };

  const sendSetName = () => {
    socketRef.current?.send(JSON.stringify({ type: 'setName', name }));
  };

  useEffect(() => {
    if (!accessToken) return;

    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token: accessToken }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'waiting') {
        setWaitingCount(data.count);
      } else if (data.type === 'state') {
        setServerState(data);
      }
    };

    return () => {
      ws.close();
    };
  }, [accessToken]);

  const selectCard = (card: Card) => {
    if (selectedCards.includes(card)) {
      setSelectedCards(selectedCards.filter(c => c !== card));
    } else {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const makeMove = (cards: Card[]) => () => {
    socketRef.current?.send(JSON.stringify({
      type: 'move',
      cards: cards.map(c => ({ value: c.value, isJoker: c.isJoker })),
    }));
    setSelectedCards([]);
  };

  if (!accessToken) {
    return <LoginScreen apiUrl={API_URL} onAuthenticated={setAccessToken} />;
  }

  if (!serverState) {
    return (
      <div className="game">
        <p>Warte auf Mitspieler: {waitingCount} verbunden</p>
        <input
          type="text"
          placeholder="Dein Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={sendSetName}
        />
        <button onClick={sendAddBot}>Bot hinzufügen</button>
        <button onClick={sendStart}>Spiel starten</button>
      </div>
    );
  }

  const others = serverState.players.filter(p => p.id !== serverState.yourId);
  const gameOver = serverState.gameOver;

  const maxValue = serverState.lastMove ? getMoveValue(serverState.lastMove) : null;
  const isPlayable = (card: Card) => card.isJoker || maxValue === null || card.value < maxValue;

  const visibleHand = [...serverState.yourHand]
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
    serverState.currentPlayerId === serverState.yourId
      ? 'Du'
      : (serverState.players.find(p => p.id === serverState.currentPlayerId)?.name ?? '?');

  return (
    <div className="game">
      <div className="opponents">
        {others.map(player => (
          <div
            key={player.id}
            className={`opponent${serverState.currentPlayerId === player.id ? ' active' : ''}`}
          >
            <div className="opponent-name">{player.name}</div>
            <div className="card-stack">
              {Array.from({ length: player.cardCount }).map((_, i) => (
                <div key={i} className="card back" />
              ))}
            </div>
            <div className="opponent-count">{player.cardCount} Karten</div>
          </div>
        ))}
      </div>

      <div className="table">
        <div className="table-status">
          {gameOver ? 'Spiel vorbei' : `${currentPlayerName} ${serverState.currentPlayerId === serverState.yourId ? 'bist dran' : 'ist am Zug'}`}
        </div>
        {gameOver ? (
          <ol className="ranking">
            {serverState.ranking.map(id => (
              <li key={id}>
                {id === serverState.yourId ? 'Du' : serverState.players.find(p => p.id === id)?.name}
              </li>
            ))}
          </ol>
        ) : (
          <div className="played-cards">
            {serverState.lastMove && serverState.lastMove.length > 0 ? (
              serverState.lastMove.map((card, i) => (
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
          hidden={serverState.currentPlayerId !== serverState.yourId}
        >
          {selectedCards.length === 0 ? 'Passen' : 'Spielen'}
        </button>
      </div>
    </div>
  );
}

export default App;
