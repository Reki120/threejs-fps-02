// Visual effects: tracers, impact sparks, explosions, and the yard's ambient
// dust: warm motes drifting up through the air, denser near the furnace.
// Pooled: a fixed set of line tracers and point bursts reused, so the hot
// loop makes no new objects.
// The damage vignette is a DOM element the HUD owns; this module only drives it.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { softDotTexture } from './textures.js';
import { mulberry32 } from './mover.js';

const TRACERS = 24;
const SPARKS = 10;
const SPARK_POINTS = 14;
const DUST = 90;

export function createEffects(scene) {
  const tracerMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0,
  });
  const tracers = [];
  for (let i = 0; i < TRACERS; i += 1) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geometry, tracerMat.clone());
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let tracerNext = 0;

  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARK_POINTS * 3), 3));
  const sparkMat = new THREE.PointsMaterial({
    color: new THREE.Color(PALETTE.accent), size: 0.09, transparent: true, opacity: 0, depthWrite: false,
  });
  const sparks = [];
  for (let i = 0; i < SPARKS; i += 1) {
    const points = new THREE.Points(sparkGeo.clone(), sparkMat.clone());
    points.visible = false;
    points.frustumCulled = false;
    scene.add(points);
    sparks.push({ points, life: 0, velocities: new Float32Array(SPARK_POINTS * 3) });
  }
  let sparkNext = 0;

  // Explosion: one expanding shell plus a point light, reused.
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1, 18, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0, depthWrite: false }),
  );
  shell.visible = false;
  scene.add(shell);
  const blastLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 22, 1.4);
  scene.add(blastLight);
  let blastLife = 0;
  const blastPos = new THREE.Vector3();

  // Ambient dust: one fixed cloud of warm motes, a third of them rising fast
  // over the furnace, the rest drifting across the yard. Seeded positions and
  // a seeded wrap RNG, so a deterministic capture renders the same motes.
  const dustPos = new Float32Array(DUST * 3);
  const dustVel = new Float32Array(DUST * 3);
  const dustRng = mulberry32(99);
  for (let i = 0; i < DUST; i += 1) {
    const nearFurnace = i < DUST / 3;
    dustPos[i * 3] = nearFurnace ? -20 + dustRng() * 8 : -21 + dustRng() * 42;
    dustPos[i * 3 + 1] = 0.2 + dustRng() * 5.3;
    dustPos[i * 3 + 2] = nearFurnace ? -14 + dustRng() * 8 : -17 + dustRng() * 34;
    dustVel[i * 3] = (dustRng() - 0.5) * 0.24;
    dustVel[i * 3 + 1] = nearFurnace ? 0.3 + dustRng() * 0.35 : 0.1 + dustRng() * 0.18;
    dustVel[i * 3 + 2] = (dustRng() - 0.5) * 0.24;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: softDotTexture(), color: new THREE.Color('#ffb45e'), size: 0.13,
    transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  const tmp = new THREE.Vector3();

  return {
    tracer(from, to) {
      const slot = tracers[tracerNext];
      tracerNext = (tracerNext + 1) % TRACERS;
      const attr = slot.line.geometry.getAttribute('position');
      attr.setXYZ(0, from.x, from.y, from.z);
      attr.setXYZ(1, to.x, to.y, to.z);
      attr.needsUpdate = true;
      slot.line.material.opacity = 0.85;
      slot.line.visible = true;
      slot.life = 0.09;
    },
    impact(point, normal) {
      const slot = sparks[sparkNext];
      sparkNext = (sparkNext + 1) % SPARKS;
      const attr = slot.points.geometry.getAttribute('position');
      for (let i = 0; i < SPARK_POINTS; i += 1) {
        attr.setXYZ(i, point.x, point.y, point.z);
        const spread = 2.2;
        slot.velocities[i * 3] = normal.x * 1.5 + (Math.random() - 0.5) * spread;
        slot.velocities[i * 3 + 1] = Math.abs(normal.y) * 1.5 + Math.random() * 2.4;
        slot.velocities[i * 3 + 2] = normal.z * 1.5 + (Math.random() - 0.5) * spread;
      }
      attr.needsUpdate = true;
      slot.points.material.opacity = 1;
      slot.points.visible = true;
      slot.life = 0.4;
    },
    explosion(point) {
      blastPos.copy(point);
      shell.position.copy(point);
      shell.visible = true;
      blastLight.position.copy(point);
      blastLife = 0.55;
    },
    step(dt) {
      // Dust drifts up and wraps to the floor, re-seeded so the pattern
      // stays varied without ever allocating.
      const attr = dustGeo.getAttribute('position');
      for (let i = 0; i < DUST; i += 1) {
        let x = attr.getX(i) + dustVel[i * 3] * dt;
        let y = attr.getY(i) + dustVel[i * 3 + 1] * dt;
        let z = attr.getZ(i) + dustVel[i * 3 + 2] * dt;
        if (y > 6) {
          y = 0.2;
          x = -21 + dustRng() * 42;
          z = -17 + dustRng() * 34;
        }
        attr.setXYZ(i, x, y, z);
      }
      attr.needsUpdate = true;
      for (const slot of tracers) {
        if (slot.life <= 0) continue;
        slot.life -= dt;
        slot.line.material.opacity = Math.max(0, slot.life / 0.09) * 0.85;
        if (slot.life <= 0) slot.line.visible = false;
      }
      for (const slot of sparks) {
        if (slot.life <= 0) continue;
        slot.life -= dt;
        const attr = slot.points.geometry.getAttribute('position');
        for (let i = 0; i < SPARK_POINTS; i += 1) {
          attr.setXYZ(i,
            attr.getX(i) + slot.velocities[i * 3] * dt,
            Math.max(0.02, attr.getY(i) + slot.velocities[i * 3 + 1] * dt),
            attr.getZ(i) + slot.velocities[i * 3 + 2] * dt);
          slot.velocities[i * 3 + 1] -= 6 * dt;
        }
        attr.needsUpdate = true;
        slot.points.material.opacity = Math.max(0, slot.life / 0.4);
        if (slot.life <= 0) slot.points.visible = false;
      }
      if (blastLife > 0) {
        blastLife -= dt;
        const t = 1 - Math.max(0, blastLife / 0.55);
        const radius = 0.6 + t * 6.5;
        shell.scale.set(radius, radius, radius);
        shell.material.opacity = Math.max(0, 0.55 - t * 0.55);
        blastLight.intensity = Math.max(0, (1 - t)) * 120;
        if (blastLife <= 0) {
          shell.visible = false;
          blastLight.intensity = 0;
        }
      }
    },
  };
}
