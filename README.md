# EMBERWORKS — Kiln Yard

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/Reki120/threejs-fps-02/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/Reki120/threejs-fps-02/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)


A round-based tactical FPS in the browser, built on three.js 0.187.0 (vendored
under `game/vendor/three/`). Single-player against bots, offline from static
files, no build step, no network request.

## The game

Kiln Yard is a foundry yard: two bomb sites (Furnace / Silo), three lanes,
crates and containers for cover. You play for **Ember Crew** against the
**Ash Wardens** — 4v4, first to 5 round wins.

- **Rounds**: 12 s buy phase, 100 s rounds. Win by eliminating the other
  team, planting the charge and letting it blow, or running the clock out on
  defence. Defenders win a planted round by defusing.
- **Economy**: $800 to start, $300 a kill, $3,250 a round win, $1,900 a loss.
  Buy with `B` (or keys 1–4): VK-47 rifle ($2,700), Wasp-9 SMG ($1,500),
  Longbow marksman rifle ($4,750), Spark frag grenade ($300). Your loadout
  stays between rounds; ammo refills each round.
- **Gunplay**: hitscan with headshot bonus, recoil and spread that punish
  firing on the move, acceleration, crouching, jumping, map collision.
  Right-click zooms the Longbow.
- **Objective**: hold `E` inside a site to plant the charge (3.5 s). After
  planting, 35 s fuse — Ash bots move in to defuse (5 s channel).
- **Bots**: follow waypoint routes to the sites, hold positions, react to
  sight and to gunshots, strafe while engaging, plant and defuse.
- **HUD**: health, ammo, money, round timer, score, alive counts, kill feed,
  dynamic crosshair, hitmarker, plant/defuse progress.

## Play

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Open http://localhost:8080, click Deploy, and play. `WASD` move, mouse look,
click fire, `R` reload, `1–4` weapons, `G` grenade, `B` buy menu, `Ctrl`
crouch, `Space` jump, `E` plant.

## Screenshots

Deterministic capture frames for screenshots:

```
http://localhost:8080/?shot=start&seed=1   # buy phase at spawn
http://localhost:8080/?shot=play&seed=1    # mid-round firefight
http://localhost:8080/?shot=plant&seed=1   # charge planted at Furnace
http://localhost:8080/?shot=end&seed=1     # round-end banner
```

Each renders twice, then freezes and sets `window.__shotReady`.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's `vendor/makefun-threejs.ts` library.

## Layout

- `game/index.html` — page shell and HUD
- `game/src/main.js` — boot, fixed-step loop, shooting, shot mode
- `game/src/config.js` — palette, map, weapons, economy
- `game/src/state.js` — the one game-state object
- `game/src/world.js` — Kiln Yard map and lighting
- `game/src/mover.js` — shared AABB movement and seeded RNG
- `game/src/player.js` — player controller
- `game/src/weapons.js` — loadout, view models, reload, spread
- `game/src/bots.js` — bot AI: routes, holds, combat, plant/defuse
- `game/src/combat.js` — hitscan ray, grenade physics
- `game/src/rounds.js` — round machine, economy, charge
- `game/src/effects.js` — tracers, sparks, explosions
- `game/src/audio.js` — synthesised WebAudio sounds
- `game/src/hud.js` — DOM HUD and buy menu
- `game/src/input.js` — keyboard, mouse, pointer lock
