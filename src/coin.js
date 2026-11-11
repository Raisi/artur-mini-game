// coin.js – wie die Münzen aussehen: Form, gemalte Gold-Textur und eigene Ersatz-Textur.
import * as THREE from 'three';

const G = 256;     // Größe der Leinwand für die Münz-Seiten (Pixel)
const MITTE = G / 2;

// ───────────────────────────────────────────────────────────────
// Die Vorder- und Rückseite malen
// ───────────────────────────────────────────────────────────────
// Aufbau wie bei einer echten Münze, von außen nach innen:
//   1. dicker Rand, der wie "erhaben" wirkt (oben links hell, unten rechts dunkel)
//   2. glänzende Fläche mit Gold-Verlauf und einem hellen Glanzstreifen
//   3. eine feine eingeprägte Rille
//   4. in der Mitte ein geprägtes Symbol (hier: ein Stern)
function maleMuenzSeite() {
  const leinwand = document.createElement('canvas');
  leinwand.width = G;
  leinwand.height = G;
  const ctx = leinwand.getContext('2d');

  // Hilfsfunktion: gefüllter Kreis
  const kreis = (radius, fuellung) => {
    ctx.beginPath();
    ctx.arc(MITTE, MITTE, radius, 0, Math.PI * 2);
    ctx.fillStyle = fuellung;
    ctx.fill();
  };

  // 1. Rand: Verlauf von hell (oben links) nach dunkel (unten rechts) = wirkt gewölbt
  const randVerlauf = ctx.createLinearGradient(0, 0, G, G);
  randVerlauf.addColorStop(0, '#fff6c2');
  randVerlauf.addColorStop(0.45, '#f2c230');
  randVerlauf.addColorStop(1, '#a8740c');
  // Die ganze Leinwand füllen (nicht nur den Kreis): So entsteht von weitem kein dunkler Saum.
  ctx.fillStyle = randVerlauf;
  ctx.fillRect(0, 0, G, G);

  // Schatten-Kante: Hier fällt der Rand nach innen ab (umgekehrter Verlauf)
  const kanteVerlauf = ctx.createLinearGradient(0, 0, G, G);
  kanteVerlauf.addColorStop(0, '#8a5c06');
  kanteVerlauf.addColorStop(1, '#ffe98a');
  kreis(MITTE * 0.82, kanteVerlauf);

  // 2. Die Fläche: senkrechter Gold-Verlauf mit dunklerem Band, wie poliertes Metall
  const flaeche = ctx.createLinearGradient(0, MITTE * 0.2, 0, G - MITTE * 0.2);
  flaeche.addColorStop(0, '#fff1a8');
  flaeche.addColorStop(0.35, '#f7cd3c');
  flaeche.addColorStop(0.6, '#d29a1e');
  flaeche.addColorStop(0.72, '#ffe27a');
  flaeche.addColorStop(1, '#e0a62a');
  kreis(MITTE * 0.78, flaeche);

  // Heller Glanzstreifen quer über die Fläche
  ctx.save();
  ctx.beginPath();
  ctx.arc(MITTE, MITTE, MITTE * 0.78, 0, Math.PI * 2);
  ctx.clip(); // nur innerhalb der Fläche malen
  const glanz = ctx.createLinearGradient(0, G * 0.62, 0, G * 0.74);
  glanz.addColorStop(0, 'rgba(255, 255, 255, 0)');
  glanz.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
  glanz.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glanz;
  ctx.fillRect(0, G * 0.62, G, G * 0.12);
  ctx.restore();

  // 3. Feine eingeprägte Rille: dunkle Linie, darunter versetzt eine helle
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(120, 80, 0, 0.7)';
  ctx.beginPath();
  ctx.arc(MITTE - 1, MITTE - 1, MITTE * 0.68, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 250, 220, 0.8)';
  ctx.beginPath();
  ctx.arc(MITTE + 1.5, MITTE + 1.5, MITTE * 0.68, 0, Math.PI * 2);
  ctx.stroke();

  // 4. Das Symbol in der Mitte, "geprägt": erst Schatten, dann Glanzkante, dann die Fläche
  const symbol = () => stern(ctx, MITTE, MITTE, MITTE * 0.42, MITTE * 0.19);
  const praege = (dx, dy, farbe) => {
    ctx.save();
    ctx.translate(dx, dy);
    symbol();
    ctx.fillStyle = farbe;
    ctx.fill();
    ctx.restore();
  };
  praege(4, 4, '#8a5c06');   // Schatten unten rechts
  praege(-3, -3, '#fffbe0'); // Licht oben links
  const symbolVerlauf = ctx.createLinearGradient(0, MITTE * 0.55, 0, MITTE * 1.45);
  symbolVerlauf.addColorStop(0, '#ffe066');
  symbolVerlauf.addColorStop(1, '#d99a12');
  symbol();
  ctx.fillStyle = symbolVerlauf;
  ctx.fill();

  return leinwand;
}

// Zeichnet einen Stern mit 5 Zacken als Pfad (aussen = Spitzen, innen = Einbuchtungen).
// Willst du ein anderes Symbol? Hier einfach einen anderen Pfad zeichnen.
function stern(ctx, x, y, aussen, innen) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? aussen : innen;
    const winkel = -Math.PI / 2 + (i * Math.PI) / 5; // mit einer Spitze nach oben anfangen
    ctx.lineTo(x + Math.cos(winkel) * radius, y + Math.sin(winkel) * radius);
  }
  ctx.closePath();
}

// ───────────────────────────────────────────────────────────────
// Den Münzrand malen: Gold mit feinen Rillen (wie bei einer echten Münze)
// ───────────────────────────────────────────────────────────────
function maleMuenzRand() {
  const leinwand = document.createElement('canvas');
  leinwand.width = 64;
  leinwand.height = 16;
  const ctx = leinwand.getContext('2d');
  const verlauf = ctx.createLinearGradient(0, 0, 0, 16);
  verlauf.addColorStop(0, '#ffe98a');
  verlauf.addColorStop(0.5, '#e6b22a');
  verlauf.addColorStop(1, '#a8740c');
  ctx.fillStyle = verlauf;
  ctx.fillRect(0, 0, 64, 16);
  ctx.fillStyle = 'rgba(110, 70, 0, 0.55)';
  for (let x = 0; x < 64; x += 4) ctx.fillRect(x, 0, 1.5, 16); // die Rillen
  return leinwand;
}

function alsTextur(bild) {
  const textur = new THREE.CanvasTexture(bild);
  textur.colorSpace = THREE.SRGBColorSpace;
  textur.anisotropy = 4;
  return textur;
}

// ───────────────────────────────────────────────────────────────
// Form und Materialien – alle Münzen teilen sie sich
// ───────────────────────────────────────────────────────────────
export const muenzForm = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 32);
muenzForm.rotateX(Math.PI / 2); // aufstellen wie ein Rad
legeBildAufSeiten(muenzForm, 0.4);

// Three.js legt das Bild auf die Deckel eines Zylinders um 90° gedreht – der Stern stünde schief.
// Darum sagen wir für jeden Punkt der beiden Seiten selbst, welche Stelle im Bild er zeigt:
// x/y der Münze → Bild-Koordinaten (0 … 1). Auf der Rückseite gespiegelt, damit man den
// Stern auch von hinten richtig herum sieht.
function legeBildAufSeiten(form, radius) {
  const pos = form.attributes.position;
  const normale = form.attributes.normal;
  const uv = form.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nz = normale.getZ(i);
    if (Math.abs(nz) < 0.5) continue; // Punkt gehört zum Rand, nicht zu einer Seite
    const u = (pos.getX(i) / radius) * 0.5 * Math.sign(nz) + 0.5;
    const v = (pos.getY(i) / radius) * 0.5 + 0.5;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}

const seitenTextur = alsTextur(maleMuenzSeite());
const randTextur = alsTextur(maleMuenzRand());
randTextur.wrapS = THREE.RepeatWrapping;
randTextur.repeat.set(10, 1); // die Rillen 10x rundherum

// "emissiveMap": Die Münze leuchtet ein bisschen von selbst – im Muster der Textur.
// So funkelt sie auch im Schatten, ohne zu einem gelben Fleck zu werden.
const goldMaterial = (textur) => new THREE.MeshStandardMaterial({
  map: textur,
  emissive: '#ffffff',
  emissiveMap: textur,
  emissiveIntensity: 0.3,
  metalness: 0.25,
  roughness: 0.35,
});
const randMaterial = goldMaterial(randTextur);
const seitenMaterial = goldMaterial(seitenTextur);

// Ein Zylinder hat drei Teile: Mantel (= Rand), Deckel oben und Deckel unten (= die zwei Seiten).
export const muenzMaterialien = [randMaterial, seitenMaterial, seitenMaterial];

// Ersatz-Textur: Liegt eine eigene Datei unter public/textures/muenze.png, kommt sie auf
// beide Seiten der Münze. Am besten ein quadratisches Bild mit der Münze als Kreis darin.
export function ladeMuenzTextur(url) {
  new THREE.TextureLoader().load(
    url,
    (textur) => {
      textur.colorSpace = THREE.SRGBColorSpace;
      textur.anisotropy = 4; // auch schräg von der Seite scharf, wie die gemalte
      seitenMaterial.map = textur;
      seitenMaterial.emissiveMap = textur;
      seitenMaterial.needsUpdate = true;
      seitenTextur.dispose(); // die gemalte Seite wird nicht mehr gebraucht
    },
    undefined,
    () => console.info('Keine eigene Münz-Textur in public/textures/muenze.png – nutze die gemalte.'),
  );
}
