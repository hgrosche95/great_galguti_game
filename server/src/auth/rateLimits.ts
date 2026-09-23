import { rateLimit } from 'express-rate-limit';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Gemeinsame Einstellungen: Limit-Infos als standardisierte RateLimit-Header
// statt der alten X-RateLimit-*-Header, Fehlermeldung im selben Format wie die
// restlichen Auth-Fehler ({ error }), damit der Client sie direkt anzeigen kann.
function limiter(windowMs: number, limit: number, error: string, skipSuccessfulRequests = false) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error },
  });
}

// Nur Fehlversuche zaehlen (Status >= 400): bremst Passwort-Raten, aber nie
// jemanden, der sich korrekt einloggt.
export const loginLimiter = limiter(
  15 * MINUTE,
  10,
  'Zu viele fehlgeschlagene Login-Versuche. Bitte in 15 Minuten erneut versuchen.',
  true,
);

// Jede Registrierung legt einen DB-Eintrag an und berechnet einen bcrypt-Hash.
export const registerLimiter = limiter(
  HOUR,
  5,
  'Zu viele Registrierungen von dieser Adresse. Bitte später erneut versuchen.',
);

// Grosszuegiger als Register: Gaeste laden oefter neu, und mehrere Leute
// koennen sich eine IP teilen (WG, Familie).
export const guestLimiter = limiter(
  HOUR,
  20,
  'Zu viele Gastzugänge von dieser Adresse. Bitte später erneut versuchen.',
);
