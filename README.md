# SystemischesBrett

Interaktives **3D systemisches Brett** (Holzfiguren-Aufstellung) – als **Zoom App** und standalone im Browser.

![Familienaufstellung auf dem Systemischen Brett](docs/familie-aufstellung.svg)

*Beispiel-Familienaufstellung: Vater, Mutter, Tochter, Sohn (auf Podest) und Würfel „Thema“ – mit Schlangenlinie auf dem Brett.*

## Funktionen

Kurze Clips der Grundfunktionen (Aufnahmen der laufenden App, angelehnt an die Aufstellungen vom 8. August):

| Clip | Inhalt |
|------|--------|
| [Brett und Schlangenlinie](docs/videos/01-brett-schlangenlinie.mp4) | Holzbrett, 6-Wellen-Linie, Kamera |
| [Figuren platzieren](docs/videos/02-figuren-platzieren.mp4) | Figuren setzen, beschriften, verschieben |
| [Fokus und Podest](docs/videos/03-fokus-und-podest.mp4) | Anklicken, heller Ring, Würfel als Podest |
| [Spielfeld trennen](docs/videos/04-spielfeld-trennen.mp4) | Hälften entlang der Schlange öffnen und schließen |
| [Kamera](docs/videos/05-kamera.mp4) | Presets Iso, Oben, Seite, Front |
| [Speichern und laden](docs/videos/06-speichern-laden.mp4) | Speicher im Browser, Version, laden |
| [Zoom App](docs/videos/07-zoom-app.mp4) | Demo-Meeting, teilen, synchronisieren |

Die Dateien liegen unter [`docs/videos/`](docs/videos/). Neu aufnehmen: `npm run dev` und `node scripts/record-docs-videos.mjs`.

### Brett und Schlangenlinie

<video src="docs/videos/01-brett-schlangenlinie.mp4" controls muted playsinline width="720"></video>

- Holzbrett mit Rahmen, in der Mitte eine **Schlangenlinie mit 6 Sinuswellen** (dünner Trennstrich, gemäßigte Amplitude).
- Die Linie teilt das Spielfeld in eine linke und eine rechte Hälfte; die Schnittkante folgt der Welle.
- **Spielfeld trennen** (unter *Entfernen*, bzw. unter dem Hinweis wenn nichts ausgewählt ist) rückt die Hälften entlang der Schlangenlinie um etwa **2 cm** auseinander. Figuren bleiben auf ihrer Seite.
- **Spielfeld zusammenführen** schließt die Lücke wieder. Die Trennung ist eine Ansicht, gespeicherte Stände bleiben in Brettkoordinaten.

[Video: Spielfeld trennen](docs/videos/04-spielfeld-trennen.mp4)

<video src="docs/videos/04-spielfeld-trennen.mp4" controls muted playsinline width="720"></video>

### Figuren

| Taste | Figur |
|--------|--------|
| + Große Figur | hohe Holzfigur |
| + Mittlere Figur | mittlere Holzfigur |
| + Kleine Figur | kleine Holzfigur |
| + Würfel | Holzwürfel |
| + Scheibe | flacher Holzteller, halb so hoch wie der Würfel, liegt vollständig auf dem Brett |

<video src="docs/videos/02-figuren-platzieren.mp4" controls muted playsinline width="720"></video>

- Figuren **ziehen** (auf dem Brett verschieben) und **anklicken** (Fokus setzen).
- Zwei **schwarze Augenpunkte** geben den Holzfiguren eine Blickrichtung; **Drehen** ändert den Blick.
- Die fokussierte Figur zeigt einen **gedämpften Ring um die Basis** (auf der Brettoberfläche, hinter der Figur). Holzfiguren: rund. Würfel: **quadratischer Rahmen** mit gleichem Abstand.
- **Label** setzen, mit Enter oder Verlassen des Feldes übernehmen; erscheint als Namensschild über der Figur.
- **Holzton** aus acht Farbtönen wählen.
- **Auf Podest** gilt nur für die fokussierte Figur und stellt sie auf einen **Holzwürfel**. Die Scheibe liegt dann direkt auf dem Block, nicht darüber.

<video src="docs/videos/03-fokus-und-podest.mp4" controls muted playsinline width="720"></video>

- **Drehen** nach links oder rechts.
- **Entfernen** löscht die ausgewählte Figur.
- **Brett leeren** entfernt alle Figuren.

### Kamera

<video src="docs/videos/05-kamera.mp4" controls muted playsinline width="720"></video>

- Freies Drehen, Zoomen und Schwenken per Maus (Orbit).
- Presets: **Iso**, **Oben**, **Seite**, **Front**.

### Verlauf

- **Undo** / **Redo** für Figurenänderungen, ohne Begrenzung in der Sitzung. Ein Ziehen zählt als ein Zug.
- Der letzte Stand wird automatisch im Browser gehalten und nach Reload wiederhergestellt.

### Speicher im Browser und Datei

Zwei getrennte Wege: im Browser (localStorage, gerätegebunden) oder als Datei auf dem Rechner.

<video src="docs/videos/06-speichern-laden.mp4" controls muted playsinline width="720"></video>

- **Speicher im Browser**: Name eingeben, Stand im Browser anlegen (startet bei Version 1). Auch per Enter im Namensfeld.
- **Neue Version**: weiteren Stand unter demselben Namen im Browser speichern (v2, v3, …).
- **Gespeicherte Dateien**: Liste nach Name und Version; **Laden** stellt den Stand wieder her, **Löschen** entfernt ihn.
- Ohne Namen erscheint ein Hinweis; gleiche Bezeichnung erzeugt automatisch die nächste Versionsnummer.
- Der letzte Stand wird zusätzlich automatisch im Browser gehalten und nach Reload wiederhergestellt.
- **Als Datei speichern** schreibt den aktuellen Stand (Figuren, Name, Trennung) als `.sbrett.json` auf den Rechner.
- **Aus Datei laden** öffnet eine `.sbrett.json` / `.json` und setzt das Brett darauf. So lassen sich Aufstellungen weitergeben oder sichern.

### Zoom App

Im Zoom-Meeting (oder per `?zoom=1` als Demo):

<video src="docs/videos/07-zoom-app.mp4" controls muted playsinline width="720"></video>

- Status-Badge: Kontext (Standalone / Zoom App, Nutzer, Meeting-Titel).
- **App teilen** zeigt die App den anderen Teilnehmern.
- **Erweitern** vergrößert das App-Panel.
- **Brett synchronisieren** sendet den aktuellen Figurenstand an andere offene Instanzen.
- Figurenänderungen werden verzögert (~400 ms) mitgesendet.

Außerhalb von Zoom bleibt die App eine normale Browser-Anwendung.

### Darstellung

- Sidebar bleibt auf schmalen Fenstern bedienbar (Mindestbreite, eigenes Scrollen, Canvas füllt den Rest).
- Standalone- oder Zoom-Status oben in der Seitenleiste.

## Start (Standalone)

```bash
npm install
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

| Query | Modus |
|--------|--------|
| *(ohne)* | Auto: Zoom-SDK falls im Client, sonst Standalone |
| `?zoom=1` | **Demo-Meeting** (Status + Zoom-Buttons ohne echten Client) |
| `?zoom=0` | Erzwungen **Standalone** |

## Zoom App – Einrichtung

### Architektur

```
src/zoom/
  types.ts       # BoardSyncPayload, ZoomAppStatus
  zoomClient.ts  # initZoomApp(), SDK-Config, Fallback
  useZoomApp.ts  # React-Hook
  index.ts
```

Genutzte Zoom Apps SDK Capabilities:

| API / Event | Zweck |
|-------------|--------|
| `config` | Initialisierung |
| `getRunningContext` | inMeeting / inMainClient / … |
| `getUserContext` | Anzeigename, Rolle |
| `getMeetingContext` | Meeting-Titel |
| `shareApp` | App-Ansicht mit Teilnehmern teilen |
| `postMessage` / `onMessage` | Brett-Zustand synchronisieren |
| `expandApp` | Panel vergrößern |
| `openUrl` | Externe Links |

### Marketplace / Manifest

Vorlage: [`zoom-app-manifest.template.json`](zoom-app-manifest.template.json)

1. App im [Zoom Marketplace](https://marketplace.zoom.us/) als **Zoom App** anlegen  
2. Scope **`zoomapp:inmeeting`** aktivieren  
3. Unter Zoom App SDK die APIs aus der Vorlage freischalten  
4. **Home URL** + **Domain Allow List** auf eure HTTPS-URL setzen (lokal: ngrok)  
5. Domain `appssdk.zoom.us` in der Allow List belassen  

Lokal mit Tunnel:

```bash
npm run dev
# anderes Terminal:
ngrok http 3000
# ngrok-HTTPS-URL als Home URL / Domain in der Marketplace-App eintragen
```

## E2E-Tests (Playwright)

```bash
npm install
npx playwright install chromium
npm run test:e2e              # alle Tests
npm run test:e2e:zoom         # nur Zoom-Suite
npm run test:e2e:responsive   # Sidebar bei schmalen Viewports
```

### Test-Struktur

| Datei | Inhalt |
|--------|--------|
| `e2e/helpers.ts` | `openApp`, `addFigure`, `saveUnder`, … |
| `e2e/app.spec.ts` | UI, Figuren, Speichern/Versionierung, Kamera, History (auch >40 Züge), Spielfeld trennen |
| `e2e/smoke.spec.ts` | Gesamtflow speichern/laden |
| `e2e/zoom.spec.ts` | Standalone vs. `?zoom=1` Meeting-UI |
| `e2e/zoom-unit.spec.ts` | Status-Badge & Capabilities-Wiring |
| `e2e/responsive.spec.ts` | Sidebar bleibt auf schmalen Fenstern nutzbar |

Zoom-Tests nutzen **`?zoom=1` / `?zoom=0`** und brauchen keinen echten Zoom-Client.

## Tech-Stack

- React 19 + TypeScript + Vite
- Three.js / React Three Fiber / Drei
- **@zoom/appssdk** (Zoom Apps SDK)
- Playwright (E2E)

## Lizenz

Privat / nach Absprache – Repository: [inwuerde/SystemischesBrett](https://github.com/inwuerde/SystemischesBrett)
