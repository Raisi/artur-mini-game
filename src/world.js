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

// ───────────────────────────────────────────────────────────────
// Nadeln für die Baumkronen
// ───────────────────────────────────────────────────────────────

// Malt eine Nadel-Textur auf eine kleine Leinwand: mehrere Reihen "Zweige",
// an denen viele kurze Nadeln schräg nach unten hängen – wie bei einer Tanne.
// Die Textur ist "nahtlos": Was rechts/unten hinausragt, wird links/oben wieder
// hineingemalt. So sieht man keine Kante, wenn sie sich auf der Krone wiederholt.
function maleNadelTextur() {
  const G = 256; // Größe der Leinwand in Pixeln
  const leinwand = document.createElement('canvas');
  leinwand.width = G;
  leinwand.height = G;
  const ctx = leinwand.getContext('2d');

  ctx.fillStyle = '#2f8a3a'; // dunkleres Grün im Hintergrund = Schatten zwischen den Zweigen
  ctx.fillRect(0, 0, G, G);
  ctx.lineCap = 'round';

  // Von dunkel (unten am Zweig) bis hell (oben, wo die Sonne hinkommt) – passend zum Inselgras
  const gruentoene = ['#2e7d32', '#3a9a43', '#47b04f', '#5cc95a', '#7ed957', '#a5e88f'];
  const reihen = 4;

  for (let r = 0; r < reihen; r++) {
    const zweigY = (r + 0.15) * (G / reihen); // wo der Zweig in dieser Reihe sitzt
    for (let i = 0; i < 260; i++) {
      // Startpunkt der Nadel: irgendwo am Zweig, etwas darunter verteilt
      const x = Math.random() * G;
      const tiefe = Math.random();                 // 0 = oben am Zweig, 1 = unten
      const y = zweigY + tiefe * (G / reihen) * 0.85;
      // Nadeln hängen schräg nach unten – mal nach links, mal nach rechts
      const seite = Math.random() < 0.5 ? -1 : 1;
      const winkel = (0.5 + Math.random() * 0.6) * seite; // ca. 30°–60° aus der Senkrechten
      const laenge = 9 + Math.random() * 10;
      const dx = Math.sin(winkel) * laenge;
      const dy = Math.cos(winkel) * laenge;
      // Oben am Zweig heller (Licht), unten dunkler
      const stufe = Math.min(gruentoene.length - 1, Math.floor((1 - tiefe) * gruentoene.length + Math.random() * 1.5));
      ctx.strokeStyle = gruentoene[stufe];
      ctx.lineWidth = 2 + Math.random();

      // Nahtlos: dieselbe Nadel auch um eine Leinwand-Breite/-Höhe verschoben malen
      for (const vx of [-G, 0, G]) {
        for (const vy of [-G, 0, G]) {
          ctx.beginPath();
          ctx.moveTo(x + vx, y + vy);
          ctx.lineTo(x + vx + dx, y + vy + dy);
          ctx.stroke();
        }
      }
    }
  }
  return leinwand;
}

// Macht aus einem Bild (Leinwand oder geladene Datei) eine Textur, die sich wiederholt.
function alsNadelTextur(textur) {
  textur.colorSpace = THREE.SRGBColorSpace;
  textur.wrapS = THREE.RepeatWrapping; // rundherum wiederholen …
  textur.wrapT = THREE.RepeatWrapping; // … und von unten nach oben
  textur.repeat.set(4, 3);             // 4x um die Krone herum, 3x nach oben
  textur.anisotropy = 4;               // bleibt auch schräg von der Seite scharf
  return textur;
}

// Alle Bäume teilen sich zwei Kronen-Materialien. Die Farbe färbt die Textur nur leicht ein:
// untere Krone etwas kräftiger, obere etwas heller.
const nadelTextur = alsNadelTextur(new THREE.CanvasTexture(maleNadelTextur()));
const kroneUnten = new THREE.MeshStandardMaterial({ map: nadelTextur, color: '#e8ffe8', flatShading: true, roughness: 0.9 });
const kroneOben = new THREE.MeshStandardMaterial({ map: nadelTextur, color: '#ffffff', flatShading: true, roughness: 0.9 });

// Ersatz-Textur: Liegt eine eigene Datei unter public/textures/nadeln.png, wird sie
// statt der gemalten Nadeln benutzt (z. B. selbst in Paint gemalt).
// Fehlt sie, bleibt einfach die gemalte Textur.
export function ladeNadelTextur(url) {
  new THREE.TextureLoader().load(
    url,
    (textur) => {
      alsNadelTextur(textur);
      kroneUnten.map = textur;
      kroneOben.map = textur;
      kroneUnten.needsUpdate = true;
      kroneOben.needsUpdate = true;
      nadelTextur.dispose(); // die gemalte Textur wird nicht mehr gebraucht
    },
    undefined,
    () => console.info('Keine eigene Nadel-Textur in public/textures/nadeln.png – nutze die gemalte.'),
  );
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

  // Kronen mit Nadel-Textur (siehe oben)
  const krone1 = new THREE.Mesh(new THREE.ConeGeometry(hoehe * 0.35, hoehe * 0.5, 7), kroneUnten);
  krone1.position.y = hoehe * 0.55;
  baum.add(krone1);

  const krone2 = new THREE.Mesh(new THREE.ConeGeometry(hoehe * 0.27, hoehe * 0.4, 7), kroneOben);
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

// ───────────────────────────────────────────────────────────────
// Stein-Textur für die Felsen
// ───────────────────────────────────────────────────────────────

// Malt Stein: graue Flecken in vielen Helligkeiten (wie Körner im Gestein),
// ein paar dunkle Risse und kleine Moos-Tupfen. Alles, was über den Rand ragt, wird auf
// der anderen Seite wieder hineingemalt – so ist die Textur nahtlos und man sieht keine Kante.
function maleSteinTextur() {
  const G = 256;
  const leinwand = document.createElement('canvas');
  leinwand.width = G;
  leinwand.height = G;
  const ctx = leinwand.getContext('2d');

  // Malt eine Form 9-mal: einmal normal und 8-mal um eine Bildbreite/-höhe verschoben
  const nahtlos = (malen) => {
    for (const vx of [-G, 0, G]) {
      for (const vy of [-G, 0, G]) {
        ctx.save();
        ctx.translate(vx, vy);
        malen();
        ctx.restore();
      }
    }
  };

  ctx.fillStyle = '#9aa3ad'; // Grundfarbe wie bisher
  ctx.fillRect(0, 0, G, G);

  // 1. Körnung: viele halbdurchsichtige Flecken, mal heller, mal dunkler
  const grautoene = ['#7d8691', '#8b949e', '#a9b1ba', '#b8c0c8', '#6f7782'];
  for (let i = 0; i < 380; i++) {
    const x = Math.random() * G;
    const y = Math.random() * G;
    const r = 2 + Math.random() * 9;
    const farbe = grautoene[Math.floor(Math.random() * grautoene.length)];
    const deckkraft = 0.35 + Math.random() * 0.35; // vorher auswürfeln: alle 9 Kopien gleich
    nahtlos(() => {
      ctx.globalAlpha = deckkraft;
      ctx.fillStyle = farbe;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.globalAlpha = 1;

  // 2. Risse: dunkle Zickzack-Linien
  for (let i = 0; i < 6; i++) {
    let x = Math.random() * G;
    let y = Math.random() * G;
    const punkte = [[x, y]];
    let richtung = Math.random() * Math.PI * 2;
    for (let s = 0; s < 6; s++) {
      richtung += (Math.random() - 0.5) * 1.2; // mal etwas nach links, mal nach rechts
      x += Math.cos(richtung) * 12;
      y += Math.sin(richtung) * 12;
      punkte.push([x, y]);
    }
    nahtlos(() => {
      ctx.strokeStyle = 'rgba(60, 66, 74, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      punkte.forEach(([px, py], n) => (n === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.stroke();
    });
  }

  // 3. Ein bisschen Moos: kleine grüne Tupfen in Gruppen
  for (let gruppe = 0; gruppe < 5; gruppe++) {
    const gx = Math.random() * G;
    const gy = Math.random() * G;
    for (let i = 0; i < 14; i++) {
      const x = gx + (Math.random() - 0.5) * 30;
      const y = gy + (Math.random() - 0.5) * 30;
      const r = 1.5 + Math.random() * 3;
      const farbe = Math.random() < 0.5 ? '#5f9e3a' : '#7ab648';
      nahtlos(() => {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = farbe;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  ctx.globalAlpha = 1;
  return leinwand;
}

function alsSteinTextur(textur) {
  textur.colorSpace = THREE.SRGBColorSpace;
  textur.wrapS = THREE.RepeatWrapping;
  textur.wrapT = THREE.RepeatWrapping;
  textur.repeat.set(2, 1); // 2x rundherum, 1x von oben nach unten
  textur.anisotropy = 4;
  return textur;
}

// Alle Felsen teilen sich ein Material
const steinTextur = alsSteinTextur(new THREE.CanvasTexture(maleSteinTextur()));
const steinMaterial = new THREE.MeshStandardMaterial({ map: steinTextur, flatShading: true, roughness: 0.95 });

// Ersatz-Textur: public/textures/fels.png (z. B. selbst gemalt) ersetzt die gemalte.
function ladeSteinTextur(url) {
  new THREE.TextureLoader().load(
    url,
    (textur) => {
      steinMaterial.map = alsSteinTextur(textur);
      steinMaterial.needsUpdate = true;
      steinTextur.dispose();
    },
    undefined,
    () => console.info('Keine eigene Stein-Textur in public/textures/fels.png – nutze die gemalte.'),
  );
}

// Ein Felsen (unregelmäßiger Vielflächner) mit Stein-Textur.
function erstelleFels(scene, x, z, groesse) {
  const fels = new THREE.Mesh(new THREE.DodecahedronGeometry(groesse, 0), steinMaterial);
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
  ladeSteinTextur(`${import.meta.env.BASE_URL}textures/fels.png`); // eigene Stein-Textur?

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
