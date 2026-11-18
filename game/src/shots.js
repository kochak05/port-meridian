// The screenshot scenes behind ?shot=start|chase|mission|overview.
// Each one plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple scripted driver, so the frame is
// what a short game really looks like and the same seed always gives the
// same frame. The renderer paints it twice and main.js sets
// window.__shotReady for a screenshot. All staged positions sit on
// roads, matching the mission targets in config.js.
import { STEP } from './config.js';
import { clamp } from './random.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function drive(world, seconds, steer) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    const input = { x: steer || 0, y: -1, sprint: false };
    const p = world.state.player;
    const angle = p.inCar && p.car ? p.car.angle : p.angle;
    world.step(STEP, input, angle, false);
  }
}
function walk(world, seconds, dx, dy) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) world.step(STEP, { x: dx, y: dy, sprint: true }, 0, false);
}

// Set `world` to the named scene and return the screen to draw over it,
// the best score to show, and whether to draw the city overview.
export function stageShot(name, world) {
  world.reset();
  const s = world.state;
  if (name === 'start') {
    for (let i = 0; i < 5 / STEP; i++) world.step(STEP, { x: 0, y: 0, sprint: false }, 0, false);
    return { screen: SCREEN_TITLE, best: 0, overview: false };
  }
  if (name === 'overview') {
    // A car, traffic and pedestrians across the whole city, seen from above.
    const parked = s.cars.find((c) => c.kind === 'parked') || s.cars[0];
    s.player.x = parked.x; s.player.y = parked.y;
    world.enterCar();
    s.wanted = 1;
    for (let i = 0; i < 4 / STEP; i++) world.step(STEP, { x: 0, y: -1, sprint: false }, 0, false);
    return { screen: SCREEN_PLAY, best: s.player.money, overview: true };
  }
  if (name === 'mission') {
    // On foot at the Old Warehouse: guards alive, Mara shooting, wanted 3.
    // Player starts on the warehouse road (x = 2208 is a road centre),
    // not inside the warehouse block.
    world.startMission(2);
    s.player.x = 2208; s.player.y = 1500; s.player.angle = 0.6;
    s.wanted = 3;
    for (let i = 0; i < 2.5 / STEP; i++) {
      const g = s.guards.find((x) => x.alive);
      const aim = g ? Math.atan2(g.y - s.player.y, g.x - s.player.x) : 0;
      world.step(STEP, { x: 0.4, y: 0.4, sprint: false }, aim, i % 14 === 0);
    }
    // Centre the camera on the player, clamped to the world like
    // step() does: setting it to the raw player position put the
    // camera past the world's south edge, so the bottom of the
    // mission screenshot was empty backdrop.
    s.camera.x = clamp(s.player.x, 640, 2560 - 640);
    s.camera.y = clamp(s.player.y, 360, 1920 - 360);
    return { screen: SCREEN_PLAY, best: s.player.money, overview: false };
  }
  // Default: chase — Mara in a car, wanted level 3, police chasing,
  // mission M2 in progress, minimap and objective on the HUD.
  world.startMission(1);
  const car = s.cars.find((c) => c.isGold) || s.cars[0];
  s.player.x = car.x; s.player.y = car.y;
  world.enterCar();
  s.wanted = 3;
  drive(world, 6, 0);
  // Steer a little so the car is mid-turn on a road, police close behind.
  for (let i = 0; i < 1.2 / STEP; i++) world.step(STEP, { x: 0.5, y: -1, sprint: false }, 0, false);
  return { screen: SCREEN_PLAY, best: s.player.money, overview: false };
}
