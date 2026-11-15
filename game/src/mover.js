// Shared movement: a body is a vertical box (radius in X/Z, height in Y) moved
// against the world's AABBs one axis at a time, so a wall never swallows it and
// a body can stand on a crate. Player and bots both move through here.
import * as THREE from 'three';

const RADIUS = 0.34;
const GRAVITY = 20;

export function createMover(colliders) {
  const probe = new THREE.Box3();

  function overlaps(x, y, z, height, lift) {
    probe.min.set(x - RADIUS, y + lift, z - RADIUS);
    probe.max.set(x + RADIUS, y + height - lift, z + RADIUS);
    for (const collider of colliders) {
      if (probe.intersectsBox(collider)) return collider;
    }
    return null;
  }

  // body: { position: Vector3, velocity: Vector3, height, onGround }
  // wishX/wishZ: desired horizontal velocity; dt: fixed step.
  function move(body, wishX, wishZ, dt) {
    body.velocity.x = wishX;
    body.velocity.z = wishZ;
    const nextX = body.position.x + body.velocity.x * dt;
    if (!overlaps(nextX, body.position.y, body.position.z, body.height, 0.04)) {
      body.position.x = nextX;
    } else {
      body.velocity.x = 0;
    }
    const nextZ = body.position.z + body.velocity.z * dt;
    if (!overlaps(body.position.x, body.position.y, nextZ, body.height, 0.04)) {
      body.position.z = nextZ;
    } else {
      body.velocity.z = 0;
    }
    body.velocity.y -= GRAVITY * dt;
    body.position.y += body.velocity.y * dt;
    body.onGround = false;
    const hit = overlaps(body.position.x, body.position.y, body.position.z, body.height, 0);
    if (hit && body.velocity.y <= 0) {
      body.position.y = hit.max.y;
      body.velocity.y = 0;
      body.onGround = true;
    } else if (hit) {
      body.position.y = hit.min.y - body.height;
      body.velocity.y = 0;
    }
    if (body.position.y < 0) {
      body.position.y = 0;
      body.velocity.y = 0;
      body.onGround = true;
    }
    body.velocity.y = Math.max(-30, body.velocity.y);
  }

  // 2D circle test used by bots to check a waypoint step without gravity.
  function blocked(x, z, height, y = 0) {
    return overlaps(x, y, z, height, 0.04) !== null;
  }

  return { move, blocked, radius: RADIUS };
}

// A seeded RNG (mulberry32): deterministic when a seed is given, so a capture
// with ?shot=&seed= renders the same frame every time.
export function mulberry32(initial) {
  let a = initial | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
