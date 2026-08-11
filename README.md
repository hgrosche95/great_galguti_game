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
- **`server/`** – ein WebSocket-Server (Node, `ws`), der ein einzelnes, echtes Mehrspieler-Spiel verwaltet (Warteraum, mehrere echte Clients, optional Bots, Verbindungsabbrüche) und dabei die Logik aus `src/` direkt wiederverwendet.
- **`web/`** – die spielbare Web-Oberfläche (React + Vite), die sich per WebSocket mit `server/` verbindet.

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
npm run dev        # tsx src/index.ts, WebSocket-Server auf ws://localhost:8080
npm run typecheck  # tsc --noEmit
npm run build      # esbuild-Bundle nach dist/index.js (fuer Deployment)
```

Verwaltet einen einzigen laufenden Warteraum/Partie: Spieler verbinden sich, können optional Bots hinzufügen und ihren Namen wählen, jemand startet die Partie. Danach validiert der Server jeden Zug über `move()` aus `src/` und schickt jedem Client nur seine eigene Hand plus die Kartenanzahl der anderen (siehe Sichtbarkeitsregel in den Spielregeln). Verbindungsabbrüche mitten im Spiel werden abgefangen (betroffener Spieler wird übersprungen, Bots übernehmen nie unabsichtlich dessen Zug).

### Web-UI (`web/`)

```bash
cd web
npm install
npm run dev     # Dev-Server mit Hot Reload, meist http://localhost:5173
npm run build   # Typprüfung (tsc -b) + Produktions-Build
```

Warteraum (Mitspieler-Anzahl, eigener Name, Bots hinzufügen, Spiel starten) und die eigentliche Partie: eigene Hand (sortiert/gruppiert, spielbare Karten hervorgehoben), Kartenanzahl der Mitspieler, aktueller Stich, Spielende samt Rangliste. Verbindet sich per WebSocket mit `server/` — lokal mit `ws://localhost:8080`, im Produktions-Build automatisch mit der echten Server-Adresse.

## Live-Deployment

- **Web-UI**: https://blue-sea-08b19cb0f.7.azurestaticapps.net (Azure Static Web Apps, Free-Tier). Jeder Push auf `main` deployed automatisch neu (`.github/workflows/azure-static-web-apps.yml`); jeder Pull Request bekommt zusätzlich eine eigene Vorschau-Umgebung.
- **Server**: läuft als Container auf Azure Container Apps (Image via `server/Dockerfile`, gebaut mit esbuild, in der GitHub Container Registry veröffentlicht). Anders als die Web-UI wird der Server aktuell **nicht** automatisch bei jedem Push neu deployed — ein neues Image muss manuell gebaut, gepusht und in Azure aktualisiert werden.

Zusammen ergibt das ein öffentlich erreichbares Online-Spiel — mehrere echte Spieler von unterschiedlichen Orten können gemeinsam eine Partie spielen.

## Mitentwickeln

Der `main`-Branch ist geschützt: Änderungen laufen über einen eigenen Branch + Pull Request, der erst gemerged werden kann, wenn die CI-Pipeline grün ist — Typprüfung + Tests aus `src/` (`test`), Build/Typprüfung von `web/` (`web`) und Typprüfung von `server/` (`server`), siehe `.github/workflows/ci.yml`.

## Geplant

- Automatisches Server-Deployment bei Codeänderungen (aktuell manueller Docker-Build + Push + Azure-Update)
