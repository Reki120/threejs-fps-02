// Weapons: the player's loadout. Each weapon owns its magazine, reserve, fire
// gap, reload and spread; the view model is a small box-built gun hung under the
// camera. main.js owns the ray; this module owns the numbers and the trigger.
import * as THREE from 'three';
import { PALETTE, WEAPONS } from './config.js';

const MUZZLE_TIME = 0.06;

export function createWeapons(camera) {
  const gripMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.5, metalness: 0.3 });

  // One view model per weapon, built from boxes; only the current one is visible.
  const models = {};
  for (const [key, def] of Object.entries(WEAPONS)) {
    const model = new THREE.Group();
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.4), bodyMat);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, def.barrel), gripMat);
    barrel.position.set(0, 0.025, -0.2 - def.barrel / 2);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.22), gripMat);
    stock.position.set(0, -0.02, 0.3);
    model.add(receiver, barrel, stock);
    if (key === 'longbow') {
      const scope = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.24), accentMat);
      scope.position.set(0, 0.09, -0.05);
      model.add(scope);
    }
    if (key === 'wasp') {
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.08), accentMat);
      mag.position.set(0, -0.14, -0.05);
      model.add(mag);
    }
    model.position.set(0.24, -0.2, -0.42);
    model.visible = false;
    camera.add(model);
    models[key] = model;
  }

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  // Ammo state per weapon key; the loadout (which primaries are owned) lives in
  // the central state, the magazines live here.
  const ammo = {};
  for (const [key, def] of Object.entries(WEAPONS)) ammo[key] = { mag: def.mag, reserve: def.reserve };

  const state = {
    current: 'p9',
    cooldown: 0,
    reloadLeft: 0,
    reloadTotal: 0,
    flash: 0,
    kick: 0,
    zoomed: false,
  };

  function currentDef() { return WEAPONS[state.current]; }

  function showModel() {
    for (const [key, model] of Object.entries(models)) model.visible = key === state.current;
  }
  showModel();

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    const model = models[state.current];
    model.position.z = -0.42 + state.kick;
    model.rotation.x = state.kick * 2.2;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (state.reloadTotal - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const def = currentDef();
        const need = def.mag - ammo[state.current].mag;
        const take = Math.min(need, ammo[state.current].reserve);
        ammo[state.current].mag += take;
        ammo[state.current].reserve -= take;
      }
    }
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
  }

  return {
    state,
    ammo,
    def: currentDef,
    step,
    ready() {
      return ammo[state.current].mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    takeRound() {
      if (ammo[state.current].mag <= 0) return false;
      ammo[state.current].mag -= 1;
      return true;
    },
    pullTrigger() {
      const def = currentDef();
      state.cooldown = def.gap;
      state.flash = MUZZLE_TIME;
      state.kick = 0.04 + def.kick;
    },
    reload() {
      const def = currentDef();
      const a = ammo[state.current];
      if (state.reloadLeft > 0 || a.mag === def.mag || a.reserve === 0) return false;
      state.reloadLeft = def.reload;
      state.reloadTotal = def.reload;
      return true;
    },
    spread(speed) {
      const def = currentDef();
      return def.spreadStill + Math.min(1, speed / 5.2) * def.spreadMove;
    },
    switchTo(key) {
      if (!WEAPONS[key] || key === state.current) return false;
      state.current = key;
      state.cooldown = Math.max(state.cooldown, 0.25);
      state.reloadLeft = 0;
      state.zoomed = false;
      showModel();
      return true;
    },
    refillAll() {
      for (const [key, def] of Object.entries(WEAPONS)) {
        ammo[key].mag = def.mag;
        ammo[key].reserve = def.reserve;
      }
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
      state.zoomed = false;
    },
    // Grenade is not a gun: the throw is owned by combat.js; this is its count.
    muzzleWorld(out) {
      out.set(0.24, -0.18, -0.95);
      return camera.localToWorld(out);
    },
  };
}
