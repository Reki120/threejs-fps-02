// Kiln Yard: the map, built from boxes. Every box is a collider for movement and
// a surface a bullet stops on. The look comes from procedural canvas textures
// (see textures.js), a dusk sky dome and the furnace glow — no image files.
import * as THREE from 'three';
import { PALETTE, MAP } from './config.js';
import {
  concreteTexture, floorTexture, metalTexture, crateTexture, hazardTexture,
  glowTexture, skyTexture, glowPoolTexture,
} from './textures.js';

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // Surfaces are procedural canvas textures tinted by the palette colour, so
  // the map reads as worn concrete and rusted plate instead of flat colour.
  // The same texture doubles as a bump map for a little surface relief.
  const textured = {
    floor: { map: floorTexture(11, 6, 5), roughness: 0.95, bump: 0.05 },
    surface: { map: metalTexture(21, 4, 1), roughness: 0.85, bump: 0.03 },
    hairline: { map: concreteTexture(33, 1, 1), roughness: 0.9, bump: 0.02 },
    ember: { map: crateTexture(47, 2, 1), roughness: 0.75, bump: 0.03 },
    ash: { map: crateTexture(53, 2, 1), roughness: 0.75, bump: 0.03 },
    hazard: { map: hazardTexture(2, 1), roughness: 0.8, bump: 0 },
  };
  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    const tex = textured[name];
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: tex ? tex.roughness : (name === 'accent' || name === 'ink' ? 0.5 : 0.92),
      metalness: name === 'ember' || name === 'ash' ? 0.15 : 0.03,
      map: tex ? tex.map : null,
      bumpMap: tex && tex.bump ? tex.map : null,
      bumpScale: tex ? tex.bump : 0,
    });
  }
  // The furnace mouth glows: molten cracks on an emissive map, so the cracks
  // burn and the slag stays dark.
  const mouthTex = glowTexture(7);
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1a0e06'), map: mouthTex,
    emissive: new THREE.Color(PALETTE.accent), emissiveMap: mouthTex,
    emissiveIntensity: 2.6, roughness: 0.6,
  });

  // Dusk sky dome: a gradient sphere behind everything, fog off so the
  // horizon band stays. The scene background colour remains as a fallback.
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(120, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  scene.add(skyDome);

  // Light pools on the floor where the site lights fall.
  const poolTex = glowPoolTexture();
  function lightPool(x, z, color, size) {
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size * 0.7),
      new THREE.MeshBasicMaterial({
        map: poolTex, color: new THREE.Color(color), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.03, z);
    pool.renderOrder = 1;
    group.add(pool);
  }
  lightPool(-16, -8, PALETTE.accent, 9);
  lightPool(16, -9.5, PALETTE.ash, 7);

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

  // Visual detail: pipes, barrels, a scaffold beam, silo ribs and a furnace
  // frame. None of this is a collider or a shootable — it sits on top of
  // boxes that already exist, or above head height, so movement, cover and
  // line of sight are exactly what the map data says.
  const pipeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#4c3f33'), roughness: 0.45, metalness: 0.65 });
  const barrelMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8a5a34'), map: metalTexture(61, 1, 1), roughness: 0.7, metalness: 0.3,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a2f26'), roughness: 0.8, metalness: 0.2 });
  function detail(geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  // Pipes high along the perimeter walls, with downspouts at the corners.
  detail(new THREE.CylinderGeometry(0.14, 0.14, 28, 10), pipeMat, -21.8, 4.3, 0, Math.PI / 2);
  detail(new THREE.CylinderGeometry(0.14, 0.14, 28, 10), pipeMat, 21.8, 4.3, 0, Math.PI / 2);
  detail(new THREE.CylinderGeometry(0.14, 0.14, 40, 10), pipeMat, 0, 4.3, -17.8, 0, 0, Math.PI / 2);
  detail(new THREE.CylinderGeometry(0.11, 0.11, 4.4, 10), pipeMat, -21.8, 2.2, -17.6);
  detail(new THREE.CylinderGeometry(0.11, 0.11, 4.4, 10), pipeMat, 21.8, 2.2, -17.6);
  // A beam across the mid hall, resting on the two pillars.
  detail(new THREE.BoxGeometry(8.4, 0.22, 0.22), darkMat, 0, 4.3, -2);
  // Barrels on top of the containers and the furnace block.
  function barrel(x, y, z) {
    detail(new THREE.CylinderGeometry(0.42, 0.42, 1.05, 14), barrelMat, x, y, z);
    detail(new THREE.CylinderGeometry(0.44, 0.44, 0.08, 14), darkMat, x, y + 0.54, z);
  }
  barrel(-13.5, 2.93, 1.5);
  barrel(-12, 2.93, 2.6);
  barrel(13.5, 2.93, 1.5);
  barrel(12, 2.93, 2.6);
  barrel(-17.5, 3.93, -12);
  barrel(-16, 3.93, -13.6);
  // Silo ribs: thin verticals on the south and east faces.
  for (const x of [15.8, 16.6, 17.4, 18.2]) detail(new THREE.BoxGeometry(0.18, 4.6, 0.1), darkMat, x, 2.3, -10.65);
  for (const z of [-13.7, -12.9, -12.1, -11.3]) detail(new THREE.BoxGeometry(0.1, 4.6, 0.18), darkMat, 18.85, 2.3, z);
  // Furnace frame: dark jambs and a lintel around the glowing mouth.
  detail(new THREE.BoxGeometry(0.25, 1.5, 0.12), darkMat, -18.5, 1.1, -10.88);
  detail(new THREE.BoxGeometry(0.25, 1.5, 0.12), darkMat, -15.5, 1.1, -10.88);
  detail(new THREE.BoxGeometry(3.4, 0.25, 0.12), darkMat, -17, 1.95, -10.88);

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
