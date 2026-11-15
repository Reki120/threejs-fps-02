// All sound is synthesised with WebAudio: no audio files, no network. One
// AudioContext created on the first user gesture; every effect is a short graph
// of oscillators and filtered noise, built fresh per call (cheap at this rate).
export function createAudio() {
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function burst(duration, filterType, frequency, gainValue, when = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(duration + 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(t);
    source.stop(t + duration + 0.05);
  }

  function tone(frequency, duration, type, gainValue, slideTo = 0, when = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  // weapon: 'p9' | 'vk47' | 'wasp' | 'longbow'; level scales the gain so a
  // distant bot's shot is quieter than the player's own.
  function shot(weapon, level = 1) {
    if (weapon === 'longbow') {
      burst(0.22, 'lowpass', 900, 0.9 * level);
      tone(140, 0.16, 'sine', 0.5 * level, 55);
    } else if (weapon === 'wasp') {
      burst(0.08, 'bandpass', 2400, 0.55 * level);
      tone(220, 0.05, 'square', 0.12 * level, 110);
    } else if (weapon === 'vk47') {
      burst(0.12, 'lowpass', 1400, 0.8 * level);
      tone(170, 0.08, 'sine', 0.4 * level, 70);
    } else {
      burst(0.09, 'bandpass', 1800, 0.6 * level);
      tone(200, 0.05, 'square', 0.14 * level, 100);
    }
  }

  return {
    unlock() { ensure(); },
    shot,
    dry() { tone(900, 0.04, 'square', 0.1); },
    reload() {
      tone(500, 0.05, 'square', 0.12);
      tone(340, 0.05, 'square', 0.12, 0, 0.35);
      tone(620, 0.05, 'square', 0.14, 0, 0.8);
    },
    hit(head) {
      tone(head ? 1500 : 1050, 0.06, 'sine', 0.25);
      if (head) tone(2100, 0.08, 'sine', 0.2, 0, 0.05);
    },
    hurt() { burst(0.12, 'lowpass', 500, 0.5); tone(90, 0.14, 'sine', 0.4, 50); },
    explode() {
      burst(0.9, 'lowpass', 320, 1.0);
      tone(70, 0.8, 'sine', 0.9, 28);
      burst(0.25, 'highpass', 3000, 0.25, 0.02);
    },
    beep(final) { tone(final ? 1400 : 950, final ? 0.3 : 0.12, 'sine', 0.25); },
    plantTick() { tone(1150, 0.07, 'sine', 0.22); },
    buy() { tone(700, 0.07, 'sine', 0.2); tone(1050, 0.09, 'sine', 0.2, 0, 0.08); },
    deny() { tone(220, 0.16, 'sawtooth', 0.16, 160); },
    roundWin() {
      tone(523, 0.14, 'sine', 0.25); tone(659, 0.14, 'sine', 0.25, 0, 0.13);
      tone(784, 0.28, 'sine', 0.28, 0, 0.26);
    },
    roundLose() {
      tone(392, 0.18, 'sine', 0.25); tone(311, 0.18, 'sine', 0.25, 0, 0.16);
      tone(233, 0.36, 'sine', 0.28, 0, 0.32);
    },
    pickup() { tone(880, 0.08, 'sine', 0.2); tone(1320, 0.1, 'sine', 0.18, 0, 0.07); },
  };
}
