// vite.config.js – Einstellungen für Vite.
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Auf GitHub Pages liegt das Spiel unter https://raisi.github.io/artur-mini-game/
  // – also nicht ganz oben, sondern im Unterordner "/artur-mini-game/".
  // Beim Entwickeln (npm run dev) bleibt alles einfach unter "/".
  base: command === 'build' ? '/artur-mini-game/' : '/',
}));
