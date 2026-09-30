import Brand from './Brand';
import { useDelayedFlag } from './useDelayedFlag';

interface LoadingScreenProps {
  title: string;
  onCancel?: () => void;
}

// Nach so vielen Millisekunden ohne Verbindung erklären wir die Wartezeit
const SLOW_AFTER_MS = 4_000;

// Drei Karten, die reihum abgehoben und wieder eingeschoben werden
export function ShuffleCards() {
  return (
    <div className="shuffle" aria-hidden="true">
      <span className="card back" />
      <span className="card back" />
      <span className="card back" />
    </div>
  );
}

function LoadingScreen({ title, onCancel }: LoadingScreenProps) {
  const slow = useDelayedFlag(true, SLOW_AFTER_MS);

  return (
    <div className="game lobby">
      <Brand subtitle="Warteraum" />
      <div className="loading" role="status" aria-live="polite">
        <ShuffleCards />
        <p className="loading-title">{title}</p>
        <p className="loading-hint" hidden={!slow}>
          Der Server wacht gerade auf, wenn eine Weile niemand gespielt hat. Das kann bis zu einer halben Minute dauern.
        </p>
      </div>
      {onCancel && (
        <button className="link-button" onClick={onCancel}>Abmelden</button>
      )}
    </div>
  );
}

export default LoadingScreen;
