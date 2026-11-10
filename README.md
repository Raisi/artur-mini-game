# Münzjagd 🪙

Ein kleines 3D-Spiel im Browser: Du läufst mit **deiner eigenen Figur aus Paint 3D**
über eine Insel und sammelst 20 Münzen so schnell wie möglich ein – ohne dich von den
Gegnern erwischen zu lassen. Zum Glück hast du ein Schwert! ⚔️

**▶️ Online spielen: https://raisi.github.io/artur-mini-game/**

## So startest du das Spiel

Du brauchst [Node.js](https://nodejs.org) (am besten die aktuelle LTS-Version, mindestens 22.12).

Im Projektordner einmalig die Pakete installieren:

```bash
npm install
```

Dann das Spiel starten:

```bash
npm run dev
```

Im Terminal erscheint eine Adresse wie `http://localhost:5173`. Öffne sie im Browser – fertig!

## Titelbildschirm

Das Spiel startet im Hauptmenü: Deine Figur und ein Gegner stehen sich gegenüber – ab und zu
holt deine Figur mit dem Schwert aus. Mit **Neues Spiel** (oder **Enter**) geht's los.
**Highscores** ist schon da, kommt aber erst später. Nach „Gewonnen!“ oder „Game Over“ bringt
dich **Hauptmenü** zurück.

Wo die beiden stehen und von wo die Kamera schaut, steht oben in `src/title.js`.

## Steuerung

| Taste                | Was passiert        |
| -------------------- | ------------------- |
| W A S D / Pfeiltasten | laufen              |
| Leertaste            | springen            |
| F / Mausklick        | mit dem Schwert zuschlagen |

Tipp: Auf die kleineren Kisten kannst du hinaufspringen!

## Spielregeln

- Sammle alle **20 Münzen** – dann hast du gewonnen. Die Zeit läuft ab deiner ersten Aktion.
- Du hast **3 Herzen** ❤️❤️❤️. Berührt dich ein Gegner, verlierst du eines und wirst weggeschubst.
  Danach blinkst du kurz und bist 1,5 Sekunden lang geschützt.
- Bei **0 Herzen** ist das Spiel vorbei: **Game Over**.
- Die Gegner bummeln herum. Kommst du ihnen zu nahe, laufen sie dir hinterher – aber sie sind
  langsamer als du. Über sie drüberspringen oder auf eine Kiste flüchten hilft auch!
- **Schwert:** Ein Hieb trifft Gegner, die direkt **vor** dir stehen. Ein getroffener Gegner wird
  weggeschubst und ist kurz benommen (dann tut er dir nichts). Nach **2 Treffern** ist er besiegt –
  aber nach 8 Sekunden taucht er an seinem Startplatz wieder auf (sobald du dort nicht in der
  Nähe bist).

## Deine eigene Figur aus Paint 3D

### 1. Figur exportieren

1. Öffne deine Figur in **Paint 3D**.
2. Klicke oben links auf **Menü**.
3. Wähle **Speichern unter**.
4. Klicke auf **3D-Modell**.
5. Wähle als Dateityp **GLB** und speichere die Datei.

### 2. Figur ins Spiel bringen

**Variante A – fest einbauen:**
Benenne die Datei in `figur.glb` um und lege sie in diesen Ordner:

```
public/models/figur.glb
```

Beim nächsten Neuladen der Seite ist deine Figur da.

**Variante B – schnell ausprobieren:**
Ziehe die `.glb`-Datei einfach mit der Maus auf das Browserfenster, während das Spiel läuft.
Die Figur wird sofort ausgetauscht.

Gibt es keine `figur.glb`, spielst du mit einer bunten Kapsel als Platzhalter.

### 3. Figur anpassen

Das Spiel macht deine Figur automatisch etwa 1,5 Einheiten groß und stellt sie mit den Füßen
auf den Boden. Wenn sie trotzdem komisch aussieht, öffne `src/player.js` und ändere ganz oben
den Block `FIGUR_EINSTELLUNGEN`:

```js
export const FIGUR_EINSTELLUNGEN = {
  zielHoehe: 1.5,  // Höhe im Spiel
  rotationY: 0,    // schaut die Figur falsch herum? Probiere 90, 180 oder -90
  skalierung: 1,   // 1.5 = größer, 0.7 = kleiner
  ohneMetall: true, // false, falls deine Figur glänzen soll
  schwung: 0.6,    // wie stark Arme und Beine beim Laufen schwingen (0 = aus)
};
```

Speichern genügt, der Browser lädt automatisch neu.

### 4. Laufen mit Armen und Beinen

Das Spiel sucht in deiner Figur automatisch nach **Armen und Beinen** und lässt sie beim Laufen
hin- und herschwingen. Das klappt, wenn du sie in Paint 3D als **eigene Teile** gebaut hast
(z. B. jedes Bein ein eigener Zylinder):

- **Beine** müssen den Boden berühren und dürfen höchstens bis zur halben Körperhöhe reichen.
- **Arme** müssen auf mittlerer Höhe weit links und rechts sitzen.
- Es muss genau **ein** linkes und **ein** rechtes Teil geben. Hände oder Schuhe als extra
  Teile schwingen nicht mit.

Findet das Spiel nichts Passendes, wippt die Figur einfach nur (wie die Kapsel).

## Eigene Gegner

Die Gegner funktionieren genauso wie deine Figur: Exportiere eine Figur aus Paint 3D als GLB,
nenne sie `enemy.glb` und lege sie hierhin:

```
public/models/enemy.glb
```

Alle Gegner benutzen dasselbe Modell. Gibt es keine `enemy.glb`, kommen rote Stachelkugeln.
Arme und Beine werden genauso gesucht wie bei deiner Figur (siehe oben).

Anpassen kannst du die Gegner in `src/enemy.js` (Block `GEGNER_EINSTELLUNGEN`, dazu Tempo und
Sichtweite darunter). Wie viele Gegner es gibt und wo sie starten, steht in `src/game.js` in
`GEGNER_STARTPLAETZE` – ein Eintrag pro Gegner. Dort findest du auch `MAX_LEBEN`.

## Eigenes Schwert

Auch das Schwert kann aus Paint 3D kommen. Bau es **aufrecht: Griff unten, Klinge oben**,
exportiere es als GLB und lege es hierhin:

```
public/models/sword.glb
```

Deine Figur hält es automatisch in der rechten Hand (wenn sie eigene Arme hat – sonst schwebt es
neben ihr). Gibt es keine `sword.glb`, bekommt sie ein einfaches Ersatz-Schwert.
Länge, Griff-Position und Haltung stellst du in `src/sword.js` im Block `SCHWERT_EINSTELLUNGEN` ein.
Hast du das Schwert andersherum gebaut (Klinge unten), setze dort `umdrehen: true`.

## Veröffentlichen (GitHub Pages)

Das Spiel wird automatisch veröffentlicht: Sobald Änderungen auf den Branch `main` gepusht
werden, baut GitHub das Spiel und stellt es unter
https://raisi.github.io/artur-mini-game/ online – nach etwa einer Minute ist die neue Version da.

- Den Fortschritt siehst du auf GitHub im Tab **Actions** (Workflow „Deploy auf GitHub Pages“).
  Dort kannst du ihn mit **Run workflow** auch von Hand starten.
- Die Einstellungen dafür stehen in `.github/workflows/deploy.yml`.
- Weil das Spiel online im Unterordner `/artur-mini-game/` liegt, setzt `vite.config.js` diesen
  Pfad beim Bauen. Lokal mit `npm run dev` ändert sich nichts.

Neue Figuren, Gegner oder Schwerter? Einfach die `.glb`-Datei in `public/models/` austauschen,
committen und pushen – fertig.

## Was steckt wo?

| Datei            | Inhalt                                                    |
| ---------------- | --------------------------------------------------------- |
| `index.html`     | Die Webseite mit Anzeige (Münzen, Zeit, Herzen, "Gewonnen!", "Game Over") |
| `src/main.js`    | Start: Kamera, Tastatur, Drag & Drop, Spielschleife       |
| `src/title.js`   | Titelbildschirm („Duell“): Figuren in Pose, Menü, Kamera  |
| `src/world.js`   | Die Insel: Himmel, Licht, Bäume, Kisten, Felsen           |
| `src/figur.js`   | Werkzeuge für Spieler und Gegner: Modell anpassen, Arme/Beine finden, Kollision |
| `src/player.js`  | Deine Figur: Laden, Laufen, Springen, Wippen, Squash & Stretch, Schwerthieb |
| `src/sword.js`   | Das Schwert: laden und griffbereit machen                 |
| `src/enemy.js`   | Die Gegner: herumbummeln, verfolgen, getroffen werden, wiederkommen |
| `src/game.js`    | Spielregeln: Münzen, Leben, Treffer, Schwert-Treffer, Timer, Sound, Neustart |

Gebaut mit [Vite](https://vite.dev) und [Three.js](https://threejs.org).
