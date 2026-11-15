// One place for all mutable game state. Modules read and write this object; no
// other module keeps its own copy of round, score or money. Fixed-step simulation
// mutates it; rendering only reads it.
import { MATCH } from './config.js';

export function createState() {
  return {
    // match flow: 'menu' | 'buy' | 'live' | 'roundEnd' | 'matchEnd'
    phase: 'menu',
    round: 1,
    score: { ember: 0, ash: 0 },
    money: MATCH.startMoney,
    // loadout persists across rounds: primary weapon key or null, sidearm always
    // owned, grenades carried. Weapons bought in the buy phase stay in the loadout.
    loadout: { primary: null, grenades: 0 },
    timer: MATCH.buySeconds,
    // bomb: carrier is 'player' | bot id | null; planted carries site + fuse.
    bomb: { carrier: 'player', planted: false, site: null, fuse: 0, pos: null, plant: 0, defuse: 0, dropped: null },
    player: null, // set by main.js: { pos, vel, yaw, pitch, hp, alive, ... }
    bots: [], // bot objects, see bots.js
    kills: [], // kill feed entries { text, at }
    banner: null, // { title, sub, at } centre-screen announcement
    roundWinner: null,
    matchWinner: null,
    time: 0, // total sim seconds
    // per-frame scratch the sim fills for the HUD
    hud: { spread: 0, damageFlash: 0, healFlash: 0 },
    seed: 1,
  };
}

export function resetRoundState(state) {
  state.bomb = { carrier: 'player', planted: false, site: null, fuse: 0, pos: null, plant: 0, defuse: 0, dropped: null };
  state.kills.length = 0;
  state.banner = null;
  state.roundWinner = null;
}
