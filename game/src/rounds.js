// Rounds: the match state machine — buy phase, live round, round end, match
// end — plus the economy and the charge (bomb). The player is always on Ember,
// the attacking crew: they plant the charge at Furnace or Silo, Ash defends.
// One module owns phase, timer, money and the charge; nothing else does.
import { MATCH, WEAPONS, GRENADE } from './config.js';
import { resetRoundState } from './state.js';

export function createRounds(deps) {
  const { state, player, bots, weapons, hud, audio } = deps;

  function aliveCount(team) {
    let count = team === 'ember' && player.body.alive ? 1 : 0;
    for (const bot of bots.bots) if (bot.team === team && bot.body.alive) count += 1;
    return count;
  }

  function siteNear(pos, radius) {
    for (const site of deps.world.sites) {
      const dx = pos.x - site.x;
      const dz = pos.z - site.z;
      if (dx * dx + dz * dz < radius * radius) return site;
    }
    return null;
  }

  function startMatch() {
    state.score.ember = 0;
    state.score.ash = 0;
    state.round = 1;
    state.money = MATCH.startMoney;
    state.loadout = { primary: null, grenades: 0 };
    state.matchWinner = null;
    startRound();
  }

  function startRound() {
    resetRoundState(state);
    state.phase = 'buy';
    state.timer = MATCH.buySeconds;
    // Spawns: player south, bots on their team's spawn points.
    const emberSpawns = deps.world.spawns.ember;
    const ashSpawns = deps.world.spawns.ash;
    player.reset(emberSpawns[0][0], emberSpawns[0][1], 0);
    bots.resetBots(deps.world.spawns);
    // Weapons: the loadout persists; ammo refills every round.
    weapons.refillAll();
    const primary = state.loadout.primary;
    weapons.switchTo(primary && WEAPONS[primary] ? primary : 'p9');
    if (primary) weapons.switchTo(primary);
    // The player carries the charge at the start of every round.
    state.bomb.carrier = 'player';
    // Bots split between the sites; the carrier bot escorts the player's site.
    const siteChoices = ['A', 'B', 'A'];
    bots.assignRound(null, siteChoices);
    hud.setMoney(state.money);
    hud.setScore(state.score.ember, state.score.ash);
    hud.setHealth(player.body.hp);
    hud.showBuy(state.loadout, state.money);
    hud.banner(`ROUND ${state.round}`, 'Buy phase — press DEPLOY when ready', 2400);
    hud.setBomb(null, 0);
  }

  function endRound(winner, reason) {
    if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return;
    state.phase = 'roundEnd';
    state.roundWinner = winner;
    state.timer = MATCH.endSeconds;
    const playerWon = winner === 'ember';
    if (playerWon) {
      state.score.ember += 1;
      state.money = Math.min(MATCH.maxMoney, state.money + MATCH.winMoney);
      audio.roundWin();
    } else {
      state.score.ash += 1;
      state.money = Math.min(MATCH.maxMoney, state.money + MATCH.lossMoney);
      audio.roundLose();
    }
    hud.setScore(state.score.ember, state.score.ash);
    hud.setMoney(state.money);
    hud.hideBuy();
    hud.setBomb(null, 0);
    hud.banner(playerWon ? 'ROUND WON' : 'ROUND LOST', reason, 3400);
    deps.onRoundEnd(winner, reason);
  }

  function endMatch() {
    state.phase = 'matchEnd';
    const won = state.score.ember > state.score.ash;
    state.matchWinner = won ? 'ember' : 'ash';
    hud.showOverlay('matchEnd', { won, ember: state.score.ember, ash: state.score.ash });
    deps.onMatchEnd(won);
  }

  function buy(key) {
    if (state.phase !== 'buy') return false;
    if (key === 'grenade') {
      if (state.loadout.grenades >= 2 || state.money < GRENADE.price) { audio.deny(); return false; }
      state.money -= GRENADE.price;
      state.loadout.grenades += 1;
      state.money = Math.max(0, state.money);
      hud.setMoney(state.money);
      hud.showBuy(state.loadout, state.money);
      audio.buy();
      return true;
    }
    const def = WEAPONS[key];
    if (!def || def.slot !== 'primary') return false;
    if (state.loadout.primary === key) {
      weapons.switchTo(key);
      audio.buy();
      return true;
    }
    if (state.money < def.price) { audio.deny(); return false; }
    state.money -= def.price;
    state.loadout.primary = key;
    weapons.switchTo(key);
    hud.setMoney(state.money);
    hud.showBuy(state.loadout, state.money);
    audio.buy();
    return true;
  }

  // A dropped charge is recovered by the nearest living Ember bot, which
  // routes to the drop and then carries it to its site.
  function bombDropped() {
    const bomb = state.bomb;
    if (!bomb.dropped) return;
    let best = null;
    let bestDist = Infinity;
    for (const bot of bots.bots) {
      if (bot.team !== 'ember' || !bot.body.alive) continue;
      const d = Math.hypot(bot.body.position.x - bomb.dropped.x, bot.body.position.z - bomb.dropped.z);
      if (d < bestDist) { bestDist = d; best = bot; }
    }
    if (best) bots.routeToPoint(best, bomb.dropped.x, bomb.dropped.z);
  }
  function updatePlant(dt, keys) {
    const bomb = state.bomb;
    if (bomb.planted || bomb.carrier !== 'player' || !player.body.alive) {
      bomb.plant = 0;
      if (!bomb.planted) hud.setBomb(null, 0);
      return;
    }
    const site = siteNear(player.body.position, 3.4);
    if (site && keys.has('KeyE')) {
      bomb.plant += dt / MATCH.plantSeconds;
      hud.setBomb(`Planting the charge — ${site.name}`, bomb.plant);
      if (Math.floor(bomb.plant * 10) !== Math.floor((bomb.plant - dt / MATCH.plantSeconds) * 10)) audio.plantTick();
      if (bomb.plant >= 1) {
        bomb.planted = true;
        bomb.site = site.id;
        bomb.fuse = MATCH.fuseSeconds;
        bomb.plant = 0;
        state.money = Math.min(MATCH.maxMoney, state.money + MATCH.plantMoney);
        hud.setMoney(state.money);
        hud.setBomb(`Charge planted at ${site.name} — ${Math.ceil(bomb.fuse)}s`, 1);
        hud.banner('CHARGE PLANTED', `${site.name} — defend it until it blows`, 2600);
        audio.beep(true);
        deps.onPlanted('player', site.id);
      }
      return;
    }
    bomb.plant = 0;
    if (!bomb.planted) hud.setBomb(null, 0);
  }

  function update(dt, keys) {
    if (state.phase === 'menu' || state.phase === 'matchEnd') return;
    state.timer -= dt;
    if (state.phase === 'buy') {
      if (state.timer <= 0) {
        state.phase = 'live';
        state.timer = MATCH.roundSeconds;
        hud.hideBuy();
        hud.banner(`ROUND ${state.round}`, 'Go — plant the charge', 1800);
      }
      return;
    }
    if (state.phase === 'roundEnd') {
      if (state.timer <= 0) {
        if (state.score.ember >= MATCH.winRounds || state.score.ash >= MATCH.winRounds || state.round >= MATCH.maxRounds) {
          endMatch();
        } else {
          state.round += 1;
          startRound();
        }
      }
      return;
    }
    // Live round.
    updatePlant(dt, keys);
    const bomb = state.bomb;
    if (bomb.planted) {
      bomb.fuse -= dt;
      hud.setBomb(`Charge at ${bomb.site} — ${Math.max(0, Math.ceil(bomb.fuse))}s`, bomb.fuse / MATCH.fuseSeconds);
      if (bomb.fuse <= 0) {
        endRound('ember', 'The charge detonated');
        return;
      }
    }
    if (state.timer <= 0 && !bomb.planted) {
      endRound('ash', 'Time expired — the charge never went off');
      return;
    }
    const emberAlive = aliveCount('ember');
    const ashAlive = aliveCount('ash');
    if (emberAlive === 0 && !bomb.planted) {
      endRound('ash', 'Your crew was wiped out');
      return;
    }
    if (ashAlive === 0 && !bomb.planted) {
      endRound('ember', 'Ash Wardens eliminated');
      return;
    }
    if (ashAlive === 0 && bomb.planted) {
      endRound('ember', 'Site cleared — the charge will blow');
    }
  }

  // Bot hooks, attached to the object main.js passes to createBots.
  const botHooks = {
    onBotArrived(bot) {
      const bomb = state.bomb;
      if (state.phase !== 'live' && state.phase !== 'buy') return;
      if (bot.team === 'ember' && bomb.carrier === bot.id && !bomb.planted) {
        const site = bot.site === 'A' ? deps.world.sites[0] : deps.world.sites[1];
        const dx = bot.body.position.x - site.x;
        const dz = bot.body.position.z - site.z;
        if (dx * dx + dz * dz < 4.5 * 4.5) {
          bot.state = 'plant';
          bot.plantProgress = 0;
        }
      }
      if (bot.team === 'ember' && bomb.dropped) {
        const dx = bot.body.position.x - bomb.dropped.x;
        const dz = bot.body.position.z - bomb.dropped.z;
        if (dx * dx + dz * dz < 2 * 2) {
          bomb.carrier = bot.id;
          bomb.dropped = null;
          const site = bot.site === 'A' ? 13 : 14;
          bots.routeTo(bot, site);
        }
      }
      if (bot.team === 'ash' && bomb.planted) {
        const site = bomb.site === 'A' ? deps.world.sites[0] : deps.world.sites[1];
        const dx = bot.body.position.x - site.x;
        const dz = bot.body.position.z - site.z;
        if (dx * dx + dz * dz < 3 * 3) {
          bot.state = 'defuse';
          bot.defuseProgress = 0;
        }
      }
    },
    plantTick(bot, progress) {
      state.bomb.plant = progress / MATCH.plantSeconds;
      hud.setBomb(`Charge being planted — ${bot.name}`, state.bomb.plant);
    },
    defuseTick(bot, progress) {
      state.bomb.defuse = progress / MATCH.defuseSeconds;
      hud.setBomb(`Charge being defused — ${bot.name}`, state.bomb.defuse);
    },
    onPlanted(bot) {
      const bomb = state.bomb;
      bomb.planted = true;
      bomb.site = bot.site;
      bomb.fuse = MATCH.fuseSeconds;
      bomb.plant = 0;
      hud.banner('CHARGE PLANTED', `${bot.name} planted at site ${bot.site}`, 2600);
      audio.beep(true);
      deps.onPlanted(bot.name, bot.site);
      // The two nearest defenders move to defuse.
      const site = bot.site === 'A' ? deps.world.sites[0] : deps.world.sites[1];
      const defenders = bots.bots
        .filter((b) => b.team === 'ash' && b.body.alive)
        .map((b) => ({ b, d: Math.hypot(b.body.position.x - site.x, b.body.position.z - site.z) }))
        .sort((a, b2) => a.d - b2.d)
        .slice(0, 2);
      for (const { b } of defenders) {
        b.state = 'route';
        bots.routeTo(b, bot.site === 'A' ? 13 : 14);
      }
    },
    onDefused(bot) {
      state.bomb.planted = false;
      state.bomb.defuse = 0;
      hud.setBomb(null, 0);
      endRound('ash', `${bot.name} defused the charge`);
    },
  };

  return { startMatch, startRound, endRound, buy, update, botHooks, aliveCount, bombDropped };
}
