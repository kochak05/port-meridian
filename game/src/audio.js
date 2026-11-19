// Sound, all synthesised with WebAudio — no audio files, no network.
// Engine hum, siren wail, gunshot, pickup chime, mission jingle,
// crash thud: every sound is made here, in code.
export function createAudio() {
  let ctx = null, master = null, muted = false, engineOsc = null, engineGain = null;
  let sirenHigh = false; // sirenTick alternates high/low for a real wail
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
    } catch { /* audio is optional */ }
  }
  function noise(dur, vol, low) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 1200;
      const g = ctx.createGain(); g.gain.value = vol || 0.2;
      src.connect(f); f.connect(g); g.connect(master); src.start();
    } catch { /* audio is optional */ }
  }
  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    shoot() { noise(0.12, 0.3, 3000); tone(180, 0.08, 'square', 0.12, 60); },
    punch() { noise(0.08, 0.2, 900); },
    pickup() { tone(660, 0.12, 'sine', 0.2); setTimeout(() => tone(990, 0.18, 'sine', 0.2), 90); },
    coin() { tone(880, 0.09, 'sine', 0.16); setTimeout(() => tone(1320, 0.14, 'sine', 0.16), 70); },
    crash() { noise(0.25, 0.35, 700); tone(90, 0.2, 'sawtooth', 0.2, 40); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.2), i * 110)); },
    fail() { [400, 300, 200].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.14), i * 130)); },
    sirenTick() {
      // Alternate high/low so repeated ticks sound like a siren wail,
      // not the same beep every time.
      sirenHigh = !sirenHigh;
      if (sirenHigh) tone(950, 0.28, 'sine', 0.05, 750);
      else tone(750, 0.28, 'sine', 0.05, 950);
    },
    engine(speed01) {
      if (!ensure() || muted) { if (engineOsc) { try { engineOsc.stop(); } catch {} engineOsc = null; } return; }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator(); engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
        engineGain.gain.value = 0.03; engineOsc.connect(engineGain); engineGain.connect(master); engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speed01 * 140;
      engineGain.gain.value = 0.02 + speed01 * 0.05;
    },
    engineOff() { if (engineOsc) { try { engineOsc.stop(); } catch {} engineOsc = null; } },
  };
}
