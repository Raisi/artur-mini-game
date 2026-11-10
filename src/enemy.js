// enemy.js – die Gegner: laufen herum und verfolgen dich, wenn du ihnen zu nahe kommst.
import * as THREE from 'three';
import {
  loader, normalisiere, bereiteVor, findeGlieder, schwingeGlieder, bewegeMitKollision, dreheZu,
} from './figur.js';

// ───────────────────────────────────────────────────────────────
// EINSTELLUNGEN FÜR DIE GEGNER – genauso wie bei deiner Figur
// ───────────────────────────────────────────────────────────────
export const GEGNER_EINSTELLUNGEN = {
  zielHoehe: 1.4,   // etwas kleiner als deine Figur
  rotationY: 0,     // Drehung in Grad, falls der Gegner falsch herum schaut
  skalierung: 1,
  ohneMetall: true,
  schwung: 0.7,     // Arme/Beine schwingen
};

export const GEGNER_RADIUS = 0.45;  // "Dicke" für Kollision und Treffer
const TEMPO_BUMMELN = 1.6;          // gemütliches Herumlaufen
const TEMPO_JAGEN = 3.6;            // Verfolgen – absichtlich langsamer als du (6)!
const SICHTWEITE = 8;               // ab diesem Abstand bemerkt dich ein Gegner
const BUMMEL_RADIUS = 6;            // so weit entfernt sich ein Gegner von seinem Startplatz
const GEGNER_LEBEN = 2;             // so viele Schwerthiebe hält ein Gegner aus
const BETAEUBT_ZEIT = 0.7;          // Sekunden, die ein getroffener Gegner benommen ist (harmlos)
const WIEDERKOMMEN_ZEIT = 8;        // Sekunden, bis ein besiegter Gegner wieder auftaucht

// Lädt das Gegner-Modell EINMAL. Jeder Gegner bekommt später eine Kopie davon.
export async function ladeGegnerVorlage(url) {
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}

export class Gegner {
  constructor(scene, startX, startZ) {
    // Gleicher Aufbau wie beim Spieler: Position → Animation → Modell
    this.gruppe = new THREE.Group();
    this.animGruppe = new THREE.Group();
    this.modellHalter = new THREE.Group();
    this.gruppe.add(this.animGruppe);
    this.animGruppe.add(this.modellHalter);
    scene.add(this.gruppe);

    this.start = new THREE.Vector3(startX, 0, startZ);
    this.modell = null;
    this.glieder = null;
    this.zuruecksetzen();
  }

  // Bekommt die geladene Vorlage und macht sich eine eigene Kopie davon.
  // (Die Kopien teilen sich Formen und Farben – das spart Speicher.)
  setzeModell(vorlage) {
    const modell = vorlage.clone();
    normalisiere(modell, this.modellHalter, GEGNER_EINSTELLUNGEN);
    this.glieder = findeGlieder(modell); // erst NACH dem Kopieren, jede Kopie braucht eigene Drehpunkte
    bereiteVor(modell, GEGNER_EINSTELLUNGEN);
    this.modellHalter.add(modell);
    this.modell = modell;
  }

  // Zurück zum Startplatz (für den Neustart und nach dem Wiederkommen).
  zuruecksetzen() {
    this.gruppe.position.copy(this.start);
    this.gruppe.rotation.y = Math.random() * Math.PI * 2;
    this.gruppe.visible = true;
    this.gruppe.scale.setScalar(1);
    this.modellHalter.visible = true;
    this.ziel = null;         // wohin der Gegner gerade bummelt
    this.jagt = false;        // verfolgt er dich gerade?
    this.laufZeit = 0;
    this.schwungStaerke = 0;
    this.leben = GEGNER_LEBEN;
    this.betaeubt = 0;        // Sekunden, die er noch benommen ist
    this.besiegt = false;
    this.wiederkommen = 0;    // Sekunden bis zum Wiederauftauchen
    this.rueckstoss = new THREE.Vector3();
    this.letzterSchlag = -1;  // Nummer des Hiebs, der ihn zuletzt getroffen hat
  }

  // Kann der Gegner dir gerade gefährlich werden?
  get harmlos() {
    return !this.modell || this.besiegt || this.betaeubt > 0;
  }

  // Vom Schwert getroffen: Leben weg, wegschubsen, kurz benommen – oder besiegt.
  // Gibt true zurück, wenn der Gegner damit besiegt ist.
  getroffen(vonPosition) {
    this.leben--;
    const pos = this.gruppe.position;
    const weg = new THREE.Vector3(pos.x - vonPosition.x, 0, pos.z - vonPosition.z);
    if (weg.lengthSq() < 0.0001) weg.set(0, 0, 1);
    this.rueckstoss.copy(weg.normalize().multiplyScalar(9));
    this.betaeubt = BETAEUBT_ZEIT;

    if (this.leben <= 0) {
      this.besiegt = true;
      this.modellHalter.visible = true; // falls er gerade "weggeblinkt" war: Abgang soll man sehen
      this.wiederkommen = WIEDERKOMMEN_ZEIT;
      return true;
    }
    return false;
  }

  // Wird jedes Bild aufgerufen.
  // darfJagen = false, solange die Runde nicht läuft (vor dem Start, nach Sieg oder Game Over).
  aktualisiere(dt, spielerPos, darfJagen, hindernisse, inselRadius) {
    const pos = this.gruppe.position;

    // Rückstoß nach einem Treffer – durch dieselbe Kollision wie alles andere
    bewegeMitKollision(pos, this.rueckstoss.x * dt, this.rueckstoss.z * dt, hindernisse, inselRadius, GEGNER_RADIUS);
    this.rueckstoss.multiplyScalar(Math.exp(-6 * dt));

    if (this.besiegt) {
      this.verschwinde(dt, spielerPos);
      return;
    }

    if (this.betaeubt > 0) {
      // Benommen: steht still, kippt nach hinten und blinkt
      this.betaeubt -= dt;
      this.animGruppe.rotation.x = -0.4;
      this.modellHalter.visible = this.betaeubt <= 0 || Math.floor(this.betaeubt * 12) % 2 === 0;
      return;
    }

    // 1) Entscheiden: verfolgen oder herumbummeln?
    const zumSpieler = new THREE.Vector3(spielerPos.x - pos.x, 0, spielerPos.z - pos.z);
    this.jagt = darfJagen && zumSpieler.length() < SICHTWEITE;

    let richtung;
    let tempo;
    if (this.jagt) {
      richtung = zumSpieler.normalize();
      tempo = TEMPO_JAGEN;
    } else {
      // Neues Bummel-Ziel aussuchen, wenn keins da ist oder es erreicht wurde
      if (!this.ziel || Math.hypot(this.ziel.x - pos.x, this.ziel.z - pos.z) < 0.5) {
        this.ziel = this.neuesBummelZiel(inselRadius);
      }
      richtung = new THREE.Vector3(this.ziel.x - pos.x, 0, this.ziel.z - pos.z).normalize();
      tempo = TEMPO_BUMMELN;
    }

    // 2) Bewegen – mit derselben Kollision wie der Spieler
    const blockiert = bewegeMitKollision(
      pos, richtung.x * tempo * dt, richtung.z * tempo * dt, hindernisse, inselRadius, GEGNER_RADIUS,
    );
    if (blockiert && !this.jagt) this.ziel = null; // gegen etwas gelaufen → anderes Ziel suchen

    // 3) Drehen, Wippen, Arme und Beine
    dreheZu(this.gruppe, richtung.x, richtung.z, dt, 8);
    this.belebe(dt, tempo);
  }

  // Besiegt: dreht sich, schrumpft weg – und kommt nach einer Weile am Startplatz zurück.
  verschwinde(dt, spielerPos) {
    const g = this.gruppe;
    if (g.visible) {
      g.rotation.y += dt * 20;
      g.scale.setScalar(Math.max(0, g.scale.x - dt * 3));
      if (g.scale.x === 0) g.visible = false; // nur verstecken, nicht löschen (Teile sind geteilt)
    }

    this.wiederkommen -= dt;
    // Nicht direkt neben dir auftauchen – lieber warten, bis du weiter weg bist.
    const abstandZumStart = Math.hypot(spielerPos.x - this.start.x, spielerPos.z - this.start.z);
    if (this.wiederkommen <= 0 && abstandZumStart > 6) this.zuruecksetzen();
  }

  // Zufälliger Punkt in der Nähe des Startplatzes (aber auf der Insel)
  neuesBummelZiel(inselRadius) {
    const winkel = Math.random() * Math.PI * 2;
    const abstand = Math.random() * BUMMEL_RADIUS;
    const ziel = new THREE.Vector3(
      this.start.x + Math.cos(winkel) * abstand, 0, this.start.z + Math.sin(winkel) * abstand,
    );
    const maxAbstand = inselRadius - 1;
    if (ziel.length() > maxAbstand) ziel.setLength(maxAbstand);
    return ziel;
  }

  // Lauf-Animation: je schneller, desto hektischer
  belebe(dt, tempo) {
    this.laufZeit += dt * tempo;
    const schritt = this.laufZeit * 3.5;
    this.schwungStaerke += (1 - this.schwungStaerke) * Math.min(1, dt * 5);

    this.animGruppe.position.y = Math.abs(Math.cos(schritt)) * 0.08;
    this.animGruppe.rotation.x = this.jagt ? 0.25 : 0.08; // beim Jagen nach vorne gebeugt
    schwingeGlieder(this.glieder, Math.sin(schritt) * GEGNER_EINSTELLUNGEN.schwung * this.schwungStaerke);
  }
}

// Ersatz-Gegner, falls keine enemy.glb da ist: eine rote Stachelkugel mit bösen Augen.
export function erstelleGegnerPlatzhalter() {
  const gegner = new THREE.Group();

  const koerper = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.6, 0),
    new THREE.MeshStandardMaterial({ color: '#e63946', flatShading: true }),
  );
  koerper.position.y = 0.7;
  gegner.add(koerper);

  // Stacheln
  for (let i = 0; i < 8; i++) {
    const stachel = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.35, 5),
      new THREE.MeshStandardMaterial({ color: '#6a040f', flatShading: true }),
    );
    const winkel = (i / 8) * Math.PI * 2;
    stachel.position.set(Math.cos(winkel) * 0.6, 0.85, Math.sin(winkel) * 0.6);
    stachel.lookAt(Math.cos(winkel) * 2, 0.85, Math.sin(winkel) * 2);
    stachel.rotateX(Math.PI / 2); // Spitze nach außen
    gegner.add(stachel);
  }

  // Böse Augen (schauen nach +z)
  for (const seite of [-1, 1]) {
    const auge = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    );
    auge.position.set(seite * 0.2, 0.85, 0.48);
    gegner.add(auge);

    const braue = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.06, 0.06),
      new THREE.MeshStandardMaterial({ color: '#222222' }),
    );
    braue.position.set(seite * 0.2, 1.02, 0.55);
    braue.rotation.z = seite * 0.4; // schräg = grimmig
    gegner.add(braue);
  }

  return gegner;
}
