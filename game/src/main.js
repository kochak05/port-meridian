// Port Meridian — boot and the one loop: input is read every frame,
// the world advances in fixed 1/60 s steps, and the renderer paints
// what is there. Screens: title, play, paused, game over and win
// (debt paid).
// ?seed=N fixes the city. ?shot=start|chase|mission|overview (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_COIN, EVENT_HIT, EVENT_MISSION, EVENT_OVER, EVENT_SHOOT, EVENT_WANTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_SAVE, ACTION_SHOOT, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25; // clamp a long frame so a tab switch cannot jump the world
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
let muted = false;

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* storage off */ }
}
function saveGame() {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.saveData())); return true; } catch { return false; }
}
function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? world.loadData(JSON.parse(raw)) : false;
  } catch { return false; }
}

function runShot(name) {
  const scene = stageShot(name, world);
  world.state._mission = world.mission();
  world.state._target = world.targetPos();
  world.state._mouse = { x: 640, y: 360 };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, muted, scene.overview);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let shootQueued = false;
  let last = performance.now();
  // A save, if one exists, is loaded once here. startGame() must NOT
  // reset the world on the first start after loading it, or the save
  // would be thrown away before the player ever sees it (that was the
  // old bug: loadGame() ran, then startGame() called world.reset()).
  const hadSave = loadGame();
  let resumedSave = false;
  if (hadSave) world.setMessage('Save loaded — welcome back to Port Meridian.', 4);

  function announce(message) { status.textContent = message; }
  function startGame() {
    if (hadSave && !resumedSave) {
      // First start with a save: keep the loaded money, mission and
      // position, and only reset the frame accumulator.
      resumedSave = true;
    } else {
      world.reset();
    }
    accumulator = 0; shootQueued = false; screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Mara Voss, Port Meridian.');
  }
  function endGame(win) {
    screen = win ? SCREEN_WIN : SCREEN_OVER;
    resumedSave = false; // the next start is a fresh run, not a resume
    if (world.state.player.money > best) { best = world.state.player.money; saveBest(best); }
    saveGame();
    announce(win ? 'Debt paid. Mara is free.' : 'Game over. Score $' + world.state.player.money + '. Best $' + best + '.');
  }
  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) { muted = audio.toggleMute(); }
    if (actions & ACTION_SHOOT) shootQueued = true;
    if (actions & ACTION_SAVE && screen === SCREEN_PLAY) {
      if (saveGame()) world.setMessage('Game saved.', 2);
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) { startGame(); return; }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
    else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_ENTER) {
      if (world.state.player.inCar) world.exitCar();
      else {
        const before = world.state.wanted;
        world.enterCar();
        if (world.state.wanted > before) audio.sirenTick();
      }
    }
  }
  function step() {
    if (screen === SCREEN_TITLE) { world.step(STEP, { x: 0, y: 0, sprint: false }, 0, false); return; }
    const axis = input.axis();
    const mouse = input.mouse();
    // Aim: from the player to the mouse, in world coordinates.
    // mouse.x/y are already relative to the canvas (input.js subtracts
    // the canvas rect), so scale them to the 1280x720 logical view.
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width, scaleY = 720 / rect.height;
    const viewX = mouse.x * scaleX;
    const viewY = mouse.y * scaleY;
    const cam = world.state.camera;
    const worldMouseX = cam.x - 640 + viewX;
    const worldMouseY = cam.y - 360 + viewY;
    const aim = Math.atan2(worldMouseY - world.state.player.y, worldMouseX - world.state.player.x);
    const shootPressed = shootQueued || mouse.down;
    shootQueued = false;
    const events = world.step(STEP, { x: axis.x, y: axis.y, sprint: input.sprint() }, aim, shootPressed);
    world.state._mouse = { x: viewX, y: viewY };
    if (events & EVENT_OVER) { audio.fail(); endGame(false); }
    else if (world.state.allDone && screen === SCREEN_PLAY) { audio.mission(); endGame(true); }
    else if (events & EVENT_SHOOT) audio.shoot();
    else if (events & EVENT_MISSION) audio.mission();
    else if (events & EVENT_COIN) audio.coin();
    else if (events & EVENT_HIT) audio.crash();
    else if (events & EVENT_WANTED) audio.sirenTick();
    if (world.state.player.inCar) audio.engine(Math.abs(world.state.player.speed) / 560);
    else audio.engineOff();
    if (world.state.wanted > 0 && Math.random() < 0.01) audio.sirenTick();
  }
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) { step(); accumulator -= STEP; }
    } else accumulator = 0;
    // Expose the current mission/target for the HUD and minimap.
    world.state._mission = world.mission();
    world.state._target = world.targetPos();
    renderer.draw(world.state, screen, best, muted, false);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });
  announce('Port Meridian. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
