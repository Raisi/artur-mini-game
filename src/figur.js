// figur.js – Werkzeuge, die Spieler UND Gegner benutzen:
// Paint-3D-Modelle laden und anpassen, Arme/Beine finden, Kollision mit Hindernissen.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const loader = new GLTFLoader();

// ───────────────────────────────────────────────────────────────
// Modell vorbereiten
// ───────────────────────────────────────────────────────────────

// Bringt ein beliebiges Modell auf Normalmaß:
// Mitte auf x/z = 0, Füße auf y = 0, Höhe = einstellungen.zielHoehe.
// "halter" ist die Gruppe, in die das Modell später kommt – sie wird passend skaliert.
export function normalisiere(modell, halter, einstellungen) {
  const e = einstellungen;

  // Zuerst die Wunsch-Drehung, dann messen (sonst stimmt die Mitte nicht).
  modell.position.set(0, 0, 0);
  modell.rotation.set(0, THREE.MathUtils.degToRad(e.rotationY), 0);
  modell.scale.set(1, 1, 1);
  modell.updateMatrixWorld(true);

  // Box3 = unsichtbarer Kasten, der genau um das ganze Modell passt.
  const kasten = new THREE.Box3().setFromObject(modell, true);
  const groesse = kasten.getSize(new THREE.Vector3());
  const mitte = kasten.getCenter(new THREE.Vector3());

  // Modell so verschieben, dass die Fußmitte genau im Nullpunkt liegt …
  modell.position.set(-mitte.x, -kasten.min.y, -mitte.z);

  // … und den Halter so skalieren, dass die Höhe passt.
  const faktor = groesse.y > 0 ? (e.zielHoehe / groesse.y) * e.skalierung : 1;
  halter.scale.setScalar(faktor);

  modell.updateMatrixWorld(true); // neue Position übernehmen (braucht findeGlieder)
}

// Schatten an, und bei Bedarf den Metall-Glanz aus
// (Paint-3D-Modelle wirken in Three.js sonst oft sehr dunkel).
export function bereiteVor(modell, einstellungen) {
  modell.traverse((teil) => {
    if (!teil.isMesh) return;
    teil.castShadow = true;
    teil.receiveShadow = true;
    if (einstellungen.ohneMetall) {
      const liste = Array.isArray(teil.material) ? teil.material : [teil.material];
      for (const m of liste) {
        if ('metalness' in m) m.metalness = 0;
      }
    }
  });
}

// Gibt Grafikspeicher eines alten Modells frei (Formen, Materialien, Bilder).
export function gibSpeicherFrei(modell) {
  modell.traverse((teil) => {
    if (!teil.isMesh) return;
    teil.geometry.dispose();
    const liste = Array.isArray(teil.material) ? teil.material : [teil.material];
    for (const m of liste) {
      for (const wert of Object.values(m)) {
        if (wert && wert.isTexture) wert.dispose();
      }
      m.dispose();
    }
  });
}

// ───────────────────────────────────────────────────────────────
// Arme und Beine (für den Lauf-Zyklus)
// ───────────────────────────────────────────────────────────────

// Sucht Arme und Beine im Modell und gibt jedem einen Drehpunkt (Hüfte bzw. Schulter).
// Paint 3D speichert jedes Teil einer Figur als eigenes Objekt – das nutzen wir aus:
//  - Beine:  berühren den Boden und reichen nicht höher als bis zur Hälfte der Figur
//  - Arme:   sitzen auf mittlerer Höhe weit außen links und rechts
// Gibt null zurück, wenn nichts Passendes gefunden wird (z. B. bei der Kapsel).
// Wichtig: vorher normalisiere() aufrufen!
export function findeGlieder(modell) {
  // Jedes Teil vermessen. Das Modell ist gerade normalisiert: Füße auf y = 0, Mitte bei x = 0.
  const teile = [];
  modell.traverse((teil) => {
    if (!teil.isMesh) return;
    teil.geometry.computeBoundingBox();
    const kasten = teil.geometry.boundingBox.clone().applyMatrix4(teil.matrixWorld);
    teile.push({ teil, kasten, mitte: kasten.getCenter(new THREE.Vector3()) });
  });

  const gesamt = new THREE.Box3().setFromObject(modell);
  const H = gesamt.max.y; // Höhe der ganzen Figur
  const B = gesamt.max.x - gesamt.min.x; // Breite der ganzen Figur

  const istBein = ({ kasten }) =>
    kasten.min.y < H * 0.05 && kasten.max.y < H * 0.6;
  const istArm = ({ kasten, mitte }) =>
    Math.abs(mitte.x) > B * 0.2 &&
    mitte.y > H * 0.3 && mitte.y < H * 0.8 &&
    kasten.min.y > H * 0.1 &&
    kasten.max.y - kasten.min.y > H * 0.15; // keine winzigen Knöpfe o. Ä.

  // Genau ein Teil links und eines rechts – sonst lieber gar nichts bewegen.
  const paar = (liste) => {
    const links = liste.filter((t) => t.mitte.x < 0);
    const rechts = liste.filter((t) => t.mitte.x > 0);
    return links.length === 1 && rechts.length === 1 ? [links[0], rechts[0]] : null;
  };
  const beinPaar = paar(teile.filter(istBein));
  const armPaar = paar(teile.filter(istArm));
  if (!beinPaar && !armPaar) return null;

  // Hängt ein Teil an einen neuen, unsichtbaren Drehpunkt an seiner Oberkante.
  const anDrehpunkt = ({ teil, kasten, mitte }) => {
    const drehpunkt = new THREE.Group();
    modell.add(drehpunkt);
    // Oberkante (Hüfte/Schulter) liegt etwas unter dem höchsten Punkt des Teils
    const oben = new THREE.Vector3(mitte.x, kasten.max.y - (kasten.max.y - kasten.min.y) * 0.08, mitte.z);
    drehpunkt.position.copy(modell.worldToLocal(oben));
    drehpunkt.attach(teil); // attach behält die Lage des Teils bei
    drehpunkt.userData.laenge = kasten.max.y - kasten.min.y; // z. B. um die Hand zu finden
    return drehpunkt;
  };

  return {
    beine: beinPaar && beinPaar.map(anDrehpunkt),
    arme: armPaar && armPaar.map(anDrehpunkt),
    achse: seitenAchse(modell),
  };
}

// Drehachse "links-rechts" aus Sicht der Figur. Wegen rotationY muss sie
// in die Richtung des Modells umgerechnet werden.
export function seitenAchse(modell) {
  return new THREE.Vector3(1, 0, 0).applyQuaternion(modell.quaternion.clone().invert());
}

// Dreht Arme und Beine um "winkel" (im Bogenmaß).
// Beine gegeneinander; jeder Arm schwingt gegen das Bein auf seiner Seite.
export function schwingeGlieder(glieder, winkel) {
  if (!glieder) return;
  const { beine, arme, achse } = glieder;
  if (beine) {
    beine[0].quaternion.setFromAxisAngle(achse, winkel);
    beine[1].quaternion.setFromAxisAngle(achse, -winkel);
  }
  if (arme) {
    arme[0].quaternion.setFromAxisAngle(achse, -winkel * 0.8);
    arme[1].quaternion.setFromAxisAngle(achse, winkel * 0.8);
  }
}

// ───────────────────────────────────────────────────────────────
// Kollision mit Hindernissen
// ───────────────────────────────────────────────────────────────

// Prüft, ob eine Figur (Füße bei pos, Dicke radius) in einem Hindernis steckt.
export function stoesstAn(pos, hindernisse, radius) {
  for (const box of hindernisse) {
    // Steht die Figur oben drauf (oder darüber)? Dann kein Zusammenstoß.
    if (pos.y >= box.max.y - 0.05) continue;
    if (
      pos.x + radius > box.min.x && pos.x - radius < box.max.x &&
      pos.z + radius > box.min.z && pos.z - radius < box.max.z
    ) {
      return true;
    }
  }
  return false;
}

// Bewegt pos um (dx, dz) – erst x, dann z. So "rutscht" man an Kisten entlang,
// statt daran kleben zu bleiben. Am Inselrand wird festgehalten.
// Gibt true zurück, wenn ein Hindernis im Weg war.
export function bewegeMitKollision(pos, dx, dz, hindernisse, inselRadius, radius) {
  let blockiert = false;

  const altX = pos.x;
  pos.x += dx;
  if (stoesstAn(pos, hindernisse, radius)) { pos.x = altX; blockiert = true; }

  const altZ = pos.z;
  pos.z += dz;
  if (stoesstAn(pos, hindernisse, radius)) { pos.z = altZ; blockiert = true; }

  const abstand = Math.hypot(pos.x, pos.z);
  const maxAbstand = inselRadius - 0.5;
  if (abstand > maxAbstand) {
    pos.x *= maxAbstand / abstand;
    pos.z *= maxAbstand / abstand;
    blockiert = true;
  }
  return blockiert;
}

// Wie hoch ist der Boden unter der Figur? (Inselboden = 0, oder Oberseite einer Kiste)
// altY = Höhe im letzten Bild. War die Figur da noch über der Kiste, landet sie oben drauf –
// auch wenn sie in diesem Bild (bei ruckeligem Spiel) schon ein Stück "hineingefallen" ist.
export function bodenHoehe(pos, altY, hindernisse, radius) {
  let boden = 0;
  for (const box of hindernisse) {
    const darueber =
      pos.x + radius > box.min.x && pos.x - radius < box.max.x &&
      pos.z + radius > box.min.z && pos.z - radius < box.max.z;
    const warOben = Math.max(pos.y, altY) >= box.max.y - 0.25;
    if (darueber && warOben && box.max.y > boden) {
      boden = box.max.y;
    }
  }
  return boden;
}

// Dreht eine Gruppe sanft in Richtung (x, z) – über den kürzesten Weg.
export function dreheZu(gruppe, x, z, dt, tempo = 12) {
  const zielWinkel = Math.atan2(x, z);
  let diff = zielWinkel - gruppe.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // auf -π..π bringen
  gruppe.rotation.y += diff * Math.min(1, dt * tempo);
}
