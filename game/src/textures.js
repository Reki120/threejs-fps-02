// Procedural textures: every surface the yard shows is drawn on a canvas at
// load — concrete, rusted metal, floor slabs, hazard stripes, the furnace
// mouth, the dusk sky and the soft dots the dust uses. No image files, no
// network: the game ships no texture at all. All textures are drawn in
// near-greyscale so the material's palette colour tints them (the hazard
// stripes are white and black for the same reason); only the furnace glow
// and the sky carry their own colour. A seeded RNG makes every texture
// identical on every load, so the screenshots are reproducible.
import * as THREE from 'three';
import { mulberry32 } from './mover.js';

function canvas(size, height = size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = height;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Soft mottled patches: many translucent ellipses of random grey. Layered
// light and dark, they read as stains, wear and grime at any scale.
function blotches(g, rng, size, count, light, dark, alpha) {
  for (let i = 0; i < count; i += 1) {
    const v = rng() < 0.5 ? light : dark;
    g.fillStyle = `rgba(${v},${v},${v},${alpha * (0.4 + rng() * 0.6)})`;
    g.beginPath();
    g.ellipse(rng() * size, rng() * size, 6 + rng() * 34, 4 + rng() * 22, rng() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
}

// Fine grain: thousands of single-pixel dots, light and dark.
function speckle(g, rng, size, count, alpha) {
  for (let i = 0; i < count; i += 1) {
    const v = rng() < 0.5 ? 60 : 220;
    g.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    g.fillRect(rng() * size, rng() * size, 1.5, 1.5);
  }
}

// A jagged dark crack wandering across the canvas.
function cracks(g, rng, size, count, alpha) {
  g.strokeStyle = `rgba(40,30,22,${alpha})`;
  for (let i = 0; i < count; i += 1) {
    g.lineWidth = 1 + rng();
    g.beginPath();
    let x = rng() * size;
    let y = rng() * size;
    g.moveTo(x, y);
    for (let s = 0; s < 8; s += 1) {
      x += (rng() - 0.5) * 70;
      y += (rng() - 0.5) * 70;
      g.lineTo(x, y);
    }
    g.stroke();
  }
}

// Vertical rust runs: short translucent brown streaks, heavier at the top.
function rustRuns(g, rng, size, count) {
  for (let i = 0; i < count; i += 1) {
    const x = rng() * size;
    const y = rng() * size * 0.7;
    const len = 12 + rng() * 60;
    const grad = g.createLinearGradient(x, y, x, y + len);
    grad.addColorStop(0, 'rgba(122,62,26,0.5)');
    grad.addColorStop(1, 'rgba(122,62,26,0)');
    g.fillStyle = grad;
    g.fillRect(x, y, 2 + rng() * 3, len);
  }
}

function base(g, size, height, grey) {
  g.fillStyle = `rgb(${grey},${grey},${grey})`;
  g.fillRect(0, 0, size, height);
}

// Poured concrete: light base, mottling, speckle, a few cracks.
export function concreteTexture(seed, repeatX = 1, repeatY = 1) {
  const [c, g] = canvas(256);
  const rng = mulberry32(seed);
  base(g, 256, 256, 205);
  blotches(g, rng, 256, 90, 235, 120, 0.16);
  speckle(g, rng, 256, 2200, 0.25);
  cracks(g, rng, 256, 3, 0.35);
  return toTexture(c, repeatX, repeatY);
}

// The yard floor: big slabs with expansion joints, oil stains and scuffs.
export function floorTexture(seed, repeatX = 1, repeatY = 1) {
  const [c, g] = canvas(512);
  const rng = mulberry32(seed);
  base(g, 512, 512, 198);
  blotches(g, rng, 512, 160, 228, 105, 0.15);
  // Oil stains: dark radial blobs.
  for (let i = 0; i < 14; i += 1) {
    const x = rng() * 512;
    const y = rng() * 512;
    const r = 20 + rng() * 55;
    const grad = g.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, 'rgba(38,28,20,0.5)');
    grad.addColorStop(1, 'rgba(38,28,20,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Expansion joints: a 2x2 slab grid.
  g.strokeStyle = 'rgba(52,40,30,0.65)';
  g.lineWidth = 4;
  for (const p of [0, 256, 512]) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(512, p); g.stroke();
  }
  speckle(g, rng, 512, 3500, 0.22);
  cracks(g, rng, 512, 4, 0.3);
  return toTexture(c, repeatX, repeatY);
}

// Rusted plate: mottling, rust runs, rivets along the edges.
export function metalTexture(seed, repeatX = 1, repeatY = 1) {
  const [c, g] = canvas(256);
  const rng = mulberry32(seed);
  base(g, 256, 256, 200);
  blotches(g, rng, 256, 110, 232, 110, 0.18);
  rustRuns(g, rng, 256, 26);
  g.fillStyle = 'rgba(70,45,28,0.55)';
  for (const x of [14, 242]) for (let y = 14; y < 256; y += 34) {
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
  }
  speckle(g, rng, 256, 1800, 0.22);
  return toTexture(c, repeatX, repeatY);
}

// Corrugated container: vertical ridges, rust at the seams.
export function crateTexture(seed, repeatX = 1, repeatY = 1) {
  const [c, g] = canvas(256);
  const rng = mulberry32(seed);
  base(g, 256, 256, 196);
  for (let x = 0; x < 256; x += 16) {
    g.fillStyle = x % 32 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(40,28,18,0.16)';
    g.fillRect(x, 0, 8, 256);
  }
  blotches(g, rng, 256, 70, 230, 115, 0.16);
  rustRuns(g, rng, 256, 18);
  speckle(g, rng, 256, 1500, 0.2);
  return toTexture(c, repeatX, repeatY);
}

// Hazard tape: white and black diagonal bands. The material colour tints the
// white bands yellow and leaves the black bands black.
export function hazardTexture(repeatX = 1, repeatY = 1) {
  const [c, g] = canvas(256);
  base(g, 256, 256, 235);
  g.fillStyle = 'rgb(28,22,18)';
  for (let x = -256; x < 512; x += 64) {
    g.beginPath();
    g.moveTo(x, 256); g.lineTo(x + 32, 256); g.lineTo(x + 32 + 256, 0); g.lineTo(x + 256, 0);
    g.closePath(); g.fill();
  }
  return toTexture(c, repeatX, repeatY);
}

// The furnace mouth: near-black slag with bright molten cracks. Used as the
// emissive map, so the cracks glow and the slag stays dark.
export function glowTexture(seed) {
  const [c, g] = canvas(256);
  const rng = mulberry32(seed);
  base(g, 256, 256, 18);
  blotches(g, rng, 256, 40, 90, 10, 0.5);
  g.strokeStyle = 'rgba(255,150,50,0.95)';
  g.lineCap = 'round';
  for (let i = 0; i < 7; i += 1) {
    g.lineWidth = 2 + rng() * 3;
    g.beginPath();
    let x = rng() * 256;
    let y = rng() * 256;
    g.moveTo(x, y);
    for (let s = 0; s < 6; s += 1) {
      x += (rng() - 0.5) * 90;
      y += (rng() - 0.5) * 90;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.fillStyle = 'rgba(255,190,90,0.9)';
  for (let i = 0; i < 12; i += 1) {
    g.beginPath(); g.arc(rng() * 256, rng() * 256, 2 + rng() * 6, 0, Math.PI * 2); g.fill();
  }
  const tex = toTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// Dusk sky: a vertical gradient, dark mauve above, an amber band at the
// horizon, dark haze below. Painted on a sphere: the canvas top (y = 0) maps
// to the sphere's top pole and the canvas middle (y = 256) to its equator,
// so the amber band sits at eye level.
export function skyTexture() {
  const [c, g] = canvas(64, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#171019');
  grad.addColorStop(0.42, '#2c1b20');
  grad.addColorStop(0.46, '#5e2f1a');
  grad.addColorStop(0.5, '#a35a24');
  grad.addColorStop(0.55, '#3a241a');
  grad.addColorStop(1, '#1d150f');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 512);
  // A few dim stars high up.
  const rng = mulberry32(41);
  g.fillStyle = 'rgba(240,220,200,0.7)';
  for (let i = 0; i < 40; i += 1) g.fillRect(rng() * 64, rng() * 150, 1.4, 1.4);
  const tex = toTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// A soft round dot: the sprite for dust motes and embers.
export function softDotTexture() {
  const [c, g] = canvas(64);
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return toTexture(c);
}

// A light pool: white radial falloff, tinted by the material colour.
export function glowPoolTexture() {
  const [c, g] = canvas(256);
  const grad = g.createRadialGradient(128, 128, 8, 128, 128, 126);
  grad.addColorStop(0, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return toTexture(c);
}
