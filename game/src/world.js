// Port Meridian's rules and state, with no drawing and no browser in it: the
// city, the hero, cars, traffic, pedestrians, police, guards, bullets and the
// three-mission story. step() advances one fixed step from an input bundle and
// returns what happened as bit flags, so a caller (browser loop, screenshot
// stager, or a Node play-test driver) can react without the world knowing
// about screens or sound.
//
// Input bundle: { mx, my, enter, shoot, brake } where mx/my are -1..1
// (steering / throttle direction), enter is a one-shot "get in / out of a
// car", shoot is held fire, brake is held braking.
import { CAR, COP, GUARD, MISSIONS, PALETTE, PEDS, PLAYER, ROAD_HALF, ROAD_X, ROAD_Y, STEP, TRAFFIC, WORLD } from './config.js';
import { pick, range } from './random.js';

export const EVENT_PICKUP = 1;
export const EVENT_DROPOFF = 2;
export const EVENT_MISSION_DONE = 4;
export const EVENT_SHOT = 8;
export const EVENT_HIT = 16;
export const EVENT_WANTED = 32;
export const EVENT_GAME_OVER = 64;
export const EVENT_ALL_DONE = 128;
export const EVENT_CAR_STOLEN = 256;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function onRoad(x, y) {
  for (const rx of ROAD_X) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) <= ROAD_HALF) return true;
  return false;
}

// A point is inside a building (with a small margin) if it overlaps its box.
function hitsBuilding(buildings, x, y, margin) {
  for (const b of buildings) {
    if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return b;
  }
  return null;
}

// Push a circle out of a building box; returns the corrected position.
function pushOutOfBuildings(buildings, x, y, radius) {
  const b = hitsBuilding(buildings, x, y, radius);
  if (!b) return { x, y };
  const left = x - (b.x - radius);
  const right = b.x + b.w + radius - x;
  const top = y - (b.y - radius);
  const bottom = b.y + b.h + radius - y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: b.x - radius, y };
  if (m === right) return { x: b.x + b.w + radius, y };
  if (m === top) return { x, y: b.y - radius };
  return { x, y: b.y + b.h + radius };
}

export function createWorld(random) {
  // ---- city layout -------------------------------------------------------
  const buildings = [];
  const cell = 320;
  for (let gx = 0; gx < WORLD.width / cell; gx += 1) {
    for (let gy = 0; gy < WORLD.height / cell; gy += 1) {
      const cx = gx * cell + cell / 2;
      const cy = gy * cell + cell / 2;
      if (onRoad(cx, cy)) continue;
      // The harbor block in the south-east corner is open water-side ground.
      if (cx > 2100 && cy > 1450) continue;
      const w = range(random, 130, 210);
      const h = range(random, 110, 190);
      buildings.push({
        x: cx - w / 2 + range(random, -20, 20),
        y: cy - h / 2 + range(random, -20, 20),
        w,
        h,
        color: pick(random, ['#7a6a8c', '#6a7a8c', '#8c6a6a', '#5f7a6a']),
      });
    }
  }

  // ---- actors ------------------------------------------------------------
  function makeCar(x, y, angle, color, parked) {
    return { x, y, angle, speed: 0, color, parked: !!parked, traffic: false, lane: 0, dir: 1 };
  }

  const cars = [];
  // Parked cars the hero can steal, near the spawn.
  cars.push(makeCar(1030, 905, 0, '#c94f4f', true));
  cars.push(makeCar(1030, 1015, Math.PI, '#4f7ec9', true));
  cars.push(makeCar(890, 1030, Math.PI / 2, '#5fbf6a', true));
  // The gold coupe for mission 2, parked at the north-west corner.
  const goldCar = makeCar(400, 320, 0, '#f2c94c', true);
  goldCar.gold = true;
  cars.push(goldCar);

  // Traffic: cars cruising the roads, wrapping around the city edges.
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const vertical = random() < 0.5;
    const road = pick(random, vertical ? ROAD_X : ROAD_Y);
    const along = range(random, 0, vertical ? WORLD.height : WORLD.width);
    const lane = (random() < 0.5 ? -1 : 1) * 35;
    const car = makeCar(
      vertical ? road + lane : along,
      vertical ? along : road + lane,
      vertical ? (lane < 0 ? -Math.PI / 2 : Math.PI / 2) : (lane < 0 ? Math.PI : 0),
      pick(random, PALETTE.traffic),
      false,
    );
    car.traffic = true;
    car.speed = TRAFFIC.speed * range(random, 0.85, 1.15);
    cars.push(car);
  }

  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    peds.push({
      x: range(random, 100, WORLD.width - 100),
      y: range(random, 100, WORLD.height - 100),
      angle: range(random, 0, TAU),
      speed: PEDS.speed * range(random, 0.7, 1.2),
      color: pick(random, ['#e8e8e8', '#ffd23f', '#7ec9f2', '#f29ac9']),
      panic: 0,
    });
  }

  const state = {
    time: 0,
    buildings,
    cars,
    peds,
    cops: [],
    bullets: [],
    guards: [],
    player: {
      x: 960, y: 880, angle: -Math.PI / 2, hp: PLAYER.hp, money: 0,
      ammo: PLAYER.ammoStart, inCar: null, invulnerable: 0, shootTimer: 0,
    },
    wanted: 0,
    wantedTimer: 0,
    missionIndex: 0,
    missionStage: 'pickup', // pickup | dropoff | done
    mission: MISSIONS[0],
    safeCracked: false,
    guardsLeft: 0,
    message: 'Welcome to Port Meridian. Follow the gold marker.',
    allDone: false,
    gameOver: false,
    best: 0,
  };

  function objective() {
    if (state.allDone) return null;
    const m = state.mission;
    return state.missionStage === 'pickup'
      ? { x: m.pickup.x, y: m.pickup.y, label: m.pickup.label }
      : { x: m.dropoff.x, y: m.dropoff.y, label: m.dropoff.label };
  }

  function spawnGuards() {
    state.guards = [];
    const base = state.mission.pickup;
    const spots = [
      { x: base.x - 90, y: base.y - 60 },
      { x: base.x + 40, y: base.y + 80 },
      { x: base.x - 40, y: base.y + 140 },
    ];
    for (const s of spots) {
      state.guards.push({ x: s.x, y: s.y, hp: GUARD.hp, shootTimer: range(random, 0.3, 1), angle: 0 });
    }
    state.guardsLeft = state.guards.length;
  }

  function spawnCop() {
    const p = state.player;
    const angle = range(random, 0, TAU);
    const x = clamp(p.x + Math.cos(angle) * 700, 60, WORLD.width - 60);
    const y = clamp(p.y + Math.sin(angle) * 700, 60, WORLD.height - 60);
    const cop = makeCar(x, y, angleTo(x, y, p.x, p.y), '#2b4fd8', false);
    cop.cop = true;
    cop.ramTimer = 0;
    state.cops.push(cop);
  }

  function setWanted(level) {
    if (level <= state.wanted) return 0;
    state.wanted = level;
    state.wantedTimer = 0;
    while (state.cops.length < level) spawnCop();
    return EVENT_WANTED;
  }

  function reset() {
    const p = state.player;
    p.x = 960; p.y = 880; p.angle = -Math.PI / 2; p.hp = PLAYER.hp; p.money = 0;
    p.ammo = PLAYER.ammoStart; p.inCar = null; p.invulnerable = 0; p.shootTimer = 0;
    state.time = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.cops = [];
    state.bullets = [];
    state.guards = [];
    state.missionIndex = 0;
    state.missionStage = 'pickup';
    state.mission = MISSIONS[0];
    state.safeCracked = false;
    state.guardsLeft = 0;
    state.allDone = false;
    state.gameOver = false;
    state.message = 'Welcome to Port Meridian. Follow the gold marker.';
    for (const car of cars) {
      car.speed = car.traffic ? TRAFFIC.speed : 0;
      if (car.gold) { car.x = 400; car.y = 320; car.angle = 0; car.parked = true; }
    }
  }

  function enterOrExitCar() {
    const p = state.player;
    if (p.inCar) {
      const car = p.inCar;
      p.inCar = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      p.angle = car.angle;
      car.parked = true;
      car.speed = 0;
      return 0;
    }
    let best = null;
    let bestD = 70;
    for (const car of cars) {
      if (car.traffic) continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return 0;
    p.inCar = best;
    best.parked = false;
    let events = 0;
    if (best.gold && state.missionIndex === 1 && state.missionStage === 'pickup') {
      events |= EVENT_CAR_STOLEN;
      events |= setWanted(state.mission.wantedOnSteal || 3);
      state.message = 'You stole the gold coupe! Lose the cops and reach the east garage.';
    } else if (!best.gold && state.wanted === 0) {
      events |= setWanted(1);
      state.message = 'Car stolen! The police are on their way.';
    }
    return events;
  }

  function fireBullet() {
    const p = state.player;
    if (p.inCar || p.ammo <= 0 || p.shootTimer > 0) return 0;
    p.ammo -= 1;
    p.shootTimer = PLAYER.shootCooldown;
    state.bullets.push({
      x: p.x + Math.cos(p.angle) * 22,
      y: p.y + Math.sin(p.angle) * 22,
      vx: Math.cos(p.angle) * PLAYER.bulletSpeed,
      vy: Math.sin(p.angle) * PLAYER.bulletSpeed,
      friendly: true,
      life: 1.2,
    });
    return EVENT_SHOT;
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    if (p.shootTimer > 0) p.shootTimer -= dt;
    if (p.invulnerable > 0) p.invulnerable -= dt;
    const car = p.inCar;
    if (car) {
      // Driving: mx steers, my is throttle (forward/back), brake slows hard.
      const steer = clamp(input.mx, -1, 1);
      car.angle += steer * CAR.steer * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * (car.speed < 0 ? -1 : 1);
      // Keep the heading in (-PI, PI] so it never winds up over long drives.
      car.angle = ((car.angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
      if (input.my < 0) car.speed += CAR.accel * -input.my * dt;
      else if (input.my > 0) car.speed -= CAR.accel * 0.6 * input.my * dt;
      if (input.brake) car.speed -= Math.sign(car.speed) * CAR.brake * dt;
      car.speed -= car.speed * CAR.drag * dt;
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      if (Math.abs(car.speed) < 4 && !input.my) car.speed = 0;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const fixed = pushOutOfBuildings(state.buildings, nx, ny, CAR.length / 2);
      car.x = clamp(fixed.x, 30, WORLD.width - 30);
      car.y = clamp(fixed.y, 30, WORLD.height - 30);
      // The position clamp above is the wall: the speed is left alone, so a
      // car sliding along a building keeps its pace and a wedged car can
      // still reverse out. (Multiplying the speed down every frame here
      // used to pin cars to a creep whenever they brushed a wall.)
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      return 0;
    }
    // On foot: 8-way movement, facing follows movement or aim.
    const len = Math.hypot(input.mx, input.my);
    if (len > 0.01) {
      const nx = p.x + (input.mx / Math.max(1, len)) * PLAYER.walkSpeed * dt;
      const ny = p.y + (input.my / Math.max(1, len)) * PLAYER.walkSpeed * dt;
      const fixed = pushOutOfBuildings(state.buildings, nx, ny, PLAYER.radius);
      p.x = clamp(fixed.x, 20, WORLD.width - 20);
      p.y = clamp(fixed.y, 20, WORLD.height - 20);
      p.angle = Math.atan2(input.my, input.mx);
    }
    // The hero cannot stand on top of a guard: keep a body's width apart,
    // so bullets never spawn on the far side of the guard they aim at.
    for (const guard of state.guards) {
      if (guard.hp <= 0) continue;
      const d = dist(p.x, p.y, guard.x, guard.y);
      if (d > 0.01 && d < 26) {
        const push = (26 - d) / d;
        p.x += (p.x - guard.x) * push;
        p.y += (p.y - guard.y) * push;
      }
    }
    if (input.shoot) return fireBullet();
    return 0;
  }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (!car.traffic) continue;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (car.x < -60) car.x = WORLD.width + 60;
      if (car.x > WORLD.width + 60) car.x = -60;
      if (car.y < -60) car.y = WORLD.height + 60;
      if (car.y > WORLD.height + 60) car.y = -60;
    }
  }

  function stepPeds(dt) {
    const p = state.player;
    for (const ped of peds) {
      const d = dist(ped.x, ped.y, p.x, p.y);
      if (d < 160) ped.panic = 1.5;
      if (ped.panic > 0) {
        ped.panic -= dt;
        ped.angle = angleTo(p.x, p.y, ped.x, ped.y);
      } else if (random() < 0.005) {
        ped.angle = range(random, 0, TAU);
      }
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * (ped.panic > 0 ? 1.8 : 1) * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * (ped.panic > 0 ? 1.8 : 1) * dt;
      const fixed = pushOutOfBuildings(state.buildings, nx, ny, 10);
      ped.x = clamp(fixed.x, 20, WORLD.width - 20);
      ped.y = clamp(fixed.y, 20, WORLD.height - 20);
    }
  }

  function stepCops(dt) {
    const p = state.player;
    let events = 0;
    if (state.wanted === 0) {
      // No heat: cops drive off and despawn.
      for (const cop of state.cops) {
        cop.x += Math.cos(cop.angle) * cop.speed * dt;
        cop.y += Math.sin(cop.angle) * cop.speed * dt;
      }
      state.cops = state.cops.filter((c) => dist(c.x, c.y, p.x, p.y) < 1200);
      return 0;
    }
    let nearest = Infinity;
    for (const cop of state.cops) {
      const d = dist(cop.x, cop.y, p.x, p.y);
      if (d < nearest) nearest = d;
      const want = angleTo(cop.x, cop.y, p.x, p.y);
      cop.angle += clamp(angleDiff(cop.angle, want), -2.4 * dt, 2.4 * dt);
      cop.speed = Math.min(COP.maxSpeed, cop.speed + COP.accel * dt);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      // Police drive the streets, not through buildings: slide along walls.
      const fixed = pushOutOfBuildings(state.buildings, cop.x, cop.y, CAR.length / 2);
      cop.x = clamp(fixed.x, 30, WORLD.width - 30);
      cop.y = clamp(fixed.y, 30, WORLD.height - 30);
      if (cop.ramTimer > 0) cop.ramTimer -= dt;
      if (d < 46 && cop.ramTimer <= 0 && p.invulnerable <= 0) {
        cop.ramTimer = COP.ramCooldown;
        cop.speed *= 0.3;
        if (p.inCar) {
          p.inCar.speed *= 0.5;
        } else {
          p.hp -= COP.ramDamage;
          p.invulnerable = 0.8;
          events |= EVENT_HIT;
          if (p.hp <= 0) {
            p.hp = 0;
            state.gameOver = true;
            events |= EVENT_GAME_OVER;
          }
        }
      }
    }
    if (nearest > COP.sight) {
      state.wantedTimer += dt;
      if (state.wantedTimer > COP.decayAfter) {
        state.wanted = Math.max(0, state.wanted - 1);
        state.wantedTimer = 0;
        if (state.wanted === 0) state.message = 'You lost the cops. Keep moving.';
        else state.message = `Wanted level dropped to ${state.wanted}.`;
      }
    } else {
      state.wantedTimer = 0;
    }
    return events;
  }

  function stepGuards(dt) {
    const p = state.player;
    let events = 0;
    for (const guard of state.guards) {
      if (guard.hp <= 0) continue;
      const d = dist(guard.x, guard.y, p.x, p.y);
      guard.angle = angleTo(guard.x, guard.y, p.x, p.y);
      guard.shootTimer -= dt;
      if (d < GUARD.range && guard.shootTimer <= 0 && !state.gameOver) {
        guard.shootTimer = GUARD.shootCooldown;
        state.bullets.push({
          x: guard.x + Math.cos(guard.angle) * 20,
          y: guard.y + Math.sin(guard.angle) * 20,
          vx: Math.cos(guard.angle) * GUARD.bulletSpeed,
          vy: Math.sin(guard.angle) * GUARD.bulletSpeed,
          friendly: false,
          life: 1.4,
        });
      }
    }
    return events;
  }

  function stepBullets(dt) {
    const p = state.player;
    let events = 0;
    for (const bullet of state.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0) continue;
      if (hitsBuilding(state.buildings, bullet.x, bullet.y, 0)) {
        bullet.life = 0;
        continue;
      }
      if (bullet.friendly) {
        for (const guard of state.guards) {
          if (guard.hp > 0 && dist(bullet.x, bullet.y, guard.x, guard.y) < 20) {
            guard.hp -= PLAYER.bulletDamage;
            bullet.life = 0;
            if (guard.hp <= 0) {
              state.guardsLeft -= 1;
              state.message = state.guardsLeft > 0
                ? `Guard down! ${state.guardsLeft} left.`
                : 'All guards down. Crack the safe!';
            }
            break;
          }
        }
      } else if (!p.inCar && p.invulnerable <= 0 && dist(bullet.x, bullet.y, p.x, p.y) < 16) {
        bullet.life = 0;
        p.hp -= 8;
        p.invulnerable = 0.6;
        events |= EVENT_HIT;
        if (p.hp <= 0) {
          p.hp = 0;
          state.gameOver = true;
          events |= EVENT_GAME_OVER;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < WORLD.width && b.y > 0 && b.y < WORLD.height);
    return events;
  }

  function stepMission(dt) {
    if (state.allDone || state.gameOver) return 0;
    const p = state.player;
    const obj = objective();
    if (!obj) return 0;
    let events = 0;
    if (state.missionStage === 'pickup') {
      // The getaway needs the gold coupe itself, not just arriving near it.
      if (state.missionIndex === 1) {
        if (p.inCar && p.inCar.gold) {
          state.missionStage = 'dropoff';
          events |= EVENT_PICKUP;
          state.message = `Gold coupe stolen! Reach: ${state.mission.dropoff.label}.`;
        } else if (dist(p.x, p.y, obj.x, obj.y) < 140) {
          state.message = 'That is the gold coupe — get in it (E) to steal it!';
        }
        return events;
      }
      if (dist(p.x, p.y, obj.x, obj.y) < 64) {
        if (state.missionIndex === 2) {
          if (state.guards.length === 0) spawnGuards();
          if (state.guardsLeft > 0) {
            state.message = `Clear the ${state.guardsLeft} guards first!`;
            return 0;
          }
          state.safeCracked = true;
          state.missionStage = 'dropoff';
          events |= EVENT_PICKUP;
          events |= setWanted(state.mission.wantedOnSteal || 2);
          state.message = 'Safe cracked! Cops are coming — reach the rendezvous.';
        } else {
          state.missionStage = 'dropoff';
          events |= EVENT_PICKUP;
          state.message = `Got it. Now reach: ${state.mission.dropoff.label}.`;
        }
      }
    } else if (dist(p.x, p.y, obj.x, obj.y) < 64) {
      const reward = state.mission.reward;
      p.money += reward;
      events |= EVENT_DROPOFF;
      state.missionIndex += 1;
      if (state.missionIndex >= MISSIONS.length) {
        state.allDone = true;
        state.missionStage = 'done';
        events |= EVENT_MISSION_DONE | EVENT_ALL_DONE;
        state.message = `All missions complete! You made $${p.money}.`;
        if (p.money > state.best) state.best = p.money;
      } else {
        state.mission = MISSIONS[state.missionIndex];
        state.missionStage = 'pickup';
        events |= EVENT_MISSION_DONE;
        state.message = `Mission complete! +$${reward}. Next: ${state.mission.name} — ${state.mission.brief}`;
      }
    }
    return events;
  }

  function step(dt, input) {
    if (state.gameOver) return EVENT_GAME_OVER;
    state.time += dt;
    let events = 0;
    if (input.enter) events |= enterOrExitCar();
    events |= stepPlayer(dt, input);
    stepTraffic(dt);
    stepPeds(dt);
    events |= stepCops(dt);
    events |= stepGuards(dt);
    events |= stepBullets(dt);
    events |= stepMission(dt);
    return events;
  }

  reset();
  return { state, step, reset, objective, setWanted };
}
