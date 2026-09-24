// Das Refresh-Token (7 Tage gültig) ist die eigentliche Sitzung: daraus holt
// sich der Client vor jedem Verbindungsaufbau ein frisches Access-Token
// (15 Minuten gültig). So bleibt man nach einem Neuladen eingeloggt, und ein
// Reconnect scheitert nicht an einem abgelaufenen Access-Token.
const REFRESH_TOKEN_KEY = 'galguti.refreshToken';

// localStorage kann in privaten Fenstern oder bei gesperrtem Speicher werfen,
// dann gibt es eben keine gespeicherte Sitzung.
export function loadRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveRefreshToken(token: string) {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {
    // Sitzung gilt dann nur bis zum Neuladen
  }
}

export function clearRefreshToken() {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // nichts zu tun
  }
}

// null = Sitzung ungültig (abgelaufen oder Nutzer gelöscht), neu anmelden.
// Wirft bei Netzwerkfehlern (z. B. Server startet gerade nach Scale-to-Zero),
// damit der Aufrufer es später erneut versuchen kann.
export async function fetchAccessToken(apiUrl: string, refreshToken: string): Promise<string | null> {
  const res = await fetch(`${apiUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (res.status === 400 || res.status === 401) return null;
  if (!res.ok) throw new Error(`Refresh fehlgeschlagen: HTTP ${res.status}`);
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
}
