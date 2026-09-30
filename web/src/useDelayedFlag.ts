import { useEffect, useState } from 'react';

// Wird erst true, wenn `active` länger als `delayMs` am Stück true war.
// Für Hinweise wie "Server startet gerade", die nicht sofort aufblitzen sollen.
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, delayMs]);

  return active && elapsed;
}
