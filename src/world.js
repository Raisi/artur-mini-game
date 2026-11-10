// world.js – baut die Spielwelt: Himmel, Licht, Insel, Wasser und Hindernisse.
import * as THREE from 'three';

// Wie groß die begehbare Insel ist (Radius in Einheiten).
export const INSEL_RADIUS = 20;

// Hilfsfunktion: ein Material im "Low-Poly"-Look (flache Kanten statt runder Schattierung).
function lowPoly(farbe) {
  return new THREE.MeshStandardMaterial({ color: farbe, flatShading: true, roughness: 0.9 });
}

// Himmel als Farbverlauf: Wir malen einen Verlauf auf eine kleine Leinwand
// und benutzen das Bild als Hintergrund der Szene.
function erstelleHimmel(scene) {
  const leinwand = document.createElement('canvas');
  leinwand.width = 2;
  leinwand.height = 256;
  const ctx = leinwand.getContext('2d');
  const verlauf = ctx.createLinearGradient(0, 0, 0, 256);
  verlauf.addColorStop(0, '#4fa8ff');   // oben: kräftiges Blau
  verlauf.addColorStop(0.6, '#a8dcff'); // Mitte: hellblau
  verlauf.addColorStop(1, '#ffe8c4');   // Horizont: warmes Gelb
  ctx.fillStyle = verlauf;
  ctx.fillRect(0, 0, 2, 256);

  const textur = new THREE.CanvasTexture(leinwand);
  textur.colorSpace = THREE.SRGBColorSpace;
  scene.background = textur;

  // Nebel in Horizontfarbe lässt weit entfernte Dinge sanft verschwinden.
  scene.fog = new THREE.Fog('#cfe9ff', 35, 90);
}

// Licht: Himmelslicht (von oben blau, von unten grün) + Sonne mit Schatten.
function erstelleLicht(scene) {
  const himmelsLicht = new THREE.HemisphereLight('#bfe3ff', '#7cc46a', 1.6);
  scene.add(himmelsLicht);

  const sonne = new THREE.DirectionalLight('#fff3d6', 2.2);
  sonne.position.set(15, 25, 10);
  sonne.castShadow = true;
  // Der "Schattenbereich" muss die ganze Insel abdecken.
  sonne.shadow.mapSize.set(2048, 2048);
  const s = sonne.shadow.camera;
  s.left = -INSEL_RADIUS - 2;
  s.right = INSEL_RADIUS + 2;
  s.top = INSEL_RADIUS + 2;
  s.bottom = -INSEL_RADIUS - 2;
  s.near = 1;
  s.far = 70;
  sonne.shadow.bias = -0.0005;
  scene.add(sonne);
}

// Die Insel: oben Gras, an der Seite Erde, drumherum Wasser.
function erstelleInsel(scene) {
  const gras = new THREE.Mesh(
    new THREE.CylinderGeometry(INSEL_RADIUS + 1, INSEL_RADIUS + 1, 0.6, 24),
    lowPoly('#7ed957'),
  );
  gras.position.y = -0.3; // Oberkante liegt genau bei y = 0
  gras.receiveShadow = true;
  scene.add(gras);

  const erde = new THREE.Mesh(
    new THREE.CylinderGeometry(INSEL_RADIUS + 1, INSEL_RADIUS - 3, 4, 24),
    lowPoly('#b5835a'),
  );
  erde.position.y = -2.6;
  scene.add(erde);

  const wasser = new THREE.Mesh(
    new THREE.CircleGeometry(200, 32),
    new THREE.MeshStandardMaterial({ color: '#3fb6e8', roughness: 0.3, transparent: true, opacity: 0.9 }),
  );
  wasser.rotation.x = -Math.PI / 2;
  wasser.position.y = -1.2;
  scene.add(wasser);
}

// Eine Kiste. Gibt die Kollisionsbox zurück.
function erstelleKiste(scene, x, z, groesse, farbe) {
  const kiste = new THREE.Mesh(new THREE.BoxGeometry(groesse, groesse, groesse), lowPoly(farbe));
  kiste.position.set(x, groesse / 2, z);
  kiste.rotation.y = 0; // nicht drehen, damit die Box zur Kollisionsbox passt
  kiste.castShadow = true;
  kiste.receiveShadow = true;
  scene.add(kiste);
  return new THREE.Box3().setFromObject(kiste);
}

// Ein Baum aus Zylinder (Stamm) und zwei Kegeln (Krone).
function erstelleBaum(scene, x, z, hoehe) {
  const baum = new THREE.Group();

  const stamm = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, hoehe * 0.4, 6), lowPoly('#8a5a3b'));
  stamm.position.y = hoehe * 0.2;
  baum.add(stamm);

  const krone1 = new THREE.Mesh(new THREE.ConeGeometry(hoehe * 0.35, hoehe * 0.5, 7), lowPoly('#3fae49'));
  krone1.position.y = hoehe * 0.55;
  baum.add(krone1);

  const krone2 = new THREE.Mesh(new THREE.ConeGeometry(hoehe * 0.27, hoehe * 0.4, 7), lowPoly('#5cc95a'));
  krone2.position.y = hoehe * 0.8;
  baum.add(krone2);

  baum.traverse((teil) => { teil.castShadow = true; });
  baum.position.set(x, 0, z);
  scene.add(baum);

  // Für die Kollision reicht ein schmaler Kasten um den Stamm.
  return new THREE.Box3(
    new THREE.Vector3(x - 0.5, 0, z - 0.5),
    new THREE.Vector3(x + 0.5, hoehe, z + 0.5),
  );
}

// Ein Felsen (unregelmäßiger Vielflächner).
function erstelleFels(scene, x, z, groesse) {
  const fels = new THREE.Mesh(new THREE.DodecahedronGeometry(groesse, 0), lowPoly('#9aa3ad'));
  fels.position.set(x, groesse * 0.6, z);
  fels.scale.y = 0.7;
  fels.castShadow = true;
  fels.receiveShadow = true;
  scene.add(fels);
  return new THREE.Box3().setFromObject(fels);
}

// Hauptfunktion: baut alles auf und gibt die Liste der Hindernisse zurück.
export function erstelleWelt(scene) {
  erstelleHimmel(scene);
  erstelleLicht(scene);
  erstelleInsel(scene);

  // Jedes Hindernis liefert eine Box3 für die Kollision.
  const hindernisse = [
    erstelleKiste(scene, 4, -3, 1.5, '#ff8a5c'),
    erstelleKiste(scene, 5.5, -3, 1, '#ffd166'),
    erstelleKiste(scene, -6, 5, 2, '#b388eb'),
    erstelleKiste(scene, -9, -8, 1.2, '#ff6b9a'),
    erstelleKiste(scene, 10, 8, 1.6, '#4ecdc4'),
    erstelleBaum(scene, -4, -6, 4),
    erstelleBaum(scene, 8, -10, 5),
    erstelleBaum(scene, -12, 3, 4.5),
    erstelleBaum(scene, 13, -2, 3.5),
    erstelleBaum(scene, 2, 11, 4),
    erstelleBaum(scene, -7, 13, 5),
    erstelleFels(scene, 7, 3, 1),
    erstelleFels(scene, -14, -5, 1.3),
    erstelleFels(scene, 0, -14, 1.1),
  ];

  return { hindernisse, inselRadius: INSEL_RADIUS };
}
