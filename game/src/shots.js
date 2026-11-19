// The screenshot scenes behind ?shot=start|chase|mission|overview. Each one
// plays the real rules forward from a fresh world, steered by a small pilot
// that walks to a car, steals it, drives to the mission marker and, in the
// heist, gets out and shoots the guards — so every frame is what a short
// game really looks like, and the same seed always gives the same frame.
//
// The pilot navigates on the road grid: it plans a route of intersections
// between the hero and the objective (breadth-first over the road grid) and
// follows its waypoints, reversing out if it gets wedged on a building.
import { CAR, ROAD_X, ROAD_Y, STEP } from './config.js';
import { EVENT_ALL_DONE, EVENT_GAME_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// The road grid's intersections, as {x, y} points.
function intersections() {
  const points = [];
  for (const x of ROAD_X) for (const y of ROAD_Y) points.push({ x, y });
  return points;
}

function nearestIntersection(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const p of intersections()) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// Breadth-first route over the intersection grid, from `from` to `to`.
// Returns waypoints: the intersections in order, then the final target.
export function planRoute(fromX, fromY, toX, toY) {
  const start = nearestIntersection(fromX, fromY);
  const goal = nearestIntersection(toX, toY);
  const key = (p) => `${p.x},${p.y}`;
  const prev = new Map();
  const queue = [start];
  prev.set(key(start), null);
  while (queue.length > 0) {
    const current = queue.shift();
    if (key(current) === key(goal)) break;
    for (const next of intersections()) {
      if (key(next) === key(current)) continue;
      if (next.x !== current.x && next.y !== current.y) continue;
      if (prev.has(key(next))) continue;
      prev.set(key(next), current);
      queue.push(next);
    }
  }
  const path = [];
  let node = goal;
  while (node) {
    path.unshift(node);
    node = prev.get(key(node));
  }
  path.push({ x: toX, y: toY });
  return path;
}

// One pilot step: work out the input bundle for the current situation.
// `nav` is the pilot's memory: its route, waypoint index and stuck timer.
function pilot(state, nav) {
  const p = state.player;
  const obj = state._objective;
  const input = { mx: 0, my: 0, enter: false, shoot: false, brake: false };
  if (!obj) return input;

  // Heist: guards alive and we are close — get out and shoot them.
  if (state.guards.length > 0 && state.guardsLeft > 0) {
    const alive = state.guards.find((g) => g.hp > 0);
    if (alive) {
      if (p.inCar) {
        if (Math.hypot(p.x - alive.x, p.y - alive.y) < 220) {
          input.enter = true;
          return input;
        }
      } else {
        // Walk at the guard and shoot: walking keeps the hero facing the
        // guard, and the world's guard separation stops the hero standing
        // on top of one, so bullets never spawn past their target.
        const d = Math.hypot(p.x - alive.x, p.y - alive.y);
        const a = Math.atan2(alive.y - p.y, alive.x - p.x);
        input.mx = Math.cos(a);
        input.my = Math.sin(a);
        if (d < 300) input.shoot = true;
        return input;
      }
    }
  }

  if (p.inCar) {
    // In the getaway, a non-gold car is useless at the coupe: get out.
    if (state.missionIndex === 1 && state.missionStage === 'pickup' && !p.inCar.gold) {
      if (Math.hypot(p.x - obj.x, p.y - obj.y) < 140) {
        input.enter = true;
        return input;
      }
    }
    // Follow the route's waypoints, one at a time.
    if (!nav.route || nav.routeKey !== `${obj.x},${obj.y}`) {
      nav.route = planRoute(p.x, p.y, obj.x, obj.y);
      nav.routeKey = `${obj.x},${obj.y}`;
      nav.waypoint = 0;
      nav.stuckTimer = 0;
      nav.lastX = p.x;
      nav.lastY = p.y;
    }
    const wp = nav.route[Math.min(nav.waypoint, nav.route.length - 1)];
    const d = Math.hypot(wp.x - p.x, wp.y - p.y);
    // Advance only once the car is really at the intersection: turning
    // early cuts the corner across the block and wedges the car on a
    // building. Slow down for a sharp turn at the next waypoint.
    if (d < 40 && nav.waypoint < nav.route.length - 1) nav.waypoint += 1;
    // Wedged against a building (moving fast but going nowhere): reverse
    // briefly, steering the other way, then carry on. A slow turn at a
    // waypoint is not being wedged, so it never triggers this.
    nav.stuckTimer += STEP;
    if (nav.stuckTimer > 1) {
      const moved = Math.hypot(p.x - nav.lastX, p.y - nav.lastY);
      nav.lastX = p.x;
      nav.lastY = p.y;
      nav.stuckTimer = 0;
      if (moved < 8 && Math.abs(p.inCar.speed) > 150) nav.reverseUntil = state.time + 0.9;
    }
    const car = p.inCar;
    if (nav.reverseUntil && state.time < nav.reverseUntil) {
      const want = Math.atan2(wp.y - car.y, wp.x - car.x);
      input.mx = -clamp(angleDiff(car.angle, want) * 1.6, -1, 1);
      input.my = 1; // reverse
      return input;
    }
    const want = Math.atan2(wp.y - car.y, wp.x - car.x);
    const diff = angleDiff(car.angle, want);
    input.mx = clamp(diff * 1.6, -1, 1);
    input.my = -1;
    if (Math.abs(diff) > 1.1 && Math.abs(car.speed) > 120) input.brake = true;
    if (d < 50) input.my = 0;
    // Brake for the next corner while still approaching this waypoint.
    if (nav.waypoint < nav.route.length - 1) {
      const next = nav.route[nav.waypoint + 1];
      const turn = Math.abs(angleDiff(Math.atan2(next.y - wp.y, next.x - wp.x), want));
      if (turn > 1.0 && d < 220 && Math.abs(car.speed) > 180) input.brake = true;
    }
    return input;
  }

  // On foot: find the car to take. In the getaway that is the gold coupe
  // itself; otherwise the nearest stealable car, unless the objective is
  // closer than any car.
  let car = null;
  let carD = Infinity;
  for (const c of state.cars) {
    if (c.traffic) continue;
    if (state.missionIndex === 1 && state.missionStage === 'pickup' && !c.gold) continue;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < carD) { carD = d; car = c; }
  }
  const objD = Math.hypot(p.x - obj.x, p.y - obj.y);
  if (car && carD < 65) {
    input.enter = true;
    nav.route = null;
    return input;
  }
  // In the getaway the gold coupe is the target, not its intersection.
  const target = state.missionIndex === 1 && state.missionStage === 'pickup' && car
    ? car
    : car && carD < objD ? car : obj;
  const a = Math.atan2(target.y - p.y, target.x - p.x);
  input.mx = Math.cos(a);
  input.my = Math.sin(a);
  return input;
}

// Drive the world with the pilot for `seconds`, stopping early on a win or
// a bust. Returns the events seen, so a caller can log mission progress.
export function runPilot(world, seconds) {
  const nav = { route: null, routeKey: '', waypoint: 0, stuckTimer: 0, lastX: 0, lastY: 0, reverseUntil: 0 };
  const steps = Math.floor(seconds / STEP);
  let seen = 0;
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    state._objective = world.objective();
    const events = world.step(STEP, pilot(state, nav));
    seen |= events;
    if (events & EVENT_GAME_OVER) break;
    if (events & EVENT_ALL_DONE) break;
  }
  world.state._objective = world.objective();
  return seen;
}

// Set `world` to the named scene and return the screen to draw over it.
export function stageShot(name, world) {
  world.reset();
  if (name === 'start') {
    // A few seconds of the hero walking the streets near the spawn.
    for (let i = 0; i < 6 / STEP; i += 1) {
      const t = i * STEP;
      world.state._objective = world.objective();
      world.step(STEP, { mx: Math.cos(t * 0.7), my: Math.sin(t * 0.7), enter: false, shoot: false, brake: false });
    }
    world.state._objective = world.objective();
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'chase') {
    // Play mission 2: steal the gold coupe and run from the cops. Jump the
    // story to mission 2 (the pilot then plays mission 2 for real).
    world.state.missionIndex = 1;
    world.state.missionStage = 'pickup';
    world.state.mission = { id: 'getaway', name: 'Getaway Car', brief: '', pickup: { x: 320, y: 320, label: 'Gold coupe' }, dropoff: { x: 1600, y: 1600, label: 'East garage' }, reward: 500, wantedOnSteal: 3 };
    world.state.player.money = 350;
    runPilot(world, 18);
    const over = world.state.gameOver;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.player.money };
  }
  if (name === 'mission') {
    // Play mission 3: the harbor heist, guards and all.
    world.state.missionIndex = 2;
    world.state.missionStage = 'pickup';
    world.state.mission = { id: 'heist', name: 'Harbor Heist', brief: '', pickup: { x: 2240, y: 1600, label: 'Harbor warehouse' }, dropoff: { x: 960, y: 320, label: 'Rendezvous' }, reward: 950, wantedOnSteal: 2, guards: 3 };
    world.state.player.money = 850;
    world.state.player.x = 1600;
    world.state.player.y = 1600;
    runPilot(world, 7);
    const over = world.state.gameOver;
    const done = world.state.allDone;
    return { screen: over ? SCREEN_OVER : done ? SCREEN_WIN : SCREEN_PLAY, best: world.state.player.money };
  }
  // Overview: play mission 1, the courier run, from the start.
  runPilot(world, 30);
  const over = world.state.gameOver;
  const done = world.state.allDone;
  return { screen: over ? SCREEN_OVER : done ? SCREEN_WIN : SCREEN_PLAY, best: world.state.player.money };
}
