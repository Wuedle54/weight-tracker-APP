# Gewicht – Weight Tracker

Eine kleine Web-App (PWA) für das iPhone: täglich Gewicht und Uhrzeit eintragen,
Einträge als Liste ansehen und Statistiken/Diagramme auswerten.
Läuft im Safari-Browser und lässt sich wie eine normale App auf den Home-Bildschirm legen
– kein App Store und kein Mac nötig.

## Funktionen

- **Eintragen:** Gewicht (kg, Komma oder Punkt), Datum und Uhrzeit (vorausgefüllt mit „jetzt“), optionale Notiz.
  Jeder Eintrag speichert zusätzlich den Zeitpunkt der Erfassung (`createdAt`).
- **Liste:** alle Einträge nach Monat gruppiert, mit Differenz zum vorherigen Eintrag; bearbeiten und löschen.
- **Statistik:** Zeitraum 7 T / 30 T / 90 T / 1 J / Alle
  - Kennzahlen: aktuell, Veränderung, Durchschnitt, Tendenz pro Woche (lineare Regression), Minimum, Maximum
  - Liniendiagramm mit 7-Tage-Durchschnitt (antippen zeigt Werte)
  - Wochenschnitt mit Spannweite (Min–Max)
  - Monatsübersicht als Tabelle
- **Daten:** Export als CSV (z. B. für Excel/Numbers) oder JSON, Import einer Sicherung, alles löschen.
- Funktioniert offline; Hell-/Dunkelmodus folgt dem iPhone.

Die Daten werden **nur lokal auf dem Gerät** gespeichert (`localStorage`). Bitte regelmässig
unter „Daten“ eine Sicherung exportieren.

## Auf dem iPhone installieren

1. Die App muss über HTTPS erreichbar sein, z. B. via **GitHub Pages**:
   Repository → *Settings* → *Pages* → *Source*: **GitHub Actions**.
   Der Workflow `.github/workflows/pages.yml` veröffentlicht die App bei jedem Push auf `main`
   unter `https://<benutzername>.github.io/weight-tracker-APP/`.
   (GitHub Pages für private Repositories braucht einen kostenpflichtigen GitHub-Plan –
   sonst das Repository öffentlich machen; die Gewichtsdaten liegen nicht im Repository.)
2. Die Adresse in **Safari** öffnen.
3. Teilen-Symbol → **„Zum Home-Bildschirm“** → Hinzufügen.
4. Ab jetzt die App über das Icon „Gewicht“ starten.

## Lokal ausprobieren

```sh
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Oberfläche (4 Tabs) |
| `styles.css` | Gestaltung, Hell-/Dunkelmodus |
| `app.js` | Speicherung, Liste, Statistik, Diagramme (SVG), Export/Import |
| `sw.js` | Service Worker für Offline-Betrieb |
| `manifest.webmanifest`, `icons/` | App-Name und Icons für den Home-Bildschirm |

Datenformat pro Eintrag:

```json
{ "id": "…", "weight": 72.4, "date": "2026-10-17", "time": "07:15", "note": "", "createdAt": "2026-10-17T05:15:12.000Z" }
```
