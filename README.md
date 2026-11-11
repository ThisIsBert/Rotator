# Rotator

Minimalistische Zeichenscheibe für Android-Smartphones und Tablets. Farbige Spuren auf Schwarz, ohne sichtbare Beschriftung, ohne Framework oder externe Dienste.

**App:** https://thisisbert.github.io/Rotator/

## Bedienung

- Außenring tangential wischen: anschubsen, mehrfach wischen für mehr Schwung. Gegenrichtung bremst oder kehrt die Rotation um. Festhalten am Ring bremst.
- Innen mit Finger oder Stift zeichnen, auch während der Rotation. Stift still halten für Kreise, zur Mitte bewegen für Spiralen. Kurzes Antippen erzeugt Punkte.
- Ring und Zeichenfläche lassen sich gleichzeitig bedienen. Bei erkanntem Stiftkontakt werden zusätzliche Fingerkontakte im Zeichenbereich ignoriert; der Außenring bleibt bedienbar.
- Symbole: Stift, Radierer, Strichstärke, Farbe, Stopp, Rückgängig (sechs Schritte), Löschen. Löschen ist rückgängig machbar.
- Der Punkt öffnet vier direkt wählbare Strichstärken. Die Wellenlinie daneben aktiviert/deaktiviert druckabhängige Breite für Stifte: mittlerer Druck entspricht der gewählten Stärke, leichter Druck zeichnet feiner, stärkerer breiter. Finger und Maus zeichnen mit konstanter Breite. Der Stift und Browser müssen echte Druckwerte liefern.
- Der Farbkreis öffnet Grundfarben, die sechs zuletzt gewählten Farben und eine freie Farbauswahl über das Plus. Farben und Stifteinstellungen bleiben nach dem Neustart erhalten.
- Der Regenbogenkreis aktiviert einen kontinuierlichen Farbverlauf entlang der Spur. Auch ein stillgehaltener Stift erzeugt auf der rotierenden Scheibe das Spektrum; auf einer ruhenden Scheibe bleibt ein Punkt farbstabil. Eine feste Farbe beendet den Regenbogenmodus. Der Radierer radiert weiterhin alle Farben.
- Desktop: Mausrad dreht; Leertaste stoppt; Strg/Cmd+Z macht rückgängig.
- Android: Im Browser-Menü „App installieren“ beziehungsweise „Zum Startbildschirm hinzufügen“. Wenn verfügbar erscheint zusätzlich ein Installationssymbol.

Nach dem ersten vollständigen Laden funktioniert die App offline. Die Zeichnung wird lokal in IndexedDB gespeichert, nicht hochgeladen. Browserdaten löschen entfernt sie. Rückgängig-Historie und Drehgeschwindigkeit gelten nur für die laufende Sitzung.

## Entwicklung

Node.js 22 oder neuer, keine npm-Abhängigkeiten:

```sh
npm test
npm run dev
```

Vorschau: http://127.0.0.1:4173/Rotator/

`public/` ist die vollständige statische PWA. `physics.js` enthält zeitbasierte Rotation und adaptive Abtastung in Scheibenkoordinaten. Die Zeichnung liegt auf einer separaten 1536×1536-Pixel-Fläche. Bis zu acht Umdrehungen pro Sekunde; kurze Mehrfachbelichtung reduziert Stroboskopeffekte. Der tatsächliche Bewegungseindruck hängt von Bildwiederholrate und Leistung des Geräts ab.

## GitHub Pages

In Settings → Pages ist GitHub Actions als Quelle eingestellt. Jeder Push auf `main` führt die Physiktests aus und veröffentlicht `public/` über `.github/workflows/pages.yml`.

Bei Änderungen an gecachten App-Dateien die Version in `public/sw.js` erhöhen. Ein neues Offline-Paket wird nach Schließen aller alten App-Fenster aktiv.

## Prüfung

Automatische Tests prüfen Reibung unabhängig von der Bildrate, Winkelsprünge am Kreisübergang, die inverse Rotation und kontinuierliche Kreis-/Spiralspuren bei hoher Drehzahl. Browserprüfungen ergänzen die Tests. Die Haptik, Stiftdruck und gerätespezifische Handballenerkennung sollten zusätzlich auf echter Android-Hardware beurteilt werden.
