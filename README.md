# Great Galguti Game

Ein rundenbasiertes Kartenspiel nach Stichspiel-Logik für 3–8 Spieler, geschrieben in TypeScript. Die vollständigen Spielregeln stehen in [game-logic.md](./game-logic.md).

## Kurzfassung der Regeln

- Zahlenkarten 1–12 (jede so oft wie ihr Wert) plus 2 Joker (Wert 13).
- Jeder Spieler bekommt reihum verdeckt Karten, bis das Deck leer ist.
- In Stichrunden spielt reihum jeder Spieler entweder eine gleich große Kombination mit niedrigerem Wert als der vorherige Zug (Joker füllen als Platzhalter auf), oder passt.
- Wer zuletzt gelegt hat, wenn alle anderen gepasst haben, gewinnt die Stichrunde und eröffnet die nächste.
- Wer zuerst keine Karten mehr hat, gewinnt; gespielt wird weiter, bis nur noch ein Spieler Karten hält.

## Projektstruktur

Das Projekt besteht aus drei eigenständigen npm-Projekten:

- **`src/`** – die Kern-Spiellogik (Karten, Deck, Spieler, Regeln, Stichrunden, ein einfacher Bot), reines TypeScript/Node, getestet mit Vitest.
- **`server/`** – ein HTTP-/WebSocket-Server (Node, Express, `ws`), der Nutzerkonten mit JWT-Authentifizierung (siehe [Authentifizierung](#authentifizierung)) und ein einzelnes, echtes Mehrspieler-Spiel verwaltet (Warteraum, mehrere echte Clients, optional Bots, Verbindungsabbrüche) und dabei die Logik aus `src/` direkt wiederverwendet.
- **`web/`** – die spielbare Web-Oberfläche (React + Vite), mit Login/Registrierung und Verbindung per WebSocket zu `server/`.

### Kernlogik (`src/`)

```bash
npm install
npm test           # Tests einmalig/im Watch-Modus mit Vitest ausführen
npm run typecheck  # TypeScript-Typprüfung ohne Ausgabe (tsc --noEmit)
```

Implementiert:

- `cards.ts` – `Card`-Typ
- `deck.ts` – Deck erzeugen (`createDeck`) und an Spieler verteilen (`handOutDeck`)
- `general.ts` – generischer Fisher-Yates-Shuffle (`shuffle`)
- `players.ts` – `Player`-Typ, Spieler erzeugen (`createPlayers`), nächsten aktiven Spieler ermitteln (`nextActivePlayer`)
- `rules.ts` – Wert eines Kartenzugs bestimmen (`getMoveValue`), Zug-Gültigkeit prüfen (`isValidMove`)
- `trick.ts` – Stichrunden-Zustand (`TrickState`), Zug/Pass verarbeiten (`move`), Rundenende (`isTrickOver`) und Rundengewinner (`getWinner`) ermitteln, neue Runde starten (`startNewTrick`), einfache Bot-Zugauswahl (`chooseMove`), komplette Partie orchestrieren (`game`)

Alle Module sind mit Vitest-Tests abgedeckt.

### Server (`server/`)

```bash
cd server
npm install
npm run dev        # tsx src/index.ts, HTTP-/WebSocket-Server auf http://localhost:8080
npm test           # Unit- und E2E-Tests mit Vitest ausführen
npm run typecheck  # tsc --noEmit
npm run build      # esbuild-Bundle nach dist/index.js (fuer Deployment)
```

Verwaltet Nutzerkonten (Registrierung/Login, siehe [Authentifizierung](#authentifizierung)) sowie einen einzigen laufenden Warteraum/Partie: Spieler verbinden sich per WebSocket mit gültigem Access-Token, können optional Bots hinzufügen und ihren Namen wählen, jemand startet die Partie. Danach validiert der Server jeden Zug über `move()` aus `src/` und schickt jedem Client nur seine eigene Hand plus die Kartenanzahl der anderen (siehe Sichtbarkeitsregel in den Spielregeln). Verbindungsabbrüche mitten im Spiel werden abgefangen (betroffener Spieler wird übersprungen, Bots übernehmen nie unabsichtlich dessen Zug).

### Web-UI (`web/`)

```bash
cd web
npm install
npm run dev     # Dev-Server mit Hot Reload, meist http://localhost:5173
npm run build   # Typprüfung (tsc -b) + Produktions-Build
```

Vor dem Warteraum steht ein Login/Registrieren-Formular; erst mit dem dabei erhaltenen Access-Token baut der Client die WebSocket-Verbindung zu `server/` auf. Danach: Warteraum (Mitspieler-Anzahl, eigener Name, Bots hinzufügen, Spiel starten) und die eigentliche Partie: eigene Hand (sortiert/gruppiert, spielbare Karten hervorgehoben), Kartenanzahl der Mitspieler, aktueller Stich, Spielende samt Rangliste. Verbindet sich lokal mit `http(s)://localhost:8080`, im Produktions-Build automatisch mit der echten Server-Adresse.

## Authentifizierung

Der Server verwaltet Nutzerkonten mit JWT-Authentifizierung (aktuell In-Memory, siehe [Geplant](#geplant)):

| Endpoint             | Methode | Body                                | Antwort                                              |
| --------------------- | ------- | ------------------------------------ | ----------------------------------------------------- |
| `/auth/register`      | POST    | `{ username, email, password }`      | `201` mit `{ id, username, email, accessToken, refreshToken }` |
| `/auth/login`         | POST    | `{ email, password }`                | `200` mit `{ id, username, email, accessToken, refreshToken }` |
| `/auth/refresh`       | POST    | `{ refreshToken }`                   | `200` mit `{ accessToken }`                            |
| `/auth/me`            | GET     | – (Header `Authorization: Bearer <accessToken>`) | `200` mit `{ id, username }`             |

Passwörter werden nie im Klartext gespeichert (Hashing mit `bcryptjs`). Das **Access-Token** ist 15 Minuten gültig und wird bei jeder geschützten Anfrage mitgeschickt; das **Refresh-Token** ist 7 Tage gültig und wird ausschließlich benutzt, um über `/auth/refresh` ein neues Access-Token zu bekommen, ohne dass sich der Nutzer erneut einloggen muss. Beide Tokens sind mit unterschiedlichen Server-Secrets signiert und dadurch nicht gegeneinander austauschbar.

**WebSocket-Beitritt:** Da der Browser beim WebSocket-Verbindungsaufbau keine eigenen Header erlaubt, läuft die Authentifizierung über die erste Nachricht im bestehenden Nachrichtenprotokoll: der Client muss direkt nach dem Verbinden `{ "type": "auth", "token": "<accessToken>" }` senden. Ohne gültiges Token (oder ganz ohne Nachricht innerhalb von 5 Sekunden) trennt der Server die Verbindung, bevor der Client als Spieler aufgenommen wird.

In Produktion müssen `JWT_ACCESS_SECRET` und `JWT_REFRESH_SECRET` als Umgebungsvariablen gesetzt werden (z. B. als Azure Container App-Secrets) — ohne sie greifen bewusst leicht als unsicher erkennbare Entwicklungs-Fallbacks aus `server/src/auth/jwt.ts`.

## Live-Deployment

- **Web-UI**: https://blue-sea-08b19cb0f.7.azurestaticapps.net (Azure Static Web Apps, Free-Tier). Jeder Push auf `main` deployed automatisch neu (`.github/workflows/azure-static-web-apps.yml`); jeder Pull Request bekommt zusätzlich eine eigene Vorschau-Umgebung.
- **Server**: läuft als Container auf Azure Container Apps (Image via `server/Dockerfile`, gebaut mit esbuild, in der GitHub Container Registry veröffentlicht). Jeder Push auf `main` mit Änderungen in `server/` oder `src/` baut automatisch ein neues Image und deployed es (`.github/workflows/azure-container-apps.yml`) — dafür müssen einmalig die Secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` und `AZURE_SUBSCRIPTION_ID` im Repo hinterlegt sein (OIDC/Federated Credentials, kein Passwort im Klartext).

Zusammen ergibt das ein öffentlich erreichbares Online-Spiel — mehrere echte Spieler von unterschiedlichen Orten können gemeinsam eine Partie spielen.

## Mitentwickeln

Der `main`-Branch ist geschützt: Änderungen laufen über einen eigenen Branch + Pull Request, der erst gemerged werden kann, wenn die CI-Pipeline grün ist — Typprüfung + Tests aus `src/` (`test`), Build/Typprüfung von `web/` (`web`) und Typprüfung + Tests von `server/` (`server`), siehe `.github/workflows/ci.yml`.

## Geplant

- Echte Persistenz für Nutzerkonten (aktuell In-Memory, geht bei jedem Server-Neustart verloren) und eine Sperrliste für Refresh-Tokens (aktuell zustandslos, kein echtes Logout/Revoke)
- Weitere Schritte Richtung Microservices: eigener Lobby-Service (Go), GraphQL-Gateway, RabbitMQ, Kubernetes-Deployment
