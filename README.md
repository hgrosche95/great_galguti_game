# Great Galguti Game

Ein rundenbasiertes Kartenspiel nach Stichspiel-Logik für 3–8 Spieler, geschrieben in TypeScript. Die vollständigen Spielregeln stehen in [game-logic.md](./game-logic.md).

## Kurzfassung der Regeln

- Zahlenkarten 1–12 (jede so oft wie ihr Wert) plus 2 Joker (Wert 13).
- Jeder Spieler bekommt reihum verdeckt Karten, bis das Deck leer ist.
- In Stichrunden spielt reihum jeder Spieler entweder eine gleich große Kombination mit niedrigerem Wert als der vorherige Zug (Joker füllen als Platzhalter auf), oder passt.
- Wer zuletzt gelegt hat, wenn alle anderen gepasst haben, gewinnt die Stichrunde und eröffnet die nächste.
- Wer zuerst keine Karten mehr hat, gewinnt; gespielt wird weiter, bis nur noch ein Spieler Karten hält.

## Projektstruktur

Das Projekt besteht aus zwei eigenständigen npm-Projekten:

- **`src/`** – die Kern-Spiellogik (Karten, Deck, Spieler, Regeln, Stichrunden, ein einfacher Bot), reines TypeScript/Node, getestet mit Vitest.
- **`web/`** – eine spielbare Web-Oberfläche (React + Vite), die die Logik aus `src/` direkt einbindet (per relativem Import), gegen 3 einfache Bots im Browser.

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

### Web-UI (`web/`)

```bash
cd web
npm install
npm run dev     # Dev-Server mit Hot Reload, meist http://localhost:5173
npm run build   # Typprüfung (tsc -b) + Produktions-Build
```

Zeigt deine eigene Hand (nach Wert sortiert und gruppiert, spielbare Karten hervorgehoben), die Kartenanzahl der Mitspieler, den aktuellen Stich, das Spielende samt Rangliste und lässt dich gegen 3 automatisch spielende Bots antreten.

## Live-Deployment

Die Web-UI ist unter **https://blue-sea-08b19cb0f.7.azurestaticapps.net** erreichbar (Azure Static Web Apps, Free-Tier). Jeder Push auf `main` deployed automatisch neu (siehe `.github/workflows/azure-static-web-apps.yml`); jeder Pull Request bekommt zusätzlich eine eigene Vorschau-Umgebung.

## Mitentwickeln

Der `main`-Branch ist geschützt: Änderungen laufen über einen eigenen Branch + Pull Request, der erst gemerged werden kann, wenn die CI-Pipeline grün ist — Typprüfung + Tests aus `src/` (`test`-Check) und Build/Typprüfung von `web/` (`web`-Check), siehe `.github/workflows/ci.yml`.

## Geplant

- Echtes Online-Multiplayer: ein Server (WebSockets, Spielräume, mehrere echte Clients statt Bots)
