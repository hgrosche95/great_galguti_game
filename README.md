# Great Galguti Game

Ein rundenbasiertes Kartenspiel nach Stichspiel-Logik für 3–8 Spieler, geschrieben in TypeScript/Node. Die vollständigen Spielregeln stehen in [game-logic.md](./game-logic.md).

## Kurzfassung der Regeln

- Zahlenkarten 1–12 (jede so oft wie ihr Wert) plus 2 Joker (Wert 13).
- Jeder Spieler bekommt reihum verdeckt Karten, bis das Deck leer ist.
- In Stichrunden spielt reihum jeder Spieler entweder eine gleich große Kombination mit niedrigerem Wert als der vorherige Zug (Joker füllen als Platzhalter auf), oder passt.
- Wer zuletzt gelegt hat, wenn alle anderen gepasst haben, gewinnt die Stichrunde und eröffnet die nächste.
- Wer zuerst keine Karten mehr hat, gewinnt; gespielt wird weiter, bis nur noch ein Spieler Karten hält.

## Tech-Stack

- TypeScript auf Node.js
- [Vitest](https://vitest.dev/) als Test-Runner

## Setup

```bash
npm install
```

## Verfügbare Scripts

```bash
npm test        # Tests einmalig/im Watch-Modus mit Vitest ausführen
npm run typecheck  # TypeScript-Typprüfung ohne Ausgabe (tsc --noEmit)
```

## Aktueller Stand

Bisher implementiert (siehe `src/`):

- `cards.ts` – `Card`-Typ
- `deck.ts` – Deck erzeugen (`createDeck`) und an Spieler verteilen (`handOutDeck`)
- `general.ts` – generischer Fisher-Yates-Shuffle (`shuffle`)
- `players.ts` – `Player`-Typ, Spieler erzeugen (`createPlayers`), nächsten aktiven Spieler ermitteln (`nextActivePlayer`)
- `rules.ts` – Wert eines Kartenzugs bestimmen (`getMoveValue`), Zug-Gültigkeit prüfen (`isValidMove`)
- `trick.ts` – Stichrunden-Zustand (`TrickState`), Zug/Pass verarbeiten (`move`), Rundenende (`isTrickOver`) und Rundengewinner (`getWinner`) ermitteln

Alle Module sind mit Vitest-Tests abgedeckt.

## Geplant

- Neue Stichrunde starten (Rundengewinner wird Startspieler, Zustand zurücksetzen)
- Gesamtes Spiel (mehrere Stichrunden bis zum Spielende) orchestrieren
- Einfache Test-Bots
- Deployment nach Azure für Online-Mehrspieler-Partien
- CI/Pipelines und geschützter `main`-Branch (nur per Merge Request)
