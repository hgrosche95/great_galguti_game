import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { getMoveValue, isValidMove } from '../../src/rules';
import type { Card } from '../../src/cards';
import Brand from './Brand';
import LoadingScreen from './LoadingScreen';
import LoginScreen from './LoginScreen';
import { clearRefreshToken, fetchAccessToken, loadRefreshToken, saveRefreshToken } from './session';
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

function cardLabel(card: Card) {
  return card.isJoker ? 'J' : String(card.value);
}

// Aufgedeckte Karte: Eckindex oben links, großer Wert, Eckindex unten rechts
function CardFace({ card }: { card: Card }) {
  const label = cardLabel(card);
  return (
    <>
      <span className="card-index top">{label}</span>
      <span className="card-value">{label}</span>
      <span className="card-index bottom">{label}</span>
    </>
  );
}

// Kleiner Fächer aus Rückseiten für die Gegner, gedeckelt auf 10 Karten
function CardBacks({ count }: { count: number }) {
  const shown = Math.min(count, 10);
  return (
    <div className="mini-fan" aria-hidden="true">
      {Array.from({ length: shown }).map((_, i) => (
        <span key={i} className="card back" style={{ '--r': `${(i - (shown - 1) / 2) * 6}deg` } as CSSProperties} />
      ))}
    </div>
  );
}

// Neue Karten-Objekte vom Server: die Auswahl auf gleichwertige Karten der neuen Hand übertragen
function keepSelection(selected: Card[], hand: Card[]): Card[] {
  const remaining = [...hand];
  const kept: Card[] = [];
  for (const card of selected) {
    const index = remaining.findIndex(c => c.value === card.value && c.isJoker === card.isJoker);
    if (index === -1) continue;
    kept.push(remaining[index]!);
    remaining.splice(index, 1);
  }
  return kept;
}

// "Bot 2" -> "B2", "Henrik" -> "HE", "Anna Berg" -> "AB"
function initials(name: string) {
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : name.trim().slice(0, 2);
  return letters.toUpperCase() || '?';
}

// Der Server startet eine Partie erst ab 3 Teilnehmern (Menschen und Bots)
const MIN_PLAYERS = 3;

const NARROW_QUERY = '(max-width: 600px)';

// Auf schmalen Bildschirmen wird die Hand in mehrere Fächer umbrochen
function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

function App() {
  const [refreshToken, setRefreshToken] = useState<string | null>(() => loadRefreshToken());
  const [connectionLost, setConnectionLost] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [serverState, setServerState] = useState<ServerState | null>(null);
  const [name, setName] = useState('');
  // Erst wenn der Server die erste Nachricht schickt, steht die Verbindung wirklich
  const [lobbyReady, setLobbyReady] = useState(false);
  // "Spiel starten" gedrückt, aber noch kein Spielstand vom Server da
  const [starting, setStarting] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const narrow = useIsNarrow();

  const sendStart = () => {
    socketRef.current?.send(JSON.stringify({ type: 'start' }));
    setStarting(true);
    // Falls der Server den Start ablehnt, hängt der Button nicht für immer
    clearTimeout(startTimerRef.current);
    startTimerRef.current = setTimeout(() => setStarting(false), 15_000);
  };

  const stopStarting = () => {
    clearTimeout(startTimerRef.current);
    setStarting(false);
  };

  const sendAddBot = () => {
    socketRef.current?.send(JSON.stringify({ type: 'addBot' }));
  };

  const sendSetName = () => {
    socketRef.current?.send(JSON.stringify({ type: 'setName', name }));
  };

  const handleAuthenticated = (token: string) => {
    saveRefreshToken(token);
    setRefreshToken(token);
  };

  const logout = () => {
    clearRefreshToken();
    setRefreshToken(null);
    setServerState(null);
    setLobbyReady(false);
    stopStarting();
  };

  useEffect(() => {
    if (!refreshToken) return;

    let ws: WebSocket | null = null;
    let stopped = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    // Wartezeit wächst bei wiederholten Fehlschlägen: 1 s, 2 s, 4 s ... max. 15 s
    const scheduleReconnect = () => {
      const delay = Math.min(15_000, 1_000 * 2 ** attempt);
      attempt++;
      retryTimer = setTimeout(connect, delay);
    };

    const connect = async () => {
      let accessToken: string | null;
      try {
        // Vor jedem Verbindungsaufbau ein frisches Access-Token (15 min gültig)
        accessToken = await fetchAccessToken(API_URL, refreshToken);
      } catch {
        scheduleReconnect(); // Server nicht erreichbar, z. B. Kaltstart
        return;
      }
      if (stopped) return;
      if (!accessToken) {
        // Sitzung abgelaufen: zurück zum Login
        clearRefreshToken();
        setRefreshToken(null);
        return;
      }

      ws = new WebSocket(WS_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setConnectionLost(false);
        ws?.send(JSON.stringify({ type: 'auth', token: accessToken }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setLobbyReady(true);
        if (data.type === 'waiting') {
          setWaitingCount(data.count);
        } else if (data.type === 'state') {
          setServerState(data);
          setSelectedCards(prev => keepSelection(prev, data.yourHand));
          clearTimeout(startTimerRef.current);
          setStarting(false);
        }
      };

      // Unerwartet getrennt (Netz weg, Server neu gestartet): neu verbinden.
      // Der Server kennt die neue Verbindung als neuen Spieler, deshalb geht
      // es im Warteraum weiter, nicht in der alten Partie.
      ws.onclose = () => {
        if (stopped) return;
        setServerState(null);
        setLobbyReady(false);
        clearTimeout(startTimerRef.current);
        setStarting(false);
        setConnectionLost(true);
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, [refreshToken]);

  const selectCard = (card: Card) => {
    if (selectedCards.includes(card)) {
      setSelectedCards(selectedCards.filter(c => c !== card));
    } else {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const makeMove = (cards: Card[]) => {
    socketRef.current?.send(JSON.stringify({
      type: 'move',
      cards: cards.map(c => ({ value: c.value, isJoker: c.isJoker })),
    }));
    setSelectedCards([]);
  };

  if (!refreshToken) {
    return <LoginScreen apiUrl={API_URL} onAuthenticated={handleAuthenticated} />;
  }

  if (!serverState && !lobbyReady) {
    return (
      <LoadingScreen
        title={connectionLost ? 'Verbindung verloren, verbinde neu …' : 'Verbinde mit dem Tisch …'}
        onCancel={logout}
      />
    );
  }

  if (!serverState) {
    const enoughPlayers = waitingCount >= MIN_PLAYERS;
    return (
      <div className="game lobby">
        <Brand subtitle="Warteraum" />
        <div className="lobby-panel">
          <p className="lobby-count">
            <span className="lobby-count-number">{waitingCount}</span>
            Spieler verbunden
          </p>
          <input
            className="name-input"
            type="text"
            placeholder="Dein Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={sendSetName}
          />
          <div className="waitroom-actions">
            <button className="action-button secondary" onClick={sendAddBot} disabled={starting}>Bot hinzufügen</button>
            <button
              className={`action-button${starting ? ' busy' : ''}`}
              onClick={sendStart}
              disabled={starting || !enoughPlayers}
            >
              {starting ? 'Mische Karten …' : 'Spiel starten'}
            </button>
          </div>
          {!enoughPlayers && (
            <p className="lobby-hint">Ab {MIN_PLAYERS} Spielern geht es los. Bots zählen mit.</p>
          )}
        </div>
        <button className="link-button" onClick={logout}>Abmelden</button>
      </div>
    );
  }

  const others = serverState.players.filter(p => p.id !== serverState.yourId);
  const gameOver = serverState.gameOver;
  const isMyTurn = !gameOver && serverState.currentPlayerId === serverState.yourId;
  const lastMove = serverState.lastMove && serverState.lastMove.length > 0 ? serverState.lastMove : null;

  const maxValue = lastMove ? getMoveValue(lastMove) : null;
  const isPlayable = (card: Card) => card.isJoker || maxValue === null || card.value < maxValue;
  const canPlay = isMyTurn && selectedCards.length > 0 && isValidMove(selectedCards, lastMove);
  const canPass = isMyTurn && lastMove !== null;
  const selectedValue = getMoveValue(selectedCards);
  const playLabel = canPlay
    ? `${selectedCards.length}× ${selectedValue === 13 ? 'Joker' : selectedValue} spielen`
    : selectedCards.length === 0 ? 'Karten wählen' : 'Ungültige Auswahl';

  // Joker haben den Wert 13 und landen dadurch automatisch rechts
  const sortedHand = [...serverState.yourHand].sort((a, b) => a.value - b.value);

  // Ab 17 Karten wird die Hand auf dem Handy in mehrere Fächer umbrochen
  const rowSize = narrow ? 16 : 30;
  const rowCount = Math.ceil(sortedHand.length / rowSize);
  const perRow = Math.ceil(sortedHand.length / Math.max(rowCount, 1));
  const handRows: Card[][] = [];
  for (let i = 0; i < sortedHand.length; i += perRow) {
    handRows.push(sortedHand.slice(i, i + perRow));
  }

  // Bei drei und mehr Gegnern sitzt der erste links, der letzte rechts, der Rest oben
  const seatOf = (index: number) => {
    if (others.length < 3) return 'top';
    if (index === 0) return 'left';
    if (index === others.length - 1) return 'right';
    return 'top';
  };

  const nameOf = (id: number) =>
    id === serverState.yourId ? 'Du' : (serverState.players.find(p => p.id === id)?.name ?? '?');

  const statusText = gameOver
    ? 'Spiel vorbei'
    : isMyTurn
      ? 'Du bist dran'
      : `${nameOf(serverState.currentPlayerId)} ist am Zug`;

  const renderSeat = (player: ServerPlayer) => {
    const finished = player.cardCount === 0;
    const passed = !finished && !player.isActive;
    const isTurn = !gameOver && serverState.currentPlayerId === player.id;
    return (
      <div key={player.id} className={`seat${isTurn ? ' turn' : ''}${passed || finished ? ' idle' : ''}`}>
        <div className="avatar">{initials(player.name)}</div>
        <div className="seat-name">{player.name}</div>
        <CardBacks count={player.cardCount} />
        <div className="seat-count">{player.cardCount} {player.cardCount === 1 ? 'Karte' : 'Karten'}</div>
        {finished && <span className="chip done">fertig</span>}
        {passed && <span className="chip">passt</span>}
        {isTurn && <span className="chip live">am Zug</span>}
      </div>
    );
  };

  const seatGroups = { top: [] as ServerPlayer[], left: [] as ServerPlayer[], right: [] as ServerPlayer[] };
  others.forEach((player, i) => seatGroups[seatOf(i)].push(player));

  // Leichte, feste Streuung für die Karten auf dem Tisch
  const pileTilt = (i: number, count: number) => {
    const t = count > 1 ? i / (count - 1) - 0.5 : 0;
    return {
      '--x': `${t * Math.min(count * 30, 140)}px`,
      '--y': `${(i % 2 === 0 ? 1 : -1) * 4}px`,
      '--r': `${t * 20 + (i % 2 === 0 ? -2 : 2)}deg`,
    } as CSSProperties;
  };

  return (
    <div className="game in-game">
      <header className="hud">
        <Brand />
        <div className="hud-meta">
          <div>Am Zug<b>{gameOver ? '–' : nameOf(serverState.currentPlayerId)}</b></div>
          <div>Deine Karten<b>{serverState.yourHand.length}</b></div>
        </div>
      </header>

      <div className={`seats-top${seatGroups.top.length > 2 ? ' crowded' : ''}`}>{seatGroups.top.map(renderSeat)}</div>
      <div className="seats-left">{seatGroups.left.map(renderSeat)}</div>
      <div className="seats-right">{seatGroups.right.map(renderSeat)}</div>

      <div className="table">
        <div className="table-status">{statusText}</div>
        {gameOver ? (
          <>
            <ol className="ranking">
              {serverState.ranking.map(id => (
                <li key={id} className={id === serverState.yourId ? 'me' : undefined}>{nameOf(id)}</li>
              ))}
            </ol>
            <button className={`action-button${starting ? ' busy' : ''}`} onClick={sendStart} disabled={starting}>
              {starting ? 'Mische Karten …' : 'Nochmal spielen'}
            </button>
          </>
        ) : lastMove ? (
          <>
            <div className="pile">
              {lastMove.map((card, i) => (
                <div key={i} className={`card${card.isJoker ? ' joker' : ''}`} style={pileTilt(i, lastMove.length)}>
                  <CardFace card={card} />
                </div>
              ))}
            </div>
            <div className="table-hint">
              Zu schlagen: <b>{lastMove.length} {lastMove.length === 1 ? 'Karte' : 'Karten'}</b> mit Wert <b>unter {maxValue}</b>
            </div>
          </>
        ) : (
          <div className="table-hint">Freie Eröffnung: beliebig viele gleiche Karten</div>
        )}
      </div>

      <div className="hand-area">
        {handRows.map((row, ri) => (
          <div className="hand" key={ri} style={{ '--n': row.length } as CSSProperties}>
            {row.map((card, i) => {
              const t = row.length > 1 ? (i - (row.length - 1) / 2) / ((row.length - 1) / 2) : 0;
              const selected = selectedCards.includes(card);
              const playable = isPlayable(card);
              return (
                <button
                  key={i}
                  className={`card${card.isJoker ? ' joker' : ''}${playable ? ' playable' : ''}${selected ? ' selected' : ''}`}
                  style={{
                    '--r': `${(t * (narrow ? 8 : 14)).toFixed(2)}deg`,
                    '--y': `${(t * t * (narrow ? 8 : 18)).toFixed(1)}px`,
                  } as CSSProperties}
                  onClick={() => selectCard(card)}
                  disabled={!playable && !selected}
                  aria-pressed={selected}
                  aria-label={card.isJoker ? 'Joker' : `Karte ${card.value}`}
                >
                  <CardFace card={card} />
                </button>
              );
            })}
          </div>
        ))}

        {isMyTurn && (
          <div className="actions">
            <button className="action-button secondary" onClick={() => makeMove([])} disabled={!canPass}>
              Passen
            </button>
            <button className="action-button" onClick={() => makeMove(selectedCards)} disabled={!canPlay}>
              {playLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
