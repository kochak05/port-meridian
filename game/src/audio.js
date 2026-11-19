// Synthesized sound, no audio files: a tiny WebAudio synth for engine hum,
// gunshots, pickups, sirens and mission jingles. Everything is created lazily
// on the first user gesture, so the page never tries to play before it may.

export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOn = false;
  let sirenTimer = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(context.destination);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, duration, type, volume, slideTo) {
    if (muted || !ensure()) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
      gain.gain.setValueAtTime(volume || 0.12, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + duration);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noiseBurst(duration, volume) {
    if (muted || !ensure()) return;
    try {
      const length = Math.floor(context.sampleRate * duration);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = volume || 0.2;
      source.connect(gain);
      gain.connect(context.destination);
      source.start();
    } catch {
      // Sound is garnish.
    }
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      return muted;
    },
    isMuted() { return muted; },
    setDriving(driving, speed) {
      if (!ensure() || !engineGain) return;
      const target = driving ? 0.03 + Math.min(0.05, Math.abs(speed) / 430 * 0.05) : 0;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, context.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.25, context.currentTime, 0.1);
    },
    shoot() { noiseBurst(0.12, 0.25); blip(220, 0.08, 'square', 0.1, 60); },
    pickup() { blip(660, 0.12, 'sine', 0.15); blip(990, 0.18, 'sine', 0.15); },
    missionDone() {
      blip(523, 0.14, 'triangle', 0.16);
      setTimeout(() => blip(659, 0.14, 'triangle', 0.16), 130);
      setTimeout(() => blip(784, 0.26, 'triangle', 0.18), 260);
    },
    hit() { blip(140, 0.2, 'sawtooth', 0.16, 70); },
    siren(wanted) {
      if (wanted > 0 && !sirenOn) {
        sirenOn = true;
        let high = false;
        sirenTimer = setInterval(() => {
          if (!muted) blip(high ? 880 : 660, 0.35, 'sine', 0.05);
          high = !high;
        }, 380);
      } else if (wanted === 0 && sirenOn) {
        sirenOn = false;
        if (sirenTimer) clearInterval(sirenTimer);
        sirenTimer = null;
      }
    },
  };
}
