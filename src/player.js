// player.js – die Spielfigur: Laden, Bewegung, Springen und "Lebendigkeit".
// Gemeinsame Werkzeuge (Normalisieren, Arme/Beine, Kollision) stehen in figur.js.
import * as THREE from 'three';
import {
  loader, normalisiere, bereiteVor, gibSpeicherFrei, findeGlieder, schwingeGlieder,
  bewegeMitKollision, bodenHoehe, dreheZu, seitenAchse,
} from './figur.js';
import { machGriffbereit } from './sword.js';

// ───────────────────────────────────────────────────────────────
// EINSTELLUNGEN FÜR DEINE FIGUR – hier darfst du herumprobieren!
// ───────────────────────────────────────────────────────────────
export const FIGUR_EINSTELLUNGEN = {
  // Wie hoch die Figur im Spiel sein soll (in Einheiten, eine Kiste ist 1–2 hoch).
  zielHoehe: 1.5,
  // Zusätzliche Drehung in Grad, falls die Figur in die falsche Richtung schaut.
  // Probiere 90, 180 oder -90.
  rotationY: 0,
  // Extra-Größenfaktor: 1 = normal, 1.5 = größer, 0.7 = kleiner.
  skalierung: 1,
  // Paint-3D-Modelle wirken in Three.js oft dunkel und "metallisch".
  // true = Metall-Glanz ausschalten, damit die Farben so bunt aussehen wie in Paint 3D.
  ohneMetall: true,
  // Wie weit Arme und Beine beim Laufen schwingen (0 = gar nicht, 0.6 = normal, 1 = wild).
  // Klappt nur, wenn Arme und Beine in Paint 3D eigene Teile sind.
  schwung: 0.6,
};

// Werte für die Bewegung
const GESCHWINDIGKEIT = 6;  // Einheiten pro Sekunde
const SPRUNGKRAFT = 9.5;    // Startgeschwindigkeit nach oben (reicht für Kisten bis ca. 1,6 hoch)
const SCHWERKRAFT = 25;     // zieht die Figur nach unten
export const SPIELER_RADIUS = 0.4; // "Dicke" der Figur für die Kollision
const SCHWUNG_DAUER = 0.4;  // so lange dauert ein Schwerthieb (Sekunden)

export class Spieler {
  constructor(scene) {
    // Die Figur steckt in drei ineinander verschachtelten Gruppen:
    //  1. gruppe        → Position auf der Insel und Blickrichtung
    //  2. animGruppe    → Wippen, Neigen, Squash & Stretch (Drehpunkt an den Füßen!)
    //  3. modellHalter  → enthält das eigentliche 3D-Modell (normalisiert)
    this.gruppe = new THREE.Group();
    this.animGruppe = new THREE.Group();
    this.modellHalter = new THREE.Group();
    this.gruppe.add(this.animGruppe);
    this.animGruppe.add(this.modellHalter);
    scene.add(this.gruppe);

    this.modell = null;                       // aktuell angezeigtes Modell
    this.ladeNummer = 0;                      // zählt Ladevorgänge (siehe ladeFigur)
    this.geschwindigkeit = new THREE.Vector3(); // nur y (Fallen/Springen) wird gespeichert
    this.rueckstoss = new THREE.Vector3();    // Schubs nach einem Treffer (nur x/z)
    this.amBoden = true;
    this.laufZeit = 0;   // zählt beim Laufen hoch, für das Wippen
    this.squash = 0;     // > 0 = gestreckt, < 0 = gestaucht
    this.squashTempo = 0;
    this.neigung = 0;
    this.glieder = null;   // gefundene Arme und Beine (siehe findeGlieder)
    this.schwungStaerke = 0; // 0 = Arme/Beine hängen still, 1 = voller Schwung

    // Schwert: hängt im "schwertHalter", und der hängt am rechten Arm (schwertArm).
    this.schwert = null;
    this.schwertHalter = new THREE.Group();
    this.schwertArm = null;  // { drehpunkt, laenge, achse }
    this.angriffZeit = -1;   // -1 = kein Hieb, sonst Sekunden seit Hieb-Beginn
    this.schlagNummer = 0;   // zählt die Hiebe (jeder Gegner wird pro Hieb nur 1x getroffen)
  }

  // Lädt eine .glb-Datei von einer Adresse (Pfad oder Blob-URL).
  // Wirft einen Fehler, wenn das nicht klappt – wer aufruft, entscheidet, was dann passiert.
  async ladeFigur(url) {
    // Jede Ladung bekommt eine Nummer. Kommt eine ältere Ladung erst nach einer neueren an
    // (z. B. zwei Dateien schnell hintereinander reingezogen), wird sie ignoriert.
    const nummer = ++this.ladeNummer;
    const gltf = await loader.loadAsync(url);
    if (nummer !== this.ladeNummer) return;
    this.setzeModell(gltf.scene);
  }

  // Zeigt die bunte Kapsel als Platzhalter an.
  zeigePlatzhalter() {
    this.setzeModell(erstellePlatzhalter());
  }

  // Tauscht das Modell aus: altes aufräumen, neues normalisieren und einsetzen.
  setzeModell(neuesModell) {
    if (this.modell) {
      this.schwertHalter.removeFromParent(); // Schwert retten, bevor das alte Modell weg ist
      this.modellHalter.remove(this.modell);
      gibSpeicherFrei(this.modell);
    }

    normalisiere(neuesModell, this.modellHalter, FIGUR_EINSTELLUNGEN);
    this.glieder = findeGlieder(neuesModell);
    this.schwertArm = findeSchwertArm(neuesModell, this.glieder);
    bereiteVor(neuesModell, FIGUR_EINSTELLUNGEN);

    this.modellHalter.add(neuesModell);
    this.modell = neuesModell;
    this.haengeSchwertAn();
  }

  // Bekommt das geladene Schwert und gibt es der Figur in die Hand.
  setzeSchwert(vorlage) {
    if (this.schwert) this.schwertHalter.remove(this.schwert);
    this.schwert = machGriffbereit(vorlage);
    this.schwertHalter.add(this.schwert);
    this.haengeSchwertAn();
  }

  // Setzt den Schwert-Halter an die Hand des Schwert-Arms.
  // Klappt in jeder Reihenfolge: egal, ob zuerst Figur oder Schwert fertig geladen ist.
  haengeSchwertAn() {
    if (!this.schwertArm) return;
    const { drehpunkt, laenge } = this.schwertArm;
    // Die Hand ist am unteren Ende des Arms (der Drehpunkt ist die Schulter).
    this.schwertHalter.position.set(0, -laenge * 0.85, 0);
    // Der Arm steckt im verkleinerten/vergrößerten Modell – das gleichen wir aus,
    // damit das Schwert immer gleich groß ist …
    this.schwertHalter.scale.setScalar(1 / this.modellHalter.scale.x);
    // … und auch eine Drehung der Figur (rotationY), damit die Klinge nach vorne zeigt.
    this.schwertHalter.quaternion.copy(this.modell.quaternion).invert();
    drehpunkt.add(this.schwertHalter);
  }

  // Schwerthieb starten (wenn nicht schon einer läuft)
  angreifen() {
    if (this.angriffZeit >= 0 || !this.schwert) return;
    this.angriffZeit = 0;
    this.schlagNummer++;
  }

  // Ist das Schwert gerade im "gefährlichen" Teil des Hiebs?
  trifftGerade() {
    const t = this.angriffZeit / SCHWUNG_DAUER;
    return this.angriffZeit >= 0 && t >= 0.35 && t <= 0.6;
  }

  // Blickrichtung der Figur als Vektor (x/z)
  blickRichtung() {
    const winkel = this.gruppe.rotation.y;
    return new THREE.Vector3(Math.sin(winkel), 0, Math.cos(winkel));
  }

  // Zurück an den Start (für den Neustart).
  zuruecksetzen() {
    this.gruppe.position.set(0, 0, 0);
    this.gruppe.rotation.y = 0;
    this.geschwindigkeit.set(0, 0, 0);
    this.rueckstoss.set(0, 0, 0);
    this.amBoden = true;
    this.squash = 0;
    this.squashTempo = 0;
    this.laufZeit = 0;
    this.neigung = 0;
    this.schwungStaerke = 0;
    this.angriffZeit = -1;
    // Schwert-Arm gerade hinhängen (wichtig, falls mitten im Hieb neu gestartet wird)
    if (this.schwertArm) this.schwertArm.drehpunkt.quaternion.identity();
    this.modellHalter.visible = true;
  }

  // Getroffen! Die Figur wird von "vonPosition" weggeschubst und hüpft kurz hoch.
  schubsWeg(vonPosition) {
    const pos = this.gruppe.position;
    const weg = new THREE.Vector3(pos.x - vonPosition.x, 0, pos.z - vonPosition.z);
    if (weg.lengthSq() < 0.0001) weg.set(0, 0, 1); // genau übereinander? Dann nach hinten.
    this.rueckstoss.copy(weg.normalize().multiplyScalar(10));
    this.geschwindigkeit.y = 5;
    this.amBoden = false;
  }

  // Wird jedes Bild aufgerufen. dt = vergangene Zeit in Sekunden.
  aktualisiere(dt, eingabe, hindernisse, inselRadius) {
    const pos = this.gruppe.position;

    // 1) Richtung aus den Tasten bestimmen (W = weg von der Kamera = -z)
    const richtung = new THREE.Vector3(
      (eingabe.rechts ? 1 : 0) - (eingabe.links ? 1 : 0),
      0,
      (eingabe.zurueck ? 1 : 0) - (eingabe.vor ? 1 : 0),
    );
    const bewegtSich = richtung.lengthSq() > 0;
    if (bewegtSich) richtung.normalize();

    // 2) Seitlich bewegen (Laufen + evtl. Rückstoß), mit Kollision und Inselrand.
    //    Der Rückstoß läuft durch dieselbe Prüfung – so landet man nie in einer Kiste.
    const dx = (richtung.x * GESCHWINDIGKEIT + this.rueckstoss.x) * dt;
    const dz = (richtung.z * GESCHWINDIGKEIT + this.rueckstoss.z) * dt;
    bewegeMitKollision(pos, dx, dz, hindernisse, inselRadius, SPIELER_RADIUS);
    this.rueckstoss.multiplyScalar(Math.exp(-5 * dt)); // Schubs wird schnell schwächer

    // 3) Springen und Schwerkraft
    if (eingabe.springen && this.amBoden) {
      this.geschwindigkeit.y = SPRUNGKRAFT;
      this.amBoden = false;
      this.squashTempo = 4; // kleiner Schubs ins "Strecken"
    }
    this.geschwindigkeit.y -= SCHWERKRAFT * dt;
    const altY = pos.y;
    pos.y += this.geschwindigkeit.y * dt;

    const boden = bodenHoehe(pos, altY, hindernisse, SPIELER_RADIUS);
    if (pos.y <= boden) {
      if (!this.amBoden && this.geschwindigkeit.y < -3) {
        // Aufprall! Je schneller, desto stärker gestaucht.
        this.squash = Math.max(-0.4, this.geschwindigkeit.y * 0.035);
        this.squashTempo = 0;
      }
      pos.y = boden;
      this.geschwindigkeit.y = 0;
      this.amBoden = true;
    } else {
      this.amBoden = false;
    }

    // 4) In Laufrichtung drehen
    if (bewegtSich) dreheZu(this.gruppe, richtung.x, richtung.z, dt);

    // 5) Schwert
    if (eingabe.angriff) this.angreifen();
    if (this.angriffZeit >= 0) {
      this.angriffZeit += dt;
      if (this.angriffZeit >= SCHWUNG_DAUER) this.angriffZeit = -1; // Hieb fertig
    }

    this.belebe(dt, bewegtSich);
  }

  // "Lebendig" wirken ohne echte Animationen: Wippen, Neigen, Squash & Stretch, Lauf-Zyklus.
  belebe(dt, bewegtSich) {
    const anim = this.animGruppe;

    // Wippen beim Laufen: Am höchsten ist die Figur, wenn die Beine gerade
    // aneinander vorbeischwingen (cos = 1), am tiefsten bei weitem Schritt (cos = 0).
    if (bewegtSich && this.amBoden) this.laufZeit += dt;
    const schritt = this.laufZeit * 14;
    const wippZiel = bewegtSich && this.amBoden ? Math.abs(Math.cos(schritt)) * 0.12 : 0;
    anim.position.y += (wippZiel - anim.position.y) * Math.min(1, dt * 20);

    // Nach vorne neigen beim Laufen + leichtes Hin-und-her-Schaukeln
    const neigZiel = bewegtSich ? 0.18 : 0;
    this.neigung += (neigZiel - this.neigung) * Math.min(1, dt * 8);
    anim.rotation.x = this.neigung;
    const schaukelZiel = bewegtSich && this.amBoden ? Math.sin(schritt) * 0.07 : 0;
    anim.rotation.z += (schaukelZiel - anim.rotation.z) * Math.min(1, dt * 15);

    // Lauf-Zyklus: Arme und Beine schwingen hin und her.
    // In der Luft bleibt die Pose "eingefroren" – das sieht nach Sprung aus.
    if (this.amBoden) {
      const schwungZiel = bewegtSich ? 1 : 0;
      this.schwungStaerke += (schwungZiel - this.schwungStaerke) * Math.min(1, dt * 10);
    }
    schwingeGlieder(this.glieder, Math.sin(schritt) * FIGUR_EINSTELLUNGEN.schwung * this.schwungStaerke);

    // Schwerthieb: Der Schwert-Arm macht etwas anderes als beim Laufen.
    // (Muss NACH schwingeGlieder kommen, sonst würde das Laufen den Hieb überschreiben.)
    if (this.angriffZeit >= 0 && this.schwertArm) {
      const t = this.angriffZeit / SCHWUNG_DAUER; // 0 … 1
      const { drehpunkt, achse } = this.schwertArm;
      drehpunkt.quaternion.setFromAxisAngle(achse, schwungWinkel(t));
      // Beim Zuschlagen beugt sich die ganze Figur kurz nach vorne
      anim.rotation.x += 0.25 * Math.sin(Math.PI * THREE.MathUtils.clamp((t - 0.25) / 0.45, 0, 1));
    }

    // Squash & Stretch: in der Luft je nach Tempo strecken, sonst zurück zu 0.
    // Eine kleine "Feder" sorgt dafür, dass es nachwackelt.
    const squashZiel = this.amBoden ? 0 : THREE.MathUtils.clamp(this.geschwindigkeit.y * 0.03, -0.12, 0.25);
    this.squashTempo += (squashZiel - this.squash) * 300 * dt; // Federkraft
    this.squashTempo *= Math.exp(-12 * dt);                    // Dämpfung
    this.squash += this.squashTempo * dt;
    this.squash = Math.max(-0.5, this.squash);

    // Volumen bleibt gleich: wird die Figur höher, wird sie schmaler (und umgekehrt).
    const hoehe = 1 + this.squash;
    const breite = 1 / Math.sqrt(hoehe);
    anim.scale.set(breite, hoehe, breite);
  }
}

// Wie weit der Schwert-Arm während eines Hiebs gedreht ist. t läuft von 0 bis 1.
// Negativ = Arm nach vorne/oben, 0 = Arm hängt locker herunter.
function schwungWinkel(t) {
  if (t < 0.3) {
    // 1. Ausholen: Arm hoch über den Kopf (wird langsamer, wie beim Spannen)
    const u = t / 0.3;
    return -2.6 * (1 - (1 - u) * (1 - u));
  }
  if (t < 0.5) {
    // 2. Zuschlagen: schnell nach vorne-unten (wird immer schneller)
    const u = (t - 0.3) / 0.2;
    return -2.6 + 2.8 * u * u;
  }
  // 3. Zurück in die Ruhehaltung
  const u = (t - 0.5) / 0.5;
  return 0.2 * (1 - u * u * (3 - 2 * u));
}

// Welcher Arm hält das Schwert? Der rechte (aus Sicht der Figur liegt er bei x < 0).
// Hat die Figur keine eigenen Arme (z. B. die Kapsel), bekommt sie einen unsichtbaren
// Drehpunkt an der Seite – dann schwebt das Schwert neben ihr.
function findeSchwertArm(modell, glieder) {
  const arm = glieder?.arme?.[0];
  if (arm) return { drehpunkt: arm, laenge: arm.userData.laenge, achse: glieder.achse };

  const kasten = new THREE.Box3().setFromObject(modell);
  const drehpunkt = new THREE.Group();
  modell.add(drehpunkt);
  const schulter = new THREE.Vector3(kasten.min.x * 0.95, kasten.max.y * 0.6, 0);
  drehpunkt.position.copy(modell.worldToLocal(schulter));
  return { drehpunkt, laenge: kasten.max.y * 0.3, achse: seitenAchse(modell) };
}

// Die bunte Ersatz-Figur: eine Kapsel mit Augen und Mütze.
function erstellePlatzhalter() {
  const figur = new THREE.Group();

  const koerper = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 0.6, 6, 12),
    new THREE.MeshStandardMaterial({ color: '#ff6fb5', flatShading: true }),
  );
  koerper.position.y = 0.75;
  figur.add(koerper);

  const bauch = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#ffd166', flatShading: true }),
  );
  bauch.position.set(0, 0.6, 0.36);
  bauch.scale.z = 0.5;
  figur.add(bauch);

  // Augen schauen nach +z (das ist "vorne" für unsere Figur)
  for (const seite of [-1, 1]) {
    const auge = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    );
    auge.position.set(seite * 0.17, 1.05, 0.38);
    figur.add(auge);

    const pupille = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#222244' }),
    );
    pupille.position.set(seite * 0.17, 1.05, 0.48);
    figur.add(pupille);
  }

  const muetze = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.45, 8),
    new THREE.MeshStandardMaterial({ color: '#4ecdc4', flatShading: true }),
  );
  muetze.position.y = 1.5;
  figur.add(muetze);

  return figur;
}
