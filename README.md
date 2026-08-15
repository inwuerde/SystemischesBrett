# SystemischesBrett

Interaktives **3D systemisches Brett** (Holzfiguren-Aufstellung) – vorbereitet für den Einsatz als Zoom-App.

![Familienaufstellung auf dem Systemischen Brett](docs/familie-aufstellung.jpg)

*Beispiel: Familienaufstellung mit Vater, Mutter, Tochter, Sohn und dem Thema „Thema“ auf dem Brett mit Schlangenlinie.*

## Features

- 3D-Brett mit Holzfiguren (groß / mittel / klein), Würfel und Scheibe
- Ziehen, drehen, beschriften, Holzton wählen, Podest
- Kamera-Presets (Iso, Oben, Seite, Front)
- Undo / Redo
- **Speichern unter** mit Namen und **Versionierung** (localStorage)
- Laden und Löschen gespeicherter Stände

## Start

```bash
npm install
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

## E2E-Tests (Playwright)

Umfassende End-to-End-Tests decken UI, Figuren, Speichern/Versionierung, Kamera und einen Smoke-Flow ab.

### Voraussetzungen

```bash
npm install
npx playwright install chromium
```

### Tests ausführen

```bash
npm run test:e2e          # Headless-Lauf (Chromium)
npm run test:e2e:ui       # Interaktives UI-Mode
npm run test:e2e:report   # Letzten HTML-Report öffnen
```

Playwright startet den Vite-Dev-Server automatisch (`playwright.config.ts`).

### Test-Struktur

| Datei | Inhalt |
|--------|--------|
| `e2e/helpers.ts` | Hilfsfunktionen (`openApp`, `addFigure`, `saveUnder`, …) |
| `e2e/app.spec.ts` | App-Shell, Figuren, Kamera/History, Speichern & Versionierung, Persistenz, Layout |
| `e2e/smoke.spec.ts` | Kurzer Gesamtflow: leeren → Figur → Label → speichern → laden → löschen |

**26 Tests**, lokal grün (Chromium).

## Tech-Stack

- React 19 + TypeScript + Vite
- Three.js / React Three Fiber / Drei
- Playwright (E2E)

## Zoom-App (geplant)

Architektur für Zoom Apps (Immersive / Layers, Shared State) ist vorgesehen; die aktuelle Phase ist das lokale 3D-Brett.

## Lizenz

Privat / nach Absprache – Repository: [inwuerde/SystemischesBrett](https://github.com/inwuerde/SystemischesBrett)
