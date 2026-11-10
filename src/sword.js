// sword.js – das Schwert: laden und so vorbereiten, dass man es in die Hand nehmen kann.
import * as THREE from 'three';
import { loader, normalisiere, bereiteVor } from './figur.js';

// ───────────────────────────────────────────────────────────────
// EINSTELLUNGEN FÜR DAS SCHWERT
// ───────────────────────────────────────────────────────────────
export const SCHWERT_EINSTELLUNGEN = {
  // Länge des Schwerts im Spiel (deine Figur ist 1,5 hoch).
  laenge: 0.9,
  // Wo der Griff ist, von unten gemessen (0 = ganz unten, 0.2 = ein Fünftel hoch).
  griff: 0.2,
  // Das Spiel erwartet: Schwert steht aufrecht, Griff UNTEN, Klinge OBEN.
  // Hast du es in Paint 3D andersherum gebaut? Dann hier true eintragen.
  umdrehen: false,
  // Klinge etwas nach oben halten (in Grad). 0 = ganz waagerecht nach vorne.
  anheben: 20,
  ohneMetall: true, // sonst sieht die Klinge in Three.js fast schwarz aus
};

// Lädt sword.glb und gibt das Modell zurück.
export async function ladeSchwertVorlage(url) {
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}

// Macht aus einem Schwert-Modell ein "griffbereites" Schwert:
// Der Griff liegt im Nullpunkt, die Klinge zeigt nach vorne (+z) und etwas nach oben.
export function machGriffbereit(modell) {
  const e = SCHWERT_EINSTELLUNGEN;

  // Drei Gruppen ineinander, jede hat eine Aufgabe:
  const ausrichtung = new THREE.Group(); // dreht die Klinge nach vorne
  const groesse = new THREE.Group();     // Länge + Griff im Nullpunkt
  const huelle = new THREE.Group();      // ggf. umgedreht
  ausrichtung.add(groesse);
  groesse.add(huelle);
  huelle.add(modell);

  if (e.umdrehen) modell.rotation.x = Math.PI;

  // Aufrecht hinstellen und auf die richtige Länge bringen (wie bei den Figuren:
  // "zielHoehe" ist hier einfach die Schwertlänge, die "Füße" sind das Griff-Ende).
  normalisiere(huelle, groesse, { zielHoehe: e.laenge, rotationY: 0, skalierung: 1 });
  bereiteVor(modell, e);

  // Griff in den Nullpunkt schieben: die Hand hält das Schwert dort fest.
  groesse.position.y = -e.laenge * e.griff;

  // Aufrecht (+y) → nach vorne (+z) kippen, dann etwas anheben.
  ausrichtung.rotation.x = Math.PI / 2 - THREE.MathUtils.degToRad(e.anheben);

  return ausrichtung;
}

// Ersatz-Schwert, falls keine sword.glb da ist (aufrecht, Griff unten – wie aus Paint 3D).
export function erstelleSchwertPlatzhalter() {
  const schwert = new THREE.Group();
  const teil = (form, farbe, y) => {
    const mesh = new THREE.Mesh(form, new THREE.MeshStandardMaterial({ color: farbe, flatShading: true }));
    mesh.position.y = y;
    schwert.add(mesh);
  };
  teil(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 6), '#7a4a2a', 0.11);   // Griff
  teil(new THREE.BoxGeometry(0.3, 0.05, 0.08), '#f2c14e', 0.24);            // Parierstange
  teil(new THREE.BoxGeometry(0.08, 0.7, 0.03), '#d9e2ec', 0.62);            // Klinge
  return schwert;
}
