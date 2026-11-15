// Kiln Yard: the map, built from boxes. Every box is a collider for movement and
// a surface a bullet stops on. Plain geometry only, no models and no textures —
// the palette, the furnace glow and the hazard marks carry the look.
import * as THREE from 'three';
import { PALETTE, MAP } from './config.js';

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.5 : 0.92,
      metalness: name === 'ember' || name === 'ash' ? 0.15 : 0.03,
    });
  }
  // The furnace mouth glows: an emissive panel, not a light, so it reads at a
  // glance from across the yard.
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.accent), emissive: new THREE.Color(PALETTE.accent),
    emissiveIntensity: 2.2, roughness: 0.6,
  });

  const colliders = [];
  const shootables = [];

  function box(width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  for (const [w, h, d, x, y, z, material] of MAP.boxes) box(w, h, d, x, y, z, material);

  // Furnace mouth: a glowing slot on site A's block, facing the yard.
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 0.15), glowMaterial);
  mouth.position.set(-17, 1.1, -10.9);
  group.add(mouth);
  // Silo cap and hazard stripes: thin accent boxes that say "site" at a glance.
  box(3.8, 0.25, 3.8, 17, 4.7, -12.5, 'hazard');
  box(5.2, 0.12, 0.5, -16, 0.06, -7, 'hazard');
  box(0.5, 0.12, 5.2, -13.2, 0.06, -10.5, 'hazard');
  box(5.2, 0.12, 0.5, 16, 0.06, -7, 'hazard');
  box(0.5, 0.12, 5.2, 13.2, 0.06, -10.5, 'hazard');

  // Site markers: floating letters, so a player always knows where the sites are.
  const siteMarkers = [];
  for (const site of MAP.sites) {
    const marker = makeLetterSprite(site.id, site.id === 'A' ? PALETTE.ember : PALETTE.ash);
    marker.position.set(site.x, 4.4, site.z);
    scene.add(marker);
    siteMarkers.push(marker);
  }

  // Light: low amber sun from the west, cool fill from the east, warm furnace
  // point light at site A and a teal one at site B. Bright enough that the
  // yard reads at a glance from any corner.
  const sky = new THREE.HemisphereLight(new THREE.Color('#9a7f5c'), new THREE.Color('#4a3828'), 1.7);
  scene.add(sky);
  const sun = new THREE.DirectionalLight(new THREE.Color('#ffb45e'), 3.2);
  sun.position.set(-18, 20, 12);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#7fa8a0'), 0.9);
  fill.position.set(14, 10, -12);
  scene.add(fill);
  const furnaceLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 30, 16, 1.6);
  furnaceLight.position.set(-17, 2.2, -10.5);
  scene.add(furnaceLight);
  const siloLight = new THREE.PointLight(new THREE.Color(PALETTE.ash), 18, 14, 1.6);
  siloLight.position.set(17, 3.4, -12.5);
  scene.add(siloLight);

  return {
    colliders,
    shootables,
    group,
    siteMarkers,
    furnaceLight,
    // Waypoint graph helpers for the bots (see bots.js).
    nodes: MAP.nodes,
    edges: MAP.edges,
    sites: MAP.sites,
    spawns: MAP.spawns,
  };
}

// A letter drawn on a canvas, as a sprite. No image files: the canvas is drawn
// at load and lives only in memory.
function makeLetterSprite(letter, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = color;
  g.font = 'bold 92px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.6, 1.6, 1);
  return sprite;
}
