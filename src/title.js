// title.js – der Titelbildschirm im "Duell"-Look:
// Deine Figur und ein Gegner stehen sich auf der Insel gegenüber, darüber Titel und Menü.
import * as THREE from 'three';

// Wo die beiden beim Duell stehen und von wo die Kamera schaut.
// Die Kamera steht auf der "Südseite" (z < 0) – so sieht man die Schwerthand deiner Figur.
const HELD_PLATZ = new THREE.Vector3(1.5, 0, 1);
const GEGNER_PLATZ = new THREE.Vector3(-1.5, 0, 1);
const KAMERA_POSITION = new THREE.Vector3(0, 1.7, -4.8);
const KAMERA_BLICK = new THREE.Vector3(0, 1.0, 1);
const HIEB_ABSTAND = 2.5; // alle paar Sekunden holt deine Figur aus

export class Titelbild {
  constructor(spiel, spieler, zeigeMeldung) {
    this.spiel = spiel;
    this.spieler = spieler;
    this.aktiv = false;
    this.kameraPosition = KAMERA_POSITION.clone();
    this.kameraBlick = KAMERA_BLICK;

    this.fenster = document.getElementById('titel');

    document.getElementById('titel-start').addEventListener('click', (e) => {
      e.currentTarget.blur(); // sonst würde die Leertaste den Knopf nochmal drücken
      this.starten();
    });
    // Highscores gibt es noch nicht – der Knopf sagt das freundlich.
    document.getElementById('titel-highscores').addEventListener('click', (e) => {
      e.currentTarget.blur();
      zeigeMeldung('Highscores kommen bald! 🏆');
    });
    // "Hauptmenü"-Knöpfe auf dem Gewonnen- und Game-Over-Bildschirm
    for (const knopf of document.querySelectorAll('.zum-titel')) {
      knopf.addEventListener('click', () => {
        knopf.blur();
        this.zeigen();
      });
    }
    // Enter startet das Spiel auch – aber nicht, wenn die Taste nur "nachrepetiert"
    // (gedrückt gehalten) oder gerade ein Knopf ausgewählt ist (der reagiert dann selbst).
    window.addEventListener('keydown', (e) => {
      if (!this.aktiv || e.code !== 'Enter' || e.repeat) return;
      if (e.target.closest?.('button')) return;
      this.starten();
    });
  }

  // Schmales Fenster (z. B. Tablet hochkant)? Dann geht die Kamera weiter zurück,
  // damit beide Figuren ganz ins Bild passen. seitenverhaeltnis = Breite / Höhe.
  passeAn(seitenverhaeltnis) {
    const zurueck = Math.max(1, 1.3 / seitenverhaeltnis);
    this.kameraPosition.copy(KAMERA_POSITION).sub(KAMERA_BLICK).multiplyScalar(zurueck).add(KAMERA_BLICK);
  }

  // Titelbildschirm anzeigen (am Anfang und über "Hauptmenü")
  zeigen() {
    this.spiel.neustart(); // alles frisch, Overlays weg
    // Die Münzen verstecken – im Menü würden sie nur ablenken. "Neues Spiel" legt neue aus.
    for (const muenze of this.spiel.muenzen) muenze.visible = false;
    this.aktiv = true;
    this.zeit = 0;
    this.naechsterHieb = 1.2;
    this.zucken = 0;
    this.fenster.classList.add('sichtbar');
    document.body.classList.add('im-titel');
  }

  // "Neues Spiel"
  starten() {
    this.aktiv = false;
    this.spiel.neustart();
    this.fenster.classList.remove('sichtbar');
    document.body.classList.remove('im-titel');
  }

  // Der Gegner, der beim Duell mitspielt
  get duellGegner() {
    return this.spiel.gegner[0];
  }

  // Wird jedes Bild aufgerufen, solange der Titel zu sehen ist.
  aktualisiere(dt) {
    this.zeit += dt;
    const { hindernisse, inselRadius } = this.spiel.welt;

    // Deine Figur: auf ihrem Platz, Blick zum Gegner (nach -x)
    const held = this.spieler.gruppe;
    held.position.x = HELD_PLATZ.x;
    held.position.z = HELD_PLATZ.z;
    held.rotation.y = -Math.PI / 2;

    // Ab und zu ein Schwerthieb
    this.naechsterHieb -= dt;
    if (this.naechsterHieb <= 0) {
      const vorher = this.spieler.schlagNummer;
      this.spieler.angreifen();
      this.naechsterHieb = HIEB_ABSTAND;
      // Nur zucken, wenn wirklich zugeschlagen wurde (z. B. nicht, solange das Schwert noch lädt)
      if (this.spieler.schlagNummer !== vorher) this.zucken = 0.55;
    }

    // Der Duell-Gegner: steht gegenüber, wippt bedrohlich – und zuckt beim Hieb zurück
    const g = this.duellGegner;
    g.gruppe.position.copy(GEGNER_PLATZ);
    g.gruppe.rotation.y = Math.PI / 2; // Blick zu deiner Figur (nach +x)
    g.belebe(dt, 0.8);                 // langsames Wippen und Schaukeln
    if (this.zucken > 0) {
      this.zucken -= dt;
      const t = THREE.MathUtils.clamp(1 - this.zucken / 0.4, 0, 1); // 0 → 1 → zurück
      const ruck = Math.sin(Math.PI * t);
      g.gruppe.position.x -= ruck * 0.35;   // weicht zurück …
      g.animGruppe.rotation.x = -0.35 * ruck; // … und lehnt sich nach hinten
    }

    // Die anderen Gegner bummeln im Hintergrund herum (ohne zu jagen)
    for (const anderer of this.spiel.gegner) {
      if (anderer === g || !anderer.modell) continue;
      anderer.aktualisiere(dt, held.position, false, hindernisse, inselRadius);
    }
  }
}
