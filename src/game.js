// game.js – die Spielregeln: Münzen, Leben, Gegner, Timer, Sound, "Gewonnen!" und "Game Over".
import * as THREE from 'three';
import { Gegner, GEGNER_RADIUS } from './enemy.js';
import { SPIELER_RADIUS } from './player.js';

const ANZAHL_MUENZEN = 20;
const EINSAMMEL_ABSTAND = 1.1; // so nah muss die Figur an eine Münze heran
const MAX_LEBEN = 3;           // so viele Herzen hast du am Anfang
const SCHUTZ_ZEIT = 1.5;       // Sekunden nach einem Treffer, in denen dir nichts passiert
const SCHWERT_REICHWEITE = 1.9; // so weit reicht dein Schwert (vom Körper aus)
// Wo die Gegner starten: weit weg von deinem Startplatz (0, 0) und nicht in Hindernissen.
// Mehr Einträge = mehr Gegner.
const GEGNER_STARTPLAETZE = [
  [12, 12],
  [-12, -12],
  [0, -17],
];

// ───────────────────────────────────────────────────────────────
// Sound: kleine Piep-Töne mit der WebAudio-API (ganz ohne Sounddateien)
// ───────────────────────────────────────────────────────────────
class Sound {
  constructor() {
    this.ctx = null;
  }

  // Browser erlauben Ton erst nach einer Taste/einem Klick – darum erst dann starten.
  aktivieren() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Ein einzelner Ton: frequenz in Hz, start/dauer in Sekunden.
  // Mit zielFrequenz rutscht der Ton während der Dauer dorthin (z. B. für ein "Wusch").
  piep(frequenz, start = 0, dauer = 0.12, zielFrequenz = frequenz) {
    if (!this.ctx) return;
    const jetzt = this.ctx.currentTime + start;
    const oszillator = this.ctx.createOscillator();
    const lautstaerke = this.ctx.createGain();
    oszillator.type = 'square';
    oszillator.frequency.setValueAtTime(frequenz, jetzt);
    oszillator.frequency.exponentialRampToValueAtTime(zielFrequenz, jetzt + dauer);
    // Kurz laut, dann schnell leiser werden – klingt wie ein "Pling"
    lautstaerke.gain.setValueAtTime(0.12, jetzt);
    lautstaerke.gain.exponentialRampToValueAtTime(0.001, jetzt + dauer);
    oszillator.connect(lautstaerke).connect(this.ctx.destination);
    oszillator.start(jetzt);
    oszillator.stop(jetzt + dauer);
  }

  muenze() {
    this.piep(988, 0, 0.08);
    this.piep(1319, 0.08, 0.25);
  }

  gewonnen() {
    [523, 659, 784, 1047].forEach((f, i) => this.piep(f, i * 0.12, 0.3));
  }

  autsch() {
    this.piep(330, 0, 0.1);
    this.piep(220, 0.1, 0.2);
  }

  verloren() {
    [392, 330, 262, 196].forEach((f, i) => this.piep(f, i * 0.2, 0.35));
  }

  schwung() {
    this.piep(700, 0, 0.12, 150); // "Wusch"
  }

  gegnerGetroffen() {
    this.piep(160, 0, 0.12, 80); // "Klonk"
  }

  gegnerBesiegt() {
    this.piep(300, 0, 0.3, 1200); // "Plopp" nach oben
  }
}

// ───────────────────────────────────────────────────────────────
// Das Spiel
// ───────────────────────────────────────────────────────────────
export class Spiel {
  constructor(scene, spieler, welt) {
    this.scene = scene;
    this.spieler = spieler;
    this.welt = welt;
    this.sound = new Sound();

    // Alle Münzen teilen sich Form und Material (spart Speicher)
    this.muenzForm = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
    this.muenzForm.rotateX(Math.PI / 2); // aufstellen wie ein Rad
    this.muenzMaterial = new THREE.MeshStandardMaterial({
      color: '#ffd23f', emissive: '#b07800', metalness: 0.1, roughness: 0.35, flatShading: true,
    });
    this.muenzen = [];

    // HUD-Elemente aus index.html
    this.anzeigeMuenzen = document.getElementById('muenzen');
    this.anzeigeZeit = document.getElementById('zeit');
    this.anzeigeLeben = document.getElementById('leben');
    this.gewonnenFenster = document.getElementById('gewonnen');
    this.anzeigeEndzeit = document.getElementById('endzeit');
    this.gameOverFenster = document.getElementById('game-over');

    // Beide "Nochmal"-Knöpfe (Gewonnen und Game Over) starten neu
    for (const id of ['neustart', 'neustart-game-over']) {
      const knopf = document.getElementById(id);
      knopf.addEventListener('click', () => {
        knopf.blur(); // sonst würde die Leertaste den Knopf nochmal drücken
        this.neustart();
      });
    }

    // Die Gegner gibt es von Anfang an; ihr Aussehen kommt erst nach dem Laden (setzeGegnerModell).
    this.gegner = GEGNER_STARTPLAETZE.map(([x, z]) => new Gegner(scene, x, z));

    this.neustart();
  }

  // Wird aufgerufen, sobald enemy.glb geladen ist (oder der Platzhalter bereitsteht).
  setzeGegnerModell(vorlage) {
    for (const g of this.gegner) g.setzeModell(vorlage);
  }

  // Ist die Runde vorbei (gewonnen oder verloren)?
  get vorbei() {
    return this.gewonnen || this.verloren;
  }

  // Alles auf Anfang: neue Münzen, volle Leben, Zeit auf 0, Figur und Gegner zum Start.
  neustart() {
    for (const muenze of this.muenzen) this.scene.remove(muenze);
    this.muenzen = this.verteileMuenzen();

    this.gesammelt = 0;
    this.zeit = 0;
    this.laeuft = false;   // Timer startet erst bei der ersten Bewegung
    this.gewonnen = false;
    this.verloren = false;
    this.leben = MAX_LEBEN;
    this.schutz = 0;       // Sekunden Schutz nach einem Treffer
    this.letzterSchwung = this.spieler.schlagNummer; // für den "Wusch"-Sound

    this.spieler.zuruecksetzen();
    for (const g of this.gegner) g.zuruecksetzen();
    this.gewonnenFenster.classList.remove('sichtbar');
    this.gameOverFenster.classList.remove('sichtbar');
    this.aktualisiereHud();
  }

  // Sucht zufällige Plätze für die Münzen – aber nur dort, wo man auch hinkommt.
  verteileMuenzen() {
    const muenzen = [];
    const { hindernisse, inselRadius } = this.welt;
    let versuche = 0;

    while (muenzen.length < ANZAHL_MUENZEN && versuche < 2000) {
      versuche++;
      const winkel = Math.random() * Math.PI * 2;
      const abstand = 3 + Math.random() * (inselRadius - 5); // nicht direkt am Start, nicht am Rand
      const x = Math.cos(winkel) * abstand;
      const z = Math.sin(winkel) * abstand;

      // Nicht in (oder zu nah an) einem Hindernis
      const imWeg = hindernisse.some((box) =>
        x > box.min.x - 1.2 && x < box.max.x + 1.2 && z > box.min.z - 1.2 && z < box.max.z + 1.2,
      );
      // Nicht zu nah an einer anderen Münze
      const zuNah = muenzen.some((m) => Math.hypot(m.position.x - x, m.position.z - z) < 3);
      if (imWeg || zuNah) continue;

      const muenze = new THREE.Mesh(this.muenzForm, this.muenzMaterial);
      muenze.position.set(x, 0.9, z);
      muenze.castShadow = true;
      muenze.userData = { phase: Math.random() * 10, gesammelt: false, weg: 0 };
      this.scene.add(muenze);
      muenzen.push(muenze);
    }
    return muenzen;
  }

  // Wird jedes Bild aufgerufen.
  aktualisiere(dt, eingabe) {
    // Timer läuft ab der ersten Bewegung, bis alle Münzen gesammelt sind
    // (Ein Schwerthieb zählt nur, wenn er wirklich läuft – nicht, wenn das Schwert noch lädt.)
    const bewegt = eingabe.vor || eingabe.zurueck || eingabe.links || eingabe.rechts ||
      eingabe.springen || this.spieler.angriffZeit >= 0;
    if (!this.laeuft && !this.vorbei && bewegt) this.laeuft = true;
    if (this.laeuft) this.zeit += dt;

    this.pruefeSchwert();
    this.aktualisiereGegner(dt);

    // Die Mitte der Figur (etwa Bauchhöhe) – damit wird der Abstand gemessen
    const figurMitte = this.spieler.gruppe.position.clone();
    figurMitte.y += 0.75;

    for (const muenze of this.muenzen) {
      const d = muenze.userData;

      if (d.gesammelt) {
        // Kleine "Plopp"-Animation: hochfliegen und schrumpfen
        if (d.weg < 1) {
          d.weg = Math.min(1, d.weg + dt * 4);
          muenze.position.y += dt * 4;
          muenze.rotation.y += dt * 20;
          muenze.scale.setScalar(1 - d.weg);
          muenze.visible = d.weg < 1;
        }
        continue;
      }

      // Drehen und leicht auf und ab schweben
      d.phase += dt;
      muenze.rotation.y += dt * 3;
      muenze.position.y = 0.9 + Math.sin(d.phase * 2) * 0.15;

      if (!this.vorbei && muenze.position.distanceTo(figurMitte) < EINSAMMEL_ABSTAND) {
        d.gesammelt = true;
        this.gesammelt++;
        this.sound.muenze();
        if (this.gesammelt === this.muenzen.length) this.gewinnen();
      }
    }

    this.aktualisiereHud();
  }

  // Schwerthieb: Trifft das Schwert gerade einen Gegner?
  pruefeSchwert() {
    const s = this.spieler;

    // Neuer Hieb angefangen? Dann "Wusch".
    if (s.schlagNummer !== this.letzterSchwung) {
      this.letzterSchwung = s.schlagNummer;
      this.sound.schwung();
    }

    if (!this.laeuft || !s.trifftGerade()) return;

    const pos = s.gruppe.position;
    const blick = s.blickRichtung();
    for (const g of this.gegner) {
      // Jeder Gegner kann pro Hieb nur EINMAL getroffen werden
      if (!g.modell || g.besiegt || g.letzterSchlag === s.schlagNummer) continue;

      const zumGegner = new THREE.Vector3(g.gruppe.position.x - pos.x, 0, g.gruppe.position.z - pos.z);
      const abstand = zumGegner.length();
      const vorDir = abstand < 0.01 || zumGegner.normalize().dot(blick) > 0.3; // grob "vor dir"
      const hoehe = Math.abs(pos.y - g.gruppe.position.y);

      if (abstand < SCHWERT_REICHWEITE && vorDir && hoehe < 1.2) {
        g.letzterSchlag = s.schlagNummer;
        const besiegt = g.getroffen(pos);
        if (besiegt) this.sound.gegnerBesiegt();
        else this.sound.gegnerGetroffen();
      }
    }
  }

  // Gegner bewegen und prüfen, ob einer dich erwischt.
  aktualisiereGegner(dt) {
    const spielerPos = this.spieler.gruppe.position;
    const { hindernisse, inselRadius } = this.welt;

    for (const g of this.gegner) {
      if (!g.modell) continue; // noch nicht geladen → bleibt am Startplatz stehen
      // Gejagt wird nur, während die Runde läuft – vorher und nachher bummeln die Gegner nur.
      g.aktualisiere(dt, spielerPos, this.laeuft, hindernisse, inselRadius);
    }

    // Nach einem Treffer bist du kurz geschützt – und blinkst dabei.
    if (this.schutz > 0) {
      this.schutz -= dt;
      this.spieler.modellHalter.visible = this.schutz <= 0 || Math.floor(this.schutz * 10) % 2 === 0;
    }

    if (!this.laeuft || this.schutz > 0) return;

    for (const g of this.gegner) {
      if (g.harmlos) continue; // nicht geladen, benommen oder besiegt
      const gPos = g.gruppe.position;
      const seitlich = Math.hypot(spielerPos.x - gPos.x, spielerPos.z - gPos.z);
      // Treffer, wenn ihr euch berührt – außer du bist hoch genug darüber (Sprung, Kiste)
      // (0.8 statt 1: Auch auf der kleinsten Kiste, 1 hoch, bist du sicher.)
      if (seitlich < SPIELER_RADIUS + GEGNER_RADIUS && spielerPos.y - gPos.y < 0.8) {
        this.getroffen(g);
        return; // höchstens ein Treffer pro Bild
      }
    }
  }

  getroffen(gegner) {
    this.leben--;
    if (this.leben <= 0) {
      this.spielVorbei();
      return;
    }
    this.sound.autsch();
    this.schutz = SCHUTZ_ZEIT;
    this.spieler.schubsWeg(gegner.gruppe.position);
  }

  gewinnen() {
    this.laeuft = false;
    this.gewonnen = true;
    this.sound.gewonnen();
    this.anzeigeEndzeit.textContent = this.zeit.toFixed(1);
    this.gewonnenFenster.classList.add('sichtbar');
  }

  spielVorbei() {
    this.laeuft = false;
    this.verloren = true;
    this.schutz = 0;
    this.spieler.modellHalter.visible = true;
    this.sound.verloren();
    this.gameOverFenster.classList.add('sichtbar');
  }

  aktualisiereHud() {
    this.anzeigeMuenzen.textContent = `${this.gesammelt} / ${this.muenzen.length}`;
    this.anzeigeZeit.textContent = `${this.zeit.toFixed(1)} s`;
    // Volle Herzen für übrige Leben, leere für verlorene
    this.anzeigeLeben.textContent = '❤️'.repeat(this.leben) + '🤍'.repeat(MAX_LEBEN - this.leben);
  }
}
