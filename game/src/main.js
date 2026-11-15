// EMBERWORKS: Kiln Yard — boot and the one loop. A fixed 60 Hz simulation
// feeds a render at the display's rate; rendering only reads state, the sim
// only mutates it. ?shot=start|play|plant|end with &seed=N sets up a
// deterministic frame for a capture, renders it twice, then freezes it and
// sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE, MATCH, WEAPONS } from './config.js';
import { createState } from './state.js';
import { createWorld } from './world.js';
import { createMover, mulberry32 } from './mover.js';
import { createPlayer } from './player.js';
import { createWeapons } from './weapons.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createCombat } from './combat.js';
import { createBots } from './bots.js';
import { createRounds } from './rounds.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
const random = shot ? mulberry32(seed) : Math.random;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 30, 70);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
scene.add(camera);

const state = createState();
state.seed = seed;
const world = createWorld(scene);
const mover = createMover(world.colliders);
const effects = createEffects(scene);
const audio = createAudio();
const player = createPlayer(mover);
const weapons = createWeapons(camera);
const hud = createHud({
  onBuy: (key) => rounds.buy(key),
  onDeploy: () => { hud.hideBuy(); input.requestLock(); },
  onPlay: () => {
    audio.unlock();
    if (state.phase === 'menu' || state.phase === 'matchEnd') rounds.startMatch();
    input.requestLock();
  },
});
const input = createInput(renderer.domElement, onLockChange);

const losRaycaster = new THREE.Raycaster();
function los(from, dir, maxDist) {
  losRaycaster.set(from, dir);
  losRaycaster.far = maxDist;
  const hits = losRaycaster.intersectObjects(world.shootables, false);
  return hits.length > 0 ? hits[0].distance : null;
}

const body = player.body;
let spectateBot = null;

function feed(text) {
  hud.killfeed(text);
  state.kills.push({ text, at: state.time });
}

function damagePlayer(amount, attackerName, head) {
  if (!body.alive || state.phase !== 'live') return;
  body.hp -= amount;
  hud.damageFlash();
  audio.hurt();
  if (body.hp <= 0) {
    body.hp = 0;
    body.alive = false;
    feed(`${attackerName} ▸ You${head ? ' (headshot)' : ''}`);
    if (state.bomb.carrier === 'player') {
      state.bomb.carrier = null;
      state.bomb.dropped = { x: body.position.x, z: body.position.z };
      feed('The charge was dropped');
      rounds.bombDropped();
    }
    spectateBot = bots.bots.find((bot) => bot.team === 'ember' && bot.body.alive) ?? null;
    input.releaseLock();
  }
}

function damageBot(bot, amount, part, attackerName) {
  if (!bot.body.alive) return;
  bot.body.hp -= amount;
  if (bot.body.hp <= 0) {
    bot.body.hp = 0;
    bot.body.alive = false;
    bot.target = null;
    const head = part === 'head';
    feed(`${attackerName} ▸ ${bot.name}${head ? ' (headshot)' : ''}`);
    if (attackerName === 'You') {
      state.money = Math.min(MATCH.maxMoney, state.money + MATCH.killMoney);
      hud.setMoney(state.money);
    }
    if (state.bomb.carrier === bot.id) {
      state.bomb.carrier = null;
      state.bomb.dropped = { x: bot.body.position.x, z: bot.body.position.z };
      feed('The charge was dropped');
      rounds.bombDropped();
    }
    if (bot.state === 'plant' || bot.state === 'defuse') {
      bot.state = 'hold';
      hud.setBomb(null, 0);
    }
  }
}

// Cross-module hooks, filled in once every module exists.
const botHooks = {
  now: () => state.time,
  los,
  tracer: (from, to) => effects.tracer(from, to),
  shotSound: (bot, dist) => { if (dist < 30) audio.shot(bot.weapon, Math.max(0.15, 1 - dist / 30)); },
  damagePlayer,
  damageBot,
  playerSpeed: () => player.groundSpeed(),
  playerCrouching: () => body.crouching,
  hearShot: (x, z) => bots.hearShot(x, z),
  plantTick: () => {},
  defuseTick: () => {},
  onPlanted: () => {},
  onDefused: () => {},
  onBotArrived: () => {},
};
const bots = createBots(scene, world, mover, botHooks);

const combatHooks = {
  botHitMeshes: () => bots.hitMeshes(),
  blastVictims: () => {
    const victims = [];
    if (body.alive) victims.push({ pos: body.position, kind: 'player' });
    for (const bot of bots.bots) {
      if (bot.body.alive) victims.push({ pos: bot.body.position, kind: 'bot', bot });
    }
    return victims;
  },
  damageVictim: (victim, amount) => {
    if (victim.kind === 'player') damagePlayer(amount, 'Spark grenade', false);
    else damageBot(victim.bot, amount, 'torso', 'You');
  },
  onExplosion: (pos) => bots.hearShot(pos.x, pos.z),
};
const combat = createCombat(scene, world, mover, effects, audio, combatHooks);

const rounds = createRounds({
  state,
  player,
  bots,
  weapons,
  hud,
  audio,
  world,
  onRoundEnd: (winner) => {
    if (!body.alive) {
      spectateBot = bots.bots.find((bot) => bot.team === 'ember' && bot.body.alive) ?? null;
    }
  },
  onMatchEnd: () => { input.releaseLock(); },
  onPlanted: (name, site) => feed(`${name} planted the charge at site ${site}`),
});
// The rounds module owns the bot arrival/plant/defuse hooks.
Object.assign(botHooks, rounds.botHooks);

state.player = body;

const direction = new THREE.Vector3();
const muzzle = new THREE.Vector3();
const origin = new THREE.Vector3();
let wasFiring = false;
let frozen = false;
let accumulator = 0;
let lastTime = performance.now();

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    hud.hideOverlay();
    hud.hideBuy();
  } else if (state.phase === 'live' && body.alive) {
    hud.showOverlay('paused');
  }
}

function syncCamera() {
  if (!body.alive && spectateBot) {
    const target = spectateBot.body;
    camera.position.set(target.position.x, target.position.y + 1.55, target.position.z);
    camera.rotation.set(0, target.yaw, 0, 'YXZ');
    return;
  }
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function shoot(spread) {
  const def = weapons.def();
  if (!weapons.takeRound()) {
    audio.dry();
    return false;
  }
  camera.getWorldDirection(direction);
  direction.x += (random() * 2 - 1) * spread;
  direction.y += (random() * 2 - 1) * spread;
  direction.z += (random() * 2 - 1) * spread;
  direction.normalize();
  origin.copy(camera.position);
  scene.updateMatrixWorld(true);
  const hit = combat.shoot(origin, direction, def.range);
  weapons.muzzleWorld(muzzle);
  const endPoint = hit ? hit.point : origin.clone().addScaledVector(direction, def.range);
  effects.tracer(muzzle, endPoint);
  if (hit) {
    if (hit.bot) {
      const head = hit.part === 'head';
      const damage = Math.round(def.damage * (head ? def.headMult : 1));
      const wasAlive = hit.bot.body.alive;
      damageBot(hit.bot, damage, hit.part, 'You');
      hud.hitMarker(wasAlive && !hit.bot.body.alive, head);
      audio.hit(head);
    } else {
      effects.impact(hit.point, hit.normal);
    }
  }
  weapons.pullTrigger();
  player.recoil(def.kick + random() * 0.003, (random() * 2 - 1) * 0.003);
  audio.shot(state.currentWeaponKey ?? weapons.state.current);
  bots.hearShot(body.position.x, body.position.z);
  hud.setAmmo(weapons.ammo[weapons.state.current].mag, weapons.ammo[weapons.state.current].reserve, weaponLabel());
  return true;
}

function weaponLabel() {
  const def = weapons.def();
  const grenades = state.loadout.grenades;
  return grenades > 0 ? `${def.label} · ◉${grenades}` : def.label;
}

function throwGrenade() {
  if (state.loadout.grenades <= 0 || state.phase !== 'live') return;
  state.loadout.grenades -= 1;
  camera.getWorldDirection(direction);
  origin.copy(camera.position);
  combat.throwGrenade(origin, direction);
  audio.buy();
}

function step(dt) {
  state.time += dt;
  const keys = input.state.keys;
  if (state.phase === 'live' || state.phase === 'buy') {
    player.step(dt, keys);
    weapons.step(dt);
    combat.step(dt);
    effects.step(dt);
    bots.stepAll(dt, state.time, body, state);
    rounds.update(dt, keys);
  } else {
    weapons.step(dt);
    effects.step(dt);
  }
  hud.setHealth(body.hp);
  hud.setTimer(state.timer, state.phase);
  hud.setAlive(rounds.aliveCount('ember'), rounds.aliveCount('ash'));
  hud.setSpread(4 + weapons.spread(player.groundSpeed()) * 900);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (frozen) {
    renderer.render(scene, camera);
    return;
  }
  const look = input.takeLook();
  if (input.state.locked) player.look(look.x, look.y);
  const pressed = input.takePressed();
  if (pressed.has('KeyR') && weapons.reload()) audio.reload();
  if (pressed.has('KeyB') && state.phase === 'buy') {
    hud.showBuy(state.loadout, state.money);
    input.releaseLock();
  }
  if (pressed.has('Digit1')) weapons.switchTo('p9');
  if (pressed.has('Digit2') && state.loadout.primary === 'vk47') weapons.switchTo('vk47');
  if (pressed.has('Digit3') && state.loadout.primary === 'wasp') weapons.switchTo('wasp');
  if (pressed.has('Digit4') && state.loadout.primary === 'longbow') weapons.switchTo('longbow');
  if (pressed.has('KeyG')) throwGrenade();
  if (pressed.has('Enter') && state.phase === 'buy') {
    hud.hideBuy();
    input.requestLock();
  }

  // Semi-auto weapons fire on the rising edge; autos fire while held.
  const firing = input.state.firing && input.state.locked && body.alive && state.phase === 'live';
  const def = weapons.def();
  if (firing && weapons.ready()) {
    if (def.auto || !wasFiring) shoot(shot ? 0 : weapons.spread(player.groundSpeed()));
  }
  wasFiring = input.state.firing;

  // Zoom for the marksman rifle.
  const wantZoom = input.state.zooming && def.zoom === true;
  const targetFov = wantZoom ? 30 : 74;
  if (Math.abs(camera.fov - targetFov) > 0.5) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 14);
    camera.updateProjectionMatrix();
  }

  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < 5) {
    step(FIXED_STEP);
    accumulator -= FIXED_STEP;
    steps += 1;
  }
  if (accumulator > FIXED_STEP * 5) accumulator = 0;
  syncCamera();
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    } else {
      requestAnimationFrame(paint);
    }
  }
  requestAnimationFrame(paint);
}

function runShot(name) {
  hud.hideOverlay();
  hud.hideBuy();
  rounds.startMatch();
  if (name === 'start') {
    // Buy phase at the attacker spawn, menu open, looking up the yard.
    body.position.set(-2, 0, 15);
    body.yaw = 0;
    body.pitch = 0;
    settle(20);
    hud.showBuy(state.loadout, state.money);
  } else if (name === 'play') {
    // Mid-round: live phase, two defenders in the mid lane, one shot fired.
    state.phase = 'live';
    state.timer = 62;
    hud.hideBuy();
    body.position.set(0, 0, 10);
    body.yaw = Math.PI;
    body.pitch = 0;
    const ash = bots.bots.filter((bot) => bot.team === 'ash');
    ash[0].body.position.set(-4, 0, -2);
    ash[0].body.yaw = 0;
    ash[1].body.position.set(4, 0, -4);
    ash[1].body.yaw = 0;
    ash[0].group.position.copy(ash[0].body.position);
    ash[1].group.position.copy(ash[1].body.position);
    settle(10);
    aimAt(new THREE.Vector3(-4, 1.2, -2));
    shoot(0);
    settle(1); // keep the tracer and muzzle flash alive for the capture
    hud.hideBanner(); // the round banner would cover the firefight
  } else if (name === 'plant') {
    // The charge is planted at Furnace; the player covers site A.
    state.phase = 'live';
    state.timer = 41;
    state.bomb.planted = true;
    state.bomb.site = 'A';
    state.bomb.fuse = 18;
    hud.hideBuy();
    hud.hideBanner(); // the buy-phase banner text would contradict the plant
    settle(10);
    body.position.set(-11, 0, -6);
    body.yaw = Math.PI * 0.78;
    body.pitch = 0;
    const ash = bots.bots.filter((bot) => bot.team === 'ash');
    ash[0].body.position.set(-14, 0, -8);
    ash[0].body.yaw = Math.PI;
    ash[0].group.position.copy(ash[0].body.position);
    settle(10);
    hud.setBomb('Charge at A — 18s', 18 / MATCH.fuseSeconds);
  } else {
    // Round end: Ember took the round, score 3-2.
    state.phase = 'roundEnd';
    state.score.ember = 3;
    state.score.ash = 2;
    state.timer = 3;
    hud.hideBuy();
    body.position.set(0, 0, 8);
    body.yaw = Math.PI;
    settle(10);
    hud.banner('ROUND WON', 'Ash Wardens eliminated', 60000);
    hud.setScore(3, 2);
  }
  const def = weapons.def();
  hud.setAmmo(weapons.ammo[weapons.state.current].mag, weapons.ammo[weapons.state.current].reserve, weaponLabel());
  hud.setMoney(state.money);
  hud.setHealth(body.hp);
  hud.setTimer(state.timer, state.phase);
  hud.setScore(state.score.ember, state.score.ash);
  hud.setAlive(rounds.aliveCount('ember'), rounds.aliveCount('ash'));
  paintTwiceThenReady();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
if (shot) runShot(shot);
else requestAnimationFrame(frame);

// Debug hook for headless play-testing: move the camera and inspect state.
window.__ember = { scene, camera, renderer, state, player, bots, weapons, world };
