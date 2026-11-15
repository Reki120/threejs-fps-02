// Bot AI: seven teammates and opponents with one job each. A bot follows a
// waypoint route, holds a position, or engages a target it can see. Attackers
// carry the charge to a site and plant it; defenders hold the sites and defuse
// a planted charge. Bots react to sight and to sound: a gunshot turns nearby
// bots toward it. All decisions run in the fixed step; line-of-sight checks are
// staggered so no frame pays for all seven at once.
import * as THREE from 'three';
import { PALETTE, WEAPONS } from './config.js';
import { mulberry32 } from './mover.js';

const EMBER_NAMES = ['Ferro', 'Slag', 'Kindle'];
const ASH_NAMES = ['Dust', 'Gravel', 'Soot', 'Flint'];
const BOT_SPEED = 3.6;
const SCAN_INTERVAL = 0.18;
const SIGHT_RANGE = 45;

export function createBots(scene, world, mover, hooks) {
  const nodes = world.nodes;
  const adjacency = nodes.map(() => []);
  for (const [a, b] of world.edges) {
    adjacency[a].push(b);
    adjacency[b].push(a);
  }

  const emberMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ember), roughness: 0.6, metalness: 0.1 });
  const ashMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ash), roughness: 0.6, metalness: 0.1 });
  const skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.6, metalness: 0.05 });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.85 });
  const torsoGeo = new THREE.BoxGeometry(0.52, 0.78, 0.3);
  const headGeo = new THREE.SphereGeometry(0.155, 16, 12);
  const legGeo = new THREE.BoxGeometry(0.2, 0.5, 0.24);
  const gunGeo = new THREE.BoxGeometry(0.07, 0.09, 0.55);

  const bots = [];
  const rng = mulberry32(20261115);

  function nearestNode(x, z) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < nodes.length; i += 1) {
      const dx = nodes[i][0] - x;
      const dz = nodes[i][1] - z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  // Breadth-first route over the waypoint graph; returns node indices.
  function findPath(from, to) {
    if (from === to) return [to];
    const prev = new Array(nodes.length).fill(-1);
    const queue = [from];
    prev[from] = from;
    while (queue.length > 0) {
      const current = queue.shift();
      for (const next of adjacency[current]) {
        if (prev[next] !== -1) continue;
        prev[next] = current;
        if (next === to) {
          const path = [to];
          let at = to;
          while (at !== from) { at = prev[at]; path.unshift(at); }
          return path;
        }
        queue.push(next);
      }
    }
    return [to];
  }

  function makeBot(team, name, index) {
    const teamMat = team === 'ember' ? emberMat : ashMat;
    const group = new THREE.Group();
    const torso = new THREE.Mesh(torsoGeo, teamMat);
    torso.position.y = 1.0;
    torso.castShadow = true;
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.53;
    head.castShadow = true;
    const legL = new THREE.Mesh(legGeo, darkMat);
    legL.position.set(-0.13, 0.25, 0);
    const legR = new THREE.Mesh(legGeo, darkMat);
    legR.position.set(0.13, 0.25, 0);
    const gun = new THREE.Mesh(gunGeo, darkMat);
    gun.position.set(0.2, 1.15, -0.3);
    group.add(torso, head, legL, legR, gun);
    scene.add(group);

    const bot = {
      id: `${team}-${index}`,
      team,
      name,
      group,
      torso,
      head,
      body: {
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        yaw: 0,
        pitch: 0,
        hp: 100,
        alive: true,
        height: 1.72,
        onGround: true,
      },
      weapon: 'vk47',
      state: 'hold',
      path: [],
      pathIndex: 0,
      holdNode: 0,
      holdYaw: 0,
      site: null,
      target: null,
      reactAt: 0,
      nextShotAt: 0,
      burstLeft: 0,
      burstPauseUntil: 0,
      nextScanAt: index * 0.03,
      skill: 0.85 + rng() * 0.3,
      plantProgress: 0,
      defuseProgress: 0,
      strafeDir: 1,
      strafeUntil: 0,
      fall: 0,
      hearAt: 0,
      hearX: 0,
      hearZ: 0,
    };
    torso.userData.bot = bot;
    torso.userData.part = 'torso';
    head.userData.bot = bot;
    head.userData.part = 'head';
    bots.push(bot);
    return bot;
  }

  for (let i = 0; i < 3; i += 1) makeBot('ember', EMBER_NAMES[i], i);
  for (let i = 0; i < 4; i += 1) makeBot('ash', ASH_NAMES[i], i);

  function aliveOf(team) {
    return bots.filter((bot) => bot.team === team && bot.body.alive);
  }

  function routeTo(bot, nodeIndex) {
    const from = nearestNode(bot.body.position.x, bot.body.position.z);
    bot.path = findPath(from, nodeIndex);
    bot.pathIndex = 0;
    bot.state = 'route';
  }

  function routeToPoint(bot, x, z) {
    routeTo(bot, nearestNode(x, z));
  }

  // Roles for a fresh round. Attackers split between the sites; defenders hold
  // two on A, one on B, one roaming mid.
  function assignRound(carrierBot, siteChoices) {
    const embers = bots.filter((bot) => bot.team === 'ember');
    const ashes = bots.filter((bot) => bot.team === 'ash');
    embers.forEach((bot, i) => {
      bot.site = siteChoices[i % siteChoices.length];
      bot.state = 'route';
      bot.path = [];
      bot.pathIndex = 0;
      routeTo(bot, bot.site === 'A' ? 13 : 14);
    });
    ashes.forEach((bot, i) => {
      if (i === 0) { bot.site = 'A'; bot.holdNode = 19; }
      else if (i === 1) { bot.site = 'A'; bot.holdNode = 13; }
      else if (i === 2) { bot.site = 'B'; bot.holdNode = 20; }
      else { bot.site = null; bot.holdNode = 8; }
      bot.state = 'route';
      bot.path = [];
      bot.pathIndex = 0;
      routeTo(bot, bot.holdNode);
    });
    if (carrierBot) {
      carrierBot.site = siteChoices[0];
      routeTo(carrierBot, carrierBot.site === 'A' ? 13 : 14);
    }
  }

  function resetBots(spawns) {
    for (const bot of bots) {
      const [x, z] = spawns[bot.team][bot.team === 'ember' ? bots.filter((b) => b.team === 'ember').indexOf(bot) : bots.filter((b) => b.team === 'ash').indexOf(bot)];
      bot.body.position.set(x, 0, z);
      bot.body.velocity.set(0, 0, 0);
      bot.body.hp = 100;
      bot.body.alive = true;
      bot.body.yaw = bot.team === 'ember' ? 0 : Math.PI;
      bot.group.rotation.set(0, bot.body.yaw, 0);
      bot.group.position.copy(bot.body.position);
      bot.target = null;
      bot.state = 'hold';
      bot.path = [];
      bot.pathIndex = 0;
      bot.plantProgress = 0;
      bot.defuseProgress = 0;
      bot.burstLeft = 0;
      bot.fall = 0;
      bot.weapon = bot.team === 'ember' && rng() < 0.3 ? 'wasp' : 'vk47';
    }
  }

  // A gunshot turns nearby bots toward it for a moment.
  function hearShot(x, z) {
    for (const bot of bots) {
      if (!bot.body.alive) continue;
      const dx = bot.body.position.x - x;
      const dz = bot.body.position.z - z;
      if (dx * dx + dz * dz < 20 * 20) {
        bot.hearAt = hooks.now();
        bot.hearX = x;
        bot.hearZ = z;
      }
    }
  }

  function eyeOf(bot, out) {
    out.set(bot.body.position.x, bot.body.position.y + 1.5, bot.body.position.z);
    return out;
  }

  const tmpFrom = new THREE.Vector3();
  const tmpTo = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  function canSee(bot, enemyPos, enemyEyeY) {
    tmpFrom.set(bot.body.position.x, bot.body.position.y + 1.5, bot.body.position.z);
    tmpTo.set(enemyPos.x, enemyPos.y + enemyEyeY, enemyPos.z);
    const dist = tmpFrom.distanceTo(tmpTo);
    if (dist > SIGHT_RANGE) return false;
    tmpDir.copy(tmpTo).sub(tmpFrom).normalize();
    const hit = hooks.los(tmpFrom, tmpDir, dist);
    return hit === null || hit >= dist - 0.3;
  }

  function scan(bot, now, playerBody) {
    bot.nextScanAt = now + SCAN_INTERVAL;
    let best = null;
    let bestDist = Infinity;
    const enemies = [];
    if (playerBody.alive && bot.team !== 'ember') enemies.push({ kind: 'player', pos: playerBody.position, eye: 1.1, hp: playerBody.hp });
    for (const other of bots) {
      if (other.team !== bot.team && other.body.alive) {
        enemies.push({ kind: 'bot', bot: other, pos: other.body.position, eye: 1.1, hp: other.body.hp });
      }
    }
    for (const enemy of enemies) {
      const dx = enemy.pos.x - bot.body.position.x;
      const dz = enemy.pos.z - bot.body.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < bestDist && canSee(bot, enemy.pos, enemy.eye)) {
        best = enemy;
        bestDist = dist;
      }
    }
    bot.target = best;
    if (best && !bot.reactAt) bot.reactAt = now + 0.25 + (1 - bot.skill) * 0.35 + bestDist * 0.004;
  }

  function faceToward(bot, x, z, dt, rate = 6) {
    const target = Math.atan2(-(x - bot.body.position.x), -(z - bot.body.position.z));
    let diff = target - bot.body.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    bot.body.yaw += Math.max(-rate * dt, Math.min(rate * dt, diff));
  }

  function moveAlongPath(bot, dt) {
    if (bot.pathIndex >= bot.path.length) return true;
    const node = nodes[bot.path[bot.pathIndex]];
    const dx = node[0] - bot.body.position.x;
    const dz = node[1] - bot.body.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.7) {
      bot.pathIndex += 1;
      return bot.pathIndex >= bot.path.length;
    }
    faceToward(bot, node[0], node[1], dt, 8);
    const speed = BOT_SPEED;
    const vx = (dx / dist) * speed;
    const vz = (dz / dist) * speed;
    mover.move(bot.body, vx, vz, dt);
    return false;
  }

  function fireAt(bot, now, target) {
    const def = WEAPONS[bot.weapon];
    if (now < bot.nextShotAt) return;
    if (bot.burstLeft <= 0) {
      if (now < bot.burstPauseUntil) return;
      bot.burstLeft = 3;
      bot.burstPauseUntil = now + 0.6 + rng() * 0.5;
    }
    bot.burstLeft -= 1;
    bot.nextShotAt = now + def.gap;
    // Muzzle world position.
    tmpFrom.set(bot.body.position.x, bot.body.position.y + 1.35, bot.body.position.z);
    tmpFrom.x += Math.sin(bot.body.yaw) * -0.3;
    tmpFrom.z += Math.cos(bot.body.yaw) * -0.3;
    const enemyPos = target.pos;
    const dist = Math.hypot(enemyPos.x - bot.body.position.x, enemyPos.z - bot.body.position.z);
    const moving = target.kind === 'player' ? hooks.playerSpeed() > 2 : true;
    let chance = 0.52 * bot.skill * (1 - dist / 70);
    if (moving) chance *= 0.75;
    if (target.kind === 'player' && hooks.playerCrouching()) chance *= 0.85;
    chance = Math.max(0.08, Math.min(0.75, chance));
    const hit = rng() < chance;
    const head = hit && rng() < 0.08;
    tmpTo.set(
      enemyPos.x + (hit ? 0 : (rng() - 0.5) * 3),
      enemyPos.y + (hit ? (head ? 1.53 : 1.0) : 1.0 + (rng() - 0.5) * 2),
      enemyPos.z + (hit ? 0 : (rng() - 0.5) * 3),
    );
    hooks.tracer(tmpFrom, tmpTo);
    hooks.shotSound(bot, dist);
    if (hit) {
      const damage = Math.round(def.damage * (0.85 + rng() * 0.3) * (head ? def.headMult : 1));
      if (target.kind === 'player') hooks.damagePlayer(damage, bot.name, head);
      else hooks.damageBot(target.bot, damage, head ? 'head' : 'torso', bot.name);
    }
  }

  function step(bot, dt, now, playerBody, state) {
    const body = bot.body;
    if (!body.alive) {
      bot.fall = Math.min(1, bot.fall + dt / 0.4);
      bot.group.rotation.x = -bot.fall * 1.45;
      return;
    }
    if (now >= bot.nextScanAt) scan(bot, now, playerBody);

    // Planting or defusing is a channel: stay still, finish, or abort on death.
    if (bot.state === 'plant') {
      bot.plantProgress += dt;
      hooks.plantTick(bot, bot.plantProgress);
      if (bot.plantProgress >= 3.5) {
        bot.state = 'hold';
        bot.plantProgress = 0;
        hooks.onPlanted(bot);
      }
      return;
    }
    if (bot.state === 'defuse') {
      bot.defuseProgress += dt;
      hooks.defuseTick(bot, bot.defuseProgress);
      if (bot.defuseProgress >= 5) {
        bot.state = 'hold';
        bot.defuseProgress = 0;
        hooks.onDefused(bot);
      }
      return;
    }

    if (bot.target) {
      const target = bot.target;
      const tx = target.pos.x;
      const tz = target.pos.z;
      faceToward(bot, tx, tz, dt, 10);
      // Strafe while engaging so the bot is not a standing target.
      if (now > bot.strafeUntil) {
        bot.strafeDir = rng() < 0.5 ? -1 : 1;
        bot.strafeUntil = now + 0.5 + rng() * 0.8;
      }
      const sin = Math.sin(body.yaw);
      const cos = Math.cos(body.yaw);
      mover.move(body, cos * bot.strafeDir * 1.4, -sin * bot.strafeDir * 1.4, dt);
      if (now >= bot.reactAt) fireAt(bot, now, target);
      return;
    }
    bot.reactAt = 0;

    // Heard a shot recently: look at it for a second.
    if (now - bot.hearAt < 1.0 && bot.state === 'hold') {
      faceToward(bot, bot.hearX, bot.hearZ, dt, 8);
      return;
    }

    if (bot.state === 'route') {
      const arrived = moveAlongPath(bot, dt);
      if (arrived) {
        bot.state = 'hold';
        bot.holdYaw = body.yaw;
        hooks.onBotArrived(bot);
      }
      return;
    }
    // Hold: slow sweep of the view.
    body.yaw = bot.holdYaw + Math.sin(now * 0.5 + bot.id.length) * 0.55;
  }

  function syncVisuals() {
    for (const bot of bots) {
      if (!bot.body.alive) continue;
      bot.group.position.copy(bot.body.position);
      bot.group.rotation.y = bot.body.yaw;
      bot.group.rotation.x = 0;
    }
  }

  // Separation so bots do not stack on each other.
  function separate() {
    for (let i = 0; i < bots.length; i += 1) {
      const a = bots[i];
      if (!a.body.alive) continue;
      for (let j = i + 1; j < bots.length; j += 1) {
        const b = bots[j];
        if (!b.body.alive) continue;
        const dx = b.body.position.x - a.body.position.x;
        const dz = b.body.position.z - a.body.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01 && d < 0.9) {
          const push = (0.9 - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          a.body.position.x -= nx * push;
          a.body.position.z -= nz * push;
          b.body.position.x += nx * push;
          b.body.position.z += nz * push;
        }
      }
    }
  }

  return {
    bots,
    aliveOf,
    routeTo,
    routeToPoint,
    assignRound,
    resetBots,
    hearShot,
    nearestNode,
    stepAll(dt, now, playerBody, state) {
      for (const bot of bots) step(bot, dt, now, playerBody, state);
      separate();
      syncVisuals();
    },
    hitMeshes() {
      const meshes = [];
      for (const bot of bots) meshes.push(bot.torso, bot.head);
      return meshes;
    },
  };
}
