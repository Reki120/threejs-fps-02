// Combat: the player's hitscan shot and the thrown grenade. The shot is one
// ray against the world's boxes and the bots' hit meshes; the first hit wins,
// a dead bot's falling body is skipped. The grenade is a small sphere with
// gravity that bounces off the map's boxes and explodes on a fuse.
import * as THREE from 'three';

const GRENADE_FUSE = 1.4;
const GRENADE_RADIUS = 7;
const GRENADE_SPEED = 14;

export function createCombat(scene, world, mover, effects, audio, hooks) {
  const raycaster = new THREE.Raycaster();
  const grenades = [];
  const grenadeGeo = new THREE.SphereGeometry(0.09, 10, 8);
  const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.5, metalness: 0.4 });

  function shoot(origin, direction, range) {
    raycaster.set(origin, direction);
    raycaster.far = range;
    const targets = world.shootables.concat(hooks.botHitMeshes());
    const hits = raycaster.intersectObjects(targets, false);
    for (const hit of hits) {
      const bot = hit.object.userData.bot;
      if (bot && !bot.body.alive) continue;
      return {
        point: hit.point,
        normal: hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0),
        bot: bot ?? null,
        part: hit.object.userData.part ?? null,
        distance: hit.distance,
      };
    }
    return null;
  }

  function throwGrenade(from, direction) {
    const mesh = new THREE.Mesh(grenadeGeo, grenadeMat);
    mesh.position.copy(from);
    mesh.castShadow = true;
    scene.add(mesh);
    grenades.push({
      mesh,
      pos: from.clone(),
      vel: direction.clone().multiplyScalar(GRENADE_SPEED).add(new THREE.Vector3(0, 3.5, 0)),
      fuse: GRENADE_FUSE,
    });
  }

  function explode(grenade) {
    const pos = grenade.pos;
    effects.explosion(pos);
    audio.explode();
    hooks.onExplosion(pos);
    // Blast: falloff with distance, no line-of-sight check — a blast wraps.
    const victims = hooks.blastVictims();
    for (const victim of victims) {
      const dist = victim.pos.distanceTo(pos);
      if (dist >= GRENADE_RADIUS) continue;
      const damage = Math.max(10, Math.round(110 * (1 - dist / GRENADE_RADIUS)));
      hooks.damageVictim(victim, damage);
    }
  }

  function step(dt) {
    for (let i = grenades.length - 1; i >= 0; i -= 1) {
      const g = grenades[i];
      g.fuse -= dt;
      g.vel.y -= 12 * dt;
      const next = g.pos.clone().addScaledVector(g.vel, dt);
      // Axis-separated bounce: try X, then Z, then Y; reflect the blocked axis.
      if (!mover.blocked(next.x, g.pos.z, 0.2, g.pos.y)) g.pos.x = next.x;
      else g.vel.x *= -0.45;
      if (!mover.blocked(g.pos.x, next.z, 0.2, g.pos.y)) g.pos.z = next.z;
      else g.vel.z *= -0.45;
      if (next.y < 0.09) {
        g.pos.y = 0.09;
        g.vel.y = Math.abs(g.vel.y) > 1 ? -g.vel.y * 0.45 : 0;
        g.vel.x *= 0.8;
        g.vel.z *= 0.8;
      } else if (!mover.blocked(g.pos.x, g.pos.z, 0.2, next.y)) {
        g.pos.y = next.y;
      } else {
        g.vel.y *= -0.45;
      }
      g.mesh.position.copy(g.pos);
      if (g.fuse <= 0) {
        explode(g);
        scene.remove(g.mesh);
        grenades.splice(i, 1);
      }
    }
  }

  return { shoot, throwGrenade, step, grenadeCount: () => grenades.length };
}
