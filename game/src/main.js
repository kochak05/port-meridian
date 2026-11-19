// Boot and the one loop for Port Meridian: input is read every frame, the
// world advances in fixed 1/60 s steps, the renderer paints what is there,
// and the audio synth reacts to what happened. The game moves between five
// screens: title, play, paused, busted and win.
//
// ?seed=N fixes the city. ?shot=start|chase|mission|overview (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, MISSIONS, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALL_DONE, EVENT_GAME_OVER, EVENT_HIT, EVENT_MISSION_DONE, EVENT_PICKUP, EVENT_SHOT, EVENT_WANTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readNumber(key) {
  try {
    return Number.parseInt(window.localStorage.getItem(key) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveNumber(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
  }
}

function saveGame() {
  const p = world.state.player;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: p.money, hp: p.hp, ammo: p.ammo,
      missionIndex: world.state.missionIndex, missionStage: world.state.missionStage,
      x: p.x, y: p.y,
    }));
  } catch {
    // See saveNumber.
  }
}

function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const p = world.state.player;
    p.money = data.money || 0;
    p.hp = data.hp || 100;
    p.ammo = data.ammo || 48;
    p.x = data.x ?? p.x;
    p.y = data.y ?? p.y;
    world.state.missionIndex = data.missionIndex || 0;
    world.state.missionStage = data.missionStage || 'pickup';
    world.state.mission = MISSIONS[world.state.missionIndex];
    return true;
  } catch {
    return false;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readNumber(BEST_KEY);
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  // A save found at boot is continued, not wiped: only a fresh run resets.
  let continuingSave = false;
  function startGame(fresh) {
    if (fresh && !continuingSave) world.reset();
    continuingSave = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Playing. Mission ${world.state.missionIndex + 1}: ${world.state.mission.name}.`);
  }

  function endGame(win) {
    screen = win ? SCREEN_WIN : SCREEN_OVER;
    const money = world.state.player.money;
    if (money > best) {
      best = money;
      saveNumber(BEST_KEY, best);
    }
    announce(win ? `All missions complete! You made $${money}.` : `Busted. You made $${money}.`);
  }

  // The frame's one-shot actions, taken once in frame() and shared by the
  // pause/confirm handling and the step bundle below.
  let frameActions = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    frameActions = input.takeActions();
    if (frameActions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (frameActions & ACTION_CONFIRM) startGame(true);
    } else if (frameActions & ACTION_PAUSE) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
      announce(screen === SCREEN_PAUSED ? 'Paused.' : 'Playing.');
    }
    if (screen === SCREEN_TITLE) {
      // The title screen's backdrop: traffic and pedestrians keep moving.
      world.step(STEP, { mx: 0, my: 0, enter: false, shoot: false, brake: false });
      accumulator = 0;
    } else if (screen === SCREEN_PLAY) {
      const vector = input.vector();
      const bundle = {
        mx: vector.mx,
        my: vector.my,
        enter: !!(frameActions & ACTION_ENTER),
        shoot: input.shooting(),
        brake: vector.my > 0 && !!world.state.player.inCar,
      };
      while (accumulator >= STEP) {
        const events = world.step(STEP, bundle);
        accumulator -= STEP;
        if (events & EVENT_SHOT) audio.shoot();
        if (events & EVENT_HIT) audio.hit();
        if (events & EVENT_PICKUP) audio.pickup();
        if (events & EVENT_MISSION_DONE) { audio.missionDone(); saveGame(); }
        if (events & EVENT_WANTED) audio.siren(world.state.wanted);
        if (events & EVENT_ALL_DONE) { saveGame(); endGame(true); break; }
        if (events & EVENT_GAME_OVER) { endGame(false); break; }
        if (screen !== SCREEN_PLAY) break;
      }
      const p = world.state.player;
      audio.setDriving(!!p.inCar, p.inCar ? p.inCar.speed : 0);
      audio.siren(world.state.wanted);
    } else {
      accumulator = 0;
      audio.setDriving(false, 0);
    }
    world.state._objective = world.objective();
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Continue a saved run if there is one; otherwise start fresh on confirm.
  const hadSave = loadGame();
  continuingSave = hadSave;
  announce(hadSave
    ? 'Port Meridian. Save found — press Enter to continue your run.'
    : 'Port Meridian. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
