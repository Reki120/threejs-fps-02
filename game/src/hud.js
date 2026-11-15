// The DOM HUD: crosshair, hit marker, health, ammo, money, timer, score, kill
// feed, buy menu and banners. It never touches the simulation; main.js pushes
// numbers in and reads button callbacks out. Every setter skips a DOM write
// when the value did not change.
import { WEAPONS, GRENADE } from './config.js';

export function createHud(callbacks) {
  const $ = (id) => document.getElementById(id);
  const crosshair = $('crosshair');
  const hitmarker = $('hitmarker');
  const healthNum = $('health-num');
  const healthFill = $('health-fill');
  const ammoMag = $('ammo-mag');
  const ammoReserve = $('ammo-reserve');
  const weaponName = $('weapon-name');
  const moneyValue = $('money-value');
  const timerValue = $('timer-value');
  const scoreEmber = $('score-ember');
  const scoreAsh = $('score-ash');
  const aliveEmber = $('alive-ember');
  const aliveAsh = $('alive-ash');
  const killfeed = $('killfeed');
  const bombStatus = $('bomb-status');
  const bombFill = $('bomb-fill');
  const bombText = $('bomb-text');
  const banner = $('banner');
  const bannerTitle = $('banner-title');
  const bannerSub = $('banner-sub');
  const vignette = $('vignette');
  const overlay = $('overlay');
  const overlayTitle = $('overlay-title');
  const overlayCopy = $('overlay-copy');
  const playButton = $('play');
  const buyMenu = $('buy-menu');
  const buyMoney = $('buy-money');
  const deployButton = $('deploy');

  let lastHealth = -1;
  let lastMag = -1;
  let lastReserve = -1;
  let lastWeapon = '';
  let lastMoney = -1;
  let lastTimer = '';
  let lastScore = '';
  let lastAlive = '';
  let bannerTimer = 0;
  let hitTimer = 0;

  const BUY_ITEMS = [
    { key: 'vk47', label: 'VK-47 rifle', price: WEAPONS.vk47.price, desc: 'Auto · 30 rounds · accurate' },
    { key: 'wasp', label: 'Wasp-9 SMG', price: WEAPONS.wasp.price, desc: 'Fast · 32 rounds · close range' },
    { key: 'longbow', label: 'Longbow marksman', price: WEAPONS.longbow.price, desc: 'Bolt · 5 rounds · one shot' },
    { key: 'grenade', label: 'Spark grenade', price: GRENADE.price, desc: 'Frag · throw with G' },
  ];

  // Build the buy menu once; the sim only updates prices and owned marks.
  const buyList = $('buy-list');
  for (const item of BUY_ITEMS) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'buy-row';
    row.dataset.key = item.key;
    row.innerHTML = `<span class="buy-name">${item.label}</span><span class="buy-desc">${item.desc}</span><span class="buy-price">$${item.price}</span>`;
    row.addEventListener('click', () => callbacks.onBuy(item.key));
    buyList.appendChild(row);
  }
  deployButton.addEventListener('click', () => callbacks.onDeploy());
  playButton.addEventListener('click', () => callbacks.onPlay());

  function showOverlay(mode, data = {}) {
    const copy = {
      start: { title: 'EMBERWORKS', text: 'Kiln Yard — a foundry yard, two sites, one charge. Your crew plants it; the Ash Wardens stop you. Click to deploy.', action: 'Deploy' },
      paused: { title: 'EMBERWORKS', text: 'Paused. Click to resume.', action: 'Resume' },
      matchEnd: { title: data.won ? 'YARD TAKEN' : 'YARD LOST', text: `Final score Ember ${data.ember} — ${data.ash} Ash.`, action: 'Play again' },
    }[mode];
    overlayTitle.textContent = copy.title;
    overlayCopy.textContent = copy.text;
    playButton.textContent = copy.action;
    overlay.hidden = false;
    playButton.focus();
  }

  return {
    setHealth(hp) {
      const value = Math.max(0, Math.round(hp));
      if (value === lastHealth) return;
      lastHealth = value;
      healthNum.textContent = String(value);
      healthFill.style.width = `${value}%`;
      healthFill.classList.toggle('low', value <= 30);
    },
    setAmmo(mag, reserve, name) {
      if (mag !== lastMag) { lastMag = mag; ammoMag.textContent = String(mag); }
      if (reserve !== lastReserve) { lastReserve = reserve; ammoReserve.textContent = `/ ${reserve}`; }
      if (name !== lastWeapon) { lastWeapon = name; weaponName.textContent = name; }
      $('ammo').classList.toggle('empty', mag === 0);
    },
    setMoney(value) {
      if (value === lastMoney) return;
      lastMoney = value;
      moneyValue.textContent = `$${value}`;
      buyMoney.textContent = `$${value}`;
    },
    setTimer(seconds, phase) {
      const text = `${Math.max(0, Math.ceil(seconds))} · ${phase === 'buy' ? 'BUY' : phase === 'live' ? 'ROUND' : ''}`;
      if (text === lastTimer) return;
      lastTimer = text;
      timerValue.textContent = text;
      timerValue.classList.toggle('urgent', seconds <= 10 && phase === 'live');
    },
    setScore(ember, ash) {
      const text = `${ember}-${ash}`;
      if (text === lastScore) return;
      lastScore = text;
      scoreEmber.textContent = String(ember);
      scoreAsh.textContent = String(ash);
    },
    setAlive(emberAlive, ashAlive) {
      const text = `${emberAlive}-${ashAlive}`;
      if (text === lastAlive) return;
      lastAlive = text;
      aliveEmber.textContent = `Ember ${emberAlive} alive`;
      aliveAsh.textContent = `Ash ${ashAlive} alive`;
    },
    setSpread(px) {
      crosshair.style.setProperty('--gap', `${Math.round(px)}px`);
    },
    hitMarker(killed, head) {
      hitmarker.classList.add('on');
      hitmarker.classList.toggle('kill', killed);
      hitmarker.classList.toggle('head', head && !killed);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hitmarker.classList.remove('on', 'kill', 'head'), killed ? 220 : 120);
    },
    killfeed(text) {
      const entry = document.createElement('div');
      entry.className = 'feed-entry';
      entry.textContent = text;
      killfeed.prepend(entry);
      while (killfeed.children.length > 5) killfeed.removeChild(killfeed.lastChild);
      setTimeout(() => entry.remove(), 4500);
    },
    setBomb(text, progress) {
      if (!text) {
        bombStatus.hidden = true;
        return;
      }
      bombStatus.hidden = false;
      bombText.textContent = text;
      bombFill.style.width = `${Math.round(progress * 100)}%`;
    },
    banner(title, sub, holdMs = 2600) {
      bannerTitle.textContent = title;
      bannerSub.textContent = sub;
      banner.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { banner.hidden = true; }, holdMs);
    },
    hideBanner() {
      banner.hidden = true;
      clearTimeout(bannerTimer);
    },
    damageFlash() {
      vignette.classList.remove('flash');
      void vignette.offsetWidth;
      vignette.classList.add('flash');
    },
    showBuy(loadout, money) {
      buyMenu.hidden = false;
      for (const row of buyList.children) {
        const key = row.dataset.key;
        const owned = key === 'grenade' ? loadout.grenades > 0 : loadout.primary === key;
        const price = key === 'grenade' ? GRENADE.price : WEAPONS[key].price;
        row.classList.toggle('owned', owned);
        row.classList.toggle('cant', money < price && !owned);
      }
      buyMoney.textContent = `$${money}`;
    },
    hideBuy() { buyMenu.hidden = true; },
    showOverlay,
    hideOverlay() { overlay.hidden = true; },
  };
}
