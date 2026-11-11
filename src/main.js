// main.js – der Startpunkt: Renderer, Kamera, Tastatur, Drag & Drop und die Spielschleife.
import * as THREE from 'three';
import { erstelleWelt, ladeNadelTextur } from './world.js';
import { Spieler } from './player.js';
import { Spiel } from './game.js';
import { ladeGegnerVorlage, erstelleGegnerPlatzhalter } from './enemy.js';
import { ladeSchwertVorlage, erstelleSchwertPlatzhalter } from './sword.js';
import { Titelbild } from './title.js';

// ── Renderer: zeichnet die 3D-Szene in ein <canvas> ──
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // nicht zu viele Pixel → bleibt flüssig
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

// ── Szene und Kamera ──
const scene = new THREE.Scene();
const kamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
const KAMERA_ABSTAND = new THREE.Vector3(0, 5.5, 9); // schräg hinter und über der Figur
kamera.position.copy(KAMERA_ABSTAND);
const kameraZiel = new THREE.Vector3(0, 1, 0);

// ── Welt, Spieler und Spiel aufbauen ──
const welt = erstelleWelt(scene);
const spieler = new Spieler(scene);
const spiel = new Spiel(scene, spieler, welt);

// Kurze Meldung oben rechts anzeigen
const meldung = document.getElementById('meldung');
let meldungTimer;
function zeigeMeldung(text) {
  meldung.textContent = text;
  meldung.classList.add('sichtbar');
  clearTimeout(meldungTimer);
  meldungTimer = setTimeout(() => meldung.classList.remove('sichtbar'), 3500);
}

// ── Titelbildschirm: Das Spiel beginnt im Menü ──
const titel = new Titelbild(spiel, spieler, zeigeMeldung);
titel.passeAn(window.innerWidth / window.innerHeight);
titel.zeigen();
kamera.position.copy(titel.kameraPosition); // gleich richtig hinschauen, ohne Anflug
kameraZiel.copy(titel.kameraBlick);

// Figur laden – klappt das nicht, kommt die bunte Kapsel.
// import.meta.env.BASE_URL sorgt dafür, dass der Pfad auch nach "npm run build" stimmt.
spieler.ladeFigur(`${import.meta.env.BASE_URL}models/figur.glb`)
  .then(() => zeigeMeldung('Deine Figur ist da! 🎉'))
  .catch((fehler) => {
    console.info('Keine Figur in public/models/figur.glb gefunden – zeige Platzhalter.', fehler.message);
    spieler.zeigePlatzhalter();
    zeigeMeldung('Keine figur.glb gefunden – hier ist ein Platzhalter. Zieh deine .glb ins Fenster!');
  });

// Gegner laden – klappt das nicht, kommen rote Stachelkugeln.
ladeGegnerVorlage(`${import.meta.env.BASE_URL}models/enemy.glb`)
  .catch((fehler) => {
    console.info('Keine Gegner-Figur in public/models/enemy.glb gefunden – zeige Platzhalter.', fehler.message);
    return erstelleGegnerPlatzhalter();
  })
  .then((vorlage) => spiel.setzeGegnerModell(vorlage));

// Eigene Nadel-Textur für die Bäume? (Fehlt sie, bleiben die gemalten Nadeln.)
ladeNadelTextur(`${import.meta.env.BASE_URL}textures/nadeln.png`);

// Schwert laden – klappt das nicht, gibt es ein einfaches Ersatz-Schwert.
ladeSchwertVorlage(`${import.meta.env.BASE_URL}models/sword.glb`)
  .catch((fehler) => {
    console.info('Kein Schwert in public/models/sword.glb gefunden – zeige Platzhalter.', fehler.message);
    return erstelleSchwertPlatzhalter();
  })
  .then((vorlage) => spieler.setzeSchwert(vorlage));

// ── Tastatur ──
// Wir merken uns, welche Tasten gerade gedrückt sind.
const gedrueckt = new Set();
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey) return; // z. B. Cmd/Strg+F (Suchen) soll nicht zuschlagen
  gedrueckt.add(e.code);
  spiel.sound.aktivieren();
  // Leertaste und Pfeile sollen die Seite nicht scrollen
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => gedrueckt.delete(e.code));
window.addEventListener('blur', () => gedrueckt.clear()); // Fenster verlassen → nichts "klemmt"
window.addEventListener('pointerdown', () => spiel.sound.aktivieren());

// Klick ins Spielfeld = Schwerthieb. Nur auf dem Spielfeld (canvas) – ein Klick auf
// "Nochmal spielen" soll nicht gleichzeitig zuschlagen.
let klickAngriff = false;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button === 0) klickAngriff = true; // nur die linke Maustaste
});

function leseEingabe() {
  // Im Titelbildschirm und nach Sieg oder Game Over steht die Figur still
  const aktiv = !spiel.vorbei && !titel.aktiv;
  const klick = klickAngriff;
  klickAngriff = false; // ein Klick = ein Hieb
  return {
    angriff: aktiv && (gedrueckt.has('KeyF') || klick),
    vor: aktiv && (gedrueckt.has('KeyW') || gedrueckt.has('ArrowUp')),
    zurueck: aktiv && (gedrueckt.has('KeyS') || gedrueckt.has('ArrowDown')),
    links: aktiv && (gedrueckt.has('KeyA') || gedrueckt.has('ArrowLeft')),
    rechts: aktiv && (gedrueckt.has('KeyD') || gedrueckt.has('ArrowRight')),
    springen: aktiv && gedrueckt.has('Space'),
  };
}

// ── Drag & Drop: eine .glb-Datei aufs Fenster ziehen ersetzt die Figur ──
const dropHinweis = document.getElementById('drop-hinweis');

window.addEventListener('dragover', (e) => {
  e.preventDefault(); // ohne das würde der Browser die Datei einfach öffnen
  dropHinweis.classList.add('sichtbar');
});
window.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) dropHinweis.classList.remove('sichtbar');
});
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropHinweis.classList.remove('sichtbar');

  const datei = e.dataTransfer.files[0];
  if (!datei) return;
  if (!datei.name.toLowerCase().endsWith('.glb')) {
    zeigeMeldung('Bitte eine .glb-Datei verwenden (aus Paint 3D: Speichern unter → 3D-Modell → GLB).');
    return;
  }

  // Aus der Datei eine vorübergehende Adresse machen, die der Loader lesen kann
  const url = URL.createObjectURL(datei);
  try {
    await spieler.ladeFigur(url);
    zeigeMeldung(`Neue Figur: ${datei.name} 🎉`);
  } catch (fehler) {
    console.warn('Die Datei konnte nicht geladen werden:', fehler);
    zeigeMeldung('Hoppla, diese Datei konnte nicht geladen werden.');
  } finally {
    URL.revokeObjectURL(url);
  }
});

// ── Fenstergröße ändern ──
window.addEventListener('resize', () => {
  kamera.aspect = window.innerWidth / window.innerHeight;
  kamera.updateProjectionMatrix();
  titel.passeAn(kamera.aspect);
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Die Spielschleife: läuft ca. 60-mal pro Sekunde ──
const timer = new THREE.Timer();
timer.connect(document); // pausiert automatisch, wenn der Tab im Hintergrund ist

function schleife(zeitstempel) {
  timer.update(zeitstempel);
  // dt begrenzen: Nach einer Pause soll die Figur nicht durch Wände "springen"
  const dt = Math.min(timer.getDelta(), 0.05);

  const eingabe = leseEingabe();
  spieler.aktualisiere(dt, eingabe, welt.hindernisse, welt.inselRadius);
  if (titel.aktiv) titel.aktualisiere(dt);
  else spiel.aktualisiere(dt, eingabe);

  // Kamera gleitet sanft (lerp) zu ihrem Ziel: im Titel aufs Duell, im Spiel hinter die Figur.
  // Beim Start von "Neues Spiel" fliegt sie so ganz von selbst hinüber.
  const glaette = 1 - Math.exp(-5 * dt);
  const figurPos = spieler.gruppe.position;
  const zielPosition = titel.aktiv ? titel.kameraPosition : figurPos.clone().add(KAMERA_ABSTAND);
  const zielBlick = titel.aktiv ? titel.kameraBlick : figurPos.clone().add(new THREE.Vector3(0, 1, 0));
  kamera.position.lerp(zielPosition, glaette);
  kameraZiel.lerp(zielBlick, glaette);
  kamera.lookAt(kameraZiel);

  renderer.render(scene, kamera);
}
renderer.setAnimationLoop(schleife);

// Für Neugierige: in der Browser-Konsole kann man z. B. "spiel.neustart()" eintippen.
window.spiel = spiel;
window.spieler = spieler;
window.titel = titel;
